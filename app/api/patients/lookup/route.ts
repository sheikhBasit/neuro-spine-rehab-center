import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/patients/lookup?phone=03XX...
// Returns past patient records sharing this phone number for identity pre-fill
export async function GET(req: Request) {
  try {
    await requireRole(['data_entry', 'admin'])
    const phone = new URL(req.url).searchParams.get('phone')?.trim()
    if (!phone || phone.length < 6) return NextResponse.json([])

    const rows = await sql`
      SELECT DISTINCT ON (cnic_bform, name) id, name, age, guardian_name, cnic_bform, phone, address
      FROM patients
      WHERE phone = ${phone}
      ORDER BY cnic_bform, name, check_in_at DESC
      LIMIT 10
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('[patients/lookup GET]', e)
    return authErrorResponse(e)
  }
}
