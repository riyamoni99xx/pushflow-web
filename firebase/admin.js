/**
 * Firebase Admin SDK initialization.
 * Supports two ways of providing credentials (see .env.example):
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON — full service account JSON as one line
 *   2. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY — separate fields
 */
const admin = require('firebase-admin');
const config = require('../config/env');
const logger = require('../utils/logger');

let app;

function buildCredential() {
  if (config.firebase.serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
      return admin.credential.cert(serviceAccount);
    } catch (err) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but could not be parsed as JSON. ' +
          'Make sure it is valid, minified JSON on a single line.'
      );
    }
  }

  if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    return admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    });
  }

  throw new Error(
    'Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or the ' +
      'FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY trio in .env'
  );
}

function initFirebase() {
  if (app) return app;

  app = admin.initializeApp({
    credential: buildCredential(),
    storageBucket: config.firebase.storageBucket || undefined,
  });

  logger.info('Firebase Admin SDK initialized');
  return app;
}

initFirebase();

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();
const bucket = config.firebase.storageBucket ? admin.storage().bucket() : null;

// Firestore settings: ignore undefined properties instead of throwing,
// since optional fields are common across this API.
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth, messaging, bucket };
