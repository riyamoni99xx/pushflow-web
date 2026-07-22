/**
 * Multer config for handling multipart/form-data image uploads
 * (profile photos, app icons). Files are kept in memory and streamed
 * straight to Firebase Storage — nothing is written to local disk,
 * since Render's filesystem is ephemeral.
 */
const multer = require('multer');
const ApiError = require('../utils/apiError');

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(ApiError.badRequest('Only PNG, JPG, WEBP, or GIF images are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = upload;
