/*
 * Kaveri — Supabase wiring.
 *
 * This is a REQUIRED dependency, not an optional layer like AI Buddy:
 * authentication, quest-completion sync, and the leaderboard all need a
 * live Supabase project (see js/config.js and supabase/schema.sql). If
 * Supabase isn't configured or isn't reachable, the app says so clearly
 * rather than silently degrading — see isSupabaseConfigured() below and its
 * use in app.js.
 *
 * The one thing that still works with zero network access is the roadmap
 * *generation* logic itself (data.js) — but you can't sign in, track
 * progress, or see the leaderboard without Supabase.
 */

let _client = null;

function isSupabaseConfigured() {
  return typeof SUPABASE_URL === "string" && SUPABASE_URL.length > 0 && typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 0;
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase isn't configured yet — add SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.");
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase client library failed to load (check your network connection / the CDN script tag in index.html).");
  }
  if (!_client) {
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

function friendlyAuthError(error) {
  if (!error) return "Something went wrong talking to Supabase.";
  const msg = error.message || String(error);
  if (/rate limit/i.test(msg)) {
    return "Too many signup emails sent recently (Supabase's built-in email sender has a strict hourly limit — this isn't about your specific address). Try again later, or use \"Skip login\" below to try Kaveri without an account.";
  }
  return msg;
}

async function signUpWithEmail({ email, password }) {
  const client = getSupabaseClient();
  // Without this, the confirmation email links back to whatever "Site URL"
  // is set in the Supabase project's dashboard — which defaults to
  // localhost:3000 and silently breaks the link for every real visitor
  // until someone changes it. Passing the browser's actual origin here
  // means it always points wherever the app is really being served from.
  // Supabase still requires that origin to be listed under Authentication >
  // URL Configuration > Redirect URLs in the dashboard, or it falls back to
  // the Site URL anyway — see README for the one-time setup step.
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error));
  // Whether this returns an active session depends on the Supabase
  // project's "Confirm email" setting. For a live demo, turn that setting
  // off (Authentication > Providers > Email) so signup logs the user in
  // immediately — see README. Either way, the profile row itself is created
  // later, once the wizard collects a name (see upsertMyProfile in app.js).
  return data;
}

async function signInWithEmail({ email, password }) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error));
  return data;
}

async function signOutUser() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(friendlyAuthError(error));
}

async function getCurrentSession() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(friendlyAuthError(error));
  return data.session;
}

function onAuthChange(callback) {
  const client = getSupabaseClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

async function fetchMyProfile(userId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from("profiles").select("id, name, public_name, origin, destination, total_points").eq("id", userId).maybeSingle();
  if (error) throw new Error(friendlyAuthError(error));
  return data;
}

async function upsertMyProfile({ id, name, origin, destination, publicName }) {
  const client = getSupabaseClient();
  const { error } = await client.from("profiles").upsert({ id, name, origin: origin || null, destination: destination || null, public_name: publicName || null });
  if (error) throw new Error(friendlyAuthError(error));
}

async function fetchMyCompletions(userId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from("quest_completions").select("quest_key").eq("user_id", userId);
  if (error) throw new Error(friendlyAuthError(error));
  return (data || []).map((r) => r.quest_key);
}

async function completeQuest({ userId, questKey, questCategory, points }) {
  const client = getSupabaseClient();
  const { error } = await client.from("quest_completions").upsert({ user_id: userId, quest_key: questKey, quest_category: questCategory, points }, { onConflict: "user_id,quest_key" });
  if (error) throw new Error(friendlyAuthError(error));
}

async function uncompleteQuest({ userId, questKey }) {
  const client = getSupabaseClient();
  const { error } = await client.from("quest_completions").delete().eq("user_id", userId).eq("quest_key", questKey);
  if (error) throw new Error(friendlyAuthError(error));
}

async function fetchLeaderboard(limit) {
  const client = getSupabaseClient();
  const { data, error } = await client.from("leaderboard").select("id, name, total_points").limit(limit || 20);
  if (error) throw new Error(friendlyAuthError(error));
  return data || [];
}

async function fetchCommunityQuestions(limit) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("community_questions")
    .select("id, name, question, created_at, community_replies(id, name, reply, created_at)")
    .order("created_at", { ascending: false })
    .limit(limit || 30);
  if (error) throw new Error(friendlyAuthError(error));
  return data || [];
}

async function postCommunityQuestion({ userId, name, question }) {
  const client = getSupabaseClient();
  const { error } = await client.from("community_questions").insert({ user_id: userId, name, question });
  if (error) throw new Error(friendlyAuthError(error));
}

async function postCommunityReply({ questionId, userId, name, reply }) {
  const client = getSupabaseClient();
  const { error } = await client.from("community_replies").insert({ question_id: questionId, user_id: userId, name, reply });
  if (error) throw new Error(friendlyAuthError(error));
}
