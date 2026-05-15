const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:<PASSWORD>@35.247.199.183:5432/rodeo';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const email = 'javi.osorio.1@gmail.com';
    const profileRes = await client.query('SELECT organization_id FROM profiles WHERE email = $1', [email]);
    
    if (profileRes.rows.length === 0) {
      console.log('No profile found for ' + email);
      return;
    }
    
    const orgId = profileRes.rows[0].organization_id;
    console.log('Org ID:', orgId);
    
    const paddocksRes = await client.query('SELECT id, name FROM paddocks WHERE org_id = $1', [orgId]);
    console.log('Paddocks found:', paddocksRes.rows.length);
    console.log(JSON.stringify(paddocksRes.rows));
  } finally {
    await client.end();
  }
}

run().catch(console.error);
