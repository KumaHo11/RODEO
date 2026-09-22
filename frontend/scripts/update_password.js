const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('../rodeo-sa-key.json');

initializeApp({
  credential: cert(serviceAccount)
});

async function run() {
  try {
    const password = process.env.SUPERADMIN_PASSWORD;
    if (!password) throw new Error('SUPERADMIN_PASSWORD missing');
    const user = await getAuth().getUserByEmail('superadmin@rodeo.app');
    await getAuth().updateUser(user.uid, {
      password
    });
    console.log('Successfully updated user password');
  } catch (error) {
    console.error('Error updating user:', error);
  }
}
run();
