const { db, admin } = require('../firebase/admin');
const { generateId } = require('../utils/generateId');

const COLLECTION = 'subscribers';

const SubscriberModel = {
  collection: () => db.collection(COLLECTION),

  async findByToken(appId, fcmToken) {
    const snapshot = await this.collection()
      .where('appId', '==', appId)
      .where('fcmToken', '==', fcmToken)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  },

  async upsert(appId, data) {
    const existing = await this.findByToken(appId, data.fcmToken);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (existing) {
      await this.collection().doc(existing.id).update({
        status: 'active',
        browser: data.browser || existing.browser,
        device: data.device || existing.device,
        platform: data.platform || existing.platform,
        lastActiveAt: now,
      });
      return { id: existing.id, reactivated: existing.status !== 'active' };
    }

    const id = generateId();
    await this.collection()
      .doc(id)
      .set({
        appId,
        fcmToken: data.fcmToken,
        browser: data.browser || 'unknown',
        device: data.device || 'unknown',
        platform: data.platform || 'unknown',
        status: 'active',
        subscribedAt: now,
        lastActiveAt: now,
      });
    return { id, reactivated: false, isNew: true };
  },

  async removeByToken(appId, fcmToken) {
    const existing = await this.findByToken(appId, fcmToken);
    if (!existing) return false;
    await this.collection().doc(existing.id).update({
      status: 'unsubscribed',
      unsubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  },

  async listByApp(appId, { status = 'active', limit = 50, cursor = null } = {}) {
    let query = this.collection().where('appId', '==', appId);
    if (status) query = query.where('status', '==', status);
    query = query.orderBy('subscribedAt', 'desc').limit(limit);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async countActiveByApp(appId) {
    const snapshot = await this.collection()
      .where('appId', '==', appId)
      .where('status', '==', 'active')
      .count()
      .get();
    return snapshot.data().count;
  },

  async getActiveTokensByApp(appId) {
    const snapshot = await this.collection()
      .where('appId', '==', appId)
      .where('status', '==', 'active')
      .get();
    return snapshot.docs.map((doc) => doc.data().fcmToken);
  },

  async markTokensInvalid(appId, tokens) {
    if (!tokens.length) return;
    const batchSize = 400; // Firestore batch write limit safety margin
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = db.batch();
      const chunk = tokens.slice(i, i + batchSize);
      const snapshot = await this.collection()
        .where('appId', '==', appId)
        .where('fcmToken', 'in', chunk.slice(0, 30)) // Firestore 'in' max 30 values
        .get();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'invalid', invalidatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
    }
  },
};

module.exports = SubscriberModel;
