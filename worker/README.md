# Recap polish Worker

A small Cloudflare Worker that takes a match recap already built client-side
(`src/core/matchRecap.js`'s `buildMatchRecapDraft`) and asks a hosted LLM to
rephrase it more vividly. Optional by design: if this Worker is never
deployed, or a request to it fails, the app still has a complete, factually
correct recap with zero network dependency.

Two providers, both with a free tier. `provider: "gemini"` or `"groq"` in the
POST body (or the `DEFAULT_PROVIDER` var) picks which one is tried **first**,
not the only one tried — if it fails for any reason, every other configured
provider is tried in turn before giving up, so one provider having a bad day
(a retired model, a tripped quota, an outage) doesn't take the whole feature
down as long as another is configured:

- **Gemini** — needs a key from [Google AI Studio](https://aistudio.google.com/apikey).
- **Groq** — needs a key from [console.groq.com](https://console.groq.com/keys).

Neither key is deployed here — this repo only contains the Worker's code.
Deploying it and setting the secrets is a one-time step someone with a
Cloudflare account needs to do; nothing in this session has done that.

## Deploy

```bash
cd worker
npm install -g wrangler   # if you don't already have it
wrangler login
wrangler secret put GEMINI_API_KEY   # paste the key when prompted
wrangler secret put GROQ_API_KEY     # optional, only if you want Groq too
wrangler deploy
```

Before deploying somewhere the URL will be public, set `ALLOWED_ORIGIN` in
`wrangler.toml` to the actual site(s) that should be allowed to call it (e.g.
`https://www.clubscorer.com`) — left blank, CORS allows any origin, which is
fine for local testing but not for a live URL with real API keys behind it.

## Request shape

```
POST /  { "draft": "<the recap text>", "provider": "gemini" | "groq" }
->      { "draft": "...", "text": "...", "polished": true, "provider": "gemini" }
```

On any failure, it first tries every other configured provider before giving
up; only once all of them have failed does it return `polished: false` with
`text` equal to the original `draft` (and `error` naming what each one said)
— the caller always gets back something usable, never a hard error.

## Token efficiency

Free-tier quota is the actual constraint here, not latency, so three things
are deliberate:

- **Response caching** — `caches.default` (Workers' built-in edge cache, no
  paid KV needed), keyed by a hash of `(provider, draft)`. A match's recap
  never changes once scored, so the same draft is only ever sent to the LLM
  once; every repeat call for it (a retry, a re-opened screen) is a cache hit
  and costs zero tokens. Cached for 7 days — effectively "forever" for a
  finished match. A response includes `"cached": true` when this fires.
- **Capped output** (`MAX_OUTPUT_TOKENS` = 150) — a recap is 2-4 sentences,
  not an essay; this bounds worst-case spend per call on both providers.
- **Thinking off for Gemini** (`thinkingConfig.thinkingBudget: 0`) — the
  default model doesn't think by default, but if `GEMINI_MODEL` ever gets
  pointed at a thinking-capable variant, reasoning tokens are quota'd the
  same as output tokens and can dwarf the visible reply for a task this
  simple. Set defensively rather than left to the model's own default.

## Known gaps (not built here)

- **No rate limiting.** Anyone with the Worker's URL can call it as fast as
  Cloudflare allows — the caching above only helps for a *repeated* draft,
  not a flood of distinct ones. Cloudflare's own
  [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
  (dashboard, no code change) are the natural next step if this gets real
  traffic.
- **Model IDs may drift.** `GEMINI_MODEL`/`GROQ_MODEL` vars override the
  hardcoded defaults (`recap-worker.js`) without a redeploy if a model gets
  retired or renamed — check each provider's current model list if a call
  starts failing with a "model not found" style error.
- **Deployed URL not configured.** `ResultScreen`'s "Polish with AI" button
  (and the `polishMatchRecap`/`RECAP_WORKER_URL` bare globals it calls, in
  `public/index.html`) are wired in, but `RECAP_WORKER_URL` is left empty
  until this Worker is actually deployed — set it to the deployed URL once
  `wrangler deploy` gives you one. Until then the button still renders and
  works, it just always falls back to the plain (unpolished) draft, exactly
  like a network failure at that URL would.
