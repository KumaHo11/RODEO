import { config } from 'dotenv';
config({ path: './frontend/.env.local' });
import { getDbPool } from './frontend/src/lib/db';

async function run() {
  try {
    const pool = getDbPool();
    const res = await pool.query("SELECT * FROM climate_adjustment_snapshots ORDER BY calculated_at DESC LIMIT 5");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
