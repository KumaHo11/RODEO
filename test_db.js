const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:RodeoDB2026Secure@35.247.199.183:5432/rodeo'
});
client.connect().then(() => {
  return client.query("SELECT * FROM organizations WHERE name = 'SuperAdmin Org'");
}).then(res => {
  console.log("ORGS:", res.rows);
  client.end();
}).catch(e => {
  console.error("DB Error:", e);
  client.end();
});
