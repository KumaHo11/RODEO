/**
 * run_migration.js — Corre una migración SQL usando el usuario postgres (owner de las tablas)
 * 
 * Uso: node run_migration.js <archivo.sql>
 * 
 * Prueba múltiples combinaciones de usuario/contraseña hasta encontrar una que funcione.
 */
const { Client } = require('pg');
const fs = require('fs');

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Uso: node run_migration.js <archivo.sql>');
  process.exit(1);
}

// Candidatos en orden de preferencia
const CANDIDATES = [
  // postgres superuser local (sin contraseña — auth por peer/trust)
  'postgresql://postgres@127.0.0.1:5432/rodeo',
  'postgresql://postgres@localhost:5432/rodeo',
  // rodeo_app con contraseña de staging
  'postgresql://rodeo_app:rodeo_app_staging_pass_123@127.0.0.1:5432/rodeo',
];

async function tryConnect(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  await client.connect();
  return client;
}

async function run() {
  const sql = fs.readFileSync(sqlFile, 'utf-8');
  console.log(`📄 Migración: ${sqlFile}`);

  for (const url of CANDIDATES) {
    const safeUrl = url.replace(/:([^:@\/]+)@/, ':***@');
    process.stdout.write(`🔌 Intentando: ${safeUrl} ... `);
    let client;
    try {
      client = await tryConnect(url);
      console.log('✅ conectado');
      await client.query(sql);
      console.log('✅ Migración aplicada correctamente.');
      await client.end();
      return;
    } catch (e) {
      console.log(`❌ ${e.message.split('\n')[0]}`);
      if (client) { try { await client.end() } catch {} }
    }
  }

  console.error('\n❌ No se pudo conectar con ningún usuario.');
  console.error('   Opciones:');
  console.error('   1. Asegurate de que el proxy de Cloud SQL esté corriendo (start_proxy_staging.sh)');
  console.error('   2. Correla directamente con: PGPASSWORD=<pass> psql -U postgres -h 127.0.0.1 -d rodeo -f ' + sqlFile);
  process.exit(1);
}

run();
