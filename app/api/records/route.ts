import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM records ORDER BY created_at DESC`
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, phone, address, date } = await req.json()
    if (!name || !phone || !address || !date) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    await sql`INSERT INTO records (name, phone, address, date) VALUES (${name}, ${phone}, ${address}, ${date})`
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
