const express = require('express');
const { requireAuth } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.use(requireAuth);
router.get('/', dashboardController.getDashboard);

module.exports = router;
