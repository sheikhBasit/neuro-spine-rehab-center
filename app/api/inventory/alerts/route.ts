import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { sendExpiryAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    await requireRole(['admin'])

    const items = await sql`
      SELECT name, expiry_date, quantity, unit,
             (expiry_date::date - CURRENT_DATE)::int AS days_left
      FROM inventory_items
      WHERE type = 'consumable'
        AND expiry_date IS NOT NULL
        AND expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY expiry_date ASC
    `

    if (items.length === 0) return NextResponse.json({ ok: true, sent: false, reason: 'No expiring items' })

    const result = await sendExpiryAlert(items as Parameters<typeof sendExpiryAlert>[0])
    return NextResponse.json({ ...result, count: items.length })
  } catch (e) {
    console.error('[alerts POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
