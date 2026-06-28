import { neon } from '@neondatabase/serverless'

// ponytail: `any` to allow array destructuring (const [row] = await sql`...`);
// neon's FullQueryResults union type blocks it when strictly typed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql: any = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
