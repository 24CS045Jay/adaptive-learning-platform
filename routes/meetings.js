import express from "express";
import crypto from "crypto";
import { authenticate, requireRole } from "../middleware/auth.js";
import { getDepartmentId } from "../middleware/department.js";
import {
  MeetingSlot,
  MeetingBooking,
  User,
  Subject,
  Notification,
  AuditLog,
} from "../models/index.js";
import {
  createTeamsOnlineMeeting,
  deleteTeamsOnlineMeeting,
  isTeamsConfigured,
  getTeamsConfigurationStatus,
} from "../lib/teams-meeting.js";

const router = express.Router();

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC / STATUS ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/meetings/status
 * Returns sanitized Microsoft Teams configuration status.
 */
router.get("/status", (req, res) => {
  res.json({
    service: "Microsoft Teams Online Meetings Integration",
    provider: "microsoft_teams",
    ...getTeamsConfigurationStatus(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FACULTY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/meetings/students/eligible
 * Faculty retrieves eligible students in their department for targeted session invites.
 */
router.get("/students/eligible", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const departmentId = getDepartmentId(req.user) || "CE";
    const students = await User.find({
      role: "student",
      departmentId,
    }).select("id name email departmentId");

    const sanitized = (students || []).map((s) => ({
      id: s.id || s._id,
      name: s.name,
      email: s.email,
      departmentId: s.departmentId,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error("[Meetings API] Error fetching eligible students:", error);
    res.status(500).json({ error: "Failed to fetch eligible students." });
  }
});

/**
 * POST /api/meetings/slots
 * Faculty creates an office hour slot or direct Teams session.
 */
router.post("/slots", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const {
      subjectCode,
      subjectName,
      subjectId,
      topic,
      description,
      date,
      startTime,
      endTime,
      durationMinutes,
      capacity,
      audienceType = "department",
      invitedStudentIds = [],
      createTeamsMeeting = false,
      notes,
    } = req.body;

    if (!topic || !startTime || !endTime) {
      return res.status(400).json({ error: "Topic, start time, and end time are required." });
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const now = new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date or time format. ISO 8601 timestamps required." });
    }

    if (startDate <= now) {
      return res.status(400).json({ error: "Cannot schedule meeting slots in the past." });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: "End time must be strictly after start time." });
    }

    const validAudiences = ["department", "specific_students", "all"];
    if (!validAudiences.includes(audienceType)) {
      return res.status(400).json({ error: `Invalid audience type: ${audienceType}` });
    }

    if (audienceType === "specific_students" && (!Array.isArray(invitedStudentIds) || invitedStudentIds.length === 0)) {
      return res.status(400).json({
        error: "Please select at least one student when scheduling for specific students.",
      });
    }

    const facultyId = req.user.id || req.user._id;
    const facultyName = req.user.name || "Faculty Member";
    const facultyEmail = req.user.email || "";
    const departmentId = getDepartmentId(req.user) || "CE";

    // Overlap prevention: verify faculty has no overlapping active slot
    const existingSlots = await MeetingSlot.find({ facultyId, status: "active" });
    const hasOverlap = (existingSlots || []).some((slot) => {
      const sStart = new Date(slot.startTime);
      const sEnd = new Date(slot.endTime);
      return startDate < sEnd && endDate > sStart;
    });

    if (hasOverlap) {
      return res.status(409).json({
        error: "You already have an active office hour or session scheduled during this timeframe.",
      });
    }

    let teamsMeetingData = null;
    if (createTeamsMeeting) {
      try {
        teamsMeetingData = await createTeamsOnlineMeeting({
          subject: `${subjectCode || "EduSense"}: ${topic.trim()} (Prof. ${facultyName})`,
          startTime: startDate,
          endTime: endDate,
          facultyEmail,
          description: description || notes || "EduSense AI Faculty Session",
        });
      } catch (teamsErr) {
        console.error("[Meetings API] Microsoft Teams meeting creation failed:", teamsErr);
        return res.status(teamsErr.status || 502).json({
          error: teamsErr.message || "Failed to create Microsoft Teams meeting.",
          code: teamsErr.code || "TEAMS_CREATION_FAILED",
        });
      }
    }

    const slotId = `slot-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const slotDoc = {
      id: slotId,
      facultyId,
      facultyName,
      facultyEmail,
      departmentId,
      subjectCode: subjectCode || "CSUC301",
      subjectName: subjectName || "Course Subject",
      subjectId: subjectId || null,
      topic: topic.trim(),
      description: description ? description.trim() : "",
      date: date || startDate.toISOString().split("T")[0],
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes: Number(durationMinutes) || Math.round((endDate - startDate) / 60000),
      capacity: Number(capacity) || 1,
      bookedCount: 0,
      locationType: "teams",
      audienceType,
      invitedStudentIds: audienceType === "specific_students" ? invitedStudentIds : [],
      teamsMeetingId: teamsMeetingData ? teamsMeetingData.meetingId : null,
      teamsJoinUrl: teamsMeetingData ? teamsMeetingData.joinWebUrl : null,
      teamsOrganizerId: teamsMeetingData ? teamsMeetingData.organizerUserId : null,
      status: "active",
      notes: notes ? notes.trim() : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let createdSlot;
    try {
      createdSlot = await MeetingSlot.create(slotDoc);
    } catch (dbErr) {
      // Compensating transaction: if DB write fails after creating Teams meeting on Graph, clean it up
      if (teamsMeetingData?.meetingId) {
        await deleteTeamsOnlineMeeting({
          meetingId: teamsMeetingData.meetingId,
          organizerUserId: teamsMeetingData.organizerUserId,
        });
      }
      console.error("[Meetings API] Database write failure creating slot:", dbErr);
      return res.status(500).json({ error: "Failed to persist meeting slot to database." });
    }

    // Audit log
    try {
      await AuditLog.create({
        actor: facultyEmail,
        action: "FACULTY_SLOT_CREATED",
        target: slotDoc.id,
        details: {
          topic: slotDoc.topic,
          startTime: slotDoc.startTime,
          audienceType,
          hasTeamsMeeting: Boolean(teamsMeetingData),
        },
      });
    } catch {}

    // If specific students were invited, send them in-app notifications
    if (audienceType === "specific_students" && invitedStudentIds.length > 0) {
      for (const studentId of invitedStudentIds) {
        try {
          await Notification.create({
            userId: studentId,
            title: `Session Invitation: ${topic}`,
            message: `Prof. ${facultyName} invited you to a doubt session on "${topic}" scheduled for ${startDate.toLocaleString()}.`,
            link: "/student/planner",
            read: false,
          });
        } catch {}
      }
    }

    res.status(201).json({
      success: true,
      message: createTeamsMeeting
        ? "Session published with real Microsoft Teams meeting generated!"
        : "Office hour slot published successfully.",
      slot: createdSlot || slotDoc,
    });
  } catch (error) {
    console.error("[Meetings API] Error creating slot:", error);
    res.status(500).json({ error: error.message || "Failed to create slot." });
  }
});

/**
 * GET /api/meetings/faculty/slots
 * Retrieve slots created by current faculty.
 */
router.get("/faculty/slots", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const facultyId = req.user.id || req.user._id;
    const slots = await MeetingSlot.find({ facultyId });

    const sorted = (slots || []).sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    res.json(sorted);
  } catch (error) {
    console.error("[Meetings API] Error fetching faculty slots:", error);
    res.status(500).json({ error: "Failed to fetch slots." });
  }
});

/**
 * GET /api/meetings/faculty/bookings
 * Retrieve booking requests and confirmed sessions directed to current faculty.
 */
router.get("/faculty/bookings", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const facultyId = req.user.id || req.user._id;
    const bookings = await MeetingBooking.find({ facultyId });

    const sorted = (bookings || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    res.json(sorted);
  } catch (error) {
    console.error("[Meetings API] Error fetching faculty bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

/**
 * PATCH /api/meetings/bookings/:id/status
 * Faculty manages booking status: approved, rejected, completed, no_show.
 * On approval, generates real Microsoft Teams meeting link via Graph API.
 */
router.patch("/bookings/:id/status", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, facultyNotes, rejectionReason } = req.body;
    const facultyId = req.user.id || req.user._id;
    const facultyName = req.user.name || "Faculty Member";
    const facultyEmail = req.user.email || "";

    const validTransitions = ["approved", "rejected", "completed", "cancelled", "no_show"];
    if (!validTransitions.includes(status)) {
      return res.status(400).json({ error: `Invalid status transition: ${status}` });
    }

    const booking = await MeetingBooking.findOne({ id });
    if (!booking) {
      return res.status(404).json({ error: "Meeting booking not found." });
    }

    // Ownership check (IDOR prevention)
    if (booking.facultyId !== facultyId && req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        error: "Unauthorized: You can only update bookings for your own sessions.",
      });
    }

    let teamsMeetingData = null;

    // If approving and no Teams meeting has been attached yet, create real Teams meeting
    if (status === "approved" && !booking.teamsJoinUrl) {
      try {
        teamsMeetingData = await createTeamsOnlineMeeting({
          subject: `EduSense AI: ${booking.topic} (Prof. ${facultyName})`,
          startTime: booking.startTime,
          endTime: booking.endTime,
          facultyEmail,
          attendeeEmails: [booking.studentEmail],
          description: booking.doubtDescription || "Doubt Clearing Session",
        });
      } catch (teamsErr) {
        console.error("[Meetings API] Teams meeting generation failed on booking approval:", teamsErr);
        return res.status(teamsErr.status || 502).json({
          error: teamsErr.message || "Failed to generate Microsoft Teams meeting.",
          code: teamsErr.code || "TEAMS_CREATION_FAILED",
          remedy:
            "Verify that MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_ORGANIZER_USER_ID are valid.",
        });
      }

      booking.teamsJoinUrl = teamsMeetingData.joinWebUrl;
      booking.teamsMeetingId = teamsMeetingData.meetingId;
      booking.teamsProvider = "microsoft_teams";
      booking.teamsIsLive = true;
    }

    // If rejecting, restore slot capacity if slot exists
    if (status === "rejected" && booking.slotId && booking.status === "requested") {
      const slot = await MeetingSlot.findOne({ id: booking.slotId });
      if (slot && slot.bookedCount > 0) {
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        try {
          if (slot.save) await slot.save();
          else await MeetingSlot.findByIdAndUpdate(slot.id, { bookedCount: slot.bookedCount });
        } catch (slotErr) {
          console.warn("[Meetings API] Warning updating slot capacity on rejection:", slotErr);
        }
      }
    }

    const previousStatus = booking.status;
    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    if (facultyNotes !== undefined) booking.facultyNotes = facultyNotes;
    if (rejectionReason !== undefined) booking.rejectionReason = rejectionReason;

    try {
      if (booking.save) {
        await booking.save();
      } else {
        await MeetingBooking.findByIdAndUpdate(booking.id, booking);
      }
    } catch (dbErr) {
      // Compensating transaction: clean up newly created Teams meeting if DB update fails
      if (teamsMeetingData?.meetingId) {
        await deleteTeamsOnlineMeeting({
          meetingId: teamsMeetingData.meetingId,
          organizerUserId: teamsMeetingData.organizerUserId,
        });
      }
      console.error("[Meetings API] Database save failure on booking status update:", dbErr);
      return res.status(500).json({ error: "Failed to update booking status in database." });
    }

    // Notify student
    try {
      await Notification.create({
        userId: booking.studentId,
        title: `Meeting ${status.toUpperCase()}: ${booking.topic}`,
        message:
          status === "approved"
            ? `Your Microsoft Teams doubt session on "${booking.topic}" with Prof. ${facultyName} was approved. You can now join via the meeting link.`
            : `Your meeting request status was updated to: ${status}.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
        link: "/student/planner",
        read: false,
      });
    } catch {}

    // Audit log
    try {
      await AuditLog.create({
        actor: facultyEmail,
        action: `MEETING_BOOKING_${status.toUpperCase()}`,
        target: booking.id,
        details: {
          previousStatus,
          newStatus: status,
          studentId: booking.studentId,
          hasJoinUrl: Boolean(booking.teamsJoinUrl),
        },
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

/**
 * PATCH /api/meetings/slots/:id/cancel
 * Faculty cancels an entire slot/session and notifies all booked students.
 */
router.patch("/slots/:id/cancel", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Cancelled by faculty" } = req.body;
    const facultyId = req.user.id || req.user._id;

    const slot = await MeetingSlot.findOne({ id });
    if (!slot) {
      return res.status(404).json({ error: "Meeting slot not found." });
    }

    if (slot.facultyId !== facultyId && req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Unauthorized: You can only cancel your own slots." });
    }

    if (slot.status === "cancelled") {
      return res.status(400).json({ error: "Slot is already cancelled." });
    }

    slot.status = "cancelled";
    slot.updatedAt = new Date().toISOString();
    if (slot.save) await slot.save();
    else await MeetingSlot.findByIdAndUpdate(slot.id, { status: "cancelled", updatedAt: slot.updatedAt });

    // Clean up Teams online meeting if slot had one
    if (slot.teamsMeetingId) {
      await deleteTeamsOnlineMeeting({
        meetingId: slot.teamsMeetingId,
        organizerUserId: slot.teamsOrganizerId,
      });
    }

    // Cancel all active bookings under this slot and notify students
    const bookings = await MeetingBooking.find({
      slotId: slot.id,
      status: { $in: ["requested", "approved"] },
    });

    for (const b of bookings || []) {
      b.status = "cancelled";
      b.cancellationReason = reason;
      b.updatedAt = new Date().toISOString();
      if (b.save) await b.save();
      else await MeetingBooking.findByIdAndUpdate(b.id, { status: "cancelled", cancellationReason: reason });

      // Clean up individual Teams meeting if created
      if (b.teamsMeetingId) {
        await deleteTeamsOnlineMeeting({ meetingId: b.teamsMeetingId });
      }

      // Notify student
      try {
        await Notification.create({
          userId: b.studentId,
          title: `Session Cancelled: ${slot.topic}`,
          message: `The session on "${slot.topic}" scheduled for ${new Date(slot.startTime).toLocaleString()} was cancelled by Prof. ${slot.facultyName}. Reason: ${reason}`,
          link: "/student/planner",
          read: false,
        });
      } catch {}
    }

    res.json({
      success: true,
      message: "Slot and associated bookings have been cancelled.",
      slot,
    });
  } catch (error) {
    console.error("[Meetings API] Error cancelling slot:", error);
    res.status(500).json({ error: error.message || "Failed to cancel slot." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/meetings/available-slots
 * Student browses open faculty office hours and sessions permitted for them.
 */
router.get("/available-slots", async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const studentDept = getDepartmentId(req.user) || "CE";
    const { subjectCode } = req.query;
    const now = new Date();

    let allSlots = await MeetingSlot.find({ status: "active" });

    // Filter by student enrollment if requester is a student
    if (req.user && req.user.role === "student") {
      const studentIdStr = String(req.user.id || req.user._id || "");
      const studentEmail = req.user.email ? String(req.user.email).toLowerCase() : "";
      const subjects = await Subject.find({});
      const enrolledCodes = new Set();
      for (const subj of subjects || []) {
        let list = [];
        try {
          list = Array.isArray(subj.enrolledStudentIds)
            ? subj.enrolledStudentIds
            : typeof subj.enrolledStudentIds === "string"
            ? JSON.parse(subj.enrolledStudentIds || "[]")
            : [];
        } catch {}
        const isEnrolled = list.some((id) => {
          const clean = String(id).toLowerCase();
          return clean === studentIdStr.toLowerCase() || clean === studentEmail;
        });
        if (isEnrolled && subj.code) {
          enrolledCodes.add(subj.code.toLowerCase());
        }
      }

      allSlots = (allSlots || []).filter((slot) => {
        if (!slot.subjectCode) return false;
        return enrolledCodes.has(slot.subjectCode.toLowerCase());
      });
    }

    // Filter slots: future, open capacity, and permitted for this student
    const available = (allSlots || []).filter((slot) => {
      const end = new Date(slot.endTime);
      const isFuture = end > now;
      const hasCap = (slot.bookedCount || 0) < (slot.capacity || 1);

      if (!isFuture || !hasCap) return false;

      // Audience permission check
      if (slot.audienceType === "specific_students") {
        const invited = Array.isArray(slot.invitedStudentIds) ? slot.invitedStudentIds : [];
        if (!invited.includes(studentId)) return false;
      } else if (slot.audienceType === "department") {
        if (slot.departmentId && slot.departmentId !== studentDept && req.user.role !== "super_admin") {
          return false;
        }
      }

      if (subjectCode && slot.subjectCode?.toLowerCase() !== String(subjectCode).toLowerCase()) {
        return false;
      }

      return true;
    });

    available.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Sanitize output: do not expose internal private invite arrays to frontend
    const sanitized = available.map((s) => ({
      id: s.id || s._id,
      facultyId: s.facultyId,
      facultyName: s.facultyName,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      topic: s.topic,
      description: s.description,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      capacity: s.capacity,
      bookedCount: s.bookedCount,
      locationType: s.locationType,
      audienceType: s.audienceType,
      notes: s.notes,
      createdAt: s.createdAt,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error("[Meetings API] Error fetching available slots:", error);
    res.status(500).json({ error: "Failed to fetch available slots." });
  }
});

/**
 * POST /api/meetings/bookings
 * Student requests a doubt session for an open slot.
 */
router.post("/bookings", requireRole("student"), async (req, res) => {
  try {
    const { slotId, topic, doubtDescription, meetingType = "one_on_one", idempotencyKey } = req.body;
    const studentId = req.user.id || req.user._id;
    const studentName = req.user.name || "Student";
    const studentEmail = req.user.email || "student@charusat.edu.in";
    const studentDept = getDepartmentId(req.user) || "CE";

    if (!slotId || !topic) {
      return res.status(400).json({ error: "Slot ID and doubt topic are required." });
    }

    // Idempotency check if key provided
    if (idempotencyKey) {
      const existingKeyBooking = await MeetingBooking.findOne({ idempotencyKey });
      if (existingKeyBooking) {
        return res.json({
          success: true,
          message: "Request already submitted.",
          booking: existingKeyBooking,
        });
      }
    }

    const slot = await MeetingSlot.findOne({ id: slotId });
    if (!slot || slot.status !== "active") {
      return res.status(404).json({ error: "Selected meeting slot does not exist or is no longer active." });
    }

    const slotStart = new Date(slot.startTime);
    if (slotStart <= new Date()) {
      return res.status(400).json({ error: "Cannot book a slot that has already started or passed." });
    }

    // Verify audience eligibility
    if (slot.audienceType === "specific_students") {
      const invited = Array.isArray(slot.invitedStudentIds) ? slot.invitedStudentIds : [];
      if (!invited.includes(studentId)) {
        return res.status(403).json({ error: "You are not eligible to book this specific session." });
      }
    } else if (slot.audienceType === "department") {
      if (slot.departmentId && slot.departmentId !== studentDept && req.user.role !== "super_admin") {
        return res.status(403).json({ error: "This session is restricted to another department." });
      }
    }

    // Verify subject enrollment for student
    if (slot.subjectCode) {
      const subject = await Subject.findOne({
        code: { $regex: new RegExp(`^${slot.subjectCode.trim()}$`, "i") },
      });
      if (subject) {
        let enrolledList = [];
        try {
          enrolledList = Array.isArray(subject.enrolledStudentIds)
            ? subject.enrolledStudentIds
            : typeof subject.enrolledStudentIds === "string"
            ? JSON.parse(subject.enrolledStudentIds || "[]")
            : [];
        } catch {}
        const isEnrolled = enrolledList.some((id) => {
          const clean = String(id).toLowerCase();
          return clean === String(studentId).toLowerCase() || clean === studentEmail.toLowerCase();
        });
        if (!isEnrolled) {
          return res.status(403).json({
            error: `Enrollment required: You are not enrolled in ${slot.subjectCode}. Please enroll in this course from your Dashboard to book faculty doubt sessions.`,
            requiresEnrollment: true,
          });
        }
      }
    }

    // Capacity check
    if ((slot.bookedCount || 0) >= (slot.capacity || 1)) {
      return res.status(409).json({ error: "This slot is already fully booked." });
    }

    // Prevent duplicate booking for the exact same slot
    const existingSlotBooking = await MeetingBooking.findOne({
      slotId: slot.id,
      studentId,
      status: { $in: ["requested", "approved"] },
    });

    if (existingSlotBooking) {
      return res.status(409).json({
        error: "You already have an active request or confirmed booking for this session.",
      });
    }

    // Overlapping schedule check: ensure student has no conflicting meeting
    const studentBookings = await MeetingBooking.find({
      studentId,
      status: { $in: ["requested", "approved"] },
    });

    const hasConflict = (studentBookings || []).some((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return slotStart < bEnd && new Date(slot.endTime) > bStart;
    });

    if (hasConflict) {
      return res.status(409).json({
        error: "You already have another meeting requested or booked during this timeframe.",
      });
    }

    const bookingId = `book-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const bookingDoc = {
      id: bookingId,
      slotId: slot.id,
      facultyId: slot.facultyId,
      facultyName: slot.facultyName,
      studentId,
      studentName,
      studentEmail,
      departmentId: studentDept,
      subjectCode: slot.subjectCode,
      subjectName: slot.subjectName,
      topic: topic.trim(),
      doubtDescription: doubtDescription ? doubtDescription.trim() : "",
      meetingType,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      status: "requested",
      teamsJoinUrl: null, // Teams link is ONLY granted once approved
      teamsMeetingId: null,
      teamsProvider: "microsoft_teams",
      teamsIsLive: true,
      idempotencyKey: idempotencyKey || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let createdBooking;
    try {
      createdBooking = await MeetingBooking.create(bookingDoc);
    } catch (dbErr) {
      console.error("[Meetings API] Error saving booking:", dbErr);
      return res.status(500).json({ error: "Failed to persist meeting booking." });
    }

    // Safely update slot booked count
    slot.bookedCount = (slot.bookedCount || 0) + 1;
    try {
      if (slot.save) await slot.save();
      else await MeetingSlot.findByIdAndUpdate(slot.id, { bookedCount: slot.bookedCount });
    } catch (e) {
      console.warn("[Meetings API] Warning updating slot booked count:", e);
    }

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
      booking: createdBooking || bookingDoc,
    });
  } catch (error) {
    console.error("[Meetings API] Error booking slot:", error);
    res.status(500).json({ error: error.message || "Failed to book meeting." });
  }
});

/**
 * GET /api/meetings/student/bookings
 * Student views only their own bookings.
 * Join URL is disclosed ONLY when approved.
 */
router.get("/student/bookings", requireRole("student"), async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const bookings = await MeetingBooking.find({ studentId });

    const sanitized = (bookings || []).map((b) => {
      const isApproved = b.status === "approved";
      return {
        id: b.id || b._id,
        slotId: b.slotId,
        facultyName: b.facultyName,
        subjectCode: b.subjectCode,
        subjectName: b.subjectName,
        topic: b.topic,
        doubtDescription: b.doubtDescription,
        meetingType: b.meetingType,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        status: b.status,
        // Join URL security: Disclosed only when approved!
        teamsJoinUrl: isApproved ? b.teamsJoinUrl : null,
        teamsMeetingId: isApproved ? b.teamsMeetingId : null,
        facultyNotes: b.facultyNotes || null,
        rejectionReason: b.rejectionReason || null,
        cancellationReason: b.cancellationReason || null,
        createdAt: b.createdAt,
      };
    });

    sanitized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sanitized);
  } catch (error) {
    console.error("[Meetings API] Error fetching student bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

/**
 * PATCH /api/meetings/bookings/:id/student-cancel
 * Student cancels their own booking request or confirmed session.
 */
router.patch("/bookings/:id/student-cancel", requireRole("student"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Student requested cancellation" } = req.body;
    const studentId = req.user.id || req.user._id;

    const booking = await MeetingBooking.findOne({ id });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    // Ownership check (IDOR prevention)
    if (booking.studentId !== studentId) {
      return res.status(403).json({ error: "Unauthorized: You can only cancel your own bookings." });
    }

    if (!["requested", "approved"].includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot cancel a booking with status "${booking.status}".`,
      });
    }

    const previousStatus = booking.status;
    booking.status = "cancelled";
    booking.cancellationReason = reason;
    booking.updatedAt = new Date().toISOString();

    if (booking.save) await booking.save();
    else await MeetingBooking.findByIdAndUpdate(booking.id, booking);

    // Free up slot capacity if slot exists
    if (booking.slotId) {
      const slot = await MeetingSlot.findOne({ id: booking.slotId });
      if (slot && slot.bookedCount > 0) {
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        try {
          if (slot.save) await slot.save();
          else await MeetingSlot.findByIdAndUpdate(slot.id, { bookedCount: slot.bookedCount });
        } catch {}
      }
    }

    // If meeting was approved and had a Teams meeting ID, clean it up
    if (previousStatus === "approved" && booking.teamsMeetingId) {
      await deleteTeamsOnlineMeeting({ meetingId: booking.teamsMeetingId });
    }

    // Notify faculty
    try {
      await Notification.create({
        userId: booking.facultyId,
        title: `Student Cancelled Session: ${booking.topic}`,
        message: `${booking.studentName} cancelled their session on "${booking.topic}" scheduled for ${new Date(booking.startTime).toLocaleString()}.`,
        link: "/faculty/index",
        read: false,
      });
    } catch {}

    res.json({
      success: true,
      message: "Booking cancelled successfully.",
      booking,
    });
  } catch (error) {
    console.error("[Meetings API] Error cancelling booking:", error);
    res.status(500).json({ error: "Failed to cancel booking." });
  }
});

export default router;
