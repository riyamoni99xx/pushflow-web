const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { sendNotificationLimiter } = require('../middleware/rateLimiter');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// Public click-tracking redirect — must stay unauthenticated (opened from a push click).
router.get('/track/click/:id', notificationController.trackClick);

router.use(requireAuth);

router.post(
  '/send',
  sendNotificationLimiter,
  [
    body('appId').notEmpty().withMessage('appId is required'),
    body('title').trim().notEmpty().withMessage('title is required'),
    body('body').trim().notEmpty().withMessage('body is required'),
  ],
  validate,
  notificationController.sendNotification
);

router.post(
  '/schedule',
  [
    body('appId').notEmpty().withMessage('appId is required'),
    body('title').trim().notEmpty().withMessage('title is required'),
    body('body').trim().notEmpty().withMessage('body is required'),
    body('scheduledAt').isISO8601().withMessage('scheduledAt must be a valid ISO date'),
  ],
  validate,
  notificationController.scheduleNotification
);

router.get('/history', notificationController.getHistory);
router.get('/:id', notificationController.getNotification);

module.exports = router;
