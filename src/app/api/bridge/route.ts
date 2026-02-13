import { NextRequest, NextResponse } from 'next/server';

const BRIDGE = 'https://m5oqj21chd.execute-api.ap-southeast-2.amazonaws.com/lambda/invoke';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    
    // Wrap SELECTs in json_agg to avoid Lambda text quoting bug
    const isSelect = query.trim().toUpperCase().startsWith('SELECT');
    const wrappedQuery = isSelect
      ? `SELECT json_agg(row_to_json(t)) FROM (${query}) t`
      : query;

    const res = await fetch(BRIDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        functionName: 'troy-sql-executor',
        payload: { sql: wrappedQuery }
      }),
    });
    
    const data = await res.json();
    
    // Extract from Lambda response: { result: { body: "{ success, result }" } }
    if (data?.result?.body) {
      const body = typeof data.result.body === 'string' 
        ? JSON.parse(data.result.body) 
        : data.result.body;
      
      const result = body?.result;
      
      // json_agg wraps result as [{ json_agg: [...] }]
      if (isSelect && Array.isArray(result)) {
        const agg = result[0]?.json_agg;
        if (agg !== undefined) {
          return NextResponse.json({ rows: agg || [] });
        }
        return NextResponse.json({ rows: result });
      }
      
      // Command result (INSERT/UPDATE/DELETE)
      return NextResponse.json({ rows: [], command: result?.command, success: body?.success });
    }
    
    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }
    
    return NextResponse.json({ rows: [], raw: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
