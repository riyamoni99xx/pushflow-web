const { db, admin } = require('../firebase/admin');

/**
 * settings — one document per user, keyed by uid.
 * Stored as its own top-level collection (per the required schema) rather than
 * nested under users, so it can be queried/indexed independently if needed.
 */
const COLLECTION = 'settings';

const DEFAULTS = {
  website: { name: '', url: '', description: '' },
  notifications: {
    emailOnNewSubscriber: true,
    emailOnFailedDelivery: true,
    defaultIcon: null,
    defaultClickUrl: '',
  },
};

const SettingsModel = {
  collection: () => db.collection(COLLECTION),

  async getOrCreate(uid) {
    const ref = this.collection().doc(uid);
    const doc = await ref.get();
    if (doc.exists) return { uid, ...doc.data() };

    const now = admin.firestore.FieldValue.serverTimestamp();
    const initial = { ...DEFAULTS, createdAt: now, updatedAt: now };
    await ref.set(initial);
    return { uid, ...initial };
  },

  async update(uid, data) {
    const ref = this.collection().doc(uid);
    await ref.set(
      { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    const doc = await ref.get();
    return { uid, ...doc.data() };
  },
};

module.exports = SettingsModel;
