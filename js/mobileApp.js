/*
 * Kaveri — mobile app view ("1a" design from the Claude Design handoff).
 *
 * This is a second, mobile-first render path on top of the SAME state the
 * desktop roadmap view already maintains (js/app.js) — same roadmap, same
 * progress, same leaderboard/community/AI Buddy calls. No parallel data
 * model, no new Supabase tables. See renderMobileApp() in js/app.js's
 * render() for how this gets mounted (a fixed full-viewport overlay drawn
 * on top of the desktop DOM, active on narrow viewports or via the manual
 * "App view" toggle).
 *
 * Vanilla JS, no framework, no build step — matches the rest of the repo.
 * New click actions this file relies on (handled in js/app.js's existing
 * delegated listener): mobile-tab, mobile-open-quest, mobile-close-detail,
 * mobile-people-tab, close-levelup, mobile-quick-ask, toggle-mobile-app.
 * Quest checkboxes and the community/AI-ask forms reuse the exact same
 * data-progress-toggle / data-form handlers the desktop view already uses.
 */

// Copy adapted from the "1a" prototype's UNLOCKS, but grounded in real
// features this app actually has (food quests, the real community board,
// the real VOLUNTEER_QUESTS) rather than invented ones.
const MOBILE_LEVEL_UNLOCKS = {
  Settler: [
    { icon: "🍴", text: "Food quests — karjalanpiirakka, market halls, ruisleipä" },
    { icon: "💬", text: "The community board — post a question, get real answers" },
  ],
  Local: [
    { icon: "🎭", text: "Seasonal culture quests as they come up" },
    { icon: "🙋", text: "Volunteering quests — a fast way into a local network" },
  ],
  Kaveri: [
    { icon: "🏅", text: "Kaveri badge on the leaderboard" },
    { icon: "🌱", text: "Someone landing next week may read what you wrote" },
  ],
};

const MOBILE_LEVEL_BLURBS = {
  Settler: "Registered, coded, and on the books. The paperwork wall is behind you.",
  Local: "You know which shop, which tram, which forest. That took real work.",
  Kaveri: "Friend — that's the whole point of the name. Now you're the one who knows things.",
};

const MOBILE_QUICK_QUESTIONS = [
  "Is small talk rude here?",
  "What does neuvola do?",
  "Will my kids be behind at school?",
  "Indian groceries nearby?",
];

function mobileFlattenRoadmap(roadmap) {
  const out = [];
  PHASES.forEach((ph) => {
    (roadmap[ph.id] || []).forEach((step, idx) => out.push({ phaseId: ph.id, idx, step }));
  });
  return out;
}

// Prefers something warm/cultural for "today" over sterile admin — Kaveri
// is a friend first, not just a paperwork checklist. Urgent admin still
// surfaces (via "Kaveri's picks" on desktop, and the Quests tab here), so
// nothing time-sensitive actually gets buried by this.
function mobilePickToday(allSteps, progress) {
  const undone = allSteps.filter((e) => !progress[questKeyFor(e.phaseId, e.step, e.idx)]);
  if (!undone.length) return null;
  return (
    undone.find((e) => e.step.questCategory === "cultural") ||
    undone.find((e) => e.step.questCategory === "legal") ||
    undone[0]
  );
}

function mobileCultureRail(allSteps, progress) {
  const undone = allSteps.filter((e) => !progress[questKeyFor(e.phaseId, e.step, e.idx)]);
  const cultural = undone.filter((e) => e.step.questCategory === "cultural");
  const food = undone.filter((e) => e.step.questCategory === "food");
  const rail = [];
  for (let i = 0; i < 3 && rail.length < 5; i++) {
    if (cultural[i]) rail.push(cultural[i]);
    if (food[i]) rail.push(food[i]);
  }
  return rail;
}

function mobileQuestKey(entry) {
  return questKeyFor(entry.phaseId, entry.step, entry.idx);
}

