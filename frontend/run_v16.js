const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const sql = fs.readFileSync('../v16_completed_tours.sql', 'utf8');
    await pool.query(sql);
    console.log("Migration v16 applied successfully.");
  } catch(e) {
    console.log("Migration error:", e.message);
  } finally {
    pool.end();
  }
}

run();
