/**
 * run-v5-admin.js — Ejecuta v5_climate_adjustment.sql con rol postgres admin.
 * USO: DATABASE_URL_SERVICE=postgresql://postgres:...@localhost/rodeo node run-v5-admin.js
 * Con proxy activo: ./start_proxy_staging.sh (en otra terminal)
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Set DATABASE_URL_SERVICE en .env.local o como variable de entorno.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  try {
    console.log('Running v5_climate_adjustment.sql with admin...');
    console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
    const sql = fs.readFileSync(path.join(__dirname, '../v5_climate_adjustment.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Successfully ran v5_climate_adjustment.sql');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}
run();
