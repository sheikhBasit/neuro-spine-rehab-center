import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE = 'clinic_token'
const SESSION_TTL = '30d'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
// Avoid re-signing on every single request; only slide the expiry forward
// once the token is more than this old.
const REFRESH_THRESHOLD = 15 * 60

const ROLE_MAP: Record<string, string> = {
  '/admin':  'admin',
  '/doctor': 'doctor',
  '/entry':  'data_entry',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requiredRole = Object.entries(ROLE_MAP).find(([p]) => pathname.startsWith(p))?.[1]
  const isApi = pathname.startsWith('/api/')
  if (!requiredRole && !isApi) return NextResponse.next()

  const token = req.cookies.get(COOKIE)?.value
  if (!token) {
    return isApi ? NextResponse.next() : NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret())
    if (requiredRole && payload.role !== requiredRole) {
      return isApi ? NextResponse.next() : NextResponse.redirect(new URL('/login', req.url))
    }

    const res = NextResponse.next()

    // Sliding session: as long as the user stays active, keep pushing the
    // expiry forward so they aren't logged out mid-shift.
    const iat = typeof payload.iat === 'number' ? payload.iat : 0
    const age = Math.floor(Date.now() / 1000) - iat
    if (age > REFRESH_THRESHOLD) {
      const fresh = await new SignJWT({ id: payload.id, role: payload.role, name: payload.name })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(SESSION_TTL)
        .sign(secret())
      res.cookies.set(COOKIE, fresh, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE })
    }

    return res
  } catch {
    return isApi ? NextResponse.next() : NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/doctor/:path*', '/entry/:path*', '/api/:path*'],
}