// Real, filled-in profile facts only — never invents a chip the user didn't
// actually give us (unlike the prototype's fixed mock chips).
function mobileProfileChips(profile, categoryAnswers) {
  const chips = [];
  const bg = BACKGROUNDS.find((b) => b.id === profile.background);
  if (bg) chips.push(bg.label);
  if (Number(profile.childrenCount) > 0) {
    chips.push(`${profile.childrenCount} child${Number(profile.childrenCount) > 1 ? "ren" : ""}${profile.childrenAges ? ` (${profile.childrenAges})` : ""}`);
  }
  const fam = categoryAnswers.familyLife || {};
  if (fam.familyLanguages && fam.familyLanguages.length) chips.push(fam.familyLanguages.join(", "));
  if (fam.interests) chips.push(fam.interests);
  const culture = categoryAnswers.culture || {};
  if (culture.curiosity) chips.push(`Curious about: ${culture.curiosity}`);
  return chips;
}

function mobileDayCount() {
  if (!state.roadmapStartedAt) return 1;
  return Math.max(1, Math.floor((Date.now() - state.roadmapStartedAt) / 86400000) + 1);
}

function renderMobileApp() {
  const roadmap = state.roadmap || {};
  const profile = state.profile || {};
  const progress = state.progress || {};
  const userName = profile.name || "You";
  const initials = initialsFor(userName);
  const allSteps = mobileFlattenRoadmap(roadmap);
  const doneCount = allSteps.filter((e) => progress[mobileQuestKey(e)]).length;
  const totalCount = allSteps.length;
  const tab = state.mobileTab || "today";

  let screen = "";
  if (tab === "today") screen = renderMobileToday(allSteps, progress, profile, userName, initials);
  else if (tab === "quests") screen = renderMobileQuests(roadmap, progress, doneCount, totalCount);
  else if (tab === "buddy") screen = renderMobileBuddy(profile, allSteps, totalCount);
  else if (tab === "people") screen = renderMobilePeople();
  else if (tab === "you") screen = renderMobileYou(profile, userName, initials, allSteps, progress, doneCount, totalCount);

  const sel = state.mobileSel ? (roadmap[state.mobileSel.phaseId] || [])[state.mobileSel.idx] : null;

  return `
    <div class="mobile-app-root">
      <div class="ma-phone">
        <div class="ma-close-bar">
          <button type="button" class="ma-close-btn" data-action="toggle-mobile-app" aria-label="Close app view">✕</button>
        </div>
        <div class="ma-screen">${screen}</div>
        ${renderMobileTabBar(tab)}
        ${sel ? renderMobileQuestDetail(sel, state.mobileSel.phaseId, state.mobileSel.idx, progress) : ""}
        ${state.levelUpLabel ? renderMobileLevelUp() : ""}
      </div>
      ${renderMobileApiKeyModal()}
    </div>
  `;
}

function renderMobileTabBar(tab) {
  const tabs = [
    { id: "today", icon: "🏠", label: "Today" },
    { id: "quests", icon: "🗺️", label: "Quests" },
    { id: "buddy", icon: "💬", label: "Kaveri" },
    { id: "people", icon: "👥", label: "People" },
    { id: "you", icon: "🌱", label: "You" },
  ];
  return `
    <div class="ma-tabbar">
      ${tabs
        .map(
          (t) => `
        <button type="button" class="ma-tab ${tab === t.id ? "active" : ""}" data-action="mobile-tab" data-tab="${t.id}">
          <span class="ma-tab-icon">${t.icon}</span>
          <span class="ma-tab-label">${t.label}</span>
        </button>`
        )
        .join("")}
    </div>
  `;
}

// ---------- Today ----------

