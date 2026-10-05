import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { cloudinary } from "../lib/cloudinary.js";
import { Document, Subject, AuditLog } from "../models/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { extractText } from "../lib/textExtract.js";

const router = express.Router();

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8001";

// Ensure local uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "documents");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer memory storage configuration for streaming files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ["pdf", "pptx", "docx"];
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";

    if (!allowedExtensions.includes(ext)) {
      return cb(new Error("ALLOWED_TYPES_ONLY"));
    }
    cb(null, true);
  },
});

// Middleware wrapper for multer error handling
function handleUploadFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.message === "ALLOWED_TYPES_ONLY" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          error: "Invalid file type. Only PDF, PPTX, and DOCX documents are allowed.",
        });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size exceeds maximum limit of 50MB." });
      }
      return res.status(400).json({ error: err.message || "File upload validation failed." });
    }
    next();
  });
}

async function performDocumentIngestion(doc, actorId, action) {
  const subjectCode = doc.subjectId?.code || "GENERAL";
  const collectionName = `subject_${subjectCode}`;
  let ingestionStatus = "failed";
  let chunkCount = 0;

  try {
    const text = await extractText(doc.fileUrl, doc.fileName);
    if (!text || !text.trim()) {
      console.warn(`[Ingest] Document ${doc._id} (${doc.fileName}) produced empty text after extraction.`);
    }

    const ingestRes = await fetch(`${RAG_SERVICE_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: String(doc._id),
        subjectCode,
        text: text || "",
        metadata: {
          subject: subjectCode,
          uploadedAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
          fileName: doc.fileName,
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!ingestRes.ok) {
      const errBody = await ingestRes.text();
      throw new Error(`RAG service returned ${ingestRes.status}: ${errBody.slice(0, 300)}`);
    }

    const ingestData = await ingestRes.json();
    chunkCount = ingestData.chunkCount ?? 0;
    ingestionStatus = "ok";

    if (chunkCount === 0) {
      ingestionStatus = "failed";
      console.warn(`[Ingest] Document ${doc._id} successfully reached RAG service but returned zero chunks.`);
    }

    console.log(`[Ingest] Document ${doc._id} ingested: ${chunkCount} chunks → ${collectionName}`);
  } catch (ingestErr) {
    ingestionStatus = "failed";
    console.warn(`[Ingest] Background ingestion notice for document ${doc._id}:`, ingestErr.message);
  }

  doc.chunkCount = chunkCount;
  doc.chromaCollection = collectionName;
  doc.ingestionStatus = ingestionStatus;
  await doc.save();

  try {
    await AuditLog.create({
      actorId,
      action,
      details: {
        documentId: doc._id,
        fileName: doc.fileName,
        status: doc.status,
        ingestionStatus,
        chunkCount,
        collection: collectionName,
      },
    });
  } catch {}

  return { ingestionStatus, chunkCount, collectionName };
}

// GET /api/documents - List documents
router.get("/", authenticate, async (req, res) => {
  try {
    const { status, subjectId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (subjectId) filter.subjectId = subjectId;

    const documents = await Document.find(filter)
      .populate("subjectId", "name code semester")
      .populate("uploaderId", "name email role")
      .sort({ createdAt: -1 });

    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch documents." });
  }
});

// POST /api/documents/upload - High-speed file upload with local static & Cloudinary support
router.post("/upload", authenticate, requireRole("faculty", "admin"), handleUploadFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No document file attached. Please select a PDF, PPTX, or DOCX file." });
    }

    const { subjectId, topicTag, unit } = req.body;

    // Flexible Subject Resolution
    let subject = null;
    if (subjectId) {
      try {
        subject = await Subject.findById(subjectId);
      } catch {}
      if (!subject) {
        try {
          subject = await Subject.findOne({
            $or: [
              { code: String(subjectId).toUpperCase() },
              { name: String(subjectId) },
              { id: String(subjectId) },
            ],
          });
        } catch {}
      }
    }
    if (!subject) {
      // Fallback to first available subject in system
      try {
        subject = await Subject.findOne();
      } catch {}
    }

    const safeFileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const localFilePath = path.join(UPLOADS_DIR, safeFileName);
    
    // 1. High-speed local write (< 10ms)
    fs.writeFileSync(localFilePath, req.file.buffer);

    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:5000";
    let fileUrl = `${protocol}://${host}/uploads/documents/${safeFileName}`;
    let cloudinaryPublicId = `local_${safeFileName}`;

    // 2. Cloudinary check: only attempt if non-dummy keys are present
    const hasCloudinary =
      process.env.CLOUDINARY_CLOUD_NAME &&
      !process.env.CLOUDINARY_CLOUD_NAME.includes("your_") &&
      process.env.CLOUDINARY_API_KEY &&
      !process.env.CLOUDINARY_API_KEY.includes("your_");

    if (hasCloudinary) {
      try {
        const subjectFolder = `subjects/${subject?.code || "GENERAL"}`;
        const cloudinaryResult = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Cloudinary timeout")), 4000);
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: subjectFolder,
              resource_type: "raw",
              public_id: safeFileName,
            },
            (error, result) => {
              clearTimeout(timeout);
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        if (cloudinaryResult?.secure_url) {
          fileUrl = cloudinaryResult.secure_url;
          cloudinaryPublicId = cloudinaryResult.public_id;
        }
      } catch (cErr) {
        console.warn("[Cloudinary] Upload notice, using high-speed local storage:", cErr.message);
      }
    }

    // 3. Create Document record in Database with status pending (or approved if uploaded by admin)
    const uploaderRole = String(req.user.role || "").toLowerCase();
    const initialStatus = uploaderRole === "admin" || uploaderRole === "super_admin" ? "approved" : "pending";

    const docRecord = await Document.create({
      subjectId: subject ? (subject._id || subject.id) : null,
      uploaderId: req.user._id || req.user.id || req.user.email,
      fileName: req.file.originalname,
      fileUrl,
      cloudinaryPublicId,
      resourceType: "raw",
      status: initialStatus,
      ingestionStatus: "pending",
      topicTag: topicTag || "",
      unit: unit || "",
      chunkCount: 0,
      chromaCollection: "",
    });

    // 4. Log to AuditLog
    try {
      await AuditLog.create({
        actorId: req.user._id || req.user.id,
        action: "UPLOAD_DOCUMENT",
        details: {
          documentId: docRecord._id || docRecord.id,
          fileName: req.file.originalname,
          subjectCode: subject?.code || "GENERAL",
          fileUrl,
        },
      });
    } catch {}

    // Return instant success in < 50ms
    return res.status(201).json({
      message: "Document uploaded successfully and queued for admin approval.",
      document: docRecord,
    });
  } catch (error) {
    console.error("[Document Upload Error]:", error);
    return res.status(500).json({ error: error.message || "Failed to upload document." });
  }
});

