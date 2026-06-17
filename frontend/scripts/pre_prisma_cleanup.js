/**
 * pre_prisma_cleanup.js
 * 
 * Drops legacy constraints and columns that Prisma can't handle automatically
 * with `prisma db push`. Run BEFORE `prisma db push --accept-data-loss`.
 * 
 * Uso: node scripts/pre_prisma_cleanup.js <DATABASE_URL>
 */
const { Client } = require('pg')

const DB_URL = process.argv[2] || process.env.DATABASE_URL
if (!DB_URL) {
  console.error('Uso: node scripts/pre_prisma_cleanup.js <DATABASE_URL>')
  process.exit(1)
}

const CLEANUP_SQL = `
-- ──────────────────────────────────────────────────────────────────────────────
-- Drop legacy constraints that block Prisma db push
-- These are unique constraints on columns that no longer exist in the schema
-- ──────────────────────────────────────────────────────────────────────────────

-- organizations.slug was removed from schema but the unique constraint remains
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organizations_slug_key' 
    AND table_name = 'organizations' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE organizations DROP CONSTRAINT organizations_slug_key;
    RAISE NOTICE 'Dropped constraint: organizations_slug_key';
  END IF;
END $$;

-- Also drop the slug column if it exists (was removed from schema)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'slug' AND table_schema = 'public'
  ) THEN
    ALTER TABLE organizations DROP COLUMN slug;
    RAISE NOTICE 'Dropped column: organizations.slug';
  END IF;
END $$;
`

async function main() {
  const client = new Client({ connectionString: DB_URL })
  try {
    await client.connect()
    console.log('[pre_prisma_cleanup] Connected to database')
    await client.query(CLEANUP_SQL)
    console.log('[pre_prisma_cleanup] ✓ Legacy constraints cleaned up')
  } catch (err) {
    console.error('[pre_prisma_cleanup] Error:', err.message)
    // Don't fail the pipeline — Prisma will show the actual error if needed
    process.exit(0)
  } finally {
    await client.end()
  }
}

main()
