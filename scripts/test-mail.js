import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

console.log("Testing SMTP configuration...");
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS length:", process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER || "24cs045@charusat.edu.in",
    pass: process.env.SMTP_PASS || "tqivkbggaebitxqf",
  },
});

async function main() {
  try {
    console.log("Verifying connection to Gmail...");
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully!");

    console.log("Sending test email to:", process.env.SMTP_USER);
    const info = await transporter.sendMail({
      from: `"Edusense-AI" <${process.env.SMTP_USER || "24cs045@charusat.edu.in"}>`,
      to: process.env.SMTP_USER || "24cs045@charusat.edu.in",
      subject: "Test Email from Edusense-AI Tutor",
      text: "Hello! This is a test email confirming your Gmail SMTP setup is working perfectly.",
      html: "<h3>Hello!</h3><p>This is a test email confirming your Gmail SMTP setup is working perfectly.</p>",
    });

    console.log("✅ Email sent successfully! Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (error) {
    console.error("❌ SMTP Error occurred:");
    console.error(error);
  }
}

main();
