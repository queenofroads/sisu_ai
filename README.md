# IndiaToFinland — AI Talent & Relocation Companion

Built at the IWF Hackathon (Vikki campus, Helsinki), sponsored in part by the City of Espoo.

## Team

- Pooja — AI / product
- Manish — Backend
- Shweta — Frontend / product

## Challenge selected

**6. AI India–Finland Talent & Relocation Companion**

> Relocating between India and Finland involves navigating different administrative systems,
> education environments, workplaces, housing processes, and cultural expectations. Build an
> AI assistant that helps students, researchers and professionals discover and understand
> relevant official information and resources, and turns the relocation journey into a clear,
> personalised onboarding roadmap.

## Problem

Finland's official relocation information is genuinely excellent — Migri, DVV, Kela, Vero,
InfoFinland and the individual cities all publish accurate, detailed guidance. But it's
scattered across a dozen separate institutions, written for a generic "foreigner," and gives
no sense of *order*: what matters this week versus what can wait three months. A person moving
from, say, Bengaluru to Espoo with a spouse and a six-year-old has to manually cross-reference
all of it against their own specific situation.

## Target user

Indian students, researchers, and working professionals relocating to Finland — often with
family — who want the *real* official rules, not a generic global relocation checklist, and
who don't have weeks to spend reading every agency's website before they even know what
applies to them.

## Our solution

A short guided intake (where you're moving from/to, who's coming with you, your background,
languages spoken, interests, and which areas you need help with) drives a **personalised,
phase-ordered roadmap** — Before you leave India → First 2 weeks → First month → First 3
months → Ongoing — built entirely from real, verified official sources (Migri, DVV, Kela,
Vero, InfoFinland, the destination city, TE-palvelut). Every step shows *why it applies to
you specifically* and links to the exact official page it came from. Progress is tracked
per step, and an optional "AI Buddy" chat layer answers open-ended follow-up questions the
structured roadmap can't anticipate.

## How AI is used

Two layers, deliberately separated:

1. **Grounded personalization engine** (always on, works fully offline). Your profile and
   category answers are matched against a curated knowledge base of real official Finnish
   sources to generate a prioritised, phase-ordered roadmap personalised to your family
   situation, timeline, and background — this is the part that must never fail on stage, so it
   has zero network dependency.
2. **AI Buddy** (optional, bring-your-own Claude API key). A conversational layer for
   open-ended questions the structured roadmap can't cover — "we're a family of four moving in
   November, what changes for us?" — calling the Claude API directly from the browser with a
   persona tuned to be warm, practical, and explicit about uncertainty rather than guessing.
   This is where genuine LLM reasoning over messy, unstructured input earns its place, on top
   of (not instead of) the grounded roadmap.

We chose this split deliberately: a chatbot bolted onto a static FAQ page isn't a meaningful
use of AI, and a pure LLM answering "what visa do I need" from memory risks confidently
inventing a rule that doesn't exist. Grounding first, generation second.

## Responsible AI

- **Privacy:** all profile data stays in this browser's `localStorage`. Nothing is uploaded
  anywhere unless you explicitly use AI Buddy.
- **Reliability / transparency:** every roadmap step cites its real source with a link, so you
  can verify it yourself rather than trusting an AI-generated claim blind. Where we couldn't
  verify a specific deep link (e.g. private housing portals), we link to the verified
  homepage and say so, rather than guessing a URL.
- **Bias/fairness:** we don't assume every Indian user speaks Hindi, follows the same
  traditions, or has the same family structure — languages and interests are asked, not
  assumed.
- **Security:** the optional Claude API key lives only in `sessionStorage` (cleared when the
  tab closes), never written to a file, never committed, and never sent anywhere except
  Anthropic's API directly from your browser.

## Fun facts about Finland

A lighter, non-load-bearing addition for anyone reading this before their move — see
[TRIVIA.md](TRIVIA.md).

## Additional resources

A curated directory of real websites for relocating from India to Finland — official
government/authority sites kept clearly separate from community and commercial ones — see
[RESOURCES.md](RESOURCES.md).

## Potential impact

Extended further, this becomes the connective layer between Finland's already-excellent (but
scattered) public services and the people trying to navigate them — reducing the real cost of
relocation friction for the students, researchers and professionals Finland is actively trying
to attract.

## Running the prototype

No build step, no dependencies, no server required.

```bash
# from the repo root
python3 -m http.server 8080
# then open http://localhost:8080 in a browser
```

Or just open `index.html` directly in a browser.

**Optional live AI Buddy:** click "⚙️ AI Buddy settings" on the roadmap page and paste a
Claude API key (get one at [console.anthropic.com](https://console.anthropic.com)). Without a
key, the full roadmap still works — AI Buddy just isn't available for open-ended follow-ups.

## Repository structure

```
index.html       — app shell
css/style.css     — styling (light + dark mode, no external fonts/CDN)
js/data.js        — grounded knowledge base + roadmap generation logic
js/ai.js          — optional AI Buddy (Claude API, bring-your-own-key)
js/app.js         — state, views, wizard flow, event wiring
```

---
*No API keys, tokens, or personal data are committed to this repository. The optional AI
Buddy key is entered at runtime and stored only in the browser's `sessionStorage`.*
