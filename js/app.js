/*
 * Kaveri — app state, views, and wiring.
 * Vanilla JS, no framework, no build step.
 *
 * Two network dependencies, deliberately different in how required they are:
 *  - Supabase (auth, quest-completion sync, leaderboard) is REQUIRED. The
 *    quest board itself won't work without it — see the setup banner below.
 *  - AI Buddy (ai.js) stays fully OPTIONAL and gated behind a user-supplied
 *    API key, same as before.
 *
 * The roadmap *generation* logic (data.js) still has zero network
 * dependency — profile + category answers are matched against the local
 * knowledge base entirely offline. Only points/completions/leaderboard live
 * in Supabase.
 */

const STORAGE_KEY = "kaveri_state_v1";
const THEME_STORAGE_KEY = "kaveri_theme";
const $app = document.getElementById("app");

// Light/dark theme toggle. The inline script in index.html's <head> already
// set data-theme on <html> before first paint (from localStorage, falling
// back to the OS preference) — this just keeps the toggle button's
// aria-label in sync and handles clicks. The visible icon itself is pure
// CSS (see .theme-toggle::before in style.css), driven by the same
// data-theme attribute, so it can never drift out of sync with the applied
// theme.
function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    /* localStorage blocked — theme still applies for this page view */
  }
  const btn = document.querySelector('[data-action="toggle-theme"]');
  if (btn) btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

setTheme(getTheme());

function defaultState() {
  return {
    view: "landing", // landing | auth | wizard | roadmap
    authMode: "signup", // signup | login
    authUserId: null,
    authEmail: null,
    authLoading: false,
    authError: null,
    authNotice: null, // e.g. "check your email to confirm"
    profile: {},
    categorySelection: ["housing", "publicServices", "education", "familyLife"],
    categoryAnswers: {},
    wizardOrder: [],
    wizardIndex: 0,
    roadmap: null, // stepsByPhase, generated once
    progress: {}, // questKey -> true, mirrors Supabase quest_completions
    syncError: null,
    leaderboard: [],
    leaderboardLoading: false,
    leaderboardError: null,
    communityQuestions: [],
    communityLoading: false,
    communityError: null,
    aiChatLog: [],
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) {
    /* corrupted state — start fresh rather than crash the demo */
  }
  return defaultState();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(patch) {
  state = { ...state, ...patch };
  save();
  render();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- Derived helpers ----------

function computeTotalPoints() {
  const roadmap = state.roadmap || {};
  let total = 0;
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s, i) => {
      const key = questKeyFor(ph.id, s, i);
      if (state.progress[key]) total += s.points || 0;
    });
  });
  return total;
}

function progressFromCompletions(roadmap, completionKeys) {
  const known = new Set(completionKeys);
  const progress = {};
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s, i) => {
      const key = questKeyFor(ph.id, s, i);
      if (known.has(key)) progress[key] = true;
    });
  });
  return progress;
}

// ---------- Supabase-backed auth/session flow ----------

async function initAuth() {
  if (!isSupabaseConfigured()) {
    render();
    return;
  }
  try {
    const session = await getCurrentSession();
    if (session && session.user) {
      await handleSignedIn(session.user);
    } else {
      render();
    }
    onAuthChange((session) => {
      if (!session && state.authUserId) handleSignedOut();
    });
  } catch (e) {
    setState({ authError: e.message });
  }
}

async function handleSignedIn(user) {
  if (state.authUserId !== user.id) {
    // Either a different account just signed in, or the previous state came
    // from "Skip login" test mode (authUserId null) — either way it isn't
    // this account's data, so don't leak it into their view. A same-account
    // reload keeps authUserId === user.id and skips this, so resuming a
    // real session still works.
    state = defaultState();
  }
  let profile = null;
  let profileError = null;
  try {
    profile = await fetchMyProfile(user.id);
  } catch (e) {
    profileError = e.message;
  }
  let completions = [];
  try {
    completions = await fetchMyCompletions(user.id);
  } catch (e) {
    /* leaderboard/points sync can retry later; don't block sign-in on it */
  }
  const profilePatch = profile
    ? {
        ...state.profile,
        name: state.profile.name || profile.name,
        origin: state.profile.origin || profile.origin || "",
        destination: state.profile.destination || profile.destination || "",
        publicNameChoice: state.profile.publicNameChoice || (profile.public_name ? "nickname" : "real"),
        publicName: state.profile.publicName || profile.public_name || "",
      }
    : state.profile;
  const progress = state.roadmap ? progressFromCompletions(state.roadmap, completions) : {};
  setState({
    authUserId: user.id,
    authEmail: user.email,
    authError: profileError,
    authNotice: null,
    profile: profilePatch,
    progress,
    view: state.roadmap ? "roadmap" : "wizard",
    wizardOrder: state.wizardOrder.length ? state.wizardOrder : ["basic", "categories"],
    wizardIndex: state.roadmap ? state.wizardIndex : 0,
  });
  refreshLeaderboard();
  refreshCommunity();
}

function handleSignedOut() {
  state = defaultState();
  save();
  render();
}

async function refreshLeaderboard() {
  if (!isSupabaseConfigured()) return;
  setState({ leaderboardLoading: true, leaderboardError: null });
  try {
    const rows = await fetchLeaderboard(20);
    setState({ leaderboard: rows, leaderboardLoading: false });
  } catch (e) {
    setState({ leaderboardLoading: false, leaderboardError: e.message });
  }
}

async function refreshCommunity() {
  if (!isSupabaseConfigured()) return;
  setState({ communityLoading: true, communityError: null });
  try {
    const rows = await fetchCommunityQuestions(30);
    setState({ communityQuestions: rows, communityLoading: false });
  } catch (e) {
    setState({ communityLoading: false, communityError: e.message });
  }
}

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// ---------- Views ----------

function render() {
  if (!isSupabaseConfigured()) {
    $app.innerHTML = renderSetupBanner();
    return;
  }
  if (state.view === "landing") $app.innerHTML = renderLanding();
  else if (state.view === "auth") $app.innerHTML = renderAuth();
  else if (state.view === "wizard") $app.innerHTML = renderWizard();
  else if (state.view === "roadmap") $app.innerHTML = renderRoadmap();
  if (state.view === "wizard") applyConditionalVisibility();
  window.scrollTo(0, 0);
}

// Hides/shows question wrappers with data-show-if based on their controlling
// field's current value. Called after every wizard render (so defaults are
// correct before the user touches anything) and on every "change" event.
function applyConditionalVisibility() {
  document.querySelectorAll("[data-question-wrapper][data-show-if]").forEach((w) => {
    try {
      const rule = JSON.parse(w.dataset.showIf);
      const controller = document.querySelector(`[data-field="${rule.field}"]`);
      if (!controller) return;
      w.style.display = rule.oneOf.includes(controller.value) ? "" : "none";
    } catch (err) {
      /* malformed rule — show by default */
    }
  });
}

function renderSetupBanner() {
  return `
    <section class="hero">
      <div class="hero-badge">🇫🇮 Kaveri — setup needed</div>
      <h1>Almost there — connect Supabase</h1>
      <p class="hero-sub">
        Kaveri's quest board, accounts, and leaderboard run on a Supabase project.
        Create one, run <code>supabase/schema.sql</code> in its SQL editor, then
        paste the project URL and anon key into <code>js/config.js</code>.
      </p>
      <div class="hero-note">See README.md for the full setup walkthrough.</div>
    </section>
  `;
}

