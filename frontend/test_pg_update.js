const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res1 = await pool.query("SELECT firebase_uid, completed_tours FROM profiles LIMIT 1");
  const uid = res1.rows[0].firebase_uid;
  const tours = res1.rows[0].completed_tours || [];
  tours.push("test-tour-id");
  try {
    await pool.query("UPDATE profiles SET completed_tours = $1 WHERE firebase_uid = $2", [tours, uid]);
    console.log("Update success!");
  } catch (e) {
    console.error("Update failed:", e.message);
  }
  process.exit(0);
}
main();
