// Kaveri — personal reminder emails.
//
// Fired on a schedule by pg_cron (see supabase/cron.sql) or manually via the
// Supabase CLI/dashboard for a demo. Unlike send-slack-reminder (one team-wide
// leaderboard post), this sends one email per inactive user, to their own inbox.
//
// Content is deliberately generic ("N points, N days since your last quest"),
// never a specific quest title — quest content (titles, "why" text, sources)
// only exists client-side in js/data.js, generated fresh per profile.
// Supabase never sees it, only quest_key/points/completed_at. A server-side
// job can't name a quest it was never told about without duplicating the
// whole knowledge base server-side, so this reports real activity data
// instead of guessing at content.
//
// Needs the service_role key (not the anon key send-slack-reminder uses) to
// read every user's email via the Auth admin API and to read every profile's
// total_points — both are private data, unlike the public `leaderboard` view.
// Edge Functions run server-side only, so this never exposes the key to a
// browser.
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   RESEND_API_KEY   — API key from https://resend.com (free tier is enough
//                      for a demo; no domain verification needed if you send
//                      from the default onboarding@resend.dev address)
//   APP_URL          — the deployed app's URL, linked from the email
//   RESEND_FROM      — optional, defaults to "Kaveri <onboarding@resend.dev>"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Edge
// Functions runtime — nothing to set for those.

import { createClient } from "npm:@supabase/supabase-js@2";

const INACTIVE_DAYS_THRESHOLD = 3;

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://example.com";
    const fromAddress = Deno.env.get("RESEND_FROM") || "Kaveri <onboarding@resend.dev>";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (should be auto-injected — check function deploy)." }, 500);
    }
    if (!resendApiKey) {
      return jsonResponse({ ok: false, error: "RESEND_API_KEY secret not set. Run: supabase secrets set RESEND_API_KEY=re_..." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (usersError) return jsonResponse({ ok: false, error: `listUsers failed: ${usersError.message}` }, 500);

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, name, total_points");
    if (profilesError) return jsonResponse({ ok: false, error: `profiles query failed: ${profilesError.message}` }, 500);

    const { data: completions, error: completionsError } = await supabase
      .from("quest_completions")
      .select("user_id, completed_at")
      .order("completed_at", { ascending: false });
    if (completionsError) return jsonResponse({ ok: false, error: `quest_completions query failed: ${completionsError.message}` }, 500);

    // First row per user_id wins, since completions are ordered newest-first.
    const lastCompletedByUser = new Map<string, string>();
    for (const c of completions ?? []) {
      if (!lastCompletedByUser.has(c.user_id)) lastCompletedByUser.set(c.user_id, c.completed_at);
    }

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const now = Date.now();
    const results: { email: string; sent: boolean; reason?: string }[] = [];

    for (const user of usersPage.users) {
      const profile = profileById.get(user.id);
      if (!profile || !user.email) continue; // no profile yet (never finished the wizard) or no email on file

      const lastCompleted = lastCompletedByUser.get(user.id);
      const referenceTime = lastCompleted ? new Date(lastCompleted).getTime() : new Date(user.created_at).getTime();
      const daysInactive = Math.floor((now - referenceTime) / (1000 * 60 * 60 * 24));

      if (daysInactive < INACTIVE_DAYS_THRESHOLD) continue;

      const subject = lastCompleted ? `${profile.name}, your Kaveri quests are waiting` : `${profile.name}, ready to start your first Kaveri quest?`;
      const html = buildReminderEmail(profile.name, profile.total_points, daysInactive, lastCompleted != null, appUrl);

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({ from: fromAddress, to: user.email, subject, html }),
      });

      results.push({
        email: user.email,
        sent: sendRes.ok,
        reason: sendRes.ok ? undefined : (await sendRes.text().catch(() => "")).slice(0, 200),
      });
    }

    return jsonResponse({ ok: true, checked: usersPage.users.length, remindersSent: results.filter((r) => r.sent).length, results });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});

function buildReminderEmail(name: string, points: number, daysInactive: number, hasStarted: boolean, appUrl: string): string {
  const body = hasStarted
    ? `It's been ${daysInactive} day${daysInactive === 1 ? "" : "s"} since you last checked in. You're at <strong>${points} points</strong> so far — your quest board is waiting whenever you're ready to pick it back up.`
    : `You signed up ${daysInactive} day${daysInactive === 1 ? "" : "s"} ago but haven't started your quest board yet — it only takes a couple of minutes to generate your personalised plan.`;
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #0d1b2e;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>${body}</p>
      <p><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#003580;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Open my quest board</a></p>
      <p style="color:#666;font-size:13px;">— Kaveri, your Finland relocation buddy</p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
