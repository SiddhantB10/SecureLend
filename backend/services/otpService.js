const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a cryptographically secure 6-digit numeric OTP */
const generateOtp = () => String(crypto.randomInt(100000, 1000000));

/** Normalise an Indian phone to digits-only (strip +91 / spaces / dashes) */
const normalisePhone = (phone) => String(phone || '').replace(/\D/g, '').replace(/^91(\d{10})$/, '$1');

const env = (key) => String(process.env[key] || '').trim();

const OTP_TTL_MINUTES = 10;
const PROVIDER_TIMEOUT_MS = Number(process.env.OTP_PROVIDER_TIMEOUT_MS || 15000);

const buildEmailHtml = (otp) => `
  <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
    <h2 style="color:#1a1a2e;margin-top:0;">Verify your email</h2>
    <p style="color:#4b5563;">Use the code below to verify your email address. It expires in <strong>${OTP_TTL_MINUTES} minutes</strong>.</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1a1a2e;text-align:center;padding:24px 0;">${otp}</div>
    <p style="color:#9ca3af;font-size:12px;">If you did not request this, please ignore this email.</p>
  </div>
`;
const EMAIL_SUBJECT = 'SecureLend — Your Email Verification Code';
const buildEmailText = (otp) => `Your SecureLend verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`;

// ─── Email provider 1: Brevo HTTPS API ───────────────────────────────────────
// Works on hosts that block SMTP ports (e.g. Render free tier blocks 25/465/587).
// Set BREVO_API_KEY and EMAIL_FROM (a sender verified in Brevo, can be a Gmail address).

const sendViaBrevo = async (email, otp) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env('BREVO_API_KEY'),
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'SecureLend', email: env('EMAIL_FROM') || env('GMAIL_USER') },
      to: [{ email }],
      subject: EMAIL_SUBJECT,
      htmlContent: buildEmailHtml(otp),
      textContent: buildEmailText(otp),
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo error ${response.status}: ${body}`);
  }
};

// ─── Email provider 2: Gmail SMTP (Nodemailer) ───────────────────────────────

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env('GMAIL_USER'),
      // Google shows App Passwords as "abcd efgh ijkl mnop" — strip the spaces.
      pass: env('GMAIL_APP_PASSWORD').replace(/\s+/g, ''),
    },
    // Fail fast instead of hanging for minutes when SMTP is blocked/unreachable.
    connectionTimeout: PROVIDER_TIMEOUT_MS,
    greetingTimeout: PROVIDER_TIMEOUT_MS,
    socketTimeout: PROVIDER_TIMEOUT_MS,
  });

const sendViaGmail = async (email, otp) => {
  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: `"SecureLend" <${env('GMAIL_USER')}>`,
      to: email,
      subject: EMAIL_SUBJECT,
      text: buildEmailText(otp),
      html: buildEmailHtml(otp),
    });
  } finally {
    transporter.close();
  }
};

const isEmailConfigured = () =>
  Boolean(env('BREVO_API_KEY') || (env('GMAIL_USER') && env('GMAIL_APP_PASSWORD')));

/** Try Brevo (HTTPS) first when configured, then Gmail SMTP. */
const sendEmailOtp = async (email, otp) => {
  const errors = [];

  if (env('BREVO_API_KEY')) {
    try {
      await sendViaBrevo(email, otp);
      return { provider: 'brevo' };
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (env('GMAIL_USER') && env('GMAIL_APP_PASSWORD')) {
    try {
      await sendViaGmail(email, otp);
      return { provider: 'gmail' };
    } catch (error) {
      errors.push(`Gmail SMTP: ${error.message}`);
    }
  }

  if (!errors.length) {
    throw new Error('No email provider configured (set BREVO_API_KEY + EMAIL_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD)');
  }
  throw new Error(errors.join(' | '));
};

// ─── SMS (Fast2SMS) ──────────────────────────────────────────────────────────

const isSmsConfigured = () => Boolean(env('FAST2SMS_API_KEY'));

const sendSmsOtp = async (phone, otp) => {
  if (!isSmsConfigured()) {
    throw new Error('FAST2SMS_API_KEY is not configured');
  }

  const digits = normalisePhone(phone);
  // FAST2SMS_ROUTE=otp uses the OTP route (needs Fast2SMS website verification);
  // default 'q' is the Quick SMS route (needs a one-time wallet recharge on Fast2SMS).
  const route = env('FAST2SMS_ROUTE').toLowerCase() === 'otp' ? 'otp' : 'q';
  const body =
    route === 'otp'
      ? { route: 'otp', variables_values: otp, numbers: digits, flash: 0 }
      : {
          route: 'q',
          message: `Your SecureLend verification code is ${otp}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share this with anyone.`,
          language: 'english',
          flash: 0,
          numbers: digits,
        };

  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: env('FAST2SMS_API_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.return) {
    throw new Error(`Fast2SMS error (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
};

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  generateOtp,
  normalisePhone,
  sendEmailOtp,
  sendSmsOtp,
  isEmailConfigured,
  isSmsConfigured,
  OTP_TTL_MINUTES,
};
