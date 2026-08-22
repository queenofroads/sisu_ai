// Kaveri — Slack reminder Edge Function.
//
// Fired on a schedule by pg_cron (see supabase/cron.sql) or manually via the
// Supabase CLI/dashboard for a live demo. Posts a leaderboard-style check-in
// to a Slack Incoming Webhook.
//
// Deliberately generic content only ("N points so far"), not specific quest
// titles — the app's quest content (titles, sources, "why" text) only exists
// client-side in js/data.js, generated fresh per profile. Supabase never
// sees it, only which quest_keys got checked off. A server-side job can't
// name a quest it was never told about, so this reports real point/progress
// data instead of guessing at content.
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   SLACK_WEBHOOK_URL   — the Incoming Webhook URL from Slack (points at a
//                         DM or a channel, whichever you chose when creating it)
// SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected by the Edge Functions
// runtime — nothing to set for those.

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ ok: false, error: "SUPABASE_URL / SUPABASE_ANON_KEY missing (should be auto-injected — check function deploy)." }, 500);
    }
    if (!slackWebhookUrl) {
      return jsonResponse({ ok: false, error: "SLACK_WEBHOOK_URL secret not set. Run: supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/..." }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey);

    // The `leaderboard` view is already public (grant select to anon) —
    // see supabase/schema.sql — so the anon key is enough, no service_role needed.
    const { data: rows, error } = await supabase
      .from("leaderboard")
      .select("name, total_points")
      .order("total_points", { ascending: false })
      .limit(10);

    if (error) {
      return jsonResponse({ ok: false, error: `Supabase query failed: ${error.message}` }, 500);
    }

    const text = buildSlackMessage(rows ?? []);

    const slackRes = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!slackRes.ok) {
      const body = await slackRes.text().catch(() => "");
      return jsonResponse({ ok: false, error: `Slack webhook responded ${slackRes.status}: ${body.slice(0, 200)}` }, 502);
    }

    return jsonResponse({ ok: true, reportedUsers: rows?.length ?? 0 });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});

function buildSlackMessage(rows: { name: string; total_points: number }[]): string {
  if (!rows.length) {
    return "⏰ *Kaveri check-in* — no quests completed yet. Time to start your move from India to Finland! 🇮🇳🇫🇮";
  }
  const lines = rows.map((r, i) => `${i + 1}. ${r.name} — ${r.total_points} pts`);
  return `⏰ *Kaveri check-in* — here's where everyone stands:\n${lines.join("\n")}\nKeep going! 🇮🇳🇫🇮`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
