import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
