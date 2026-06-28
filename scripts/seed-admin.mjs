// One-time admin seeder.
// Usage: node --env-file=.env.local scripts/seed-admin.mjs

import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Administrator' } = process.env

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing DATABASE_URL, ADMIN_EMAIL, or ADMIN_PASSWORD in .env.local')
  process.exit(1)
}

const sql = neon(DATABASE_URL)
const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)

await sql`
  INSERT INTO users (role, name, email, password_hash)
  VALUES ('admin', ${ADMIN_NAME}, ${ADMIN_EMAIL}, ${hash})
  ON CONFLICT (email) DO NOTHING
`
console.log('✓ Admin seeded:', ADMIN_EMAIL)
process.exit(0)
