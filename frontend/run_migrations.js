const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Running add_trial_days_column.sql...');
    const sql1 = fs.readFileSync(path.join(__dirname, '../add_trial_days_column.sql'), 'utf-8');
    await pool.query(sql1);
    console.log('Successfully ran add_trial_days_column.sql');

    console.log('Running pricing_strategy_migration.sql...');
    const sql2 = fs.readFileSync(path.join(__dirname, '../pricing_strategy_migration.sql'), 'utf-8');
    await pool.query(sql2);
    console.log('Successfully ran pricing_strategy_migration.sql');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

run();
