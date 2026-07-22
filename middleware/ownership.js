/**
 * Authorization helpers that enforce "users can only access their own data".
 * These run AFTER requireAuth, so req.user.uid is already available.
 */
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { db } = require('../firebase/admin');

/**
 * Loads the app identified by req.params.id (or :appId) and verifies
 * req.user owns it. Attaches req.pushApp on success.
 */
const requireAppOwnership = (paramName = 'id') =>
  asyncHandler(async (req, res, next) => {
    const appId = req.params[paramName];
    const appDoc = await db.collection('apps').doc(appId).get();

    if (!appDoc.exists) {
      throw ApiError.notFound('App not found');
    }

    const appData = appDoc.data();
    if (appData.ownerUid !== req.user.uid) {
      throw ApiError.forbidden('You do not have access to this app');
    }

    req.pushApp = { id: appDoc.id, ...appData };
    next();
  });

module.exports = { requireAppOwnership };
