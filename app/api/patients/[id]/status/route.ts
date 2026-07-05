import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH: doctor calls patient (in_progress) or marks done
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(['doctor', 'admin'])
    const { status } = await req.json()
    const id = parseInt(params.id)

    if (!['in_progress', 'done', 'waiting'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const [patient] = await sql`
      UPDATE patients SET
        status = ${status},
        seen_by_doctor_id = CASE WHEN ${status} = 'in_progress' THEN ${session.id} ELSE seen_by_doctor_id END,
        seen_at = CASE WHEN ${status} = 'in_progress' AND seen_at IS NULL THEN NOW() ELSE seen_at END
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(patient)
  } catch (e) {
    console.error('[patients/status PATCH]', e)
    return authErrorResponse(e)
  }
}
