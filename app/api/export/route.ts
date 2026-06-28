import { neon } from '@neondatabase/serverless'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT name, phone, address, date FROM records ORDER BY created_at DESC`

  const data = rows.map(r => ({
    Name: r.name,
    'Phone Number': r.phone,
    Address: r.address,
    Date: new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 20 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Records')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `records-${new Date().toISOString().split('T')[0]}.xlsx`

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
