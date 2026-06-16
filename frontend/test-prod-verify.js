require('dotenv').config({ path: '.env.local' });
const { SignJWT } = require('jose');

async function run() {
  const secretStr = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const secret = new TextEncoder().encode(secretStr);
  const token = await new SignJWT({ uid: "V9fGvwV0b9S29vM80Zk3yYg11", email: "test@rodeoagtech.com" })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
    
  console.log("Generated Token:", token);
  
  const res = await fetch("https://rodeoagtech.com/api/auth/verify-custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  
  const text = await res.text();
  console.log("Prod Response Status:", res.status);
  console.log("Prod Response:", text);
}
run();
