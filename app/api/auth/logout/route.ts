import { NextResponse } from 'next/server'
import { getSession, cookieName } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  const res = NextResponse.json({ ok: true })
  if (session) {
    res.cookies.set(cookieName(session.role), '', { maxAge: 0, path: '/' })
  }
  return res
}
