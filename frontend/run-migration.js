const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL });

const sql = fs.readFileSync('../v5_climate_adjustment.sql', 'utf8');

pool.query(sql)
  .then(() => console.log('Migration completed successfully!'))
  .catch(err => console.error('Migration failed:', err.message))
  .finally(() => pool.end());
