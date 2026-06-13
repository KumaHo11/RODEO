const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const STAGING_DB = "postgresql://neondb_owner:npg_1sZ9gQWIdMle@ep-blue-breeze-a8e52l1y-pooler.eastus2.azure.neon.tech/neondb?sslmode=require";
const PROD_DB = "postgresql://postgres:RodeoDB2026Secure@34.95.227.181:5432/rodeo_main";

async function executeSqlFiles(connectionString, files) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const file of files) {
      console.log(`Executing ${file}...`);
      const sql = fs.readFileSync(path.join('/Users/javi/RODEO', file), 'utf8');
      
      const fileClient = new Client({ connectionString });
      await fileClient.connect();
      try {
        await fileClient.query(sql);
      } catch (e) {
        console.error(`Error in ${file}: ${e.message}`);
      } finally {
        await fileClient.end();
      }
      console.log(`Finished ${file}`);
    }
  } finally {
    await client.end();
  }
}

async function run() {
  try {
    console.log("Pushing Prisma schema to initialize DB...");
    execSync('npx prisma db push --skip-generate --accept-data-loss', { 
      cwd: '/Users/javi/RODEO/frontend', 
      env: { ...process.env, DATABASE_URL: PROD_DB },
      stdio: 'inherit' 
    });

    console.log("Executing Admin and Pricing inserts...");
    const files = [
      'admin_schema_migration.sql',
      'pricing_strategy_migration.sql'
    ];

    await executeSqlFiles(PROD_DB, files);

    console.log("DB Populated successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Fatal Error:", e);
    process.exit(1);
  }
}

run();
