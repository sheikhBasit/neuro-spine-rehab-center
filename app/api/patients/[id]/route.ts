import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin', 'doctor', 'data_entry'])
    const id = parseInt(params.id)

    const [patient] = await sql`
      SELECT p.*, u.name AS doctor_name
      FROM patients p LEFT JOIN users u ON p.seen_by_doctor_id = u.id
      WHERE p.id = ${id}
    `
    if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const documents = await sql`SELECT * FROM documents WHERE patient_id = ${id} ORDER BY uploaded_at`
    const prescriptions = await sql`
      SELECT pr.*, u.name AS doctor_name
      FROM prescriptions pr JOIN users u ON pr.doctor_id = u.id
      WHERE pr.patient_id = ${id} ORDER BY pr.created_at
    `

    return NextResponse.json({ ...patient, documents, prescriptions })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
