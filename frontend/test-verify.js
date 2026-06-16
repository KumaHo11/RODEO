const email = "test_verify_99@rodeoagtech.com";
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
  const oobLink = oobData.oobLink;
  const oobCode = new URL(oobLink).searchParams.get("oobCode");
  console.log("oobCode:", oobCode);
  
  // 3. Verify email
  const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode })
  });
  const verifyData = await verifyRes.json();
  console.log("verifyData:", verifyData);
  
  // 4. Log in to check emailVerified
  const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const loginData = await loginRes.json();
  console.log("loginData.emailVerified:", loginData.emailVerified);
}

run();
