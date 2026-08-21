const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
async function getSecret() {
  const client = new SecretManagerServiceClient();
  try {
    const [version] = await client.accessSecretVersion({
      name: 'projects/rodeo-app-fac50/secrets/rodeo-db-url/versions/latest',
    });
    console.log('rodeo-db-url:', version.payload.data.toString());
  } catch (e) { console.error('Error fetching rodeo-db-url:', e.message); }
}
getSecret();
