const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: 'RodeoProd2026New!',
  database: 'rodeo_main'
});

async function main() {
  try {
    const paddocks = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'paddocks'`);
    const herds = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'herds'`);
    const plans = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'grazing_plans'`);
    console.log("Paddocks:", paddocks.rows.map(r => r.column_name).join(', '));
    console.log("Herds:", herds.rows.map(r => r.column_name).join(', '));
    console.log("Plans:", plans.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
