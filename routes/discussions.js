import express from "express";
import { authenticate } from "../middleware/auth.js";
import { Discussion, Subject } from "../models/index.js";

const router = express.Router();

router.use(authenticate);

// ── GET /api/discussions ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) {
      filter.subjectId = subjectId;
    }

    const discussions = await Discussion.find(filter).sort({ createdAt: -1 });

    const list = discussions.map((d) => {
      const obj = d.toObject ? d.toObject() : { ...d };
      const rawDate = d.createdAt || d.created_at || new Date().toISOString();
      return {
        ...obj,
        id: String(d._id || d.id),
        title: d.title || "",
        content: d.message || d.content || "",
        subjectName: d.subjectName || d.subject_name || "General",
        author: d.authorName || d.author_name || "Anonymous",
        authorRole: d.authorRole || d.author_role || "Student",
        tags: Array.isArray(d.tags) ? d.tags : [],
        upvotes: d.upvotes ?? 0,
        createdAt: typeof rawDate === "string" ? rawDate.split("T")[0] : new Date(rawDate).toISOString().split("T")[0],
        answers: (obj.answers || []).map((ans) => ({
          ...ans,
          id: String(ans._id || ans.id || `ans_${Date.now()}`),
          author: ans.authorName || ans.author_name || ans.author || "Anonymous",
          authorRole: ans.authorRole || ans.author_role || "Faculty",
          content: ans.content || ans.message || "",
          isFacultyVerified: !!ans.isFacultyVerified,
          upvotes: ans.upvotes ?? 0,
          createdAt: ans.createdAt || ans.created_at ? new Date(ans.createdAt || ans.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        })),
      };
    });

    res.json(list);
  } catch (error) {
    console.error("[Discussions API] GET error:", error);
    res.status(500).json({ error: "Failed to fetch discussion posts." });
  }
});

// ── POST /api/discussions ───────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { subjectId, subjectName, title, message, content, tags } = req.body;
    const discussionMessage = message || content;

    if (!discussionMessage) {
      return res.status(400).json({ error: "Discussion content is required." });
    }

    let finalSubjectId = subjectId || null;
    let finalSubjectName = subjectName || "General";

    if (!finalSubjectId && subjectName) {
      const subj = await Subject.findOne({ name: subjectName });
      if (subj) {
        finalSubjectId = subj._id || subj.id;
        finalSubjectName = subj.name;
      }
    }

    const post = await Discussion.create({
      subjectId: finalSubjectId,
      departmentId: req.user?.departmentId || "CE",
      authorId: req.user?._id || req.user?.id,
      authorName: req.user?.name || "Student",
      authorRole: req.user?.role === "faculty" ? "Faculty" : "Student",
      title: title || "",
      message: discussionMessage,
      tags: Array.isArray(tags) ? tags : [],
      upvotes: 1,
      answers: [],
    });

    res.status(201).json({
      id: String(post._id || post.id),
      title: post.title || title || "",
      content: discussionMessage,
      subjectName: finalSubjectName,
      author: req.user?.name || "Student",
      authorRole: req.user?.role === "faculty" ? "Faculty" : "Student",
      tags: Array.isArray(tags) ? tags : [],
      upvotes: 1,
      createdAt: new Date().toISOString().split("T")[0],
      answers: [],
    });
  } catch (error) {
    console.error("[Discussions API] POST error:", error);
    res.status(500).json({ error: error.message || "Failed to create discussion post." });
  }
});

// ── POST /api/discussions/:id/answers ───────────────────────────────────────
router.post("/:id/answers", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required for answers." });
    }

    const post = await Discussion.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Discussion post not found." });
    }

    const authorRole = req.user.role === "faculty" ? "Faculty" : "Student";
    const newAnswer = {
      id: `ans_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      authorId: req.user._id || req.user.id,
      author: req.user.name || "Faculty",
      authorName: req.user.name || "Faculty",
      authorRole,
      content: content.trim(),
      isFacultyVerified: authorRole === "Faculty",
      upvotes: 1,
      createdAt: new Date().toISOString().split("T")[0],
    };

    let currentAnswers = [];
    if (Array.isArray(post.answers)) {
      currentAnswers = [...post.answers];
    } else if (typeof post.answers === "string") {
      try {
        currentAnswers = JSON.parse(post.answers);
      } catch {
        currentAnswers = [];
      }
    }
    currentAnswers.push(newAnswer);

    await Discussion.findByIdAndUpdate(post.id || post._id, { answers: currentAnswers });

    res.status(201).json({
      id: String(post.id || post._id),
      title: post.title || "",
      content: post.message || post.content || "",
      subjectName: post.subjectName || "General",
      author: post.authorName || post.author || "Student",
      authorRole: post.authorRole || "Student",
      tags: Array.isArray(post.tags) ? post.tags : [],
      upvotes: post.upvotes ?? 1,
      createdAt: post.createdAt ? new Date(post.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      answers: currentAnswers,
    });
  } catch (error) {
    console.error("[Discussions API] POST answer error:", error);
    res.status(500).json({ error: "Failed to post answer." });
  }
});

// ── PATCH /api/discussions/:id/upvote ──────────────────────────────────────
router.patch("/:id/upvote", async (req, res) => {
  try {
    const post = await Discussion.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Discussion post not found." });
    }

    const newUpvotes = (post.upvotes || 0) + 1;
    await Discussion.findByIdAndUpdate(post.id || post._id, { upvotes: newUpvotes });

    res.json({ id: String(post.id || post._id), upvotes: newUpvotes });
  } catch (error) {
    console.error("[Discussions API] PATCH upvote error:", error);
    res.status(500).json({ error: "Failed to upvote discussion post." });
  }
});

export default router;
