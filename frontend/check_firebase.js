const fs = require('fs');
const dotenvLines = fs.readFileSync('/Users/javi/RODEO/frontend/.env.local', 'utf8').split('\n');
for (const line of dotenvLines) {
  if (line.includes('FIREBASE_ADMIN_CREDENTIALS_BASE64')) {
    process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 = line.split('=')[1].replace(/"/g, '').trim();
  }
}

const admin = require('firebase-admin');
const cert = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString());
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cert) });

admin.auth().getUserByEmail('javo.oso.m@gmail.com').then(u => {
  console.log('User status IN FIREBASE:', u.email, 'emailVerified:', u.emailVerified);
  process.exit();
}).catch(console.error);
