const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function setSuperadmin() {
  const email = process.argv[2] || 'superadmin@rodeo.app';
  
  const connectionString = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Set DATABASE_URL_SERVICE or DATABASE_URL in .env.local');
    process.exit(1);
  }
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Buscar si existe en profiles
    const res = await client.query('SELECT id, role FROM profiles WHERE email = $1', [email]);
    
    if (res.rows.length > 0) {
      await client.query('UPDATE profiles SET role = $1 WHERE email = $2', ['superadmin', email]);
      console.log(`✅ Usuario ${email} promovido a superadmin exitosamente.`);
    } else {
      console.log(`❌ No se encontró el usuario ${email} en la tabla profiles.`);
      console.log(`Por favor, regístrate primero en la aplicación usando ese correo y vuelve a ejecutar este script.`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

setSuperadmin();
