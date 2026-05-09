const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Fottballer1144@35.247.199.183:5432/rodeo';
const orgId = '1ea6dbed-44fb-4b4f-ade5-708589e097ed';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const hpRes = await client.query('SELECT count(*) FROM historial_potrero WHERE org_id = $1', [orgId]);
    const snapRes = await client.query('SELECT count(*) FROM climate_adjustment_snapshots WHERE org_id = $1', [orgId]);
    console.log('Historial rows:', hpRes.rows[0].count);
    console.log('Snapshot rows:', snapRes.rows[0].count);
    
    // Check a sample to see if values look right
    const sample = await client.query('SELECT fecha::text, c_adj, ndvi FROM historial_potrero WHERE org_id = $1 ORDER BY fecha DESC LIMIT 1', [orgId]);
    console.log('Latest record:', sample.rows[0]);
  } finally {
    await client.end();
  }
}
run().catch(console.error);
