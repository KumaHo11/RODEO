
import { Pool } from 'pg';

const DATABASE_URL="postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo";

async function checkSchema() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'field_notes'
    `);
    console.log('Columns in field_notes:', JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
