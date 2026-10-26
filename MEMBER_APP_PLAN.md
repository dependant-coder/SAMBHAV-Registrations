# Sambhav Members App (PWA) — Build Plan

Turn the existing members website into an installable app where registered members log in, get announcements and push notifications, see events and mark attendance. This document is the single source of truth. It is written so it can be handed to an AI coding agent **one phase at a time**.

> **How to use this with your AI:** give it ONE phase at a time (Phase 0, then 1, then 2 …). After each phase, run that phase's "Done when" checks before starting the next. Never ask it to do everything at once.

---

## 0. Read this first

### 0.1 Decisions already made
| Topic | Decision |
|---|---|
| Who it is for | Registered **club members** (not the techfest, which is a separate site) |
| Primary login | **Continue with Google** (free) |
| Backup login | **Roll number + 6-digit PIN** |
| Notifications | Web Push (VAPID), free, no third-party service |
| Hosting | Vercel (frontend) + Supabase (DB, Auth, Edge Functions) |
| Cost | ₹0. No SMS, no paid email |
| Roles | **Super admin** (core team, `/admin` panel) · **Lead** and **Co-lead** (one domain each, work inside the member app under "Lead tools") · **Member** |
| Who approves members | **Super admins only.** Leads and co-leads cannot approve, reject, edit or delete members |
| Leads per domain | Exactly **one lead** per domain (enforced by the database); any number of co-leads |
| Co-lead vs lead | Same powers in v1. The role is stored separately so they can diverge later |
| Lead access to member info | Name, roll number, photo, **phone**, attendance. **Never** email, never edit/delete |
| Digital ID card | Card inside the app with photo, name, domain, role, roll number, membership number (e.g. `SMB4-0042`) and a QR. The QR holds a link with an **unguessable random ID** (not the roll number). Scanning shows live status from the server |
| ID privacy | Public verify page shows only: name, domain, role, membership number, member-since year, Valid / Not active / Not found. **No** roll number, email or phone. The **photo** is shown only to super admins and to leads of that member's own domain |
| Scanning | Staff (super admins; leads and co-leads for their own domain's events) can scan IDs to verify, or to mark attendance. Camera scanning, with manual entry as fallback |

### 0.2 One change from the original idea: do NOT store PINs readable
You suggested storing each member's PIN so admins can see it. **Don't.** Reasons:
- A 6-digit PIN has only 1,000,000 combinations. If the database is ever leaked, or any admin account is compromised, every PIN is exposed.
- People reuse PINs (phone unlock, ATM). A readable PIN leaks more than this app.
- Every admin would be able to log in as any member.

**What we do instead (same convenience, safe):**
- The PIN is stored only as a **bcrypt hash**. It can never be read back.
- In the admin member pop-up, admins see **PIN status** (Not set / Set on <date> / Must change) and a **Generate temporary PIN** button. The new PIN is shown **once**, with a "copy" and "send on WhatsApp" button. After the pop-up closes it is gone.
- A member who logs in with a temporary PIN is **forced to choose their own** PIN right away.

### 0.3 Schema assumptions — VERIFY BEFORE RUNNING ANY SQL
I have not seen your full database. This plan assumes the names below. Before running Phase 1 SQL, open Supabase → Table Editor and compare. If a name differs, change it in the SQL (search & replace) before running.

| Assumed | Used for |
|---|---|
| `public.members.id` (uuid) | primary key |
| `public.members.roll_number` (text, unique) | login by roll number |
| `public.members.email` (text) | matching the Google account |
| `public.members.name` (text) | display |
| `public.members.phone` (text) | admin WhatsApp link |
| `public.members.domain_id` (uuid → `public.domains.id`) | announcement/event targeting. **If a member can belong to several domains**, only the function `my_domain_ids()` in Phase 1 needs rewriting |
| `public.members.status` (text, `'approved'` = active) | who counts as a real member |
| `public.members.photo_path` (text) | profile photo in storage bucket `member-photos` |
| `public.domains.id`, `.name`, `.slug` | domain names |
| `public.admins.user_id` | admin check (confirmed) |

Run this once and keep the output next to you:
```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name in ('members','domains','admins')
order by table_name, ordinal_position;
```

### 0.4 What gets built (overview)

**Database:** `auth_user_id` link on members, PIN storage, announcements, events, attendance, push subscriptions, settings, plus secure functions (RPCs) and row-level-security (RLS) policies.

**Edge Functions (2):** `pin-login` (backup login), `send-push` (notifications + event reminders).

**New member pages (under `/app`):** Login, Auth callback, Home, Announcements (list + detail), Events (list + detail + check-in), Profile/Settings, Set PIN, plus Pending/Blocked status screens.

**Admin additions:** Announcements, Events (with attendance), "App access" section in the Members pop-up, a few Overview stats.

**PWA layer:** manifest, icons, service worker, install prompt, update prompt, offline shell.

**Roles (RBAC):** `domain_roles` table, lead/co-lead helper functions, extra security rules, an audit log, a "Lead tools" area in the member app (domain dashboard, member list, announcements, events, attendance), push limits for leads, and role assignment + audit log in the admin panel (Phase 1.12 and Phase 7B).

**Digital ID card:** `public_id` + membership number on members, a safe public `verify_member` function, a staff-only `scan_check_in` function, an ID Card page (`/app/id`), a public Verify page (`/verify/:id`), and a camera Scanner for staff (Phase 1.13, 4B and 6B).

### 0.5 Phases
| Phase | What | Risk |
|---|---|---|
| 0 | Audit existing database security (MUST do first) | **High if skipped** |
| 1 | Database migration | Medium |
| 2 | PWA (installable) | Low |
| 3 | Authentication (Google + PIN) | High |
| 4 | Member pages (Home, Profile…) | Low |
| 4B | Digital ID card + public verify page | Low |
| 5 | Announcements + push notifications | Medium |
| 6 | Events + attendance + reminders | Medium |
| 6B | ID scanner (verify + check-in by scanning) | Medium |
| 7 | Admin panel additions | Low |
| 7B | Roles: leads & co-leads (Lead tools, role assignment, audit log) | Medium |
| 8 | Test everything, deploy | — |

---

## Phase 0 — Security audit of what you already have (do this BEFORE adding member logins)

### Why this is critical
Today, the only people who log in are admins. So some of your existing RLS policies may say "any logged-in user (`authenticated`) can read/write this". The moment members can log in with Google, **every member becomes `authenticated`** and could read or edit data meant only for admins (all phone numbers, emails, edit requests…).

### Steps
1. In the Supabase SQL editor run:
```sql
-- Every policy in your project
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, cmd;

-- Tables with RLS OFF (these are fully open to anyone with the anon key!)
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and rowsecurity = false;
```
2. For **every** policy that applies to role `authenticated` (or `public`) check: does `qual` / `with_check` contain the admin check (`exists (select 1 from public.admins …)` or `is_admin()`)?
   - Policy says `using (true)` or has no admin check, for `authenticated` → **DANGEROUS**. Rewrite it to include the admin check.
   - Policy only for `anon` (used by public registration) → fine, leave it.
3. Any table with `rowsecurity = false` that holds member data → turn RLS on: `alter table public.<name> enable row level security;` and add admin-only policies.
4. Storage: for bucket `member-photos`, confirm that SELECT/INSERT/DELETE for `authenticated` are admin-checked (apart from the narrow "own photo" read we add in Phase 1).
5. Confirm the admin route guard checks the **`admins` table**, not just "has a session". Open `src/pages/admin/guard.tsx` and verify it queries `admins` (or `is_admin()`). If it only checks `session`, fix it now.

### Done when
- Every policy for `authenticated` on admin data includes the admin check.
- You can describe in one sentence why a logged-in non-admin cannot read `members` of other people.
- Final check (after Phase 3): sign in with a **non-admin Google account** and try `/admin`. You must get bounced. Also try this in the browser console on any page of the site:
  `await supabase.from('members').select('*')` → must return only an empty list / error for a plain member (not every row).

---

## Phase 1 — Database migration

Run these blocks in the SQL editor **in order**. Each block is safe to re-run unless noted. Take a backup first (Supabase → Database → Backups, or just export `members` as CSV).

### 1.1 Helper functions
```sql
create extension if not exists pgcrypto;

-- Is the current user an admin?  (If you already have is_admin(), keep yours.)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Gmail ignores dots and +tags. Normalise so  v.edant+x@gmail.com == vedant@gmail.com
create or replace function public.norm_email(e text)
returns text language sql immutable as $$
  select case
    when split_part(lower(trim(e)),'@',2) in ('gmail.com','googlemail.com')
      then replace(split_part(split_part(lower(trim(e)),'@',1),'+',1),'.','') || '@gmail.com'
    else lower(trim(e))
  end;
$$;

-- Link between a member and a login
alter table public.members
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- Who am I? (all return nothing/false for non-members)
create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where auth_user_id = auth.uid() and status = 'approved');
$$;

-- Domains the member belongs to. ONLY function to change if members can have many domains.
create or replace function public.my_domain_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select domain_id from public.members
  where auth_user_id = auth.uid() and domain_id is not null;
$$;
```

### 1.2 Claim a member after Google login
After a Google login, the app calls `claim_member()`. It links the Google account to the member whose registered email matches.

```sql
create or replace function public.claim_member()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  u_email text; u_confirmed timestamptz;
  m public.members%rowtype;
  n int;
begin
  if uid is null then return jsonb_build_object('result','no_session'); end if;

  -- already linked?
  select * into m from public.members where auth_user_id = uid;
  if found then return jsonb_build_object('result','ok','member_id',m.id); end if;

  select email, email_confirmed_at into u_email, u_confirmed from auth.users where id = uid;
  if u_email is null or u_confirmed is null then
    return jsonb_build_object('result','unverified_email');
  end if;

  select count(*) into n from public.members where public.norm_email(email) = public.norm_email(u_email);
  if n = 0 then return jsonb_build_object('result','not_found'); end if;
  if n > 1 then return jsonb_build_object('result','ambiguous'); end if;

  select * into m from public.members where public.norm_email(email) = public.norm_email(u_email);
  if m.auth_user_id is not null and m.auth_user_id <> uid then
    return jsonb_build_object('result','already_linked');
  end if;

  update public.members set auth_user_id = uid where id = m.id;
  return jsonb_build_object('result','ok','member_id',m.id);
end $$;
```

### 1.3 "Get my profile" (safe columns only — we do NOT open the members table to members)
```sql
create or replace function public.get_my_profile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'roll_number', m.roll_number,
    'email', m.email,
    'status', m.status,
    'photo_path', m.photo_path,
    'domain_id', m.domain_id,
    'domain_name', d.name,
    'domain_slug', d.slug,
    'has_pin', (p.member_id is not null),
    'pin_must_change', coalesce(p.must_change, false)
  ) into r
  from public.members m
  left join public.domains d on d.id = m.domain_id
  left join public.member_pins p on p.member_id = m.id
  where m.auth_user_id = auth.uid();
  return r;  -- null if not a member
end $$;
```
> This function references `member_pins`, created in 1.4. Run 1.4 first, then re-run 1.3 if it errors.

### 1.4 PIN storage (hashed, never readable)
```sql
create table if not exists public.member_pins (
  member_id    uuid primary key references public.members(id) on delete cascade,
  pin_hash     text not null,
  must_change  boolean not null default false,
  set_by       text not null default 'member' check (set_by in ('member','admin')),
  set_at       timestamptz not null default now(),
  failed_count int not null default 0,
  locked_until timestamptz
);
alter table public.member_pins enable row level security;   -- no policies = nobody can read it directly
revoke all on public.member_pins from anon, authenticated;

-- IP throttle for the PIN login function
create table if not exists public.pin_ip_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists pin_ip_attempts_ip_at on public.pin_ip_attempts (ip, at);
alter table public.pin_ip_attempts enable row level security;
revoke all on public.pin_ip_attempts from anon, authenticated;

-- Reject obvious PINs
create or replace function public.is_weak_pin(p text)
returns boolean language sql immutable as $$
  select p !~ '^\d{6}$'
      or p ~ '^(\d)\1{5}$'                                  -- 111111
      or position(p in '01234567890') > 0                   -- 123456, 234567…
      or position(p in '09876543210') > 0                   -- 654321…
      or p in ('121212','112233','123123','696969','000123','100000','123321','111222');
$$;

-- Member sets/changes their own PIN (must be logged in as a member)
create or replace function public.set_my_pin(new_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare mid uuid := public.current_member_id();
begin
  if mid is null then raise exception 'not_a_member'; end if;
  if new_pin !~ '^\d{6}$' then raise exception 'invalid_pin'; end if;
  if public.is_weak_pin(new_pin) then raise exception 'weak_pin'; end if;
  insert into public.member_pins (member_id, pin_hash, must_change, set_by)
  values (mid, crypt(new_pin, gen_salt('bf', 10)), false, 'member')
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash, must_change = false, set_by = 'member',
        set_at = now(), failed_count = 0, locked_until = null;
  return jsonb_build_object('ok', true);
end $$;

-- Admin generates a temporary PIN. Returns it ONCE. Member must change it at first login.
create or replace function public.admin_reset_member_pin(p_member uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare pin text; b bytea;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.members where id = p_member) then raise exception 'not_found'; end if;
  loop
    b := gen_random_bytes(4);
    pin := lpad(((get_byte(b,0)::bigint*16777216 + get_byte(b,1)*65536 + get_byte(b,2)*256 + get_byte(b,3)) % 1000000)::text, 6, '0');
    exit when not public.is_weak_pin(pin);
  end loop;
  insert into public.member_pins (member_id, pin_hash, must_change, set_by)
  values (p_member, crypt(pin, gen_salt('bf', 10)), true, 'admin')
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash, must_change = true, set_by = 'admin',
        set_at = now(), failed_count = 0, locked_until = null;
  return pin;
end $$;

create or replace function public.admin_remove_member_pin(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.member_pins where member_id = p_member;
end $$;

-- Used ONLY by the pin-login Edge Function (service role). Locks after 5 wrong tries for 15 min.
create or replace function public.verify_member_pin(p_roll text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m record; pr record;
begin
  select id, email, auth_user_id into m
  from public.members where upper(trim(roll_number)) = upper(trim(p_roll));
  if not found then return jsonb_build_object('result','invalid'); end if;

  select * into pr from public.member_pins where member_id = m.id;
  if not found then return jsonb_build_object('result','invalid'); end if;

  if pr.locked_until is not null and pr.locked_until > now() then
    return jsonb_build_object('result','locked','until',pr.locked_until);
  end if;

  if pr.pin_hash = crypt(p_pin, pr.pin_hash) then
    update public.member_pins set failed_count = 0, locked_until = null where member_id = m.id;
    return jsonb_build_object('result','ok','member_id',m.id,'email',m.email,
                              'auth_user_id',m.auth_user_id,'must_change',pr.must_change);
  end if;

  update public.member_pins
     set failed_count = case when failed_count + 1 >= 5 then 0 else failed_count + 1 end,
         locked_until = case when failed_count + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where member_id = m.id;
  return jsonb_build_object('result','invalid');
end $$;

-- Used by pin-login to find an existing auth user by email
create or replace function public.auth_uid_by_email(p_email text)
returns uuid language sql security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
```

### 1.5 Announcements
```sql
create table if not exists public.announcements (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 120),
  body           text not null check (char_length(body) between 1 and 2000),
  audience       text not null default 'all' check (audience in ('all','domain')),
  domain_id      uuid references public.domains(id) on delete cascade,
  pinned         boolean not null default false,
  link_url       text check (link_url is null or link_url ~* '^https?://'),
  published_at   timestamptz not null default now(),
  expires_at     timestamptz,
  push_sent_at   timestamptz,
  push_sent_count int,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint ann_audience_chk check (
    (audience = 'all' and domain_id is null) or (audience = 'domain' and domain_id is not null)),
  constraint ann_expiry_chk check (expires_at is null or expires_at > published_at)
);
create index if not exists ann_pub_idx on public.announcements (published_at desc);

alter table public.announcements enable row level security;

create policy ann_member_read on public.announcements for select to authenticated
using (
  public.is_active_member()
  and published_at <= now()
  and (expires_at is null or expires_at > now())
  and (audience = 'all' or domain_id in (select public.my_domain_ids()))
);
create policy ann_admin_all on public.announcements for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Read receipts (for the unread badge)
create table if not exists public.announcement_reads (
  member_id       uuid not null references public.members(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (member_id, announcement_id)
);
alter table public.announcement_reads enable row level security;
create policy reads_own_select on public.announcement_reads for select to authenticated
  using (member_id = public.current_member_id());
create policy reads_own_insert on public.announcement_reads for insert to authenticated
  with check (member_id = public.current_member_id());
create policy reads_admin_select on public.announcement_reads for select to authenticated
  using (public.is_admin());
```

### 1.6 Events + attendance
```sql
create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 120),
  description           text check (description is null or char_length(description) <= 2000),
  venue                 text check (venue is null or char_length(venue) <= 120),
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  audience              text not null default 'all' check (audience in ('all','domain')),
  domain_id             uuid references public.domains(id) on delete cascade,
  attendance_opens_at   timestamptz,    -- default: 30 min before start
  attendance_closes_at  timestamptz,    -- default: end time, or start + 3h
  reminder_minutes      int not null default 30 check (reminder_minutes between 5 and 1440),
  reminder_sent_at      timestamptz,
  cancelled             boolean not null default false,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  constraint ev_audience_chk check (
    (audience = 'all' and domain_id is null) or (audience = 'domain' and domain_id is not null)),
  constraint ev_time_chk check (ends_at is null or ends_at > starts_at)
);
create index if not exists events_start_idx on public.events (starts_at);

-- The check-in code lives in its OWN table so members can never read it
create table if not exists public.event_codes (
  event_id uuid primary key references public.events(id) on delete cascade,
  code     text not null
);
alter table public.event_codes enable row level security;
create policy codes_admin_all on public.event_codes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.gen_checkin_code()
returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; i int;
begin
  for i in 1..6 loop s := s || substr(chars, 1 + floor(random()*length(chars))::int, 1); end loop;
  return s;
end $$;

create or replace function public.trg_event_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_codes (event_id, code) values (new.id, public.gen_checkin_code())
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists event_code_ins on public.events;
create trigger event_code_ins after insert on public.events
  for each row execute function public.trg_event_code();

alter table public.events enable row level security;
create policy ev_member_read on public.events for select to authenticated
using (
  public.is_active_member()
  and (audience = 'all' or domain_id in (select public.my_domain_ids()))
);
create policy ev_admin_all on public.events for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create table if not exists public.attendance (
  event_id      uuid not null references public.events(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method        text not null default 'code' check (method in ('code','admin')),
  marked_by     uuid references auth.users(id) on delete set null,
  primary key (event_id, member_id)
);
create index if not exists attendance_member_idx on public.attendance (member_id);
alter table public.attendance enable row level security;
create policy att_own_select on public.attendance for select to authenticated
  using (member_id = public.current_member_id());
create policy att_admin_all on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- NOTE: no INSERT policy for members. They can only check in through check_in().

-- Wrong-code throttle
create table if not exists public.checkin_fails (
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  fails int not null default 0,
  locked_until timestamptz,
  primary key (event_id, member_id)
);
alter table public.checkin_fails enable row level security;
revoke all on public.checkin_fails from anon, authenticated;

create or replace function public.check_in(p_event uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.members%rowtype; e public.events%rowtype;
  opens timestamptz; closes timestamptz; real_code text; f public.checkin_fails%rowtype;
begin
  select * into m from public.members where auth_user_id = auth.uid();
  if not found then return jsonb_build_object('result','not_member'); end if;
  if m.status <> 'approved' then return jsonb_build_object('result','not_approved'); end if;

  select * into e from public.events where id = p_event;
  if not found then return jsonb_build_object('result','not_found'); end if;
  if e.cancelled then return jsonb_build_object('result','cancelled'); end if;
  if e.audience = 'domain' and e.domain_id is distinct from m.domain_id then
    return jsonb_build_object('result','not_eligible');
  end if;

  if exists (select 1 from public.attendance where event_id = e.id and member_id = m.id) then
    return jsonb_build_object('result','already');
  end if;

  opens  := coalesce(e.attendance_opens_at,  e.starts_at - interval '30 minutes');
  closes := coalesce(e.attendance_closes_at, coalesce(e.ends_at, e.starts_at + interval '3 hours'));
  if now() < opens  then return jsonb_build_object('result','not_open_yet','opens_at',opens); end if;
  if now() > closes then return jsonb_build_object('result','closed'); end if;

  select * into f from public.checkin_fails where event_id = e.id and member_id = m.id;
  if found and f.locked_until is not null and f.locked_until > now() then
    return jsonb_build_object('result','locked','until',f.locked_until);
  end if;

  select code into real_code from public.event_codes where event_id = e.id;
  if real_code is null or upper(trim(p_code)) <> real_code then
    insert into public.checkin_fails (event_id, member_id, fails) values (e.id, m.id, 1)
    on conflict (event_id, member_id) do update
      set fails = case when public.checkin_fails.fails + 1 >= 8 then 0 else public.checkin_fails.fails + 1 end,
          locked_until = case when public.checkin_fails.fails + 1 >= 8 then now() + interval '10 minutes'
                              else public.checkin_fails.locked_until end;
    return jsonb_build_object('result','wrong_code');
  end if;

  insert into public.attendance (event_id, member_id, method) values (e.id, m.id, 'code')
  on conflict do nothing;
  return jsonb_build_object('result','ok');
end $$;

-- Admin: make a fresh code (e.g. if it leaked)
create or replace function public.admin_regen_checkin_code(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text := public.gen_checkin_code();
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.event_codes (event_id, code) values (p_event, c)
  on conflict (event_id) do update set code = excluded.code;
  return c;
end $$;
```

### 1.7 Push subscriptions + settings
```sql
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_sub_member_idx on public.push_subscriptions (member_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
declare mid uuid := public.current_member_id();
begin
  if mid is null then raise exception 'not_a_member'; end if;
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth, user_agent)
  values (mid, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update
    set member_id = excluded.member_id,   -- same phone, different member → moves to the new one
        p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions
  where endpoint = p_endpoint and member_id = public.current_member_id();
end $$;

create table if not exists public.member_settings (
  member_id          uuid primary key references public.members(id) on delete cascade,
  push_announcements boolean not null default true,
  push_events        boolean not null default true,
  updated_at         timestamptz not null default now()
);
alter table public.member_settings enable row level security;
create policy set_own_select on public.member_settings for select to authenticated
  using (member_id = public.current_member_id());
create policy set_own_insert on public.member_settings for insert to authenticated
  with check (member_id = public.current_member_id());
create policy set_own_update on public.member_settings for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

-- Who should receive a push (used by send-push, service role only)
create or replace function public.push_targets(p_domain uuid, p_kind text)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql security definer set search_path = public as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.members m on m.id = s.member_id
  left join public.member_settings st on st.member_id = m.id
  where m.status = 'approved'
    and (p_domain is null or m.domain_id = p_domain)
    and case p_kind when 'announcement' then coalesce(st.push_announcements, true)
                    else coalesce(st.push_events, true) end;
$$;

-- Events whose reminder is due, claimed atomically so a reminder is never sent twice
create or replace function public.claim_due_event_reminders()
returns setof public.events language sql security definer set search_path = public as $$
  update public.events e set reminder_sent_at = now()
  where e.reminder_sent_at is null and e.cancelled = false
    and e.starts_at > now()
    and e.starts_at - (e.reminder_minutes * interval '1 minute') <= now()
  returning e.*;
$$;
```

### 1.8 Admin helper RPCs for the Members pop-up
```sql
-- Login/PIN/device status for ONE member
create or replace function public.admin_member_app_status(p_member uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'linked',        (m.auth_user_id is not null),
    'google_linked', exists (select 1 from auth.identities i where i.user_id = m.auth_user_id and i.provider = 'google'),
    'has_pin',       (p.member_id is not null),
    'pin_set_at',    p.set_at,
    'pin_set_by',    p.set_by,
    'pin_must_change', coalesce(p.must_change,false),
    'pin_locked_until', p.locked_until,
    'devices',       (select count(*) from public.push_subscriptions s where s.member_id = m.id),
    'last_sign_in',  (select last_sign_in_at from auth.users u where u.id = m.auth_user_id)
  ) into r
  from public.members m left join public.member_pins p on p.member_id = m.id
  where m.id = p_member;
  return r;
end $$;

-- Cheap badge data for the members LIST: which members have set up the app
create or replace function public.admin_members_app_flags()
returns table (member_id uuid, linked boolean, has_pin boolean, devices int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select m.id, (m.auth_user_id is not null), (p.member_id is not null),
           (select count(*)::int from public.push_subscriptions s where s.member_id = m.id)
    from public.members m left join public.member_pins p on p.member_id = m.id;
end $$;

-- Detach a wrong login (e.g. member used a different Google account)
create or replace function public.admin_unlink_member_login(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.push_subscriptions where member_id = p_member;
  update public.members set auth_user_id = null where id = p_member;
end $$;

-- Unlock a member's PIN
create or replace function public.admin_unlock_member_pin(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.member_pins set failed_count = 0, locked_until = null where member_id = p_member;
end $$;
```

### 1.9 Storage: let a member see their OWN photo
```sql
create policy member_read_own_photo on storage.objects for select to authenticated
using (
  bucket_id = 'member-photos'
  and name = (select photo_path from public.members where auth_user_id = auth.uid())
);
```
(If your app shows photos through public URLs, skip this and reuse the same method the Success page uses.)

### 1.10 Permissions on every RPC (run last)
```sql
-- Block anonymous callers from everything member/admin related
revoke all on function public.claim_member()                  from public, anon;
revoke all on function public.get_my_profile()                from public, anon;
revoke all on function public.set_my_pin(text)                from public, anon;
revoke all on function public.check_in(uuid, text)            from public, anon;
revoke all on function public.save_push_subscription(text,text,text,text) from public, anon;
revoke all on function public.delete_push_subscription(text)  from public, anon;
revoke all on function public.admin_reset_member_pin(uuid)    from public, anon;
revoke all on function public.admin_remove_member_pin(uuid)   from public, anon;
revoke all on function public.admin_unlock_member_pin(uuid)   from public, anon;
revoke all on function public.admin_member_app_status(uuid)   from public, anon;
revoke all on function public.admin_members_app_flags()       from public, anon;
revoke all on function public.admin_unlink_member_login(uuid) from public, anon;
revoke all on function public.admin_regen_checkin_code(uuid)  from public, anon;
grant execute on function public.claim_member()                  to authenticated;
grant execute on function public.get_my_profile()                to authenticated;
grant execute on function public.set_my_pin(text)                to authenticated;
grant execute on function public.check_in(uuid, text)            to authenticated;
grant execute on function public.save_push_subscription(text,text,text,text) to authenticated;
grant execute on function public.delete_push_subscription(text)  to authenticated;
grant execute on function public.admin_reset_member_pin(uuid)    to authenticated;
grant execute on function public.admin_remove_member_pin(uuid)   to authenticated;
grant execute on function public.admin_unlock_member_pin(uuid)   to authenticated;
grant execute on function public.admin_member_app_status(uuid)   to authenticated;
grant execute on function public.admin_members_app_flags()       to authenticated;
grant execute on function public.admin_unlink_member_login(uuid) to authenticated;
grant execute on function public.admin_regen_checkin_code(uuid)  to authenticated;
-- (admin_* functions re-check is_admin() inside, so a normal member calling them just gets 'forbidden')

-- Service-role-only functions (called by Edge Functions)
revoke all on function public.verify_member_pin(text,text)  from public, anon, authenticated;
revoke all on function public.auth_uid_by_email(text)       from public, anon, authenticated;
revoke all on function public.push_targets(uuid,text)       from public, anon, authenticated;
revoke all on function public.claim_due_event_reminders()   from public, anon, authenticated;
grant execute on function public.verify_member_pin(text,text) to service_role;
grant execute on function public.auth_uid_by_email(text)      to service_role;
grant execute on function public.push_targets(uuid,text)      to service_role;
grant execute on function public.claim_due_event_reminders()  to service_role;
```

### 1.11 Effects on EXISTING behaviour (edge cases for the old features)
| Situation | What happens / what to do |
|---|---|
| **Admin deletes a member** (already built) | `member_pins`, `push_subscriptions`, `attendance`, `member_settings`, `announcement_reads` all cascade away. The member's **auth user stays** in Supabase Auth (harmless). If they re-register, the new row is claimed again by email. |
| **Member's email is changed via approved edit request** | Already-linked members stay linked (matching is by `auth_user_id`, not email). Only unlinked members are matched by email. |
| **Two members share one email** | `claim_member` returns `ambiguous` and refuses to guess. Admin must fix the duplicate email. |
| **Member registered with `v.edant@gmail.com`, Google gives `vedant@gmail.com`** | `norm_email` treats them as equal. |
| **Member registered with a non-Gmail address** (college email) | Google can't match unless they sign in with that same address. They use the PIN path, or admin edits their email. |
| **A person is admin AND member** | Works: same login. `/admin` checks `admins`, `/app` checks `members`. |
| **Domain removed** | Announcements/events targeted to it cascade-delete. Warn the admin in the delete confirmation if that domain has any. |
| **Supabase free project pauses after ~7 days of no activity** | Applies before launch. Open the dashboard weekly until real members use it. |

### 1.12 Roles: leads and co-leads (RBAC)

Run this block **after 1.10**. The new security policies are *added* next to the admin policies (Postgres ORs them together), so nothing above has to be edited.

**Model:** the `admins` table = super admins (unchanged). New table `domain_roles` = "this member is the lead / co-lead of this domain". Leads act only on their own domain. Only super admins can write to `domain_roles`, so nobody can promote themselves.

```sql
-- ---------- audit log (who did what) ----------
create table if not exists public.audit_log (
  id              bigint generated always as identity primary key,
  at              timestamptz not null default now(),
  actor_user_id   uuid,
  actor_member_id uuid,
  action          text not null,
  target_type     text,
  target_id       text,
  domain_id       uuid,
  details         jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy audit_admin_select on public.audit_log for select to authenticated using (public.is_admin());
-- no insert/update/delete policies: written only by the functions below / the Edge Function

create or replace function public.log_audit(p_action text, p_type text, p_target text, p_domain uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_user_id, actor_member_id, action, target_type, target_id, domain_id, details)
  values (auth.uid(), public.current_member_id(), p_action, p_type, p_target, p_domain, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.log_audit(text,text,text,uuid,jsonb) from public, anon, authenticated;

-- ---------- roles ----------
create table if not exists public.domain_roles (
  member_id   uuid not null references public.members(id) on delete cascade,
  domain_id   uuid not null references public.domains(id) on delete cascade,
  role        text not null check (role in ('lead','colead')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (member_id, domain_id)
);
-- exactly ONE lead per domain (co-leads unlimited)
create unique index if not exists one_lead_per_domain on public.domain_roles (domain_id) where role = 'lead';

alter table public.domain_roles enable row level security;
create policy roles_own_select  on public.domain_roles for select to authenticated using (member_id = public.current_member_id());
create policy roles_admin_all   on public.domain_roles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- A role stops counting if the member leaves that domain, so drop it when the domain changes
create or replace function public.trg_member_domain_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.domain_roles where member_id = new.id and domain_id is distinct from new.domain_id;
  return new;
end $$;
drop trigger if exists member_domain_change on public.members;
create trigger member_domain_change after update of domain_id on public.members
  for each row when (old.domain_id is distinct from new.domain_id)
  execute function public.trg_member_domain_change();

-- ---------- helper functions used by the policies ----------
-- Domains this person leads (only counts while they are an APPROVED member of that same domain)
create or replace function public.my_led_domain_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select r.domain_id
  from public.domain_roles r join public.members m on m.id = r.member_id
  where m.auth_user_id = auth.uid() and m.status = 'approved' and m.domain_id = r.domain_id;
$$;

create or replace function public.is_lead_of(p_domain uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_domain is not null and p_domain in (select public.my_led_domain_ids());
$$;

-- For the app: my roles
create or replace function public.get_my_roles()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('domain_id', r.domain_id, 'domain_name', d.name, 'role', r.role)), '[]'::jsonb)
  from public.domain_roles r
  join public.members m on m.id = r.member_id
  join public.domains d on d.id = r.domain_id
  where m.auth_user_id = auth.uid() and m.status = 'approved' and m.domain_id = r.domain_id;
$$;

-- For member profiles: "Your leads" card (members of the domain may see the lead's name + phone)
create or replace function public.get_my_domain_leads()
returns table (name text, role text, phone text)
language sql stable security definer set search_path = public as $$
  select m.name, r.role, m.phone
  from public.domain_roles r join public.members m on m.id = r.member_id
  where public.is_active_member()
    and r.domain_id in (select public.my_domain_ids())
    and m.status = 'approved' and m.domain_id = r.domain_id
  order by (r.role = 'lead') desc, m.name;
$$;

-- ---------- super admin assigns / removes roles (p_role = null removes) ----------
create or replace function public.admin_set_domain_role(p_member uuid, p_domain uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into m from public.members where id = p_member;
  if not found then raise exception 'not_found'; end if;

  if p_role is null then
    delete from public.domain_roles where member_id = p_member and domain_id = p_domain;
    perform public.log_audit('role_removed', 'member', p_member::text, p_domain, '{}'::jsonb);
    return;
  end if;

  if p_role not in ('lead','colead')  then raise exception 'invalid_role'; end if;
  if m.status <> 'approved'           then raise exception 'member_not_approved'; end if;
  if m.domain_id is distinct from p_domain then raise exception 'member_not_in_domain'; end if;
  if p_role = 'lead' and exists (select 1 from public.domain_roles
        where domain_id = p_domain and role = 'lead' and member_id <> p_member) then
    raise exception 'lead_exists';     -- demote the current lead first
  end if;

  insert into public.domain_roles (member_id, domain_id, role, assigned_by)
  values (p_member, p_domain, p_role, auth.uid())
  on conflict (member_id, domain_id) do update
    set role = excluded.role, assigned_by = excluded.assigned_by, assigned_at = now();
  perform public.log_audit('role_set', 'member', p_member::text, p_domain, jsonb_build_object('role', p_role));
end $$;

-- ---------- what a lead may see about their members (NO email, NO direct table access) ----------
create or replace function public.lead_domain_members(p_domain uuid)
returns table (id uuid, name text, roll_number text, phone text, photo_path text,
               on_app boolean, has_notifications boolean, attended int, total_events int)
language plpgsql stable security definer set search_path = public as $$
declare total int;
begin
  if not (public.is_admin() or public.is_lead_of(p_domain)) then raise exception 'forbidden'; end if;
  select count(*)::int into total from public.events e
   where not e.cancelled and e.starts_at < now() and (e.audience = 'all' or e.domain_id = p_domain);
  return query
    select m.id, m.name, m.roll_number, m.phone, m.photo_path,
           (m.auth_user_id is not null),
           exists (select 1 from public.push_subscriptions s where s.member_id = m.id),
           (select count(*)::int from public.attendance a join public.events e on e.id = a.event_id
             where a.member_id = m.id and not e.cancelled and e.starts_at < now()
               and (e.audience = 'all' or e.domain_id = p_domain)),
           total
    from public.members m
    where m.domain_id = p_domain and m.status = 'approved'
    order by m.name;
end $$;

-- ---------- lead write access: announcements (own domain only, never "everyone") ----------
create policy ann_lead_select on public.announcements for select to authenticated
  using (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));   -- also sees own scheduled/expired
create policy ann_lead_insert on public.announcements for insert to authenticated
  with check (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));
create policy ann_lead_update on public.announcements for update to authenticated
  using      (audience = 'domain' and domain_id in (select public.my_led_domain_ids()))
  with check (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));
create policy ann_lead_delete on public.announcements for delete to authenticated
  using (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));

alter table public.announcements add column if not exists push_sent_by uuid references auth.users(id) on delete set null;
alter table public.announcements alter column created_by set default auth.uid();
alter table public.events        alter column created_by set default auth.uid();

-- Leads must not be able to reset the "push already sent" markers (that would bypass the daily limit).
-- Column-level privileges: clients may update only the content columns. The Edge Function (service role) writes the rest.
revoke update on public.announcements from authenticated;
grant  update (title, body, audience, domain_id, pinned, link_url, published_at, expires_at) on public.announcements to authenticated;

-- Reminder marker: reset automatically when the start time changes; clients can't touch it
revoke update on public.events from authenticated;
grant  update (title, description, venue, starts_at, ends_at, audience, domain_id,
               attendance_opens_at, attendance_closes_at, reminder_minutes, cancelled) on public.events to authenticated;
create or replace function public.trg_event_time_reset() returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at and new.starts_at > now() then new.reminder_sent_at := null; end if;
  return new;
end $$;
drop trigger if exists event_time_reset on public.events;
create trigger event_time_reset before update on public.events for each row execute function public.trg_event_time_reset();

-- ---------- lead write access: events of own domain ----------
create policy ev_lead_select on public.events for select to authenticated
  using (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));
create policy ev_lead_insert on public.events for insert to authenticated
  with check (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));
create policy ev_lead_update on public.events for update to authenticated
  using      (audience = 'domain' and domain_id in (select public.my_led_domain_ids()))
  with check (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));
create policy ev_lead_delete on public.events for delete to authenticated
  using (audience = 'domain' and domain_id in (select public.my_led_domain_ids()));

-- check-in code of their own events
create policy codes_lead_select on public.event_codes for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_codes.event_id
                  and e.audience = 'domain' and public.is_lead_of(e.domain_id)));

-- regenerate the code: super admin OR lead of that event's domain (replaces the version in 1.6)
create or replace function public.admin_regen_checkin_code(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; c text := public.gen_checkin_code();
begin
  select * into e from public.events where id = p_event;
  if not found then raise exception 'not_found'; end if;
  if not (public.is_admin() or (e.audience = 'domain' and public.is_lead_of(e.domain_id))) then
    raise exception 'forbidden';
  end if;
  insert into public.event_codes (event_id, code) values (p_event, c)
  on conflict (event_id) do update set code = excluded.code;
  perform public.log_audit('checkin_code_regenerated', 'event', p_event::text, e.domain_id, '{}'::jsonb);
  return c;
end $$;

-- ---------- lead attendance: view, mark present (only their own domain's members), remove ----------
create policy att_lead_select on public.attendance for select to authenticated
  using (exists (select 1 from public.events e where e.id = attendance.event_id
                  and e.audience = 'domain' and public.is_lead_of(e.domain_id)));
create policy att_lead_insert on public.attendance for insert to authenticated
  with check (
    attendance.method = 'admin' and attendance.marked_by = auth.uid()
    and exists (select 1 from public.events e join public.members mm on mm.id = attendance.member_id
                 where e.id = attendance.event_id and e.audience = 'domain'
                   and public.is_lead_of(e.domain_id) and mm.domain_id = e.domain_id and mm.status = 'approved'));
create policy att_lead_delete on public.attendance for delete to authenticated
  using (exists (select 1 from public.events e where e.id = attendance.event_id
                  and e.audience = 'domain' and public.is_lead_of(e.domain_id)));

-- ---------- audit: log deletions of announcements and events automatically ----------
create or replace function public.trg_audit_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit(tg_table_name || '_deleted', tg_table_name, old.id::text, old.domain_id, jsonb_build_object('title', old.title));
  return old;
end $$;
drop trigger if exists audit_ann_del on public.announcements;
create trigger audit_ann_del before delete on public.announcements for each row execute function public.trg_audit_delete();
drop trigger if exists audit_ev_del on public.events;
create trigger audit_ev_del before delete on public.events for each row execute function public.trg_audit_delete();

-- ---------- permissions ----------
revoke all on function public.my_led_domain_ids()                   from public, anon;
revoke all on function public.is_lead_of(uuid)                      from public, anon;
revoke all on function public.get_my_roles()                        from public, anon;
revoke all on function public.get_my_domain_leads()                 from public, anon;
revoke all on function public.admin_set_domain_role(uuid,uuid,text) from public, anon;
revoke all on function public.lead_domain_members(uuid)             from public, anon;
grant execute on function public.my_led_domain_ids()                   to authenticated;
grant execute on function public.is_lead_of(uuid)                      to authenticated;
grant execute on function public.get_my_roles()                        to authenticated;
grant execute on function public.get_my_domain_leads()                 to authenticated;
grant execute on function public.admin_set_domain_role(uuid,uuid,text) to authenticated;
grant execute on function public.lead_domain_members(uuid)             to authenticated;
```

**Also add audit lines** (one line each, inside the existing functions, right before their `return`/`end`) so sensitive admin actions are recorded:
- in `admin_reset_member_pin`: `perform public.log_audit('pin_reset','member',p_member::text,null,'{}'::jsonb);`
- in `admin_remove_member_pin`: `perform public.log_audit('pin_removed','member',p_member::text,null,'{}'::jsonb);`
- in `admin_unlink_member_login`: `perform public.log_audit('login_unlinked','member',p_member::text,null,'{}'::jsonb);`

**Things leads can NOT do (by design, enforced in the database):** create anything for audience "everyone"; touch another domain; read the `members` table or any email; approve/reject/edit/delete members; see or reset PINs; read `member_pins`, `push_subscriptions`, `admins`, `domain_roles` of others, or the audit log; change roles; reset push markers; read check-in codes of other domains' events; mark attendance for members of other domains.

**Edge cases handled by this block**
| Case | What happens |
|---|---|
| Lead moves to another domain | Trigger deletes the old role immediately |
| Lead's status stops being `approved` (e.g. removed from the club) | `my_led_domain_ids()` returns nothing, so every lead power disappears at once |
| Member deleted | `domain_roles` cascades away |
| Domain deleted | Roles, announcements and events of that domain cascade away |
| Second "lead" assigned to a domain | Blocked (`lead_exists`); admin demotes the current lead first. Co-leads are unlimited |
| Role assigned to a member who isn't in that domain, or isn't approved | Blocked (`member_not_in_domain`, `member_not_approved`) |
| Lead tries `insert into domain_roles` from the browser console | Denied: no write policy for non-admins |
| Lead tries `update announcements set push_sent_at = null` | Denied: column not updatable |
| Lead creates an announcement/event with `audience = 'all'` | Denied by the policy |
| Lead edits an event the super admin created for their domain | Allowed (it belongs to their domain). Events for "everyone" are read-only for them |
| Person is both a super admin and a lead | Both sets of policies apply; admin wins |

### 1.13 Digital ID card: public ID, membership number, verify and scan

Run this block **after 1.12** (it uses `is_admin()` and `is_lead_of()`).

> Assumption: `public.members.created_at` exists (used for "member since"). If your column is named differently, change it below.
> Note: the generated-column and default use `gen_random_bytes`, from the `pgcrypto` extension enabled in 1.1.

```sql
-- 1) unguessable public ID (18 hex chars = 72 bits) + sequential membership number
alter table public.members add column if not exists public_id text;
update public.members set public_id = encode(gen_random_bytes(9), 'hex') where public_id is null;
alter table public.members alter column public_id set default encode(gen_random_bytes(9), 'hex');
alter table public.members alter column public_id set not null;
create unique index if not exists members_public_id_key on public.members (public_id);

alter table public.members add column if not exists member_no int generated always as identity;
create unique index if not exists members_member_no_key on public.members (member_no);
-- Display format in the app: 'SMB4-' || lpad(member_no::text, 4, '0')   e.g. SMB4-0042

-- 2) get_my_profile now also returns the ID card fields (replaces the version in 1.3)
create or replace function public.get_my_profile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'roll_number', m.roll_number,
    'email', m.email,
    'status', m.status,
    'photo_path', m.photo_path,
    'domain_id', m.domain_id,
    'domain_name', d.name,
    'domain_slug', d.slug,
    'has_pin', (p.member_id is not null),
    'pin_must_change', coalesce(p.must_change, false),
    'public_id', m.public_id,
    'member_no', m.member_no,
    'joined_at', m.created_at,
    'role', (select r2.role from public.domain_roles r2
              where r2.member_id = m.id and r2.domain_id = m.domain_id
              order by (r2.role = 'lead') desc limit 1)
  ) into r
  from public.members m
  left join public.domains d on d.id = m.domain_id
  left join public.member_pins p on p.member_id = m.id
  where m.auth_user_id = auth.uid();
  return r;
end $$;

-- 3) PUBLIC verification (anyone with the QR link). Minimal data only.
create or replace function public.verify_member(p_public_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v record; can_see boolean;
begin
  if p_public_id is null or p_public_id !~ '^[0-9a-f]{18}$' then
    return jsonb_build_object('result', 'invalid');
  end if;

  select mm.id, mm.name, mm.status, mm.member_no, mm.domain_id, mm.photo_path, mm.created_at,
         d.name as domain_name,
         (select r.role from public.domain_roles r
           where r.member_id = mm.id and r.domain_id = mm.domain_id
           order by (r.role = 'lead') desc limit 1) as role
    into v
    from public.members mm left join public.domains d on d.id = mm.domain_id
   where mm.public_id = p_public_id;

  if not found then return jsonb_build_object('result', 'invalid'); end if;

  -- photo only for super admins and the lead/co-lead of the member's own domain
  can_see := public.is_admin() or public.is_lead_of(v.domain_id);

  return jsonb_build_object(
    'result',       case when v.status = 'approved' then 'valid' else 'inactive' end,
    'name',         v.name,
    'domain_name',  v.domain_name,
    'role',         v.role,
    'member_no',    v.member_no,
    'member_since', extract(year from v.created_at)::int,
    'photo_path',   case when can_see then v.photo_path else null end
  );
end $$;
revoke all on function public.verify_member(text) from public;
grant execute on function public.verify_member(text) to anon, authenticated;

-- 4) STAFF scan check-in: super admin (any event) or lead/co-lead (events of their own domain)
alter table public.attendance drop constraint if exists attendance_method_check;
alter table public.attendance add  constraint attendance_method_check check (method in ('code','admin','scan'));

create or replace function public.scan_check_in(p_event uuid, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; m public.members%rowtype; ref text := trim(coalesce(p_ref, ''));
begin
  select * into e from public.events where id = p_event;
  if not found then return jsonb_build_object('result', 'event_not_found'); end if;
  if not (public.is_admin() or (e.audience = 'domain' and public.is_lead_of(e.domain_id))) then
    return jsonb_build_object('result', 'forbidden');
  end if;
  if e.cancelled then return jsonb_build_object('result', 'cancelled'); end if;

  if ref ~ '^[0-9a-f]{18}$' then
    select * into m from public.members where public_id = ref;
  elsif ref ~ '^[0-9]{1,9}$' then
    select * into m from public.members where member_no = ref::int;   -- manual entry by membership number
  else
    return jsonb_build_object('result', 'invalid');
  end if;
  if not found then return jsonb_build_object('result', 'invalid'); end if;

  if m.status <> 'approved' then
    return jsonb_build_object('result', 'inactive', 'name', m.name);
  end if;
  if e.audience = 'domain' and e.domain_id is distinct from m.domain_id then
    return jsonb_build_object('result', 'not_eligible', 'name', m.name);
  end if;
  if exists (select 1 from public.attendance where event_id = e.id and member_id = m.id) then
    return jsonb_build_object('result', 'already', 'name', m.name);
  end if;

  insert into public.attendance (event_id, member_id, method, marked_by)
  values (e.id, m.id, 'scan', auth.uid()) on conflict do nothing;
  return jsonb_build_object('result', 'ok', 'name', m.name, 'member_id', m.id);
end $$;
revoke all on function public.scan_check_in(uuid, text) from public, anon;
grant execute on function public.scan_check_in(uuid, text) to authenticated;
-- Staff scanning intentionally ignores the member attendance window (staff decide at the door).

-- 5) Super admin can replace a leaked ID (old QR codes then show "Not found")
create or replace function public.admin_regen_public_id(p_member uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare pid text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.members set public_id = encode(gen_random_bytes(9), 'hex')
   where id = p_member returning public_id into pid;
  if pid is null then raise exception 'not_found'; end if;
  perform public.log_audit('id_regenerated', 'member', p_member::text, null, '{}'::jsonb);
  return pid;
end $$;
revoke all on function public.admin_regen_public_id(uuid) from public, anon;
grant execute on function public.admin_regen_public_id(uuid) to authenticated;

-- 6) Leads may load the PHOTO of members of their own domain only (for the scanner / verify page)
create policy lead_read_domain_photos on storage.objects for select to authenticated
using (
  bucket_id = 'member-photos'
  and name in (select photo_path from public.members
                where photo_path is not null
                  and domain_id in (select public.my_led_domain_ids()))
);
```

**Design notes**
- The public ID is random and 72 bits long, so it cannot be guessed or enumerated. That is why `verify_member` needs no IP rate limit. The roll number and the sequential membership number are **never** put in the QR.
- A removed member's row is deleted, so their old QR immediately shows "Not found". A member who is not `approved` shows "Not active".
- A screenshot of someone's QR still verifies as valid. That is acceptable because the verifier sees the **name** (and, for staff, the **photo**) and can match it to the person in front of them, exactly like a paper ID. The live clock and shimmer on the card (4B) are an extra visual hint that the screen is live.
- Membership numbers are sequential and guessable, so they are only accepted by `scan_check_in` (staff only) and are never a way to look up data publicly.

### Done when (Phase 1)
- All SQL ran without errors.
- `select * from public.admin_members_app_flags();` run **as you in the app** (not the SQL editor) works; run as a non-admin it errors with `forbidden`.
- Re-run the Phase 0 policy query: every new table has RLS on (`rowsecurity = true`).

---

## Phase 2 — Make it an installable PWA

### 2.1 Install
```bash
npm i -D vite-plugin-pwa workbox-precaching workbox-routing workbox-core
npm i -D @vite-pwa/assets-generator
```
> Your project uses **Vite 8**. If npm complains about a `vite-plugin-pwa` peer-dependency, ask your AI to check the latest `vite-plugin-pwa` release notes for Vite 8 support before forcing anything (`--legacy-peer-deps` only as a last resort).

### 2.2 Icons
Create **one** square logo `public/logo-source.png` (≥ 1024×1024, content kept inside the middle 80% so it survives rounding). Generate:
```bash
npx pwa-assets-generator --preset minimal-2023 public/logo-source.png
```
You need (in `public/icons/`):
- `icon-192.png`, `icon-512.png` (normal)
- `icon-512-maskable.png` (full-bleed background colour, logo within the centre 60%)
- `apple-touch-icon.png` (180×180, **no transparency** — iOS fills transparent with black)
- `badge-72.png` (monochrome white-on-transparent, used by Android notification bar)

### 2.3 `vite.config.ts` (add the plugin)
```ts
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  strategies: 'injectManifest',     // we write our own service worker (needed for push)
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'prompt',           // never reload a user mid-form; we show an "Update" bar
  injectRegister: false,
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'] },
  manifest: {
    id: '/app',
    name: 'Sambhav 4.0 Members',
    short_name: 'Sambhav',
    description: 'Announcements, events and attendance for Sambhav members.',
    start_url: '/app?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5efe1',
    theme_color: '#1b1b3a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Announcements', url: '/app/announcements' },
      { name: 'Events', url: '/app/events' },
    ],
  },
  devOptions: { enabled: false },   // test the PWA with `npm run build && npm run preview`
})
```
Add to `tsconfig.app.json`: `"types": ["vite/client", "vite-plugin-pwa/react"]` and put `"src/sw.ts"` under `exclude` (it needs the `webworker` lib, the app needs `dom`).

### 2.4 `index.html` `<head>`
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#1b1b3a" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Sambhav" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```
In CSS, keep content clear of notches and the home bar: `padding-bottom: env(safe-area-inset-bottom)` on the bottom tab bar, `padding-top: env(safe-area-inset-top)` on the top bar.

### 2.5 `src/sw.ts` (service worker: offline shell + push)
```ts
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);          // only the built app files

// SPA: every page navigation gets index.html (offline too)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/supabase-proxy/, /^\/api\//],
}));
// IMPORTANT: no runtime caching of Supabase / API calls. Auth tokens and private data must
// never be cached by the service worker. Cross-origin requests pass straight to the network.

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ----- Push -----
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sambhav', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag,                 // same tag replaces an older notification instead of stacking
      data: { url: data.url || '/app' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        await w.focus();
        await (w as WindowClient).navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
```
Security: only same-origin URLs are opened (the `new URL(..., origin)` plus origin check prevents a notification from sending someone to another site).

### 2.6 Register + "Update available" bar
`src/components/UpdatePrompt.tsx`
```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => reg.update(), 60 * 60 * 1000);                 // hourly check
      document.addEventListener('visibilitychange', () => {            // and when the app is reopened
        if (document.visibilityState === 'visible') reg.update();
      });
    },
  });
  if (!needRefresh) return null;
  return (
    <div role="status" className="update-bar">
      <span>A new version is ready.</span>
      <button onClick={() => updateServiceWorker(true)}>Update</button>
      <button onClick={() => setNeedRefresh(false)} aria-label="Dismiss">✕</button>
    </div>
  );
}
```
Mount `<UpdatePrompt />` once in `App.tsx` inside `AppInner`.

### 2.7 Install prompt hook
`src/hooks/useInstall.ts`
```tsx
import { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function useInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return {
    isStandalone: standalone || installed,
    canPrompt: !!deferred,                       // Android/desktop Chrome
    showIOSHint: isIOS && !standalone,           // iOS has no prompt: show "Share → Add to Home Screen"
    promptInstall,
  };
}
```
Show an **Install banner** on Login and Home: hidden if `isStandalone`; "Install" button if `canPrompt`; the iOS 3-step hint if `showIOSHint`; the user can dismiss it, remembered for 7 days in `localStorage` (wrapped in try/catch).

### 2.8 `vercel.json`
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/sw.js", "headers": [
      { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
      { "key": "Service-Worker-Allowed", "value": "/" } ] },
    { "source": "/manifest.webmanifest", "headers": [
      { "key": "Cache-Control", "value": "no-cache" } ] }
  ]
}
```
(Vercel serves real files, like `/sw.js`, before applying the rewrite.)

### 2.9 Offline behaviour (what "works offline" means here)
- The **app shell** opens offline (precached).
- Data pages show the **last successfully loaded data** with a "You're offline — showing saved data" banner. Implement a tiny cache helper (`cacheGet/cacheSet` over `localStorage`, key `sx:v1:<memberId>:<name>`, each wrapped in try/catch). Cache: profile, last 20 announcements, upcoming events. Clear it all on logout.
- Actions that need the network (check-in, save settings, set PIN) must say "You're offline" and disable the button instead of failing silently.

### 2.10 Edge cases
| Case | Handling |
|---|---|
| iPhone / Safari | No install prompt exists. Show the manual hint. Push only works **after** installing to the Home Screen (iOS 16.4+). |
| App already installed | Hide every install UI (`isStandalone`). |
| Browser doesn't support service workers (very old / some in-app browsers) | The site must still work normally. Never assume `navigator.serviceWorker` exists. |
| Old service worker serving old code after a deploy | `registerType: 'prompt'` + hourly/visibility update checks + the Update bar. `sw.js` is served with no-cache. |
| Update arrives while the member is typing a PIN or a form | Never auto-reload; the user taps Update when ready. |
| `localStorage` blocked (private mode) | Every read/write in try/catch; the app still works, just without offline cache. |
| User uninstalls the app | Nothing to do; next visit works in the browser. |
| Opening a `/app/...` link while logged out | Login → after success, return to the original link (`state.from`). |

### Done when (Phase 2)
`npm run build && npm run preview`, open in Chrome → DevTools → Application → **Manifest shows no errors, Service Worker is "activated"**, and Lighthouse → "Installable" passes. On a real Android phone (HTTPS Vercel preview), Chrome offers **Install**. Turning on airplane mode and reopening the installed app shows the shell, not the dinosaur.

---

## Phase 3 — Authentication (Google + PIN backup)

### 3.1 Google setup (one-time, ~10 minutes)
1. <https://console.cloud.google.com> → create a project "Sambhav".
2. **APIs & Services → OAuth consent screen** → User type **External** → app name, support email, developer email. Scopes: only `openid`, `email`, `profile` (no verification needed).
3. **IMPORTANT:** click **Publish app** (move from *Testing* to *In production*). In *Testing* mode only 100 hand-added test users can sign in and logins expire after 7 days.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: your Vercel URL (e.g. `https://sambhav.vercel.app`) and `http://localhost:3000`
   - Authorized redirect URI: `https://cshmcevqedzveldnrgmq.supabase.co/auth/v1/callback`
