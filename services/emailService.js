const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user) {
    logger.warn('SMTP is not configured — emails will be logged instead of sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    logger.info(`[EMAIL SKIPPED - no SMTP config] to=${to} subject="${subject}"`);
    return { skipped: true };
  }
  return t.sendMail({ from: config.smtp.from, to, subject, html });
}

async function sendVerificationEmail(to, verifyUrl) {
  return sendMail({
    to,
    subject: 'Verify your PushFlow account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Welcome to PushFlow</h2>
        <p>Please verify your email address to activate your account.</p>
        <p><a href="${verifyUrl}" style="background:#FFB020;color:#1a1200;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:600;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(to, resetUrl) {
  return sendMail({
    to,
    subject: 'Reset your PushFlow password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your PushFlow password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="background:#FFB020;color:#1a1200;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:600;">Reset Password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
