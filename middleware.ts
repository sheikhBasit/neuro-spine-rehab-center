import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)
const ROLES = ['admin', 'doctor', 'data_entry'] as const
const cookieName = (role: string) => `clinic_token_${role}`
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

// Verifies the cookie for a specific role and, if it's aging, re-signs and
// pushes a fresh 30-day cookie onto `res`. Returns whether that role's
// session is currently valid.
async function verifyAndMaybeRefresh(req: NextRequest, res: NextResponse, role: string): Promise<boolean> {
  const token = req.cookies.get(cookieName(role))?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.role !== role) return false

    const iat = typeof payload.iat === 'number' ? payload.iat : 0
    const age = Math.floor(Date.now() / 1000) - iat
    if (age > REFRESH_THRESHOLD) {
      const fresh = await new SignJWT({ id: payload.id, role: payload.role, name: payload.name })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(SESSION_TTL)
        .sign(secret())
      res.cookies.set(cookieName(role), fresh, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE })
    }
    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requiredRole = Object.entries(ROLE_MAP).find(([p]) => pathname.startsWith(p))?.[1]
  const isApi = pathname.startsWith('/api/')
  if (!requiredRole && !isApi) return NextResponse.next()

  const res = NextResponse.next()

  if (requiredRole) {
    const ok = await verifyAndMaybeRefresh(req, res, requiredRole)
    if (!ok) return isApi ? NextResponse.next() : NextResponse.redirect(new URL('/login', req.url))
    return res
  }

  // Plain /api/* request: the calling page tags its fetches with
  // X-Session-Role so concurrent role sessions in other tabs don't collide.
  // Fall back to checking every role's cookie if the header is missing.
  const roleHint = req.headers.get('x-session-role')
  const rolesToCheck = roleHint && (ROLES as readonly string[]).includes(roleHint) ? [roleHint] : ROLES
  for (const role of rolesToCheck) {
    await verifyAndMaybeRefresh(req, res, role)
  }
  return res
}

export const config = {
  matcher: ['/admin/:path*', '/doctor/:path*', '/entry/:path*', '/api/:path*'],
}
