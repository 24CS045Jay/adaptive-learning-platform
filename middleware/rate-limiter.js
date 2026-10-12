/**
 * EduSense AI Security Rate Limiter Middleware
 * Protects Authentication, LLM Inference, Uploads, and API endpoints
 * without external dependencies.
 */

class MemoryRateLimiter {
  constructor({ windowMs = 60 * 1000, max = 60, message = "Too many requests. Please try again later." }) {
    this.windowMs = windowMs;
    this.max = max;
    this.message = message;
    this.hits = new Map();

    // Clean up expired entries every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.hits.entries()) {
        if (now > record.resetTime) {
          this.hits.delete(key);
        }
      }
    }, 2 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      // Key can be authenticated user id or client IP
      const key = req.user?.id || req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anonymous";
      const now = Date.now();

      let record = this.hits.get(key);
      if (!record || now > record.resetTime) {
        record = {
          count: 0,
          resetTime: now + this.windowMs,
        };
      }

      record.count += 1;
      this.hits.set(key, record);

      const remaining = Math.max(0, this.max - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader("X-RateLimit-Limit", this.max);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", resetSeconds);

      if (record.count > this.max) {
        res.setHeader("Retry-After", resetSeconds);
        return res.status(429).json({
          error: this.message,
          retryAfterSeconds: resetSeconds,
        });
      }

      next();
    };
  }
}

// 1. Auth Rate Limiter: max 15 login/register attempts per 15 minutes
export const authLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login/registration attempts. For security, please wait 15 minutes before trying again.",
}).middleware();

// 2. AI Tutor Inference Limiter: max 30 queries per minute per user
export const tutorLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "AI tutor request limit reached. Please wait a moment before sending another query.",
}).middleware();

// 3. Document Upload Limiter: max 15 uploads per 10 minutes
export const uploadLimiter = new MemoryRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: "Document upload rate limit reached. Please wait before uploading more files.",
}).middleware();

// 4. Meeting Booking Limiter: max 10 booking requests per minute
export const meetingLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Meeting booking rate limit reached. Please wait a moment.",
}).middleware();
