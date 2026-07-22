const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

const AppModel = require('../models/appModel');
const SubscriberModel = require('../models/subscriberModel');
const { ActivityLogModel } = require('../models/logModel');
const storageService = require('../services/storageService');

/** POST /api/apps */
const createApp = asyncHandler(async (req, res) => {
  const { name, website, domain } = req.body;
  if (!name) throw ApiError.badRequest('App name is required');

  const app = await AppModel.create(req.user.uid, { name, website, domain });
  await ActivityLogModel.log(req.user.uid, { type: 'app', appId: app.id, text: `App "${name}" created` });

  // apiKey is returned ONLY on creation — the client must store it now.
  sendSuccess(res, { statusCode: 201, message: 'App created', data: { app } });
});

/** GET /api/apps */
const listApps = asyncHandler(async (req, res) => {
  const apps = await AppModel.findByOwner(req.user.uid);
  sendSuccess(res, { data: { apps: apps.map(AppModel.toPublic) } });
});

/** GET /api/apps/:id */
const getApp = asyncHandler(async (req, res) => {
  const subscriberCount = await SubscriberModel.countActiveByApp(req.pushApp.id);
  sendSuccess(res, { data: { app: { ...AppModel.toPublic(req.pushApp), subscriberCount } } });
});

/** PUT /api/apps/:id */
const updateApp = asyncHandler(async (req, res) => {
  const { name, website, domain, status } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (website !== undefined) updates.website = website;
  if (domain !== undefined) {
    updates.domain = domain;
    updates.domainVerified = false; // domain changed -> needs re-verification
  }
  if (status !== undefined) {
    if (!['active', 'suspended'].includes(status)) {
      throw ApiError.badRequest('status must be "active" or "suspended"');
    }
    updates.status = status;
  }

  const updated = await AppModel.update(req.pushApp.id, updates);
  sendSuccess(res, { message: 'App updated', data: { app: AppModel.toPublic(updated) } });
});

/** DELETE /api/apps/:id */
const deleteApp = asyncHandler(async (req, res) => {
  if (req.pushApp.icon) {
    await storageService.deleteByUrl(req.pushApp.icon);
  }
  await AppModel.delete(req.pushApp.id);
  await ActivityLogModel.log(req.user.uid, {
    type: 'app',
    text: `App "${req.pushApp.name}" deleted`,
  });
  sendSuccess(res, { message: 'App deleted' });
});

/** POST /api/apps/:id/icon (multipart) */
const uploadIcon = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const url = await storageService.uploadBuffer(req.file, `app-icons/${req.pushApp.id}`);
  if (req.pushApp.icon) {
    await storageService.deleteByUrl(req.pushApp.icon);
  }

  const updated = await AppModel.update(req.pushApp.id, {
    icon: url,
    'settings.defaultIcon': url,
  });
  sendSuccess(res, { message: 'Icon updated', data: { app: AppModel.toPublic(updated) } });
});

/** POST /api/apps/:id/apikey/generate — only used if a key was previously disabled/never issued */
const generateApiKey = asyncHandler(async (req, res) => {
  const apiKey = await AppModel.regenerateApiKey(req.pushApp.id);
  await ActivityLogModel.log(req.user.uid, {
    type: 'app',
    appId: req.pushApp.id,
    text: `API key generated for "${req.pushApp.name}"`,
  });
  sendSuccess(res, { message: 'API key generated. Store it now — it will not be shown again.', data: { apiKey } });
});

/** POST /api/apps/:id/apikey/regenerate */
const regenerateApiKey = asyncHandler(async (req, res) => {
  const apiKey = await AppModel.regenerateApiKey(req.pushApp.id);
  await ActivityLogModel.log(req.user.uid, {
    type: 'app',
    appId: req.pushApp.id,
    text: `API key regenerated for "${req.pushApp.name}"`,
  });
  sendSuccess(res, {
    message: 'API key regenerated. The old key is now invalid. Store the new key now — it will not be shown again.',
    data: { apiKey },
  });
});

/** POST /api/apps/:id/apikey/disable */
const disableApiKey = asyncHandler(async (req, res) => {
  await AppModel.setApiKeyEnabled(req.pushApp.id, false);
  sendSuccess(res, { message: 'API key disabled' });
});

/** POST /api/apps/:id/apikey/enable */
const enableApiKey = asyncHandler(async (req, res) => {
  await AppModel.setApiKeyEnabled(req.pushApp.id, true);
  sendSuccess(res, { message: 'API key enabled' });
});

module.exports = {
  createApp,
  listApps,
  getApp,
  updateApp,
  deleteApp,
  uploadIcon,
  generateApiKey,
  regenerateApiKey,
  disableApiKey,
  enableApiKey,
};
