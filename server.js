const config = require('./config/env');
const logger = require('./utils/logger');

// Fail fast if critical secrets are missing — better to crash at boot on Render
// than to silently run with broken auth.
function validateCriticalEnv() {
  const missing = [];
  if (!config.jwt.accessSecret) missing.push('JWT_ACCESS_SECRET');
  if (!config.jwt.refreshSecret) missing.push('JWT_REFRESH_SECRET');
  if (!config.firebase.serviceAccountJson && !(config.firebase.projectId && config.firebase.privateKey)) {
    missing.push('FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)');
  }
  if (!process.env.FIREBASE_WEB_API_KEY) missing.push('FIREBASE_WEB_API_KEY');

  if (missing.length) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

validateCriticalEnv();

// firebase/admin.js initializes on require — load it after env validation.
require('./firebase/admin');

const app = require('./app');
const schedulerService = require('./services/schedulerService');

const server = app.listen(config.port, () => {
  logger.info(`PushFlow API listening on port ${config.port} [${config.env}]`);
  schedulerService.startScheduler();
});

// ---- Graceful shutdown ----
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force-exit if shutdown hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.stack || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.stack });
  process.exit(1);
});
