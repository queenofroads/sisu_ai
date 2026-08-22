# CLAUDE.md

Context for Claude Code on this repo. Read this fully before writing code or generating content in this project.

## 1. Event context

- **Format:** Friday = remote day, challenge portfolio released 10:00. Saturday = on-site at
  Vikki campus, Helsinki, 10:00–15:00 continued build, 15:00 live demos to a judging panel.
- **Sponsor:** City of Espoo. Demos may be shown to them afterward.
- **Expectation set by organisers:** a working prototype solving a meaningful problem, using
  AI *purposefully* — not a chatbot bolted onto an unrelated app. Not expected to be
  production-ready. Prefer a smaller working solution over a large one that can't be
  demonstrated live. Judges want: Problem → User → AI solution → Working prototype →
  Demonstrable value, plus a nod to responsible AI (privacy, reliability, bias/fairness,
  accessibility, security, transparency) where relevant.

## 2. Team

| Name | Role / strengths |
|---|---|
| Pooja | AI / product |
| Manish | Backend |
| Shweta | Frontend / product |

## 3. Challenge

**Selected challenge:** 6. AI India–Finland Talent & Relocation Companion

**Problem statement:** Finland's official relocation information (Migri, DVV, Kela, Vero,
InfoFinland, individual cities) is accurate but scattered across many institutions, written
for a generic "foreigner," and gives no sense of what matters *now* versus later. A person
relocating with a family has to manually cross-reference all of it against their specific
situation.

**Target user:** Indian students, researchers, and professionals relocating to Finland
(often with family), who want Finland-specific official guidance turned into an ordered,
personalised plan — not a generic global relocation checklist.

## 4. Solution idea

**Product name: Kaveri** (Finnish for "friend/buddy"). A guided intake (origin/destination,
family, background, languages, interests, and which categories the user needs help with) drives
a personalised **quest board**, generated from a curated knowledge base of real official Finnish
sources. Every quest belongs to one of four quest categories (⚖️ Legal, 👥 Social, 🎭 Cultural,
🍴 Food — see `QUEST_CATEGORIES` in `js/data.js`), is worth points, and explains *why it applies
to this person* with a link to its real source. Completing quests earns points toward a level
(Newcomer → Settler → Local → Kaveri) and a spot on a public leaderboard. An optional "AI Buddy"
chat layer (bring-your-own Claude API key, called directly from the browser) answers open-ended
follow-ups the quest board can't anticipate. See README.md for full detail — this doubles as the
demo narrative, don't redesign it twice.

**Pivot note (2026-08-22):** the original design was a pure offline roadmap with zero network
dependency anywhere except the optional AI Buddy. Mid-hackathon the team explicitly chose to add
gamification (points/leaderboard/real accounts) on top, which required a **required** network
dependency (Supabase) — a deliberate, discussed tradeoff, not an accident. Keep that distinction
in mind: AI Buddy stays optional-with-graceful-failure; Supabase is required-with-clear-setup-
banner-if-missing. Don't blur the two failure modes.

## 5. Tech stack

**Chosen stack:** Vanilla HTML/CSS/JS, no framework, no build step — plus **Supabase**
(Postgres + Auth, loaded via CDN script tag) for accounts, quest-completion sync, and the
leaderboard.

Why mostly-vanilla: this is a 1.5-day build being demoed on venue wifi that may or may not hold
up. A static site that needs nothing except a browser has zero deployment risk. The
quest-*generation* logic (matching a profile against the knowledge base) has **zero network
dependency** — it must never fail on stage regardless of what Supabase or the AI Buddy are
doing.

Why Supabase is different from AI Buddy: it's a **required** dependency now, not optional. If
`js/config.js` isn't filled in (or the CDN/network is down), the app shows a clear setup/error
banner instead of the quest board — see `isSupabaseConfigured()` / `renderSetupBanner()` in
`js/app.js`. That's an accepted risk for this build, explicitly chosen over keeping the
leaderboard fake or dropping it — see README.md's "Tech stack" section for the tradeoff as
explained to the team.

**Repo status:** live at this repo. Run locally with `python3 -m http.server` (see README.md) —
needs `http(s)://`, not `file://`, because Supabase auth requires it.

**File layout:**
- `index.html` — app shell. Script order matters: Supabase CDN → `config.js` → `data.js` →
  `supabaseClient.js` → `ai.js` → `app.js`.
- `js/config.js` — `SUPABASE_URL` / `SUPABASE_ANON_KEY`. The anon key is meant to be public
  (protected by RLS) — never put a `service_role` key here or anywhere in this repo.
