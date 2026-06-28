import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: admin fetches all attendance (today by default, or ?date=YYYY-MM-DD)
export async function GET(req: Request) {
  try {
    await requireRole(['admin'])
    const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const rows = await sql`
      SELECT a.*, u.name AS doctor_name, u.speciality
      FROM attendance a
      JOIN users u ON a.doctor_id = u.id
      WHERE a.date = ${date}::date
      ORDER BY a.shift_start ASC
    `
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// POST: doctor starts a shift
export async function POST() {
  try {
    const session = await requireRole(['doctor', 'admin'])
    // Only one active record per doctor per day
    const [existing] = await sql`
      SELECT id FROM attendance WHERE doctor_id = ${session.id} AND date = CURRENT_DATE LIMIT 1
    `
    if (existing) return NextResponse.json(existing)

    const [record] = await sql`
      INSERT INTO attendance (doctor_id, date, shift_start, breaks)
      VALUES (${session.id}, CURRENT_DATE, NOW(), '[]'::jsonb)
      RETURNING *
    `
    return NextResponse.json(record, { status: 201 })
  } catch (e) {
    console.error('[attendance POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