function renderLanding() {
  return `
    <section class="hero-mood">
      <div class="hero-mood-brandmark">
        <span aria-label="India">🇮🇳</span>
        <span class="hero-name">Kaveri</span>
        <span aria-label="Finland">🇫🇮</span>
      </div>
      <div class="hero-mood-labels" aria-hidden="true">
        <span class="mood-label mood-label-1">Settled faster</span>
        <span class="mood-label mood-label-2">Clear on the paperwork</span>
        <span class="mood-label mood-label-3">Closer to your community</span>
      </div>
      <div class="hero-mood-content">
        <h1>One goal in mind: to help you belong.</h1>
        <p class="hero-mood-sub">Your AI friend for moving to Finland — permits, housing, daycare, and more, grounded in real official sources.</p>
        <div class="hero-actions hero-mood-actions">
          <button class="btn btn-primary" data-action="go-auth" data-mode="signup">Sign up & start my quests</button>
          <button class="btn btn-ghost hero-mood-ghost" data-action="go-auth" data-mode="login">Log in</button>
        </div>
      </div>
    </section>
    <div class="hero-trust-band">
      <div class="hero-trust">
        <span class="trust-item">🛡️ Real official sources</span>
        <span class="trust-item">🎯 Personalized to your move</span>
        <span class="trust-item">🏆 Earn points as you go</span>
      </div>
    </div>
    <section class="plan-preview-section">
      <h2>See your plan before you start</h2>
      <div class="plan-preview" aria-hidden="true">
        <div class="plan-preview-header">
          <span>Ananya's quest board</span>
          <span class="plan-preview-progress">2 of 24 done</span>
        </div>
        <div class="progress-bar plan-preview-bar"><div class="progress-fill" style="width:8%"></div></div>
        <div class="plan-preview-list">
          <div class="plan-preview-item done">
            <span class="plan-check">✓</span>
            <span class="plan-title">Book temporary accommodation</span>
            <span class="quest-badge" style="--badge-color:#003580">⚖️ Admin</span>
          </div>
          <div class="plan-preview-item done">
            <span class="plan-check">✓</span>
            <span class="plan-title">Register with DVV</span>
            <span class="quest-badge" style="--badge-color:#003580">⚖️ Admin</span>
          </div>
          <div class="plan-preview-item">
            <span class="plan-check"></span>
            <span class="plan-title">Get your tax card (verokortti)</span>
            <span class="quest-badge" style="--badge-color:#003580">⚖️ Admin</span>
          </div>
          <div class="plan-preview-item">
            <span class="plan-check"></span>
            <span class="plan-title">Try a Finnish sauna</span>
            <span class="quest-badge" style="--badge-color:#4da8da">🎭 Culture</span>
          </div>
        </div>
      </div>
    </section>
    <section class="how">
      <h2>How it works</h2>
      <div class="how-grid">
        <div class="how-card"><span class="how-num">1</span><h3>🧭 Tell us about your move</h3><p>Where you're from, where you're headed, who's with you, and what matters to you.</p></div>
        <div class="how-card"><span class="how-num">2</span><h3>🗂️ Pick your quest areas</h3><p>Administrative Work, Social, Cultural, Food — choose what applies, we handle the rest.</p></div>
        <div class="how-card"><span class="how-num">3</span><h3>🏆 Complete quests, earn points</h3><p>Every quest is grounded in real Migri, DVV, Kela and InfoFinland guidance — and worth real points on the leaderboard.</p></div>
      </div>
    </section>
    <div class="buddy-teaser-band">
      <section class="buddy-teaser">
        <div class="buddy-teaser-copy">
          <h2>The more you tell Kaveri, the better it can help.</h2>
          <p class="muted">Your intake already feeds it — family, timeline, permit stage, the plan so far. Ask it something the plan hasn't covered yet, like "we're a family of four moving in November," and it answers with your actual situation in mind, grounded in real Migri, DVV and Kela guidance.</p>
          <button class="btn btn-secondary" data-action="go-auth" data-mode="signup">💬 Meet your AI Buddy</button>
          <p class="buddy-teaser-note muted">Optional — bring your own Claude API key once you're in. Kept only in your browser tab, never saved anywhere.</p>
        </div>
        <div class="buddy-teaser-art" aria-hidden="true">
          <svg viewBox="0 0 400 400" class="particle-field">${PARTICLE_FIELD_SVG}</svg>
          ${BUDDY_CHIPS.map((c, i) => `<span class="buddy-chip buddy-chip-${i + 1}"><span class="chip-dot" style="--dot:${c.color}"></span>${escapeHtml(c.text)}</span>`).join("")}
        </div>
      </section>
    </div>
    <section class="stories">
      <h2>What a first year with Kaveri could look like</h2>
      <p class="stories-note muted">Illustrative journeys, not real submitted testimonials — the kinds of stories Kaveri is built to help write.</p>
      <div class="stories-grid">
        ${STORY_CARDS.map((s) => `
          <article class="story-card" style="--story-color:${s.color}">
            <h3>${escapeHtml(s.title)}</h3>
            ${s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
            <div class="story-byline">
              <span class="story-avatars">${s.initials.map((i) => `<span class="story-avatar">${escapeHtml(i)}</span>`).join("")}</span>
              <span>
                <strong>${escapeHtml(s.names)}</strong>
                <span class="story-meta">${escapeHtml(s.meta)}</span>
              </span>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

const PARTICLE_FIELD_SVG = `<line x1="288.3" y1="197.7" x2="249.6" y2="204.9" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="156.1" y1="348.0" x2="124.7" y2="328.0" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="61.8" y1="286.4" x2="39.0" y2="284.8" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="41.9" y1="106.2" x2="70.5" y2="92.8" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="243.3" y1="89.0" x2="247.6" y2="48.1" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="299.2" y1="338.8" x2="253.6" y2="377.3" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="382.0" y1="145.9" x2="387.3" y2="195.9" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="223.7" y1="159.2" x2="219.6" y2="124.7" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="70.5" y1="92.8" x2="55.8" y2="77.0" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="336.2" y1="191.8" x2="380.4" y2="211.3" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><circle cx="288.3" cy="197.7" r="2.4" fill="#003580" fill-opacity="0.84"/><circle cx="156.1" cy="348.0" r="2" fill="#8FCBEC" fill-opacity="0.73"/><circle cx="61.8" cy="286.4" r="1.8" fill="#8FCBEC" fill-opacity="0.67"/><circle cx="41.9" cy="106.2" r="3.2" fill="#4DA8DA" fill-opacity="0.99"/><rect x="242.0" y="87.7" width="2.6" height="2.6" fill="#FF9933" fill-opacity="0.85" rx="0.6"/><circle cx="299.2" cy="338.8" r="1.6" fill="#8FCBEC" fill-opacity="0.74"/><circle cx="382.0" cy="145.9" r="1.8" fill="#FF9933" fill-opacity="0.57"/><circle cx="223.7" cy="159.2" r="2" fill="#003580" fill-opacity="0.89"/><circle cx="70.5" cy="92.8" r="2" fill="#138808" fill-opacity="0.95"/><rect x="333.6" y="189.2" width="5.1" height="5.1" fill="#003580" fill-opacity="0.74" rx="0.6"/><circle cx="279.4" cy="44.9" r="2.4" fill="#138808" fill-opacity="0.56"/><circle cx="104.4" cy="316.2" r="2.4" fill="#8FCBEC" fill-opacity="0.89"/><circle cx="296.4" cy="102.2" r="1.6" fill="#003580" fill-opacity="0.91"/><circle cx="366.2" cy="248.7" r="2.8" fill="#4DA8DA" fill-opacity="0.84"/><circle cx="259.9" cy="22.1" r="2.8" fill="#003580" fill-opacity="0.73"/><circle cx="253.6" cy="377.3" r="1.8" fill="#0072CE" fill-opacity="0.73"/><circle cx="38.6" cy="199.4" r="2" fill="#4DA8DA" fill-opacity="0.97"/><rect x="54.2" y="75.4" width="3.2" height="3.2" fill="#138808" fill-opacity="0.75" rx="0.6"/><circle cx="39.0" cy="284.8" r="2.4" fill="#4DA8DA" fill-opacity="0.62"/><circle cx="249.6" cy="204.9" r="3.2" fill="#4DA8DA" fill-opacity="0.6"/><circle cx="247.6" cy="48.1" r="2.8" fill="#138808" fill-opacity="0.59"/><circle cx="327.3" cy="136.0" r="2" fill="#138808" fill-opacity="0.81"/><circle cx="64.6" cy="172.6" r="2" fill="#FF9933" fill-opacity="0.71"/><circle cx="165.9" cy="112.7" r="2.8" fill="#003580" fill-opacity="0.9"/><circle cx="145.7" cy="49.1" r="2" fill="#FF9933" fill-opacity="0.61"/><circle cx="154.6" cy="100.4" r="2" fill="#4DA8DA" fill-opacity="0.57"/><circle cx="124.7" cy="328.0" r="1.8" fill="#8FCBEC" fill-opacity="0.61"/><circle cx="219.6" cy="124.7" r="2" fill="#0072CE" fill-opacity="0.91"/><circle cx="387.3" cy="195.9" r="3.2" fill="#138808" fill-opacity="0.73"/><circle cx="313.5" cy="238.3" r="2" fill="#4DA8DA" fill-opacity="0.81"/><circle cx="233.1" cy="363.9" r="1.6" fill="#FF9933" fill-opacity="0.97"/><circle cx="168.7" cy="384.8" r="2.4" fill="#138808" fill-opacity="0.88"/><circle cx="380.4" cy="211.3" r="2.4" fill="#0072CE" fill-opacity="0.63"/><circle cx="327.6" cy="103.4" r="2.4" fill="#138808" fill-opacity="0.71"/><circle cx="152.7" cy="189.9" r="1.8" fill="#4DA8DA" fill-opacity="0.62"/><circle cx="199.2" cy="350.5" r="1.8" fill="#0072CE" fill-opacity="0.63"/><circle cx="119.2" cy="257.2" r="3.2" fill="#8FCBEC" fill-opacity="0.58"/><circle cx="212.7" cy="310.9" r="2" fill="#8FCBEC" fill-opacity="0.72"/><circle cx="241.3" cy="252.7" r="1.6" fill="#003580" fill-opacity="0.89"/><circle cx="112.8" cy="58.3" r="2.4" fill="#138808" fill-opacity="0.91"/><circle cx="205.7" cy="98.3" r="2.8" fill="#003580" fill-opacity="0.91"/><circle cx="283.5" cy="114.2" r="3.2" fill="#0072CE" fill-opacity="0.69"/><circle cx="108.0" cy="278.8" r="2.8" fill="#003580" fill-opacity="0.93"/><circle cx="165.6" cy="209.7" r="2" fill="#0072CE" fill-opacity="0.57"/><circle cx="35.9" cy="159.8" r="1.6" fill="#8FCBEC" fill-opacity="0.96"/><circle cx="157.7" cy="66.9" r="1.8" fill="#138808" fill-opacity="0.69"/><circle cx="198.0" cy="333.8" r="2.4" fill="#8FCBEC" fill-opacity="0.82"/><circle cx="81.0" cy="179.0" r="2" fill="#FF9933" fill-opacity="0.84"/><circle cx="268.5" cy="171.3" r="2" fill="#0072CE" fill-opacity="0.59"/><circle cx="264.8" cy="254.0" r="2" fill="#FF9933" fill-opacity="0.87"/><rect x="250.4" y="231.3" width="3.8" height="3.8" fill="#FF9933" fill-opacity="0.86" rx="0.6"/><circle cx="317.8" cy="279.6" r="2.4" fill="#8FCBEC" fill-opacity="0.95"/><circle cx="323.7" cy="338.5" r="3.2" fill="#4DA8DA" fill-opacity="0.84"/><circle cx="176.3" cy="44.0" r="1.6" fill="#0072CE" fill-opacity="0.94"/><circle cx="96.3" cy="220.4" r="2.4" fill="#0072CE" fill-opacity="0.83"/><circle cx="328.8" cy="173.0" r="2" fill="#4DA8DA" fill-opacity="0.83"/><circle cx="264.2" cy="363.9" r="3.2" fill="#4DA8DA" fill-opacity="0.64"/><circle cx="183.8" cy="63.0" r="2" fill="#8FCBEC" fill-opacity="0.76"/><circle cx="111.4" cy="166.1" r="2" fill="#4DA8DA" fill-opacity="0.8"/><circle cx="348.2" cy="268.2" r="1.8" fill="#003580" fill-opacity="0.57"/><circle cx="126.6" cy="110.3" r="3.2" fill="#138808" fill-opacity="0.97"/><rect x="196.7" y="73.3" width="3.2" height="3.2" fill="#003580" fill-opacity="0.62" rx="0.6"/><rect x="128.2" y="59.0" width="2.6" height="2.6" fill="#138808" fill-opacity="0.71" rx="0.6"/><rect x="305.7" y="50.1" width="3.2" height="3.2" fill="#FF9933" fill-opacity="0.62" rx="0.6"/><circle cx="224.1" cy="272.8" r="2.4" fill="#003580" fill-opacity="0.99"/><circle cx="194.3" cy="389.0" r="1.8" fill="#003580" fill-opacity="0.92"/><circle cx="286.7" cy="354.8" r="2" fill="#8FCBEC" fill-opacity="0.64"/><circle cx="71.4" cy="315.7" r="3.2" fill="#003580" fill-opacity="0.95"/><circle cx="257.8" cy="114.5" r="2.4" fill="#4DA8DA" fill-opacity="0.93"/><circle cx="132.5" cy="129.8" r="2" fill="#0072CE" fill-opacity="0.85"/><circle cx="166.2" cy="283.9" r="2" fill="#003580" fill-opacity="0.85"/><circle cx="329.1" cy="309.1" r="2" fill="#8FCBEC" fill-opacity="0.7"/><rect x="160.5" y="137.6" width="2.9" height="2.9" fill="#0072CE" fill-opacity="0.73" rx="0.6"/><circle cx="350.1" cy="291.8" r="1.6" fill="#0072CE" fill-opacity="0.76"/><circle cx="127.4" cy="288.9" r="2.4" fill="#FF9933" fill-opacity="0.93"/><circle cx="341.1" cy="322.4" r="2.8" fill="#4DA8DA" fill-opacity="0.9"/><circle cx="182.9" cy="220.6" r="3.2" fill="#4DA8DA" fill-opacity="0.84"/><circle cx="180.9" cy="11.1" r="1.6" fill="#FF9933" fill-opacity="0.69"/><circle cx="214.6" cy="379.6" r="1.6" fill="#4DA8DA" fill-opacity="0.66"/><circle cx="322.6" cy="58.5" r="2" fill="#003580" fill-opacity="0.73"/><rect x="163.0" y="323.4" width="2.6" height="2.6" fill="#FF9933" fill-opacity="0.72" rx="0.6"/><circle cx="363.3" cy="142.3" r="2.4" fill="#138808" fill-opacity="0.78"/><circle cx="62.4" cy="219.3" r="3.2" fill="#003580" fill-opacity="0.63"/><circle cx="300.2" cy="263.0" r="2.4" fill="#FF9933" fill-opacity="0.55"/><circle cx="316.0" cy="188.9" r="2.4" fill="#8FCBEC" fill-opacity="0.99"/><circle cx="217.7" cy="333.7" r="2.8" fill="#8FCBEC" fill-opacity="0.76"/><circle cx="84.4" cy="100.7" r="1.8" fill="#138808" fill-opacity="0.75"/><circle cx="178.3" cy="268.9" r="3.2" fill="#0072CE" fill-opacity="0.83"/><circle cx="265.0" cy="326.0" r="3.2" fill="#138808" fill-opacity="0.92"/><circle cx="153.8" cy="258.3" r="2" fill="#0072CE" fill-opacity="0.93"/>`;

const BUDDY_CHIPS = [
  { color: "#FF9933", text: "Moving with 2 kids" },
  { color: "#0072CE", text: "Job offer already in hand" },
  { color: "#138808", text: "Needs English-language schooling" },
  { color: "#4DA8DA", text: "PhD starting in August" },
];

const STORY_CARDS = [
  {
    color: "#003580",
    title: "Arjun found his footing before his daughter's first day of school.",
    paragraphs: [
      "Arjun moved from Bengaluru to Espoo for a software role, with his wife Meera and their 6-year-old, Diya. He had an offer letter. He didn't have a residence permit timeline, a place to register, or a school for Diya.",
      "Kaveri turned that into an order: residence permit, temporary housing, DVV registration, a Kela card, then English-language schools nearby. Diya started school six weeks after landing.",
      "What stuck with Arjun wasn't the paperwork — it was seeing why each step applied to his family, instead of guessing which of ten government sites actually mattered.",
    ],
    initials: ["AR", "MR"],
    names: "Arjun & Meera",
    meta: "Bengaluru → Espoo, 3 months in",
  },
  {
    color: "#0072CE",
    title: "Priya stopped feeling like she was guessing.",
    paragraphs: [
      "Priya arrived in Helsinki for a research position with a stack of Migri and DVV instructions that all assumed she already knew what order to do things in.",
      "Kaveri put \"register your address\" before \"open a bank account\" before \"get a tax card\" — the sequence that actually works — and pointed her to local Meetup groups for evenings that weren't just her laptop and takeout.",
      "Six months in, she has a personal identity code, a favourite lunch spot near Kumpula, and a running joke with her advisor about explaining Finnish bureaucracy better than he can.",
    ],
    initials: ["PR"],
    names: "Priya",
    meta: "Chennai → Helsinki, researcher, 6 months in",
  },
  {
    color: "#4DA8DA",
    title: "Karthik and Sana stopped researching and started living.",
    paragraphs: [
      "Karthik and Sana moved to Tampere together — one relocating for work, the other job-hunting from scratch. Two very different sets of admin, at the same time.",
      "Kaveri split their quest boards without splitting their plan: his residence permit and tax card, her job-seeker registration and TE-services setup, both pointing at the same shared housing and DVV quests underneath.",
      "They've since been to a sauna they didn't expect to like, and joined a badminton group through a local Indian association — Kela doesn't feel like a scary word anymore.",
    ],
    initials: ["KA", "SA"],
    names: "Karthik & Sana",
    meta: "Pune → Tampere, 4 months in",
  },
];

function renderAuth() {
  const isSignup = state.authMode === "signup";
  return `
    <section class="auth-card">
      <h2>${isSignup ? "Join the Kaveri community" : "Welcome back, kaveri"}</h2>
      <p class="muted">${isSignup ? "Kaveri means \"friend\" — sign up and your buddy starts guiding you, alongside everyone else on the same journey from India to Finland." : "Log back in to pick up where you and your buddy left off."}</p>
      ${state.authNotice ? `<p class="auth-notice">${escapeHtml(state.authNotice)}</p>` : ""}
      ${state.authError ? `<p class="auth-error">${escapeHtml(state.authError)}</p>` : ""}
      <form data-form="auth">
        <label>Email<input type="email" name="email" required placeholder="you@example.com"></label>
        <label>Password<input type="password" name="password" required minlength="6" placeholder="At least 6 characters"></label>
        <button class="btn btn-primary" type="submit" ${state.authLoading ? "disabled" : ""}>${state.authLoading ? "Please wait…" : isSignup ? "Join Kaveri" : "Log in"}</button>
      </form>
      <button class="link-btn" data-action="toggle-auth-mode">${isSignup ? "Already have an account? Log in" : "New here? Sign up"}</button>
      <button class="link-btn" data-action="skip-login">Skip login — try it without an account (test mode, no leaderboard sync)</button>
    </section>
  `;
}

const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"];

function renderWizard() {
  const step = state.wizardOrder[state.wizardIndex] || "basic";
  let inner = "";
  if (step === "basic") inner = renderBasicStep();
  else if (step === "categories") inner = renderCategoriesStep();
  else if (step.startsWith("cat:")) inner = renderCategoryQuestionStep(step.slice(4));
  else if (step === "review") inner = renderReviewStep();

  const total = state.wizardOrder.length || 1;
  const pct = Math.round(((state.wizardIndex + 1) / total) * 100);

  return `
    <section class="wizard">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div id="wizard-step">${inner}</div>
    </section>
  `;
}

function renderBasicStep() {
  const p = state.profile;
  return `
    <h2>Tell us about your move</h2>
    ${state.syncError ? `<p class="auth-error">${escapeHtml(state.syncError)}</p>` : ""}
    <div class="field-grid">
      <label>Your name<input type="text" data-field="name" value="${escapeHtml(p.name || "")}" placeholder="e.g. Ananya"></label>
      <label>Moving from (city/state in India)<input type="text" data-field="origin" value="${escapeHtml(p.origin || "")}" placeholder="e.g. Bengaluru, Karnataka"></label>
      <label>Moving to<select data-field="destination">
        ${FINLAND_DESTINATIONS.map((d) => `<option value="${d}" ${p.destination === d ? "selected" : ""}>${d}</option>`).join("")}
      </select></label>
      <label>Your age range<select data-field="ageRange">
        <option value="">Prefer not to say</option>
        ${AGE_RANGES.map((r) => `<option value="${r}" ${p.ageRange === r ? "selected" : ""}>${r}</option>`).join("")}
      </select></label>
      <label>Your background<select data-field="background">
        <option value="">Select one</option>
        ${BACKGROUNDS.map((b) => `<option value="${b.id}" ${p.background === b.id ? "selected" : ""}>${b.label}</option>`).join("")}
      </select></label>
      <label>Adults travelling (incl. you)<input type="number" min="1" data-field="adults" value="${escapeHtml(p.adults || 1)}"></label>
      <label>Children travelling<input type="number" min="0" data-field="childrenCount" value="${escapeHtml(p.childrenCount || 0)}"></label>
      <label>Children's ages (if any)<input type="text" data-field="childrenAges" value="${escapeHtml(p.childrenAges || "")}" placeholder="e.g. 4 and 9"></label>
      <label>On the public leaderboard, show<select data-field="publicNameChoice">
        <option value="real" ${p.publicNameChoice !== "nickname" ? "selected" : ""}>My real name</option>
        <option value="nickname" ${p.publicNameChoice === "nickname" ? "selected" : ""}>A nickname instead</option>
      </select></label>
      <div class="question" data-question-wrapper data-show-if='{"field":"publicNameChoice","oneOf":["nickname"]}'>
        <label>Nickname to show instead<input type="text" data-field="publicName" value="${escapeHtml(p.publicName || "")}" placeholder="e.g. A.K. or Newcomer42"></label>
      </div>
    </div>
    <div class="wizard-nav">
      <span></span>
      <button class="btn btn-primary" data-action="wizard-next-basic">Continue</button>
    </div>
  `;
}

function renderCategoriesStep() {
  const sel = new Set(state.categorySelection);
  return `
    <h2>What do you want quests for?</h2>
    <p class="muted">Pick as many as apply — each adds a short set of questions so your quests reflect your real situation. Cultural and Food quests are always included.</p>
    <div class="category-grid">
      ${CATEGORIES.map((c) => {
        const qc = QUEST_CATEGORIES[c.questCategory];
        return `
        <label class="category-card ${sel.has(c.id) ? "selected" : ""}">
          <input type="checkbox" data-category-toggle="${c.id}" ${sel.has(c.id) ? "checked" : ""}>
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-label">${escapeHtml(c.label)}</span>
          <span class="quest-badge" style="--badge-color:${qc.color}">${qc.icon} ${qc.label}</span>
          <span class="cat-blurb">${escapeHtml(c.blurb)}</span>
        </label>`;
      }).join("")}
    </div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" data-action="wizard-back">Back</button>
      <button class="btn btn-primary" data-action="wizard-next-categories">Continue</button>
    </div>
  `;
}

function renderCategoryQuestionStep(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  const answers = state.categoryAnswers[catId] || {};
  return `
    <h2>${cat.icon} ${escapeHtml(cat.label)}</h2>
    <p class="muted">Answer what you can — skip anything you're not sure about yet.</p>
    <div class="question-list">
      ${cat.questions
        .map((q) => {
          const showIf = q.showIf ? `data-show-if='${escapeHtml(JSON.stringify(q.showIf))}'` : "";
          let control = "";
          if (q.type === "select") {
            control = `<select data-field="${q.id}">
              <option value="">Skip this</option>
              ${q.options.map((o) => `<option value="${escapeHtml(o)}" ${answers[q.id] === o ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
            </select>`;
          } else if (q.type === "text") {
            control = `<input type="text" data-field="${q.id}" value="${escapeHtml(answers[q.id] || "")}" placeholder="${escapeHtml(q.placeholder || "")}">`;
          } else if (q.type === "multiselect") {
            const chosen = new Set(answers[q.id] || []);
            control = `<div class="chip-row">${q.options
              .map((o) => `<label class="chip"><input type="checkbox" data-field-multi="${q.id}" value="${escapeHtml(o)}" ${chosen.has(o) ? "checked" : ""}>${escapeHtml(o)}</label>`)
              .join("")}</div>`;
          }
          return `<div class="question" data-question-wrapper ${showIf}><label>${escapeHtml(q.label)}${control}</label></div>`;
        })
        .join("")}
    </div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" data-action="wizard-back">Back</button>
      <button class="btn btn-primary" data-action="wizard-next-category" data-cat="${catId}">Continue</button>
    </div>
  `;
}

function renderReviewStep() {
  const p = state.profile;
  return `
    <h2>Ready to build your quest board</h2>
    <div class="review-summary">
      <p><strong>${escapeHtml(p.name || "You")}</strong>, moving from <strong>${escapeHtml(p.origin || "India")}</strong> to <strong>${escapeHtml(p.destination || "Finland")}</strong>.</p>
      <p>${escapeHtml(p.adults || 1)} adult(s)${p.childrenCount > 0 ? ` and ${escapeHtml(p.childrenCount)} child(ren)${p.childrenAges ? ` (${escapeHtml(p.childrenAges)})` : ""}` : ""} travelling.</p>
      <p>Quest areas selected: ${state.categorySelection.map((id) => CATEGORIES.find((c) => c.id === id)?.label).join(", ")}, plus Cultural &amp; Food.</p>
    </div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" data-action="wizard-back">Back</button>
      <button class="btn btn-primary" data-action="generate-roadmap">Generate my quest board →</button>
    </div>
  `;
}

function renderRoadmap() {
  const roadmap = state.roadmap || {};
  let total = 0;
  let done = 0;
  let possiblePoints = 0;
  const touchedCategories = new Set();
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s, i) => {
      total++;
      possiblePoints += s.points || 0;
      touchedCategories.add(s.questCategory);
      if (state.progress[questKeyFor(ph.id, s, i)]) done++;
    });
  });
  const overallPct = total ? Math.round((done / total) * 100) : 0;
  const totalPoints = computeTotalPoints();
  const level = levelFor(totalPoints);
  const nextLevel = LEVELS.find((l) => l.min > totalPoints);
  const levelPct = nextLevel ? Math.min(100, Math.round(((totalPoints - level.min) / (nextLevel.min - level.min)) * 100)) : 100;

  const priorityPool = [];
  ["before", "week2"].forEach((phId) => {
    (roadmap[phId] || []).forEach((s, i) => {
      if (!state.progress[questKeyFor(phId, s, i)]) priorityPool.push({ ...s, phaseId: phId, idx: i });
    });
  });
  const priorities = priorityPool.slice(0, 3);

  // Only the first phase (in order) that still has unfinished quests starts
  // expanded — otherwise every phase opens at once and the board reads as
  // one long undifferentiated wall of cards.
  let firstOpenPhaseId = null;
  for (const ph of PHASES) {
    const steps = roadmap[ph.id] || [];
    if (!steps.length) continue;
    const phDone = steps.filter((s, i) => state.progress[questKeyFor(ph.id, s, i)]).length;
    if (phDone < steps.length) {
      firstOpenPhaseId = ph.id;
      break;
    }
  }

  return `
    <section class="roadmap-header">
      <div>
        <h2>${escapeHtml(state.profile.name || "Your")} quest board: ${escapeHtml(state.profile.origin || "India")} → ${escapeHtml(state.profile.destination || "Finland")}</h2>
        <div class="progress-bar wide"><div class="progress-fill" style="width:${overallPct}%"></div></div>
        <span class="muted">${done} of ${total} quests done</span>
      </div>
      <div class="score-panel">
        <div class="score-top">
          <span class="score-level-badge">${level.icon}</span>
          <div>
            <div class="score-points">🪙 ${totalPoints} pts</div>
            <div class="score-level">${level.label}</div>
          </div>
        </div>
        <div class="level-progress"><div class="level-progress-fill" style="width:${levelPct}%"></div></div>
        <div class="level-next muted">${nextLevel ? `${nextLevel.min - totalPoints} pts to ${nextLevel.icon} ${nextLevel.label}` : "Max level reached! 🎉"}</div>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" data-action="edit-profile">Edit my details</button>
        <button class="btn btn-ghost" data-action="download-pdf">📄 Download PDF</button>
        <button class="btn btn-ghost" data-action="log-out">Log out</button>
      </div>
    </section>

    <div class="roadmap-layout">
      <div class="roadmap-main">
        ${renderAssistantIntro(total, possiblePoints, touchedCategories.size)}

        ${
          /* AI Buddy (Claude API key entry) pulled from the UI on purpose —
           * not meant for every visitor to see. renderAiBuddy() is still
           * intact; re-add "${renderAiBuddy()}" here to bring it back. */ ""
        }

        ${
          priorities.length
            ? `<section class="priorities">
            <h3>🎯 Kaveri's picks: what matters most right now</h3>
            <div class="priority-list">
              ${priorities.map((s) => renderStepCard(s, s.phaseId, s.idx, true)).join("")}
            </div>
          </section>`
            : ""
        }

        <section class="phases">
          ${PHASES.map((ph) => renderPhaseSection(ph, roadmap[ph.id] || [], ph.id === firstOpenPhaseId)).join("")}
        </section>
      </div>

      <aside class="roadmap-sidebar">
        ${renderLeaderboard()}
        ${renderCommunity()}
      </aside>
    </div>
  `;
}

function renderAssistantIntro(totalQuests, possiblePoints, categoryCount) {
  const name = state.profile.name || "there";
  const origin = state.profile.origin || "India";
  const destination = state.profile.destination || "Finland";
  return `
    <section class="assistant-intro">
      <div class="assistant-avatar" aria-hidden="true">🤖</div>
      <div class="assistant-bubble">
        <p class="assistant-name">Kaveri <span class="assistant-tag">AI relocation assistant</span></p>
        <p>Hi ${escapeHtml(name)} — I read through what you told me and put together a plan for your move from ${escapeHtml(origin)} to ${escapeHtml(destination)}.</p>
        <p><strong>${totalQuests} quests</strong> across ${categoryCount} area${categoryCount === 1 ? "" : "s"}, worth up to <strong>${possiblePoints} points</strong>. Every single one links to a real, official source — tap it and check for yourself, don't just trust me.</p>
        <p class="assistant-hint">Tick a box once you've actually done something, to earn its points. Something specific I haven't covered? Ask me below.</p>
      </div>
    </section>
  `;
}

function renderPhaseSection(phase, steps, openByDefault) {
  if (!steps.length) return "";
  const doneCount = steps.filter((s, i) => state.progress[questKeyFor(phase.id, s, i)]).length;
  return `
    <details class="phase-section" ${openByDefault ? "open" : ""}>
      <summary>
        <span>${phase.icon} ${escapeHtml(phase.label)}</span>
        <span class="phase-progress-pill ${doneCount === steps.length ? "complete" : ""}">${doneCount === steps.length ? "✓ " : ""}${doneCount}/${steps.length}</span>
      </summary>
      ${phase.blurb ? `<p class="phase-blurb">${escapeHtml(phase.blurb)}</p>` : ""}
      <div class="step-list">
        ${steps.map((s, i) => renderStepCard(s, phase.id, i, false)).join("")}
      </div>
    </details>
  `;
}

function renderStepCard(s, phaseId, idx, compact) {
  const key = questKeyFor(phaseId, s, idx);
  const checked = !!state.progress[key];
  const qc = QUEST_CATEGORIES[s.questCategory] || QUEST_CATEGORIES.legal;
  const checkboxInput = `<input type="checkbox" data-progress-toggle="${key}" data-quest-category="${s.questCategory}" data-quest-points="${s.points}" ${checked ? "checked" : ""}>`;

  if (checked) {
    // Completed quests collapse to a compact row instead of staying full
    // height with struck-through paragraphs — keeps the board readable as
    // progress builds up instead of getting messier.
    return `
      <div class="step-card done" style="--badge-color:${qc.color}; --stack-i:${idx}">
        <label class="step-check">${checkboxInput}</label>
        <div class="step-body">
          <span class="quest-badge" style="--badge-color:${qc.color}">${qc.icon} ${qc.label}</span>
          <h4>${escapeHtml(s.title)}</h4>
          <span class="step-points-earned">✓ +${s.points} pts earned</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="step-card" style="--badge-color:${qc.color}; --stack-i:${idx}">
      <label class="step-check">${checkboxInput}</label>
      <div class="step-body">
        <div class="step-cat">
          <span class="quest-badge" style="--badge-color:${qc.color}">${qc.icon} ${qc.label}</span>
          <span class="step-points">🪙 +${s.points} pts</span>
        </div>
        <h4>${escapeHtml(s.title)}</h4>
        <p class="step-why">${escapeHtml(s.why)}</p>
        <p class="step-action">🎯 <strong>Do this:</strong> ${escapeHtml(s.action)}</p>
        <div class="step-sources">
          ${(s.sources || [s.source])
            .map((src) => `<a class="step-source" href="${src.url}" target="_blank" rel="noopener">📎 ${escapeHtml(src.name)}</a>`)
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function initialsFor(name) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

function renderLeaderboard() {
  const rows = state.leaderboard || [];
  return `
    <section class="leaderboard">
      <div class="section-header section-header-gold"><span class="section-header-title">🏆 Leaderboard</span></div>
      <div class="section-body">
        ${state.leaderboardError ? `<p class="auth-error">Couldn't load the leaderboard: ${escapeHtml(state.leaderboardError)}</p>` : ""}
        ${
          state.leaderboardLoading
            ? `<p class="muted">Loading…</p>`
            : rows.length
            ? `<ol class="leaderboard-list">
                ${rows
                  .map((r, i) => {
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                    const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
                    const isMe = r.id === state.authUserId;
                    return `<li class="${isMe ? "me" : ""}">
                      <span class="avatar-circle ${rankClass}">${initialsFor(r.name)}</span>
                      <span class="lb-rank">${medal}</span>
                      <span class="lb-name">${escapeHtml(r.name)}${isMe ? " (you)" : ""}</span>
                      <span class="lb-points">🪙 ${r.total_points} pts</span>
                    </li>`;
                  })
                  .join("")}
              </ol>`
            : `<p class="muted">No one's completed a quest yet — be the first.</p>`
        }
        <button class="link-btn" data-action="refresh-leaderboard">Refresh</button>
      </div>
    </section>
  `;
}

function renderCommunity() {
  const rows = state.communityQuestions || [];
  const canPost = !!state.authUserId;
  return `
    <section class="community">
      <div class="section-header section-header-social"><span class="section-header-title">💬 Ask Kaveri Community</span></div>
      <div class="section-body">
        <p class="muted">Post a question for other newcomers — and Kaveris further along — to help answer.</p>
        ${state.communityError ? `<p class="auth-error">Couldn't reach the community board: ${escapeHtml(state.communityError)}</p>` : ""}
        ${
          canPost
            ? `<form data-form="community-question">
                <textarea name="question" rows="2" placeholder="e.g. Anyone know a pediatrician near Espoo who speaks English?" required></textarea>
                <button class="btn btn-primary" type="submit">Post question</button>
              </form>`
            : `<p class="muted">Log in with a real account (not test mode) to post a question or reply — you can still read what others have asked.</p>`
        }
        ${
          state.communityLoading
            ? `<p class="muted">Loading…</p>`
            : rows.length
            ? `<div class="community-list">${rows.map((q) => renderCommunityQuestion(q, canPost)).join("")}</div>`
            : `<p class="muted">No questions yet — be the first to ask.</p>`
        }
        <button class="link-btn" data-action="refresh-community">Refresh</button>
      </div>
    </section>
  `;
}

function renderCommunityQuestion(q, canPost) {
  const replies = (q.community_replies || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return `
    <div class="community-question">
      <div class="community-q-head">
        <span class="avatar-circle">${initialsFor(q.name)}</span>
        <span class="community-name">${escapeHtml(q.name)}</span>
        <span class="community-time muted">${timeAgo(q.created_at)}</span>
      </div>
      <p class="community-q-body">${escapeHtml(q.question)}</p>
      ${
        replies.length
          ? `<div class="community-replies">${replies
              .map(
                (r) => `
                <div class="community-reply">
                  <div class="community-q-head">
                    <span class="avatar-circle small">${initialsFor(r.name)}</span>
                    <span class="community-name">${escapeHtml(r.name)}</span>
                    <span class="community-time muted">${timeAgo(r.created_at)}</span>
                  </div>
                  <p>${escapeHtml(r.reply)}</p>
                </div>`
              )
              .join("")}</div>`
          : ""
      }
      ${
        canPost
          ? `<form data-form="community-reply" data-question-id="${q.id}">
              <input type="text" name="reply" placeholder="Write a reply..." required>
              <button class="btn btn-ghost" type="submit">Reply</button>
            </form>`
          : ""
      }
    </div>
  `;
}

function renderAiBuddy() {
  const key = hasApiKey();
  return `
    <section class="ai-buddy">
      <h3>💬 Ask Kaveri</h3>
      ${
        key
          ? `
        <div class="ai-log">
          ${state.aiChatLog.map((m) => `<div class="ai-msg ai-${m.role}">${escapeHtml(m.text)}</div>`).join("") || `<p class="muted">Ask anything the plan above doesn't cover — e.g. "we're a family of four moving in November, what changes for us?"</p>`}
        </div>
        <form data-form="ai-ask">
          <input type="text" name="question" placeholder="Ask a follow-up question..." required>
          <button class="btn btn-primary" type="submit">Ask</button>
        </form>
        <button class="link-btn" data-action="clear-api-key">Disconnect</button>
      `
          : `<p class="muted">The quest board above is generated from a fixed knowledge base — this is the live, conversational part. Add your own Claude API key to ask Kaveri anything the plan didn't anticipate.</p>
        <button class="btn btn-secondary" data-action="open-settings">💬 Talk to Kaveri</button>`
      }
    </section>
    <div class="settings-modal" id="settings-modal" hidden>
      <div class="settings-box">
        <h3>Talk to Kaveri</h3>
        <p class="muted">Stored only in this browser tab (sessionStorage). Cleared when you close the tab. Never saved to any file or sent anywhere except Anthropic's API, directly from your browser.</p>
        <form data-form="api-key">
          <input type="password" name="apiKey" placeholder="sk-ant-..." value="${escapeHtml(getApiKey())}">
          <div class="wizard-nav">
            <button type="button" class="btn btn-ghost" data-action="close-settings">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ---------- Event wiring (delegated — survives re-renders) ----------

// Click on the dimmed backdrop (not the box itself) or press Escape to close
// whichever settings-modal is currently open.
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("settings-modal")) e.target.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".settings-modal:not([hidden])").forEach((m) => (m.hidden = true));
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "toggle-theme") {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  } else if (action === "go-home") {
    setState({ view: "landing", authError: null, authNotice: null });
  } else if (action === "go-auth") {
    setState({ view: "auth", authMode: el.dataset.mode, authError: null, authNotice: null });
  } else if (action === "toggle-auth-mode") {
    setState({ authMode: state.authMode === "signup" ? "login" : "signup", authError: null, authNotice: null });
  } else if (action === "skip-login") {
    // Test mode: no Supabase user, so quest completions stay local-only —
    // see the guard on state.authUserId in the progress-toggle handler and
    // in "wizard-next-basic" below. Leaderboard is still readable (public
    // view), just won't include this session.
    setState({ view: "wizard", wizardOrder: ["basic", "categories"], wizardIndex: 0, authError: null, authNotice: null });
    refreshLeaderboard();
    refreshCommunity();
  } else if (action === "wizard-next-basic") {
    const step = document.getElementById("wizard-step");
    const profile = { ...state.profile };
    step.querySelectorAll("[data-field]").forEach((input) => (profile[input.dataset.field] = input.value));
    setState({ profile, view: "wizard", wizardOrder: ["basic", "categories"], wizardIndex: 1, syncError: null });
    if (state.authUserId) {
      const publicName = profile.publicNameChoice === "nickname" && profile.publicName ? profile.publicName : null;
      upsertMyProfile({ id: state.authUserId, name: profile.name, origin: profile.origin, destination: profile.destination, publicName }).catch((err) => setState({ syncError: `Couldn't save your profile: ${err.message}` }));
    }
  } else if (action === "wizard-next-categories") {
    const order = ["basic", "categories", ...state.categorySelection.map((id) => `cat:${id}`), "review"];
    setState({ wizardOrder: order, wizardIndex: 2 });
  } else if (action === "wizard-next-category") {
    const catId = el.dataset.cat;
    const step = document.getElementById("wizard-step");
    const answers = { ...(state.categoryAnswers[catId] || {}) };
    step.querySelectorAll("[data-field]").forEach((input) => (answers[input.dataset.field] = input.value));
    const multiFields = {};
    step.querySelectorAll("[data-field-multi]").forEach((input) => {
      const f = input.dataset.fieldMulti;
      if (!multiFields[f]) multiFields[f] = [];
      if (input.checked) multiFields[f].push(input.value);
    });
    Object.assign(answers, multiFields);
    setState({ categoryAnswers: { ...state.categoryAnswers, [catId]: answers }, wizardIndex: state.wizardIndex + 1 });
  } else if (action === "wizard-back") {
    setState({ wizardIndex: Math.max(0, state.wizardIndex - 1) });
  } else if (action === "generate-roadmap") {
    // Only build from currently-selected categories — a category answered,
    // then deselected on a later "back", must not leak into the roadmap.
    const relevantAnswers = {};
    state.categorySelection.forEach((id) => {
      if (state.categoryAnswers[id]) relevantAnswers[id] = state.categoryAnswers[id];
    });
    const roadmap = buildRoadmap(state.profile, relevantAnswers);
    setState({ roadmap, progress: {}, view: "roadmap" });
    if (state.authUserId) {
      fetchMyCompletions(state.authUserId)
        .then((completions) => setState({ progress: progressFromCompletions(roadmap, completions) }))
        .catch(() => {});
    }
  } else if (action === "edit-profile") {
    setState({ view: "wizard", wizardOrder: ["basic", "categories"], wizardIndex: 0 });
  } else if (action === "open-settings") {
    document.getElementById("settings-modal").hidden = false;
  } else if (action === "close-settings") {
    document.getElementById("settings-modal").hidden = true;
  } else if (action === "clear-api-key") {
    setApiKey("");
    render();
  } else if (action === "refresh-leaderboard") {
    refreshLeaderboard();
  } else if (action === "refresh-community") {
    refreshCommunity();
  } else if (action === "download-pdf") {
    // Expand every phase so nothing is missing from the printed/saved PDF,
    // then hand off to the browser's native print-to-PDF — no extra library,
    // no network dependency, works offline.
    document.querySelectorAll(".phase-section").forEach((d) => (d.open = true));
    window.print();
  } else if (action === "log-out") {
    signOutUser()
      .then(() => handleSignedOut())
      .catch((err) => setState({ syncError: `Couldn't log out: ${err.message}` }));
  } else if (action === "open-fun-fact") {
    showRandomFunFact();
    document.getElementById("fun-fact-modal").hidden = false;
  } else if (action === "next-fun-fact") {
    showRandomFunFact();
  } else if (action === "close-fun-fact") {
    document.getElementById("fun-fact-modal").hidden = true;
  } else if (action === "open-resources") {
    renderResourcesList();
    document.getElementById("resources-modal").hidden = false;
  } else if (action === "close-resources") {
    document.getElementById("resources-modal").hidden = true;
  } else if (action === "open-events") {
    renderEventsList();
    document.getElementById("events-modal").hidden = false;
  } else if (action === "close-events") {
    document.getElementById("events-modal").hidden = true;
  } else if (action === "open-volunteer") {
    renderVolunteerList();
    document.getElementById("volunteer-modal").hidden = false;
  } else if (action === "close-volunteer") {
    document.getElementById("volunteer-modal").hidden = true;
  }
});

