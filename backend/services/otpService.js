const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a 6-digit numeric OTP */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/** Normalise an Indian phone to digits-only (strip +91 / spaces) */
const normalisePhone = (phone) => phone.replace(/\D/g, '').replace(/^91(\d{10})$/, '$1');

// ─── Email (Nodemailer + Gmail SMTP) ─────────────────────────────────────────

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your login password)
    },
  });

const sendEmailOtp = async (email, otp) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"SecureLend" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'SecureLend — Your Email Verification Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1a1a2e;margin-top:0;">Verify your email</h2>
        <p style="color:#4b5563;">Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1a1a2e;text-align:center;padding:24px 0;">${otp}</div>
        <p style="color:#9ca3af;font-size:12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

// ─── SMS (Fast2SMS — free credits for Indian numbers) ───────────────────────

const sendSmsOtp = async (phone, otp) => {
  const digits = normalisePhone(phone);

  // Fast2SMS DLT route (use 'q' for quick SMS without DLT — works on free credits)
  const url = 'https://www.fast2sms.com/dev/bulkV2';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',         // quick / promotional route (free credits)
      message: `Your SecureLend verification code is ${otp}. Valid for 10 minutes. Do not share this with anyone.`,
      language: 'english',
      flash: 0,
      numbers: digits,
    }),
  });

  const data = await response.json();
  if (!data.return) {
    throw new Error(`Fast2SMS error: ${JSON.stringify(data)}`);
  }
  return data;
};

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { generateOtp, sendEmailOtp, sendSmsOtp };
