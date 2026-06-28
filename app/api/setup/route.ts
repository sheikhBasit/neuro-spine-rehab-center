import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { bcrypt } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key')
  if (!process.env.SETUP_KEY || key !== process.env.SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!sql) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 })
  }

  const log: string[] = []

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('admin','doctor','data_entry')),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT DEFAULT '',
        cnic TEXT DEFAULT '',
        license_no TEXT DEFAULT '',
        speciality TEXT DEFAULT '',
        qualification TEXT DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    log.push('✓ users table')

    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        age INT NOT NULL,
        guardian_name TEXT DEFAULT '',
        cnic_bform TEXT DEFAULT '',
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        queue_number INT NOT NULL,
        is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','done')),
        seen_by_doctor_id INT REFERENCES users(id),
        check_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        seen_at TIMESTAMPTZ
      )
    `
    log.push('✓ patients table')

    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    log.push('✓ documents table')

    await sql`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id SERIAL PRIMARY KEY,
        patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id INT NOT NULL REFERENCES users(id),
        medicines JSONB,
        image_url TEXT,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    log.push('✓ prescriptions table')

    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        doctor_id INT NOT NULL REFERENCES users(id),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        shift_start TIMESTAMPTZ,
        shift_end TIMESTAMPTZ,
        breaks JSONB DEFAULT '[]'::jsonb,
        total_minutes INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    log.push('✓ attendance table')

    await sql`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('consumable','permanent')),
        category TEXT DEFAULT '',
        quantity INT NOT NULL DEFAULT 0,
        unit TEXT DEFAULT '',
        expiry_date DATE,
        status TEXT CHECK (status IN ('active','inactive')),
        notes TEXT DEFAULT '',
        added_by INT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    log.push('✓ inventory_items table')

    // Payment columns (idempotent — IF NOT EXISTS per column)
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash'`
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(10,2) DEFAULT 0`
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS discount    NUMERIC(10,2) DEFAULT 0`
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0`
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS change_due  NUMERIC(10,2) DEFAULT 0`
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'`
    log.push('✓ payment columns on patients')
    await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male'`
    log.push('✓ gender column on patients')

    const adminEmail = 'admin@admin.com'
    const adminPassword = 'admin123'
    const [existing] = await sql`SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1`
    if (!existing) {
      const hash = await bcrypt.hash(adminPassword, 12)
      await sql`
        INSERT INTO users (role, name, email, password_hash)
        VALUES ('admin', 'Administrator', ${adminEmail}, ${hash})
      `
      log.push('✓ admin user seeded (admin@admin.com / admin123)')
    } else {
      log.push('✓ admin user already exists')
    }

    return NextResponse.json({ ok: true, log })
  } catch (e) {
    console.error('[setup] Error:', e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), log }, { status: 500 })
  }
}
