const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: 'RodeoProd2026New!',
  database: 'rodeo_main'
});

async function main() {
  try {
    const aiGrass = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'paddocks' OR table_name = 'biological_monitoring'`);
    const aiBCS = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'herds' OR table_name = 'animals'`);
    
    // Check what tables might have "ai" or "photo" or "bcs" in their names
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log("Tables:", tables.rows.map(r => r.table_name).join(', '));
    console.log("AI Grass Columns:", aiGrass.rows.map(r => r.column_name).join(', '));
    console.log("AI BCS Columns:", aiBCS.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
