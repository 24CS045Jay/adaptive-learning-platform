import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { ConceptNode, ConceptEdge, Subject, TopicMastery, AuditLog } from "../models/index.js";
import { syncGroundedConceptsForSubject } from "../lib/concept-pipeline.js";

const router = express.Router();

router.use(authenticate);

/**
 * ── GET /api/concept-graph ──────────────────────────────────────────────────
 * Fetches the interactive concept roadmap for a subject, enriched with the
 * authenticated student's real mastery scores, review persistence, verified
 * prerequisite relations, cited document excerpts, and adaptive next-step recommendation.
 */
router.get("/", async (req, res) => {
  try {
    let { subjectId } = req.query;
    const studentId = String(req.user?.id || req.user?._id || "").trim();

    // 1. Resolve subject if not provided or set to 'all'
    if (!subjectId || subjectId === "all") {
      const allSubjects = await Subject.find({});
      if (allSubjects.length > 0) {
        // Find subject the student is enrolled in
        const enrolled = allSubjects.find((s) => {
          const list = Array.isArray(s.enrolledStudentIds)
            ? s.enrolledStudentIds
            : typeof s.enrolledStudentIds === "string"
            ? JSON.parse(s.enrolledStudentIds || "[]")
            : [];
          return list.some((item) => String(item).toLowerCase() === studentId.toLowerCase() || (req.user?.email && String(item).toLowerCase() === req.user.email.toLowerCase()));
        });
        subjectId = enrolled ? String(enrolled.id || enrolled._id) : String(allSubjects[0].id || allSubjects[0]._id);
      }
    }

    if (!subjectId) {
      return res.json({
        nodes: [],
        edges: [],
        subject: null,
        message: "No subject selected or available.",
      });
    }

    // 2. Fetch grounded concepts, prerequisite edges, and subject metadata
    const { nodes: rawNodes, edges: rawEdges, subject } = await syncGroundedConceptsForSubject(subjectId);

    // 3. Fetch authentic student TopicMastery records for this subject
    let studentMasteries = [];
    if (studentId) {
      try {
        studentMasteries = await TopicMastery.find({ user_id: studentId });
      } catch (e) {
        console.warn("[ConceptGraph API] TopicMastery query notice:", e.message);
      }
    }

    // 4. Fetch student's reviewed concepts from AuditLog (isolated per student)
    const reviewedConceptIds = new Set();
    if (studentId) {
      try {
        const reviewLogs = await AuditLog.find({
          actor_id: studentId,
          action: "CONCEPT_REVIEWED",
        });
        reviewLogs.forEach((log) => {
          const cId = log.target || log.details?.conceptId;
          if (cId) reviewedConceptIds.add(String(cId));
        });
      } catch (e) {
        console.warn("[ConceptGraph API] Review AuditLog query notice:", e.message);
      }
    }

    // 5. Build lookup of prerequisites & dependents
    const prereqMap = new Map(); // nodeId -> [prereqNodeIds]
    const dependentMap = new Map(); // nodeId -> [dependentNodeIds]
    
    rawEdges.forEach((e) => {
      const src = String(e.source || e.from || e.fromNodeId);
      const tgt = String(e.target || e.to || e.toNodeId);

      if (!prereqMap.has(tgt)) prereqMap.set(tgt, []);
      prereqMap.get(tgt).push(src);

      if (!dependentMap.has(src)) dependentMap.set(src, []);
      dependentMap.get(src).push(tgt);
    });

    // 6. Enrich nodes with mastery status, reviewed state, and verified relations
    const enrichedNodes = rawNodes.map((n) => {
      const nodeId = String(n.id || n._id);
      const nodeLabel = n.label || n.name || "";
      const isReviewed = reviewedConceptIds.has(nodeId);

      // Find matching mastery record by topic tag, label, or substring match
      const matchingMastery = studentMasteries.find((m) => {
        const mTopic = (m.topic || "").toLowerCase();
        const nLabel = nodeLabel.toLowerCase();
        return mTopic === nLabel || nLabel.includes(mTopic) || mTopic.includes(nLabel);
      });

      let mastery = "unread";
      let masteryScore = null;
      let attemptsCount = 0;

      if (matchingMastery && (matchingMastery.total_attempts > 0 || matchingMastery.totalAttempts > 0)) {
        attemptsCount = matchingMastery.total_attempts || matchingMastery.totalAttempts || 0;
        masteryScore = typeof matchingMastery.score === "number" ? Math.round(matchingMastery.score) : null;

        if (attemptsCount >= 2 && masteryScore !== null && masteryScore >= 80) {
          mastery = "mastered";
        } else if (attemptsCount >= 1 && masteryScore !== null && masteryScore < 60) {
          mastery = "weak";
        } else if (masteryScore !== null && masteryScore >= 60) {
          mastery = "in_progress";
        }
      } else if (isReviewed) {
        mastery = "in_progress"; // Mark as reviewed sets progress without falsely claiming quiz mastery
      }

      // Resolve prerequisite node titles & dependent node titles
      const prereqIds = prereqMap.get(nodeId) || [];
      const dependentIds = dependentMap.get(nodeId) || [];

      const prerequisiteLabels = prereqIds
        .map((pId) => rawNodes.find((other) => String(other.id || other._id) === pId)?.label)
        .filter(Boolean);

      const dependentLabels = dependentIds
        .map((dId) => rawNodes.find((other) => String(other.id || other._id) === dId)?.label)
        .filter(Boolean);

      return {
        ...n,
        id: nodeId,
        mastery,
        masteryScore,
        attemptsCount,
        isReviewed,
        prerequisites: prerequisiteLabels,
        prerequisiteIds: prereqIds,
        dependents: dependentLabels,
        dependentIds,
      };
    });

    // 7. Compute Adaptive Learning Recommendation (Phase 5)
    // Pedagogical priority rule:
    //  a) First check for weak concepts (needs practice / low mastery) where prerequisites are known
    //  b) Next check for the earliest unread / in-progress concept whose prerequisites are met
    //  c) Never locks student out, provides clear transparent rationale
    let recommendedNodeId = null;
    let recommendationReason = "";

    const weakNode = enrichedNodes.find((n) => n.mastery === "weak");
    if (weakNode) {
      recommendedNodeId = weakNode.id;
      recommendationReason = `Demonstrated difficulty on recent assessments (${weakNode.masteryScore}%). Reinforcing this topic will strengthen your foundation.`;
    } else {
      // Find the first concept where all prerequisites are mastered or in_progress
      const nextCandidate = enrichedNodes.find((n) => {
        if (n.mastery === "mastered") return false;
        const pIds = n.prerequisiteIds || [];
        if (pIds.length === 0) return true; // root topic
        // Prerequisites met if reviewed or developing
        return pIds.every((pId) => {
          const pNode = enrichedNodes.find((other) => other.id === pId);
          return pNode && (pNode.mastery === "mastered" || pNode.mastery === "in_progress" || pNode.isReviewed);
        });
      });

      if (nextCandidate) {
        recommendedNodeId = nextCandidate.id;
        if ((nextCandidate.prerequisites || []).length > 0) {
          recommendationReason = `Prerequisites (${nextCandidate.prerequisites.join(", ")}) are ready. You are prepared to progress to ${nextCandidate.label}.`;
        } else {
          recommendationReason = `Recommended starting point to establish core course principles.`;
        }
      } else if (enrichedNodes.length > 0) {
        recommendedNodeId = enrichedNodes[0].id;
        recommendationReason = `All foundational topics reviewed! Select any concept to review or practice.`;
      }
    }

    res.json({
      nodes: enrichedNodes,
      edges: rawEdges,
      subject,
      recommendedNodeId,
      recommendationReason,
    });
  } catch (error) {
    console.error("[ConceptGraph API] GET error:", error);
    res.status(500).json({ error: "Failed to fetch concept roadmap graph." });
  }
});

