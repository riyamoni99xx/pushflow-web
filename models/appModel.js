const { db, admin } = require('../firebase/admin');
const { generateId, generateApiKey, hashValue } = require('../utils/generateId');

const COLLECTION = 'apps';

const AppModel = {
  collection: () => db.collection(COLLECTION),

  async create(ownerUid, data) {
    const id = generateId();
    const apiKey = generateApiKey();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const appDoc = {
      ownerUid,
      name: data.name,
      website: data.website || '',
      domain: data.domain || '',
      domainVerified: false,
      icon: data.icon || null,
      status: 'active', // active | suspended
      apiKeyHash: hashValue(apiKey),
      apiKeyPreview: `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`,
      apiKeyEnabled: true,
      settings: {
        defaultIcon: data.icon || null,
        defaultClickUrl: data.website || '',
        notificationsEnabled: true,
      },
      subscriberCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection().doc(id).set(appDoc);
    // apiKey is only ever returned once, at creation/regeneration time — never stored in plaintext.
    return { id, ...appDoc, apiKey };
  },

  async findById(id) {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async findByOwner(ownerUid) {
    const snapshot = await this.collection().where('ownerUid', '==', ownerUid).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async countByOwner(ownerUid) {
    const snapshot = await this.collection().where('ownerUid', '==', ownerUid).count().get();
    return snapshot.data().count;
  },

  async update(id, data) {
    await this.collection()
      .doc(id)
      .update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(id);
  },

  async regenerateApiKey(id) {
    const apiKey = generateApiKey();
    await this.collection()
      .doc(id)
      .update({
        apiKeyHash: hashValue(apiKey),
        apiKeyPreview: `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`,
        apiKeyEnabled: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return apiKey;
  },

  async setApiKeyEnabled(id, enabled) {
    await this.collection().doc(id).update({
      apiKeyEnabled: enabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  async incrementSubscriberCount(id, delta) {
    await this.collection()
      .doc(id)
      .update({ subscriberCount: admin.firestore.FieldValue.increment(delta) });
  },

  async delete(id) {
    await this.collection().doc(id).delete();
  },

  toPublic(app) {
    if (!app) return null;
    const { apiKeyHash, ...safe } = app;
    return safe;
  },
};

module.exports = AppModel;
