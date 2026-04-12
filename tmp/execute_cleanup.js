const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env') });

async function run() {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  // URL Encode special characters in the connection string if they exist
  // specifically '#' in the password which causes ERR_INVALID_URL
  if (connectionString.includes('#') && !connectionString.includes('%23')) {
    // We expect the format postgresql://user:pass@host:port/db
    // We find the part between ':' and '@' after 'postgresql://'
    const prefix = 'postgresql://';
    if (connectionString.startsWith(prefix)) {
      const rest = connectionString.substring(prefix.length);
      const atIdx = rest.lastIndexOf('@');
      const credentials = rest.substring(0, atIdx);
      const hostPart = rest.substring(atIdx + 1);
      
      const [user, ...passParts] = credentials.split(':');
      const pass = passParts.join(':'); // handles ':' in password if any
      
      const encodedPass = encodeURIComponent(pass);
      connectionString = `${prefix}${user}:${encodedPass}@${hostPart}`;
      console.log('Fixed DATABASE_URL encoding.');
    }
  }

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Google Cloud SQL.');

    const sqlPath = path.join(__dirname, '..', 'db_clean_for_testing.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing cleanup...');
    const res = await client.query(sql);
    
    console.log('--- RESULTS ---');
    const resultSets = Array.isArray(res) ? res : [res];
    const lastResult = resultSets[resultSets.length - 1];
    
    if (lastResult.rows && lastResult.rows.length > 0) {
      console.table(lastResult.rows);
    }
    console.log('--- SUCCESS ---');

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await client.end();
  }
}

run();