5. Supabase → **Authentication → Providers → Google** → enable, paste Client ID + Secret.
6. Supabase → **Authentication → URL Configuration**:
   - Site URL: your Vercel URL
   - Redirect URLs: `https://<vercel-url>/auth/callback`, `http://localhost:3000/auth/callback`
7. Supabase → **Authentication → Sign In / Providers**: make sure "Allow new users to sign up" is **ON** (Google needs it) and "Confirm email" doesn't matter for Google. Keep "Link accounts with the same email" at its default (on) so a PIN-created account and a later Google login become the same account.

### 3.2 The member state machine
```
signed_out ──Google or PIN──► signed_in
signed_in ──claim_member()──►
   ok            → get_my_profile()
        status = 'approved'  → READY   (show the app)
        status = anything else → PENDING screen
        pin_must_change = true → force /app/set-pin first
   not_found     → BLOCKED "not_found"       (+ if is_admin(): offer "Go to admin")
   ambiguous     → BLOCKED "ambiguous"
   already_linked→ BLOCKED "already_linked"
   unverified_email → BLOCKED "unverified"
   error         → BLOCKED "error" with Retry
```

`src/contexts/MemberContext.tsx` — responsibilities:
- On mount: `supabase.auth.getSession()` and subscribe to `onAuthStateChange`.
- **Do not call other Supabase methods directly inside the `onAuthStateChange` callback** (it can deadlock). Use `setTimeout(() => loadMember(), 0)` inside the callback.
- `loadMember()` → `rpc('claim_member')` → if `ok` → `rpc('get_my_profile')` → set state (kinds: `loading | signed_out | blocked | ready`).
- After the profile loads, also call `rpc('get_my_roles')` (see 1.12) and keep `roles` in the context (empty array for normal members).
- Re-fetch the profile **and roles** whenever the app becomes visible again (`visibilitychange`) and whenever the user opens a `/app/lead/*` page. This makes a revoked role disappear quickly. (The server blocks the actions immediately anyway.)
- Expose: `state`, `member`, `roles`, `refresh()`, `signOut()`.
- Guard against races: keep a request counter; ignore results from stale calls (login → logout quickly).
- `signOut()`: delete this device's push subscription (RPC `delete_push_subscription`), `supabase.auth.signOut()`, clear `sx:v1:*` from localStorage, navigate to `/app/login`.

