import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request) {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [monthRes, dayRes, totalRes] = await Promise.all([
      supabaseAdmin.from('api_costs').select('cost_estimate, source').gte('created_at', monthStart),
      supabaseAdmin.from('api_costs').select('cost_estimate, source').gte('created_at', dayStart),
      supabaseAdmin.from('api_costs').select('cost_estimate'),
    ]);

    const sum = (rows) => (rows || []).reduce((a, r) => a + Number(r.cost_estimate || 0), 0);

    // Break month spend down by source
    const bySource = {};
    for (const row of (monthRes.data || [])) {
      const key = row.source || 'unknown';
      bySource[key] = (bySource[key] || 0) + Number(row.cost_estimate || 0);
    }

    return Response.json({
      today: sum(dayRes.data),
      month: sum(monthRes.data),
      total: sum(totalRes.data),
      monthBySource: bySource,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
