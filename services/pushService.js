const { messaging } = require('../firebase/admin');
const logger = require('../utils/logger');

/**
 * Sends a notification to a batch of FCM tokens using sendEachForMulticast.
 * Returns { delivered, failed, invalidTokens, results }.
 * Handles FCM's 500-token-per-call limit by chunking internally.
 */
async function sendToTokens(tokens, { title, body, icon, image, clickUrl, notificationId }) {
  if (!tokens.length) {
    return { delivered: 0, failed: 0, invalidTokens: [], perTokenResults: [] };
  }

  const CHUNK_SIZE = 500;
  let delivered = 0;
  let failed = 0;
  const invalidTokens = [];
  const perTokenResults = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);

    const message = {
      tokens: chunk,
      notification: { title, body, ...(image ? { imageUrl: image } : {}) },
      webpush: {
        notification: {
          icon: icon || undefined,
        },
        fcmOptions: clickUrl ? { link: clickUrl } : undefined,
      },
      data: {
        notificationId: notificationId || '',
        clickUrl: clickUrl || '',
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      delivered += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((res, idx) => {
        const token = chunk[idx];
        if (!res.success) {
          const code = res.error && res.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(token);
          }
          perTokenResults.push({ token, status: 'failed', error: code || res.error?.message });
        } else {
          perTokenResults.push({ token, status: 'delivered' });
        }
      });
    } catch (err) {
      logger.error('FCM sendEachForMulticast failed for a chunk', { error: err.message });
      failed += chunk.length;
      chunk.forEach((token) => perTokenResults.push({ token, status: 'failed', error: err.message }));
    }
  }

  return { delivered, failed, invalidTokens, perTokenResults };
}

module.exports = { sendToTokens };
