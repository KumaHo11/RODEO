import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const credential = admin.credential.cert(JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64 || '', 'base64').toString('utf-8')));
admin.initializeApp({ credential });
admin.auth().updateUser('random-uid', { emailVerified: true }).catch(e => console.error(e.code));