- `js/data.js` — `SOURCES` (every real, verified URL used anywhere in the app), `QUEST_CATEGORIES`
  (the 4 quest buckets + their point values + `LEVELS`), `CATEGORIES` (the wizard's question tree
  per topic, each tagged with a `questCategory`), `ROADMAP_GENERATORS` (personalization logic —
  one function per category), `CULTURAL_QUESTS` / `FOOD_QUESTS` (fixed, ungated quest lists
  every user gets), `buildRoadmap()` / `questKeyFor()`.
- `js/supabaseClient.js` — thin wrapper around the Supabase JS client: auth (signup/login/
  logout/session), profile upsert, quest-completion sync, leaderboard fetch. Throws clear errors
  rather than swallowing them — `app.js` decides how to surface each one.
- `js/ai.js` — optional AI Buddy: Claude API called directly from the browser via
  `anthropic-dangerous-direct-browser-access`, key kept in `sessionStorage` only.
- `js/app.js` — all local state (`localStorage`-backed: profile, wizard progress, the generated
  roadmap, and a local mirror of quest completions), view rendering, wizard flow, auth
  orchestration, event delegation (two `document`-level listeners for click/change/submit — this
  is deliberate so event handlers survive full-innerHTML re-renders without needing to be
  re-bound).
- `supabase/schema.sql` — run once per Supabase project (SQL editor). `profiles` and
  `quest_completions` are RLS-locked to the owning user; a `leaderboard` view exposes only
  `id, name, total_points` publicly. `total_points` is maintained by a trigger — never have
  client code write it directly.

**Adding a new wizard category:** add an entry to `CATEGORIES` in `data.js` (icon, blurb,
`questCategory`, question list) and a matching function on `ROADMAP_GENERATORS` keyed by the
same id. Every step you generate must cite a real entry from `SOURCES` — never invent a URL. If
you can't verify a specific deep link, link to the institution's homepage and say so in the
`why` text, the way the `housing` generator already does. This rule applies identically to
`CULTURAL_QUESTS` / `FOOD_QUESTS` — every entry there was verified via web search before being
added, same bar as everything else.

## 6. Demo narrative — also the README backbone

`Problem → Target User → Our Solution → How AI Helps → Working Demo → Potential Impact`

Suggested live demo: pick one realistic persona (e.g. a software engineer moving from
Bengaluru to Espoo with a spouse and a 6-year-old), walk the intake once, land on the
generated roadmap, show the "Top priorities" section, click into one step's source link to
prove it's real, then (if wifi cooperates) show one AI Buddy follow-up question. Have the
grounded-roadmap path memorized as the fallback if wifi doesn't cooperate — it needs no
network at all.

## 7. Working conventions for Claude Code

- **Grounding is non-negotiable.** Every fact or link shown to the user must trace back to a
  real, checked source in `SOURCES`. This app's entire value proposition is "we didn't
  hallucinate the rules" — breaking that in front of judges (or the City of Espoo) is the
  single worst failure mode available to us. When in doubt, verify before adding a claim, or
  soften it to point at a homepage instead of a guessed deep link.
- **Commits:** small, frequent, descriptive. Every commit should run — no committing broken
  states right before demo prep.
- **Secrets — hard rule:** never write a real API key, token, password, or personal data into
  any tracked file. The AI Buddy key is entered at runtime and lives only in
  `sessionStorage` — never localStorage, never a file.
- **Scope discipline:** default to the simplest implementation that demonstrably works live.
  If asked to build something that risks not demoing reliably (a new network dependency, a
  backend, a build step), say so.
- **Testing:** no formal test suite. Before calling any UI change done, actually run it —
  serve the directory (`python3 -m http.server`) and click through the flow in a browser, or
  drive it headlessly via Chrome DevTools Protocol if no interactive browser is available.
  Confirm no console errors, not just that the code looks right.

## 8. Repository submission checklist (required by organisers)

Public GitHub repo, due end of Saturday, must contain:

- [x] Project source code
- [x] README covering: project explanation, challenge selected, problem addressed, how AI is
  used, instructions to run/view the prototype, team member names
- [ ] No secrets, keys, tokens, or personal data anywhere in the commit history — re-check
  before final submission, not just in the latest commit
- [ ] Repo visibility set to **public** before final submission
- [ ] Push access confirmed for all three team members (as of last check, only one GitHub
  account on the building laptop had push rights — see git remote / `gh auth status`)
