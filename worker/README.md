# Recap polish Worker

A small Cloudflare Worker that takes a match recap already built client-side
(`src/core/matchRecap.js`'s `buildMatchRecapDraft`) and asks a hosted LLM to
rephrase it more vividly. Optional by design: if this Worker is never
deployed, or a request to it fails, the app still has a complete, factually
correct recap with zero network dependency.

Two providers, both with a free tier, chosen per request (`provider: "gemini"`
or `"groq"` in the POST body) or via the `DEFAULT_PROVIDER` var:

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

On any failure (missing key, provider error, bad response shape), it returns
`polished: false` with `text` equal to the original `draft` — the caller
always gets back something usable, never a hard error.

## Known gaps (not built here)

- **No rate limiting.** Anyone with the Worker's URL can call it as fast as
  Cloudflare allows, which could burn through a free-tier quota. Cloudflare's
  own [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
  (dashboard, no code change) or a KV-backed counter in the Worker itself are
  both reasonable next steps if this gets real traffic.
- **Model IDs may drift.** `GEMINI_MODEL`/`GROQ_MODEL` vars override the
  hardcoded defaults (`recap-worker.js`) without a redeploy if a model gets
  retired or renamed — check each provider's current model list if a call
  starts failing with a "model not found" style error.
- **Not wired into the app yet.** `public/index.html` doesn't call this
  Worker anywhere — building the "Polish with AI" button and pointing it at
  a deployed Worker URL is a separate follow-up.
