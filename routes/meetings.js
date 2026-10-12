import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  MeetingSlot,
  MeetingBooking,
  User,
  Subject,
  Notification,
  AuditLog,
} from "../models/index.js";
import { createTeamsOnlineMeeting } from "../lib/teams-meeting.js";

const router = express.Router();

router.use(authenticate);

// In-memory/local resilient fallback store for instances where table is pending Supabase migration
const memorySlots = new Map();
const memoryBookings = new Map();

// Helper to seed initial sample slot if empty for immediate live testing
function ensureSeedData(facultyId, facultyName) {
  if (memorySlots.size === 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    const endTomorrow = new Date(tomorrow);
    endTomorrow.setHours(16, 0, 0, 0);

    const slotId = "slot-default-seed-1";
    memorySlots.set(slotId, {
      id: slotId,
      _id: slotId,
      facultyId: facultyId || "seed-faculty",
      facultyName: facultyName || "Prof. Rajesh Patel",
      subjectCode: "CSUC301",
      subjectName: "Big Data Analytics",
      topic: "Kafka & Stream Ingestion Doubt Clearing",
      date: tomorrow.toISOString().split("T")[0],
      startTime: tomorrow.toISOString(),
      endTime: endTomorrow.toISOString(),
      durationMinutes: 60,
      capacity: 5,
      bookedCount: 0,
      locationType: "teams",
      status: "active",
      notes: "Please review Unit 1 notes prior to attending.",
      createdAt: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACULTY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/meetings/slots
 * Faculty creates an available office hour / doubt session slot
 */
router.post("/slots", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const {
      subjectCode,
      subjectName,
      subjectId,
      topic,
      date,
      startTime,
      endTime,
      durationMinutes,
      capacity,
      notes,
    } = req.body;

    if (!topic || !startTime || !endTime) {
      return res.status(400).json({ error: "Topic, start time, and end time are required." });
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();

    if (startDate <= now) {
      return res.status(400).json({ error: "Cannot schedule meeting slots in the past." });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: "End time must be strictly after start time." });
    }

    const facultyId = req.user.id || req.user._id;
    const facultyName = req.user.name || "Faculty Member";

    // Overlap prevention: verify faculty has no overlapping slot
    let existingSlots = [];
    try {
      existingSlots = await MeetingSlot.find({ facultyId, status: "active" });
    } catch {
      existingSlots = Array.from(memorySlots.values()).filter(
        (s) => s.facultyId === facultyId && s.status === "active"
      );
    }

    const hasOverlap = existingSlots.some((slot) => {
      const sStart = new Date(slot.startTime);
      const sEnd = new Date(slot.endTime);
      return startDate < sEnd && endDate > sStart;
    });

    if (hasOverlap) {
      return res.status(409).json({
        error: "You already have an active office hour slot scheduled during this timeframe.",
      });
    }

    const slotDoc = {
      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      facultyId,
      facultyName,
      subjectCode: subjectCode || "CSUC301",
      subjectName: subjectName || "Big Data Analytics",
      subjectId: subjectId || null,
      topic: topic.trim(),
      date: date || startDate.toISOString().split("T")[0],
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes: Number(durationMinutes) || Math.round((endDate - startDate) / 60000),
      capacity: Number(capacity) || 1,
      bookedCount: 0,
      locationType: "teams",
      status: "active",
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };

    try {
      await MeetingSlot.create(slotDoc);
    } catch (dbErr) {
      console.warn("[Meetings API] Saving slot to memory cache fallback:", dbErr.message);
    }
    memorySlots.set(slotDoc.id, slotDoc);

    // Audit log
    try {
      await AuditLog.create({
        actor: req.user.email,
        action: "FACULTY_SLOT_CREATED",
        target: slotDoc.id,
        details: { topic: slotDoc.topic, startTime: slotDoc.startTime },
      });
    } catch {}

    res.status(201).json({
      success: true,
      message: "Office hour slot published successfully.",
      slot: slotDoc,
    });
  } catch (error) {
    console.error("[Meetings API] Error creating slot:", error);
    res.status(500).json({ error: error.message || "Failed to create slot." });
  }
});

/**
 * GET /api/meetings/faculty/slots
 * Retrieve slots published by current faculty
 */
router.get("/faculty/slots", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const facultyId = req.user.id || req.user._id;
    ensureSeedData(facultyId, req.user.name);

    let slots = [];
    try {
      slots = await MeetingSlot.find({ facultyId });
    } catch {}

    if (!slots || slots.length === 0) {
      slots = Array.from(memorySlots.values()).filter((s) => s.facultyId === facultyId);
    }

    // Sort by startTime asc
    slots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    res.json(slots);
  } catch (error) {
    console.error("[Meetings API] Error fetching faculty slots:", error);
    res.status(500).json({ error: "Failed to fetch slots." });
  }
});