Mount `<MemberProvider>` next to `AdminProvider` in `App.tsx`.

`src/components/MemberGuard.tsx` — wraps all `/app/*` routes except `/app/login`:
```tsx
// pseudo
if (state.kind === 'loading')    return <Splash />;
if (state.kind === 'signed_out') return <Navigate to="/app/login" state={{ from: location }} replace />;
if (state.kind === 'blocked')    return <BlockedScreen reason={state.reason} onRetry={refresh} />;
if (member.status !== 'approved') return <PendingScreen member={member} onRefresh={refresh} />;
if (member.pin_must_change && location.pathname !== '/app/set-pin')
                                  return <Navigate to="/app/set-pin" replace />;
return <Outlet />;
```

### 3.3 Login page — `/app/login`
**Layout:** logo, title "Members login", one big **Continue with Google** button, divider "or", a collapsible "Use roll number + PIN" form, Install banner, small links "Not registered yet? Register" and "Need help?" (reuse `HelpFooter`).

**Google button handler**
```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { prompt: 'select_account' },   // lets them choose the right Gmail
  },
});
```

**PIN form handler** (calls the Edge Function, then turns the result into a real session):
```ts
const { data, error } = await supabase.functions.invoke('pin-login', { body: { roll, pin } });
// success → data = { token_hash }
const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
// (if the installed supabase-js version rejects 'magiclink', use type: 'email')
```

