const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT completed_tours FROM profiles LIMIT 1");
  console.log(res.rows[0]);
  console.log("Is Array?", Array.isArray(res.rows[0]?.completed_tours));
  process.exit(0);
}
main();
