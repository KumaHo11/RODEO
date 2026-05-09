import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:Fottballer1144@35.247.199.183:5432/rodeo'
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'season_plans'::regclass;
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
