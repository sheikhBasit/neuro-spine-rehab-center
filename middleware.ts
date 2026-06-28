import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

const ROLE_MAP: Record<string, string> = {
  '/admin':  'admin',
  '/doctor': 'doctor',
  '/entry':  'data_entry',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requiredRole = Object.entries(ROLE_MAP).find(([p]) => pathname.startsWith(p))?.[1]
  if (!requiredRole) return NextResponse.next()

  const token = req.cookies.get('clinic_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.role !== requiredRole) return NextResponse.redirect(new URL('/login', req.url))
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/doctor/:path*', '/entry/:path*'],
}