**Edge cases for the login page**
| Case | Handling |
|---|---|
| Opened inside Instagram / WhatsApp / Facebook in-app browser | Google blocks OAuth there ("disallowed_useragent"). Detect with `/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i`; show a banner "Open this link in Chrome/Safari" with a **Copy link** button, and steer them to the PIN form. |
| Already signed in and visits `/app/login` | Redirect straight to `/app`. |
| Offline (`!navigator.onLine`) | Disable both methods, show "No internet connection". |
| Roll number typed in lowercase / with spaces | `trim().toUpperCase()` before sending. |
| PIN field | `inputMode="numeric"`, `maxLength=6`, `autoComplete="one-time-code"` off → use `autoComplete="current-password"`; strip non-digits on input; show/hide eye toggle. |
| Wrong roll **or** wrong PIN | Same message for both: "Roll number or PIN is incorrect." (never reveal which). |
| 5 wrong PINs | Show "Too many attempts. Try again in 15 minutes, or use Google." (function returns `locked`). |
| Function returns 429 (IP throttle) | "Too many attempts from this network. Wait a few minutes." |
| Network error mid-request | "Couldn't reach the server. Check your internet and try again." Button re-enabled. |
| Double-tap on submit | Button disabled while loading. |
| Member has no PIN yet | Same generic "incorrect" message; below the form always show "No PIN? Use Google, or ask the core team for a temporary PIN." |
| Google popup/redirect cancelled by the user | They return to `/auth/callback?error=access_denied` → callback shows a friendly message and a "Back to login" button. |
| `from` redirect | After success go to `location.state.from` if it starts with `/app`, else `/app`. Never redirect to an external URL from query/state (open-redirect protection). |

