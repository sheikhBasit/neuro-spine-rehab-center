import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'doctor', 'data_entry'])
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')    // 'consumable' | 'permanent'
    const alert = searchParams.get('alert')  // 'true' → expiring within 30 days

    if (alert === 'true') {
      const rows = await sql`
        SELECT *, (expiry_date::date - CURRENT_DATE)::int AS days_left
        FROM inventory_items
        WHERE type = 'consumable'
          AND expiry_date IS NOT NULL
          AND expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY expiry_date ASC
      `
      return NextResponse.json(rows)
    }

    const rows = type
      ? await sql`SELECT * FROM inventory_items WHERE type = ${type} ORDER BY created_at DESC`
      : await sql`SELECT *, (CASE WHEN type='consumable' AND expiry_date IS NOT NULL THEN (expiry_date::date - CURRENT_DATE)::int ELSE NULL END) AS days_left FROM inventory_items ORDER BY type, created_at DESC`

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(['admin'])
    const { name, type, category, quantity, unit, expiry_date, status, notes } = await req.json()

    if (!name || !type) return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })

    const [item] = await sql`
      INSERT INTO inventory_items (name, type, category, quantity, unit, expiry_date, status, notes, added_by)
      VALUES (
        ${name}, ${type}, ${category || ''}, ${parseInt(quantity) || 0}, ${unit || ''},
        ${type === 'consumable' && expiry_date ? expiry_date : null},
        ${type === 'permanent' ? (status || 'active') : null},
        ${notes || ''}, ${session.id}
      )
      RETURNING *
    `
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error('[inventory POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
