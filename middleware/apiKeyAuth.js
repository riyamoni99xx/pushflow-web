/**
 * API key authentication — used by PUBLIC endpoints that the customer's
 * own website / widget calls directly (e.g. subscriber registration),
 * as opposed to the dashboard endpoints which use requireAuth (JWT).
 *
 * Expects header: X-API-Key: pf_live_xxxxx
 * On success attaches: req.app = { id, ownerUid, ...app fields }
 */
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { db } = require('../firebase/admin');
const { hashValue } = require('../utils/generateId');

const requireApiKey = asyncHandler(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    throw ApiError.unauthorized('Missing X-API-Key header');
  }

  const hashedKey = hashValue(apiKey);
  const snapshot = await db
    .collection('apps')
    .where('apiKeyHash', '==', hashedKey)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw ApiError.unauthorized('Invalid API key');
  }

  const appDoc = snapshot.docs[0];
  const appData = appDoc.data();

  if (appData.apiKeyEnabled === false) {
    throw ApiError.forbidden('This API key has been disabled');
  }
  if (appData.status === 'suspended') {
    throw ApiError.forbidden('This app has been suspended');
  }

  req.pushApp = { id: appDoc.id, ...appData };
  next();
});

module.exports = { requireApiKey };
