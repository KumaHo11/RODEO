/**
 * run-migration-admin.js — Ejecuta migración con rol admin.
 * USO: Con proxy activo, ejecutar: node run-migration-admin.js
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Set DATABASE_URL_SERVICE or DATABASE_URL en .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const sql = fs.readFileSync('../v5_climate_adjustment.sql', 'utf8');

pool.query(sql)
  .then(() => console.log('Migration completed successfully!'))
  .catch(err => console.error('Migration failed:', err.message))
  .finally(() => pool.end());
