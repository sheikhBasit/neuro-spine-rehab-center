import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireRole(['admin'])

    const [patientsPerDay, perDoctor, statusBreakdown, [todayStats]] = await Promise.all([
      sql`
        SELECT check_in_at::date AS date, COUNT(*) AS count
        FROM patients
        WHERE check_in_at >= NOW() - INTERVAL '14 days'
        GROUP BY date ORDER BY date
      `,
      sql`
        SELECT u.name AS doctor_name, COUNT(*) AS count
        FROM patients p JOIN users u ON p.seen_by_doctor_id = u.id
        WHERE p.check_in_at >= NOW() - INTERVAL '7 days'
        GROUP BY u.name ORDER BY count DESC
      `,
      sql`
        SELECT status, COUNT(*) AS count
        FROM patients WHERE check_in_at::date = CURRENT_DATE
        GROUP BY status
      `,
      sql`
        SELECT
          COUNT(*) AS total_today,
          COUNT(CASE WHEN status = 'done' THEN 1 END) AS done_today,
          COUNT(CASE WHEN is_emergency THEN 1 END) AS emergency_today,
          ROUND(AVG(EXTRACT(EPOCH FROM (seen_at - check_in_at))/60)
                FILTER (WHERE seen_at IS NOT NULL))::int AS avg_wait_minutes
        FROM patients WHERE check_in_at::date = CURRENT_DATE
      `,
    ])

    return NextResponse.json({ patientsPerDay, perDoctor, statusBreakdown, stats: todayStats })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
