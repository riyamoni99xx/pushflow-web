const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const SettingsModel = require('../models/settingsModel');
const { ActivityLogModel } = require('../models/logModel');

/** GET /api/settings */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await SettingsModel.getOrCreate(req.user.uid);
  sendSuccess(res, { data: { settings } });
});

/** PUT /api/settings  body: { website: {...}, notifications: {...} } */
const updateSettings = asyncHandler(async (req, res) => {
  const { website, notifications } = req.body;
  const updates = {};
  if (website !== undefined) updates.website = website;
  if (notifications !== undefined) updates.notifications = notifications;

  const settings = await SettingsModel.update(req.user.uid, updates);
  await ActivityLogModel.log(req.user.uid, { type: 'settings', text: 'Settings updated' });

  sendSuccess(res, { message: 'Settings updated', data: { settings } });
});

module.exports = { getSettings, updateSettings };
