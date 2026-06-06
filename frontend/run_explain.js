const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const orgIdRes = await pool.query('SELECT id FROM organizations LIMIT 1');
    if (orgIdRes.rows.length === 0) return console.log('No orgs');
    const orgId = orgIdRes.rows[0].id;
    
    console.log(`Explaining query for org: ${orgId}`);
    
    const query = `
      EXPLAIN ANALYZE
      SELECT
         gp.id, gp.org_id, gp.paddock_id, gp.herd_id, gp.herd_ids,
         TO_CHAR(gp.entry_date, 'YYYY-MM-DD') AS entry_date,
         TO_CHAR(gp.exit_date,  'YYYY-MM-DD') AS exit_date,
         gp.is_locked, gp.closing_stock,
         gp.planned_recovery_days, gp.status, gp.temporary_animals,
         gp.notes, gp.exit_notes, gp.exit_dry_matter_kg_ha,
         gp.ai_analysis, gp.created_at, gp.updated_at,
         COALESCE(gp.plan_type, 'manual') AS plan_type,
         COALESCE(gp.source_origin, 'human') AS source_origin,
         gp.cycle_id,
         json_build_object('id', p.id, 'name', p.name, 'area_ha', p.area_ha) AS paddocks,
         CASE WHEN h.id IS NOT NULL
           THEN json_build_object('id', h.id, 'name', h.name, 'head_count', h.head_count, 'total_ev', h.total_ev)
           ELSE NULL
         END AS herds
       FROM grazing_plans gp
       JOIN paddocks p ON p.id = gp.paddock_id
       LEFT JOIN herds h ON h.id = gp.herd_id
       WHERE p.org_id = $1
       ORDER BY gp.entry_date ASC
    `;
    const res = await pool.query(query, [orgId]);
    console.log(res.rows.map(r => r['QUERY PLAN']).join('\n'));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
