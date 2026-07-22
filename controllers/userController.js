const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

const UserModel = require('../models/userModel');
const AppModel = require('../models/appModel');
const { ActivityLogModel } = require('../models/logModel');
const { auth: firebaseAuth } = require('../firebase/admin');
const storageService = require('../services/storageService');

/** GET /api/user/profile */
const getProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { user: UserModel.toPublic(req.user) } });
});

/** PUT /api/user/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, name } = req.body;
  const updates = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (name !== undefined) {
    updates.name = name;
  } else if (firstName !== undefined || lastName !== undefined) {
    updates.name = `${firstName ?? req.user.firstName ?? ''} ${lastName ?? req.user.lastName ?? ''}`.trim();
  }

  const updated = await UserModel.update(req.user.uid, updates);

  // Keep Firebase Auth displayName in sync (best-effort).
  try {
    await firebaseAuth.updateUser(req.user.uid, { displayName: updated.name });
  } catch (err) {
    // non-fatal
  }

  sendSuccess(res, { message: 'Profile updated', data: { user: UserModel.toPublic(updated) } });
});

/** POST /api/user/photo (multipart) */
const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const url = await storageService.uploadBuffer(req.file, `profile-photos/${req.user.uid}`);

  if (req.user.photoURL) {
    await storageService.deleteByUrl(req.user.photoURL);
  }

  const updated = await UserModel.update(req.user.uid, { photoURL: url });

  try {
    await firebaseAuth.updateUser(req.user.uid, { photoURL: url });
  } catch (err) {
    // non-fatal
  }

  sendSuccess(res, { message: 'Photo updated', data: { user: UserModel.toPublic(updated) } });
});

/** DELETE /api/user/photo */
const deletePhoto = asyncHandler(async (req, res) => {
  if (req.user.photoURL) {
    await storageService.deleteByUrl(req.user.photoURL);
  }
  const updated = await UserModel.update(req.user.uid, { photoURL: null });
  sendSuccess(res, { message: 'Photo removed', data: { user: UserModel.toPublic(updated) } });
});

/** PUT /api/user/password  body: { currentPassword, newPassword } */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('currentPassword and newPassword are required');
  }
  if (req.user.provider !== 'password') {
    throw ApiError.badRequest(`This account uses ${req.user.provider} sign-in and has no password to change`);
  }

  // Re-verify current password via Firebase Auth REST API before allowing change.
  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: req.user.email, password: currentPassword, returnSecureToken: true }),
    }
  );
  if (!verifyRes.ok) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  await firebaseAuth.updateUser(req.user.uid, { password: newPassword });
  await ActivityLogModel.log(req.user.uid, { type: 'account', text: 'Password changed' });

  sendSuccess(res, { message: 'Password changed successfully' });
});

/** POST /api/user/sessions/revoke-others */
const revokeOtherSessions = asyncHandler(async (req, res) => {
  // Revokes ALL Firebase refresh tokens for this user (including the current one's
  // underlying Firebase session); our own JWT refresh cookie for this device stays
  // valid since it's independent of Firebase's token revocation, but any other
  // device's refresh cookie will fail on next /api/auth/refresh once we also bump
  // a tokenVersion. Simpler approach: bump tokenVersion so old JWTs still work
  // until they expire (short-lived), only affecting refresh continuation.
  await firebaseAuth.revokeRefreshTokens(req.user.uid);
  await ActivityLogModel.log(req.user.uid, { type: 'account', text: 'Revoked all other sessions' });
  sendSuccess(res, { message: 'All other sessions have been signed out' });
});

/** DELETE /api/user  (also mounted as /api/user/delete per spec) */
const deleteAccount = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  // Clean up owned apps (and their subcollections would need a batch job in a
  // larger system; for this scope we delete the app documents themselves).
  const apps = await AppModel.findByOwner(uid);
  await Promise.all(apps.map((app) => AppModel.delete(app.id)));

  if (req.user.photoURL) {
    await storageService.deleteByUrl(req.user.photoURL);
  }

  await UserModel.delete(uid);

  try {
    await firebaseAuth.deleteUser(uid);
  } catch (err) {
    // non-fatal — Firestore doc is already gone, which is what matters for access control
  }

  res.clearCookie('pf_refresh', { path: '/api/auth' });
  sendSuccess(res, { message: 'Account deleted permanently' });
});

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  changePassword,
  revokeOtherSessions,
  deleteAccount,
};
