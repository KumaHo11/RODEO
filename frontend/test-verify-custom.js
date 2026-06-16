require('dotenv').config({ path: '.env.local' });
const { SignJWT, jwtVerify } = require('jose');

async function run() {
  try {
    const uid = "some-uid";
    const email = "some-email@example.com";
    const secretStr = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'default_secret';
    console.log("Secret length:", secretStr.length);
    const secret = new TextEncoder().encode(secretStr);
    
    const token = await new SignJWT({ uid, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret);
      
    console.log("Token:", token.substring(0, 30) + '...');
    
    // Now verify it exactly as the route does
    const result = await jwtVerify(token, secret);
    console.log("Verification success! UID:", result.payload.uid);
  } catch(e) {
    console.error("Verification failed:", e);
  }
}
run();
