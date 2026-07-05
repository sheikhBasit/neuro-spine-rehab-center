import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    const { name, category, quantity, unit, expiry_date, status, notes } = await req.json()
    const id = parseInt(params.id)

    const [item] = await sql`
      UPDATE inventory_items SET
        name        = COALESCE(${name}, name),
        category    = COALESCE(${category ?? null}, category),
        quantity    = COALESCE(${quantity != null ? parseInt(quantity) : null}, quantity),
        unit        = COALESCE(${unit ?? null}, unit),
        expiry_date = COALESCE(${expiry_date ?? null}, expiry_date),
        status      = COALESCE(${status ?? null}, status),
        notes       = COALESCE(${notes ?? null}, notes),
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return NextResponse.json(item)
  } catch (e) {
    console.error('[inventory PATCH]', e)
    return authErrorResponse(e)
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    await sql`DELETE FROM inventory_items WHERE id = ${parseInt(params.id)}`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
