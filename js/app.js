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

    // ---- Mobile app view (design "1a") — local-only UI state, see
    // js/mobileApp.js. Not synced to Supabase; a fresh browser/device just
    // starts these over, same as everything else in this localStorage blob.
    mobileAppOn: null, // null = auto (narrow viewport); true/false = manual override via the "App view" toggle
    mobileTab: "today", // today | quests | buddy | people | you
    mobileSel: null, // { phaseId, idx } of the quest shown in the detail overlay
    mobilePeopleTab: "board", // board | ask
    mobileQuestFilter: "all", // all | legal | social | cultural | food — see MOBILE_QUEST_FILTERS
    mobileOpenPhase: null, // phaseId of the expanded quest-board accordion section; null = auto (first phase with something left to do)
    levelUpLabel: null,
    levelUpEarned: 0,
    roadmapStartedAt: null, // set once, first time a roadmap is generated — powers "Day N in {city}"
    streakLastDate: null, // yyyy-mm-dd the app was last opened
    streakCount: 0,
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

// Optional `progress` lets callers ask "what would the total be under this
// hypothetical progress object" (used by the progress-toggle handler below
// to detect a level-up without mutating state first) — defaults to the
// live state.progress for every existing call site.
function computeTotalPoints(progress) {
  const p = progress || state.progress;
  const roadmap = state.roadmap || {};
  let total = 0;
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s, i) => {
      const key = questKeyFor(ph.id, s, i);
      if (p[key]) total += s.points || 0;
    });
  });
  return total;
}

// Best-effort, browser-local "day streak" — increments once per calendar
// day the mobile app is opened, no Supabase sync (would need a schema
// migration; out of scope, see CLAUDE.md's scope-discipline rule).
function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.streakLastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakCount = state.streakLastDate === yesterday ? state.streakCount + 1 : 1;
  setState({ streakLastDate: today, streakCount });
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

// Rotates the "Kaveri" wordmark in the topbar through its transliteration
// in English, Finnish, and major Indian language scripts — fade out, swap
// the text (and lang attribute, for accessibility/font-script selection),
// fade back in. Long-ish interval since some scripts take a moment to
// actually read. The topbar is static markup that's never re-rendered or
// removed, so this starts once at page load and just keeps running —
// there's deliberately only one "Kaveri" wordmark on the page, not one in
// the topbar and a duplicate in the hero.
let brandWordIndex = 0;

function startBrandWordRotation() {
  setInterval(() => {
    const el = document.getElementById("brand-wordmark");
    if (!el) return;
    el.classList.add("fading");
    setTimeout(() => {
      const liveEl = document.getElementById("brand-wordmark");
      if (!liveEl) return;
      brandWordIndex = (brandWordIndex + 1) % FRIEND_WORDS.length;
      const entry = FRIEND_WORDS[brandWordIndex];
      liveEl.textContent = entry.word;
      liveEl.lang = entry.code;
      liveEl.classList.remove("fading");
    }, 220);
  }, 1100);
}

function isMobileAppActive() {
  const isNarrow = window.matchMedia("(max-width: 640px)").matches;
  return state.mobileAppOn === null ? isNarrow : state.mobileAppOn;
}

// Rotates the hero preview's "ONE THING TODAY" card through HERO_CARD_ROTATION
// — same fade-and-swap mechanism as the wordmark rotation above. Only exists
// on the landing page, so it's started/stopped alongside that view instead
// of running globally.
let heroCardTimer = null;
let heroCardIndex = 0;

function stopHeroCardRotation() {
  if (heroCardTimer) {
    clearInterval(heroCardTimer);
    heroCardTimer = null;
  }
}

function startHeroCardRotation() {
  stopHeroCardRotation();
  heroCardIndex = 0;
  heroCardTimer = setInterval(() => {
    const el = document.getElementById("hero-card");
    if (!el) {
      stopHeroCardRotation();
      return;
    }
    el.classList.add("fading");
    setTimeout(() => {
      const liveEl = document.getElementById("hero-card");
      if (!liveEl) return;
      heroCardIndex = (heroCardIndex + 1) % HERO_CARD_ROTATION.length;
      const entry = HERO_CARD_ROTATION[heroCardIndex];
      document.getElementById("hero-card-label").textContent = entry.label;
      document.getElementById("hero-card-title").textContent = entry.title;
      document.getElementById("hero-card-sub").textContent = entry.sub;
      const chipEl = document.getElementById("hero-card-chip");
      chipEl.style.display = entry.chip ? "" : "none";
      if (entry.chip) chipEl.textContent = entry.chip;
      document.getElementById("hero-card-cta").textContent = entry.cta;
      liveEl.classList.remove("fading");
    }, 350);
  }, 3800);
}

