const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { generateToken } = require('../utils/generateId');
const config = require('../config/env');

const { auth: firebaseAuth } = require('../firebase/admin');
const UserModel = require('../models/userModel');
const { ActivityLogModel } = require('../models/logModel');
const tokenService = require('../services/tokenService');
const oauthService = require('../services/oauthService');
const emailService = require('../services/emailService');

const REFRESH_COOKIE_NAME = 'pf_refresh';

function refreshCookieOptions(remember) {
  const maxAge = remember ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.secure ? 'none' : 'lax',
    domain: config.cookie.domain,
    path: '/api/auth',
    maxAge,
  };
}

async function issueTokens(res, user, remember = false) {
  const accessToken = tokenService.signAccessToken({ uid: user.uid, email: user.email });
  const refreshToken = tokenService.signRefreshToken({ uid: user.uid }, remember);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(remember));
  return accessToken;
}

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { fname, lname, email, phone, password } = req.body;

  const existing = await UserModel.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // Create the identity in Firebase Auth (handles password hashing/storage securely).
  const firebaseUser = await firebaseAuth.createUser({
    email,
    password,
    displayName: `${fname} ${lname}`.trim(),
    emailVerified: false,
  });

  const user = await UserModel.create(firebaseUser.uid, {
    email: email.toLowerCase(),
    firstName: fname,
    lastName: lname,
    name: `${fname} ${lname}`.trim(),
    phone: phone || '',
    provider: 'password',
    emailVerified: false,
  });

  await ActivityLogModel.log(firebaseUser.uid, { type: 'account', text: 'Account created' });

  // Fire off a verification email (best-effort, does not block registration).
  try {
    const verifyLink = await firebaseAuth.generateEmailVerificationLink(email, {
      url: `${config.frontendUrl}/login.html?verified=1`,
    });
    await emailService.sendVerificationEmail(email, verifyLink);
  } catch (err) {
    // Non-fatal — user can request re-verification later.
  }

  const accessToken = await issueTokens(res, user, false);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully',
    data: { user: UserModel.toPublic(user), accessToken },
  });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body;

  // Firebase Admin SDK cannot verify passwords directly (by design). We verify
  // via Firebase Auth's REST API (signInWithPassword) using the Web API key.
  if (!config.firebase.webApiKey && !process.env.FIREBASE_WEB_API_KEY) {
    // fall through — handled below with fetch regardless
  }

  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const verifyData = await verifyRes.json();

  if (!verifyRes.ok) {
    throw ApiError.unauthorized('Incorrect email or password');
  }

  const user = await UserModel.findById(verifyData.localId);
  if (!user) {
    throw ApiError.unauthorized('Account not found');
  }
  if (user.disabled) {
    throw ApiError.forbidden('This account has been disabled');
  }

  await UserModel.updateLastLogin(user.uid);
  const accessToken = await issueTokens(res, user, !!remember);

  sendSuccess(res, {
    message: 'Logged in successfully',
    data: { user: UserModel.toPublic(user), accessToken },
  });
});

/** POST /api/auth/google  body: { idToken } */
const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw ApiError.badRequest('idToken is required');

  const profile = await oauthService.verifyProviderToken(idToken, 'google');
  const user = await findOrCreateOAuthUser(profile);

  await UserModel.updateLastLogin(user.uid);
  const accessToken = await issueTokens(res, user, true);

  sendSuccess(res, {
    message: 'Signed in with Google',
    data: { user: UserModel.toPublic(user), accessToken },
  });
});

/** POST /api/auth/github  body: { idToken } */
const githubAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw ApiError.badRequest('idToken is required');

  const profile = await oauthService.verifyProviderToken(idToken, 'github');
  const user = await findOrCreateOAuthUser(profile);

  await UserModel.updateLastLogin(user.uid);
  const accessToken = await issueTokens(res, user, true);

  sendSuccess(res, {
    message: 'Signed in with GitHub',
    data: { user: UserModel.toPublic(user), accessToken },
  });
});

async function findOrCreateOAuthUser(profile) {
  let user = await UserModel.findById(profile.uid);
  if (user) return user;

  // Might exist under a different provider with the same email — link is out of
  // scope here; we simply create/attach a users doc keyed by the Firebase uid.
  user = await UserModel.create(profile.uid, {
    email: (profile.email || '').toLowerCase(),
    name: profile.name,
    photoURL: profile.photoURL,
    provider: profile.provider,
    emailVerified: profile.emailVerified,
  });

  await ActivityLogModel.log(profile.uid, {
    type: 'account',
    text: `Account created via ${profile.provider}`,
  });

  return user;
}

/** POST /api/auth/refresh — reads refresh cookie, issues new access token */
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  let payload;
  try {
    payload = tokenService.verifyRefreshToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.uid);
  if (!user || user.disabled) {
    throw ApiError.unauthorized('User no longer exists');
  }

  const accessToken = tokenService.signAccessToken({ uid: user.uid, email: user.email });
  sendSuccess(res, { message: 'Token refreshed', data: { accessToken } });
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  sendSuccess(res, { message: 'Logged out successfully' });
});

/** POST /api/auth/forgot-password */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.findByEmail(email);
  // Always respond success even if user doesn't exist — avoids account enumeration.
  if (user) {
    try {
      const resetLink = await firebaseAuth.generatePasswordResetLink(email, {
        url: `${config.frontendUrl}/login.html`,
      });
      await emailService.sendPasswordResetEmail(email, resetLink);
    } catch (err) {
      // swallow — still return generic success below
    }
  }

  sendSuccess(res, { message: 'If an account exists for this email, a reset link has been sent.' });
});

/** POST /api/auth/reset-password  body: { oobCode, newPassword } */
const resetPassword = asyncHandler(async (req, res) => {
  const { oobCode, newPassword } = req.body;
  if (!oobCode || !newPassword) {
    throw ApiError.badRequest('oobCode and newPassword are required');
  }

  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oobCode, newPassword }),
    }
  );
  if (!verifyRes.ok) {
    throw ApiError.badRequest('This reset link is invalid or has expired');
  }

  sendSuccess(res, { message: 'Password reset successfully. You can now log in.' });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(200).json({ authenticated: false });
  }
  res.status(200).json({ authenticated: true, user: UserModel.toPublic(req.user) });
});

module.exports = {
  register,
  login,
  googleAuth,
  githubAuth,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  me,
  REFRESH_COOKIE_NAME,
};
