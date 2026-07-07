/**
 * clean-mock-data.js — Borra datos de prueba de climate_adjustment_snapshots.
 * USO: DATABASE_URL_PROD=postgresql://... node clean-mock-data.js
 */
require('dotenv').config({ path: '.env.prod.local' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Set DATABASE_URL_PROD. Ejemplo: DATABASE_URL_PROD=postgresql://... node clean-mock-data.js');
  process.exit(1);
}

async function main() {
  console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const res = await pool.query(`DELETE FROM climate_adjustment_snapshots`);
    console.log(`Deleted ${res.rowCount} rows from climate_adjustment_snapshots.`);
  } catch(e) { console.error(e.message); }
  await pool.end();
}
main();
