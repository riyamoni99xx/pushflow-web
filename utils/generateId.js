const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/** Generic unique ID (UUID v4), used for app IDs, notification IDs, etc. */
function generateId() {
  return uuidv4();
}

/**
 * Generates a secure API key in the format: pf_live_<48 hex chars>
 * Prefix makes keys recognizable and greppable (similar to Stripe's convention).
 */
function generateApiKey() {
  const random = crypto.randomBytes(24).toString('hex');
  return `pf_live_${random}`;
}

/** SHA-256 hash of a value — used to store API keys hashed, never in plaintext. */
function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Generates a random token for email verification / password reset links. */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { generateId, generateApiKey, hashValue, generateToken };
