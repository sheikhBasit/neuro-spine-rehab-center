import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH: break_start | break_end | shift_end
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['doctor', 'admin'])
    const { action } = await req.json()
    const id = parseInt(params.id)

    if (action === 'break_start') {
      const [row] = await sql`
        UPDATE attendance
        SET breaks = breaks || jsonb_build_object('start', NOW()::text, 'end', null)::jsonb
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(row)
    }

    if (action === 'break_end') {
      // Update the last break entry (the one with null end)
      const [row] = await sql`
        UPDATE attendance
        SET breaks = (
          SELECT jsonb_agg(
            CASE WHEN (b->>'end') IS NULL THEN jsonb_set(b, '{end}', to_jsonb(NOW()::text)) ELSE b END
          )
          FROM jsonb_array_elements(breaks) AS b
        )
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(row)
    }

    if (action === 'shift_end') {
      const [row] = await sql`
        UPDATE attendance
        SET shift_end = NOW(),
            total_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - shift_start)) / 60)::int
        WHERE id = ${id}
        RETURNING *
      `
      return NextResponse.json(row)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e) {
    console.error('[attendance PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
