/**
 * update_passwords.js — Actualiza passwords de roles de DB.
 * USO: DATABASE_URL_SERVICE=postgresql://postgres:...@localhost/rodeo node update_passwords.js
 * Con proxy activo: ./start_proxy_staging.sh
 *
 * IMPORTANTE: Actualizar las contraseñas abajo antes de ejecutar.
 */
require('dotenv').config({ path: 'frontend/.env.local' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Set DATABASE_URL_SERVICE or DATABASE_URL');
  process.exit(1);
}

const NEW_APP_PASSWORD = process.env.NEW_RODEO_APP_PASSWORD;
const NEW_SERVICE_PASSWORD = process.env.NEW_RODEO_SERVICE_PASSWORD;

if (!NEW_APP_PASSWORD || !NEW_SERVICE_PASSWORD) {
  console.error('❌ Set NEW_RODEO_APP_PASSWORD and NEW_RODEO_SERVICE_PASSWORD env vars');
  console.error('   Ejemplo: NEW_RODEO_APP_PASSWORD=xxx NEW_RODEO_SERVICE_PASSWORD=yyy node update_passwords.js');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
async function run() {
  try {
    console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
    await pool.query(`ALTER ROLE rodeo_app WITH PASSWORD '${NEW_APP_PASSWORD}'`);
    await pool.query(`ALTER ROLE rodeo_service WITH PASSWORD '${NEW_SERVICE_PASSWORD}'`);
    console.log('✅ Passwords updated!');
  } catch (e) {
    console.error('FAIL', e.message);
  }
  process.exit(0);
}
run();
