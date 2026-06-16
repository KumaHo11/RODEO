import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const admin = require('firebase-admin');
const prisma = new PrismaClient();

async function run() {
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64_PROD;
  if (!b64) throw new Error("No b64 credentials");
  const credential = admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')));
  admin.initializeApp({ credential });
  
  const auth = admin.auth();
  const users = await auth.listUsers();
  for (const u of users.users) {
    if (u.email?.includes('javi.osorio.1') || u.email?.includes('javo.oso.m') || u.email?.includes('josorio@rodeoagtech')) {
      console.log('Deleting from Firebase:', u.email);
      await auth.deleteUser(u.uid);
      await prisma.profile.deleteMany({ where: { firebaseUid: u.uid } });
    }
  }
  console.log('Done cleaning testing users');
}

run().catch(console.error).finally(() => process.exit());
