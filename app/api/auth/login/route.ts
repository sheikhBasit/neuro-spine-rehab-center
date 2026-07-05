import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { bcrypt, signToken, COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!sql) {
    console.error('[login] DATABASE_URL not set')
    return NextResponse.json({ error: 'Database not configured. Contact administrator.' }, { status: 503 })
  }

  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    let rows: { id: number; role: string; name: string; password_hash: string }[]
    try {
      rows = await sql`
        SELECT id, role, name, password_hash FROM users
        WHERE email = ${email} AND active = TRUE
        LIMIT 1
      `
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      console.error('[login] DB query failed:', msg)
      if (msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Database tables not initialized. Run setup first.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 503 })
    }

    const [user] = rows
    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    if (!process.env.JWT_SECRET) {
      console.error('[login] JWT_SECRET not set')
      return NextResponse.json({ error: 'Auth not configured. Contact administrator.' }, { status: 503 })
    }

    const token = await signToken({ id: user.id, role: user.role, name: user.name })

    const res = NextResponse.json({ role: user.role, name: user.name })
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return res
  } catch (e) {
    console.error('[login] Unexpected error:', e)
    return NextResponse.json({ error: 'Unexpected server error. Check server logs.' }, { status: 500 })
  }
}
