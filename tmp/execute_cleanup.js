const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo' });

async function fullClean() {
  console.log('--- RODEO DEEP CLEAN START ---');
  try {
    // 1. Operational data (likely covered by cascade but better be safe)
    const operationalTables = [
      'farm_events',
      'tasks',
      'field_notes',
      'notifications',
      'grazing_plans',
      'biological_monitoring',
      'rainfall_logs',
      'payments'
    ];
    
    for (const table of operationalTables) {
      try {
        await pool.query(`DELETE FROM ${table} WHERE TRUE`);
        console.log(`- Cleared ${table}`);
      } catch (e) {
        console.log(`- Skipping ${table} (might not exist or already cleared)`);
      }
    }

    // 2. Core structural data
    console.log('- Wiping core structure (Profiles, Orgs, Teams) with CASCADE...');
    await pool.query('TRUNCATE profiles CASCADE;');
    await pool.query('TRUNCATE organizations CASCADE;');
    await pool.query('TRUNCATE team_invitations CASCADE;');
    
    console.log('✅ DATABASE WIPE COMPLETE');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fullClean();
