import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: full queue for today, emergencies first then by check-in time
export async function GET() {
  try {
    await requireRole(['admin', 'doctor', 'data_entry'])
    const patients = await sql`
      SELECT
        p.id, p.name, p.age, p.guardian_name, p.cnic_bform, p.phone, p.address,
        p.queue_number, p.is_emergency, p.status, p.check_in_at, p.seen_at,
        u.name AS doctor_name
      FROM patients p
      LEFT JOIN users u ON p.seen_by_doctor_id = u.id
      WHERE p.check_in_at::date = CURRENT_DATE
      ORDER BY p.is_emergency DESC, p.check_in_at ASC
    `
    return NextResponse.json(patients)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST: register a new patient and assign queue number
export async function POST(req: Request) {
  try {
    await requireRole(['data_entry', 'admin'])
    const { name, age, guardian_name, cnic_bform, phone, address, is_emergency } = await req.json()

    if (!name || !age || !phone || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Atomic queue number for today
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM patients WHERE check_in_at::date = CURRENT_DATE`
    const queue_number = parseInt(count) + 1

    const [patient] = await sql`
      INSERT INTO patients (name, age, guardian_name, cnic_bform, phone, address, queue_number, is_emergency)
      VALUES (${name}, ${parseInt(age)}, ${guardian_name || ''}, ${cnic_bform || ''},
              ${phone}, ${address}, ${queue_number}, ${!!is_emergency})
      RETURNING *
    `
    return NextResponse.json(patient, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
