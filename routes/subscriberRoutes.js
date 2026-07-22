const express = require('express');
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const subscriberController = require('../controllers/subscriberController');

const router = express.Router();

// ---- Public, called by the customer's website widget using X-API-Key ----
router.post(
  '/register',
  requireApiKey,
  [body('fcmToken').notEmpty().withMessage('fcmToken is required')],
  validate,
  subscriberController.registerSubscriber
);

router.delete(
  '/remove',
  requireApiKey,
  [body('fcmToken').notEmpty().withMessage('fcmToken is required')],
  validate,
  subscriberController.removeSubscriber
);

// ---- Dashboard, called by the logged-in user via JWT ----
router.get(
  '/',
  requireAuth,
  [query('appId').notEmpty().withMessage('appId is required')],
  validate,
  subscriberController.listSubscribers
);

router.get(
  '/count',
  requireAuth,
  [query('appId').notEmpty().withMessage('appId is required')],
  validate,
  subscriberController.countSubscribers
);

module.exports = router;
