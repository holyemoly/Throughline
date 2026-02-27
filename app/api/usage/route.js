export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'No API key' }, { status: 500 });

  try {
    // Get usage for last 7 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const res = await fetch(`https://api.anthropic.com/v1/usage?start_date=${startStr}&end_date=${endStr}`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
    });

    if (!res.ok) {
      return Response.json({ error: 'Usage API unavailable', status: res.status });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
