const { bucket } = require('../firebase/admin');
const { generateId } = require('../utils/generateId');
const ApiError = require('../utils/apiError');

/**
 * Uploads a buffer (from multer memoryStorage) to Firebase Storage
 * and returns a public URL. Path examples:
 *   uploadBuffer(file, 'profile-photos/<uid>')
 *   uploadBuffer(file, 'app-icons/<appId>')
 */
async function uploadBuffer(file, folder) {
  if (!bucket) {
    throw ApiError.internal('Firebase Storage bucket is not configured (FIREBASE_STORAGE_BUCKET)');
  }

  const ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
  const filename = `${folder}/${generateId()}.${ext}`;
  const blob = bucket.file(filename);

  await new Promise((resolve, reject) => {
    const stream = blob.createWriteStream({
      metadata: { contentType: file.mimetype },
      resumable: false,
    });
    stream.on('error', reject);
    stream.on('finish', resolve);
    stream.end(file.buffer);
  });

  await blob.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

/** Deletes a previously uploaded file given its public URL, if it belongs to our bucket. */
async function deleteByUrl(url) {
  if (!bucket || !url) return;
  const prefix = `https://storage.googleapis.com/${bucket.name}/`;
  if (!url.startsWith(prefix)) return;
  const path = url.slice(prefix.length);
  try {
    await bucket.file(path).delete();
  } catch (err) {
    // Non-fatal — file may already be gone.
  }
}

module.exports = { uploadBuffer, deleteByUrl };
