
import { Pool } from 'pg';

const DATABASE_URL="postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo";

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    console.log('Adding audio_duration_secs to field_notes...');
    await pool.query('ALTER TABLE field_notes ADD COLUMN IF NOT EXISTS audio_duration_secs INTEGER');
    console.log('Success.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
