export async function callTool(tool: string, args: any) {
  const res = await fetch('https://m5oqj21chd.execute-api.ap-southeast-2.amazonaws.com/lambda/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionName: 'troy-orchestrator-6am', payload: { action: 'mcp_tool', tool, args } })
  });
  if (!res.ok) throw new Error('MCP call failed');
  return res.json();
}
