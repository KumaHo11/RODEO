require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

async function run() {
  const dbUrl = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('No DATABASE_URL found in .env.local');
    process.exit(1);
  }

  const url = new URL(dbUrl.replace('postgresql://', 'http://'));
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Aplicando fix en tabla organizations...');
    await pool.query('ALTER TABLE organizations ALTER COLUMN owner_id DROP NOT NULL;');
    console.log('✅ organizations.owner_id modificado a nullable.');

    console.log('Aplicando fix en tabla profiles...');
    await pool.query('ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();');
    console.log('✅ profiles.id configurado con DEFAULT uuid_generate_v4().');

    console.log('Aplicando fix en función get_user_org_id...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_user_org_id()
      RETURNS UUID AS $$
          SELECT NULLIF(current_setting('request.jwt.claim.org_id', true), '')::UUID;
      $$ LANGUAGE SQL SECURITY DEFINER;
    `);
    console.log('✅ get_user_org_id actualizada para usar request.jwt.claim.org_id.');

    console.log('🎉 Todas las correcciones de BD aplicadas exitosamente.');
  } catch (err) {
    console.error('❌ Error aplicando correcciones:', err);
  } finally {
    await pool.end();
  }
}

run();
