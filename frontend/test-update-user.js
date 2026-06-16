require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

async function run() {
  const credential = admin.credential.cert(JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString('utf-8')));
  admin.initializeApp({ credential });
  const uid = "random-uid";
  try {
    await admin.auth().updateUser(uid, { emailVerified: true });
  } catch (e) {
    console.error("Error code:", e.code);
  }
}

run();
