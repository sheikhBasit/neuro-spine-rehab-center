import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)
export const COOKIE = 'clinic_token'

export type Session = { id: number; role: string; name: string }

export async function signToken(payload: Session) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as Session
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function requireRole(roles: string[]): Promise<Session> {
  const session = await getSession()
  if (!session || !roles.includes(session.role)) throw new Error('Unauthorized')
  return session
}

// Route handlers should call this in their catch block so an expired/invalid
// session reports 401 instead of being masked as a generic 500.
export function authErrorResponse(e: unknown) {
  if (e instanceof Error && e.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ error: 'Server error' }, { status: 500 })
}

export { bcrypt }
