import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

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

export { bcrypt }