### 3.4 `/auth/callback`
- supabase-js reads the `code` from the URL automatically (`detectSessionInUrl` default).
- Page shows a spinner "Signing you in…". When `MemberContext` leaves `loading`, navigate (with `replace`) to `from` or `/app`.
- If the URL has `error` / `error_description` → show that message (sanitised, plain text), plus **Back to login**.
- If nothing happens after 10 seconds → show "This is taking too long" + **Try again**.
- Must not be inside `MemberGuard` (it's public).

### 3.5 Blocked / Pending screens
`BlockedScreen` messages (always include **Sign out** and **Contact the core team** via `HelpFooter`):
| reason | Message | Extra |
|---|---|---|
| `not_found` | "We couldn't find a registration for **{email}**. Sign in with the Google account you registered with, or use your roll number + PIN." | If the user `is_admin()`: show **Go to admin panel** button. Show "Register now" link. |
| `ambiguous` | "More than one member uses this email. Please contact the core team." | — |
| `already_linked` | "This registration is already connected to a different login. Contact the core team to reset it." | admin fixes via **Unlink login** (Phase 7) |
| `unverified` | "Your email isn't verified. Sign in with Google." | — |
| `error` | "Something went wrong." | **Retry** button |

`PendingScreen` (status ≠ approved): "Hi {name}, your registration is waiting for approval." Show roll number, domain, **Refresh status** button, **Sign out**. No notifications, no events yet.

### 3.6 PIN login Edge Function — `supabase/functions/pin-login/index.ts`
Deploy via CLI (`npx supabase functions deploy pin-login`) **or** paste into Dashboard → Edge Functions → *Deploy a new function* → editor. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically. The service key **never** goes in the frontend.

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
  if (vErr) return json({ error: 'server' }, 500);
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
    email = String(v.email).trim().toLowerCase();
    const { data: created } = await admin.auth.admin.createUser({ email, email_confirm: true });
    authUserId = created?.user?.id ?? null;
    if (!authUserId) {                                   // user already exists in Auth (e.g. signed in with Google earlier)
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

  return json({ token_hash: link.properties.hashed_token, must_change: v.must_change });
});
```
Notes
- It is called with the normal anon key from the browser; it enforces its own rate limits.
- Roll lookup is case/space-insensitive in SQL.
- If a member registered with `v.edant@gmail.com` and later signs in with Google as `vedant@gmail.com` **after** a PIN login created a differently-spelled account, `claim_member` returns `already_linked`. Fix: admin **Unlink login** then the member logs in again.

### 3.7 Setting / changing a PIN — `/app/set-pin` and Profile → "Backup PIN"
UI: two 6-box PIN inputs (new, confirm), rules text ("6 digits, not 123456 or 111111"), submit → `rpc('set_my_pin', { new_pin })`.

| Case | Handling |
|---|---|
| Arrived because `pin_must_change` (temporary PIN) | Full-screen, **no back button / nav**, title "Choose your own PIN". Only way out is saving or signing out. |
| New ≠ confirm | Inline error, no request. |
| Weak PIN (`weak_pin`) | "That PIN is too easy to guess. Try another." |
| Not 6 digits | Inline error. |
| Same as the temporary PIN | Allowed by the DB but discouraged: show a hint; optional extra check in the UI is not possible (we never know the old PIN). Acceptable. |
| Network failure | Keep the typed values, show retry. |
| Success | Toast "PIN saved", `refresh()` context so `pin_must_change` becomes false, go to `/app`. |
| Google users with no PIN | Home shows a soft card "Set a backup PIN" (dismissible 7 days). Not forced. |

### 3.8 Session behaviour
- Sessions refresh automatically; the member stays logged in on that phone until they tap **Sign out** (good for an app).
- iOS installed apps have **separate storage** from Safari: logging in on Safari does not log in the installed app. Tell iPhone users to log in **inside** the installed app.
- **Test Google login inside the installed PWA on a real Android and iPhone.** If the OAuth redirect misbehaves on a device, the PIN path is the guaranteed fallback.
- Multiple devices: allowed; each device has its own session and its own push subscription.

### Done when (Phase 3)
- Google login: a registered member lands on Home; an unregistered Google account sees "not_found"; an admin-only account sees the "Go to admin" option.
- PIN login: admin generates a temp PIN → member logs in with roll + PIN → forced to set a new PIN → new PIN works, old doesn't.
- 5 wrong PINs lock that member for 15 minutes; Google still works meanwhile.
- A non-admin member visiting `/admin` is bounced; running `supabase.from('members').select('*')` in the console as a member returns no rows.

---

## Phase 4 — Member pages

All under `/app`, wrapped in `MemberGuard` and an **AppShell** (top bar + bottom tab bar). Use the existing riso design (`.riso` scope, same tokens as the rest of the site). Tabs: **Home · Updates · Events · Me**. The bottom bar is fixed with `padding-bottom: env(safe-area-inset-bottom)`; page content gets matching bottom padding so nothing hides behind it. Show a small red dot on **Updates** when there are unread announcements.

> Before coding these screens, ask for a **riso HTML mockup of the app screens** first (like `register.html`), then port it. Same workflow that worked for registration.

### 4.1 Route map (add to `routes.tsx`)
```tsx
<Route path="/app/login" element={<MemberLogin />} />
<Route path="/auth/callback" element={<AuthCallback />} />
<Route path="/app" element={<MemberGuard />}>
  <Route element={<AppShell />}>
    <Route index element={<MemberHome />} />
    <Route path="announcements" element={<Announcements />} />
    <Route path="announcements/:id" element={<AnnouncementDetail />} />
    <Route path="events" element={<Events />} />
    <Route path="events/:id" element={<EventDetail />} />
    <Route path="profile" element={<Profile />} />
  </Route>
  <Route path="set-pin" element={<SetPin />} />      {/* outside AppShell: full screen */}
</Route>
```
Lazy-load these like the admin pages. Keep `/auth/callback` and `/app/login` outside the guard.

### 4.2 Home (`/app`)
**Shows**
1. Greeting + photo + domain chip ("Hi, Vedant 👋 · Technical").
2. **Next event** card (nearest upcoming event for the member): title, date/time, venue, countdown ("in 2 hours"), button **Open**. If attendance is currently open → big **Check in** button.
3. **Latest announcements** (3), unread ones marked, "See all".
4. Cards (each dismissible, shown only when relevant): **Install the app**, **Turn on notifications**, **Set a backup PIN**.
5. `HelpFooter` + the credit line.

**Data:** `announcements` (RLS already filters to audience), `events` where `starts_at >= now() - interval '3 hours'` ordered ascending limit 1, `announcement_reads` for unread count.

**Edge cases**
| Case | Handling |
|---|---|
| No announcements | Friendly empty state: "Nothing new yet. We'll notify you here." |
| No upcoming events | "No upcoming events." |
| Event is happening now | Card says "Happening now" (not a negative countdown). |
| Event cancelled | Show with a "Cancelled" tag and no check-in button. |
| Loading | Skeleton blocks (not a blank screen). |
| Request fails | Show last cached data + banner "Couldn't refresh" + Retry. |
| Photo fails to load | Initials avatar (same `photoFailed` pattern as Success). |
| Long names | `text-overflow: ellipsis`, never break the layout. |
| Pull to refresh | Optional; a visible Refresh button in the top bar is enough. |

### 4.3 Announcements (`/app/announcements`)
**List:** newest first, pinned on top with a pin icon; each row: title, 2-line preview, relative time, domain chip if targeted, unread dot. Filter chips: **All · My domain**. Paginate with "Load more" (20 per page, keyset on `published_at`).

**Detail (`/app/announcements/:id`):** title, full body (preserve line breaks, auto-link URLs, **render as plain text — never `dangerouslySetInnerHTML`**), posted time, optional **Open link** button (`link_url`, opens with `rel="noopener noreferrer"`). On open, upsert into `announcement_reads` (fire-and-forget).

**Edge cases**
| Case | Handling |
|---|---|
| Opened from a push notification while logged out | Login first, then land on the announcement (`from`). |
| Announcement expired/deleted or not for this member (RLS returns 0 rows) | "This announcement isn't available anymore." with a Back button. Never a crash/blank. |
| Invalid UUID in the URL | Same message. |
| Scheduled for the future | Not visible to members (RLS). |
| Very long body | Scroll inside the page; preserve whitespace with `white-space: pre-wrap`. |
| `link_url` not http(s) | DB constraint blocks it; UI also checks before rendering the button. |
| Mark read fails | Ignore silently. |
| Empty list | Empty state. |

### 4.4 Events (`/app/events`)
**List:** tabs **Upcoming** / **Past**. Rows: title, date/time (IST), venue, domain chip, status tag (Today, Happening now, Cancelled, **Attended ✓**). Past tab shows the member's attendance status (✓ or "Missed").

**Detail (`/app/events/:id`):** title, date/time with duration, venue, description (plain text), audience, **Add to calendar** (generates an `.ics` file client-side), and the **Attendance** card (below).

**Attendance card states** (derived client-side from the event times for display only; the server is the real judge)
| State | UI |
|---|---|
| Before opens | "Check-in opens at 5:30 PM" (disabled) |
| Open, not attended | Code input (6 characters, auto-uppercase, no spaces) + **Check in** button |
| Attended | Green "You're checked in ✓ at 5:42 PM" |
| Closed, not attended | "Attendance closed" |
| Cancelled | "Event cancelled" |
| Not eligible (other domain) | Event isn't shown at all (RLS) |

Handle `check_in()` results:
| result | Message |
|---|---|
| `ok` | Success animation + "You're checked in!" |
| `already` | "You're already checked in." |
| `wrong_code` | "That code isn't right. Check the screen at the venue." |
| `locked` | "Too many wrong tries. Wait 10 minutes." |
| `not_open_yet` / `closed` / `cancelled` | the matching message above |
| `not_eligible` / `not_approved` / `not_member` | "You can't check in to this event." |
| network error | "No connection — try again." (do **not** show success) |

**Deep link / QR:** the admin screen shows a QR containing `https://<site>/app/events/<id>?code=ABC123`. When opened, pre-fill the code but still require tapping **Check in** (avoids accidental scans), then remove `code` from the URL (`history.replaceState`).

**Edge cases:** time zones — always format with `timeZone: 'Asia/Kolkata'`; an event with no `ends_at` shows only the start time; a device clock that is wrong must not matter (server decides); events > 1 per day sorted by time; `description` and `venue` null-safe.

