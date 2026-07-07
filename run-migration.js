const { Client } = require('pg');
const fs = require('fs');
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
    const sql = fs.readFileSync('v5_climate_adjustment.sql', 'utf-8');
    await client.query(sql);
    console.log("Migration executed successfully!");
  } catch(e) {
    console.error(e);
  }
  await client.end();
}
run();
