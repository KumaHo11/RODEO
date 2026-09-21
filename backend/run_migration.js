/**
 * run_migration.js
 * Executes a SQL migration file against the RODEO database using the pg driver.
 * Usage: node run_migration.js <path_to_sql_file>
 */
require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node run_migration.js <path_to_sql_file>')
  process.exit(1)
}

const sqlPath = path.resolve(sqlFile)
if (!fs.existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`)
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

;(async () => {
  console.log(`\n📦 Running migration: ${path.basename(sqlPath)}`)
  console.log(`🔗 DB: ${process.env.DATABASE_URL?.replace(/:.*@/, ':***@')}\n`)
  try {
    await pool.query(sql)
    console.log('✅ Migration completed successfully!')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
})()
