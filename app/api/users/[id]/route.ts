import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    const body = await req.json()
    const id = parseInt(params.id)

    // Toggle-active shortcut (existing behaviour)
    if (Object.keys(body).length === 1 && 'active' in body) {
      const [user] = await sql`UPDATE users SET active = ${body.active} WHERE id = ${id} RETURNING id, name, active`
      return NextResponse.json(user)
    }

    const { name, email, phone, cnic, speciality, qualification, license_no, password } = body
    if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

    if (password) {
      const { bcrypt } = await import('@/lib/auth')
      const hash = await bcrypt.hash(password, 12)
      const [u] = await sql`
        UPDATE users SET name=${name}, email=${email}, phone=${phone||''}, cnic=${cnic||''},
          speciality=${speciality||''}, qualification=${qualification||''}, license_no=${license_no||''},
          password_hash=${hash}
        WHERE id=${id} AND role != 'admin' RETURNING id, role, name, email, phone, cnic, speciality, qualification, license_no, active`
      return NextResponse.json(u)
    }

    const [u] = await sql`
      UPDATE users SET name=${name}, email=${email}, phone=${phone||''}, cnic=${cnic||''},
        speciality=${speciality||''}, qualification=${qualification||''}, license_no=${license_no||''}
      WHERE id=${id} AND role != 'admin' RETURNING id, role, name, email, phone, cnic, speciality, qualification, license_no, active`
    return NextResponse.json(u)
  } catch (e) {
    console.error('[users PATCH]', e)
    return authErrorResponse(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    await sql`DELETE FROM users WHERE id = ${parseInt(params.id)} AND role != 'admin'`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[users DELETE]', e)
    return authErrorResponse(e)
  }
}
