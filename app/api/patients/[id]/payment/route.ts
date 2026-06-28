import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH: admin edits discount (and optionally other payment fields)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin'])
    const { discount, bill_amount, payment_method, amount_paid, payment_status } = await req.json()
    const id = parseInt(params.id)

    const disc  = discount    != null ? parseFloat(discount)    : null
    const bill  = bill_amount != null ? parseFloat(bill_amount) : null
    const paid  = amount_paid != null ? parseFloat(amount_paid) : null

    // Fetch current values to recalculate change
    const [cur] = await sql`SELECT bill_amount, discount, amount_paid, payment_method FROM patients WHERE id = ${id}`
    if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const finalBill   = bill   ?? cur.bill_amount
    const finalDisc   = disc   ?? cur.discount
    const finalPaid   = paid   ?? cur.amount_paid
    const finalMethod = payment_method ?? cur.payment_method
    const netBill     = Math.max(0, finalBill - finalDisc)
    const change      = finalMethod === 'cash' ? Math.max(0, finalPaid - netBill) : 0
    const finalStatus = payment_status ?? (finalPaid >= netBill && netBill > 0 ? 'paid' : netBill === 0 ? 'pending' : 'partial')

    const [updated] = await sql`
      UPDATE patients SET
        bill_amount    = ${finalBill},
        discount       = ${finalDisc},
        amount_paid    = ${finalPaid},
        payment_method = ${finalMethod},
        change_due     = ${change},
        payment_status = ${finalStatus}
      WHERE id = ${id} RETURNING *`

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[payment PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
