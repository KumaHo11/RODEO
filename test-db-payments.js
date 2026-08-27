const { Pool } = require('pg');
require('dotenv').config({ path: 'frontend/.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE });
async function test() {
  try {
    const res = await pool.query(`
      SELECT column_name, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name IN ('created_at', 'updated_at')
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
test();
