require('dotenv').config({ path: '.env.local' });
const email = "test_verify_777@rodeoagtech.com";
const password = "Password123!";

async function run() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  // 1. Sign up to get ID Token
  const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const signUpData = await signUpRes.json();
  const idToken = signUpData.idToken;
  
  // 2. Request verification email
  const oobRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken, returnOobLink: true })
  });
  const oobData = await oobRes.json();
  console.log("oobData:", oobData);
}

run().catch(console.error);
