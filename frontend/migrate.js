const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo',
  ssl: false
});

async function run() {
  try {
    await pool.query(`
      ALTER TABLE farm_events 
      ADD COLUMN IF NOT EXISTS herd_ids JSONB;
    `);
    // Migration completed
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

run();
