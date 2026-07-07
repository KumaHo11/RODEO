const { Client } = require('pg');
require('dotenv').config({ path: 'frontend/.env.local' });

const DATABASE_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Set DATABASE_URL_SERVICE or DATABASE_URL in frontend/.env.local');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function run() {
  console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  await client.connect();
  try {
    const res = await client.query("SELECT * FROM climate_adjustment_snapshots ORDER BY calculated_at DESC LIMIT 5");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  }
  await client.end();
}
run();
