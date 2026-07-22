const express = require('express');
const { requireAuth } = require('../middleware/auth');
const apiKeyController = require('../controllers/apiKeyController');

const router = express.Router();

router.use(requireAuth);
router.get('/', apiKeyController.listKeys);
router.post('/', apiKeyController.createKey);
router.post('/primary/regenerate', apiKeyController.regeneratePrimaryKey);
router.delete('/:id', apiKeyController.revokeKey);

module.exports = router;
