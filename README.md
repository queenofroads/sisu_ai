# Kaveri — Gamified Finland Relocation Quests

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
no sense of *order* or *motivation* to actually get through it. A person moving from, say,
Bengaluru to Espoo with a spouse and a six-year-old has to manually cross-reference all of it
against their own specific situation — and a wall of admin tasks is easy to put off.

## Target user

Indian students, researchers, and working professionals relocating to Finland — often with
family — who want the *real* official rules turned into something they'll actually finish,
not a checklist that gets abandoned in week two.

## Our solution

A short guided intake (where you're moving from/to, who's coming with you, your background,
languages spoken, interests, and which areas you need help with) turns Finland's real official
guidance into a **personalised quest board**. Every quest belongs to one of four categories —

- ⚖️ **Administrative Work** — residence permits, DVV registration, personal ID, tax card, bank account, housing paperwork
- 👥 **Social** — job market/employment services, community and language groups, making connections
- 🎭 **Cultural** — Finnish customs, sauna, public holidays, outdoor life, what's on locally
- 🍴 **Food** — Finnish dishes and food culture worth trying

— and is worth points. Complete quests, earn points, and climb a level: 🌱 Newcomer → 🏠 Settler
→ 🧭 Local → 🤝 **Kaveri** (Finnish for "friend/buddy" — the whole app is trying to get you
there). A public leaderboard (name + points only) shows how you're doing against everyone else
using the app. An optional "AI Buddy" chat layer answers open-ended follow-ups the quest board
can't anticipate.

## How AI is used

Two layers, deliberately separated:

1. **Grounded quest-generation engine** (works fully offline, zero network dependency). Your
   profile and category answers are matched against a curated knowledge base of real official
   Finnish sources to generate a prioritised, phase-ordered set of quests personalised to your
   family situation, timeline, and background.
2. **AI Buddy** (optional, bring-your-own Claude API key). A conversational layer for
   open-ended questions the quest board can't cover — "we're a family of four moving in
   November, what changes for us?" — calling the Claude API directly from the browser with a
   persona tuned to be warm, practical, and explicit about uncertainty rather than guessing.

We chose this split deliberately: a chatbot bolted onto a static FAQ page isn't a meaningful
use of AI, and a pure LLM answering "what visa do I need" from memory risks confidently
inventing a rule that doesn't exist. Grounding first, generation second.

## Tech stack

Vanilla HTML/CSS/JS, no build step, no framework — plus **Supabase** (Postgres + Auth) for
accounts, quest-completion sync, and the leaderboard. Unlike AI Buddy, Supabase is a
**required** dependency: the quest board, accounts, and leaderboard don't work without it. The
quest-*generation* logic itself (matching your profile against the knowledge base) still has
zero network dependency and never fails on stage even if Supabase or wifi does.

## Running the prototype

### 1. Create a Supabase project

- Sign up / log in at [supabase.com](https://supabase.com) and create a new project.
- In **Authentication → Providers → Email**, turn **off** "Confirm email" for the demo — this
  lets signup log people in immediately without needing a live inbox on stage. (Leave it on for
  a real deployment.)
- If "Confirm email" is on (e.g. for the real public link people are actually signing up at),
  go to **Authentication → URL Configuration** and add your deployed URL (e.g.
  `https://sisu-ai-sigma.vercel.app/**`) under **Redirect URLs**, and set **Site URL** to that
  same domain. Supabase defaults both to `http://localhost:3000`, which is why confirmation
  emails sent from the live site were redirecting people to `localhost:3000` instead of the app —
  the code now passes `emailRedirectTo` explicitly (see `signUpWithEmail` in
  `js/supabaseClient.js`), but Supabase still only honors it if the URL is on this allowlist.
- Open the SQL editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql). This
  creates `profiles` and `quest_completions` (both locked down with row-level security to the
  owning user) and a public `leaderboard` view that only exposes name + points.
- In **Project Settings → API**, copy the **Project URL** and **anon public** key.

### 2. Configure the app

