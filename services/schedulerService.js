/**
 * Handles firing notifications whose scheduledAt time has arrived.
 * Runs in-process via node-cron (every minute) AND is exposed via
 * /api/cron/trigger as a backup for when Render's free instance sleeps
 * despite UptimeRobot pinging it.
 */
const cron = require('node-cron');
const logger = require('../utils/logger');
const NotificationModel = require('../models/notificationModel');
const SubscriberModel = require('../models/subscriberModel');
const AppModel = require('../models/appModel');
const { NotificationLogModel, ActivityLogModel, AnalyticsModel } = require('../models/logModel');
const pushService = require('./pushService');

async function processDueNotifications() {
  const due = await NotificationModel.listDuePending();
  if (!due.length) return { processed: 0 };

  logger.info(`Scheduler: found ${due.length} due notification(s) to send`);

  for (const notification of due) {
    try {
      await sendNotificationNow(notification);
    } catch (err) {
      logger.error(`Scheduler: failed to send notification ${notification.id}`, { error: err.message });
    }
  }

  return { processed: due.length };
}

/**
 * Sends a notification immediately (used both by the manual "send now" endpoint
 * and by the scheduler for due scheduled notifications).
 */
async function sendNotificationNow(notification) {
  await NotificationModel.markSending(notification.id);

  const tokens = await SubscriberModel.getActiveTokensByApp(notification.appId);
  const { delivered, failed, invalidTokens, perTokenResults } = await pushService.sendToTokens(tokens, {
    title: notification.title,
    body: notification.body,
    icon: notification.icon,
    image: notification.image,
    clickUrl: notification.clickUrl,
    notificationId: notification.id,
  });

  await NotificationModel.markResult(notification.id, {
    targeted: tokens.length,
    delivered,
    failed,
  });

  await NotificationLogModel.createBatch(
    notification.id,
    notification.appId,
    perTokenResults.map((r) => ({ fcmToken: r.token, status: r.status, error: r.error }))
  );

  if (invalidTokens.length) {
    await SubscriberModel.markTokensInvalid(notification.appId, invalidTokens);
  }

  await AnalyticsModel.increment(notification.appId, notification.ownerUid, {
    notificationsSent: 1,
    notificationsDelivered: delivered,
    notificationsFailed: failed,
  });

  await ActivityLogModel.log(notification.ownerUid, {
    type: 'sent',
    appId: notification.appId,
    text: `Notification "${notification.title}" sent to ${delivered} subscriber(s)`,
  });

  return { delivered, failed, targeted: tokens.length };
}

function startScheduler() {
  // Runs every minute — checks Firestore for scheduled notifications that are due.
  cron.schedule('* * * * *', async () => {
    try {
      await processDueNotifications();
    } catch (err) {
      logger.error('Scheduler tick failed', { error: err.message });
    }
  });
  logger.info('Notification scheduler started (runs every minute)');
}

module.exports = { startScheduler, processDueNotifications, sendNotificationNow };
