/**
 * OAuth verification service.
 *
 * Flow used by this API (Firebase-native, recommended for a Firebase Auth backend):
 *   1. Frontend uses Firebase Client SDK's signInWithPopup(GoogleAuthProvider / GithubAuthProvider).
 *   2. Frontend gets a Firebase ID token from that sign-in.
 *   3. Frontend POSTs { idToken } to /api/auth/google or /api/auth/github.
 *   4. Backend verifies the ID token with Firebase Admin, extracts provider + profile info.
 *
 * This avoids reimplementing OAuth handshakes server-side and reuses Firebase Auth
 * as the identity provider, while our own Firestore `users` collection stores the
 * app-specific profile, and our own JWTs are what the API actually trusts afterward.
 */
const { auth } = require('../firebase/admin');
const ApiError = require('../utils/apiError');

const PROVIDER_MAP = {
  'google.com': 'google',
  'github.com': 'github',
  password: 'password',
};

async function verifyFirebaseIdToken(idToken) {
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired OAuth token');
  }
}

async function verifyProviderToken(idToken, expectedProvider) {
  const decoded = await verifyFirebaseIdToken(idToken);
  const firebaseUser = await auth.getUser(decoded.uid);

  const signInProvider = decoded.firebase?.sign_in_provider;
  const mappedProvider = PROVIDER_MAP[signInProvider];

  if (expectedProvider && mappedProvider !== expectedProvider) {
    throw ApiError.badRequest(
      `Token was issued by ${mappedProvider || signInProvider}, not ${expectedProvider}`
    );
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    emailVerified: firebaseUser.emailVerified,
    name: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL || null,
    provider: mappedProvider || 'unknown',
  };
}

module.exports = { verifyFirebaseIdToken, verifyProviderToken };
