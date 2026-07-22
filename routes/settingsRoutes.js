const express = require('express');
const { requireAuth } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

router.use(requireAuth);
router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

module.exports = router;
