const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Access token: short-lived, sent in Authorization header on every request.
 * Payload: { uid, email }
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Refresh token: long-lived, stored as an HttpOnly cookie only.
 * Payload: { uid, sessionId }
 * `remember` extends expiry from 30d to 90d.
 */
function signRefreshToken(payload, remember = false) {
  const expiresIn = remember
    ? config.jwt.refreshExpiresInRemember
    : config.jwt.refreshExpiresIn;
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
};
