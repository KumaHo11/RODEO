const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rodeo' });
async function run() {
  const res = await pool.query("SELECT COUNT(*) FROM climate_adjustment_snapshots");
  console.log("Count:", res.rows[0]);
  process.exit(0);
}
run();
