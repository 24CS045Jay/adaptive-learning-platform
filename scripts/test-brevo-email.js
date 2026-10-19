import dotenv from "dotenv";
import { BrevoClient } from "@getbrevo/brevo";
import { getBrevoSender } from "../lib/mailer.js";

dotenv.config();

console.log("=================================================================");
console.log("EDUSENSE AI — BREVO TRANSACTIONAL EMAIL VERIFICATION TOOL");
console.log("=================================================================");

const apiKey = (process.env.BREVO_API_KEY || "").trim();
const sender = getBrevoSender();
const targetEmail = process.argv[2] || sender.email || "recipient@example.com";

console.log("Sender Email: ", sender.email);
console.log("Sender Name:  ", sender.name);
console.log("Target Email: ", targetEmail);
console.log("API Key Set:  ", apiKey ? `Yes (${apiKey.slice(0, 8)}...${apiKey.slice(-4)})` : "❌ NO (Missing BREVO_API_KEY)");

if (!apiKey) {
  console.error("\n❌ Error: BREVO_API_KEY is not defined in your .env file.");
  console.error("Please add BREVO_API_KEY=xkeysib-... to your root .env file and try again.\n");
  process.exit(1);
}

async function runTest() {
  try {
    console.log("\nConnecting to Brevo API over HTTPS (https://api.brevo.com)...");
    const client = new BrevoClient({ apiKey });

    const payload = {
      sender: { email: sender.email, name: sender.name },
      to: [{ email: targetEmail, name: "Test Recipient" }],
      subject: "🧪 Test Transactional Email from EduSense AI (Brevo API)",
      textContent: "Hello!\n\nThis is a verified test email sent via Brevo Transactional Email API over HTTPS.\n\nYour EduSense AI email infrastructure is operational on Render and Vercel.\n\nBest regards,\nEduSense AI Platform",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 8px; text-align: center; color: white;">
            <h2 style="margin: 0;">EduSense AI — Brevo API Test</h2>
          </div>
          <div style="padding: 24px 8px; color: #374151; line-height: 1.6;">
            <p>Hello,</p>
            <p>This email confirms that your <strong>Brevo Transactional Email API over HTTPS</strong> is correctly configured and successfully delivering messages!</p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 8px; color: #166534; font-size: 14px;">
              ✅ <strong>Delivery Status:</strong> HTTPS API Operational<br>
              🕒 <strong>Timestamp:</strong> ${new Date().toISOString()}
            </div>
            <p style="margin-top: 20px; font-size: 13px; color: #6b7280;">Sent securely without SMTP ports from EduSense AI.</p>
          </div>
        </div>
      `,
    };

    const response = await client.transactionalEmails.sendTransacEmail(payload);
    const messageId = response?.messageId || response?.messageIds?.[0] || "sent";

    console.log("\n=================================================================");
    console.log("✅ SUCCESS: Email successfully delivered to Brevo API!");
    console.log("Message ID:", messageId);
    console.log("=================================================================\n");
  } catch (error) {
    console.error("\n❌ BREVO API ERROR OCCURRED:");
    console.error("Status Code: ", error?.statusCode || error?.status || "N/A");
    console.error("Message:     ", error?.message);
    if (error?.body) {
      console.error("Details:     ", JSON.stringify(error.body, null, 2));
    }
    console.error("\nTroubleshooting tips:");
    console.error("1. Make sure your BREVO_API_KEY starts with 'xkeysib-' and has Transactional Email permissions.");
    console.error("2. Verify that your BREVO_SENDER_EMAIL is a verified sender in your Brevo Dashboard (Senders & IP -> Senders).");
    console.error("3. If your account is in validation, complete Brevo's sender verification.\n");
    process.exit(1);
  }
}

runTest();
