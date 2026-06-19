const { Client } = require('pg');

async function setSuperadmin() {
  const email = process.argv[2] || 'superadmin@rodeo.app';
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Falla: Debes definir la variable de entorno DATABASE_URL');
    console.error('Ejemplo: DATABASE_URL="postgresql://rodeo_admin:password@host/db" node set_superadmin_prod.js superadmin@rodeo.app');
    process.exit(1);
  }
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    const res = await client.query('SELECT id, role FROM profiles WHERE email = $1', [email]);
    
    if (res.rows.length > 0) {
      await client.query('UPDATE profiles SET role = $1 WHERE email = $2', ['superadmin', email]);
      console.log(`✅ Usuario ${email} promovido a superadmin exitosamente en la base de datos de producción.`);
    } else {
      console.log(`❌ No se encontró el usuario ${email} en la tabla profiles.`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

setSuperadmin();
