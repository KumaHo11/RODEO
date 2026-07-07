/**
 * fix-schema-and-migrate.js — Ejecuta alter y migración v5.
 * USO: Con proxy activo, ejecutar: node fix-schema-and-migrate.js
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

const alterSql = `
  ALTER TABLE system_feature_flags ADD COLUMN IF NOT EXISTS flag_type VARCHAR(20) NOT NULL DEFAULT 'boolean' CHECK (flag_type IN ('boolean','number','string'));
`;

const sql = fs.readFileSync('../v5_climate_adjustment.sql', 'utf8');

pool.query(alterSql)
  .then(() => pool.query(sql))
  .then(() => console.log('Migration completed successfully!'))
  .catch(err => console.error('Migration failed:', err.message))
  .finally(() => pool.end());
