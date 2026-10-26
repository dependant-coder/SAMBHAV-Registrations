// supabase/functions/pin-login/index.ts
// Backup login: roll number + 6-digit PIN  ->  one-time token the app exchanges with supabase.auth.verifyOtp.
// Deploy:  npx supabase functions deploy pin-login   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// Needs "Verify JWT" ON (default): the app calls it with the anon key.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const roll = String(body?.roll ?? '').trim().toUpperCase().slice(0, 32);
  const pin = String(body?.pin ?? '');
  if (!roll || !/^\d{6}$/.test(pin)) return json({ error: 'invalid' }, 401);

  // 1. throttle by IP (stops one person trying one PIN across many roll numbers)
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from('pin_ip_attempts')
    .select('*', { count: 'exact', head: true }).eq('ip', ip).gte('at', since);
  if ((count ?? 0) >= 20) return json({ error: 'too_many' }, 429);
  await admin.from('pin_ip_attempts').insert({ ip });
  if (Math.random() < 0.02) {   // housekeeping
    await admin.from('pin_ip_attempts').delete().lt('at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  }

  // 2. verify roll + PIN (bcrypt, per-member lockout inside SQL)
  const { data: v, error: vErr } = await admin.rpc('verify_member_pin', { p_roll: roll, p_pin: pin });
  if (vErr || !v) return json({ error: 'server' }, 500);
  if (v.result === 'locked') return json({ error: 'locked', until: v.until }, 429);
  if (v.result !== 'ok') return json({ error: 'invalid' }, 401);

  // 3. make sure this member has an auth user
  let authUserId: string | null = v.auth_user_id;
  let email: string;
  if (authUserId) {
    const { data, error } = await admin.auth.admin.getUserById(authUserId);
    if (error || !data.user?.email) return json({ error: 'server' }, 500);
    email = data.user.email;
  } else {
    email = String(v.email ?? '').trim().toLowerCase();
    if (!email) return json({ error: 'server' }, 500);
    const { data: created } = await admin.auth.admin.createUser({ email, email_confirm: true });
    authUserId = created?.user?.id ?? null;
    if (!authUserId) {                                   // already in Auth (e.g. signed in with Google earlier)
      const { data: existing } = await admin.rpc('auth_uid_by_email', { p_email: email });
      authUserId = existing ?? null;
    }
    if (!authUserId) return json({ error: 'server' }, 500);
    const { error: linkErr } = await admin.from('members')
      .update({ auth_user_id: authUserId }).eq('id', v.member_id).is('auth_user_id', null);
    if (linkErr) return json({ error: 'conflict' }, 409);   // that auth user is linked to someone else
  }

  // 4. mint a one-time login token. generateLink does NOT send any email.
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (lErr || !link?.properties?.hashed_token) return json({ error: 'server' }, 500);

  return json({ token_hash: link.properties.hashed_token, must_change: !!v.must_change });
});
