require('dotenv').config({ path: 'frontend/.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  try {
    const res = await pool.query("SELECT email, created_at FROM profiles ORDER BY created_at DESC LIMIT 5");
    console.log('Recent Profiles:', res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
test();
