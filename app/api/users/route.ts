import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { bcrypt, requireRole, authErrorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireRole(['admin'])
    const users = await sql`
      SELECT id, role, name, email, phone, cnic, license_no, speciality, qualification, active, created_at
      FROM users ORDER BY created_at DESC
    `
    return NextResponse.json(users)
  } catch (e) {
    console.error('[users GET]', e)
    return authErrorResponse(e)
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(['admin'])
    const { role, name, email, password, phone, cnic, license_no, speciality, qualification } = await req.json()

    if (!role || !name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['doctor', 'data_entry'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 12)
    const [user] = await sql`
      INSERT INTO users (role, name, email, password_hash, phone, cnic, license_no, speciality, qualification)
      VALUES (${role}, ${name}, ${email}, ${hash}, ${phone || ''}, ${cnic || ''},
              ${license_no || ''}, ${speciality || ''}, ${qualification || ''})
      RETURNING id, role, name, email, phone, active, created_at
    `
    return NextResponse.json(user, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
