const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query("ALTER TABLE farm_events ADD COLUMN photo_url TEXT;");
    console.log("Added photo_url");
  } catch(e) { console.log(e.message) }
  
  try {
    await pool.query("ALTER TABLE farm_events ADD COLUMN audio_url TEXT;");
    console.log("Added audio_url");
  } catch(e) { console.log(e.message) }
  
  // also verify field_notes just in case
  try {
    await pool.query("ALTER TABLE field_notes ADD COLUMN audio_url TEXT;");
    console.log("Added audio_url to field_notes");
  } catch(e) { console.log(e.message) }
  
  try {
    await pool.query("ALTER TABLE field_notes ADD COLUMN photo_url TEXT;");
    console.log("Added photo_url to field_notes");
  } catch(e) { console.log(e.message) }
}

run().finally(() => pool.end());
