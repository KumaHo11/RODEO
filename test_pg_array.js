const { Pool } = require('pg');
require('dotenv').config({ path: 'frontend/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('postgresql://', 'http://'), // to make URL parsing work as in db.ts if needed, but pg usually takes postgresql:// fine
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const url = new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://'));
  const pool2 = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  });

  const res = await pool2.query("SELECT completed_tours FROM profiles LIMIT 1");
  console.log(res.rows[0]);
  console.log("Is Array?", Array.isArray(res.rows[0]?.completed_tours));
  process.exit(0);
}
main();
