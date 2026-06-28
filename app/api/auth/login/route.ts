import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { bcrypt, signToken, COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const [user] = await sql`
      SELECT id, role, name, password_hash FROM users
      WHERE email = ${email} AND active = TRUE
      LIMIT 1
    `
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const token = await signToken({ id: user.id, role: user.role, name: user.name })

    const res = NextResponse.json({ role: user.role, name: user.name })
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