Paste those two values into `js/config.js`:

```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```

The anon key is designed to be public client-side — it only grants what the schema's RLS
policies allow. Never put a `service_role` key here or anywhere in this repo.

### 3. Run it

No build step required.

```bash
python3 -m http.server 8080
# then open http://localhost:8080 in a browser
```

Or just open `index.html` directly in a browser (Supabase auth needs `http(s)://`, not `file://`,
so use the server for anything beyond viewing the setup banner).

### 4. (Optional) Scheduled Slack reminders

Kaveri can post a real, automated check-in to Slack on a schedule — "⏰ Kaveri check-in: Ananya —
40 pts, Rahul — 25 pts. Keep going!" — using Supabase's own cron (`pg_cron`) to call an Edge
Function that posts to a Slack Incoming Webhook. Deliberately generic content (points/progress
only, not specific quest titles): quest content only exists client-side in `js/data.js`,
generated fresh per profile — Supabase never sees it, only which quest IDs got checked off, so a
server-side job has no quest title to name.

1. **Create a Slack Incoming Webhook** — in your Slack workspace: Apps → search "Incoming
   Webhooks" → Add to Slack → pick a channel or a specific person's DM → copy the webhook URL
   (`https://hooks.slack.com/services/...`). Keep this secret — anyone with it can post as this
   webhook.
2. **Deploy the Edge Function**: `supabase functions deploy send-slack-reminder` (from the repo
   root, with the Supabase CLI logged in and linked to your project). Or paste
   [`supabase/functions/send-slack-reminder/index.ts`](supabase/functions/send-slack-reminder/index.ts)
   into a new Edge Function in the dashboard.
3. **Set the webhook as a secret** (never commit it): `supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...`
4. **Schedule it**: edit the two `<PLACEHOLDER>` values in
   [`supabase/cron.sql`](supabase/cron.sql) (your project ref and anon key) and run it in the SQL
   editor. Defaults to daily at 08:00 UTC — edit the cron expression to taste.
5. **To prove it live on stage** without waiting for the schedule: `supabase functions invoke send-slack-reminder`,
   or the "Invoke" button on the function's page in the dashboard.

## Responsible AI

- **Privacy:** quest-completion history (*which* quests you've done) is private to your account
  — only your name and total points are ever public, via the leaderboard view. You can choose to
  show a nickname instead of your real name on the leaderboard. Nothing about your profile,
  origin, or destination is shared with other users.
- **Reliability / transparency:** every quest cites its real source with a link, so you can
  verify it yourself rather than trusting an AI-generated claim blind. Where we couldn't verify
  a specific deep link (e.g. private housing portals), we link to the verified homepage and say
  so, rather than guessing a URL. If Supabase isn't configured, the app says so clearly instead
  of failing silently or half-working.
- **Bias/fairness:** we don't assume every Indian user speaks Hindi, follows the same
  traditions, or has the same family structure — languages and interests are asked, not assumed.
- **Security:** the optional Claude API key lives only in `sessionStorage` (cleared when the tab
  closes), never written to a file, never committed, and never sent anywhere except Anthropic's
  API directly from your browser. The Supabase anon key is safe to expose client-side by design;
  actual access control is enforced server-side by Postgres row-level security.

## Potential impact

Extended further, this becomes the connective layer between Finland's already-excellent (but
scattered) public services and the people trying to navigate them — using game mechanics to
turn a genuinely stressful admin slog into something with visible momentum, community, and an
actual finish line.

## Fun facts about Finland

A lighter, non-load-bearing addition for anyone reading this before their move — see
[TRIVIA.md](TRIVIA.md).

## Additional resources

A curated directory of real websites for relocating from India to Finland — official
government/authority sites kept clearly separate from community and commercial ones — see
[RESOURCES.md](RESOURCES.md).

## Indian community in Finland

A reference list of Indian community organisations in Finland — pan-Indian groups, regional/
language associations, and events — see [INDIAN_COMMUNITY.md](INDIAN_COMMUNITY.md).
