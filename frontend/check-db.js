/**
 * check-db.js — Verifica la existencia de tablas en staging y producción.
 * USO: DATABASE_URL=... DATABASE_URL_PROD=... node check-db.js
 * O: crea .env.prod.local con ambas URLs.
 */
require('dotenv').config({ path: '.env.prod.local' });
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const stagingUrl = process.env.DATABASE_URL;
const prodUrl = process.env.DATABASE_URL_PROD;

async function check(url, envName) {
  if (!url) {
    console.warn(`⚠️  ${envName}: URL no configurada, saltando.`);
    return;
  }
  const pool = new Pool({ connectionString: url });
  try {
    const res = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='climate_adjustment_snapshots'`);
    console.log(`${envName}: table exists = ${res.rows.length > 0}`);
  } catch (error) {
    console.error(`Failed on ${envName}:`, error.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await check(stagingUrl, 'STAGING');
  await check(prodUrl, 'PRODUCTION');
}

main();
