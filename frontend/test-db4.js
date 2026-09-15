const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
const url = new URL(connectionString.replace('postgresql://', 'http://'));

const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1).split('?')[0],
  ssl: false,
});

pool.query('SELECT 1 as result', (err, res) => {
  if (err) console.error('DB error:', err.message);
  else console.log('DB success:', res.rows);
  pool.end();
});
