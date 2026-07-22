const express = require('express');
const cronController = require('../controllers/cronController');

const router = express.Router();

router.get('/trigger', cronController.trigger);
router.post('/trigger', cronController.trigger);

module.exports = router;
