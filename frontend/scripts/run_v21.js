require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const dbUrl = process.env.DATABASE_URL_SERVICE;
  if (!dbUrl) {
    console.error('No DATABASE_URL_SERVICE found in .env.local');
    process.exit(1);
  }

  const url = new URL(dbUrl.replace('postgresql://', 'http://'));
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Running v21_season_plans.sql...');
    const sql = fs.readFileSync('../v21_season_plans.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration v21_season_plans applied successfully.');
  } catch (err) {
    console.error('❌ Error applying migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
