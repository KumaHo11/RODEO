const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  try {
    console.log('Running v18_terms_and_conditions.sql...');
    const sql = fs.readFileSync(path.join(__dirname, '../v18_terms_and_conditions.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Successfully ran v18_terms_and_conditions.sql');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

run();
