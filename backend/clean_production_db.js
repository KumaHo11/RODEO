/**
 * clean_production_db.js
 * Elimina completamente los datos de todos los usuarios en PRODUCCIÓN, excepto:
 *   - superadmin@rodeo.app
 *
 * USO: DATABASE_URL_PROD=postgresql://... node clean_production_db.js
 * O bien: crea frontend/.env.prod.local con DATABASE_URL_PROD=...
 */

const path = require('path');
// Try loading from .env.prod.local (never committed)
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.prod.local') });

const { Client } = require('pg');

const EXCLUDED_EMAILS = [
  'superadmin@rodeo.app'
];

async function cleanDB(client) {
  console.log('\nObteniendo correos electrónicos de perfiles a borrar en PRODUCCIÓN...');
  // Obtener usuarios que no están en la lista de excluidos
  const emailsRes = await client.query('SELECT email FROM profiles WHERE email != ALL($1::text[]) AND email IS NOT NULL', [EXCLUDED_EMAILS]);
  const emailsToWipe = emailsRes.rows.map(r => r.email);
  
  if (emailsToWipe.length === 0) {
    console.log('No hay usuarios adicionales para limpiar en SQL.');
  } else {
    console.log(`Se encontraron ${emailsToWipe.length} perfiles para eliminar en SQL.`);
  }

  for (const email of emailsToWipe) {
    console.log(`\n  Procesando: ${email}`);
    const profileRes = await client.query(
      'SELECT id, organization_id FROM profiles WHERE email = $1', [email]
    );
    if (profileRes.rows.length === 0) {
      console.log(`     Sin perfil SQL — nada que borrar`);
      continue;
    }
    const { id: profileId, organization_id: orgId } = profileRes.rows[0];
    console.log(`     Profile ID: ${profileId} | Org ID: ${orgId || 'sin org'}`);

    if (orgId) {
      const steps = [
        ['audit_logs',            `WHERE org_id = '${orgId}'`],
        ['grazing_plans',         `WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = '${orgId}')`],
        ['farm_events',           `WHERE org_id = '${orgId}'`],
        ['tasks',                 `WHERE org_id = '${orgId}'`],
        ['field_notes',           `WHERE org_id = '${orgId}'`],
        ['season_plans',          `WHERE org_id = '${orgId}' OR created_by IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['grazing_tracks',        `WHERE org_id = '${orgId}'`],
        ['movements',             `WHERE org_id = '${orgId}'`],
        ['historial_potrero',     `WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = '${orgId}')`],
        ['herds',                 `WHERE org_id = '${orgId}'`],
        ['paddocks',              `WHERE org_id = '${orgId}'`],
        ['team_invitations',      `WHERE org_id = '${orgId}'`],
        ['notifications',         `WHERE user_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['impersonation_sessions',`WHERE target_user_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}') OR admin_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['user_terms_acceptances',`WHERE profile_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['profiles',              `WHERE organization_id = '${orgId}'`],
        ['organizations',         `WHERE id = '${orgId}'`],
      ];
      for (const [table, condition] of steps) {
        try {
          const res = await client.query(`DELETE FROM ${table} ${condition}`);
          if (res.rowCount > 0) console.log(`     ${table}: ${res.rowCount} fila(s) eliminada(s)`);
        } catch (e) {
          if (!e.message.includes('does not exist')) {
            console.warn(`     WARN ${table}: ${e.message}`);
          }
        }
      }
    } else {
      await client.query(`DELETE FROM season_plans WHERE created_by = $1`, [profileId]).catch(() => {});
      await client.query(`DELETE FROM user_terms_acceptances WHERE profile_id = $1`, [profileId]).catch(() => {});
      await client.query(`DELETE FROM impersonation_sessions WHERE target_user_id = $1 OR admin_id = $1`, [profileId]).catch(() => {});
      await client.query(`DELETE FROM notifications WHERE user_id = $1`, [profileId]).catch(() => {});
      await client.query(`DELETE FROM profiles WHERE id = $1`, [profileId]);
      console.log(`     Perfil huerfano eliminado`);
    }
  }
  console.log('\nLimpieza SQL completada');
  return emailsToWipe;
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ ERROR: Set DATABASE_URL_PROD environment variable.');
    console.error('   Ejemplo: DATABASE_URL_PROD=postgresql://user:pass@host:5432/db node clean_production_db.js');
    process.exit(1);
  }

  console.log('Iniciando limpieza de todos los usuarios en PRODUCCIÓN exceptuando a Super Admin...');
  console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const emailsToWipe = await cleanDB(client);
    console.log('\nLimpieza de DB completa. NOTA: Firebase no fue tocado, debe limpiarse manualmente.');
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
