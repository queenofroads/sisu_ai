/*
 * AI Buddy — optional live layer on top of the grounded roadmap engine.
 *
 * Design choice, on purpose: the entire roadmap (data.js + app.js) works
 * with ZERO network access and ZERO API key. This file only adds an
 * optional conversational layer for open-ended questions the rule engine
 * can't answer ("what if I sold the car", "we're a family of 4 moving in
 * November...").
 *
 * Security:
 *  - The API key is only ever kept in sessionStorage (cleared when the tab
 *    closes), never localStorage, never written to any file, never sent
 *    anywhere except https://api.anthropic.com directly from the browser.
 *  - Uses Anthropic's documented "anthropic-dangerous-direct-browser-access"
 *    header, which exists specifically for bring-your-own-key prototypes
 *    like this one. This is a hackathon prototype, not a production app —
 *    a real product would proxy this through a backend so the key never
 *    touches client code at all.
 */

const AI_MODEL = "claude-sonnet-5";
const AI_KEY_STORAGE = "itf_claude_api_key"; // sessionStorage only

function getApiKey() {
  return sessionStorage.getItem(AI_KEY_STORAGE) || "";
}

function setApiKey(key) {
  if (key) sessionStorage.setItem(AI_KEY_STORAGE, key);
  else sessionStorage.removeItem(AI_KEY_STORAGE);
}

function hasApiKey() {
  return !!getApiKey();
}

const BUDDY_SYSTEM_PROMPT = `You are "AI Buddy", a relocation companion inside IndiaToFinland — a tool
helping people move from India to Finland (Espoo/Helsinki region).

Personality:
- Warm but professional. Calm and reassuring. Practical and direct.
- Respectful of cultural differences — do not assume every Indian user
  speaks Hindi, follows the same traditions, or has the same family
  structure. Ask for preferences instead of assuming.
- Transparent when uncertain — if you don't know something official, say so
  and suggest where to verify, rather than inventing an answer.
- Encouraging without being childish. Helpful without overwhelming the user.
- Use short, understandable sentences. Avoid bureaucratic language; when an
  official term is necessary, explain it in plain English.

Example tone: "You have six weeks before arrival. Your most important next
step is to confirm the correct residence-permit pathway. I found the
relevant guidance from the Finnish Immigration Service — I can explain it
or open the official page."

You are answering follow-up questions about a relocation roadmap that has
already been generated from the user's profile (given below as context).
Ground your answers in real Finnish institutions (Migri, DVV, Kela, Vero,
InfoFinland, TE-palvelut, the person's destination city) where relevant. If
you're not certain of a specific rule or number, say so plainly rather than
guessing — this user is making real decisions.`;

async function askAiBuddy(userMessage, profile, roadmapSummary) {
  const key = getApiKey();
  if (!key) throw new Error("No API key set");

  const contextBlock = `User profile:\n${JSON.stringify(profile, null, 2)}\n\nCurrent roadmap summary:\n${roadmapSummary}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 600,
      system: BUDDY_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `${contextBlock}\n\nQuestion: ${userMessage}` },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`AI Buddy request failed (${resp.status}). ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "(no response text)";
}
