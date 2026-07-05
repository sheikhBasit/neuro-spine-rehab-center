import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'
import { uploadBuffer } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const session = await requireRole(['doctor', 'admin'])
    const formData = await req.formData()

    const patient_id  = parseInt(formData.get('patient_id') as string)
    const notes       = (formData.get('notes')       as string) || ''
    const complaint   = (formData.get('complaint')   as string) || ''
    const history     = (formData.get('history')     as string) || ''
    const examination = (formData.get('examination') as string) || ''
    const diagnosis   = (formData.get('diagnosis')   as string) || ''
    const advice      = (formData.get('advice')      as string) || ''
    const labTestsRaw = (formData.get('lab_tests')   as string) || '[]'
    const medicinesRaw = formData.get('medicines')   as string | null
    const file        = formData.get('file')         as File | null

    if (!patient_id) return NextResponse.json({ error: 'Missing patient_id' }, { status: 400 })

    const medicines = medicinesRaw ? JSON.parse(medicinesRaw) : null
    const lab_tests = JSON.parse(labTestsRaw)

    let image_url = null
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const { url } = await uploadBuffer(buffer, 'clinic/prescriptions', 'image')
      image_url = url
    }

    const [rx] = await sql`
      INSERT INTO prescriptions
        (patient_id, doctor_id, medicines, image_url, notes, complaint, history, examination, diagnosis, lab_tests, advice)
      VALUES
        (${patient_id}, ${session.id},
         ${medicines ? JSON.stringify(medicines) : null}, ${image_url}, ${notes},
         ${complaint}, ${history}, ${examination}, ${diagnosis},
         ${JSON.stringify(lab_tests)}::jsonb, ${advice})
      RETURNING *`

    return NextResponse.json(rx, { status: 201 })
  } catch (e) {
    console.error(e)
    return authErrorResponse(e)
  }
}
