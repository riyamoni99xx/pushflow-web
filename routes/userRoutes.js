const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const userController = require('../controllers/userController');

const router = express.Router();

router.use(requireAuth);

router.get('/profile', userController.getProfile);

router.put(
  '/profile',
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
  ],
  validate,
  userController.updateProfile
);

router.post('/photo', upload.single('photo'), userController.uploadPhoto);
router.delete('/photo', userController.deletePhoto);

router.put(
  '/password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  userController.changePassword
);
// Alias to match the frontend stub that POSTs to /api/user/password
router.post(
  '/password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  userController.changePassword
);

router.post('/sessions/revoke-others', userController.revokeOtherSessions);

router.delete('/delete', userController.deleteAccount);
router.delete('/', userController.deleteAccount); // matches settings.html: DELETE /api/user

module.exports = router;