// ---------- Fun Fact + Resources popups (static overlays, live outside #app
// so they stay available across every view without being wiped by render()) ----------

function showRandomFunFact() {
  const fact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  document.getElementById("fun-fact-text").textContent = fact;
}

function renderLinkGroups(groups, targetElId) {
  document.getElementById(targetElId).innerHTML = groups.map(
    (group) => `
      <div class="resources-group">
        <h4>${escapeHtml(group.section)}</h4>
        <ul>
          ${group.links
            .map(
              (l) =>
                `<li><a href="${l.url}" target="_blank" rel="noopener">${escapeHtml(l.name)}</a> — <span class="muted">${escapeHtml(l.note)}</span></li>`
            )
            .join("")}
        </ul>
      </div>
    `
  ).join("");
}

function renderResourcesList() {
  renderLinkGroups(RESOURCES, "resources-list");
}

function renderEventsList() {
  renderLinkGroups(COMMUNITY_EVENTS, "events-list");
}

function renderVolunteerList() {
  renderLinkGroups(VOLUNTEER_OPPORTUNITIES, "volunteer-list");
}

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.matches("[data-category-toggle]")) {
    const id = el.dataset.categoryToggle;
    let sel = new Set(state.categorySelection);
    if (el.checked) sel.add(id);
    else sel.delete(id);
    setState({ categorySelection: [...sel] });
    return;
  }
  applyConditionalVisibility();
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;

  if (kind === "auth") {
    const email = form.email.value.trim();
    const password = form.password.value;
    setState({ authLoading: true, authError: null, authNotice: null });
    const isSignup = state.authMode === "signup";
    const authCall = isSignup ? signUpWithEmail({ email, password }) : signInWithEmail({ email, password });
    authCall
      .then((data) => {
        if (data.session && data.user) {
          setState({ authLoading: false });
          return handleSignedIn(data.user);
        }
        // Signup succeeded but email confirmation is required — no session yet.
        setState({ authLoading: false, authMode: "login", authNotice: "Account created — check your email to confirm it, then log in." });
      })
      .catch((err) => setState({ authLoading: false, authError: err.message }));
  } else if (kind === "api-key") {
    const key = form.apiKey.value.trim();
    setApiKey(key);
    document.getElementById("settings-modal").hidden = true;
    render();
  } else if (kind === "ai-ask") {
    const question = form.question.value.trim();
    if (!question) return;
    const log = [...state.aiChatLog, { role: "user", text: question }];
    setState({ aiChatLog: log });
    const summary = summarizeRoadmapForAi();
    askAiBuddy(question, state.profile, summary)
      .then((answer) => setState({ aiChatLog: [...state.aiChatLog, { role: "assistant", text: answer }] }))
      .catch((err) => setState({ aiChatLog: [...state.aiChatLog, { role: "assistant", text: `Couldn't reach AI Buddy: ${err.message}` }] }));
  } else if (kind === "community-question") {
    const question = form.question.value.trim();
    if (!question || !state.authUserId) return;
    postCommunityQuestion({ userId: state.authUserId, name: state.profile.name || "A Kaveri", question })
      .then(() => {
        form.reset();
        refreshCommunity();
      })
      .catch((err) => setState({ communityError: err.message }));
  } else if (kind === "community-reply") {
    const reply = form.reply.value.trim();
    const questionId = form.dataset.questionId;
    if (!reply || !state.authUserId) return;
    postCommunityReply({ questionId, userId: state.authUserId, name: state.profile.name || "A Kaveri", reply })
      .then(() => {
        form.reset();
        refreshCommunity();
      })
      .catch((err) => setState({ communityError: err.message }));
  }
});

