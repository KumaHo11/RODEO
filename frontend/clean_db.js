const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo' });

async function cleanDB() {
  console.log('Cleaning Staging Postgres database...');
  await pool.query('TRUNCATE profiles CASCADE;');
  await pool.query('TRUNCATE organizations CASCADE;');
  await pool.query('TRUNCATE team_invitations CASCADE;');
  console.log('Database cleaned successfully.');
  process.exit(0);
}
cleanDB().catch(console.error);
