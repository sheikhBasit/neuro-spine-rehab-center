import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin', 'doctor', 'data_entry'])
    const id = parseInt(params.id)

    const [patient] = await sql`
      SELECT p.*, u.name AS doctor_name
      FROM patients p LEFT JOIN users u ON p.seen_by_doctor_id = u.id
      WHERE p.id = ${id}`
    if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const documents = await sql`SELECT * FROM documents WHERE patient_id = ${id} ORDER BY uploaded_at`

    // Previous-visit documents: same phone, different visit, uploaded in last 6 months
    const previousDocuments = await sql`
      SELECT d.*, p.check_in_at AS visit_date, p.queue_number
      FROM documents d
      JOIN patients p ON d.patient_id = p.id
      WHERE p.phone = ${patient.phone}
        AND p.id != ${id}
        AND d.uploaded_at >= NOW() - INTERVAL '6 months'
      ORDER BY d.uploaded_at DESC
      LIMIT 50
    `

    const prescriptions = await sql`
      SELECT pr.*, u.name AS doctor_name, u.qualification, u.speciality, u.license_no
      FROM prescriptions pr JOIN users u ON pr.doctor_id = u.id
      WHERE pr.patient_id = ${id} ORDER BY pr.created_at`

    return NextResponse.json({ ...patient, documents, previousDocuments, prescriptions })
  } catch (e) {
    console.error('[patients/[id] GET]', e)
    return authErrorResponse(e)
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin', 'data_entry'])
    const id = parseInt(params.id)
    const { name, age, age_unit, gender, guardian_name, cnic_bform, phone, address, is_emergency, check_in_at,
            bp, temperature, pulse, weight, payment_method, bill_amount, discount, amount_paid, payment_status } = await req.json()

    const ageUnit = age_unit === 'months' ? 'months' : 'years'
    const bill  = parseFloat(bill_amount)  || 0
    const disc  = parseFloat(discount)     || 0
    const paid  = parseFloat(amount_paid)  || 0
    const net   = Math.max(0, bill - disc)
    const meth  = payment_method || 'cash'
    const change = meth === 'cash' ? Math.max(0, paid - net) : 0
    const pstat = payment_status || (paid >= net && net > 0 ? 'paid' : net === 0 ? 'pending' : paid > 0 ? 'partial' : 'pending')

    const [updated] = await sql`
      UPDATE patients SET
        name           = ${name},
        age            = ${parseInt(age)},
        age_unit       = ${ageUnit},
        gender         = ${gender || 'male'},
        guardian_name  = ${guardian_name || ''},
        cnic_bform     = ${cnic_bform || ''},
        phone          = ${phone},
        address        = ${address},
        is_emergency   = ${!!is_emergency},
        check_in_at    = ${check_in_at},
        bp             = ${bp || ''},
        temperature    = ${temperature || ''},
        pulse          = ${pulse || ''},
        weight         = ${weight || ''},
        payment_method = ${meth},
        bill_amount    = ${bill},
        discount       = ${disc},
        amount_paid    = ${paid},
        change_due     = ${change},
        payment_status = ${pstat}
      WHERE id = ${id}
      RETURNING *`
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[patients/[id] PATCH]', e)
    return authErrorResponse(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin', 'data_entry'])
    const id = parseInt(params.id)
    await sql`DELETE FROM patients WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[patients/[id] DELETE]', e)
    return authErrorResponse(e)
  }
}
