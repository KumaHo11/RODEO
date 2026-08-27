require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL });
pool.query(`
      SELECT
        ca.id, ca.paddock_id, ca.ndvi, ca.rainfall_7d_mm, ca.humidity_pct,
        ca.drought_index, ca.forage_ms_ha, ca.total_ev, ca.grass_growth_rate,
        ca.climate_multiplier, ca.base_remaining_days, ca.adjusted_remaining_days,
        ca.alert_level, ca.alert_message, ca.delta_from_plan,
        ca.multiplier_breakdown, ca.calculated_at,
        p.name AS paddock_name, p.area_ha
      FROM climate_adjustment_snapshots ca
      JOIN paddocks p ON p.id = ca.paddock_id
      WHERE ca.org_id = 'test'
      LIMIT 1
`).then(res => console.log('Success:', res.rows)).catch(err => console.error('DB Error:', err.message)).finally(() => pool.end());