function renderMobileToday(allSteps, progress, profile, userName, initials) {
  const today = mobilePickToday(allSteps, progress);
  const cultureRail = mobileCultureRail(allSteps, progress);
  const city = profile.destination || "Finland";
  const origin = profile.origin || "India";
  const totalPoints = computeTotalPoints();
  const level = levelFor(totalPoints);
  const next = LEVELS.find((l) => l.min > totalPoints);
  const ringPct = next ? Math.min(1, (totalPoints - level.min) / (next.min - level.min)) : 1;
  const doneCount = allSteps.filter((e) => progress[mobileQuestKey(e)]).length;
  const overallPct = allSteps.length ? Math.round((doneCount / allSteps.length) * 100) : 0;
  const streak = state.streakCount || 1;
  const latestQ = (state.communityQuestions || [])[0];

  return `
    <div class="ma-screen-scroll">
      <div class="ma-topbar">
        <div class="ma-who">
          <div class="ma-avatar ma-avatar-purple">${initials}</div>
          <div>
            <div class="ma-greeting">Moi, ${escapeHtml(userName.split(/\s+/)[0] || "there")}</div>
            <div class="ma-subtle">Day ${mobileDayCount()} in ${escapeHtml(city)}</div>
          </div>
        </div>
        <button type="button" class="ma-icon-btn" data-action="mobile-tab" data-tab="you" aria-label="Your profile">🔔</button>
      </div>

      <div class="ma-pad">
        <div class="ma-route">
          <span class="ma-route-from">${escapeHtml(origin)}</span>
          <div class="ma-route-track"><div class="ma-route-fill" style="width:${overallPct}%"></div></div>
          <span class="ma-route-to">${escapeHtml(city)}</span>
        </div>
      </div>

      ${
        today
          ? `<div class="ma-pad">
              <div class="ma-hero">
                <div class="ma-hero-label">ONE THING TODAY</div>
                <div class="ma-hero-title" data-action="mobile-open-quest" data-phase="${today.phaseId}" data-idx="${today.idx}">${escapeHtml(today.step.title)}</div>
                <p class="ma-hero-sub">${escapeHtml(today.step.why)}</p>
                ${mobileSourceChip(today)}
                <div class="ma-hero-actions">
                  <label class="ma-hero-done">
                    <input type="checkbox" data-progress-toggle="${mobileQuestKey(today)}" data-quest-category="${today.step.questCategory}" data-quest-points="${today.step.points}">
                    <span>Mark done · +${today.step.points}</span>
                  </label>
                  <button type="button" class="ma-hero-chat" data-action="mobile-tab" data-tab="buddy" aria-label="Ask Kaveri">💬</button>
                </div>
              </div>
            </div>`
          : `<div class="ma-pad"><div class="ma-hero ma-hero-done-state"><div class="ma-hero-label">ALL CAUGHT UP</div><div class="ma-hero-title">Every quest is done — for now</div><p class="ma-hero-sub">New ones show up as your plan grows. Nice work.</p></div></div>`
      }

      <div class="ma-pad ma-stats-grid">
        <div class="ma-stat-card" data-action="mobile-tab" data-tab="you">
          <div class="ma-ring" style="background:conic-gradient(var(--ma-amber) 0turn ${ringPct.toFixed(3)}turn, var(--ma-border) 0turn 1turn)"><span>${level.icon}</span></div>
          <div>
            <div class="ma-stat-num">${totalPoints} pts</div>
            <div class="ma-stat-label">${next ? `${next.min - totalPoints} to ${next.icon} ${next.label}` : "Top level reached"}</div>
          </div>
        </div>
        <div class="ma-stat-card ma-streak-card">
          <div class="ma-streak-bars">${Array.from({ length: 5 }, (_, i) => `<span class="${i < Math.min(streak, 5) ? "on" : ""}"></span>`).join("")}</div>
          <div class="ma-stat-num">${streak} day${streak === 1 ? "" : "s"}</div>
          <div class="ma-stat-label">in a row</div>
        </div>
      </div>

      ${
        cultureRail.length
          ? `<div>
              <div class="ma-section-title ma-pad">Not just paperwork</div>
              <div class="ma-rail ma-pad">
                ${cultureRail
                  .map((e) => {
                    const qc = QUEST_CATEGORIES[e.step.questCategory];
                    return `<div class="ma-culture-card" data-action="mobile-open-quest" data-phase="${e.phaseId}" data-idx="${e.idx}">
                      <div class="ma-culture-emoji">${qc.icon}</div>
                      <div class="ma-culture-title">${escapeHtml(e.step.title)}</div>
                      <p class="ma-culture-short">${escapeHtml((e.step.why || "").slice(0, 90))}${(e.step.why || "").length > 90 ? "…" : ""}</p>
                      <div class="ma-culture-foot"><span>${qc.label.toUpperCase()}</span><span>+${e.step.points}</span></div>
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>`
          : ""
      }

      <div class="ma-pad">
        ${
          latestQ
            ? `<div class="ma-teaser" data-action="mobile-tab" data-tab="people" data-sub="ask">
                <div class="ma-avatar ma-avatar-teal ma-avatar-sm">${initialsFor(latestQ.name)}</div>
                <div class="ma-teaser-body"><strong>${escapeHtml(latestQ.name)}</strong> asked ${escapeHtml(latestQ.question)}</div>
                <span class="ma-chevron">›</span>
              </div>`
            : `<div class="ma-teaser" data-action="mobile-tab" data-tab="people" data-sub="ask">
                <div class="ma-teaser-body">Nobody's asked the community anything yet — be the first.</div>
                <span class="ma-chevron">›</span>
              </div>`
        }
      </div>
    </div>
  `;
}

function mobileSourceChip(entry) {
  const src = (entry.step.sources || [entry.step.source])[0];
  if (!src) return "";
  return `<div class="ma-source-chip" data-action="mobile-open-quest" data-phase="${entry.phaseId}" data-idx="${entry.idx}">📎 ${escapeHtml(src.name)}</div>`;
}

// ---------- Quests ----------

const MOBILE_QUEST_FILTERS = [
  { id: "all", label: "All" },
  { id: "legal", label: "⚖️ Admin" },
  { id: "social", label: "👥 Social" },
  { id: "cultural", label: "🎭 Cultural" },
  { id: "food", label: "🍴 Food" },
];

// Steps keep their original index (needed by questKeyFor / the detail
// overlay's roadmap[phaseId][idx] lookup) even after filtering.
function mobileQuestGroups(roadmap, filter) {
  return PHASES.map((ph) => {
    const all = (roadmap[ph.id] || []).map((s, i) => ({ s, i }));
    const steps = filter === "all" ? all : all.filter((e) => e.s.questCategory === filter);
    return { ph, steps };
  }).filter((g) => g.steps.length);
}

function mobileDefaultOpenPhase(groups, progress) {
  const withUndone = groups.find((g) => g.steps.some((e) => !progress[questKeyFor(g.ph.id, e.s, e.i)]));
  return (withUndone || groups[0] || {}).ph ? (withUndone || groups[0]).ph.id : null;
}

function renderMobileQuests(roadmap, progress, doneCount, totalCount) {
  const overallPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const filter = state.mobileQuestFilter || "all";
  const groups = mobileQuestGroups(roadmap, filter);
  const defaultOpen = mobileDefaultOpenPhase(groups, progress);
  const openPhase = state.mobileOpenPhase == null ? defaultOpen : state.mobileOpenPhase;

  return `
    <div class="ma-screen-scroll">
      <div class="ma-pad ma-top-pad">
        <div class="ma-page-title">Your board</div>
        <p class="ma-page-sub">${doneCount} of ${totalCount} done · every one links to a real official source.</p>
        <div class="ma-progress-bar"><div style="width:${overallPct}%"></div></div>
        <div class="ma-quest-filter-row">
          ${MOBILE_QUEST_FILTERS.map(
            (f) => `<button type="button" class="ma-pill ${filter === f.id ? "active" : ""}" data-action="mobile-quest-filter" data-filter="${f.id}">${f.label}</button>`
          ).join("")}
        </div>
      </div>
      ${
        groups.length
          ? groups
              .map((g) => {
                const isOpen = g.ph.id === openPhase;
                const doneInGroup = g.steps.filter((e) => progress[questKeyFor(g.ph.id, e.s, e.i)]).length;
                return `
        <div class="ma-pad">
          <button type="button" class="ma-phase-head ma-phase-head-btn" data-action="mobile-toggle-phase" data-phase="${g.ph.id}">
            <span>${g.ph.icon}</span><span class="ma-phase-label">${escapeHtml(g.ph.label)}</span>
            <span class="ma-phase-count">${doneInGroup}/${g.steps.length}</span>
            <span class="ma-phase-chevron ${isOpen ? "open" : ""}">›</span>
          </button>
          ${
            isOpen
              ? `<div class="ma-quest-list">
            ${g.steps.map((e) => renderMobileQuestRow(e.s, g.ph.id, e.i, progress)).join("")}
          </div>`
              : ""
          }
        </div>`;
              })
              .join("")
          : `<div class="ma-pad"><p class="ma-muted">No quests in this category right now.</p></div>`
      }
    </div>
  `;
}

function renderMobileQuestRow(step, phaseId, idx, progress) {
  const key = questKeyFor(phaseId, step, idx);
  const checked = !!progress[key];
  const qc = QUEST_CATEGORIES[step.questCategory];
  return `
    <div class="ma-quest-row ${checked ? "done" : ""}" style="--qc:${qc.color}">
      <label class="ma-check">
        <input type="checkbox" data-progress-toggle="${key}" data-quest-category="${step.questCategory}" data-quest-points="${step.points}" ${checked ? "checked" : ""}>
        <span class="ma-check-visual"></span>
      </label>
      <div class="ma-quest-info" data-action="mobile-open-quest" data-phase="${phaseId}" data-idx="${idx}">
        <div class="ma-quest-title ${checked ? "struck" : ""}">${escapeHtml(step.title)}</div>
        <div class="ma-quest-meta">${checked ? `✓ +${step.points} earned` : `+${step.points} pts · ${qc.label}`}</div>
      </div>
      <span class="ma-chevron" data-action="mobile-open-quest" data-phase="${phaseId}" data-idx="${idx}">›</span>
    </div>
  `;
}

// ---------- Kaveri (AI Buddy) ----------

function renderMobileBuddy(profile, allSteps, totalCount) {
  const key = hasApiKey();
  const name = profile.name || "there";
  const origin = profile.origin || "India";
  const destination = profile.destination || "Finland";
  const categoryCount = new Set(allSteps.map((e) => e.step.questCategory)).size;
  const greeting = `Hei ${name.split(/\s+/)[0]}. I've read your plan for ${origin} → ${destination} — ${totalCount} quests across ${categoryCount} areas. Ask me anything it doesn't cover, and I'll say plainly when I don't know.`;
  const log = state.aiChatLog || [];

  return `
    <div class="ma-buddy">
      <div class="ma-topbar ma-buddy-head">
        <div class="ma-avatar ma-avatar-amber">🪔</div>
        <div><div class="ma-buddy-name">Kaveri</div><div class="ma-subtle">${key ? "Knows your plan · always says when it's unsure" : "Add your Claude key to start chatting"}</div></div>
      </div>
      <div class="ma-buddy-log">
        <div class="ma-msg ma-msg-bot"><div class="ma-bubble ma-bubble-bot">${escapeHtml(greeting)}</div></div>
        ${log
          .map(
            (m) => `
          <div class="ma-msg ${m.role === "user" ? "ma-msg-user" : "ma-msg-bot"}">
            <div class="ma-bubble ${m.role === "user" ? "ma-bubble-user" : "ma-bubble-bot"}">${escapeHtml(m.text)}</div>
          </div>`
          )
          .join("")}
        ${
          key
            ? `<div class="ma-quick-row">${MOBILE_QUICK_QUESTIONS.map((q) => `<div class="ma-quick-chip" data-action="mobile-quick-ask" data-q="${escapeHtml(q)}">${escapeHtml(q)}</div>`).join("")}</div>`
            : `<div class="ma-msg ma-msg-bot"><div class="ma-bubble ma-bubble-bot">The board is generated from a fixed, verified knowledge base — this chat is the live, conversational part. Your key is kept only in this browser tab (sessionStorage), sent only to Anthropic's API, never saved anywhere.<br><button type="button" class="ma-cta" data-action="open-settings">Connect your Claude key</button></div></div>`
        }
      </div>
      ${
        key
          ? `<form class="ma-buddy-input" data-form="ai-ask" id="mobile-ai-ask">
              <input type="text" name="question" placeholder="Ask me anything about your move…" required autocomplete="off">
              <button type="submit" class="ma-send" aria-label="Send">↑</button>
            </form>`
          : ""
      }
    </div>
  `;
}

// ---------- People ----------

function renderMobilePeople() {
  const sub = state.mobilePeopleTab || "board";
  return `
    <div class="ma-screen-scroll">
      <div class="ma-pad ma-top-pad">
        <div class="ma-page-title">People on the way</div>
        <div class="ma-pill-row">
          <button type="button" class="ma-pill ${sub === "board" ? "active" : ""}" data-action="mobile-people-tab" data-sub="board">Leaderboard</button>
          <button type="button" class="ma-pill ${sub === "ask" ? "active" : ""}" data-action="mobile-people-tab" data-sub="ask">Ask the ones ahead</button>
        </div>
      </div>
      ${sub === "board" ? renderMobileLeaderboard() : renderMobileCommunity()}
    </div>
  `;
}

function renderMobileLeaderboard() {
  const rows = state.leaderboard || [];
  return `
    <div class="ma-pad">
      ${state.leaderboardError ? `<p class="ma-error">Couldn't load the leaderboard: ${escapeHtml(state.leaderboardError)}</p>` : ""}
      ${
        state.leaderboardLoading
          ? `<p class="ma-muted">Loading…</p>`
          : rows.length
          ? rows
              .map((r, i) => {
                const isMe = r.id === state.authUserId;
                const lvl = levelFor(r.total_points);
                return `<div class="ma-board-row ${isMe ? "me" : ""}">
                  <span class="ma-board-rank">${i + 1}</span>
                  <span class="ma-avatar ma-avatar-sm ma-avatar-purple">${initialsFor(r.name)}</span>
                  <div class="ma-board-info"><div class="ma-board-name">${escapeHtml(isMe ? "You" : r.name)}</div><div class="ma-board-sub">${lvl.icon} ${lvl.label}</div></div>
                  <span class="ma-board-pts">${r.total_points}</span>
                </div>`;
              })
              .join("")
          : `<p class="ma-muted">No one's completed a quest yet — be the first.</p>`
      }
      <p class="ma-privacy-note">Only names and points are ever shared — never which quests you've done, and nothing from your intake.</p>
    </div>
  `;
}

function renderMobileCommunity() {
  const rows = state.communityQuestions || [];
  const canPost = !!state.authUserId;
  return `
    <div class="ma-pad">
      ${
        canPost
          ? `<form class="ma-ask-form" data-form="community-question">
              <textarea name="question" rows="2" placeholder="What's on your mind?" required></textarea>
              <button type="submit" class="ma-cta">Post question</button>
            </form>`
          : `<p class="ma-muted">Log in with a real account (not test mode) to post or reply — you can still read what others have asked.</p>`
      }
      ${state.communityError ? `<p class="ma-error">Couldn't reach the community board: ${escapeHtml(state.communityError)}</p>` : ""}
      ${
        state.communityLoading
          ? `<p class="ma-muted">Loading…</p>`
          : rows.length
          ? rows.map((q) => renderMobileCommunityQuestion(q, canPost)).join("")
          : `<p class="ma-muted">No questions yet — be the first to ask.</p>`
      }
    </div>
  `;
}

function renderMobileCommunityQuestion(q, canPost) {
  const replies = (q.community_replies || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return `
    <div class="ma-community-card">
      <div class="ma-community-head">
        <span class="ma-avatar ma-avatar-sm ma-avatar-teal">${initialsFor(q.name)}</span>
        <div class="ma-community-name">${escapeHtml(q.name)}</div>
        <span class="ma-subtle">${timeAgo(q.created_at)}</span>
      </div>
      <p class="ma-community-body">${escapeHtml(q.question)}</p>
      ${
        replies.length
          ? `<div class="ma-community-replies">${replies
              .map(
                (r) => `<div class="ma-community-reply">
                  <div class="ma-community-head"><span class="ma-avatar ma-avatar-sm ma-avatar-amber">${initialsFor(r.name)}</span><span class="ma-community-name">${escapeHtml(r.name)}</span><span class="ma-subtle">${timeAgo(r.created_at)}</span></div>
                  <p>${escapeHtml(r.reply)}</p>
                </div>`
              )
              .join("")}</div>`
          : ""
      }
      ${
        canPost
          ? `<form class="ma-reply-form" data-form="community-reply" data-question-id="${q.id}">
              <input type="text" name="reply" placeholder="Write a reply…" required>
              <button type="submit">Reply</button>
            </form>`
          : ""
      }
    </div>
  `;
}

// ---------- You ----------

function renderMobileYou(profile, userName, initials, allSteps, progress, doneCount, totalCount) {
  const totalPoints = computeTotalPoints();
  const level = levelFor(totalPoints);
  const topLevel = LEVELS[LEVELS.length - 1];
  const roadPct = Math.min(100, Math.round((totalPoints / topLevel.min) * 100));
  const chips = mobileProfileChips(profile, state.categoryAnswers || {});
  const streak = state.streakCount || 1;

  return `
    <div class="ma-screen-scroll">
      <div class="ma-pad ma-top-pad ma-you-head">
        <div class="ma-avatar ma-avatar-purple ma-avatar-lg">${initials}</div>
        <div>
          <div class="ma-you-name">${escapeHtml(userName)}</div>
          <div class="ma-subtle">${escapeHtml(profile.origin || "India")} → ${escapeHtml(profile.destination || "Finland")}${state.roadmapStartedAt ? ` · day ${mobileDayCount()}` : ""}</div>
          <div class="ma-level-chip">${level.icon} ${level.label} · ${totalPoints} pts</div>
        </div>
      </div>

      <div class="ma-pad">
        <div class="ma-card">
          <div class="ma-eyebrow">THE ROAD TO ${topLevel.icon} ${topLevel.label.toUpperCase()}</div>
          <div class="ma-progress-bar ma-progress-bar-lg"><div style="width:${roadPct}%"></div></div>
          <div class="ma-road-marks">
            ${LEVELS.map((l) => `<span class="${totalPoints >= l.min ? "reached" : ""}">${l.icon} ${l.min}</span>`).join("")}
          </div>
          <div class="ma-stats-row">
            <div><div class="ma-stats-num">${doneCount}</div><div class="ma-subtle">quests done</div></div>
            <div><div class="ma-stats-num">${totalCount - doneCount}</div><div class="ma-subtle">still to go</div></div>
            <div><div class="ma-stats-num">${streak}</div><div class="ma-subtle">day streak</div></div>
          </div>
        </div>
      </div>

      <div class="ma-pad">
        <div class="ma-eyebrow">WHAT KAVERI KNOWS ABOUT YOU</div>
        <div class="ma-chip-row">
          ${chips.map((c) => `<span class="ma-chip">${escapeHtml(c)}</span>`).join("")}
          <span class="ma-chip ma-chip-add" data-action="edit-profile">＋ Add</span>
        </div>
        <p class="ma-fineprint">Only this shapes your quests. None of it is visible to anyone else, ever.</p>
      </div>

      <div class="ma-pad">
        <div class="ma-list-card">
          <button type="button" class="ma-list-row" data-action="download-pdf"><span>📄</span><span class="ma-list-label">Export my board as PDF</span><span class="ma-chevron">›</span></button>
          <button type="button" class="ma-list-row" data-action="toggle-mobile-app"><span>🖥️</span><span class="ma-list-label">Switch to desktop view</span><span class="ma-chevron">›</span></button>
          <button type="button" class="ma-list-row" data-action="log-out"><span>🚪</span><span class="ma-list-label">Log out</span><span class="ma-chevron">›</span></button>
        </div>
      </div>
    </div>
  `;
}

// ---------- Quest detail overlay ----------

function renderMobileQuestDetail(step, phaseId, idx, progress) {
  const key = questKeyFor(phaseId, step, idx);
  const checked = !!progress[key];
  const qc = QUEST_CATEGORIES[step.questCategory];
  const phase = PHASES.find((p) => p.id === phaseId);
  const sources = step.sources || [step.source];
  return `
    <div class="ma-overlay">
      <div class="ma-detail-head" style="background:${qc.color}">
        <div class="ma-detail-topline">
          <button type="button" class="ma-back" data-action="mobile-close-detail">‹</button>
          <span class="ma-badge">${qc.icon} ${qc.label.toUpperCase()}</span>
          <span></span>
        </div>
        <div class="ma-detail-title">${escapeHtml(step.title)}</div>
        <div class="ma-detail-meta">🪙 +${step.points} pts · ${phase ? escapeHtml(phase.label) : ""}</div>
      </div>
      <div class="ma-detail-body">
        <div>
          <div class="ma-eyebrow">WHY THIS IS YOURS</div>
          <p>${escapeHtml(step.why)}</p>
        </div>
        <div>
          <div class="ma-eyebrow">DO THIS</div>
          <p>${escapeHtml(step.action)}</p>
        </div>
        <div>
          <div class="ma-eyebrow">CHECK ME — REAL SOURCES</div>
          <div class="ma-source-list">
            ${sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener" class="ma-source-link">📎 <span>${escapeHtml(s.name)}</span> ↗</a>`).join("")}
          </div>
        </div>
        <div class="ma-buddy-nudge" data-action="mobile-tab" data-tab="buddy">
          <div class="ma-avatar ma-avatar-amber ma-avatar-sm">🪔</div>
          <div>Something specific about your situation? Ask Kaveri — it answers from your plan.</div>
        </div>
      </div>
      <div class="ma-detail-cta">
        <label class="ma-cta-toggle ${checked ? "done" : ""}">
          <input type="checkbox" data-progress-toggle="${key}" data-quest-category="${step.questCategory}" data-quest-points="${step.points}" ${checked ? "checked" : ""}>
          <span>${checked ? "Undo — not done yet" : `I've done this · +${step.points} pts`}</span>
        </label>
      </div>
    </div>
  `;
}

// ---------- Level-up celebration ----------

function renderMobileLevelUp() {
  const lu = state.levelUpLabel;
  const luLevel = LEVELS.find((l) => l.label === lu);
  const luIndex = luLevel ? LEVELS.indexOf(luLevel) + 1 : 0;
  const unlocks = MOBILE_LEVEL_UNLOCKS[lu] || [];
  return `
    <div class="ma-overlay ma-levelup">
      <button type="button" class="ma-levelup-close" data-action="close-levelup">✕</button>
      <div class="ma-levelup-badge">
        <span>${luLevel ? luLevel.icon : "🎉"}</span>
        <span class="ma-levelup-plus">+${state.levelUpEarned || 0} PTS</span>
      </div>
      <div class="ma-levelup-step">LEVEL ${luIndex} OF ${LEVELS.length}</div>
      <div class="ma-levelup-headline">You're a ${lu}.</div>
      <p class="ma-levelup-blurb">${MOBILE_LEVEL_BLURBS[lu] || ""}</p>
      <div class="ma-levelup-unlocks">
        <div class="ma-eyebrow">WHAT THIS UNLOCKED</div>
        ${unlocks.map((u) => `<div class="ma-unlock-row"><span>${u.icon}</span><span>${escapeHtml(u.text)}</span></div>`).join("")}
      </div>
      <div class="ma-levelup-actions">
        <button type="button" class="ma-cta ma-cta-light" data-action="close-levelup">See what's next</button>
        <div class="ma-levelup-note">Your leaderboard row just updated</div>
      </div>
    </div>
  `;
}

// ---------- API key modal (mobile Kaveri tab) ----------
// Reuses the exact same data-form="api-key" / open-settings / close-settings
// / clear-api-key handlers already wired in js/app.js for the desktop AI
// Buddy widget — this just makes sure #settings-modal exists in the DOM
// whenever the mobile app is mounted, since renderAiBuddy() (which used to
// render it) currently isn't called from renderRoadmap().

function renderMobileApiKeyModal() {
  return `
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
