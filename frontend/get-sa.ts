import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
if (b64) {
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  console.log("Staging SA:", json.client_email);
}
