require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
});

async function run() {
  try {
    const orgResult = await pool.query(
      `INSERT INTO organizations
         (id, name, subscription_plan_id, plan_status, trial_ends_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [
        'Test Ranch',
        null,
        'active',
        null,
      ]
    );
    console.log('Org inserted:', orgResult.rows[0]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgResult.rows[0].id]);
  } catch (err) {
    console.error('Error inserting:', err);
  } finally {
    await pool.end();
  }
}
run();
