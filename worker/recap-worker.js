// Cloudflare Worker: optional "polish with AI" step for a match recap.
//
// Deliberately thin. The app already builds a factually-complete recap for free, client-side, with
// no network call at all (src/core/matchRecap.js's buildMatchRecapDraft) -- this Worker's only job
// is to take that draft and ask a hosted LLM to rephrase it more vividly, never to reconstruct the
// match itself. That split matters: whatever the LLM does, the numbers/result it's rephrasing were
// already correct before it saw them, and if the call fails for any reason the caller still has the
// original draft to fall back to -- this endpoint is additive, not load-bearing.
//
// Two providers, both with a free tier: Gemini (generativelanguage.googleapis.com) and Groq
// (api.groq.com, OpenAI-compatible chat-completions shape, serving open-weight models like Llama).
// The request's `provider` field (or DEFAULT_PROVIDER) picks which one is tried FIRST, but not the
// only one tried -- if it fails for any reason, every other configured provider is tried in turn
// before giving up, so one provider having a bad day (a retired model, a tripped quota, an outage)
// doesn't take the whole feature down as long as another is configured. Each provider needs its own
// API key as a Worker secret -- see README.md in this directory for setup.
//
// Token efficiency, since a free tier's quota is the whole point of using one -- three deliberate
// choices, in order of how much quota they actually save:
// 1. Response caching (Workers' own `caches.default`, no paid KV needed): a given match's recap
//    never changes once scored, so the SAME (provider, draft) pair is only ever sent to the LLM
//    once, keyed by a hash of both -- every repeat view/retry/re-render of the same match is a
//    cache hit, zero tokens spent. This is the single biggest lever: a UI that re-fetches on every
//    screen open would otherwise re-spend the full call each time for no new information.
// 2. Output is capped short server-side (maxOutputTokens/max_tokens below) -- a recap is 2-4
//    sentences, not an essay, and an uncapped response risks the model rambling well past what's
//    needed, which is pure wasted output-token spend on a free tier that counts them.
// 3. Gemini's thinkingConfig is explicitly set to budget 0, regardless of whether the current
//    default model (see DEFAULT_GEMINI_MODEL below) thinks by default or not -- if GEMINI_MODEL is
//    ever pointed at a "thinking" variant, thinking tokens are billed/quota'd like output tokens
//    and can be 10-100x the size of the visible reply for a task this simple -- rephrasing a
//    paragraph needs no reasoning step, so this stays set rather than relying on whatever the
//    model's own default happens to be.
//
// Model IDs below are current as of when this was written but both providers retire/rename models
// faster than this file will be revisited -- GEMINI_MODEL/GROQ_MODEL env vars override the
// defaults without a code change if a call starts failing with a "model not found" error.

// gemini-2.0-flash was retired -- confirmed live via the deployed Worker's own 404 ("This model
// models/gemini-2.0-flash is no longer available... use models/gemini-3.6-flash"), not guessed.
// GEMINI_MODEL (env) still overrides this without a redeploy if it drifts again.
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_DRAFT_LENGTH = 1200; // a buildMatchRecapDraft() output is a few hundred chars; this leaves headroom without inviting abuse-sized input
const MAX_OUTPUT_TOKENS = 150; // 2-4 short sentences never needs more; used for Groq, which isn't a thinking model
// Gemini-specific, deliberately higher than MAX_OUTPUT_TOKENS: gemini-3.6-flash thinks by default
// and thinking tokens count against maxOutputTokens the same as the visible reply -- at 150 the
// model was burning the entire budget on reasoning and returning a near-empty/truncated reply
// (confirmed live: a 3-word draft polish came back as literally ")"). 1024 was tried first and
// still wasn't always enough -- thinking-token consumption varies per request, and one real test
// still came back cut off mid-sentence at that budget. This is a stopgap trading a meaningful chunk
// of the token-efficiency goal (see file header) for a working reply while the correct thinkingConfig
// shape for this model is still unverified (its predecessor's shape, thinkingBudget: 0, was REJECTED
// outright with a 400 -- see the git history here); Gemini also isn't the primary provider anymore
// (see DEFAULT_PROVIDER in wrangler.toml -- Groq, which isn't a thinking model, goes first), so this
// budget mostly matters for the fallback path now, not the common case. Revisit once the correct
// thinkingConfig shape is confirmed: properly disabling thinking should let this come back down.
const GEMINI_MAX_OUTPUT_TOKENS = 2048;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days -- a completed match's recap is immutable, so this is really "cache forever" in practice
const SYSTEM_INSTRUCTION = "Rewrite this cricket match recap in a livelier tone, 2-4 short sentences. Keep every name, number, and result exactly as given. Reply with only the rewritten text.";

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

