const fs = require('fs');
const envLines = fs.readFileSync('/Users/javi/RODEO/frontend/.env.local', 'utf8').split('\n');
envLines.forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const split = line.split('=');
    const k = split[0].trim();
    const v = split.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    process.env[k] = v;
  }
});

const admin = require('firebase-admin');
const certBase64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
if (!certBase64) {
  console.error("No FIREBASE_ADMIN_CREDENTIALS_BASE64 found in .env.local");
  process.exit(1);
}

const cert = JSON.parse(Buffer.from(certBase64, 'base64').toString());
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cert) });

async function run() {
  console.log('Fetching user javo.oso.m@gmail.com...');
  try {
    const u = await admin.auth().getUserByEmail('javo.oso.m@gmail.com');
    console.log('Status before:', u.email, u.emailVerified);
  } catch (err) {
    console.error('User not found in Firebase Auth:', err.message);
  }
}
run();
