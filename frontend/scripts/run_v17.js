require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, '../../v17_audit_logs.sql'), 'utf-8');
  console.log('Running v17_audit_logs.sql...');
  try {
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

runMigration();
