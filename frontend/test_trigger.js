const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs'");
  console.log("columns:", res.rows.map(r => r.column_name));
  
  const func = await pool.query("SELECT pg_get_functiondef('process_audit_log'::regproc)");
  console.log("function:", func.rows[0].pg_get_functiondef);
  process.exit(0);
}
main();
