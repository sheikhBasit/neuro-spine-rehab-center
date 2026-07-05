import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'
import { uploadBuffer } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['doctor', 'admin'])
    const id = parseInt(params.id)
    const formData = await req.formData()

    const notes       = (formData.get('notes')       as string) || ''
    const complaint   = (formData.get('complaint')   as string) || ''
    const history     = (formData.get('history')     as string) || ''
    const examination = (formData.get('examination') as string) || ''
    const diagnosis   = (formData.get('diagnosis')   as string) || ''
    const advice      = (formData.get('advice')      as string) || ''
    const labTestsRaw = (formData.get('lab_tests')   as string) || '[]'
    const medicinesRaw = formData.get('medicines')   as string | null
    const file        = formData.get('file')         as File | null

    const medicines = medicinesRaw ? JSON.parse(medicinesRaw) : null
    const lab_tests = JSON.parse(labTestsRaw)

    let image_url: string | null = null
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const { url } = await uploadBuffer(buffer, 'clinic/prescriptions', 'image')
      image_url = url
    }

    const [rx] = image_url
      ? await sql`
          UPDATE prescriptions SET
            complaint=${complaint}, history=${history}, examination=${examination},
            diagnosis=${diagnosis}, lab_tests=${JSON.stringify(lab_tests)}::jsonb,
            advice=${advice}, notes=${notes},
            medicines=${medicines ? JSON.stringify(medicines) : null}::jsonb,
            image_url=${image_url}
          WHERE id=${id} RETURNING *`
      : await sql`
          UPDATE prescriptions SET
            complaint=${complaint}, history=${history}, examination=${examination},
            diagnosis=${diagnosis}, lab_tests=${JSON.stringify(lab_tests)}::jsonb,
            advice=${advice}, notes=${notes},
            medicines=${medicines ? JSON.stringify(medicines) : null}::jsonb
          WHERE id=${id} RETURNING *`

    return NextResponse.json(rx)
  } catch (e) {
    console.error('[prescriptions PATCH]', e)
    return authErrorResponse(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['doctor', 'admin'])
    await sql`DELETE FROM prescriptions WHERE id = ${parseInt(params.id)}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[prescriptions DELETE]', e)
    return authErrorResponse(e)
  }
}
