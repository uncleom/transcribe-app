import { readFileSync } from 'node:fs'

// The live database is not in GitHub. This checks the migration that closed
// the public credit functions still says they are revoked.

const sql = readFileSync(
  new URL('../supabase/migrations/20261007000000_lock_credit_grants.sql', import.meta.url),
  'utf8',
)

const functions = [
  'reserve_user_credits',
  'reserve_anon_credits',
  'adjust_user_credits',
  'adjust_anon_credits',
  'refund_user_credits',
  'refund_anon_credits',
]

if (!sql.includes("from public, anon, authenticated")) {
  console.error('Credit functions are not revoked from public, anon, and authenticated')
  process.exit(1)
}

for (const name of functions) {
  if (!sql.includes(`'${name}'`)) {
    console.error(`Missing ${name} in the credit lock`)
    process.exit(1)
  }
}

if (/grant execute on function[^;]*to (anon|authenticated|public)/i.test(sql)) {
  console.error('Credit lock grants execute to a public role')
  process.exit(1)
}

console.log('Credit lock is present')
