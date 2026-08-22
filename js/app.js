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
const $app = document.getElementById("app");

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
    categorySelection: ["publicServices", "digitalSkills", "familyLife"],
    categoryAnswers: {},
    wizardOrder: [],
    wizardIndex: 0,
    roadmap: null, // stepsByPhase, generated once
    progress: {}, // questKey -> true, mirrors Supabase quest_completions
    syncError: null,
    leaderboard: [],
    leaderboardLoading: false,
    leaderboardError: null,
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
  if (state.authUserId && state.authUserId !== user.id) {
    // A different account just signed in on this browser — don't leak the
    // previous account's roadmap/progress into their view.
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
    ? { ...state.profile, name: state.profile.name || profile.name, origin: state.profile.origin || profile.origin || "", destination: state.profile.destination || profile.destination || "" }
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
    <section class="hero">
      <div class="hero-flags">
        <span class="hero-flag" aria-label="India">🇮🇳</span>
        <span class="hero-wordmark">Kaveri</span>
        <span class="hero-flag" aria-label="Finland">🇫🇮</span>
      </div>
      <h1>Moving from India to Finland?<br>Turn it into a game you can <em>win</em>.</h1>
      <p class="hero-sub">
        Kaveri turns real official Finnish relocation guidance into quests —
        Legal, Social, Cultural, and Food — worth points. Complete them, climb
        the leaderboard, and get to "Kaveri" level: the point where you're not
        a newcomer anymore, you're a friend.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-action="go-auth" data-mode="signup">Start my quests</button>
        <button class="btn btn-ghost" data-action="go-auth" data-mode="login">Log in</button>
      </div>
      <div class="hero-note">
        🔒 Your account is real (Supabase auth). Only your name and points are ever public, on the leaderboard.
      </div>
    </section>
    <section class="how">
      <h2>How it works</h2>
      <div class="how-grid">
        <div class="how-card"><span class="how-num">1</span><h3>Tell us about your move</h3><p>Where you're from, where you're headed, who's with you, and what matters to you.</p></div>
        <div class="how-card"><span class="how-num">2</span><h3>Pick your quest areas</h3><p>Legal, Social, Cultural, Food — choose what applies, we handle the rest.</p></div>
        <div class="how-card"><span class="how-num">3</span><h3>Complete quests, earn points</h3><p>Every quest is grounded in real Migri, DVV, Kela and InfoFinland guidance — and worth real points on the leaderboard.</p></div>
      </div>
    </section>
  `;
}

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
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s, i) => {
      total++;
      if (state.progress[questKeyFor(ph.id, s, i)]) done++;
    });
  });
  const overallPct = total ? Math.round((done / total) * 100) : 0;
  const totalPoints = computeTotalPoints();
  const level = levelFor(totalPoints);
  const nextLevel = LEVELS.find((l) => l.min > totalPoints);

  const priorityPool = [];
  ["before", "week2"].forEach((phId) => {
    (roadmap[phId] || []).forEach((s, i) => {
      if (!state.progress[questKeyFor(phId, s, i)]) priorityPool.push({ ...s, phaseId: phId, idx: i });
    });
  });
  const priorities = priorityPool.slice(0, 3);

  return `
    <section class="roadmap-header">
      <div>
        <h2>${escapeHtml(state.profile.name || "Your")} quest board: ${escapeHtml(state.profile.origin || "India")} → ${escapeHtml(state.profile.destination || "Finland")}</h2>
        <div class="progress-bar wide"><div class="progress-fill" style="width:${overallPct}%"></div></div>
        <span class="muted">${done} of ${total} quests done</span>
      </div>
      <div class="score-panel">
        <div class="score-points">${totalPoints} pts</div>
        <div class="score-level">${level.icon} ${level.label}${nextLevel ? ` <span class="muted">· ${nextLevel.min - totalPoints} pts to ${nextLevel.icon} ${nextLevel.label}</span>` : ""}</div>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" data-action="edit-profile">Edit my details</button>
        <button class="btn btn-ghost" data-action="log-out">Log out</button>
      </div>
    </section>

    ${
      priorities.length
        ? `<section class="priorities">
        <h3>🎯 Top priorities right now</h3>
        <div class="priority-list">
          ${priorities.map((s) => renderStepCard(s, s.phaseId, s.idx, true)).join("")}
        </div>
      </section>`
        : ""
    }

    <section class="phases">
      ${PHASES.map((ph) => renderPhaseSection(ph, roadmap[ph.id] || [])).join("")}
    </section>

    ${renderLeaderboard()}
  `;
  // AI Buddy is temporarily pulled from the UI (renderAiBuddy() below is
  // still intact) — re-add "${renderAiBuddy()}" here and the settings
  // button in the header-actions block above to bring it back.
}

function renderPhaseSection(phase, steps) {
  if (!steps.length) return "";
  const doneCount = steps.filter((s, i) => state.progress[questKeyFor(phase.id, s, i)]).length;
  return `
    <details class="phase-section" open>
      <summary>
        <span>${phase.icon} ${escapeHtml(phase.label)}</span>
        <span class="phase-progress-pill ${doneCount === steps.length ? "complete" : ""}">${doneCount === steps.length ? "✓ " : ""}${doneCount}/${steps.length}</span>
      </summary>
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
      <div class="step-card done" style="--badge-color:${qc.color}">
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
    <div class="step-card" style="--badge-color:${qc.color}">
      <label class="step-check">${checkboxInput}</label>
      <div class="step-body">
        <div class="step-cat">
          <span class="quest-badge" style="--badge-color:${qc.color}">${qc.icon} ${qc.label}</span>
          <span class="step-points">🪙 +${s.points} pts</span>
        </div>
        <h4>${escapeHtml(s.title)}</h4>
        <p class="step-why">${escapeHtml(s.why)}</p>
        <p class="step-action">🎯 <strong>Do this:</strong> ${escapeHtml(s.action)}</p>
        <a class="step-source" href="${s.source.url}" target="_blank" rel="noopener">📎 ${escapeHtml(s.source.name)}</a>
      </div>
    </div>
  `;
}

function renderLeaderboard() {
  const rows = state.leaderboard || [];
  return `
    <section class="leaderboard">
      <h3>🏆 Leaderboard</h3>
      ${state.leaderboardError ? `<p class="auth-error">Couldn't load the leaderboard: ${escapeHtml(state.leaderboardError)}</p>` : ""}
      ${
        state.leaderboardLoading
          ? `<p class="muted">Loading…</p>`
          : rows.length
          ? `<ol class="leaderboard-list">
              ${rows
                .map((r, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                  const isMe = r.id === state.authUserId;
                  return `<li class="${isMe ? "me" : ""}"><span class="lb-rank">${medal}</span><span class="lb-name">${escapeHtml(r.name)}${isMe ? " (you)" : ""}</span><span class="lb-points">${r.total_points} pts</span></li>`;
                })
                .join("")}
            </ol>`
          : `<p class="muted">No one's completed a quest yet — be the first.</p>`
      }
      <button class="link-btn" data-action="refresh-leaderboard">Refresh</button>
    </section>
  `;
}

function renderAiBuddy() {
  const key = hasApiKey();
  return `
    <section class="ai-buddy">
      <h3>💬 Ask AI Buddy</h3>
      ${
        key
          ? `
        <div class="ai-log">
          ${state.aiChatLog.map((m) => `<div class="ai-msg ai-${m.role}">${escapeHtml(m.text)}</div>`).join("") || `<p class="muted">Ask anything not covered above — e.g. "we're a family of four moving in November, what changes for us?"</p>`}
        </div>
        <form data-form="ai-ask">
          <input type="text" name="question" placeholder="Ask a follow-up question..." required>
          <button class="btn btn-primary" type="submit">Ask</button>
        </form>
        <button class="link-btn" data-action="clear-api-key">Remove API key</button>
      `
          : `<p class="muted">The quest board above needs Supabase, but never Claude — add your own Claude API key to unlock live, conversational follow-up questions for anything the quests don't cover.</p>
        <button class="btn btn-secondary" data-action="open-settings">Connect AI Buddy</button>`
      }
    </section>
    <div class="settings-modal" id="settings-modal" hidden>
      <div class="settings-box">
        <h3>Connect AI Buddy</h3>
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

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "go-home") {
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
  } else if (action === "wizard-next-basic") {
    const step = document.getElementById("wizard-step");
    const profile = { ...state.profile };
    step.querySelectorAll("[data-field]").forEach((input) => (profile[input.dataset.field] = input.value));
    setState({ profile, view: "wizard", wizardOrder: ["basic", "categories"], wizardIndex: 1, syncError: null });
    if (state.authUserId) {
      upsertMyProfile({ id: state.authUserId, name: profile.name, origin: profile.origin, destination: profile.destination }).catch((err) => setState({ syncError: `Couldn't save your profile: ${err.message}` }));
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
  }
});

// ---------- Fun Fact + Resources popups (static overlays, live outside #app
// so they stay available across every view without being wiped by render()) ----------

function showRandomFunFact() {
  const fact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  document.getElementById("fun-fact-text").textContent = fact;
}

function renderResourcesList() {
  document.getElementById("resources-list").innerHTML = RESOURCES.map(
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
  }
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-progress-toggle]");
  if (!el) return;
  const key = el.dataset.progressToggle;
  const wasChecked = !!state.progress[key];
  const nowChecked = !wasChecked;
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