// Small hand-rolled confetti burst — no library, so it can't add a network
// dependency or fail silently if a CDN is unreachable on venue wifi.
const CONFETTI_COLORS = ["#ff9933", "#138808", "#003580", "#4da8da", "#c9971f", "#ffffff"];

function fireConfetti(x, y) {
  const layer = document.getElementById("confetti-layer");
  if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const count = 26;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const angle = Math.random() * Math.PI - Math.PI / 2 - Math.PI / 2; // upward-ish spread
    const distance = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance + 120 + Math.random() * 80; // gravity drift down
    const spin = 360 + Math.random() * 540 * (Math.random() < 0.5 ? -1 : 1);
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.setProperty("--confetti-x", `${dx}px`);
    piece.style.setProperty("--confetti-y", `${dy}px`);
    piece.style.setProperty("--confetti-spin", `${spin}deg`);
    piece.style.setProperty("--confetti-duration", `${700 + Math.random() * 400}ms`);
    piece.addEventListener("animationend", () => piece.remove());
    layer.appendChild(piece);
  }
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-progress-toggle]");
  if (!el) return;
  const key = el.dataset.progressToggle;
  const wasChecked = !!state.progress[key];
  const nowChecked = !wasChecked;
  if (nowChecked) {
    const rect = el.getBoundingClientRect();
    fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  const progress = { ...state.progress, [key]: nowChecked };
  setState({ progress, syncError: null });

  if (!state.authUserId) return;
  const questCategory = el.dataset.questCategory;
  const points = Number(el.dataset.questPoints) || 0;
  const sync = nowChecked
    ? completeQuest({ userId: state.authUserId, questKey: key, questCategory, points })
    : uncompleteQuest({ userId: state.authUserId, questKey: key });
  sync
    .then(() => refreshLeaderboard())
    .catch((err) => {
      // Revert the optimistic toggle so local state matches what's actually saved.
      setState({ progress: { ...state.progress, [key]: wasChecked }, syncError: `Couldn't save that quest: ${err.message}` });
    });
});

function summarizeRoadmapForAi() {
  const roadmap = state.roadmap || {};
  const lines = [];
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s) => lines.push(`[${ph.label}] ${s.title} (${s.categoryLabel})`));
  });
  return lines.join("\n");
}

initAuth();