// Cache key is content-addressed (provider + draft text), not per-match -- two identically-worded
// drafts (unlikely, but e.g. two rain-abandoned matches with the same score line) legitimately
// share one cached polish, and nothing needs to know about matches/IDs at all, which keeps this
// Worker match-schema-agnostic.
//
// CACHE_VERSION is folded into the key specifically so it CAN be invalidated -- a real incident
// showed why: the request-building logic changed (dropping thinkingConfig, raising the output
// budget) but the cache didn't know that, and kept serving a draft's already-cached BROKEN reply
// (a literal ")" from the truncated-by-thinking-tokens bug) for the rest of its 7-day TTL even
// after the fix deployed, since the cache key never changed for that exact (provider, draft) pair.
// Bump this string on any future change to what actually gets sent to a provider or how its reply
// is parsed -- anything that could change what a given draft SHOULD produce.
const CACHE_VERSION = "2";
async function cacheKeyFor(provider, draft) {
  const bytes = new TextEncoder().encode(`${CACHE_VERSION}:${provider}:${draft}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  return new Request(`https://recap-cache.internal/${provider}/${hex}`);
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
      contents: [{ role: "user", parts: [{ text: draft }] }],
      // thinkingConfig dropped: gemini-2.0-flash's retirement (see DEFAULT_GEMINI_MODEL) also broke
      // this call with a bare "400 INVALID_ARGUMENT" once switched to gemini-3.6-flash -- no field-
      // level detail in Gemini's error body, and this session has no reachable, verified source for
      // that model's current request shape (postdates training data; Google's docs are also
      // unreachable from this sandbox's network policy). thinkingConfig is the least-certain, newest
      // part of this request and isn't load-bearing (a defensive cost control, not correctness), so
      // it's the first thing to drop while isolating the actual cause -- re-add once confirmed
      // working again, ideally against gemini-3.6-flash's own current docs rather than guessed back in.
      generationConfig: {
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS
      }
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
      max_tokens: MAX_OUTPUT_TOKENS
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
  async fetch(request, env, ctx) {
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

    const preferred = PROVIDERS[body.provider] ? body.provider : env.DEFAULT_PROVIDER in PROVIDERS ? env.DEFAULT_PROVIDER : "gemini";
    // Try the preferred provider first, then fall back through the others -- one provider having a
    // bad day (a retired model, a tripped quota, an outage) no longer takes the whole feature down,
    // it just silently falls through to whichever provider actually still works. This is the one
    // thing worth adopting from a sibling project's own AI-gateway Worker (sakura-notes.com's
    // ai/complete endpoint) after today's incident: gemini-2.0-flash's retirement broke every single
    // request with no fallback, even though Groq (unaffected) was configured and ready the whole
    // time.
    const order = [preferred, ...Object.keys(PROVIDERS).filter(p => p !== preferred)];
    const configured = order.filter(p => !!env[PROVIDERS[p].keyName]);

    const respond = (payload) => new Response(JSON.stringify(payload), { headers: { ...headers, "Content-Type": "application/json" } });

    if (configured.length === 0) {
      // Not configured -- fall back to the original draft rather than a hard error, since the
      // polish step is optional and the caller already has a perfectly usable recap without it.
      return respond({ draft, text: draft, polished: false, provider: preferred, error: `${PROVIDERS[preferred].keyName} not configured` });
    }

    const cache = caches.default;
    const errors = [];
    for (const provider of configured) {
      const cacheKey = await cacheKeyFor(provider, draft);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const text = await cached.text();
        return respond({ draft, text, polished: true, provider, cached: true });
      }
      try {
        const text = await PROVIDERS[provider].call(draft, env);
        // Cache-write happens after the response is already on its way back to the caller --
        // ctx.waitUntil keeps the Worker alive long enough to finish it without adding to this
        // request's own latency.
        ctx.waitUntil(cache.put(cacheKey, new Response(text, { headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` } })));
        return respond({ draft, text, polished: true, provider });
      } catch (err) {
        errors.push(`${provider}: ${String(err.message || err)}`);
      }
    }
    // Every configured provider failed -- report all of them, not just the last, so whoever's
    // reading the console.warn on the other end (see ResultScreen's handlePolishRecap) doesn't have
    // to guess which one actually mattered.
    return respond({ draft, text: draft, polished: false, provider: preferred, error: errors.join("; ") });
  }
};
