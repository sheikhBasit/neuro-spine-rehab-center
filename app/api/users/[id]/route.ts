import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    const { active } = await req.json()
    const [user] = await sql`
      UPDATE users SET active = ${active} WHERE id = ${parseInt(params.id)}
      RETURNING id, name, active
    `
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    await sql`DELETE FROM users WHERE id = ${parseInt(params.id)} AND role != 'admin'`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
