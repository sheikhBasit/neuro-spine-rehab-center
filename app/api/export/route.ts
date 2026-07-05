import { sql } from '@/lib/db'
import { requireRole, authErrorResponse } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireRole(['admin', 'data_entry'])
    const rows = await sql`
      SELECT
        p.queue_number AS "Queue #",
        CASE WHEN p.is_emergency THEN 'YES' ELSE 'NO' END AS "Emergency",
        p.name AS "Patient Name",
        p.age AS "Age",
        p.guardian_name AS "Father/Husband",
        p.cnic_bform AS "CNIC / B-Form",
        p.phone AS "Phone",
        p.address AS "Address",
        p.status AS "Status",
        u.name AS "Seen By Doctor",
        TO_CHAR(p.check_in_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS "Check-in Time",
        TO_CHAR(p.seen_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') AS "Seen At"
      FROM patients p
      LEFT JOIN users u ON p.seen_by_doctor_id = u.id
      ORDER BY p.is_emergency DESC, p.check_in_at ASC
    `

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [4,10,20,5,20,16,14,30,12,20,18,18].map(wch => ({ wch }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Patients')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `patients-${new Date().toISOString().split('T')[0]}.xlsx`

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('[export GET]', e)
    return authErrorResponse(e)
  }
}
