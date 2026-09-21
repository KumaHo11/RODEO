const admin = require('firebase-admin');
const serviceAccount = require('../rodeo-sa-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  try {
    const user = await admin.auth().getUserByEmail('superadmin@rodeo.app');
    await admin.auth().updateUser(user.uid, {
      password: 'Rodeo@Admin2026!'
    });
    console.log('Successfully updated user password');
  } catch (error) {
    console.error('Error updating user:', error);
  }
}
run();
