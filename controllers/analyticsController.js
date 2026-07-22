const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');

const AppModel = require('../models/appModel');
const { AnalyticsModel } = require('../models/logModel');

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/analytics?appId=xxx&period=daily|weekly|monthly
 * If appId is omitted, aggregates across all of the user's apps.
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const { appId, period = 'weekly' } = req.query;
  const uid = req.user.uid;

  if (appId) {
    const app = await AppModel.findById(appId);
    if (!app || app.ownerUid !== uid) {
      throw ApiError.forbidden('You do not have access to this app');
    }
  }

  const daysBack = period === 'monthly' ? 30 : period === 'daily' ? 1 : 7;
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  const rows = appId
    ? await AnalyticsModel.listByAppInRange(appId, formatDate(start), formatDate(new Date()))
    : await AnalyticsModel.listByOwnerInRange(uid, formatDate(start), formatDate(new Date()));

  const totals = rows.reduce(
    (acc, row) => {
      acc.notificationsSent += row.notificationsSent || 0;
      acc.notificationsDelivered += row.notificationsDelivered || 0;
      acc.notificationsFailed += row.notificationsFailed || 0;
      acc.newSubscribers += row.newSubscribers || 0;
      return acc;
    },
    { notificationsSent: 0, notificationsDelivered: 0, notificationsFailed: 0, newSubscribers: 0 }
  );

  const deliveryRate =
    totals.notificationsSent > 0
      ? Math.round((totals.notificationsDelivered / totals.notificationsSent) * 1000) / 10
      : 0;

  let apps = [];
  let totalSubscribers = 0;
  if (!appId) {
    apps = await AppModel.findByOwner(uid);
    totalSubscribers = apps.reduce((sum, a) => sum + (a.subscriberCount || 0), 0);
  }

  sendSuccess(res, {
    data: {
      period,
      totals: {
        ...totals,
        deliveryRate,
        totalApps: appId ? undefined : apps.length,
        totalSubscribers: appId ? undefined : totalSubscribers,
      },
      series: rows
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .map((r) => ({
          date: r.date,
          sent: r.notificationsSent || 0,
          delivered: r.notificationsDelivered || 0,
          failed: r.notificationsFailed || 0,
          newSubscribers: r.newSubscribers || 0,
        })),
    },
  });
});

module.exports = { getAnalytics };
