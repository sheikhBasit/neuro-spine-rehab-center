import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [user] = await sql`
    SELECT id, name, role, email, phone, speciality, qualification, license_no
    FROM users WHERE id = ${session.id} LIMIT 1`
  return NextResponse.json(user ?? session)
}
