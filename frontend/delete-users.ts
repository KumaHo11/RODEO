import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const credential = admin.credential.cert(JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || '', 'base64').toString('utf-8')));
admin.initializeApp({ credential });

async function run() {
  const emails = [
    'javi.osorio.1@gmail.com',
    'javo.oso.m@gmail.com',
    'javo.oso.m+1@gmail.com',
    'javo.oso.m+2@gmail.com',
    'josorio@rodeoagtech.com',
    'javi.osorio.1+1@gmail.com',
    'javi.osorio.1+2@gmail.com',
    'javi.osorio.1+3@gmail.com'
  ];
  for (const email of emails) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(user.uid);
      console.log(`Deleted ${email}`);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log(`User ${email} not found.`);
      } else {
        console.error(`Error deleting ${email}: ${e.message}`);
      }
    }
  }
}
run();
