import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { uploadBuffer } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ponytail: Vercel Hobby has a 4.5MB request body limit; sufficient for clinic docs
export async function POST(req: Request) {
  try {
    await requireRole(['data_entry', 'doctor', 'admin'])
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const patient_id = formData.get('patient_id') as string

    if (!file || !patient_id) {
      return NextResponse.json({ error: 'Missing file or patient_id' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadBuffer(buffer, 'clinic/documents')

    const [doc] = await sql`
      INSERT INTO documents (patient_id, url, file_name)
      VALUES (${parseInt(patient_id)}, ${url}, ${file.name})
      RETURNING *
    `
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
