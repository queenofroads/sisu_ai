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

A guided intake (origin/destination, family, background, languages, interests, and which
categories the user needs help with) drives a personalised, phase-ordered roadmap
(Before departure → First 2 weeks → First month → First 3 months → Ongoing), generated from a
curated knowledge base of real official Finnish sources. Every step explains *why it applies
to this person* and links to its real source. An optional "AI Buddy" chat layer (bring-your-
own Claude API key, called directly from the browser) answers open-ended follow-ups the
structured roadmap can't anticipate. See README.md for full detail — this doubles as the
demo narrative, don't redesign it twice.

## 5. Tech stack

**Chosen stack:** Vanilla HTML/CSS/JS. No framework, no build step, no CDN, no external
dependencies of any kind.

Why: this is a 1.5-day build being demoed on venue wifi that may or may not hold up. A static
site that needs nothing except a browser has zero deployment risk and zero "the CDN didn't
load" risk. The core roadmap-generation logic has **zero network dependency** — it must never
fail on stage. The only network call in the entire app is the *optional* AI Buddy chat, gated
behind the user pasting their own API key, and its failure mode is graceful (an inline error
message, not a broken page).

**Repo status:** live at this repo. Deployed via GitHub Pages or run locally with
`python3 -m http.server` (see README.md).

**File layout:**
- `index.html` — app shell, three `<script>` tags in dependency order: `data.js`, `ai.js`, `app.js`
- `js/data.js` — `SOURCES` (every real, verified URL used anywhere in the app), `CATEGORIES`
  (the question tree per topic), `ROADMAP_GENERATORS` (personalization logic — one function
  per category, reading `profile` + that category's answers, returning phase-tagged steps)
- `js/ai.js` — optional AI Buddy: Claude API called directly from the browser via
  `anthropic-dangerous-direct-browser-access`, key kept in `sessionStorage` only
- `js/app.js` — all state (`localStorage`-backed), view rendering, wizard flow, event
  delegation (two `document`-level listeners for click/change/submit — this is deliberate so
  event handlers survive full-innerHTML re-renders without needing to be re-bound)

**Adding a new category:** add an entry to `CATEGORIES` in `data.js` (icon, blurb, question
list) and a matching function on `ROADMAP_GENERATORS` keyed by the same id. Every step you
generate must cite a real entry from `SOURCES` — never invent a URL. If you can't verify a
specific deep link, link to the institution's homepage and say so in the `why` text, the way
the `housing` generator already does.

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
