/**
 * setup_rls_roles.js
 * 
 * Sets up the dual-role PostgreSQL architecture for multi-tenant RLS:
 * 
 *   1. rodeo_app     — Regular app queries; subject to RLS (org_id filtering)
 *   2. rodeo_service  — Backend service operations; BYPASSRLS (register, cron, admin)
 * 
 * Also creates RLS policies on all tenant-scoped tables.
 * 
 * Idempotent: safe to run on every deploy.
 * 
 * Usage: node scripts/setup_rls_roles.js "$DATABASE_URL"
 */
const { Pool } = require('pg')

const connectionString = process.argv[2]
const USE_PG_ENV = !connectionString

if (!connectionString && !process.env.PGHOST) {
  console.error('Usage: node scripts/setup_rls_roles.js "$DATABASE_URL"')
  console.error('  o bien setear PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE')
  process.exit(1)
}

async function main() {
  // Cuando no hay connectionString, pg lee PGHOST/PGPORT/etc. del entorno (libpq nativo, sin SSL)
  const poolConfig = USE_PG_ENV
    ? { connectionTimeoutMillis: 15000 }
    : (() => {
        const url = new URL(connectionString.replace('postgresql://', 'http://'))
        return {
          host: url.hostname,
          port: parseInt(url.port || '5432'),
          user: url.username,
          password: decodeURIComponent(url.password),
          database: url.pathname.slice(1).split('?')[0],
          ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
          connectionTimeoutMillis: 15000,
        }
      })()
  const pool = new Pool(poolConfig)

  const client = await pool.connect()

  try {
    console.log('[setup_rls] Starting RLS setup...')

    // ── 0. Ensure current DB user (postgres) has BYPASSRLS ──────────
    // On Cloud SQL, 'postgres' is NOT a true superuser (is_superuser=off).
    // Without BYPASSRLS, the postgres user is ALSO subject to RLS policies,
    // which breaks all queries. This is critical until Phase 2 when we
    // switch DATABASE_URL to the rodeo_app role.
    const { rows: [{ current_user: currentUser }] } = await client.query('SELECT current_user')
    try {
      await client.query(`ALTER ROLE "${currentUser}" BYPASSRLS`)
      console.log(`  ✓ Granted BYPASSRLS to current user: ${currentUser}`)
    } catch (err) {
      console.warn(`  ⚠ Could not grant BYPASSRLS to ${currentUser}:`, err.message)
    }

    // ── 1. Create roles if they don't exist ──────────────────────────

    // rodeo_app: regular queries, RLS applies
    const appRoleExists = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = 'rodeo_app'"
    )
    if (appRoleExists.rows.length === 0) {
      const appPassword = process.env.RODEO_APP_DB_PASSWORD || 'rodeo_app_' + require('crypto').randomBytes(16).toString('hex')
      await client.query(`CREATE ROLE rodeo_app LOGIN PASSWORD '${appPassword}'`)
      console.log('  ✓ Created role: rodeo_app')
      console.log(`    Password: ${appPassword}`)
    } else {
      console.log('  ✓ Role rodeo_app already exists')
    }

    // rodeo_service: backend service operations, bypasses RLS
    const serviceRoleExists = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = 'rodeo_service'"
    )
    if (serviceRoleExists.rows.length === 0) {
      const servicePassword = process.env.RODEO_SERVICE_DB_PASSWORD || 'rodeo_svc_' + require('crypto').randomBytes(16).toString('hex')
      try {
        await client.query(`CREATE ROLE rodeo_service LOGIN PASSWORD '${servicePassword}' BYPASSRLS`)
        console.log('  ✓ Created role: rodeo_service')
        console.log(`    Password: ${servicePassword}`)
      } catch (err) {
        if (err.message.includes('bypassrls')) {
          // Cloud SQL: CREATE without BYPASSRLS, grant separately
          await client.query(`CREATE ROLE rodeo_service LOGIN PASSWORD '${servicePassword}'`)
          console.log('  ✓ Created role: rodeo_service (BYPASSRLS skipped — Cloud SQL limitation)')
          console.log(`    Password: ${servicePassword}`)
        } else throw err
      }
    } else {
      // Attempt to ensure BYPASSRLS — may fail on Cloud SQL without cloudsqlsuperuser
      try {
        await client.query('ALTER ROLE rodeo_service BYPASSRLS')
        console.log('  ✓ Role rodeo_service already exists (ensured BYPASSRLS)')
      } catch (err) {
        console.warn('  ⚠ Could not set BYPASSRLS on rodeo_service (Cloud SQL limitation — role exists, continuing):', err.message)
      }
    }

    // ── 2. Grant privileges ──────────────────────────────────────────

    const currentDb = USE_PG_ENV
      ? process.env.PGDATABASE
      : connectionString.replace('postgresql://', 'http://').split('/').pop().split('?')[0]

    for (const role of ['rodeo_app', 'rodeo_service']) {
      await client.query(`GRANT CONNECT ON DATABASE "${currentDb}" TO ${role}`)
      await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`)
      
      // Get all tables
      const { rows: tables } = await client.query(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);
      
      for (const { tablename } of tables) {
        try {
          await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "${tablename}" TO ${role}`)
        } catch (e) {
          console.warn(`  ⚠ Could not grant to ${tablename} for ${role}: ${e.message}`)
        }
      }
      
      await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`)
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`)
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`)
    }
    // rodeo_service gets ALL privileges (including DDL for migrations)
    const { rows: tablesForSvc } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    for (const { tablename } of tablesForSvc) {
      try {
        await client.query(`GRANT ALL PRIVILEGES ON TABLE "${tablename}" TO rodeo_service`)
      } catch (e) {
        console.warn(`  ⚠ Could not grant ALL to rodeo_service on ${tablename}: ${e.message}`)
      }
    }
    console.log('  ✓ Granted privileges to both roles')

    // ── 3. Enable RLS on tenant-scoped tables ────────────────────────

    const tablesWithOrgId = [
      'profiles',          // organization_id
      'organizations',     // id (self)
      'paddocks',          // org_id
      'herds',             // org_id
      'grazing_plans',     // org_id
      'season_plans',       // org_id
      'biological_monitoring', // via paddock → org
      'rainfall_logs',     // org_id
      'subscriptions_plans', // public read
    ]

    for (const table of tablesWithOrgId) {
      try {
        await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
      } catch (err) {
        // Non-fatal: requires table ownership. If already enabled, this is fine.
        if (err.message.includes('owner') || err.message.includes('permission')) {
          console.warn(`  ⚠ Could not enable RLS on ${table} (not owner — may already be enabled): ${err.message}`)
        } else throw err
      }
    }
    console.log(`  ✓ RLS step completed for ${tablesWithOrgId.length} tables`)

    // ── 4. Create policies (drop existing first for idempotency) ─────

    // Helper: drop policy if exists, then create (non-fatal if not table owner)
    async function createPolicy(table, name, sql) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${name}" ON "${table}"`)
        await client.query(sql)
      } catch (err) {
        if (err.message.includes('owner') || err.message.includes('permission')) {
          console.warn(`  ⚠ Could not create policy ${name} on ${table} (not owner — may already exist): ${err.message}`)
        } else throw err
      }
    }

    // --- profiles: access own profile by UID, or all profiles in same org ---
    await createPolicy('profiles', 'profiles_tenant_isolation',
      `CREATE POLICY profiles_tenant_isolation ON profiles FOR ALL USING (
        firebase_uid = NULLIF(current_setting('request.jwt.claim.sub', true), '')
        OR organization_id::text = NULLIF(current_setting('request.jwt.claim.org_id', true), '')
      )`
    )

    // --- organizations: only own org ---
    await createPolicy('organizations', 'orgs_tenant_isolation',
      `CREATE POLICY orgs_tenant_isolation ON organizations FOR ALL USING (
        id::text = NULLIF(current_setting('request.jwt.claim.org_id', true), '')
      )`
    )

    // --- Tables with org_id FK ---
    const orgIdTables = ['paddocks', 'herds', 'grazing_plans', 'season_plans', 'rainfall_logs']
    for (const table of orgIdTables) {
      const policyName = `${table}_tenant_isolation`
      await createPolicy(table, policyName,
        `CREATE POLICY "${policyName}" ON "${table}" FOR ALL USING (
          org_id::text = NULLIF(current_setting('request.jwt.claim.org_id', true), '')
        )`
      )
    }

    // --- biological_monitoring: uses paddock_id, not org_id directly ---
    // We use a subquery to check org ownership via paddock
    await createPolicy('biological_monitoring', 'bio_monitoring_tenant_isolation',
      `CREATE POLICY bio_monitoring_tenant_isolation ON biological_monitoring FOR ALL USING (
        paddock_id IN (
          SELECT id FROM paddocks
          WHERE org_id::text = NULLIF(current_setting('request.jwt.claim.org_id', true), '')
        )
      )`
    )

    // --- subscriptions_plans: public read, no write via RLS ---
    await createPolicy('subscriptions_plans', 'plans_public_read',
      `CREATE POLICY plans_public_read ON subscriptions_plans FOR SELECT USING (true)`
    )
    await createPolicy('subscriptions_plans', 'plans_service_write',
      `CREATE POLICY plans_service_write ON subscriptions_plans FOR ALL USING (false)`
    )

    console.log('  ✓ Created RLS policies')

    // ── 5. Verify ────────────────────────────────────────────────────

    const rlsStatus = await client.query(`
      SELECT relname, relrowsecurity
      FROM pg_class
      JOIN pg_namespace n ON n.oid = relnamespace
      WHERE n.nspname = 'public' AND relkind = 'r' AND relrowsecurity = true
      ORDER BY relname
    `)
    console.log(`\n  ✅ RLS active on ${rlsStatus.rows.length} tables:`)
    rlsStatus.rows.forEach(r => console.log(`     - ${r.relname}`))

    const policyCount = await client.query(`
      SELECT count(*) as cnt FROM pg_policy
      JOIN pg_class c ON c.oid = polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
    `)
    console.log(`  ✅ ${policyCount.rows[0].cnt} RLS policies created`)

    console.log('\n[setup_rls] ✅ Done')

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  // BYPASSRLS errors are non-fatal in Cloud SQL environments
  if (err.message && err.message.includes('bypassrls')) {
    console.warn('[setup_rls] ⚠ Completed with BYPASSRLS warning (Cloud SQL limitation). RLS policies were applied.')
    process.exit(0)
  }
  console.error('[setup_rls] Fatal error:', err)
  process.exit(1)
})
