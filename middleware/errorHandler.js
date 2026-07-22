const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');

/** 404 handler — must be mounted after all routes. */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Central error handler — must be the LAST middleware mounted in app.js. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { statusCode, message, details, isOperational } = err;

  // Known third-party error shapes we want to normalize
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File is too large';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  if (!statusCode) statusCode = 500;
  if (!message) message = 'Internal server error';

  if (!isOperational || statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
  } else {
    logger.warn(err.message, { path: req.originalUrl, method: req.method, statusCode });
  }

  const body = { success: false, message };
  if (details) body.details = details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
