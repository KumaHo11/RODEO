const email = "test_robot_99@rodeoagtech.com";
const password = "Password123!";

async function run() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY_PROD;
  // 1. Sign up to Firebase Prod to get ID Token
  const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const signUpData = await signUpRes.json();
  if (signUpData.error) {
    console.error("Firebase Auth Error:", signUpData.error);
    return;
  }
  const idToken = signUpData.idToken;
  console.log("Got idToken for Prod:", idToken.substring(0, 20) + "...");

  // 2. Call /api/auth/register on PROD
  const regRes = await fetch('https://rodeoagtech.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      firstName: "Test",
      lastName: "Robot",
      phone: "123456789",
      country: "Argentina",
      countryCode: "AR",
      termsVersionId: null
    })
  });
  console.log("Register Response Status:", regRes.status);
  const regData = await regRes.text();
  console.log("Register Response Body:", regData);
}

run();
