const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { requireAppOwnership } = require('../middleware/ownership');
const upload = require('../middleware/upload');
const appController = require('../controllers/appController');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('App name is required')],
  validate,
  appController.createApp
);

router.get('/', appController.listApps);

router.get('/:id', requireAppOwnership(), appController.getApp);
router.put('/:id', requireAppOwnership(), appController.updateApp);
router.delete('/:id', requireAppOwnership(), appController.deleteApp);

router.post('/:id/icon', requireAppOwnership(), upload.single('icon'), appController.uploadIcon);

router.post('/:id/apikey/generate', requireAppOwnership(), appController.generateApiKey);
router.post('/:id/apikey/regenerate', requireAppOwnership(), appController.regenerateApiKey);
router.post('/:id/apikey/disable', requireAppOwnership(), appController.disableApiKey);
router.post('/:id/apikey/enable', requireAppOwnership(), appController.enableApiKey);

module.exports = router;