// Rotates the hero headline + subhead through HERO_HEADLINE_ROTATION — same
// fade-and-swap mechanism, its own timer/interval so it drifts out of sync
// with the phone card's rotation instead of flipping in lockstep.
let heroHeadlineTimer = null;
let heroHeadlineIndex = 0;

function stopHeroHeadlineRotation() {
  if (heroHeadlineTimer) {
    clearInterval(heroHeadlineTimer);
    heroHeadlineTimer = null;
  }
}

function startHeroHeadlineRotation() {
  stopHeroHeadlineRotation();
  heroHeadlineIndex = 0;
  heroHeadlineTimer = setInterval(() => {
    const el = document.getElementById("hero-headline");
    if (!el) {
      stopHeroHeadlineRotation();
      return;
    }
    el.classList.add("fading");
    document.getElementById("hero-headline-sub").classList.add("fading");
    setTimeout(() => {
      const liveEl = document.getElementById("hero-headline");
      if (!liveEl) return;
      heroHeadlineIndex = (heroHeadlineIndex + 1) % HERO_HEADLINE_ROTATION.length;
      const entry = HERO_HEADLINE_ROTATION[heroHeadlineIndex];
      liveEl.textContent = entry.title;
      liveEl.classList.remove("fading");
      const subEl = document.getElementById("hero-headline-sub");
      subEl.textContent = entry.sub;
      subEl.classList.remove("fading");
    }, 350);
  }, 5200);
}

function render() {
  stopHeroCardRotation();
  stopHeroHeadlineRotation();
  if (!isSupabaseConfigured()) {
    $app.innerHTML = renderSetupBanner();
    return;
  }
  if (state.view === "landing") {
    $app.innerHTML = renderLanding();
    startHeroCardRotation();
    startHeroHeadlineRotation();
  }
  else if (state.view === "auth") $app.innerHTML = renderAuth();
  else if (state.view === "wizard") $app.innerHTML = renderWizard();
  else if (state.view === "roadmap") {
    // The mobile app (design "1a", see js/mobileApp.js) is a full-viewport
    // fixed overlay drawn on top of the existing desktop roadmap — the
    // desktop DOM underneath is untouched either way, so this can't regress
    // renderRoadmap(). Active automatically on narrow viewports, or via the
    // manual "App view" toggle for testing on any screen size.
    const mobileActive = isMobileAppActive();
    $app.innerHTML = renderRoadmap() + (mobileActive ? renderMobileApp() : "");
    if (mobileActive) touchStreak();
  }
  if (state.view === "wizard") applyConditionalVisibility();
  window.scrollTo(0, 0);
}

