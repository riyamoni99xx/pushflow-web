/**
 * The uploaded api-keys.html dashboard page treats "API keys" as a flat list
 * (one key per app, since each app has exactly one active API key). This
 * controller exposes that flattened view on top of the apps collection,
 * without duplicating storage — the apps collection remains the source of truth.
 */
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

const AppModel = require('../models/appModel');
const { ActivityLogModel } = require('../models/logModel');

function toKeyView(app) {
  return {
    id: app.id, // the "key id" is the app id, since it's a 1:1 relationship
    appId: app.id,
    appName: app.name,
    keyPreview: app.apiKeyPreview,
    enabled: app.apiKeyEnabled,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

/** GET /api/keys */
const listKeys = asyncHandler(async (req, res) => {
  const apps = await AppModel.findByOwner(req.user.uid);
  sendSuccess(res, { data: { keys: apps.map(toKeyView) } });
});

/** POST /api/keys  body: { appId } — regenerates the key for an existing app (there is no separate key creation without an app) */
const createKey = asyncHandler(async (req, res) => {
  const { appId } = req.body;
  if (!appId) throw ApiError.badRequest('appId is required');

  const app = await AppModel.findById(appId);
  if (!app || app.ownerUid !== req.user.uid) {
    throw ApiError.forbidden('You do not have access to this app');
  }

  const apiKey = await AppModel.regenerateApiKey(appId);
  await ActivityLogModel.log(req.user.uid, { type: 'app', appId, text: `API key issued for "${app.name}"` });

  sendSuccess(res, {
    statusCode: 201,
    message: 'API key generated. Store it now — it will not be shown again.',
    data: { apiKey, appId },
  });
});

/** POST /api/keys/primary/regenerate  body: { appId } — regenerate a specific app's key */
const regeneratePrimaryKey = asyncHandler(async (req, res) => {
  const { appId } = req.body;
  if (!appId) throw ApiError.badRequest('appId is required');

  const app = await AppModel.findById(appId);
  if (!app || app.ownerUid !== req.user.uid) {
    throw ApiError.forbidden('You do not have access to this app');
  }

  const apiKey = await AppModel.regenerateApiKey(appId);
  await ActivityLogModel.log(req.user.uid, { type: 'app', appId, text: `API key regenerated for "${app.name}"` });

  sendSuccess(res, {
    message: 'API key regenerated. The old key is now invalid.',
    data: { apiKey, appId },
  });
});

/** DELETE /api/keys/:id — :id is the appId; disables that app's key */
const revokeKey = asyncHandler(async (req, res) => {
  const app = await AppModel.findById(req.params.id);
  if (!app || app.ownerUid !== req.user.uid) {
    throw ApiError.forbidden('You do not have access to this app');
  }

  await AppModel.setApiKeyEnabled(app.id, false);
  await ActivityLogModel.log(req.user.uid, { type: 'app', appId: app.id, text: `API key revoked for "${app.name}"` });

  sendSuccess(res, { message: 'API key revoked' });
});

module.exports = { listKeys, createKey, regeneratePrimaryKey, revokeKey };
