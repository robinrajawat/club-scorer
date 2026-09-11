// Cloudflare Worker: optional "polish with AI" step for a match recap.
//
// Deliberately thin. The app already builds a factually-complete recap for free, client-side, with
// no network call at all (src/core/matchRecap.js's buildMatchRecapDraft) -- this Worker's only job
// is to take that draft and ask a hosted LLM to rephrase it more vividly, never to reconstruct the
// match itself. That split matters: whatever the LLM does, the numbers/result it's rephrasing were
// already correct before it saw them, and if the call fails for any reason the caller still has the
// original draft to fall back to -- this endpoint is additive, not load-bearing.
//
// Two providers, both with a free tier, picked between at request time (falling back to
// DEFAULT_PROVIDER): Gemini (generativelanguage.googleapis.com) and Groq (api.groq.com, OpenAI-
// compatible chat-completions shape, serving open-weight models like Llama). Each needs its own API
// key as a Worker secret -- see README.md in this directory for setup.
//
// Model IDs below are current as of when this was written but both providers retire/rename models
// faster than this file will be revisited -- GEMINI_MODEL/GROQ_MODEL env vars override the
// defaults without a code change if a call starts failing with a "model not found" error.

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_DRAFT_LENGTH = 4000; // generous for a multi-paragraph recap; bounds worst-case cost/abuse
const SYSTEM_INSTRUCTION = "You are polishing a cricket match recap for a club's website. Rewrite the given recap in a livelier, more engaging tone -- 2 to 4 short sentences. Do not invent, change, or drop any name, number, or result from the original. Reply with only the rewritten recap text, no preamble.";

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const allow = allowed.includes(origin) ? origin : allowed.length === 0 ? "*" : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

async function callGemini(draft, env) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: draft }] }]
    })
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response had no text");
  return text.trim();
}

async function callGroq(draft, env) {
  const model = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: draft }
      ],
      temperature: 0.7,
      max_tokens: 300
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq response had no text");
  return text.trim();
}

const PROVIDERS = {
  gemini: { call: callGemini, keyName: "GEMINI_API_KEY" },
  groq: { call: callGroq, keyName: "GROQ_API_KEY" }
};

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const draft = typeof body.draft === "string" ? body.draft.trim() : "";
    if (!draft || draft.length > MAX_DRAFT_LENGTH) {
      return new Response(JSON.stringify({ error: `draft must be a non-empty string under ${MAX_DRAFT_LENGTH} characters` }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const provider = PROVIDERS[body.provider] ? body.provider : env.DEFAULT_PROVIDER in PROVIDERS ? env.DEFAULT_PROVIDER : "gemini";
    const { call, keyName } = PROVIDERS[provider];

    const respond = (payload) => new Response(JSON.stringify(payload), { headers: { ...headers, "Content-Type": "application/json" } });

    if (!env[keyName]) {
      // Not configured -- fall back to the original draft rather than a hard error, since the
      // polish step is optional and the caller already has a perfectly usable recap without it.
      return respond({ draft, text: draft, polished: false, provider, error: `${keyName} not configured` });
    }

    try {
      const text = await call(draft, env);
      return respond({ draft, text, polished: true, provider });
    } catch (err) {
      return respond({ draft, text: draft, polished: false, provider, error: String(err.message || err) });
    }
  }
};
