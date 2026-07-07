/**
 * run-v5-both.js — Ejecuta v5_climate_adjustment.sql en staging y producción.
 * USO: DATABASE_URL=... DATABASE_URL_PROD=... node run-v5-both.js
 */
require('dotenv').config({ path: '.env.prod.local' });
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const stagingUrl = process.env.DATABASE_URL;
const prodUrl = process.env.DATABASE_URL_PROD;

async function runMigration(url, envName) {
  if (!url) {
    console.warn(`⚠️  ${envName}: URL no configurada, saltando.`);
    return;
  }
  const pool = new Pool({ connectionString: url });
  try {
    console.log(`\n▶ Running v5_climate_adjustment.sql on ${envName}...`);
    const sql = fs.readFileSync(path.join(__dirname, '../v5_climate_adjustment.sql'), 'utf-8');
    await pool.query(sql);
    console.log(`✔ Successfully ran on ${envName}`);
  } catch (error) {
    console.error(`✖ Failed on ${envName}:`, error.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await runMigration(stagingUrl, 'STAGING');
  await runMigration(prodUrl, 'PRODUCTION');
}

main();