// PATCH /api/documents/:id/approve - Admin only
router.patch("/:id/approve", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("subjectId", "name code");
    if (!doc) return res.status(404).json({ error: "Document not found." });

    doc.status = "approved";
    await doc.save();

    const ingestionResult = await performDocumentIngestion(doc, req.user._id || req.user.id, "APPROVE_DOCUMENT");

    return res.json({
      message: `Document approved successfully. Ingestion: ${ingestionResult.ingestionStatus}.`,
      document: doc,
    });
  } catch (error) {
    console.error("[Document Approve Error]:", error);
    return res.status(500).json({ error: "Failed to approve document." });
  }
});

// POST /api/documents/:id/reingest - Admin only
router.post("/:id/reingest", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("subjectId", "name code");
    if (!doc) return res.status(404).json({ error: "Document not found." });
    if (doc.status !== "approved") {
      return res.status(400).json({ error: "Only approved documents can be re-ingested." });
    }

    const ingestionResult = await performDocumentIngestion(doc, req.user._id || req.user.id, "REINGEST_DOCUMENT");

    return res.json({
      message: `Document re-ingested successfully. Ingestion: ${ingestionResult.ingestionStatus}.`,
      document: doc,
    });
  } catch (error) {
    console.error("[Document Reingest Error]:", error);
    return res.status(500).json({ error: "Failed to re-ingest document." });
  }
});

