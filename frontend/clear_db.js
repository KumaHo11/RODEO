const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    const sql = fs.readFileSync('../db_clean_for_testing.sql', 'utf8');
    await client.query(sql);
    console.log("Database cleared successfully.");
  } catch (err) {
    console.error("Error clearing DB:", err);
  } finally {
    await client.end();
  }
}

main();
