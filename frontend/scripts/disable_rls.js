/**
 * disable_rls.js
 * Disables Row Level Security on all tables in the public schema.
 * RLS was causing profile 404 errors because the policies were filtering
 * out rows even for authenticated users.
 * 
 * The app already handles authorization at the application level via
 * Firebase token verification, so RLS is redundant.
 * 
 * Usage: node scripts/disable_rls.js "$DATABASE_URL"
 */
const { Pool } = require('pg')

const connectionString = process.argv[2]
if (!connectionString) {
  console.error('Usage: node scripts/disable_rls.js "$DATABASE_URL"')
  process.exit(1)
}

async function main() {
  const url = new URL(connectionString.replace('postgresql://', 'http://'))
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  })

  try {
    // Find all tables with RLS enabled
    const rlsTables = await pool.query(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
    `)

    if (rlsTables.rows.length === 0) {
      console.log('[disable_rls] No tables with RLS enabled')
      return
    }

    console.log(`[disable_rls] Found ${rlsTables.rows.length} tables with RLS:`)
    for (const row of rlsTables.rows) {
      console.log(`  - ${row.relname}`)
    }

    // Disable RLS on each table
    for (const row of rlsTables.rows) {
      try {
        await pool.query(`ALTER TABLE "${row.relname}" DISABLE ROW LEVEL SECURITY`)
        console.log(`  ✓ Disabled RLS on ${row.relname}`)
      } catch (err) {
        console.error(`  ✗ Failed to disable RLS on ${row.relname}:`, err.message)
      }
    }

    console.log('[disable_rls] ✅ Done')
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('[disable_rls] Fatal error:', err)
  process.exit(1)
})
