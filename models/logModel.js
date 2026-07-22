const { db, admin } = require('../firebase/admin');
const { generateId } = require('../utils/generateId');

/**
 * notification_logs — one row per subscriber delivery attempt for a notification.
 * Useful for debugging failed deliveries and click tracking granularity.
 */
const NotificationLogModel = {
  collection: () => db.collection('notification_logs'),

  async createBatch(notificationId, appId, entries) {
    const batchSize = 400;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = db.batch();
      const chunk = entries.slice(i, i + batchSize);
      chunk.forEach((entry) => {
        const ref = this.collection().doc(generateId());
        batch.set(ref, {
          notificationId,
          appId,
          fcmToken: entry.fcmToken,
          status: entry.status, // 'delivered' | 'failed'
          error: entry.error || null,
          clicked: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
  },

  async listByNotification(notificationId, limit = 100) {
    const snapshot = await this.collection()
      .where('notificationId', '==', notificationId)
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },
};

/**
 * activity_logs — human-readable feed of account activity, shown on the dashboard
 * ("Sent notification X", "New subscriber", "App created", etc.)
 */
const ActivityLogModel = {
  collection: () => db.collection('activity_logs'),

  async log(ownerUid, { type, text, appId = null }) {
    const id = generateId();
    await this.collection()
      .doc(id)
      .set({
        ownerUid,
        appId,
        type, // 'sent' | 'sub' | 'app' | 'settings' | 'account'
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return id;
  },

  async listByOwner(ownerUid, limit = 20) {
    const snapshot = await this.collection()
      .where('ownerUid', '==', ownerUid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },
};

/**
 * analytics — daily rollup document per app, id format: `${appId}_${YYYY-MM-DD}`
 * Incrementally updated as events happen; queried for weekly/monthly stats.
 */
const AnalyticsModel = {
  collection: () => db.collection('analytics'),

  dayId(appId, date = new Date()) {
    const d = date.toISOString().slice(0, 10); // YYYY-MM-DD
    return `${appId}_${d}`;
  },

  async increment(appId, ownerUid, fields, date = new Date()) {
    const id = this.dayId(appId, date);
    const ref = this.collection().doc(id);
    const updates = {};
    Object.entries(fields).forEach(([key, value]) => {
      updates[key] = admin.firestore.FieldValue.increment(value);
    });

    await ref.set(
      {
        appId,
        ownerUid,
        date: date.toISOString().slice(0, 10),
        ...updates,
      },
      { merge: true }
    );
  },

  async listByOwnerInRange(ownerUid, startDate, endDate) {
    const snapshot = await this.collection()
      .where('ownerUid', '==', ownerUid)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  },

  async listByAppInRange(appId, startDate, endDate) {
    const snapshot = await this.collection()
      .where('appId', '==', appId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  },
};

module.exports = { NotificationLogModel, ActivityLogModel, AnalyticsModel };