/**
 * GET /api/meetings/faculty/bookings
 * Retrieve booking requests directed to current faculty
 */
router.get("/faculty/bookings", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const facultyId = req.user.id || req.user._id;

    let bookings = [];
    try {
      bookings = await MeetingBooking.find({ facultyId });
    } catch {}

    if (!bookings || bookings.length === 0) {
      bookings = Array.from(memoryBookings.values()).filter((b) => b.facultyId === facultyId);
    }

    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(bookings);
  } catch (error) {
    console.error("[Meetings API] Error fetching faculty bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

/**
 * PATCH /api/meetings/bookings/:id/status
 * Faculty manages booking status: approved, rejected, completed, no_show
 */
router.patch("/bookings/:id/status", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, facultyNotes, rejectionReason } = req.body;
    const facultyId = req.user.id || req.user._id;

    const validTransitions = ["approved", "rejected", "completed", "cancelled", "no_show"];
    if (!validTransitions.includes(status)) {
      return res.status(400).json({ error: `Invalid status transition: ${status}` });
    }

    let booking = null;
    try {
      booking = await MeetingBooking.findOne({ id });
    } catch {}
    if (!booking) {
      booking = memoryBookings.get(id);
    }

    if (!booking) {
      return res.status(404).json({ error: "Meeting booking not found." });
    }

    if (booking.facultyId !== facultyId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: You can only update bookings for your own sessions." });
    }

    let teamsMeetingData = null;

    // If approving, generate Microsoft Teams meeting
    if (status === "approved" && !booking.teamsJoinUrl) {
      teamsMeetingData = await createTeamsOnlineMeeting({
        subject: `EduSense AI: ${booking.topic} (Prof. ${req.user.name})`,
        startTime: booking.startTime,
        endTime: booking.endTime,
        facultyEmail: req.user.email,
        studentEmail: booking.studentEmail,
        description: booking.doubtDescription,
      });

      booking.teamsJoinUrl = teamsMeetingData.joinWebUrl;
      booking.teamsMeetingId = teamsMeetingData.meetingId;
      booking.teamsProvider = teamsMeetingData.provider;
      booking.teamsIsLive = teamsMeetingData.isLive;
    }

    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    if (facultyNotes) booking.facultyNotes = facultyNotes;
    if (rejectionReason) booking.rejectionReason = rejectionReason;

    try {
      if (booking.save) await booking.save();
    } catch {}
    memoryBookings.set(booking.id, booking);

    // Notify student
    try {
      await Notification.create({
        userId: booking.studentId,
        title: `Meeting ${status.toUpperCase()}: ${booking.topic}`,
        message:
          status === "approved"
            ? `Your Microsoft Teams doubt session on "${booking.topic}" was approved. Click to view join link.`
            : `Your meeting request status was updated to: ${status}.`,
        link: "/student/planner",
        read: false,
      });
    } catch {}

    res.json({
      success: true,
      message: `Booking has been updated to ${status}.`,
      booking,
    });
  } catch (error) {
    console.error("[Meetings API] Error updating booking status:", error);
    res.status(500).json({ error: error.message || "Failed to update booking status." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/meetings/available-slots
 * Browse upcoming available office hours
 */
router.get("/available-slots", async (req, res) => {
  try {
    ensureSeedData(null, null);
    const { subjectCode } = req.query;
    const now = new Date();

    let slots = [];
    try {
      slots = await MeetingSlot.find({ status: "active" });
    } catch {}

    if (!slots || slots.length === 0) {
      slots = Array.from(memorySlots.values()).filter((s) => s.status === "active");
    }

    // Filter only future slots with open capacity
    let available = slots.filter((slot) => {
      const end = new Date(slot.endTime);
      const hasCap = (slot.bookedCount || 0) < (slot.capacity || 1);
      return end > now && hasCap;
    });

    if (subjectCode) {
      available = available.filter(
        (s) => s.subjectCode?.toLowerCase() === String(subjectCode).toLowerCase()
      );
    }

    available.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    res.json(available);
  } catch (error) {
    console.error("[Meetings API] Error fetching available slots:", error);
    res.status(500).json({ error: "Failed to fetch available slots." });
  }
});

/**
 * POST /api/meetings/bookings
 * Student requests/books a session
 */
router.post("/bookings", requireRole("student"), async (req, res) => {
  try {
    const { slotId, topic, doubtDescription, meetingType = "one_on_one" } = req.body;
    const studentId = req.user.id || req.user._id;
    const studentName = req.user.name || "Student";
    const studentEmail = req.user.email || "student@charusat.edu.in";

    if (!slotId || !topic) {
      return res.status(400).json({ error: "Slot ID and doubt topic are required." });
    }

    let slot = null;
    try {
      slot = await MeetingSlot.findOne({ id: slotId });
    } catch {}
    if (!slot) slot = memorySlots.get(slotId);

    if (!slot) {
      return res.status(404).json({ error: "Selected meeting slot does not exist." });
    }

    const slotStart = new Date(slot.startTime);
    if (slotStart <= new Date()) {
      return res.status(400).json({ error: "Cannot book a slot that has already passed." });
    }

    if ((slot.bookedCount || 0) >= (slot.capacity || 1)) {
      return res.status(409).json({ error: "This slot is already fully booked." });
    }

    // Double-booking check: has student already booked during this time?
    let studentBookings = [];
    try {
      studentBookings = await MeetingBooking.find({ studentId, status: { $in: ["requested", "approved"] } });
    } catch {
      studentBookings = Array.from(memoryBookings.values()).filter(
        (b) => b.studentId === studentId && ["requested", "approved"].includes(b.status)
      );
    }

    const hasConflict = studentBookings.some((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return slotStart < bEnd && new Date(slot.endTime) > bStart;
    });

    if (hasConflict) {
      return res.status(409).json({
        error: "You already have another meeting booked or requested during this timeframe.",
      });
    }

    // Auto-create initial Teams meeting link preview or pending approval
    const bookingDoc = {
      id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slotId: slot.id,
      facultyId: slot.facultyId,
      facultyName: slot.facultyName,
      studentId,
      studentName,
      studentEmail,
      subjectCode: slot.subjectCode,
      subjectName: slot.subjectName,
      topic: topic.trim(),
      doubtDescription: doubtDescription ? doubtDescription.trim() : "",
      meetingType,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      status: "requested",
      teamsJoinUrl: null,
      teamsMeetingId: null,
      teamsProvider: "microsoft_teams",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await MeetingBooking.create(bookingDoc);
    } catch (e) {
      console.warn("[Meetings API] Saving booking to memory cache fallback:", e.message);
    }
    memoryBookings.set(bookingDoc.id, bookingDoc);

    // Increment slot bookedCount
    slot.bookedCount = (slot.bookedCount || 0) + 1;
    try {
      if (slot.save) await slot.save();
    } catch {}
    memorySlots.set(slot.id, slot);

    // Notify faculty
    try {
      await Notification.create({
        userId: slot.facultyId,
        title: `New Doubt Meeting Request: ${studentName}`,
        message: `${studentName} requested a session on "${bookingDoc.topic}" for ${new Date(slot.startTime).toLocaleString()}.`,
        link: "/faculty/index",
        read: false,
      });
    } catch {}

    res.status(201).json({
      success: true,
      message: "Meeting request submitted successfully. Awaiting faculty approval.",
      booking: bookingDoc,
    });
  } catch (error) {
    console.error("[Meetings API] Error booking slot:", error);
    res.status(500).json({ error: error.message || "Failed to book meeting." });
  }
});

/**
 * GET /api/meetings/student/bookings
 * Student views only their own bookings
 */
router.get("/student/bookings", requireRole("student"), async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;

    let bookings = [];
    try {
      bookings = await MeetingBooking.find({ studentId });
    } catch {}

    if (!bookings || bookings.length === 0) {
      bookings = Array.from(memoryBookings.values()).filter((b) => b.studentId === studentId);
    }

    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(bookings);
  } catch (error) {
    console.error("[Meetings API] Error fetching student bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

/**
 * PATCH /api/meetings/bookings/:id/student-cancel
 * Student cancels their own request/booking
 */
router.patch("/bookings/:id/student-cancel", requireRole("student"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const studentId = req.user.id || req.user._id;

    let booking = null;
    try {
      booking = await MeetingBooking.findOne({ id });
    } catch {}
    if (!booking) booking = memoryBookings.get(id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (booking.studentId !== studentId) {
      return res.status(403).json({ error: "Unauthorized: You can only cancel your own bookings." });
    }

    if (!["requested", "approved"].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a booking with status "${booking.status}".` });
    }

    booking.status = "cancelled";
    booking.cancellationReason = reason || "Cancelled by student";
    booking.updatedAt = new Date().toISOString();

    try {
      if (booking.save) await booking.save();
    } catch {}
    memoryBookings.set(booking.id, booking);

    // Free up slot capacity if slot exists
    if (booking.slotId) {
      let slot = null;
      try {
        slot = await MeetingSlot.findOne({ id: booking.slotId });
      } catch {}
      if (!slot) slot = memorySlots.get(booking.slotId);

      if (slot && slot.bookedCount > 0) {
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        try {
          if (slot.save) await slot.save();
        } catch {}
        memorySlots.set(slot.id, slot);
      }
    }

    res.json({ success: true, message: "Booking cancelled successfully.", booking });
  } catch (error) {
    console.error("[Meetings API] Error cancelling booking:", error);
    res.status(500).json({ error: "Failed to cancel booking." });
  }
});

export default router;