/**
 * ── POST /api/concept-graph/review ──────────────────────────────────────────
 * Persists student review action separately from demonstrated quiz mastery.
 * Isolated per student, survives refresh and login.
 */
router.post("/review", async (req, res) => {
  try {
    const studentId = String(req.user?.id || req.user?._id || "").trim();
    const { conceptId, subjectId } = req.body;

    if (!conceptId) {
      return res.status(400).json({ error: "conceptId is required." });
    }

    // Persist review to AuditLog
    await AuditLog.create({
      actor_id: studentId,
      action: "CONCEPT_REVIEWED",
      target: String(conceptId),
      details: {
        conceptId: String(conceptId),
        subjectId: subjectId ? String(subjectId) : null,
        reviewedAt: new Date().toISOString(),
      },
    });

    res.json({
      success: true,
      message: "Concept marked as reviewed.",
      conceptId: String(conceptId),
    });
  } catch (error) {
    console.error("[ConceptGraph API] POST review error:", error);
    res.status(500).json({ error: "Failed to record concept review." });
  }
});

/**
 * ── POST /api/concept-graph/generate ────────────────────────────────────────
 * Generates or synchronizes grounded concept nodes and prerequisite edges for a subject.
 */
router.post("/generate", async (req, res) => {
  try {
    const { subjectId } = req.body;
    if (!subjectId) {
      return res.status(400).json({ error: "subjectId is required." });
    }

    const result = await syncGroundedConceptsForSubject(subjectId);
    res.status(201).json({
      success: true,
      message: "Concept graph synchronized with course material.",
      ...result,
    });
  } catch (error) {
    console.error("[ConceptGraph API] POST generate error:", error);
    res.status(500).json({ error: "Failed to generate concept graph." });
  }
});

// ── Legacy Compatibility Endpoints ──────────────────────────────────────────
router.post("/nodes", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { subjectId, name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Node name is required." });
    }

    const node = await ConceptNode.create({
      subjectId: subjectId || null,
      name,
      label: name,
      description: description || "",
    });

    res.status(201).json({
      ...node.toObject(),
      id: String(node._id),
    });
  } catch (error) {
    console.error("[ConceptGraph API] POST node error:", error);
    res.status(500).json({ error: "Failed to create concept node." });
  }
});

router.post("/edges", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { fromNodeId, toNodeId, relationType } = req.body;
    if (!fromNodeId || !toNodeId || !relationType) {
      return res.status(400).json({ error: "fromNodeId, toNodeId, and relationType are required." });
    }

    const edge = await ConceptEdge.create({
      fromNodeId,
      toNodeId,
      sourceNode: fromNodeId,
      targetNode: toNodeId,
      relationType,
    });

    res.status(201).json({
      ...edge.toObject(),
      id: String(edge._id),
      from: String(edge.fromNodeId),
      to: String(edge.toNodeId),
      label: edge.relationType,
    });
  } catch (error) {
    console.error("[ConceptGraph API] POST edge error:", error);
    res.status(500).json({ error: "Failed to create concept edge." });
  }
});

export default router;
