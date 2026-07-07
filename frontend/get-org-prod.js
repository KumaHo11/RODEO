/**
 * get-org-prod.js — Consulta perfiles y datos de organización en producción.
 * USO: DATABASE_URL_PROD=postgresql://... node get-org-prod.js
 */
require('dotenv').config({ path: '.env.prod.local' });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Set DATABASE_URL_PROD. Ejemplo: DATABASE_URL_PROD=postgresql://... node get-org-prod.js');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
    const res = await pool.query(`
      SELECT p.id as profile_id, p.organization_id, p.email
      FROM profiles p
      WHERE p.email LIKE '%javi.osorio%'
      LIMIT 10
    `);
    console.table(res.rows);
    
    for (const row of res.rows) {
      if (!row.organization_id) continue;
      const padRes = await pool.query(`SELECT id FROM paddocks WHERE org_id = $1 LIMIT 3`, [row.organization_id]);
      
      console.log("Org:", row.organization_id, "Paddocks:", padRes.rows.map(r=>r.id));
      
      // Let's insert some fake historical data for the last 5 days
      let count = 0;
      for (const pad of padRes.rows) {
        for (let i = 4; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          await pool.query(`
            INSERT INTO climate_adjustment_snapshots (
              org_id, paddock_id, ndvi, rainfall_7d_mm, humidity_pct,
              drought_index, forage_ms_ha, total_ev, grass_growth_rate,
              climate_multiplier, base_remaining_days, adjusted_remaining_days,
              alert_level, alert_message, delta_from_plan, multiplier_breakdown,
              calculated_at
            ) VALUES ($1, $2, $3, $4, $5, 'NONE', 1200, 10, $6, $7, 30, 25, 'ok', '', -5, '{}', $8)
          `, [
            row.organization_id,
            pad.id,
            0.45 + (Math.random() * 0.1),
            10 + (Math.random() * 5),
            60 + (Math.random() * 10),
            15 + (Math.random() * 2),
            1.1 + (Math.random() * 0.2),
            date.toISOString()
          ]);
          count++;
        }
      }
      console.log(`Inserted ${count} snapshots for org ${row.organization_id}`);
    }
  } catch(e) { console.error(e.stack); }
  await pool.end();
}
main();
