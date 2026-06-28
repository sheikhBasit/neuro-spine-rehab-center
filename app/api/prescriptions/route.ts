import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { uploadBuffer } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Accepts multipart/form-data for both manual medicines and prescription photo
export async function POST(req: Request) {
  try {
    const session = await requireRole(['doctor', 'admin'])
    const formData = await req.formData()

    const patient_id  = parseInt(formData.get('patient_id') as string)
    const notes       = (formData.get('notes') as string) || ''
    const medicinesRaw = formData.get('medicines') as string | null
    const file        = formData.get('file') as File | null

    if (!patient_id) return NextResponse.json({ error: 'Missing patient_id' }, { status: 400 })

    let medicines = null
    let image_url = null

    if (medicinesRaw) {
      medicines = JSON.parse(medicinesRaw)
    }

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const { url } = await uploadBuffer(buffer, 'clinic/prescriptions', 'image')
      image_url = url
    }

    const [rx] = await sql`
      INSERT INTO prescriptions (patient_id, doctor_id, medicines, image_url, notes)
      VALUES (${patient_id}, ${session.id}, ${medicines ? JSON.stringify(medicines) : null},
              ${image_url}, ${notes})
      RETURNING *
    `
    return NextResponse.json(rx, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
