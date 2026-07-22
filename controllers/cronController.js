const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const config = require('../config/env');
const schedulerService = require('../services/schedulerService');

/**
 * GET/POST /api/cron/trigger?secret=xxx
 * Backup trigger for the notification scheduler, meant to be hit by an
 * external uptime/cron service (UptimeRobot, cron-job.org) in case the
 * in-process node-cron misses a tick (e.g. brief cold start on Render free tier).
 */
const trigger = asyncHandler(async (req, res) => {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (!config.cron.secret || secret !== config.cron.secret) {
    throw ApiError.unauthorized('Invalid cron secret');
  }

  const result = await schedulerService.processDueNotifications();
  sendSuccess(res, { message: 'Cron trigger executed', data: result });
});

module.exports = { trigger };
