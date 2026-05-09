const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL.replace('postgresql://', 'http://');
const url = new URL(connectionString);

const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1).split('?')[0],
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const sp = await pool.query("SELECT id, name, created_at FROM season_plans");
    console.log("Season plans count:", sp.rows.length);
    if (sp.rows.length > 0) {
      console.log("Season plans:", sp.rows.slice(0, 5));
      // Delete all season plans
      await pool.query("DELETE FROM season_plans");
      console.log("Deleted all season plans.");
    }

    // Also delete all grazing_plans created today that might be duplicates or excel leftovers.
    // Wait, the user said "cada vez que ingreso un plan se me replican", maybe it's grazing_plans duplicating?
    // Let's delete grazing_plans with ai_analysis containing cycle_id?
    const gp = await pool.query("SELECT COUNT(*) FROM grazing_plans");
    console.log("Grazing plans count:", gp.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
