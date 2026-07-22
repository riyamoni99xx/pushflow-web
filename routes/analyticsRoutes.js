const express = require('express');
const { requireAuth } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.use(requireAuth);
router.get('/', analyticsController.getAnalytics);

module.exports = router;