// PATCH /api/documents/:id/reject - Admin only
router.patch("/:id/reject", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("subjectId", "code");
    if (!doc) return res.status(404).json({ error: "Document not found." });

    const wasApproved = doc.status === "approved";
    doc.status = "rejected";
    await doc.save();

    // If it was approved, remove its vectors from ChromaDB to avoid orphaned data
    if (wasApproved) {
      const subjectCode = doc.subjectId?.code || "GENERAL";
      try {
        const delRes = await fetch(`${RAG_SERVICE_URL}/delete-document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: String(doc._id), subjectCode }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!delRes.ok) {
          console.warn(`[RAG Delete] Non-ok response for doc ${doc._id}: ${delRes.status}`);
        } else {
          const delData = await delRes.json();
          console.log(`[RAG Delete] Removed ${delData.deleted} vectors for rejected doc ${doc._id}`);
        }
      } catch (delErr) {
        console.warn(`[RAG Delete] Failed to delete vectors for rejected doc ${doc._id}:`, delErr.message);
      }
    }

    await AuditLog.create({
      actorId: req.user._id || req.user.id,
      action: "REJECT_DOCUMENT",
      details: { documentId: doc._id, fileName: doc.fileName, status: "rejected", vectorsRemoved: wasApproved },
    });

    return res.json({ message: "Document rejected.", document: doc });
  } catch (error) {
    console.error("[Document Reject Error]:", error);
    return res.status(500).json({ error: "Failed to reject document." });
  }
});

// DELETE /api/documents/:id - Admin only (Deletes from Cloudinary AND MongoDB together)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("subjectId", "code");
    if (!doc) return res.status(404).json({ error: "Document not found." });

    const wasApproved = doc.status === "approved";

    // Step 1: Remove from Cloudinary using cloudinaryPublicId
    try {
      if (doc.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(doc.cloudinaryPublicId, { resource_type: "raw" });
      }
    } catch (cErr) {
      console.warn("[Cloudinary Delete Warning]:", cErr.message);
    }

    // Step 2: Remove vectors from ChromaDB if document was ever approved
    if (wasApproved) {
      const subjectCode = doc.subjectId?.code || "GENERAL";
      try {
        const delRes = await fetch(`${RAG_SERVICE_URL}/delete-document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: String(doc._id), subjectCode }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!delRes.ok) {
          console.warn(`[RAG Delete] Non-ok for doc ${doc._id}: ${delRes.status}`);
        } else {
          const delData = await delRes.json();
          console.log(`[RAG Delete] Removed ${delData.deleted} vectors for deleted doc ${doc._id}`);
        }
      } catch (delErr) {
        console.warn(`[RAG Delete] Could not remove vectors for deleted doc ${doc._id}:`, delErr.message);
      }
    }

    // Step 3: Delete Mongo Document record
    await Document.findByIdAndDelete(doc._id);

    // Step 4: Log to AuditLog
    await AuditLog.create({
      actorId: req.user._id || req.user.id,
      action: "DELETE_DOCUMENT",
      details: {
        documentId: doc._id,
        fileName: doc.fileName,
        cloudinaryPublicId: doc.cloudinaryPublicId,
        vectorsRemoved: wasApproved,
      },
    });

    return res.json({ message: "Document deleted from Cloudinary and MongoDB successfully.", id: req.params.id });
  } catch (error) {
    console.error("[Document Delete Error]:", error);
    return res.status(500).json({ error: "Failed to delete document." });
  }
});

export default router;
