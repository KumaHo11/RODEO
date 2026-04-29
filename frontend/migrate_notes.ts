import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in the environment variables');
}

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
