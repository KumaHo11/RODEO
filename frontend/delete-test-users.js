require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString('utf-8')))
    });
  }
  
  const auth = admin.auth();
  let users = await auth.listUsers();
  for (const u of users.users) {
    if (u.email.includes('javi.osorio.1') || u.email.includes('javo.oso.m') || u.email.includes('josorio')) {
      console.log('Deleting from Firebase:', u.email);
      await auth.deleteUser(u.uid);
      await prisma.profile.deleteMany({ where: { firebaseUid: u.uid } });
    }
  }
  console.log('Done cleaning testing users');
}

run().catch(console.error).finally(() => process.exit());
