# Deploying the Edge Functions

1. Generate VAPID keys once:  `npx web-push generate-vapid-keys`
2. Vercel env: `VITE_VAPID_PUBLIC_KEY` = public key (redeploy).
3. Supabase -> Edge Functions -> Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@example.com`).
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.)
4. Deploy (CLI):
   npx supabase functions deploy pin-login --project-ref cshmcevqedzveldnrgmq
   npx supabase functions deploy send-push --project-ref cshmcevqedzveldnrgmq
   or paste each `index.ts` into Dashboard -> Edge Functions -> Deploy a new function.
   Leave "Verify JWT" ON for both.
5. Event reminders: run the pg_cron SQL from plan section 5.4 (needs your service role key in the SQL editor only).

Tables/RPCs the functions need (from the plan SQL): pin_ip_attempts, verify_member_pin, auth_uid_by_email,
push_targets, claim_due_event_reminders, is_admin, is_lead_of, announcements.push_sent_at/by/count, audit_log.

Quick tests (replace values):
  curl -X POST https://cshmcevqedzveldnrgmq.supabase.co/functions/v1/pin-login \
    -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>" -H "Content-Type: application/json" \
    -d '{"roll":"<ROLL>","pin":"123456"}'      # wrong PIN -> {"error":"invalid"}