window.addEventListener("resize", () => {
  if (state.view === "roadmap" && state.mobileAppOn === null) render();
});

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
    <section class="hero-mood hero-mood-split">
      <div class="hero-mood-content">
        <h1 id="hero-headline">Belonging starts before you land.</h1>
        <p class="hero-mood-sub" id="hero-headline-sub">Kaveri gets you ready for Finland's culture and everyday life — not just the paperwork — so none of it feels foreign on day one. Grounded in real official sources, personalized to your move.</p>
        <div class="hero-actions hero-mood-actions">
          <button class="btn btn-primary hero-mood-primary" data-action="go-auth" data-mode="signup">Sign up & start my quests</button>
          <button class="btn btn-ghost hero-mood-ghost" data-action="go-auth" data-mode="login">Log in</button>
        </div>
      </div>
      <div class="hero-phone-preview" aria-hidden="true">
        <div class="ma-phone hero-phone-inner">
          <div class="ma-screen">
            <div class="ma-screen-scroll">
              <div class="ma-topbar ma-top-pad">
                <div class="ma-who">
                  <div class="ma-avatar ma-avatar-purple">AN</div>
                  <div>
                    <div class="ma-greeting">Moi, Ananya</div>
                    <div class="ma-subtle">Day 3 in Espoo</div>
                  </div>
                </div>
                <span class="ma-icon-btn">🔔</span>
              </div>
              <div class="ma-pad">
                <div class="ma-route">
                  <span class="ma-route-from">India</span>
                  <div class="ma-route-track"><div class="ma-route-fill" style="width:12%"></div></div>
                  <span class="ma-route-to">Espoo</span>
                </div>
              </div>
              <div class="ma-pad">
                <div class="ma-hero" id="hero-card">
                  <div class="ma-hero-label" id="hero-card-label">ONE THING TODAY</div>
                  <div class="ma-hero-title" id="hero-card-title">Try karjalanpiirakka</div>
                  <p class="ma-hero-sub" id="hero-card-sub">A thin rye crust with rice porridge filling — sold in nearly every grocery store.</p>
                  <span class="ma-source-chip" id="hero-card-chip">📎 Visit Finland</span>
                  <div class="ma-hero-actions">
                    <span class="ma-hero-done" id="hero-card-cta">Mark done · +5</span>
                    <span class="ma-hero-chat">💬</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="ma-tabbar">
            <span class="ma-tab active"><span class="ma-tab-icon">🏠</span><span class="ma-tab-label">Today</span></span>
            <span class="ma-tab"><span class="ma-tab-icon">🗺️</span><span class="ma-tab-label">Quests</span></span>
            <span class="ma-tab"><span class="ma-tab-icon">💬</span><span class="ma-tab-label">Kaveri</span></span>
            <span class="ma-tab"><span class="ma-tab-icon">👥</span><span class="ma-tab-label">People</span></span>
            <span class="ma-tab"><span class="ma-tab-icon">🌱</span><span class="ma-tab-label">You</span></span>
          </div>
        </div>
      </div>
    </section>
    <section class="how">
      <h2>How it works</h2>
      <div class="how-grid">
        <div class="how-card" tabindex="0"><span class="how-num">1</span><h3>🧭 Tell us about your move</h3><p>Where you're from, where you're headed, who's with you, and what you're curious about — Finnish culture included.</p></div>
        <div class="how-card" tabindex="0"><span class="how-num">2</span><h3>🗂️ Pick your quest areas</h3><p>Administrative Work, Social, Cultural, Food — choose what applies, we handle the rest.</p></div>
        <div class="how-card" tabindex="0"><span class="how-num">3</span><h3>🏆 Complete quests, earn points</h3><p>Every quest is grounded in real Migri, DVV, Kela and InfoFinland guidance — and worth real points on the leaderboard.</p></div>
      </div>
    </section>
    <div class="hero-trust-band">
      <div class="hero-trust">
        <span class="trust-item">🎭 Culture, not just paperwork</span>
        <span class="trust-item">🛡️ Real official sources</span>
        <span class="trust-item">🎯 Personalized to your move</span>
        <span class="trust-item">🏆 Earn points as you go</span>
      </div>
    </div>
    <div class="buddy-teaser-band">
      <section class="buddy-teaser">
        <div class="buddy-teaser-copy">
          <h2>Ask it what you'd ask a friend who already lives here.</h2>
          <p class="muted">Your intake already feeds it — where you're from, who's with you, what you're curious about. Ask it something the plan hasn't covered yet, like "is small talk considered rude?" or "we're a family of four moving in November," and it answers with your actual situation in mind, grounded in real Finnish sources.</p>
          <button class="btn btn-secondary" data-action="go-auth" data-mode="signup">💬 Meet Kaveri, your AI Buddy</button>
          <p class="buddy-teaser-note muted">Optional — bring your own Claude API key once you're in. Kept only in your browser tab, never saved anywhere.</p>
        </div>
        <div class="buddy-teaser-art" aria-hidden="true">
          <svg viewBox="0 0 400 400" class="particle-field">${PARTICLE_FIELD_SVG}</svg>
          ${BUDDY_CHIPS.map((c, i) => `<span class="buddy-chip buddy-chip-${i + 1}"><span class="chip-dot" style="--dot:${c.color}"></span>${escapeHtml(c.text)}</span>`).join("")}
        </div>
      </section>
    </div>
    <section class="culture-preview-section">
      <h2>Know Finland before you land</h2>
      <p class="culture-preview-note muted">A friend who's already lived here would tell you these before you arrive — Kaveri does too, as soon as you sign up.</p>
      <div class="culture-preview-grid">
        ${CULTURE_PREVIEW.map((c) => `
          <div class="culture-preview-card" tabindex="0">
            <span class="culture-preview-icon">${c.icon}</span>
            <h3>${escapeHtml(c.title)}</h3>
            <p>${escapeHtml(c.why)}</p>
            <span class="culture-preview-tag">${escapeHtml(c.tag)}</span>
          </div>
        `).join("")}
      </div>
    </section>
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
            <span class="quest-badge" style="--badge-color:#5E2D85">⚖️ Admin</span>
          </div>
          <div class="plan-preview-item done">
            <span class="plan-check">✓</span>
            <span class="plan-title">Register with DVV</span>
            <span class="quest-badge" style="--badge-color:#5E2D85">⚖️ Admin</span>
          </div>
          <div class="plan-preview-item">
            <span class="plan-check"></span>
            <span class="plan-title">Learn the everyday social norms</span>
            <span class="quest-badge" style="--badge-color:#8A5B9E">🎭 Culture</span>
          </div>
          <div class="plan-preview-item">
            <span class="plan-check"></span>
            <span class="plan-title">Try a Finnish sauna</span>
            <span class="quest-badge" style="--badge-color:#8A5B9E">🎭 Culture</span>
          </div>
        </div>
      </div>
    </section>
    <section class="stories">
      <h2>What a first year with Kaveri could look like</h2>
      <p class="stories-note muted">Illustrative journeys, not real submitted testimonials — the kinds of stories Kaveri is built to help write.</p>
      <div class="stories-grid">
        ${STORY_CARDS.map((s) => `
          <article class="story-card" style="--story-color:${s.color}" tabindex="0">
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

const PARTICLE_FIELD_SVG = `<line x1="152.2" y1="92.3" x2="123.1" y2="86.1" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="182.9" y1="220.6" x2="150.6" y2="180.6" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="222.3" y1="127.7" x2="262.4" y2="120.3" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="238.5" y1="248.0" x2="251.5" y2="212.4" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="139.0" y1="21.8" x2="111.1" y2="54.8" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="262.4" y1="120.3" x2="265.8" y2="151.4" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="71.1" y1="241.2" x2="62.4" y2="219.3" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="48.0" y1="155.4" x2="91.1" y2="169.7" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="91.1" y1="169.7" x2="113.8" y2="154.3" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><line x1="324.7" y1="306.7" x2="338.8" y2="265.8" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"/><circle cx="152.2" cy="92.3" r="1.8" fill="#8A5B9E" fill-opacity="0.72"/><circle cx="182.9" cy="220.6" r="3.2" fill="#5E2D85" fill-opacity="0.61"/><circle cx="222.3" cy="127.7" r="3.2" fill="#8A5B9E" fill-opacity="0.66"/><circle cx="238.5" cy="248.0" r="2" fill="#DE5E99" fill-opacity="0.88"/><circle cx="159.2" cy="366.7" r="1.8" fill="#F1E532" fill-opacity="0.95"/><circle cx="127.4" cy="288.9" r="2.4" fill="#F1E532" fill-opacity="0.57"/><circle cx="139.0" cy="21.8" r="1.6" fill="#D81B81" fill-opacity="0.8"/><circle cx="262.4" cy="120.3" r="2" fill="#27A2DA" fill-opacity="0.89"/><circle cx="244.4" cy="197.5" r="2" fill="#5E2D85" fill-opacity="0.57"/><rect x="68.9" y="239.0" width="4.5" height="4.5" fill="#0D6FB0" fill-opacity="0.93" rx="0.6"/><circle cx="48.0" cy="155.4" r="1.8" fill="#F1E532" fill-opacity="0.6"/><circle cx="91.1" cy="169.7" r="2" fill="#0D6FB0" fill-opacity="0.82"/><rect x="323.4" y="305.4" width="2.6" height="2.6" fill="#F1E532" fill-opacity="0.8" rx="0.6"/><circle cx="72.9" cy="112.8" r="2.4" fill="#DE5E99" fill-opacity="0.83"/><circle cx="318.1" cy="219.2" r="1.6" fill="#E89A1C" fill-opacity="0.69"/><circle cx="22.2" cy="266.1" r="2.4" fill="#D81B81" fill-opacity="0.74"/><circle cx="287.3" cy="144.9" r="1.6" fill="#D81B81" fill-opacity="0.81"/><circle cx="62.4" cy="219.3" r="3.2" fill="#27A2DA" fill-opacity="0.74"/><circle cx="100.9" cy="139.0" r="1.6" fill="#27A2DA" fill-opacity="0.85"/><circle cx="338.8" cy="265.8" r="3.2" fill="#D81B81" fill-opacity="0.75"/><circle cx="179.8" cy="107.5" r="1.8" fill="#27A2DA" fill-opacity="0.75"/><rect x="21.6" y="201.4" width="3.2" height="3.2" fill="#E89A1C" fill-opacity="0.56" rx="0.6"/><circle cx="251.5" cy="212.4" r="2" fill="#5E2D85" fill-opacity="0.83"/><circle cx="311.6" cy="108.2" r="2" fill="#D81B81" fill-opacity="0.77"/><rect x="370.8" y="170.9" width="5.1" height="5.1" fill="#8A5B9E" fill-opacity="0.66" rx="0.6"/><circle cx="99.4" cy="43.6" r="2.4" fill="#27A2DA" fill-opacity="0.89"/><circle cx="64.7" cy="83.1" r="2" fill="#8A5B9E" fill-opacity="0.9"/><circle cx="265.8" cy="151.4" r="2" fill="#F1E532" fill-opacity="0.76"/><circle cx="217.3" cy="10.8" r="2.8" fill="#27A2DA" fill-opacity="0.63"/><circle cx="111.1" cy="54.8" r="2.4" fill="#D81B81" fill-opacity="0.76"/><circle cx="113.8" cy="154.3" r="1.6" fill="#F1E532" fill-opacity="0.6"/><circle cx="73.2" cy="321.0" r="3.2" fill="#5E2D85" fill-opacity="0.61"/><circle cx="343.4" cy="115.8" r="1.6" fill="#D81B81" fill-opacity="0.74"/><circle cx="150.6" cy="180.6" r="1.6" fill="#8A5B9E" fill-opacity="0.59"/><circle cx="247.6" cy="48.1" r="2.8" fill="#F1E532" fill-opacity="0.75"/><circle cx="123.1" cy="86.1" r="1.8" fill="#5E2D85" fill-opacity="0.78"/><rect x="222.1" y="157.6" width="3.2" height="3.2" fill="#E89A1C" fill-opacity="0.57" rx="0.6"/><circle cx="193.5" cy="34.4" r="2" fill="#D81B81" fill-opacity="0.84"/><circle cx="257.2" cy="34.0" r="2.8" fill="#DE5E99" fill-opacity="0.59"/><circle cx="50.9" cy="188.9" r="2" fill="#D81B81" fill-opacity="0.88"/><circle cx="359.1" cy="265.0" r="2.4" fill="#E89A1C" fill-opacity="0.9"/><circle cx="209.7" cy="150.7" r="1.6" fill="#F1E532" fill-opacity="0.78"/><rect x="124.0" y="107.7" width="5.1" height="5.1" fill="#27A2DA" fill-opacity="0.57" rx="0.6"/><circle cx="235.7" cy="144.3" r="2" fill="#0D6FB0" fill-opacity="0.78"/><circle cx="376.3" cy="219.7" r="1.6" fill="#E89A1C" fill-opacity="0.72"/><circle cx="314.1" cy="171.1" r="3.2" fill="#E89A1C" fill-opacity="0.98"/><circle cx="205.7" cy="98.3" r="2.8" fill="#E89A1C" fill-opacity="0.61"/><rect x="165.6" y="301.3" width="3.2" height="3.2" fill="#E89A1C" fill-opacity="0.94" rx="0.6"/><circle cx="61.8" cy="286.4" r="1.8" fill="#D81B81" fill-opacity="1.0"/><rect x="231.9" y="23.4" width="2.6" height="2.6" fill="#8A5B9E" fill-opacity="0.88" rx="0.6"/><rect x="281.9" y="356.4" width="3.8" height="3.8" fill="#F1E532" fill-opacity="0.92" rx="0.6"/><circle cx="97.6" cy="229.8" r="2" fill="#F1E532" fill-opacity="0.64"/><circle cx="267.3" cy="305.8" r="3.2" fill="#DE5E99" fill-opacity="0.99"/><circle cx="299.3" cy="201.2" r="2.8" fill="#27A2DA" fill-opacity="0.77"/><circle cx="173.6" cy="254.3" r="2.8" fill="#E89A1C" fill-opacity="0.98"/><circle cx="276.8" cy="206.5" r="2.4" fill="#DE5E99" fill-opacity="0.96"/><circle cx="360.6" cy="115.9" r="2" fill="#E89A1C" fill-opacity="0.62"/><circle cx="217.8" cy="64.3" r="1.6" fill="#27A2DA" fill-opacity="0.9"/><circle cx="126.5" cy="335.8" r="2.4" fill="#8A5B9E" fill-opacity="0.97"/><rect x="271.4" y="39.8" width="2.9" height="2.9" fill="#DE5E99" fill-opacity="0.58" rx="0.6"/><circle cx="260.7" cy="81.4" r="2" fill="#E89A1C" fill-opacity="0.71"/><circle cx="186.2" cy="369.4" r="1.8" fill="#5E2D85" fill-opacity="0.89"/><circle cx="336.2" cy="191.8" r="3.2" fill="#27A2DA" fill-opacity="0.62"/><circle cx="353.1" cy="92.4" r="2" fill="#0D6FB0" fill-opacity="0.95"/><circle cx="203.5" cy="354.7" r="1.8" fill="#F1E532" fill-opacity="0.67"/><circle cx="129.5" cy="60.3" r="1.6" fill="#27A2DA" fill-opacity="0.92"/><circle cx="382.0" cy="145.9" r="1.8" fill="#F1E532" fill-opacity="0.61"/><circle cx="306.8" cy="246.8" r="1.6" fill="#5E2D85" fill-opacity="0.78"/><circle cx="240.2" cy="331.2" r="1.6" fill="#DE5E99" fill-opacity="0.96"/><circle cx="322.4" cy="327.3" r="1.8" fill="#8A5B9E" fill-opacity="0.64"/><circle cx="238.6" cy="305.7" r="2" fill="#5E2D85" fill-opacity="0.67"/><circle cx="36.3" cy="169.8" r="1.6" fill="#8A5B9E" fill-opacity="0.78"/><rect x="370.7" y="129.8" width="3.8" height="3.8" fill="#F1E532" fill-opacity="0.69" rx="0.6"/><circle cx="131.1" cy="127.8" r="3.2" fill="#27A2DA" fill-opacity="0.57"/><rect x="109.0" y="259.8" width="5.1" height="5.1" fill="#0D6FB0" fill-opacity="0.63" rx="0.6"/><circle cx="380.8" cy="198.3" r="1.8" fill="#F1E532" fill-opacity="0.62"/><circle cx="156.7" cy="64.0" r="2.8" fill="#0D6FB0" fill-opacity="0.97"/><circle cx="284.8" cy="225.7" r="2" fill="#E89A1C" fill-opacity="0.86"/><circle cx="194.3" cy="389.0" r="1.8" fill="#F1E532" fill-opacity="0.95"/><rect x="242.0" y="87.7" width="2.6" height="2.6" fill="#F1E532" fill-opacity="0.63" rx="0.6"/><circle cx="64.6" cy="172.6" r="2" fill="#E89A1C" fill-opacity="0.9"/><circle cx="260.6" cy="277.2" r="1.8" fill="#0D6FB0" fill-opacity="0.6"/><circle cx="42.4" cy="224.1" r="2" fill="#0D6FB0" fill-opacity="0.79"/><circle cx="93.9" cy="302.6" r="2.8" fill="#F1E532" fill-opacity="0.84"/><circle cx="379.6" cy="245.5" r="1.8" fill="#E89A1C" fill-opacity="0.71"/><rect x="91.3" y="322.1" width="2.6" height="2.6" fill="#27A2DA" fill-opacity="0.94" rx="0.6"/><circle cx="108.0" cy="278.8" r="2.8" fill="#D81B81" fill-opacity="0.8"/><rect x="49.0" y="98.5" width="4.5" height="4.5" fill="#27A2DA" fill-opacity="0.81" rx="0.6"/><circle cx="199.4" cy="283.9" r="1.8" fill="#5E2D85" fill-opacity="0.95"/><circle cx="64.9" cy="136.0" r="1.6" fill="#5E2D85" fill-opacity="0.6"/>`;

// Rotates the hero preview's "ONE THING TODAY" card through five warm,
// human tones instead of always looking like an admin checklist — a real
// quest, a fun fact (from FUN_FACTS, already grounded), a caring check-in,
// and an honest seasonal note (general daylight-hours knowledge, not a
// live weather claim we can't back). Illustrative only — decorative,
// aria-hidden preview, not tied to any real user's actual data.
const HERO_CARD_ROTATION = [
  { label: "ONE THING TODAY", title: "Try karjalanpiirakka", sub: "A thin rye crust with rice porridge filling — sold in nearly every grocery store.", chip: "📎 Visit Finland", cta: "Mark done · +5" },
  { label: "DID YOU KNOW?", title: "Everyman's Right", sub: "Anyone can roam, camp, and pick berries in almost any Finnish forest, regardless of who owns the land.", chip: null, cta: "Ask Kaveri more" },
  { label: "FUN FACT", title: "3 million saunas", sub: "Finland has roughly one sauna for every two people — the whole country could fit inside them at once.", chip: null, cta: "😄 Love that" },
  { label: "CHECKING IN", title: "How's it going so far?", sub: "No task today — just wanted to see how you're settling in. I'm here if anything's on your mind.", chip: null, cta: "💬 Talk to Kaveri" },
  { label: "SEASON CHECK", title: "Finnish winters run dark, not cold", sub: "Espoo gets around 6 hours of daylight in December — most people just lean into it with candles and sauna.", chip: null, cta: "Good to know" },
];

// Rotates the hero headline through concrete examples of what the board
// actually covers — grounded in the real quest categories/phases, not
// vague marketing language. Keeps the opening line as the anchor, then
// cycles through what it means in practice.
const HERO_HEADLINE_ROTATION = [
  { title: "Belonging starts before you land.", sub: "Kaveri gets you ready for Finland's culture and everyday life — not just the paperwork — so none of it feels foreign on day one. Grounded in real official sources, personalized to your move." },
  { title: "Know what to do before you even book your flight.", sub: "From your residence permit checklist to what to actually pack for the cold — Kaveri sequences it so nothing catches you off guard in week one." },
  { title: "Not just permits — the parts nobody warns you about.", sub: "Small talk norms, sauna etiquette, what a Finnish silence actually means — the cultural fluency that makes a new country feel less foreign, right alongside the admin." },
  { title: "One plan for the whole family, not just you.", sub: "Your spouse's visa, your kids' neuvola registration, your first Kela appointment — Kaveri builds one board that covers everyone who's moving, not only the applicant." },
  { title: "From \"moved here\" to \"living here.\"", sub: "The quests keep going after the paperwork's done — building an actual routine, a real network, a life in Finland, not just a checklist you finish and forget." },
];

const BUDDY_CHIPS = [
  { color: "#27A2DA", text: "Curious about sauna etiquette" },
  { color: "#D81B81", text: "Wants to understand Midsummer (Juhannus)" },
  { color: "#E89A1C", text: "Loves cricket & hiking" },
  { color: "#0D6FB0", text: "Curious about Finnish work-life balance" },
];

// Mirrors real CULTURAL_QUESTS entries from data.js — two that are pure
// reading (so Kaveri can surface them before you've even left India) and
// two that need you to actually be in Finland, so the difference between
// "proactive prep" and "once you're here" is honest, not just a label.
const CULTURE_PREVIEW = [
  {
    icon: "🤝",
    tag: "Before you land",
    title: "Learn the everyday social norms",
    why: "Handshakes, eye contact, comfortable silence — the small habits that cover most of what surprises newcomers, worth knowing before you land.",
  },
  {
    icon: "🎉",
    tag: "Before you land",
    title: "Know what Vappu and Juhannus are",
    why: "Finland's biggest holidays come with real traditions — knowing what's coming means you're not caught off guard by a quiet, closed city.",
  },
  {
    icon: "🧖",
    tag: "Once you're here",
    title: "Try a Finnish sauna",
    why: "With roughly one sauna per two people nationwide, this is the default way Finns unwind — often where real conversations happen.",
  },
  {
    icon: "🥧",
    tag: "Once you're here",
    title: "Try karjalanpiirakka",
    why: "A thin rye crust with rice porridge filling, sold in nearly every grocery store — one of the most iconic everyday Finnish foods.",
  },
];

const STORY_CARDS = [
  {
    color: "#5E2D85",
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
    color: "#0D6FB0",
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
    color: "#8A5B9E",
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
  {
    color: "#D81B81",
    title: "Nikhil stopped feeling like a tourist in his own new home.",
    paragraphs: [
      "Nikhil moved to Helsinki as a data analyst, and had his admin sorted within the first month — permit, DVV, bank account, all checked off. What was harder to plan for was everything after: how do you actually start living somewhere instead of just surviving it?",
      "Kaveri's cultural quests gave him a starting point: learn the everyday social norms before assuming anything, mark Juhannus on the calendar so a suddenly quiet, closed city in June didn't feel like something had gone wrong, and try a sauna instead of politely declining every invite.",
      "Six months in, karjalanpiirakka is his go-to breakfast, he's tried cross-country skiing once (badly), and a Finnish colleague finally explained why silence in a meeting isn't a bad sign.",
    ],
    initials: ["NK"],
    names: "Nikhil",
    meta: "Mumbai → Helsinki, data analyst, 6 months in",
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
        <button class="btn btn-ghost" data-action="toggle-mobile-app">${isMobileAppActive() ? "🖥️ Desktop view" : "📱 App view"}</button>
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
    <details class="phase-section" style="--phase-color:${phase.color}; --phase-text:${phase.textColor}" ${openByDefault ? "open" : ""}>
      <summary>
        <span class="phase-summary-label">${phase.icon} ${escapeHtml(phase.label)}</span>
        <span class="phase-summary-right">
          <span class="phase-progress-pill ${doneCount === steps.length ? "complete" : ""}">${doneCount === steps.length ? "✓ " : ""}${doneCount}/${steps.length}</span>
          <span class="phase-chevron" aria-hidden="true">▾</span>
        </span>
      </summary>
      <div class="phase-body">
        ${phase.blurb ? `<p class="phase-blurb">${escapeHtml(phase.blurb)}</p>` : ""}
        <div class="step-list">
          ${steps.map((s, i) => renderStepCard(s, phase.id, i, false)).join("")}
        </div>
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
    setState({ roadmap, progress: {}, view: "roadmap", roadmapStartedAt: state.roadmapStartedAt || Date.now() });
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
  } else if (action === "toggle-mobile-app") {
    setState({ mobileAppOn: !isMobileAppActive() });
  } else if (action === "mobile-tab") {
    const patch = { mobileTab: el.dataset.tab, mobileSel: null };
    if (el.dataset.sub) patch.mobilePeopleTab = el.dataset.sub;
    setState(patch);
  } else if (action === "mobile-open-quest") {
    setState({ mobileSel: { phaseId: el.dataset.phase, idx: Number(el.dataset.idx) } });
  } else if (action === "mobile-close-detail") {
    setState({ mobileSel: null });
  } else if (action === "mobile-people-tab") {
    setState({ mobilePeopleTab: el.dataset.sub });
  } else if (action === "mobile-quest-filter") {
    setState({ mobileQuestFilter: el.dataset.filter, mobileOpenPhase: null });
  } else if (action === "mobile-toggle-phase") {
    const roadmap = state.roadmap || {};
    const filter = state.mobileQuestFilter || "all";
    const groups = mobileQuestGroups(roadmap, filter);
    const defaultOpen = mobileDefaultOpenPhase(groups, state.progress);
    const current = state.mobileOpenPhase == null ? defaultOpen : state.mobileOpenPhase;
    setState({ mobileOpenPhase: current === el.dataset.phase ? "__none__" : el.dataset.phase });
  } else if (action === "close-levelup") {
    setState({ levelUpLabel: null });
  } else if (action === "mobile-quick-ask") {
    const input = document.querySelector('#mobile-ai-ask input[name="question"]');
    if (input) {
      input.value = el.dataset.q;
      input.focus();
    }
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
const CONFETTI_COLORS = ["#0D6FB0", "#27A2DA", "#5E2D85", "#D81B81", "#E89A1C", "#F1E532", "#ffffff"];

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

  // Level-up celebration (mirrors the "1a" prototype's toggle() logic) —
  // only the mobile view renders levelUp, so this is inert for the desktop
  // roadmap.
  const patch = { progress, syncError: null };
  if (nowChecked) {
    const beforeTotal = computeTotalPoints();
    const afterTotal = computeTotalPoints(progress);
    const levelBefore = levelFor(beforeTotal);
    const levelAfter = levelFor(afterTotal);
    if (afterTotal > beforeTotal && levelAfter.label !== levelBefore.label) {
      patch.levelUpLabel = levelAfter.label;
      patch.levelUpEarned = afterTotal - beforeTotal;
    }
  }
  setState(patch);

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
startBrandWordRotation();
