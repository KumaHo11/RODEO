require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const cert = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString());
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cert) });
admin.auth().getUserByEmail('javo.oso.m@gmail.com').then(u => {
  console.log('User javo.oso.m@gmail.com emailVerified:', u.emailVerified);
  process.exit();
}).catch(console.error);
