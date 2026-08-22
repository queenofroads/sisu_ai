/*
 * IndiaToFinland — app state, views, and wiring.
 * Vanilla JS, no framework, no build step, no CDN — works fully offline.
 * All personal data stays in this browser's localStorage; nothing is sent
 * anywhere unless you explicitly use the optional AI Buddy chat.
 */

const STORAGE_KEY = "itf_state_v1";
const $app = document.getElementById("app");

function defaultState() {
  return {
    view: "landing", // landing | auth | wizard | roadmap
    authMode: "signup", // signup | login
    user: null, // { email, name } — prototype only, NOT real authentication
    profile: {},
    categorySelection: ["immigration", "registration", "community"],
    categoryAnswers: {},
    wizardOrder: [],
    wizardIndex: 0,
    roadmap: null, // stepsByPhase, generated once
    progress: {}, // "phaseId|index": true
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

// ---------- Views ----------

function render() {
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

function renderLanding() {
  return `
    <section class="hero">
      <div class="hero-badge">🇮🇳 → 🇫🇮 &nbsp;AI Talent &amp; Relocation Companion</div>
      <h1>Moving from India to Finland?<br>Get a roadmap made for <em>you</em>.</h1>
      <p class="hero-sub">
        Not a generic checklist. Tell us where you're coming from, who's coming with you,
        and what you care about — we'll turn Finland's real official guidance into a
        personalised, step-by-step plan you can actually follow.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-action="go-auth" data-mode="signup">Get my roadmap</button>
        <button class="btn btn-ghost" data-action="go-auth" data-mode="login">Log in</button>
      </div>
      <div class="hero-note">
        🔒 Your details stay in this browser. Nothing is uploaded — this is a hackathon prototype, not a production account system.
      </div>
    </section>
    <section class="how">
      <h2>How it works</h2>
      <div class="how-grid">
        <div class="how-card"><span class="how-num">1</span><h3>Tell us about your move</h3><p>Where you're from, where you're headed, who's with you, and what matters to you.</p></div>
        <div class="how-card"><span class="how-num">2</span><h3>Pick what you need help with</h3><p>Visa, housing, schools, career, language, healthcare, community — choose what applies.</p></div>
        <div class="how-card"><span class="how-num">3</span><h3>Get your personalised roadmap</h3><p>Grounded in real Migri, DVV, Kela and InfoFinland guidance — organised by when you'll need it.</p></div>
      </div>
    </section>
  `;
}

function renderAuth() {
  const isSignup = state.authMode === "signup";
  return `
    <section class="auth-card">
      <h2>${isSignup ? "Create your account" : "Log in"}</h2>
      <p class="muted">Prototype login — stored only in this browser, not a real authentication system.</p>
      <form data-form="auth">
        <label>Name<input type="text" name="name" required placeholder="Your first name" ${!isSignup ? "" : ""}></label>
        <label>Email<input type="email" name="email" required placeholder="you@example.com"></label>
        <button class="btn btn-primary" type="submit">${isSignup ? "Sign up & start" : "Log in"}</button>
      </form>
      <button class="link-btn" data-action="toggle-auth-mode">${isSignup ? "Already have an account? Log in" : "New here? Sign up"}</button>
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
    <div class="field-grid">
      <label>Your name<input type="text" data-field="name" value="${escapeHtml(p.name || (state.user && state.user.name) || "")}" placeholder="e.g. Ananya"></label>
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
    <h2>What do you want help with?</h2>
    <p class="muted">Pick as many as apply — each adds a short set of questions so your roadmap reflects your real situation.</p>
    <div class="category-grid">
      ${CATEGORIES.map(
        (c) => `
        <label class="category-card ${sel.has(c.id) ? "selected" : ""}">
          <input type="checkbox" data-category-toggle="${c.id}" ${sel.has(c.id) ? "checked" : ""}>
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-label">${escapeHtml(c.label)}</span>
          <span class="cat-blurb">${escapeHtml(c.blurb)}</span>
        </label>`
      ).join("")}
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
    <h2>Ready to build your roadmap</h2>
    <div class="review-summary">
      <p><strong>${escapeHtml(p.name || "You")}</strong>, moving from <strong>${escapeHtml(p.origin || "India")}</strong> to <strong>${escapeHtml(p.destination || "Finland")}</strong>.</p>
      <p>${escapeHtml(p.adults || 1)} adult(s)${p.childrenCount > 0 ? ` and ${escapeHtml(p.childrenCount)} child(ren)${p.childrenAges ? ` (${escapeHtml(p.childrenAges)})` : ""}` : ""} travelling.</p>
      <p>Areas selected: ${state.categorySelection.map((id) => CATEGORIES.find((c) => c.id === id)?.label).join(", ")}</p>
    </div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" data-action="wizard-back">Back</button>
      <button class="btn btn-primary" data-action="generate-roadmap">Generate my roadmap →</button>
    </div>
  `;
}

function renderRoadmap() {
  const roadmap = state.roadmap || {};
  let total = 0;
  let done = 0;
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((_, i) => {
      total++;
      if (state.progress[`${ph.id}|${i}`]) done++;
    });
  });
  const overallPct = total ? Math.round((done / total) * 100) : 0;

  const priorityPool = [];
  ["before", "week2"].forEach((phId) => {
    (roadmap[phId] || []).forEach((s, i) => {
      if (!state.progress[`${phId}|${i}`]) priorityPool.push({ ...s, phaseId: phId, idx: i });
    });
  });
  const priorities = priorityPool.slice(0, 3);

  return `
    <section class="roadmap-header">
      <div>
        <h2>${escapeHtml(state.profile.name || "Your")} roadmap: ${escapeHtml(state.profile.origin || "India")} → ${escapeHtml(state.profile.destination || "Finland")}</h2>
        <div class="progress-bar wide"><div class="progress-fill" style="width:${overallPct}%"></div></div>
        <span class="muted">${done} of ${total} steps done</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" data-action="edit-profile">Edit my details</button>
        <button class="btn btn-ghost" data-action="open-settings">⚙️ AI Buddy settings</button>
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

    ${renderAiBuddy()}
  `;
}

function renderPhaseSection(phase, steps) {
  if (!steps.length) return "";
  const doneCount = steps.filter((_, i) => state.progress[`${phase.id}|${i}`]).length;
  return `
    <details class="phase-section" open>
      <summary>
        <span>${phase.icon} ${escapeHtml(phase.label)}</span>
        <span class="muted">${doneCount}/${steps.length}</span>
      </summary>
      <div class="step-list">
        ${steps.map((s, i) => renderStepCard(s, phase.id, i, false)).join("")}
      </div>
    </details>
  `;
}

function renderStepCard(s, phaseId, idx, compact) {
  const key = `${phaseId}|${idx}`;
  const checked = !!state.progress[key];
  return `
    <div class="step-card ${checked ? "done" : ""}">
      <label class="step-check">
        <input type="checkbox" data-progress-toggle="${key}" ${checked ? "checked" : ""}>
      </label>
      <div class="step-body">
        <div class="step-cat">${s.categoryIcon} ${escapeHtml(s.categoryLabel)}</div>
        <h4>${escapeHtml(s.title)}</h4>
        <p class="step-why">${escapeHtml(s.why)}</p>
        <p class="step-action"><strong>Do this:</strong> ${escapeHtml(s.action)}</p>
        <a class="step-source" href="${s.source.url}" target="_blank" rel="noopener">📎 ${escapeHtml(s.source.name)}</a>
      </div>
    </div>
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
          : `<p class="muted">The roadmap above works fully offline, no key needed. Add your own Claude API key to unlock live, conversational follow-up questions for anything the roadmap doesn't cover.</p>
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

  if (action === "go-auth") {
    setState({ view: "auth", authMode: el.dataset.mode });
  } else if (action === "toggle-auth-mode") {
    setState({ authMode: state.authMode === "signup" ? "login" : "signup" });
  } else if (action === "wizard-next-basic") {
    const step = document.getElementById("wizard-step");
    const profile = { ...state.profile };
    step.querySelectorAll("[data-field]").forEach((input) => (profile[input.dataset.field] = input.value));
    setState({ profile, view: "wizard", wizardOrder: ["basic", "categories"], wizardIndex: 1 });
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
  } else if (action === "edit-profile") {
    setState({ view: "wizard", wizardOrder: ["basic", "categories"], wizardIndex: 0 });
  } else if (action === "open-settings") {
    document.getElementById("settings-modal").hidden = false;
  } else if (action === "close-settings") {
    document.getElementById("settings-modal").hidden = true;
  } else if (action === "clear-api-key") {
    setApiKey("");
    render();
  }
});

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
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const profile = { ...state.profile, name: state.profile.name || name };
    setState({
      user: { name, email },
      profile,
      view: "wizard",
      wizardOrder: ["basic", "categories"],
      wizardIndex: 0,
    });
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
  const progress = { ...state.progress, [key]: !state.progress[key] };
  setState({ progress });
});

function summarizeRoadmapForAi() {
  const roadmap = state.roadmap || {};
  const lines = [];
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((s) => lines.push(`[${ph.label}] ${s.title} (${s.categoryLabel})`));
  });
  return lines.join("\n");
}

render();
