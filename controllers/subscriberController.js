const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

const AppModel = require('../models/appModel');
const SubscriberModel = require('../models/subscriberModel');
const { AnalyticsModel, ActivityLogModel } = require('../models/logModel');

/**
 * PUBLIC endpoints (protected by X-API-Key, called from the customer's own website widget)
 */

/** POST /api/subscribers/register  (requires X-API-Key)  body: { fcmToken, browser, device, platform } */
const registerSubscriber = asyncHandler(async (req, res) => {
  const { fcmToken, browser, device, platform } = req.body;
  if (!fcmToken) throw ApiError.badRequest('fcmToken is required');

  const app = req.pushApp;
  const result = await SubscriberModel.upsert(app.id, { fcmToken, browser, device, platform });

  if (result.isNew) {
    await AppModel.incrementSubscriberCount(app.id, 1);
    await AnalyticsModel.increment(app.id, app.ownerUid, { newSubscribers: 1 });
    await ActivityLogModel.log(app.ownerUid, {
      type: 'sub',
      appId: app.id,
      text: `New subscriber on "${app.name}"`,
    });
  } else if (result.reactivated) {
    await AppModel.incrementSubscriberCount(app.id, 1);
  }

  sendSuccess(res, { statusCode: 201, message: 'Subscribed', data: { subscriberId: result.id } });
});

/** DELETE /api/subscribers/remove  (requires X-API-Key)  body: { fcmToken } */
const removeSubscriber = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) throw ApiError.badRequest('fcmToken is required');

  const app = req.pushApp;
  const removed = await SubscriberModel.removeByToken(app.id, fcmToken);
  if (removed) {
    await AppModel.incrementSubscriberCount(app.id, -1);
  }

  sendSuccess(res, { message: removed ? 'Unsubscribed' : 'Token was not subscribed' });
});

/**
 * DASHBOARD endpoints (protected by JWT + app ownership, called from PushFlow's own dashboard)
 */

/** GET /api/subscribers?appId=xxx&limit=50&cursor=xxx */
const listSubscribers = asyncHandler(async (req, res) => {
  const { appId, limit, status } = req.query;
  if (!appId) throw ApiError.badRequest('appId query param is required');

  const app = await AppModel.findById(appId);
  if (!app || app.ownerUid !== req.user.uid) {
    throw ApiError.forbidden('You do not have access to this app');
  }

  const subscribers = await SubscriberModel.listByApp(appId, {
    status: status || 'active',
    limit: limit ? parseInt(limit, 10) : 50,
  });

  sendSuccess(res, { data: { subscribers } });
});

/** GET /api/subscribers/count?appId=xxx */
const countSubscribers = asyncHandler(async (req, res) => {
  const { appId } = req.query;
  if (!appId) throw ApiError.badRequest('appId query param is required');

  const app = await AppModel.findById(appId);
  if (!app || app.ownerUid !== req.user.uid) {
    throw ApiError.forbidden('You do not have access to this app');
  }

  const count = await SubscriberModel.countActiveByApp(appId);
  sendSuccess(res, { data: { count } });
});

module.exports = { registerSubscriber, removeSubscriber, listSubscribers, countSubscribers };
