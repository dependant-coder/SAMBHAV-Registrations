# Sambhav 4.0 Members App: Integration Guide (for the AI doing the work)

You are integrating a ready-made members app (React/TSX files) into an existing Vite + React + TypeScript project, and finishing the few pieces that need the existing code. **Read this whole file first. Then read `MEMBER_APP_PLAN.md`** (placed next to this file) for the intended behaviour. Where the plan and this guide disagree, **this guide wins**: the database was already migrated and differs from the plan in a few places (section 2).

Work in small steps. After every step run `npx tsc --noEmit -p .` (use the project's own tsconfig) and fix errors before moving on. Do not "fix" an error by deleting or loosening checks in the package files; if something truly doesn't fit, adapt the *glue* (imports, paths), not the logic.

---

## 0. Ground rules (do not break these)

1. **The database is already done.** Do NOT run any SQL from `MEMBER_APP_PLAN.md` Phase 1. It was applied (adapted) as three migrations (`member_app_01..03`) on Supabase project `cshmcevqedzveldnrgmq`. Re-running plan SQL would fail or damage things.
2. **Both Edge Functions are already deployed** (`pin-login`, `send-push`, "Verify JWT" off; each authenticates by itself). Do not redeploy unless you change them. Their source is in `supabase/functions/` for reference.
3. **Never put the service-role key or the VAPID private key in the frontend, in `.env` files that get committed, or in any `VITE_*` variable.**
4. **Do not change `src/styles/member.css` selectors.** Everything is scoped under `.mapp-root` so it cannot affect the existing registration site or admin panel. Do not add global CSS resets. Do not wrap member pages in the existing `.app-container`.
5. **Do not modify existing registration pages** (`Home`, `Register`, `Success`, `RequestEdit`, `EditDetails`) or their contexts, except where this guide says so.
6. **Never write these `members` columns from the browser:** `name` (generated from `full_name`), `domain_id` (mirrors `domain_slug` via trigger), `status`, `auth_user_id`, `public_id`, `member_no`. They are read-only for the app.
7. **Do not rename RPC parameters.** They are exact (section 2.3).
8. **Never overwrite the project's own Supabase client file.** The package does not contain one (see 3.1).
9. Do not commit secrets. Do not run destructive commands (drop/truncate/delete on live tables) on the live database. If you have Supabase tools, use only read queries unless a step here says otherwise.

---

## 1. What is in this package

Unzip/keep it as `member-app-package/` in the project root. Layout:

```
member-app-package/
  INTEGRATION_GUIDE.md        (this file)
  src/                        -> copy INTO the project's src/ (paths already match)
    components/ (AppShell, EventManager, IdScanner, InstallBanner, LeadGuard, MemberGuard, StaffGuard, UpdatePrompt)
    components/admin/ (AdminFrame, MemberAppAccess, OverviewCards, memberFlags)
    components/forms/ (AnnouncementForm, EventForm)
    components/member/ (ui, ConfirmSheet)
    contexts/MemberContext.tsx
    hooks/ (useInstall, useLoad, usePush, useQr)
    lib/ (cache, csv, events, format, ics, idcard, lead, nav)
    pages/admin/ (Announcements, Audit, Events, EventDetail)
    pages/lead/ (Announcements, Dashboard, Events, EventDetail, Members)
    pages/member/ (AnnouncementDetail, Announcements, AuthCallback, Blocked, EventDetail, Events, Home, IdCard, Login, Profile, Scan, SetPin)
    pages/public/VerifyMember.tsx
    styles/ (member.css, admin.css)
    sw.ts                     service worker (push + offline shell)
  wired/                      the project's own App.tsx, routes.tsx, vite.config.ts with the members app already added
  config/                     index.head.html, vercel.json, vite.config.snippet.ts (reference)
  icons/A, icons/B            two finished icon sets + preview_A_vs_B.png
  supabase/functions/         source of the two deployed Edge Functions (reference)
  supabase/DEPLOY.md          secrets / cron steps (reference)
```

**Name clashes:** the package has files called `Announcements.tsx`, `Events.tsx`, `EventDetail.tsx` in *four* different folders (member / lead / admin). They are different files. Always copy with folders, never flatten.

---

## 2. Database reference (already live; do not change)

### 2.1 Deviations from the plan (because the real schema differs)
| Plan assumed | Reality (what the code uses) |
|---|---|
| `members.name` | generated column = `full_name` (read only) |
| `members.domain_id` (uuid) | real column `domain_slug` is the truth; `domain_id` is auto-filled by trigger `member_sync_domain_id` |
| `domains.id` uuid | added, unique; `domains.slug` is still the primary key |
| `members.status = 'approved'` | added, default `'approved'`; all 121 existing members are approved (this DB has no approval step) |
| `members.auth_user_id`, `public_id`, `member_no` | added; every existing member was backfilled |
| `submit_registration` etc. | untouched; still work as before |

### 2.2 Tables added
`audit_log, member_pins, pin_ip_attempts, domain_roles, announcements, announcement_reads, events, event_codes, attendance, checkin_fails, push_subscriptions, member_settings`. RLS is on for all; `member_pins`, `pin_ip_attempts`, `checkin_fails`, `push_subscriptions` have no client access by design.

### 2.3 RPCs (exact signatures)
Signed-in members: `claim_member()`, `get_my_profile()`, `get_my_roles()`, `get_my_domain_leads()`, `set_my_pin(new_pin)`, `check_in(p_event, p_code)`, `save_push_subscription(p_endpoint, p_p256dh, p_auth, p_ua)`, `delete_push_subscription(p_endpoint)`.
Staff (admin or lead of that domain): `lead_domain_members(p_domain)`, `scan_check_in(p_event, p_ref)`, `admin_regen_checkin_code(p_event)`.
Admin only: `admin_member_app_status(p_member)`, `admin_members_app_flags()`, `admin_reset_member_pin(p_member)` (returns the PIN as text, ONCE), `admin_remove_member_pin(p_member)`, `admin_unlock_member_pin(p_member)`, `admin_unlink_member_login(p_member)`, `admin_regen_public_id(p_member)`, `admin_set_domain_role(p_member, p_domain, p_role)` (`p_role` null removes; errors: `lead_exists`, `member_not_approved`, `member_not_in_domain`, `forbidden`).
Public: `verify_member(p_public_id)`.
Service role only (used by Edge Functions): `verify_member_pin`, `auth_uid_by_email`, `push_targets`, `claim_due_event_reminders`.

### 2.4 Edge Functions
- `pin-login` body `{roll, pin}` -> `{token_hash, must_change}`; errors `invalid | locked | too_many | conflict | server`.
- `send-push` body `{kind:'announcement', announcement_id}` (admins any; leads own domain, max 5 per 24h); errors `forbidden | daily_limit | not_live | expired | already_sent_or_missing | not_configured`. Event reminders call it with `{kind:'event_reminders'}` from a cron using the service-role key.

---

## 3. Integration steps (do in order)

### 3.1 Supabase client
All package files import `{ supabase }` from `src/lib/supabase.ts` (relative, e.g. `../../lib/supabase`).
1. Find where the project creates its client (search for `createClient(`). It may live elsewhere (e.g. `src/lib/supabaseClient.ts`) and may use the dev proxy `/supabase-proxy`.
2. If the file is not `src/lib/supabase.ts` or doesn't export a named `supabase`, create `src/lib/supabase.ts` containing only: `export { <yourExport> as supabase } from './<yourFile>';`. **Do not create a second client**, or sessions will not be shared with the admin panel.
3. The client must have `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }` (the defaults). If the project set `detectSessionInUrl: false`, set it to true or the Google sign-in callback will not work.

### 3.2 Install packages
```
npm i qrcode qr-scanner
npm i -D @types/qrcode vite-plugin-pwa workbox-precaching workbox-routing workbox-core
```
Use the versions npm picks; commit the lockfile.

### 3.3 Copy the files
From the project root:
```
cp -r member-app-package/src/* src/
```
This must not overwrite anything existing. Before copying, check for collisions: `src/pages/admin/` already contains `Login`, `guard`, `index`; the package adds `Announcements`, `Audit`, `Events`, `EventDetail` (no clash). `src/contexts/` gets only `MemberContext.tsx`. `src/lib/` gets only new files; if one of `format.ts`, `cache.ts`, `nav.ts`, `csv.ts`, `events.ts` already exists with different content, STOP and rename the package's copy (update its imports) rather than overwriting.

### 3.4 Merge the three wired files
`wired/App.tsx`, `wired/routes.tsx`, `wired/vite.config.ts` are the project's own files with additions. Diff each against the project's current version (`diff`). If the current file has changed since (new routes, new providers), **merge the additions into the current file** rather than replacing it. What the additions are:
- **App.tsx:** imports `MemberProvider`, `UpdatePrompt`, `./styles/member.css`, `useLocation`; `isMemberArea()` bypasses the "Loading portal / server error" gate for `/app/*`, `/verify/*`, `/auth/callback`; `<MemberProvider>` wraps `<ToastProvider>`; `<UpdatePrompt />` is rendered once.
- **routes.tsx:** lazy imports and routes for member, lead, public verify, and four admin pages; the admin scanner `/admin/scan` sits under `AdminGuard` but OUTSIDE `AdminLayout` (it is full-screen); a top-level `<Suspense>`.
- **vite.config.ts:** `VitePWA({...})` plugin. The existing `server.proxy['/supabase-proxy']` must stay.

### 3.5 index.html, vercel.json, tsconfig
- **index.html:** merge `config/index.head.html` into `<head>`: replace existing viewport/theme-color tags, add the apple-touch tags. Skip the Google Fonts lines if the site already loads Bricolage Grotesque and Rozha One; otherwise add a stylesheet link for both (`family=Bricolage+Grotesque:wght@400;500;700;800&family=Rozha+One`).
- **vercel.json:** merge `config/vercel.json`. Keep every existing rewrite (including any `/supabase-proxy/*` rewrite, which must come BEFORE the catch-all `/(*)` -> `/index.html`). Add the `/sw.js` and `/manifest.webmanifest` headers.
- **tsconfig (app):** add `"vite-plugin-pwa/react"` to `compilerOptions.types` (together with `vite/client`), and **exclude `src/sw.ts`** from the app tsconfig. Add a small `tsconfig.sw.json` that extends the app config, sets `"lib": ["ES2022","WebWorker"]`, `"types": []`, and includes only `src/sw.ts`; check it with `npx tsc -p tsconfig.sw.json --noEmit`.
- `src/main.tsx`: no change needed (the stylesheet import is in `App.tsx`).

### 3.6 Icons
Ask the user: **"Icon set A (dark) or B (light)? See `icons/preview_A_vs_B.png`."** Do not guess. Then copy that set's `public/` contents into the project's `public/` (so you get `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`, `badge-72.png`, and `favicon.svg`, `favicon-32.png`). If the project already has a favicon, ask before replacing it.

### 3.7 Environment variables
Add to `.env.local` (and tell the user to add the same to Vercel, then redeploy):
```
VITE_SITE_URL=https://<production domain>        # used inside ID card QR codes; must be the real public URL, no trailing slash
VITE_VAPID_PUBLIC_KEY=BGgcEBaT854P71q_YcsLPiHfT41LOoE6uwW2wXhiroeSUitFSeb6FRtdb9uzHPJfSyj4eOXspYsw5VAcbQqt5Qo
VITE_HELP_WHATSAPP=91XXXXXXXXXX                  # optional
```
Add `/// <reference types="vite/client" />` typing for these in `src/vite-env.d.ts` if the project types `import.meta.env` strictly.

### 3.8 Build and verify
```
npx tsc --noEmit -p .
npx tsc --noEmit -p tsconfig.sw.json
npm run build
npm run preview
```
Confirm `dist/sw.js` and `dist/manifest.webmanifest` exist. Open `/app/login`, `/verify/123` (should say invalid), `/admin/announcements` (should bounce to admin login when signed out).

---

## 4. Remaining work in the existing code (you must do these; they need the project's own files)

First read `src/pages/admin/index.tsx` (the admin layout and pages) and the admin pages for Members, Overview and Domains/Settings.

### 4.1 Admin navigation
In the admin layout's nav, add links: **Announcements** `/admin/announcements`, **Events** `/admin/events`, **Audit log** `/admin/audit`, and **Scan IDs** `/admin/scan` (an `<a>` or `Link`, it is full screen). Match the existing nav's style and active-state logic.

### 4.2 Members page (App access, badges, filters)
1. Import: `MemberAppAccess` from `components/admin/MemberAppAccess`; `useMemberFlags, MemberBadges, FlagFilterSelect, passesFlagFilter` from `components/admin/memberFlags`.
2. In the member detail pop-up/drawer, add `<MemberAppAccess memberId={member.id} />` as a new section (below the existing details). It is self-contained (brings its own toast, icons and styles); do **not** wrap it again.
3. In the list: call `const flags = useMemberFlags()` once at the top of the page; render `<MemberBadges flags={flags} memberId={m.id} />` next to each name; add `<FlagFilterSelect value={appFilter} onChange={setAppFilter} />` beside the existing filters (state type `FlagFilter`), and apply `passesFlagFilter(appFilter, flags, m.id)` in the existing filter chain. After a role change or PIN action, call `flags.reload()` when the pop-up closes.

### 4.3 Overview cards
Render `<OverviewCards />` on the admin overview page, above or below the existing stats. It is self-contained.

### 4.4 Domains: show each domain's lead
Wherever domains are listed in admin (Settings or a Domains section), show "Lead: {name}" or "No lead assigned". Query (admin can read):
```ts
const { data } = await supabase.from('domain_roles').select('domain_id, role, member:members(name)').eq('role', 'lead');
```
Map by `domain_id`. Match to a domain with `domains.id` (the new uuid column; existing code may key domains by `slug`: select `id` too). Co-leads are optional to display.

### 4.5 Delete-member confirmation
In the existing delete-member dialog, before confirming, check `domain_roles` for that member (`select role, domain_id` where `member_id` = the member). If a row exists, add to the confirm text: **"This person is the Lead of {domain name}. Deleting them removes the role."** (use "Co-lead" for `colead`). No database change is needed: deleting the member cascades the role away.

### 4.6 Optional but recommended: an "Announce this event" shortcut
Not required. Skip unless asked.

---

## 5. Things you cannot or must not do; tell the user to do these

1. **Supabase secrets** (Dashboard > Edge Functions > Secrets): `VAPID_PUBLIC_KEY` (same value as `VITE_VAPID_PUBLIC_KEY`), `VAPID_PRIVATE_KEY` (the user has it), `VAPID_SUBJECT` (`mailto:<club email>`). Until set, `send-push` returns `not_configured` and no notifications go out.
2. **Vercel environment variables** (section 3.7), then redeploy.
3. **Google sign-in:** enable the Google provider in Supabase Auth; publish the Google OAuth app (not "Testing"); allowed redirect URLs must include `https://<production domain>/auth/callback` and `http://localhost:3000/auth/callback`.
4. **Event reminder cron:** run the SQL in `MEMBER_APP_PLAN.md` section 5.4 in the Supabase SQL editor (needs the service-role key pasted in SQL only; enable `pg_cron` and `pg_net` first).
5. **Photo bucket decision:** bucket `member-photos` is public. The ID design says photos should only be visible to admins and the member's own domain leads. Making the bucket private is a one-line change, but it breaks any place that builds direct public photo links (check the admin panel and the Success page first). Ask the user before changing it.
6. **Real-device tests** on one Android and one iPhone from the production URL, including a mobile-data test (some Indian networks block `supabase.co`; if so, add a production proxy rewrite for `/supabase-proxy` in `vercel.json` and point the client at it).

---

## 6. Verification checklist

Automated (you can run):
- [ ] `tsc` passes for the app and for `sw.ts`; `npm run build` succeeds; `dist/sw.js` + manifest exist.
- [ ] Registration site still works exactly as before (`/`, `/register/<slug>`).
- [ ] If you have Supabase SQL access, read-only checks:
  - Non-admin cannot read members: `begin; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true); set local role authenticated; select count(*) from public.members; rollback;` must return 0.
  - `select public.verify_member('123');` as anon returns `{"result":"invalid"}`.
  - Security advisor shows no new "RLS disabled" findings.

Manual (list for the user):
- [ ] Google sign-in with a registered email lands on `/app`; an unregistered Google account sees the "not a member" screen.
- [ ] Admin generates a temporary PIN (shown once) -> member logs in with roll + PIN -> forced to set own PIN.
- [ ] Admin posts an announcement -> "Send notification" -> installed phone receives it; tapping opens the announcement.
- [ ] Event: code check-in works; wrong code locks after 8 tries; scan check-in works; lead cannot touch another domain's event.
- [ ] ID card shows photo, name, roll number, membership no.; the QR opens `/verify/<id>` which shows name/domain only (no roll, email or phone).
- [ ] Offline: open `/app` in airplane mode: shell and last data show, with the offline bar.

---

## 7. Likely problems and fixes

| Symptom | Cause / fix |
|---|---|
| `Cannot find module '../../lib/supabase'` | 3.1: add the re-export shim. |
| `virtual:pwa-register/react` not found | add `"vite-plugin-pwa/react"` to tsconfig `types`; restart TS server. |
| Member pages unstyled | `./styles/member.css` not imported (App.tsx), or the component is outside `.mapp-root` (use `AppFrame`/`AdminFrame`/`AdminEmbed`). |
| Admin piece unstyled / "useToast outside provider" | use the package's exported default (self-wrapping); do not copy its inner function. |
| Google sign-in returns to login in a loop | `detectSessionInUrl` disabled, redirect URL not allow-listed, or two Supabase clients. |
| `permission denied for function ...` | a call used the wrong RPC name or a non-admin called an admin RPC; check 2.3. |
| `column "name" ... can only be updated to DEFAULT` | something tried to write `members.name`; write `full_name` instead. |
| `send-push` returns `not_configured` | VAPID secrets not set (section 5.1). |
| Service worker caching stale pages | bump nothing manually; the "A new version is ready" bar handles it. Do not add runtime caching of API calls. |
| Fixed overlays/toasts mispositioned | they must render via `FixedPortal` (a `.mapp-root` outside `.mapp`); do not nest them inside `.mapp`. |

---

## 8. Done means

Everything in section 3 done and verified, section 4 implemented, section 5 handed to the user as a short checklist, and a final summary listing: files added, files modified (with one line each), anything you could not do and why.
