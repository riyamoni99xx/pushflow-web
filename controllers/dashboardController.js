const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const AppModel = require('../models/appModel');
const SubscriberModel = require('../models/subscriberModel');
const NotificationModel = require('../models/notificationModel');
const { ActivityLogModel, AnalyticsModel } = require('../models/logModel');

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** GET /api/dashboard  (also served at /api/dashboard-overview for frontend compatibility) */
const getDashboard = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const apps = await AppModel.findByOwner(uid);
  const appIds = apps.map((a) => a.id);

  const totalSubscribers = apps.reduce((sum, a) => sum + (a.subscriberCount || 0), 0);

  const recentNotifications = await NotificationModel.listByOwner(uid, { limit: 5 });
  const recentActivity = await ActivityLogModel.listByOwner(uid, 10);

  const startDate = dateNDaysAgo(7);
  const endDate = dateNDaysAgo(0);
  const analyticsRows = await AnalyticsModel.listByOwnerInRange(uid, startDate, endDate);

  const totals = analyticsRows.reduce(
    (acc, row) => {
      acc.sent += row.notificationsSent || 0;
      acc.delivered += row.notificationsDelivered || 0;
      acc.failed += row.notificationsFailed || 0;
      acc.newSubscribers += row.newSubscribers || 0;
      return acc;
    },
    { sent: 0, delivered: 0, failed: 0, newSubscribers: 0 }
  );

  // Build a 7-day subscriber-growth series for the dashboard chart.
  const weeklySubscribers = [];
  for (let i = 6; i >= 0; i--) {
    const date = dateNDaysAgo(i);
    const row = analyticsRows.find((r) => r.date === date);
    weeklySubscribers.push({
      label: date,
      value: row ? row.newSubscribers || 0 : 0,
    });
  }

  const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 1000) / 10 : 0;

  sendSuccess(res, {
    data: {
      stats: {
        apps: { value: apps.length },
        subs: { value: totalSubscribers },
        sent: { value: totals.sent },
        rate: { value: deliveryRate },
      },
      weeklySubscribers,
      recentNotifications,
      recentActivity,
    },
  });
});

module.exports = { getDashboard };
