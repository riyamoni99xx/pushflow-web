const { db, admin } = require('../firebase/admin');

const COLLECTION = 'users';

const UserModel = {
  collection: () => db.collection(COLLECTION),

  async create(uid, data) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userDoc = {
      email: data.email,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      photoURL: data.photoURL || null,
      phone: data.phone || '',
      provider: data.provider, // 'password' | 'google' | 'github'
      emailVerified: data.emailVerified || false,
      disabled: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    await this.collection().doc(uid).set(userDoc);
    return { uid, ...userDoc };
  },

  async findById(uid) {
    const doc = await this.collection().doc(uid).get();
    return doc.exists ? { uid: doc.id, ...doc.data() } : null;
  },

  async findByEmail(email) {
    const snapshot = await this.collection().where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { uid: doc.id, ...doc.data() };
  },

  async update(uid, data) {
    await this.collection()
      .doc(uid)
      .update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return this.findById(uid);
  },

  async updateLastLogin(uid) {
    await this.collection().doc(uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  async delete(uid) {
    await this.collection().doc(uid).delete();
  },

  /** Public-safe projection — strips nothing sensitive since we don't store passwords here (Firebase Auth handles that). */
  toPublic(user) {
    if (!user) return null;
    const { uid, email, firstName, lastName, name, photoURL, phone, provider, emailVerified, createdAt, lastLoginAt } = user;
    return { uid, email, firstName, lastName, name, photoURL, phone, provider, emailVerified, createdAt, lastLoginAt };
  },
};

module.exports = UserModel;
