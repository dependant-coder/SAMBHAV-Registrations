// supabase/functions/send-push/index.ts
// Web Push sender.
//   kind 'announcement'    : admins (any) or a lead/co-lead (own domain only, live only, max 5 per rolling 24h)
//   kind 'event_reminders' : called every 5 min by pg_cron with the service-role key
// Secrets (Supabase -> Edge Functions -> Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Deploy:  npx supabase functions deploy send-push
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

type Target = { id: string; endpoint: string; p256dh: string; auth: string };

async function blast(db: ReturnType<typeof createClient>, targets: Target[], payload: object) {
  const body = JSON.stringify(payload);
  let sent = 0, failed = 0; const dead: string[] = [];
  for (let i = 0; i < targets.length; i += 25) {                       // 25 at a time
    await Promise.allSettled(targets.slice(i, i + 25).map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          body, { TTL: 60 * 60 * 24, urgency: 'normal' });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(t.id); else failed++;
      }
    }));
  }
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
  return { sent, failed, removed: dead.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const isCron = auth === `Bearer ${SERVICE}`;
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false },
  });

  let callerIsAdmin = false;
  let callerUserId: string | null = null;
  if (!isCron) {
    const { data: u } = await userClient.auth.getUser();
    callerUserId = u.user?.id ?? null;
    if (!callerUserId) return json({ error: 'forbidden' }, 403);
    const { data: ok } = await userClient.rpc('is_admin');
    callerIsAdmin = !!ok;
  }

  let body: any; try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  // ---- A) announcement push ----
  if (body.kind === 'announcement') {
    if (isCron) return json({ error: 'forbidden' }, 403);

    const { data: pre } = await db.from('announcements')
      .select('id,audience,domain_id,published_at,expires_at,push_sent_at')
      .eq('id', body.announcement_id).maybeSingle();
    if (!pre) return json({ error: 'already_sent_or_missing' }, 409);

    if (!callerIsAdmin) {
      // lead / co-lead: only their own domain's announcement
      if (pre.audience !== 'domain') return json({ error: 'forbidden' }, 403);
      const { data: lead } = await userClient.rpc('is_lead_of', { p_domain: pre.domain_id });
      if (!lead) return json({ error: 'forbidden' }, 403);
      // daily limit: 5 per sender per rolling 24h
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await db.from('announcements').select('*', { count: 'exact', head: true })
        .eq('push_sent_by', callerUserId).gte('push_sent_at', since);
      if ((count ?? 0) >= 5) return json({ error: 'daily_limit' }, 429);
    }
    if (new Date(pre.published_at) > new Date())                 return json({ error: 'not_live' }, 409);
    if (pre.expires_at && new Date(pre.expires_at) < new Date()) return json({ error: 'expired' }, 409);

    // claim atomically so it can't be sent twice
    const { data: a } = await db.from('announcements')
      .update({ push_sent_at: new Date().toISOString(), push_sent_by: callerUserId })
      .eq('id', pre.id).is('push_sent_at', null).select('*').maybeSingle();
    if (!a) return json({ error: 'already_sent_or_missing' }, 409);

    const { data: targets } = await db.rpc('push_targets', { p_domain: a.audience === 'domain' ? a.domain_id : null, p_kind: 'announcement' });
    const result = await blast(db, targets ?? [], {
      title: a.title, body: String(a.body).slice(0, 140), url: `/app/announcements/${a.id}`, tag: `ann-${a.id}`,
    });
    await db.from('announcements').update({ push_sent_count: result.sent }).eq('id', a.id);

    // audit (best effort: a logging problem must not turn a delivered push into an error)
    try {
      const { data: me } = await db.from('members').select('id').eq('auth_user_id', callerUserId).maybeSingle();
      await db.from('audit_log').insert({
        actor_user_id: callerUserId, actor_member_id: me?.id ?? null, action: 'push_sent', target_type: 'announcement',
        target_id: a.id, domain_id: a.domain_id, details: { title: a.title, sent: result.sent },
      });
    } catch (_) { /* ignore */ }
    return json(result);
  }

  // ---- B) event reminders (cron) ----
  if (body.kind === 'event_reminders') {
    if (!isCron) return json({ error: 'forbidden' }, 403);
    const { data: events } = await db.rpc('claim_due_event_reminders');
    let total = 0;
    for (const e of events ?? []) {
      const { data: targets } = await db.rpc('push_targets', { p_domain: e.audience === 'domain' ? e.domain_id : null, p_kind: 'event' });
      const mins = Math.max(1, Math.round((new Date(e.starts_at).getTime() - Date.now()) / 60000));
      const r = await blast(db, targets ?? [], {
        title: `Starting soon: ${e.title}`,
        body: `${e.venue ? e.venue + ' · ' : ''}in about ${mins} min`,
        url: `/app/events/${e.id}`, tag: `ev-${e.id}`,
      });
      total += r.sent;
    }
    return json({ events: (events ?? []).length, sent: total });
  }

  return json({ error: 'bad_request' }, 400);
});
