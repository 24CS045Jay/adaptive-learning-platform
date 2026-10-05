import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || "24cs045@charusat.edu.in";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || '"Edusense-AI" <24cs045@charusat.edu.in>';

// Create transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

/**
 * Send a 6-digit verification OTP email to a registering user.
 */
export async function sendVerificationOtpEmail(toEmail, otpCode, userName = "Student") {
  const mailOptions = {
    from: EMAIL_FROM,
    to: toEmail,
    subject: `🔐 Your AI Tutor Verification Code: ${otpCode}`,
    text: `Hello ${userName},\n\nYour 6-digit verification code to access the AI Tutor Platform is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nEdusense-AI Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
          .header { background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a855f7 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 32px 28px; text-align: center; }
          .welcome-text { font-size: 16px; margin-bottom: 20px; color: #374151; line-height: 1.5; }
          .otp-box { background: #f5f3ff; border: 2px dashed #8b5cf6; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 16px 0; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6d28d9; }
          .meta-info { font-size: 13px; color: #6b7280; margin-top: 16px; line-height: 1.6; }
          .footer { background: #f9fafb; padding: 20px 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Edusense AI Tutor</h1>
            <p>Email Address Verification</p>
          </div>
          <div class="content">
            <p class="welcome-text">Hello <strong>${userName}</strong>,</p>
            <p class="welcome-text">Thank you for registering. Use the 6-digit verification code below to verify your email and complete your sign-in to the webportal:</p>
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
            </div>
            <p class="meta-info">⏰ This OTP code will expire in <strong>10 minutes</strong>.<br>If you did not request this verification, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Edusense AI · CSPIT CSE RAG-Powered Learning Platform</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const t = getTransporter();
    const info = await t.sendMail(mailOptions);
    console.log(`[Mailer] ✅ Verification email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Mailer] ⚠️ Failed to send verification email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send Welcome Email for Admin-created accounts with auto-generated credentials (No OTP needed).
 */
export async function sendAdminWelcomeEmail({
  toEmail,
  userName,
  role = "student",
  rawPassword,
  department = "CSE",
}) {
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const portalUrl = process.env.FRONTEND_URL || "http://localhost:8080";

  const mailOptions = {
    from: EMAIL_FROM,
    to: toEmail,
    subject: `🎉 Welcome to AI Tutor - Your Account Details (${roleTitle})`,
    text: `Hello ${userName},\n\nYour account on the Edusense AI Tutor portal has been created and verified by your department administrator.\n\nRole: ${roleTitle}\nDepartment: ${department}\nLogin Email: ${toEmail}\nTemporary Password: ${rawPassword}\n\nSign in at: ${portalUrl}\n\nBest regards,\nEdusense-AI Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; opacity: 0.95; font-size: 14px; }
          .content { padding: 32px 28px; }
          .welcome-title { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 20px; }
          .credentials-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .cred-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
          .cred-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
          .cred-label { color: #64748b; font-weight: 500; }
          .cred-value { color: #0f172a; font-weight: 700; font-family: monospace; }
          .btn-container { text-align: center; margin: 28px 0 16px; }
          .btn { background: #6d28d9; color: #ffffff !important; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(109,40,217,0.3); }
          .verified-badge { display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          .footer { background: #f9fafb; padding: 20px 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Edusense AI Tutor</h1>
            <p>Welcome to your Academic Learning Portal</p>
          </div>
          <div class="content">
            <div class="verified-badge">
              ✓ Admin Verified & Approved
            </div>
            <div class="welcome-title">Hello ${userName},</div>
            <p class="desc">
              Your account has been officially registered and pre-verified by the department administrator. 
              <strong>No OTP code verification is required</strong> — you can sign in directly with the auto-generated credentials below:
            </p>

            <div class="credentials-box">
              <div class="cred-row">
                <span class="cred-label">Role:</span>
                <span class="cred-value" style="font-family: inherit;">${roleTitle}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Department:</span>
                <span class="cred-value" style="font-family: inherit;">${department}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Login Email:</span>
                <span class="cred-value">${toEmail}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Temporary Password:</span>
                <span class="cred-value" style="color: #6d28d9; font-size: 15px;">${rawPassword}</span>
              </div>
            </div>

            <div class="btn-container">
              <a href="${portalUrl}" class="btn">Sign In to AI Tutor Webportal</a>
            </div>
            
            <p class="desc" style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 16px;">
              💡 For your security, you may change your password after logging in from your profile settings.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Edusense AI · CSPIT CSE RAG-Powered Learning Platform</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const t = getTransporter();
    const info = await t.sendMail(mailOptions);
    console.log(`[Mailer] ✅ Admin welcome email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Mailer] ⚠️ Failed to send welcome email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}
