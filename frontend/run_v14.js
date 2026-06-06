const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Running v14_grazing_plans_index.sql...');
    const sql = fs.readFileSync(path.join(__dirname, '../v14_grazing_plans_index.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Successfully ran v14_grazing_plans_index.sql');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

run();
