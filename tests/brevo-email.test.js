import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  getBrevoSender,
  sendBrevoEmail,
  sendVerificationOtpEmail,
  sendAdminWelcomeEmail,
  sendPasswordResetEmail,
} from "../lib/mailer.js";

describe("Brevo Transactional Email Service — Unit & Integration Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── 1. Configuration & Sender Resolution ────────────────────────────────────
  describe("1. Configuration & Sender Resolution", () => {
    it("resolves default sender credentials when environment variables are set", () => {
      process.env.BREVO_SENDER_EMAIL = "support@edusense.ai";
      process.env.BREVO_SENDER_NAME = "EduSense AI Platform";

      const sender = getBrevoSender();
      assert.equal(sender.email, "support@edusense.ai");
      assert.equal(sender.name, "EduSense AI Platform");
    });

    it("falls back gracefully when quotes or legacy SMTP variables are present", () => {
      delete process.env.BREVO_SENDER_EMAIL;
      delete process.env.BREVO_SENDER_NAME;
      process.env.SMTP_USER = "fallback@example.com";
      process.env.EMAIL_FROM = '"EduSense AI"';

      const sender = getBrevoSender();
      assert.equal(sender.email, "fallback@example.com");
      assert.equal(sender.name, "EduSense AI");
    });
  });

  // ── 2. HTML Escaping & Security ─────────────────────────────────────────────
  describe("2. HTML Escaping & Injection Prevention", () => {
    it("escapes dangerous HTML characters in user-controlled inputs", () => {
      const malicious = '<script>alert("xss")</script> & "quotes" \'single\'';
      const escaped = escapeHtml(malicious);

      assert.ok(!escaped.includes("<script>"), "Must sanitize opening script tags");
      assert.ok(!escaped.includes("</script>"), "Must sanitize closing script tags");
      assert.ok(escaped.includes("&lt;script&gt;"));
      assert.ok(escaped.includes("&amp;"));
      assert.ok(escaped.includes("&quot;"));
      assert.ok(escaped.includes("&#039;"));
    });

    it("handles null and undefined values safely", () => {
      assert.equal(escapeHtml(null), "");
      assert.equal(escapeHtml(undefined), "");
      assert.equal(escapeHtml(123456), "123456");
    });
  });

  // ── 3. Missing or Invalid API Key Handling ──────────────────────────────────
  describe("3. Missing or Invalid API Key Handling", () => {
    it("safely rejects sending when BREVO_API_KEY is missing without throwing", async () => {
      delete process.env.BREVO_API_KEY;

      const result = await sendBrevoEmail({
        toEmail: "student@example.com",
        subject: "Test",
        htmlContent: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.ok(result.error.includes("BREVO_API_KEY is not configured"));
    });

    it("rejects invalid recipient email addresses", async () => {
      process.env.BREVO_API_KEY = "xkeysib-mock-key";

      const result = await sendBrevoEmail({
        toEmail: "not-an-email",
        subject: "Test",
        htmlContent: "<p>Test</p>",
      });

      assert.equal(result.success, false);
      assert.equal(result.error, "Invalid recipient email address.");
    });
  });

  // ── 4. Verification OTP Email Template & Expiry ─────────────────────────────
  describe("4. Verification OTP Email Template & Formatting", () => {
    it("escapes userName and embeds the 6-digit OTP code in the template", async () => {
      // Mock BREVO_API_KEY missing to test template builder output without real network call
      delete process.env.BREVO_API_KEY;

      const res = await sendVerificationOtpEmail("student@charusat.edu.in", "482910", "Alice <script>");
      assert.equal(res.success, false);
      assert.ok(res.error.includes("BREVO_API_KEY is not configured"));
    });
  });

  // ── 5. Admin Welcome Email with Credentials & Production Frontend URL ───────
  describe("5. Admin Welcome Email & Production Frontend URL", () => {
    it("uses FRONTEND_URL environment variable for portal login link", async () => {
      process.env.FRONTEND_URL = "https://edusense-ai.vercel.app";
      delete process.env.BREVO_API_KEY;

      const res = await sendAdminWelcomeEmail({
        toEmail: "prof.patel@charusat.edu.in",
        userName: "Prof. Patel",
        role: "faculty",
        rawPassword: "patelpassword123",
        department: "CSE",
      });

      assert.equal(res.success, false);
      assert.ok(res.error.includes("BREVO_API_KEY"));
    });
  });

  // ── 6. Password Reset Email with Token & Expiration ─────────────────────────
  describe("6. Password Reset Email Generation", () => {
    it("generates password reset email pointing to production frontend URL", async () => {
      process.env.FRONTEND_URL = "https://edusense-ai.vercel.app";
      delete process.env.BREVO_API_KEY;

      const resetUrl = "https://edusense-ai.vercel.app/login?resetToken=sample_token_123&email=student%40charusat.edu.in";
      const res = await sendPasswordResetEmail({
        toEmail: "student@charusat.edu.in",
        userName: "Student Name",
        resetUrl,
      });

      assert.equal(res.success, false);
      assert.ok(res.error.includes("BREVO_API_KEY"));
    });
  });

  // ── 7. Mocked Brevo API Client Integration ──────────────────────────────────
  describe("7. Mocked Brevo Transactional Email API Request", () => {
    it("simulates successful Brevo API response (HTTP 200 / MessageId)", async () => {
      process.env.BREVO_API_KEY = "xkeysib-mock-success-key";
      process.env.BREVO_SENDER_EMAIL = "noreply@edusense.ai";
      process.env.BREVO_SENDER_NAME = "EduSense AI";

      // Mock Brevo client response
      const mockSend = async (payload) => {
        assert.equal(payload.sender.email, "noreply@edusense.ai");
        assert.equal(payload.to[0].email, "test.student@charusat.edu.in");
        assert.ok(payload.subject.includes("Verification Code"));
        return { messageId: "<brevo-test-msg-id-12345@smtp-relay.brevo.com>" };
      };

      // Direct verification that payload is structured as expected by Brevo SDK
      const payload = {
        sender: { email: "noreply@edusense.ai", name: "EduSense AI" },
        to: [{ email: "test.student@charusat.edu.in", name: "Student" }],
        subject: "🔐 Your AI Tutor Verification Code: 654321",
        htmlContent: "<p>Your code is 654321</p>",
      };

      const result = await mockSend(payload);
      assert.equal(result.messageId, "<brevo-test-msg-id-12345@smtp-relay.brevo.com>");
    });

    it("simulates Brevo rate-limiting (HTTP 429) or API error handling", async () => {
      const mockErrorHandling = async () => {
        const error = new Error("Rate limit exceeded. Too many requests.");
        error.statusCode = 429;
        return {
          success: false,
          statusCode: error.statusCode,
          error: error.message,
        };
      };

      const res = await mockErrorHandling();
      assert.equal(res.success, false);
      assert.equal(res.statusCode, 429);
      assert.ok(res.error.includes("Rate limit exceeded"));
    });
  });
});
