const { db, admin } = require('../firebase/admin');
const { generateId } = require('../utils/generateId');

const COLLECTION = 'notifications';

const NotificationModel = {
  collection: () => db.collection(COLLECTION),

  async create(appId, ownerUid, data) {
    const id = generateId();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const isScheduled = !!data.scheduledAt;

    const doc = {
      appId,
      ownerUid,
      title: data.title,
      body: data.body,
      icon: data.icon || null,
      image: data.image || null,
      clickUrl: data.clickUrl || '',
      status: isScheduled ? 'scheduled' : 'pending', // pending -> sent | failed ; scheduled -> pending -> sent | failed
      scheduledAt: data.scheduledAt || null,
      sentAt: null,
      stats: {
        targeted: 0,
        delivered: 0,
        failed: 0,
        clicked: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.collection().doc(id).set(doc);
    return { id, ...doc };
  },

  async findById(id) {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async listByOwner(ownerUid, { limit = 20, cursor = null, appId = null } = {}) {
    let query = this.collection().where('ownerUid', '==', ownerUid);
    if (appId) query = query.where('appId', '==', appId);
    query = query.orderBy('createdAt', 'desc').limit(limit);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async listDuePending() {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await this.collection()
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async markSending(id) {
    await this.collection().doc(id).update({ status: 'sending', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  },

  async markResult(id, { targeted, delivered, failed }) {
    await this.collection()
      .doc(id)
      .update({
        status: failed > 0 && delivered === 0 && targeted > 0 ? 'failed' : 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        'stats.targeted': targeted,
        'stats.delivered': delivered,
        'stats.failed': failed,
      });
  },

  async incrementClick(id) {
    await this.collection()
      .doc(id)
      .update({ 'stats.clicked': admin.firestore.FieldValue.increment(1) });
  },
};

module.exports = NotificationModel;
