import { supabaseAdmin } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const subscription = await request.json();
    if (!subscription?.endpoint) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }, { onConflict: 'endpoint' });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { endpoint } = await request.json();
    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
