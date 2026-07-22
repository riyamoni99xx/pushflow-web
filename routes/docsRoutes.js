const express = require('express');
const router = express.Router();

/** GET /api/docs — machine-readable endpoint reference for the documentation.html page to render. */
router.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'PushFlow API',
    version: '1.0.0',
    baseUrl: '/api',
    authentication: {
      dashboard: 'Bearer JWT access token in Authorization header, obtained from /api/auth/login|register|google|github. Refresh via /api/auth/refresh (uses HttpOnly cookie).',
      publicWidget: 'X-API-Key header, obtained from an app\'s API key in the dashboard.',
    },
    endpoints: [
      { method: 'POST', path: '/api/auth/register', auth: 'none', body: ['fname', 'lname', 'email', 'password'] },
      { method: 'POST', path: '/api/auth/login', auth: 'none', body: ['email', 'password', 'remember?'] },
      { method: 'POST', path: '/api/auth/google', auth: 'none', body: ['idToken'] },
      { method: 'POST', path: '/api/auth/github', auth: 'none', body: ['idToken'] },
      { method: 'POST', path: '/api/auth/refresh', auth: 'refresh cookie' },
      { method: 'POST', path: '/api/auth/logout', auth: 'none' },
      { method: 'POST', path: '/api/auth/forgot-password', auth: 'none', body: ['email'] },
      { method: 'POST', path: '/api/auth/reset-password', auth: 'none', body: ['oobCode', 'newPassword'] },
      { method: 'GET', path: '/api/auth/me', auth: 'optional' },

      { method: 'GET', path: '/api/user/profile', auth: 'JWT' },
      { method: 'PUT', path: '/api/user/profile', auth: 'JWT', body: ['firstName?', 'lastName?', 'name?'] },
      { method: 'POST', path: '/api/user/photo', auth: 'JWT', body: 'multipart: photo' },
      { method: 'DELETE', path: '/api/user/photo', auth: 'JWT' },
      { method: 'PUT', path: '/api/user/password', auth: 'JWT', body: ['currentPassword', 'newPassword'] },
      { method: 'POST', path: '/api/user/sessions/revoke-others', auth: 'JWT' },
      { method: 'DELETE', path: '/api/user/delete', auth: 'JWT' },

      { method: 'POST', path: '/api/apps', auth: 'JWT', body: ['name', 'website?', 'domain?'] },
      { method: 'GET', path: '/api/apps', auth: 'JWT' },
      { method: 'GET', path: '/api/apps/:id', auth: 'JWT' },
      { method: 'PUT', path: '/api/apps/:id', auth: 'JWT', body: ['name?', 'website?', 'domain?', 'status?'] },
      { method: 'DELETE', path: '/api/apps/:id', auth: 'JWT' },
      { method: 'POST', path: '/api/apps/:id/icon', auth: 'JWT', body: 'multipart: icon' },
      { method: 'POST', path: '/api/apps/:id/apikey/generate', auth: 'JWT' },
      { method: 'POST', path: '/api/apps/:id/apikey/regenerate', auth: 'JWT' },
      { method: 'POST', path: '/api/apps/:id/apikey/disable', auth: 'JWT' },
      { method: 'POST', path: '/api/apps/:id/apikey/enable', auth: 'JWT' },

      { method: 'POST', path: '/api/subscribers/register', auth: 'X-API-Key', body: ['fcmToken', 'browser?', 'device?', 'platform?'] },
      { method: 'DELETE', path: '/api/subscribers/remove', auth: 'X-API-Key', body: ['fcmToken'] },
      { method: 'GET', path: '/api/subscribers?appId=', auth: 'JWT' },
      { method: 'GET', path: '/api/subscribers/count?appId=', auth: 'JWT' },

      { method: 'POST', path: '/api/notifications/send', auth: 'JWT', body: ['appId', 'title', 'body', 'icon?', 'image?', 'clickUrl?'] },
      { method: 'POST', path: '/api/notifications/schedule', auth: 'JWT', body: ['appId', 'title', 'body', 'scheduledAt', 'icon?', 'image?', 'clickUrl?'] },
      { method: 'GET', path: '/api/notifications/history?appId=&limit=', auth: 'JWT' },
      { method: 'GET', path: '/api/notifications/:id', auth: 'JWT' },
      { method: 'GET', path: '/api/notifications/track/click/:id', auth: 'none (redirect)' },

      { method: 'GET', path: '/api/dashboard', auth: 'JWT' },
      { method: 'GET', path: '/api/analytics?appId=&period=', auth: 'JWT' },

      { method: 'GET', path: '/api/settings', auth: 'JWT' },
      { method: 'PUT', path: '/api/settings', auth: 'JWT', body: ['website?', 'notifications?'] },

      { method: 'GET', path: '/api/keys', auth: 'JWT' },
      { method: 'POST', path: '/api/keys', auth: 'JWT', body: ['appId'] },
      { method: 'POST', path: '/api/keys/primary/regenerate', auth: 'JWT', body: ['appId'] },
      { method: 'DELETE', path: '/api/keys/:id', auth: 'JWT' },
    ],
  });
});

module.exports = router;
