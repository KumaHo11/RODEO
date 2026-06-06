const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Running v13_profile_notifications.sql...');
    const sql = fs.readFileSync(path.join(__dirname, '../v13_profile_notifications.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Successfully ran v13_profile_notifications.sql');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

run();
