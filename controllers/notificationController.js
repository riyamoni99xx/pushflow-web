const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

const AppModel = require('../models/appModel');
const NotificationModel = require('../models/notificationModel');
const { NotificationLogModel } = require('../models/logModel');
const schedulerService = require('../services/schedulerService');

async function assertAppOwnership(appId, uid) {
  const app = await AppModel.findById(appId);
  if (!app || app.ownerUid !== uid) {
    throw ApiError.forbidden('You do not have access to this app');
  }
  if (app.status === 'suspended') {
    throw ApiError.forbidden('This app is suspended and cannot send notifications');
  }
  return app;
}

/** POST /api/notifications/send  body: { appId, title, body, icon, image, clickUrl } */
const sendNotification = asyncHandler(async (req, res) => {
  const { appId, title, body, icon, image, clickUrl } = req.body;
  if (!appId || !title || !body) {
    throw ApiError.badRequest('appId, title, and body are required');
  }

  await assertAppOwnership(appId, req.user.uid);

  const notification = await NotificationModel.create(appId, req.user.uid, {
    title,
    body,
    icon,
    image,
    clickUrl,
  });

  const result = await schedulerService.sendNotificationNow(notification);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Notification sent',
    data: { notificationId: notification.id, ...result },
  });
});

/** POST /api/notifications/schedule  body: { appId, title, body, icon, image, clickUrl, scheduledAt } */
const scheduleNotification = asyncHandler(async (req, res) => {
  const { appId, title, body, icon, image, clickUrl, scheduledAt } = req.body;
  if (!appId || !title || !body || !scheduledAt) {
    throw ApiError.badRequest('appId, title, body, and scheduledAt are required');
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    throw ApiError.badRequest('scheduledAt must be a valid future date/time');
  }

  await assertAppOwnership(appId, req.user.uid);

  const notification = await NotificationModel.create(appId, req.user.uid, {
    title,
    body,
    icon,
    image,
    clickUrl,
    scheduledAt: scheduledDate,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Notification scheduled',
    data: { notification },
  });
});

/** GET /api/notifications/history?appId=xxx&limit=20 */
const getHistory = asyncHandler(async (req, res) => {
  const { appId, limit } = req.query;

  if (appId) {
    await assertAppOwnership(appId, req.user.uid);
  }

  const notifications = await NotificationModel.listByOwner(req.user.uid, {
    appId: appId || null,
    limit: limit ? parseInt(limit, 10) : 20,
  });

  sendSuccess(res, { data: { notifications } });
});

/** GET /api/notifications/:id */
const getNotification = asyncHandler(async (req, res) => {
  const notification = await NotificationModel.findById(req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found');
  if (notification.ownerUid !== req.user.uid) {
    throw ApiError.forbidden('You do not have access to this notification');
  }

  const logs = await NotificationLogModel.listByNotification(notification.id);
  sendSuccess(res, { data: { notification, logs } });
});

/**
 * GET /api/notifications/track/click/:id — public, no auth (opened from the push notification itself)
 * Increments click count and redirects to the notification's target URL.
 */
const trackClick = asyncHandler(async (req, res) => {
  const notification = await NotificationModel.findById(req.params.id);
  if (!notification) {
    return res.redirect(302, '/');
  }

  await NotificationModel.incrementClick(notification.id);
  res.redirect(302, notification.clickUrl || '/');
});

module.exports = {
  sendNotification,
  scheduleNotification,
  getHistory,
  getNotification,
  trackClick,
};
