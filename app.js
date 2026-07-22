const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const appRoutes = require('./routes/appRoutes');
const subscriberRoutes = require('./routes/subscriberRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const cronRoutes = require('./routes/cronRoutes');
const docsRoutes = require('./routes/docsRoutes');

const app = express();

// ---- Security & core middleware ----
app.set('trust proxy', 1); // needed on Render for correct secure-cookie / rate-limit behavior behind their proxy

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // frontend HTML pages set their own inline styles/scripts; avoid CSP conflicts
  })
);
app.use(compression());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(requestLogger);
app.use('/api', generalLimiter);

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard-overview', dashboardRoutes); // alias to match frontend stub naming
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/docs', docsRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'PushFlow API is running', time: new Date().toISOString() });
});

// ---- Frontend static hosting (backend + frontend served from the same app) ----
const FRONTEND_DIR = path.join(__dirname, 'public');
app.use(express.static(FRONTEND_DIR));

// SPA-style fallback for the HTML pages: if a non-API GET request doesn't match
// a static file, try serving <path>.html, then fall back to index.html.
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  const candidate = path.join(FRONTEND_DIR, req.path.endsWith('.html') ? req.path : `${req.path}.html`);
  res.sendFile(candidate, (err) => {
    if (err) {
      res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err2) => {
        if (err2) next();
      });
    }
  });
});

// ---- Error handling (must be last) ----
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
