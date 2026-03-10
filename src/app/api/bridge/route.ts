import { NextRequest, NextResponse } from 'next/server';

const BRIDGE = 'https://m5oqj21chd.execute-api.ap-southeast-2.amazonaws.com/lambda/invoke';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    const res = await fetch(BRIDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Confirmed working format as of 2026-03-09: fn + sql at top level
      body: JSON.stringify({ fn: 'troy-sql-executor', sql: query }),
    });

    const data = await res.json();

    // Bridge returns { success, rows, count, sql } directly
    if (data?.success) {
      const rows = Array.isArray(data.rows) ? data.rows : [];
      return NextResponse.json({ rows });
    }

    if (data?.rows?.error) {
      return NextResponse.json({ error: data.rows.error }, { status: 500 });
    }

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    return NextResponse.json({ rows: [], raw: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
