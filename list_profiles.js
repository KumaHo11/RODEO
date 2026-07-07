const { Client } = require('pg');
require('dotenv').config({ path: 'frontend/.env.local' });

async function run() {
  const DATABASE_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ Set DATABASE_URL_SERVICE or DATABASE_URL in frontend/.env.local');
    process.exit(1);
  }
  console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT * FROM profiles LIMIT 10');
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
