const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/** General API rate limit — applied globally in app.js */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

/** Stricter limit for auth endpoints (login/register/forgot-password) to slow brute force. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

/** Limit for the public notification-send endpoint to prevent abuse of a leaked API key. */
const sendNotificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Notification send rate limit exceeded.' },
});

module.exports = { generalLimiter, authLimiter, sendNotificationLimiter };
