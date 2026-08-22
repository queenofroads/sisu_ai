-- Kaveri — scheduled Slack reminder
--
-- Run this in the Supabase SQL editor AFTER you've deployed the
-- send-slack-reminder Edge Function and set its SLACK_WEBHOOK_URL secret
-- (see supabase/functions/send-slack-reminder/index.ts for details).
--
-- Before running: replace the two <PLACEHOLDER> values below.
--   1. <YOUR-PROJECT-REF> — the part of your Supabase URL before
--      ".supabase.co", e.g. "ekmkztfjtuazkslkryrf".
--   2. <YOUR-ANON-KEY> — the same anon/public key already in js/config.js.
--      Safe to use here: it only grants what schema.sql's RLS policies
--      allow, same as everywhere else in this app.
--
-- This schedules the function daily at 08:00 UTC. To fire it manually
-- instead (e.g. to prove it live during a demo, without waiting for the
-- schedule), use the Supabase CLI:
--   supabase functions invoke send-slack-reminder
-- or the "Invoke" button on the function's page in the dashboard.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('kaveri-slack-reminder-daily')
where exists (select 1 from cron.job where jobname = 'kaveri-slack-reminder-daily');

select cron.schedule(
  'kaveri-slack-reminder-daily',
  '0 8 * * *', -- every day at 08:00 UTC — edit to taste, e.g. '0 8-20/4 * * *' for every 4h during a demo day
  $$
  select net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-slack-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR-ANON-KEY>'
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- Verify it's scheduled:
-- select * from cron.job where jobname = 'kaveri-slack-reminder-daily';

-- To stop the reminder entirely:
-- select cron.unschedule('kaveri-slack-reminder-daily');

-- ---------------------------------------------------------------------------
-- Personal reminder emails (send-personal-reminders) — one email per inactive
-- user, unlike the team-wide Slack post above. Deploy that function and set
-- its RESEND_API_KEY / APP_URL secrets first (see its index.ts), then replace
-- the same two <PLACEHOLDER> values as above (this needs the anon key only —
-- the function itself uses its auto-injected service_role key internally to
-- read emails/points, never exposed here).

select cron.unschedule('kaveri-personal-reminders-daily')
where exists (select 1 from cron.job where jobname = 'kaveri-personal-reminders-daily');

select cron.schedule(
  'kaveri-personal-reminders-daily',
  '0 9 * * *', -- every day at 09:00 UTC — an hour after the Slack check-in above
  $$
  select net.http_post(
    url := 'https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/send-personal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR-ANON-KEY>'
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- Verify it's scheduled:
-- select * from cron.job where jobname = 'kaveri-personal-reminders-daily';

-- To stop this reminder entirely:
-- select cron.unschedule('kaveri-personal-reminders-daily');
