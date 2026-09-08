# Parking lot

Ideas that were discussed and deliberately deferred — not started, not
scheduled, just written down so the context isn't lost. Add a dated entry
per idea; move it out (delete or fold into a real plan doc) once it's
picked up.

## SEO: give crawlers real content instead of the sign-in gate (2026-09-08)

**Problem:** `public/index.html` is a single-file SPA. `<title>` and the
meta description are correct, but the only thing that ever renders in the
DOM — for Googlebot and for a first-time browser visitor alike — is the
sign-in gate (`WelcomeScreen`): a Google sign-in button, "Sign in with
email", "Continue without an account". There's no substantive indexable
text, so the page is thin-content even though the URL indexes fine.

**Rejected approach:** appending a "What's inside" feature list directly
into `WelcomeScreen`, below the existing buttons. Technically worked (see
PR history on branch `claude/handoff-git-instructions-wkwu65`, reverted)
but is a workaround, not a fix — it still couples marketing copy to the
auth-gate component instead of giving crawlers an actual landing page.

**Two real options, not yet chosen:**

1. **Single URL, conditional render (leaning towards this one).** No file
   moves, no `manifest.json`/service-worker changes. `index.html` decides
   what to mount based on how it was opened:
   - Installed PWA (`display-mode: standalone`) → mount the app
     immediately, exactly like today. Zero change for anyone who already
     has it installed.
   - Returning browser visitor (a "has used the app before" flag already
     in `localStorage`) → mount the app immediately, no landing page in
     the way.
   - First-time browser visit or a crawler (no flag, not standalone) →
     render real marketing/landing content (what the app does, feature
     list, screenshots) with an "Open Club Scorer" button that mounts the
     app in place.
   Lowest risk: `manifest.json`'s `start_url`/`scope` and `sw.js`'s
   precache list never change, so nothing breaks for existing installed
   users.

2. **Move the app to `/app/`, real static landing page at `/`.** Cleaner
   long-term separation (marketing site vs. app, like `stripe.com` vs.
   `dashboard.stripe.com`), but `manifest.json` `start_url`/`scope` and the
   service worker precache paths all need updating, and already-installed
   PWAs have a `start_url` baked in at install time pointing at the old
   location — needs a migration path (e.g. a redirect left behind at the
   old URL) so those installs don't break.

Neither is implemented. When this gets picked up, re-check this file
against the then-current `public/index.html`, `public/manifest.json`, and
`public/sw.js` before touching anything — details above (exact component
names, flag names) may have drifted.
