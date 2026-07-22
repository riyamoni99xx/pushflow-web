const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const tokenService = require('../services/tokenService');
const { db } = require('../firebase/admin');

/**
 * Requires a valid JWT access token in the Authorization header:
 *   Authorization: Bearer <accessToken>
 * On success attaches req.user = { uid, email, ...firestore profile fields }
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token'
    );
  }

  const userDoc = await db.collection('users').doc(payload.uid).get();
  if (!userDoc.exists) {
    throw ApiError.unauthorized('User no longer exists');
  }

  const userData = userDoc.data();
  if (userData.disabled) {
    throw ApiError.forbidden('This account has been disabled');
  }

  req.user = { uid: payload.uid, ...userData };
  next();
});

/**
 * Optional auth — attaches req.user if a valid token is present,
 * but does not reject the request if it's missing/invalid.
 * Useful for endpoints that behave differently for logged-in users.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next();
  }

  try {
    const payload = tokenService.verifyAccessToken(token);
    const userDoc = await db.collection('users').doc(payload.uid).get();
    if (userDoc.exists && !userDoc.data().disabled) {
      req.user = { uid: payload.uid, ...userDoc.data() };
    }
  } catch (err) {
    // Silently ignore — this middleware never blocks the request.
  }

  next();
});

module.exports = { requireAuth, optionalAuth };