### 4.5 Profile (`/app/profile`)
**Sections**
1. **Me:** photo, name, roll number, email, domain, status. Footer text: "To change your details, request an edit" with a button linking to the **existing** `/request-edit` flow (members don't edit rows directly).
2. **Notifications:** master toggle **Push notifications** (see Phase 5), plus two toggles **Announcements** and **Event reminders** (saved to `member_settings`, upsert).
3. **Backup PIN:** "PIN is set / not set" + **Set / Change PIN** button.
4. **Install app** (if not installed).
5. **My attendance:** count "Attended 7 of 9 events" and a list.
6. **Sign out** (confirm dialog, portal-based `ConfirmDialog` you already have).
7. Credit line linking to `/creator`.

**Edge cases:** toggles are optimistic with rollback + toast on failure; if browser permission is **denied**, the master toggle is disabled with the help text "Notifications are blocked in your browser settings" + a short how-to; sign-out while offline still clears local session; no email/phone is ever shown to other members.

### 4.6 Global edge cases for every member page
- Refresh on any `/app/...` URL works (SPA rewrite already in `vercel.json`).
- A deleted/rejected member who still has a session: `get_my_profile()` returns null → `claim_member` result `not_found` → Blocked screen. Their old session can't read any member data because RLS requires `is_active_member()`.
- Session expiry while using the app: any 401/`JWT expired` from Supabase → context re-loads → signed-out → login with `from`.
- Keep scroll position correct on navigation (your `ScrollToTop` already exists).
- All lists handle: loading, empty, error, and offline states. No blank screens.
- Accessibility: every button has a label, focus visible, tab bar items are `<a>` with `aria-current="page"`, toasts use `role="status"`, minimum touch target 44 px, respects `prefers-reduced-motion`.
- All user-supplied text (announcement body, titles) rendered as text, never as HTML.

---

## Phase 4B — Digital ID card + public verify page

Needs Phase 1 (incl. 1.13), Phase 3 and Phase 4. Install: `npm i qrcode` and `npm i -D @types/qrcode`.

### 4B.1 Routes
```tsx
// inside MemberGuard + AppShell (Phase 4 route block):
<Route path="id" element={<IdCard />} />

// PUBLIC route, outside every guard and outside AppShell:
<Route path="/verify/:publicId" element={<VerifyMember />} />
```
Add `VITE_SITE_URL` (for example `https://sambhav.vercel.app`) to Vercel env vars and `.env`. The QR always uses this value, not `window.location.origin`, so a QR generated on a Vercel *preview* URL still points to the real site.

Update the `MyMember` type in `MemberContext` with the new profile fields: `public_id`, `member_no`, `joined_at`, `role`.

### 4B.2 ID Card page — `/app/id`
**Where it appears:** a compact "My ID" tile on **Home** (mini card + "Show ID" button) and a **My ID** row on **Profile**. Do not add a fifth tab.

**Card (portrait, ~ 54 × 86 ratio, riso style, using the logo colours blue `#2b34f0`, amber `#ecac1c`, navy `#14123a`, cream `#eceef8`)**
1. Top strip: the Venn-circles logo + "Sambhav 4.0 · Member".
2. Photo (rounded, ink border; initials avatar fallback).
3. Name (large; shrink-to-fit for long names, max 2 lines with ellipsis).
4. Domain chip + **role ribbon** (Member / Co-lead / Lead).
5. Roll number and membership number `SMB4-0042` (`'SMB4-' + String(member_no).padStart(4, '0')`).
6. QR code on a white tile with a quiet zone (≥ 4 modules), error-correction level `M`. Generate it locally and offline: `QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })` where `url = ${VITE_SITE_URL}/verify/${public_id}`. Render with a sanitised SVG injection or use `toDataURL` into an `<img>` (no `dangerouslySetInnerHTML` of untrusted data; this string is produced by the library from our own URL, but prefer the `<img>`).
7. **Status badge:** "VALID" (green) when `status === 'approved'`; otherwise "PENDING APPROVAL" (grey) and the QR is hidden.
8. **Live indicator:** a pulsing dot + a ticking clock `Live · 7:54:12 PM IST` (update every second with `setInterval`, paused when the page is hidden) and a subtle holographic shimmer sweeping across the card. A screenshot freezes these, which tells a verifier it isn't the live screen. Respect `prefers-reduced-motion` (no shimmer; clock still ticks).

**Buttons**
- **Brighten / Show QR big:** full-screen overlay rendered in a **portal outside `.riso`** (`zIndex: 1000`, white background, QR at `min(80vw, 360px)`, name below). Request a Screen Wake Lock (`navigator.wakeLock.request('screen')`, in try/catch, released on close/visibilitychange). Tap anywhere or press Esc to close; focus is moved into the overlay and returned afterwards.
- **Share link:** `navigator.share({ title, url })` if available, otherwise copies the verify link with a toast.
- (v2: "Save as image".)

**Edge cases**
| Case | Handling |
|---|---|
| Member not approved (pending) | Card shows "PENDING APPROVAL", greyed, **no QR**. (Guard normally shows the Pending screen anyway.) |
| Offline | Card and QR render from the cached profile (cache key `sx:v1:<memberId>:profile`). The QR is just a link, so it still scans. Show a small "Offline — status not live" note instead of the green VALID when `!navigator.onLine`. |
| Profile cache is stale (role changed) | Refresh profile when the page opens; show cached data meanwhile. |
| Photo missing or fails to load | Initials avatar. |
| Very long name | Two lines then ellipsis; font shrinks first. |
| `public_id` regenerated by an admin | Next profile refresh updates the QR; the old QR shows "Not found". Show a toast "Your ID was updated". |
| `VITE_SITE_URL` missing | Fall back to `window.location.origin` and log a dev warning; never crash. |
| Small phone (360 px) / landscape | Card scales by width; in landscape the page scrolls rather than clipping. |
| Screen reader | Card has `role="img"` + an `aria-label` summarising name, domain, status; the QR image has `alt="QR code for your Sambhav ID"`. Brighten overlay is a labelled dialog. |
| Logout | Clear the cached profile (already in the logout rule). |

### 4B.3 Public Verify page — `/verify/:publicId`
**Purpose:** what a volunteer sees after scanning a card with any phone camera. No login needed.

**Behaviour**
1. If `publicId` does not match `^[0-9a-f]{18}$` → show "Not found" immediately, **no request**.
2. Otherwise `supabase.rpc('verify_member', { p_public_id })` (anon allowed).
3. Show a **huge** status block:
   - `valid` → green **VALID MEMBER**
   - `inactive` → amber **NOT ACTIVE**
   - `invalid` → red **NOT FOUND**
   Then: name, domain chip, role, membership number, "Member since {year}", and "Checked {time}" (live, IST).
4. If the viewer is a logged-in super admin or the lead of that member's domain and `photo_path` is returned: create a signed URL (`createSignedUrl(path, 60)`) and show the **photo** so they can match the face.
5. Page has `<meta name="robots" content="noindex,nofollow">` (set via effect) and a **Check again** button.

**Edge cases**
| Case | Handling |
|---|---|
| Network error / offline | "Can't verify right now (no connection)." **Never** show green VALID without a fresh server answer, and never show a cached result. |
| Slow network | Skeleton + "Checking…"; timeout after 10 s with Retry. |
| Anonymous viewer | Never shows roll number, email, phone or photo. |
| Staff viewer from another domain | Valid + name, **no photo** (by design: photo only for own-domain leads and super admins). |
| Staff opens the link inside the installed app | Works: `/verify/*` is a normal route and the service worker serves the SPA shell. |
| Someone shares the verify link | They see only the minimal public info. Super admin can regenerate the ID. |
| Photo load fails | Initials avatar. |
| Role label | Show "Lead", "Co-lead" or nothing for plain members. |
| Accessibility | Status is announced (`role="status"`), and the colour is never the only signal (large text + icon). |

### 4B.4 Admin addition (small)
In the Members pop-up (Phase 7.1) add: **Membership no.** (`SMB4-0042`, read-only) and a **Regenerate ID** button (confirm: "Old QR codes will stop working") → `admin_regen_public_id`. Mapped errors: `forbidden`, `not_found`.

### Done when (Phase 4B)
- A member opens **My ID**, sees their card with a QR; scanning the QR with another phone's camera opens the Verify page showing **VALID MEMBER** with correct name/domain/role.
- Airplane mode: the card and QR still show (with the offline note).
- A pending member sees no QR; a deleted member's old QR shows **NOT FOUND**.
- The Verify page never shows roll number, email or phone to an anonymous visitor.

---

## Phase 5 — Announcements + push notifications

### 5.1 One-time setup
```bash
npx web-push generate-vapid-keys
```
Gives a **public** and a **private** key.
- Vercel → Settings → Environment Variables: `VITE_VAPID_PUBLIC_KEY` = the public key (then redeploy).
- Supabase → Edge Functions → **Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` = `mailto:yourclubemail@gmail.com`.
- **Never lose or change the private key later** (changing it invalidates every existing subscription).

### 5.2 Client: `src/hooks/usePush.ts`
Status values: `unsupported | needs_install | denied | off | on | busy`.

```ts
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('unsupported');
  const perm = await Notification.requestPermission();           // MUST be called from a button tap
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // if the VAPID key ever changed, the old subscription is unusable: drop it
    const cur = sub.options.applicationServerKey;
    if (cur && btoa(String.fromCharCode(...new Uint8Array(cur))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') !== VAPID) {
      await sub.unsubscribe(); sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
  const j = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: j.endpoint, p_p256dh: j.keys!.p256dh, p_auth: j.keys!.auth, p_ua: navigator.userAgent,
  });
  if (error) throw error;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
}

