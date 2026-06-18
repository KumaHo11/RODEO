require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
});
pool.query(`
  SELECT column_name, is_nullable, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'organizations' AND column_name = 'owner_id';
`).then(res => {
  console.log('organizations.owner_id:', res.rows[0]);
  return pool.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'id';
  `);
}).then(res => {
  console.log('profiles.id:', res.rows[0]);
  return pool.query(`
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'get_user_org_id';
  `);
}).then(res => {
  console.log('get_user_org_id:', res.rows[0]);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
