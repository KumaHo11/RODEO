const { google } = require('googleapis');
async function find() {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const sql = google.sql('v1beta4');
  for (const project of ['rodeo-app-fac50', 'rodeo-app-prod-v1']) {
    try {
      const res = await sql.instances.list({ project, auth });
      for (const inst of res.data.items || []) {
        const ip = inst.ipAddresses?.find(i => i.ipAddress === '35.247.199.183');
        if (ip) console.log('FOUND in project:', project, 'instance:', inst.name, 'connectionName:', inst.connectionName);
      }
    } catch (e) { console.error('Error in project', project, e.message); }
  }
}
find();