// run on every app open (after login): keeps the server in sync
export async function syncPush() {
  if (Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) { try { await enablePush(); } catch {} return; }   // browser dropped it → silently re-create
  const j = sub.toJSON();
  await supabase.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys!.p256dh, p_auth: j.keys!.auth, p_ua: navigator.userAgent });
}
```
Status detection: not supported → `unsupported`; iOS and not standalone → `needs_install`; `Notification.permission === 'denied'` → `denied`; granted and a subscription exists → `on`; else `off`.

**Where to ask:** only from an explicit **Turn on notifications** button (Home card + Profile toggle). Never on page load — browsers punish that by auto-blocking.

**Edge cases**
| Case | Handling |
|---|---|
| iPhone, not installed | Explain: "On iPhone, install the app first (Share → Add to Home Screen), then turn on notifications from the app." |
| Permission **denied** | Can't be re-asked by code. Show how to enable in browser/site settings. Toggle disabled. |
| User dismissed the prompt without choosing | Stays `off`; the button stays available. |
| Browser silently expired the subscription | `syncPush()` on every open recreates it. |
| Two members share one phone | `save_push_subscription` moves the endpoint to the member who logged in last; logout deletes it, so the previous member stops getting notifications on that phone. |
| Logout | `delete_push_subscription` before `signOut()` (needs the session, so order matters). |
| VAPID key changed | Handled by the unsubscribe/resubscribe branch above. |
| Member turns off a category in Profile | Respected by `push_targets()`. |
| Offline when toggling | Disabled with message. |
| User uninstalls the app / clears data | The push service returns 404/410 on next send → the function deletes that row (below). |

### 5.3 Edge Function `send-push`
`supabase/functions/send-push/index.ts` — two modes: **announcement** (called by an admin from the panel) and **event_reminders** (called every 5 minutes by cron with the service key).

```ts
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
  const db = createClient(URL_, SERVICE);

  if (!isCron) {                                                       // must be a logged-in admin
    const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: ok } = await userClient.rpc('is_admin');
    if (!ok) return json({ error: 'forbidden' }, 403);
  }

  let body: any; try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  // ---- A) announcement push (admin) ----
  if (body.kind === 'announcement') {
    if (isCron) return json({ error: 'forbidden' }, 403);
    // claim atomically: a second click / second admin cannot send it twice
    const { data: a } = await db.from('announcements')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', body.announcement_id).is('push_sent_at', null).select('*').maybeSingle();
    if (!a) return json({ error: 'already_sent_or_missing' }, 409);

    const { data: targets } = await db.rpc('push_targets', { p_domain: a.audience === 'domain' ? a.domain_id : null, p_kind: 'announcement' });
    const result = await blast(db, targets ?? [], {
      title: a.title, body: String(a.body).slice(0, 140),
      url: `/app/announcements/${a.id}`, tag: `ann-${a.id}`,
    });
    await db.from('announcements').update({ push_sent_count: result.sent }).eq('id', a.id);
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
```

### 5.4 Cron for event reminders
Run once in the SQL editor (replace `<project-ref>` with `cshmcevqedzveldnrgmq` and the key with your service role key — pasted into SQL only, never into the app):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

select cron.schedule('event-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := jsonb_build_object('kind', 'event_reminders')
  );
$$);
```
To stop: `select cron.unschedule('event-reminders');`. Reminders go out within ~5 minutes of the target time (that precision is fine for club events). A reminder is never sent twice because `claim_due_event_reminders()` stamps `reminder_sent_at` atomically.

### 5.5 Push edge cases (server side)
| Case | Handling |
|---|---|
| Admin double-clicks **Send** or two admins send simultaneously | Atomic claim on `push_sent_at`; the second gets `already_sent_or_missing`. UI shows "Already sent." |
| Some subscriptions are dead | 404/410 → rows deleted automatically; counted in `removed`. |
| Push service temporary failure | Counted as `failed`; not retried (an announcement is still visible in the app). |
| Nobody has notifications on | Returns `sent: 0`; UI says "Posted. No devices to notify yet." |
| Event time edited after the reminder was sent | Reminder doesn't resend. If you reschedule, a database trigger resets `reminder_sent_at` automatically when `starts_at` changes to a future time (Phase 1.12); the app never writes that column. |
| Event cancelled before reminder | `claim_due_event_reminders` skips cancelled events. |
| Notification payload size | Body trimmed to 140 chars (push limit ~4 KB). |
| Member who disabled a category | Excluded by `push_targets`. |
| Pending/removed members | Excluded (`status = 'approved'`). |
| Edge function timeout on large audiences | 25 parallel sends; hundreds of devices finish in seconds. If you ever pass a few thousand, split by domain. |

### Done when (Phase 5)
- On Android: install the app, log in, turn on notifications, post an announcement from the admin panel with "Send notification" → the phone buzzes with a banner; tapping it opens that announcement inside the app.
- On iPhone: same, after Add to Home Screen.
- A Technical-only announcement is **not** delivered to a member of another domain.

---

## Phase 6 — Events + attendance (member side done in Phase 4; this is the rule set)

### Rules summary
- Window: opens 30 min before start (or `attendance_opens_at`), closes at event end / start + 3 h (or `attendance_closes_at`).
- Code: 6 characters from an unambiguous alphabet (no 0/O, 1/I), auto-created with each event, hidden from members (separate table), regenerate-able by admins.
- One check-in per member per event (primary key). Wrong codes: 8 tries → locked 10 min per member per event.
- Admins can also **manually mark** a member present (method `admin`) and **remove** a check-in.

### Hardening options (only if people cheat)
1. Code is shown only on the admin's projector screen, not shared in WhatsApp.
2. Rotate the code during the event with the "Regenerate" button.
3. Later upgrade: a rotating 30-second code (TOTP-style) computed in SQL from a per-event secret.

### Edge cases (business rules)
| Case | Handling |
|---|---|
| Event time is edited after people checked in | Existing check-ins stay. Window moves with the new times. |
| Event deleted | Attendance cascades away. Admin confirm dialog says "This also deletes N check-ins." |
| Event spans midnight | All times are `timestamptz`; no date-only logic anywhere. |
| Member changes domain after a domain-only event | Past attendance unaffected. |
| Admin marks someone present by mistake | Admin can remove the row; the member can then check in normally. |
| Wrong device clock | Irrelevant; the server decides using its own `now()`. |
| Member checks in for an event of another domain | Server returns `not_eligible`; the event isn't visible anyway. |
| Events with identical start times | Sorted by `starts_at`, then `created_at`. |

---

## Phase 6B — ID scanner (verify + check in by scanning)

Needs Phase 4B and Phase 6. Install: `npm i qr-scanner` (follow the library README for its Vite worker setup; it uses the browser's native `BarcodeDetector` when present and falls back to its own worker, which is what iPhone Safari needs).

### 6B.1 Who can scan and where
| Who | Entry point | Allowed |
|---|---|---|
| Super admin | `/admin/scan` and a **Scan IDs** button on the admin event page | Verify anyone; check in members to **any** event |
| Lead / co-lead | `/app/scan` and a **Scan IDs** button on their event page (Phase 7B adds the button) | Verify; check in members to **their own domain's events** only |
| Member | none | — |

Create one shared component `IdScanner` (props: `eventId?: string`) and use it in both routes. `/app/scan` is guarded by a `StaffGuard` (`roles.length > 0`), `/admin/scan` sits inside the existing admin layout. Query param `?event=<id>` pre-selects the event.

### 6B.2 Scanner screen
1. **Event selector** (top): admin sees events from yesterday to tomorrow; a lead sees their domain's. Option **"Verify only (no check-in)"** is always available.
2. **Start scanning** button (needed for the camera permission on iPhone). Rear camera (`facingMode: 'environment'`). Torch toggle when `scanner.hasFlash()`.
3. On a successful read, extract the ID: try `new URL(text)` and match the path `/verify/([0-9a-f]{18})$`; also accept a bare 18-hex string. Anything else → "That isn't a Sambhav ID".
4. If an event is selected → `rpc('scan_check_in', { p_event, p_ref })`; otherwise `rpc('verify_member', …)`.
5. **Result overlay** (full-screen flash, auto-dismiss after ~1.8 s or on tap; scanning continues behind it):
   | result | Colour / text |
   |---|---|
   | `ok` | Green "✓ {name} checked in" (+ short vibration `navigator.vibrate(80)`) |
   | `already` | Blue "{name} is already checked in" |
   | `inactive` | Amber "{name} — not an active member" |
   | `not_eligible` | Amber "{name} isn't part of this event's domain" |
   | `invalid` | Red "ID not found" |
   | `cancelled` | Red "This event is cancelled" |
   | `forbidden` | Red "You can't check in members to this event" |
   | network error | Red "No connection. Not recorded." (never show green) |
6. **Counter** "37 checked in" (count query for the event) and a **Recent scans** list (last 10) with a ✕ **Undo** that deletes that attendance row (allowed by the admin/lead attendance policies) after a confirm.
7. **Manual entry** (always visible, and the only option if the camera is denied): type a membership number (`42` or `SMB4-0042`; strip non-digits) → `scan_check_in` with that number.

### 6B.3 Edge cases
| Case | Handling |
|---|---|
| Camera permission denied | Explain how to re-enable in site settings; manual entry stays usable |
| No camera / insecure context | Message + manual entry (camera needs HTTPS; Vercel is HTTPS) |
| Same QR in front of the camera for several seconds | Debounce: ignore the same ID for 3 s so it isn't submitted repeatedly |
| Two staff scan the same member at once | `already` for the second (primary key + `on conflict do nothing`) |
| Member from another domain at a domain-only event | `not_eligible`, nothing recorded |
| Member removed or not approved | `inactive` / `invalid`, nothing recorded |
| Staff taps a wrong person | **Undo** on the recent list |
| Offline while scanning | Show "No connection. Not recorded." and do **not** keep a hidden queue (v2); the person can be scanned again when back online |
| Screen locks / app backgrounded | Stop the camera on `visibilitychange: hidden` and on unmount (release the stream); resume with a tap. Request a Screen Wake Lock while scanning (try/catch) |
| Low light | Torch button; hint text "Increase brightness on the member's phone" |
| Printed / screenshot ID | Works (it is just a link) and the staff member checks the name/photo on the result overlay |
| Non-Sambhav QR (URL to another site) | Rejected; **never** open or fetch the scanned URL |
| Lead's role revoked mid-session | Next scan returns `forbidden`; UI shows "You no longer have access" and redirects |
| Photo shown on overlay | Only when the RPC returns `photo_path` (admins and own-domain leads) |
| Loud result sounds | None by default (club rooms are noisy and quiet); vibration only, with an optional sound toggle |

### 6B.4 Audit and reports
Attendance rows made by scanning have `method = 'scan'` and `marked_by` = the staff user. Show a small "scan" / "code" / "manual" tag on the attendance list rows (Phase 6/7.3). CSV export includes a `method` column.

### Done when (Phase 6B)
- An admin selects an event, scans a member's ID, and gets the green overlay; the counter increases and the member's own event page shows "You're checked in".
- Scanning the same ID again shows "already checked in"; scanning an ID of another domain at a domain-only event shows "not eligible".
- With the camera denied, typing `42` in manual entry still checks in the right member.
- A member (not staff) opening `/app/scan` is bounced.

---

## Phase 7 — Admin panel additions

Add three items to the admin sidebar/tabs (follow the existing admin layout, lazy-load like the rest): **Announcements**, **Events**, and extend **Members** and **Overview**. All admin queries use the normal supabase client (admin RLS policies already allow them).

### 7.1 Members pop-up → new **"App access"** section
Loads `rpc('admin_member_app_status', { p_member })` when the drawer opens.

| UI | Behaviour |
|---|---|
| **Google login:** ✅ Linked / ❌ Not yet | read-only |
| **PIN:** `Not set` · `Set by member on 12 Oct` · `Temporary (must change)` · `Locked until 6:15 PM` | read-only |
| **Last sign-in:** date or "Never" | read-only |
| **Devices with notifications:** N | read-only |
| **Generate temporary PIN** | Confirm dialog ("This replaces the current PIN"). Calls `admin_reset_member_pin`. Shows the PIN **once** in a modal with big digits, **Copy** and **Send on WhatsApp** (`https://wa.me/<digits-of-phone>?text=<encoded message>`). Message: "Your Sambhav app PIN is 482915. Log in with your roll number + this PIN, then choose your own PIN." Closing the modal discards it. |
| **Remove PIN** | Confirm, then `admin_remove_member_pin`. |
| **Unlock PIN** | Visible only when locked; `admin_unlock_member_pin`. |
| **Membership no.** + **Regenerate ID** | Shows `SMB4-0042` (read-only). Regenerate (confirm: "Old QR codes will stop working") calls `admin_regen_public_id` (see 4B.4). |
| **Unlink login** | Confirm ("They'll need to sign in again and will be matched by email"). `admin_unlink_member_login`. Fixes wrong-Google-account problems. |

Members **list**: call `admin_members_app_flags()` once and show small badges "App ✓" (linked) / "PIN" (has a PIN) / "🔔" (has devices). Add a filter "Not on the app yet" — this is the list to nudge in the WhatsApp group.

Edge cases
- Admin without a `phone` for that member → hide the WhatsApp button, keep Copy.
- Drawer closes while the PIN modal is open → modal is its own portal (outside `.riso`, `zIndex: 1000` like `ConfirmDialog`) and closes independently.
- Two admins reset the same PIN: last one wins; the earlier PIN stops working. Mention in the confirm text.
- Never log or `console.log` the generated PIN; never store it in React state longer than the modal's lifetime.
- Show errors from RPCs via toast (the `forbidden` case should never happen).

### 7.2 Admin → Announcements (`/admin/announcements`)
**List:** title, audience chip, published time (or "Scheduled"), status (Live / Scheduled / Expired), push status ("Sent to 84 devices" or "Not sent"), actions: Edit, Delete, **Send notification** (if not sent). Search + status filter.

**Compose/edit form**
| Field | Rules |
|---|---|
| Title | required, ≤ 120, live counter |
| Message | required, ≤ 2000, live counter |
| Audience | **Everyone** or **One domain** (dropdown of domains) |
| Link (optional) | must start with http(s) |
| Pin to top | toggle |
| Publish | **Now** or **Schedule** (datetime in IST) |
| Expires (optional) | must be after publish time |
| After saving | checkbox **Send push notification now** (only enabled when publishing now) |

**Edge cases**
| Case | Handling |
|---|---|
| Scheduled announcement + "send push" | Push can only be sent for already-live announcements; for scheduled ones the **Send notification** button appears once live. (v2: auto-push at publish time via the cron.) |
| Editing after push was sent | Allowed, but warns "Members already notified. Editing won't re-send." |
| Deleting after push sent | Allowed; tapping the old notification shows "no longer available". |
| Domain with zero members | Warn "No members in this domain." but allow. |
| Admin's datetime entered in IST | Convert explicitly: `new Date(`${value}:00+05:30`).toISOString()` so it's correct even if the admin's laptop is in another timezone. |
| Unsaved changes + navigating away | Confirm dialog. |
| Duplicate submit | Disable the button while saving. |
| Failed push after successful save | Announcement stays saved; toast "Saved, but notification failed. Try Send notification." |

### 7.3 Admin → Events (`/admin/events`)
**List:** Upcoming / Past, with attendance counts ("37 / 52").

**Create/edit form:** title, description, venue, starts (IST), ends (optional), audience (all/domain), attendance window overrides (optional, collapsed under "Advanced"), reminder minutes (default 30), **Cancelled** toggle.

**Event detail (admin)**
1. **Check-in code panel**: huge code text for projecting, a **QR** (use the `qrcode` npm package to render `https://<site>/app/events/<id>?code=<CODE>`), status "Attendance is OPEN / opens at … / closed", **Regenerate code** button (confirm: "Members who haven't checked in need the new code").
2. **Attendance list**: names with time checked in; search; counts; **Export CSV** (roll number, name, domain, time); **Mark present** (search a member and add, `method='admin'`); **Remove** (✕ with confirm).
3. **Not yet checked in** list (eligible members minus attended) for chasing people.

**Edge cases**
| Case | Handling |
|---|---|
| Changing `starts_at` | Nothing extra to do in the form: the database trigger (1.12) re-arms the reminder for the new time automatically. Do **not** try to send `reminder_sent_at` from the client; that column is not writable. |
| Setting end before start | Form blocks it (DB constraint is the backstop). |
| Cancel an event | Sets `cancelled = true`; optionally offers "Post an announcement about this" (prefilled). |
| Projector screen: screen sleeps / small phone | Large text and a "Keep screen awake" note; can use the Screen Wake Lock API (`navigator.wakeLock`) with a try/catch. |
| CSV with commas/quotes in names | Quote every field and escape `"` as `""`. |
| Large attendance list | Paginate/virtualise at 200+. |
| Delete event | Confirm dialog stating the number of check-ins that will be deleted. |

### 7.4 Overview additions
Cards: **Members on the app** (linked / total), **Notifications enabled** (members with ≥ 1 device / total), **Last announcement** (title + "sent to N"), **Next event** (title + check-ins so far). Use head/count queries or one admin RPC; no heavy joins on the client.

---

## Phase 7B — Roles: leads and co-leads

Super admins (the people in `admins`) keep the `/admin` panel exactly as built in Phase 7. Leads and co-leads **never** see `/admin`. They get a **Lead** tab inside the member app (shown only if `get_my_roles` returns at least one role), so the admin panel can never leak all-member data to them.

### 7B.1 Permission matrix (final)
| Action | Super admin | Lead | Co-lead |
|---|---|---|---|
| Announce to **everyone** | ✅ | ❌ | ❌ |
| Announce to **own domain** + send push | ✅ | ✅ (max 5 pushes/day each) | ✅ (same) |
| Create / edit / cancel / delete events of **own domain** | ✅ | ✅ | ✅ |
| See check-in code & QR, regenerate code | ✅ | ✅ (own events) | ✅ |
| Mark present / remove check-in (own domain's events and members) | ✅ | ✅ | ✅ |
| See own-domain member list: name, roll no., photo, **phone**, app status, attendance | ✅ | ✅ | ✅ |
| See member **email**, edit member details | ✅ | ❌ | ❌ |
| **Approve / reject** pending members | ✅ | ❌ | ❌ |
| Delete members, allow-list, settings | ✅ | ❌ | ❌ |
| Generate / remove / unlock PINs, unlink logins | ✅ | ❌ | ❌ |
| Assign / remove roles | ✅ | ❌ | ❌ |
| See other domains | ✅ | ❌ | ❌ |
| See the audit log | ✅ | ❌ | ❌ |

> Lead and co-lead have identical powers in v1. They are stored as two roles so you can differentiate them later (e.g. only the lead can delete events) by changing policies, without a data migration.

### 7B.2 Changes to the Phase 5 push function
Replace the top of `send-push` (the "must be a logged-in admin" block) and the whole `announcement` branch with the version below. The `event_reminders` branch stays as is. Now: **admins can push anything; leads/co-leads can push only announcements of their own domain, only when it is live, and at most 5 per day each.**

```ts
// ---- top of Deno.serve, replacing the old admin-only check ----
const auth = req.headers.get('Authorization') ?? '';
const isCron = auth === `Bearer ${SERVICE}`;
const db = createClient(URL_, SERVICE);
const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });

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
  if (new Date(pre.published_at) > new Date())              return json({ error: 'not_live' }, 409);
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
  await db.from('audit_log').insert({
    actor_user_id: callerUserId, action: 'push_sent', target_type: 'announcement',
    target_id: a.id, domain_id: a.domain_id, details: { title: a.title, sent: result.sent },
  });
  return json(result);
}
```
The client shows leads how many pushes they have left today (count of their `push_sent_by` rows in the last 24 h, readable through their own announcements query) and maps `daily_limit` to "You've used all 5 notifications for today."

### 7B.3 Lead tools (in the member app)
**Routes** (add to `routes.tsx`, inside `MemberGuard` + `AppShell`, wrapped in a `LeadGuard`):
```tsx
<Route path="lead" element={<LeadGuard />}>
  <Route index element={<LeadDashboard />} />
  <Route path="members" element={<LeadMembers />} />
  <Route path="announcements" element={<LeadAnnouncements />} />
  <Route path="events" element={<LeadEvents />} />
  <Route path="events/:id" element={<LeadEventDetail />} />
</Route>
```
`LeadGuard`: `roles.length === 0` → `<Navigate to="/app" replace />`. If the person somehow has several roles, show a domain switcher at the top of every lead page (default: first role). Add a fifth bottom-tab **Lead** that only renders when `roles.length > 0`.

**Reuse the admin forms.** Build the announcement and event forms as shared components with a prop `fixedDomainId?: string`. When set: the audience selector is hidden, `audience = 'domain'` and `domain_id = fixedDomainId` are forced, and the "send to everyone" option does not exist. The admin pages use the same components without the prop. (The database enforces the same rule, so the UI restriction is only for convenience.)

#### Lead Dashboard (`/app/lead`)
- Header: "Technical — Lead" (domain + role).
- Stat cards from `lead_domain_members`: **Members**, **On the app** (x of y), **Notifications on** (x of y), **Average attendance** (%).
- **Next event** of the domain with its check-in status and a button to open it.
- **Needs a nudge** list: members with `total_events >= 3` and attendance rate under 50%, plus members not on the app. Each row has a **WhatsApp** button (wa.me link with a pre-filled friendly message).
- Quick actions: **New announcement**, **New event**.
- Empty / error states: loading skeletons; "No members yet"; "Couldn't load, Retry".

#### Lead Members (`/app/lead/members`)
- Search by name or roll number; filter chips **All / Not on the app / Low attendance**.
- Row: photo (initials fallback), name, roll number, badges ("On app", "🔔"), attendance "5/9".
- Row actions: **Call**, **WhatsApp** (hidden when `phone` is empty). **No** edit, delete, approve, PIN or email anywhere on this screen.
- Edge cases: `total_events = 0` → show "—" instead of 0%; very long lists → paginate client-side at 50; phone numbers formatted for `wa.me` (digits only, add `91` if 10 digits); the screen never caches phone numbers in localStorage (skip it in the offline cache).

#### Lead Announcements (`/app/lead/announcements`)
- List of the domain's announcements with status (Live / Scheduled / Expired) and push status ("Sent to 31 devices" / "Not sent").
- Compose: same form as admin with `fixedDomainId`. After saving, the checkbox **Send push notification now** is available only if publishing now.
- A small counter: "Notifications left today: 3 of 5".
- Edge cases: `daily_limit` → friendly message, announcement still saved; editing after a push shows the "members were already notified, this won't re-send" warning; deleting is allowed (audit-logged); scheduled announcements can't be pushed until live; double-click guarded; a lead whose role was just revoked gets an RLS error → show "You no longer have access", refresh roles, redirect to `/app`.

#### Lead Events (`/app/lead/events`, `/app/lead/events/:id`)
- List: Upcoming / Past, check-in counts for the domain's members.
- Create / edit / cancel with `fixedDomainId`. Events created by the super admin for "everyone" appear in the member **Events** tab but are **read-only** here (no edit buttons).
- Detail: a **Scan IDs** button (opens `/app/scan?event=<id>`, built in Phase 6B) plus the same panels as the admin event page: big code + QR + "Regenerate code", attendance list with search, **Mark present** (search among own-domain members only), **Remove**, **Not yet checked in**, **Export CSV**.
- Edge cases: if the event time is changed the reminder re-arms automatically (database trigger, 1.12); cancelling offers a prefilled announcement; deleting shows the number of check-ins that will be lost; the "mark present" search never lists members of other domains (the database would refuse it anyway).

### 7B.4 Member side: "Your leads" card
On **Profile** (and optionally Home): call `rpc('get_my_domain_leads')` and list each lead/co-lead with name and a **WhatsApp** button (hidden when no phone). Hide the whole card if the list is empty.
> **Privacy note:** this shows leads' phone numbers to members of their own domain. Tell leads before enabling it, and let a lead without a phone number simply not show the button.

### 7B.5 Admin panel changes for roles
1. **Members drawer → "Domain role"** (under "App access"): dropdown **None / Co-lead / Lead** for the member's own domain, calling `admin_set_domain_role`. Show the current role. Error mapping:
   | Error | Message |
   |---|---|
   | `lead_exists` | "This domain already has a lead. Make them a co-lead first." |
   | `member_not_approved` | "Approve this member first." |
   | `member_not_in_domain` | "This member isn't in that domain." |
   | `forbidden` | "Only super admins can do this." |
2. **Members list**: small **Lead** / **Co-lead** badge, and a filter "Leads & co-leads".
3. **Domains page** (if you have one) shows the lead's name per domain, and "No lead assigned" when empty.
4. **New page `/admin/audit`**: table of the latest 200 `audit_log` rows (time in IST, actor name, action in plain words, target, domain), filters by domain and by action, search by name. Read-only. Actor name: join `members` via `actor_member_id` (fall back to "Admin" when null).
5. When a member who is a lead is being **deleted**, the confirm dialog adds: "This person is the Lead of {domain}. Deleting them removes the role."

### 7B.6 Extra edge cases for roles
| Case | Handling |
|---|---|
| Role revoked while the Lead tab is open | The next request fails (RLS). UI shows "You no longer have access", re-fetches roles, redirects to `/app`. Roles also refresh on app resume. |
| Lead demoted but their scheduled announcements still exist | They stay; only a super admin can now edit/delete them (leads lose access once the role is gone) |
| Lead leaves the club | Admin sets status away from `approved` or deletes the member; all lead powers vanish immediately |
| Two people try to become lead of the same domain | The second fails with `lead_exists` |
| A lead is also a super admin | Both views work; `/admin` for admin tasks, Lead tab for the domain shortcuts |
| A lead wants to announce to everyone | Not possible. They ask the core team (v2 idea: "propose" button) |
| Lead's phone is missing/invalid | Hide call/WhatsApp buttons instead of showing a broken link |
| Lead tries to open `/admin` | Guard checks `admins`, bounced |
| Lead tries API tricks from the console | See the test cases 29–42 below |

### Done when (Phase 7B)
- A lead of Domain A can create, push, edit and delete announcements and events for A, and sees A's attendance and members, but gets errors for anything on Domain B.
- A lead cannot create an "everyone" announcement, cannot approve members, cannot see any email, and cannot send more than 5 pushes a day.
- Assigning, changing and removing roles from the admin Members pop-up works and shows up in the audit log.

---

## Phase 8 — Test everything, then deploy

### 8.1 Test matrix
| # | Test | Expected |
|---|---|---|
| 1 | Google login, registered Gmail | Home |
| 2 | Google login, unregistered Gmail | Blocked `not_found` + Register link |
| 3 | Google login, same Gmail with dots/+tag | Matches |
| 4 | Admin-only Google account → `/app` | Blocked with "Go to admin" |
| 5 | Non-admin member → `/admin` | Bounced |
| 6 | Member console: `supabase.from('members').select('*')` | Zero rows |
| 7 | Member console: `supabase.from('member_pins').select('*')` | Permission denied |
| 8 | Member console: `supabase.from('event_codes').select('*')` | Zero rows |
| 9 | Member console: `supabase.from('attendance').insert(...)` | Denied (must use check_in) |
| 10 | PIN: admin temp PIN → login → forced change → relogin | Works; old PIN dead |
| 11 | 5 wrong PINs | Locked 15 min, then recovers; Google still works |
| 12 | 21 PIN attempts from one IP in 10 min | 429 |
| 13 | Pending member | Pending screen, no data |
| 14 | Member deleted by admin while logged in | Blocked/not_found on next load |
| 15 | Announcement for Domain A | Member of Domain B can't see or get a push |
| 16 | Push on Android installed | Banner + tap opens the announcement |
| 17 | Push on iPhone installed | Same |
| 18 | Deny notification permission | Toggle disabled, help text visible |
| 19 | Same phone, log out member A, log in member B | A stops receiving pushes; B receives |
| 20 | Check-in before window / correct / wrong ×8 / after close | Correct messages each |
| 21 | Double check-in | "Already checked in" |
| 22 | Admin double-click Send notification | Second is refused |
| 23 | Offline: open installed app | Shell + cached data + offline banner |
| 24 | Ship a new version | Update bar appears; tapping reloads |
| 25 | Open login link inside Instagram browser | In-app-browser warning |
| 26 | Rotate phone / small phone (360 px) / notch | No overflow, bottom bar not covered |
| 27 | Screen reader pass on Login + Home | Labels, focus order OK |
| 28 | Slow 3G throttle | Skeletons then content, no blank screens |
| 29 | Lead of A: create announcement for domain A, send push | Works; only A's members get it |
| 30 | Lead of A: console `insert` into `announcements` with `audience:'all'` | Denied |
| 31 | Lead of A: console `insert`/`update` on announcements/events of domain B | Denied |
| 32 | Lead of A: `supabase.from('members').select('*')` | Zero rows |
| 33 | Lead of A: `rpc('lead_domain_members', { p_domain: B })` | `forbidden` |
| 34 | Lead: `rpc('admin_reset_member_pin')`, `admin_set_domain_role`, `admin_unlink_member_login` | `forbidden` |
| 35 | Lead: `insert into domain_roles` (promote self) | Denied |
| 36 | Lead: `update announcements set push_sent_at = null` | Denied (column not updatable) |
| 37 | Lead sends a 6th push within 24 h | `daily_limit`, announcement still saved |
| 38 | Lead: mark present a member of another domain | Denied |
| 39 | Lead changes domain / is no longer approved | Lead tab and all powers disappear immediately |
| 40 | Admin assigns a second lead to a domain | Blocked: `lead_exists` |
| 41 | Admin changes an event time after its reminder was sent | Reminder re-arms for the new time |
| 42 | Audit log after: role change, push, event delete, PIN reset | Each appears with actor and time |
| 43 | Co-lead repeats tests 29, 31, 32, 36 | Same results as lead |
| 44 | Lead opens `/admin` | Bounced |
| 45 | Member's "Your leads" card | Shows lead + co-leads with working WhatsApp links; hidden when none |
| 46 | ID card for an approved member | Photo, name, domain, role, roll no., `SMB4-xxxx`, QR, VALID, live clock |
| 47 | Scan the QR with another phone's camera | Verify page: VALID MEMBER + name, domain, role; no roll no., email, phone, photo |
| 48 | ID card in airplane mode | Card + QR shown with "Offline — status not live" |
| 49 | Pending member's ID | "PENDING APPROVAL", no QR |
| 50 | Delete the member, scan their old QR | NOT FOUND |
| 51 | Admin regenerates a member's ID | Old QR → NOT FOUND; member's card shows the new QR after refresh |
| 52 | Verify page as lead of the same domain / admin | Photo visible; as lead of another domain: no photo |
| 53 | `rpc('verify_member', { p_public_id: '123' })` and a random 18-hex | `invalid` both times, no error leak |
| 54 | Console: `supabase.from('members').select('public_id')` as a member / lead | Zero other rows (RLS), no one else's IDs |
| 55 | Scanner: admin scans valid ID for an event | Green, counter +1, attendance row `method = 'scan'` |
| 56 | Scanner: same ID twice, other-domain ID at a domain event, removed member | `already`, `not_eligible`, `invalid` |
| 57 | Scanner: lead scans for another domain's event (console `rpc('scan_check_in')`) | `forbidden` |
| 58 | Scanner: camera denied → manual entry `42` / `SMB4-0042` | Works |
| 59 | Scanner: backgrounding the app / locking the screen | Camera stops; no red camera indicator left on |
| 60 | Scanner: scan a QR of some other website | "That isn't a Sambhav ID", nothing opened |
| 61 | Plain member opens `/app/scan` or `/admin/scan` | Bounced |

### 8.2 Deploy checklist
- [ ] Phase 0 audit done; all Phase 1 SQL applied; RLS on for all new tables
- [ ] Google OAuth app **published** (not "Testing"); redirect URIs correct
- [ ] Supabase URL Configuration has the production `/auth/callback`
- [ ] Edge Functions `pin-login`, `send-push` deployed; secrets `VAPID_*` set
- [ ] Vercel env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SITE_URL` (the real production URL, used inside ID QR codes); redeploy after changing
- [ ] `vercel.json` headers for `/sw.js` and manifest
- [ ] Icons present (192, 512, maskable, apple-touch, badge)
- [ ] Cron job scheduled
- [ ] Test on one real Android and one real iPhone **from the production URL**
- [ ] Mobile-data test (some Indian networks block `supabase.co`): if blocked, add a production proxy rewrite in `vercel.json` and point `supabase.ts` at it
- [ ] Share the install instructions in the club group: Android "Install" banner; iPhone "Share → Add to Home Screen"
- [ ] Add yourself and 2–3 members as beta testers for 2–3 days before the whole club

### 8.3 New files (checklist for your AI)
```
public/icons/*                       icons
src/sw.ts                            service worker
src/components/UpdatePrompt.tsx
src/components/MemberGuard.tsx
src/components/AppShell.tsx          top bar + bottom tabs
src/components/InstallBanner.tsx
src/contexts/MemberContext.tsx
src/hooks/useInstall.ts
src/hooks/usePush.ts
src/lib/cache.ts                     localStorage offline cache helpers
src/lib/ics.ts                       "add to calendar"
src/pages/member/Login.tsx
src/pages/member/AuthCallback.tsx
src/pages/member/Home.tsx
src/pages/member/Announcements.tsx
src/pages/member/AnnouncementDetail.tsx
src/pages/member/Events.tsx
src/pages/member/EventDetail.tsx
src/pages/member/Profile.tsx
src/pages/member/SetPin.tsx
src/pages/member/Blocked.tsx         Blocked + Pending screens
src/pages/admin/Announcements.tsx
src/pages/admin/Events.tsx
src/pages/admin/Audit.tsx
src/components/LeadGuard.tsx
src/components/forms/AnnouncementForm.tsx   shared by admin + lead (prop fixedDomainId)
src/components/forms/EventForm.tsx          shared by admin + lead (prop fixedDomainId)
src/pages/lead/Dashboard.tsx
src/pages/lead/Members.tsx
src/pages/lead/Announcements.tsx
src/pages/lead/Events.tsx
src/pages/lead/EventDetail.tsx
src/pages/member/IdCard.tsx
src/pages/public/VerifyMember.tsx          route /verify/:publicId (no guard)
src/components/IdScanner.tsx               shared by /admin/scan and /app/scan
src/components/StaffGuard.tsx
src/lib/idcard.ts                          formatMemberNo(), qr url builder, parse scanned text
supabase/functions/pin-login/index.ts
supabase/functions/send-push/index.ts
```
Edited: `routes.tsx`, `App.tsx` (providers + UpdatePrompt), `vite.config.ts`, `vercel.json`, `index.html`, `tsconfig.app.json`, admin `members.tsx` (App access section + list badges), admin `index` (new tabs, Overview cards), `HelpFooter.tsx` (credit already added).

---

## v2 backlog (don't build yet)
Tasks & deadlines per domain · resources library · polls · points/badges & leaderboard · certificates · rotating QR/TOTP check-in codes · auto-push at scheduled publish time · lead-proposed announcements for everyone (lead drafts, super admin approves) · lead-proposed member approvals (lead recommends, super admin decides) · weekly digest notification · in-app feedback form · offline scan queue · "save ID as image" · Apple/Google Wallet pass.

---

## Appendix — quick reference

**Rule of thumb for security in this app:** the browser is never trusted. Everything sensitive (PIN check, check-in, push sending, admin actions) happens in a database function or Edge Function that re-checks who the caller is. The only secrets (service role key, VAPID private key) live in Supabase, never in the repo or in Vercel's `VITE_` variables.

**Where things live**
| Thing | Place |
|---|---|
| Login identity | Supabase Auth (`auth.users`), linked via `members.auth_user_id` |
| Admin power | row in `public.admins` |
| Lead / co-lead power | row in `public.domain_roles` (only counts while the member is approved and still in that domain) |
| Who did what | `public.audit_log` (admin-readable only) |
| ID card identity | `members.public_id` (random, in the QR) and `members.member_no` (display number); verified through `verify_member()` |
| PIN | `member_pins.pin_hash` (bcrypt), unreadable |
| Check-in code | `event_codes` (admin-only) |
| Push subscriptions | `push_subscriptions` (service-only), written via RPC |
| Notification preferences | `member_settings` |
