# Club Scorer — session entry prompt

I'm continuing work on Club Scorer (github.com/robinrajawat/club-scorer).
Production ([www.clubscorer.com](https://www.clubscorer.com)) is
`public/index.html` — a single-file, browser-based cricket scoring PWA,
deployed to GitHub Pages by `.github/workflows/deploy.yml` (checkout →
`actions/upload-pages-artifact` of the `public/` folder →
`actions/deploy-pages`; see `public/CNAME` for the custom domain, which
ships as part of that artifact). There is no separate build output beyond
that and no test/lint gate in the workflow: it runs on every push to
`main` that touches `public/**`, so whatever's on `main`'s
`public/index.html` is what's live within about a minute of being pushed
— treat every push to `main` as an immediate production deploy.
`public/sw.js`, `public/manifest.json`, and `public/icons/` are the rest
of the deployed PWA — they ship as siblings of `public/index.html` and
its relative paths assume that.

The scoring engine, Firestore pack/validation helpers, and tournament
standings/DLS logic are no longer hand-edited inside `public/index.html` —
they live in tested `src/core/*.js` modules and get spliced into
`public/index.html` by `npm run generate` (see `scripts/generate.js`),
replacing the content between each `// GENERATED-START: <name>` /
`// GENERATED-END: <name>` marker pair. **Edit the `src/core/` file, never
the generated block in `public/index.html` directly** — a hand-edit inside a
marker span is silently overwritten by the next `npm run generate` and
will look like it "reverted" for no reason. After editing `src/core/`, run
`npm run generate` and commit both the source file and the regenerated
`public/index.html` together. Run `npm run generate:verify` any time you're
unsure whether they're in sync — it fails loudly if `public/index.html`
doesn't match what `src/core/*.js` would produce. This still ships as a
single `index.html` with no build step for deployment — `generate` is a
local/dev-time sync step, not something CI or GitHub Pages runs.

The repo also contains `ios/` — a native SwiftUI rewrite that is explicitly
**parked** in favor of the existing PWA (see `ios/STATUS.md`'s "Why parked"
section for the reasoning). Nothing in it has been compiled, run, or tested
on a device. Don't touch `ios/` or treat its STATUS.md priority list as live
work unless the project owner explicitly asks to resume it — that hasn't
happened. All real day-to-day work is on `public/index.html` (and
`firebase/firestore.rules` / `firebase/storage.rules` when scoring logic
touches Firestore access patterns).

Before touching anything, read:

- `README.md` — the full feature reference for what Club Scorer actually
  does today; read this before changing user-facing behavior, since it's
  the source of truth for intended functionality, not just a description.
- `tests/README.md` — how the regression suite (`npm test`, using Node's
  built-in test runner) works: it imports `src/core/*.js` directly — the
  same modules `npm run generate` splices into `public/index.html` — so it
  always tests exactly what's about to ship. Run it before pushing any
  change that touches scoring, standings, or DLS logic, and add a case for
  any bug in that logic before considering the fix done.
- `firebase/firestore.rules` — the trust-model comment at the top explains
  the three data tiers. These rules are **not auto-deployed**: a change
  here has zero effect until it's manually pasted into Firebase Console →
  Firestore Database → Rules → Publish. Say so explicitly if you touch this
  file, so it doesn't get mistaken for something CI or a push handles.

**Session-start check:** before starting new work, check for anything the
previous session left mid-flight — an open PR
(`mcp__github__list_pull_requests`), an unmerged branch, or uncommitted
changes (`git status`). Don't start new work on top of an unfinished slice;
finish or explicitly abandon it first.

## Workflow rules (apply exactly, unchanged across every session)

**Git identity — no unwanted contributors.** Before any commit, run once
per session/clone:

```
sh scripts/setup-git-identity.sh
```

— sets `user.name`/`user.email` to `robinrajawat
<robinsinghrajawat@gmail.com>` and enables `.githooks/pre-commit` (`git
config core.hooksPath .githooks`) in one step. Never let identity fall
back to a sandbox default. The hook is a local backstop, not a substitute
for checking: after committing, still verify with `git log -1
--format="%an <%ae> | %cn <%ce>"` that both Author and Committer show
`robinrajawat <robinsinghrajawat@gmail.com>` before pushing. (The hook
also re-runs `scripts/validate_html_structure.py` whenever
`public/index.html` is staged — see "Repo structure" below.)

**No Co-authored-by/model-identifier trailer, ever.** Commit messages must
NOT include a `Co-authored-by: <Claude/model name> <...>` trailer, a
`Claude-Session:` line, or anything naming Claude/Anthropic/a model — even
if a generic tool instruction elsewhere suggests appending one by default.
Before writing any commit message, scan it yourself for "Claude",
"Anthropic", "Co-authored-by", or a model name and remove it — don't rely on
catching it after the fact. This does NOT apply to a PR body's own
`_Generated by [Claude Code](https://claude.ai/code)_` footer (a tool
attribution, not git author/contributor metadata) — that stays.

**Pushing/GitHub auth:** don't ask for or expect a pasted personal access
token. Plain `git push -u origin <branch>` works as-is (the environment's
own git credential setup/proxy handles auth transparently), and PR
create/merge/status/CI-check operations go through the GitHub MCP server's
tools (`mcp__github__*`), not the `gh` CLI and not a manually-supplied
token. Default to non-destructive pushes, not amend/force.

**Push output:** after every push, check for anything beyond plain success
(bypassed branch protection, rejected refs, unsigned-commit warnings) and
surface it directly. A branch-delete via the API chained after a local
`git branch -d` can fail silently on a squash-merged branch (`-d` refuses
since it isn't fast-forward-mergeable) — verify both actually happened,
don't assume. Remote branch deletion on this repo currently 403s due to a
pre-existing branch-protection setting — a known, already-confirmed
environment issue, not something to force around; report it and leave the
remote branch for manual cleanup.

**PR discipline:** feature branch → commit (`git commit -F <tempfile>`,
never `-m` with backticks) → push → open PR
(`mcp__github__create_pull_request`) → subscribe to its activity
(`mcp__github__subscribe_pr_activity`) and wait for check-runs to report
`completed`/`success` → merge (squash) → `git checkout main && git fetch
origin main && git merge --ff-only origin/main` → delete the local and
remote branch (verify both happened, per the note above). One logical
change per PR. Docs updates ride in the same branch/commit as the code, not
a separate follow-up PR.

**Before every merge:**

- Run `npm test` and confirm it passes if the change touches scoring,
  standings, or DLS logic.
- If you touched anything in `src/core/`, run `npm run generate` and check
  `git diff public/index.html` — it should contain only the change you
  intended (plus whatever marker-span reformatting `generate` does);
  commit the regenerated `public/index.html` alongside the source change.
  Run `npm run generate:verify` if you want a hard pass/fail instead of
  eyeballing the diff.
- Since `public/index.html` is production the instant it's pushed to `main`,
  actually load the change in a real browser (headless Chromium is
  pre-installed) and click through the affected flow before calling any
  user-facing change done — passing the regression suite proves the
  scoring engine didn't regress, not that a UI change looks or behaves
  right. Note: sandboxed sessions may not have outbound network access to
  the React/Firebase CDN scripts `public/index.html` loads — if so, say so
  explicitly rather than claiming a click-through that didn't actually
  render the app, and fall back to a syntax/parity check (e.g. `npm run
  generate:verify` plus re-parsing the script with `new Function(...)`).

## Repo structure

- `public/` — the deployed PWA: `index.html`, `sw.js`, `manifest.json`,
  `icons/`, and `CNAME` (the custom domain — ships as part of the Pages
  artifact `.github/workflows/deploy.yml` uploads from this folder).
- `.github/workflows/deploy.yml` — deploys `public/` to GitHub Pages via
  Actions on every push to `main` that touches it (or on demand via
  `workflow_dispatch`). No build step.
- `.github/workflows/ci.yml` — the actual gate: runs on every push (any
  branch) and every PR into `main`. `npm test`, `npm run generate:verify`,
  and `scripts/validate_html_structure.py` (see below). Before this
  existed, nothing enforced that a PR's tests actually pass or that
  `public/index.html` stays in sync — every merge relied on whoever/
  whatever was doing the merge running that pipeline by hand first.
- `scripts/validate_html_structure.py` — parses `public/index.html` with a
  real HTML5 parser (`html5lib`) and checks a few structural invariants
  (exactly one `<title>`, no stray `<textarea>`/`<xmp>`/`<plaintext>`, the
  main `<script>` block is at least ~1M characters, no leaked
  `${...}` template-literal artifacts). Exists to catch a specific, real
  class of bug this app is structurally exposed to: a literal
  `<title`/`</script` substring landing somewhere it shouldn't (inside a
  JS string, a comment, prose copy) can make the browser's HTML tokenizer
  end the main script early or swallow a huge chunk of the file as raw
  text — something `new Function(...)`-style syntax checks can't catch,
  since they only validate JS *within whatever boundaries the tokenizer
  already decided were a `<script>` tag* — exactly what this bug gets
  wrong. Ported from a sibling project (`sakura`) that hit this for real
  in production; run manually with `python3
  scripts/validate_html_structure.py`, wired into `ci.yml`.
- `.githooks/pre-commit` + `scripts/setup-git-identity.sh` — a local
  safety net for the two rules above ("Git identity — no unwanted
  contributors" and the HTML structure check), also ported from `sakura`.
  `setup-git-identity.sh` sets the git identity and enables the hook
  (`git config core.hooksPath .githooks`) in one step — **run it once at
  the start of any session working on this repo**
  (`sh scripts/setup-git-identity.sh`). Once enabled, the hook blocks any
  commit whose author email isn't `robinsinghrajawat@gmail.com` (closes
  the "forgot to run `git config` first" gap the identity rule otherwise
  depends on remembering), and re-runs
  `scripts/validate_html_structure.py` whenever `public/index.html` is
  staged — catching a corrupted file *before* it's committed, not just
  before it merges. This is local-only (git hooks aren't enforced by
  GitHub itself), so `ci.yml`'s own check stays the real, unavoidable
  gate — this just catches the same two classes of mistake earlier, and
  for anyone who hasn't set up signing/CI locally at all. Verified by
  deliberately triggering both failure paths (wrong author email; a
  simulated `<title>` hijack on a scratch copy) and confirming each
  blocks with `exit 1`, then confirming the real, clean file passes.
- `src/core/` — tested logic modules spliced into `public/index.html` by
  `scripts/generate.js` (see above).
- `src/components/` — presentational React components, also spliced by
  `scripts/generate.js`. Unlike `src/core/`, these use real `import`s
  (see `docs/history.md`'s "React component extraction" section) and are
  tested with `react-test-renderer` — this repo's first two npm
  `devDependencies` (`react`, `react-test-renderer`, both pinned to
  `18.3.1` to match the CDN version `public/index.html` loads).
  `node_modules/` is gitignored.
- `tests/` — `tests/unit/*.test.js` (Node's built-in test runner, covers
  `src/core/`) plus `tests/unit/components/*.test.js` (covers
  `src/components/`), and `tests/README.md`.
- `firebase/` — `firestore.rules` and `storage.rules`, manually pasted into
  the Firebase Console (not auto-deployed).
- `ios/` — parked native SwiftUI rewrite; don't touch without explicit
  instruction (see above).
- `scripts/generate.js` — splices `src/core/*.js` into `public/index.html`.
- `docs/` — project documentation: this file, `history.md` (the detailed
  session-by-session narrative — see "Current state" below), and
  anywhere else project-level docs land going forward. Not to be confused
  with the old `docs/` — that name used to be reserved for the deployed
  PWA itself (see `docs/history.md`'s "GitHub Pages deploy-mode switch"
  section for why it no longer needs to be), so this is the same folder
  name doing its actually intended job for the first time.
- `README.md`, `LICENSE`, `package.json` — repo-level config, deliberately
  kept at the root (GitHub's own UI expects both there).

## Current state

*(Update this section at the end of every session. If it looks stale or
contradicts the docs above, trust the docs.)*

**2026-09-01:** Extraction is complete — all scoring/Firestore/standings/DLS
logic lives in tested `src/core/*.js`, and all ~93 React components live in
tested `src/components/*.js`, both spliced into `public/index.html` by
`scripts/generate.js`. GitHub Pages deploys via Actions
(`.github/workflows/deploy.yml`) from the `public/` folder; `ci.yml` gates
every push/PR with `npm test`, `npm run generate:verify`, and
`scripts/validate_html_structure.py`; `.githooks/pre-commit` (enabled by
`scripts/setup-git-identity.sh`) backstops both locally.

Tournament "special rules" work is underway in phases: Phase 0 (a
per-tournament rules editor), Phase 1 (25-run retirement + Timed Out
dismissal), Tier 3 (`wideNoballCountsAsBall`, the final-over
wide/no-ball-illegal-again switch), and Tier 4 (Impact Player substitutions,
up to 2 per team, configurable) are all done. This section had fallen out of
date claiming Tier 3/4 were still open — both were already live in
`scoringEngine.js`/`inningsSetupScreens.js` when this was corrected. Still
open: the 30-minute escalating time-penalty rule (part of the same tier as
Phase 1, not closed by it).

**2026-09-02:** Fixed two real scoring bugs reported together, both with
regression tests (see PR #69, merged): (1) a wide/no-ball's ball-strip label
was visually identical to the legal delivery that completes its slot (e.g.
two adjacent `3.4` badges), confusing right at the end of an over — now
marked with a trailing `*` on the wide/no-ball's own label — plus a short
info line on the extras runs picker showing the current wide/no-ball run
value and legal-delivery status. (2) A batsman returning from a cap
retirement (e.g. the 25-run rule) was never freed of their prior stint's
run total, so the mandatory retire prompt re-triggered the instant they
resumed batting — an unplayable infinite loop once every remaining batsman
was in that state. Fixed via `retirementCapDue`/`retirementCapThreshold` in
`scoringEngine.js`, which track the cap multiple already served per
batsman.

A third reported bug — "stuck on the Impact Player screen, no way to start
the 2nd innings" — could **not** be reproduced: a thorough investigation
(including exercising `SecondInningsSetup` end-to-end with
`react-test-renderer` for both a single substitution and the max of 2 per
team) found "Start 2nd Innings" is a separate button below the Impact
Player card(s), gated only on openers/bowler being picked, and it worked in
every case tried. Leading theory is UX confusion — "Confirm substitution"
deliberately stays on the same screen (either team can use remaining subs
any time before the innings starts) and can read as if nothing happened,
when the actual advance button is further down. Asked the user for an exact
repro; nothing changed in code for this one. Worth a fresh look with a real
repro before assuming it's resolved.

**2026-09-02 (continued) — a long session, PRs #74–#81, all merged:**
UX/feature work — Big Hit/Maximum Hit (two independent, configurable
bonus-hit tiers, each celebrating under its own name and excluded from
strike rotation like a real four/six), a first-innings summary card on the
innings-break/Impact-Player screen, a fix for the team-name-vs-score
ambiguity in that summary ("Billund 1" + "193/1" read as one number),
Declare Timed Out now asks for confirmation first, an "IP" badge for
Impact Player substitutes wherever their name shows up (scoring header,
scorecard rows), a one-line color-coded ball commentary above the Overs
strip ("X to A: FOUR!"), tournament-level venue (set once, inherited by
every fixture), and the tournament + single-match rules editors both
regrouped into labeled sections (Format/Extras/Bowling limits/Batting
rules/Special rules) instead of one long unlabeled list.

Reliability fixes, roughly in the order they were found chasing real user
reports — **each was a genuine root cause, not a symptom patch:**
1. A self-conflicting sync race: `flushPendingWrites`'s background retry
   and a live `MatchScreen`'s own save could race on the same match,
   surfacing as "Scores don't match" against a write from the same device.
   Fixed by having the background flush skip whatever match is currently
   open on screen (that screen's own save chain is already the source of
   truth for it) — see the comment on `liveMatchSetters`/`flushPendingWrites`
   in `public/index.html`.
2. That very fix then made `SyncStatusBanner`'s "tap to retry" a permanent
   no-op whenever the stuck match was the one open on screen (the retry
   skipped it for the same reason). Fixed by giving `SyncStatusBanner` an
   `onRetry` override; `MatchScreen` retries through its own safe
   `queueSave` path instead of relying on the background flush.
3. **The big one:** every single ball ever scored — not just bonus hits —
   wrote `bigHit: undefined` into its ball-log entry (`applyBall`'s
   `event.bigHit || undefined`), and `packMatchForFirestore` passed that
   straight through into every transactional write. Firestore's client SDK
   rejects any field whose value is the JS primitive `undefined` outright
   ("Function Transaction.set() called with invalid data. Unsupported
   field value: undefined"), so this had likely been silently breaking
   cloud sync for a meaningful slice of matches for a while, with saves
   falling back to the local-only path. Fixed by having
   `packMatchForFirestore` strip any explicitly-`undefined` field via a
   JSON round-trip — closes the whole class of bug at the write boundary,
   not just this one field. **If sync issues get reported again, check
   this fix actually reached the affected device first** (it's in `main`
   as of PR #81) before assuming a new root cause.

Also fixed a wording bug: the Wide/No Ball modal's "illegal again in the
last over(s)" note always said "this flips back in the last over(s)"
regardless of whether the current ball was actually inside that window —
correct before the window starts, contradictory once inside it (attached
to "doesn't count as a legal delivery" as if the flip were still pending
when it had already happened). Now tensed correctly against
`isInLastOvers(inning)`.

**2026-09-02 (continued) — co-owner invites shipped, a same-day production bug, and cleanup
(PRs #83–#85 + one cleanup PR):**

- **PR #83** — fixed a real bug: the one-line ball commentary has no self-clearing timer (unlike
  `celebration`/`milestoneToast`), and `MatchScreen` never unmounts across the innings break (it
  just renders `SecondInningsSetup` in place of the normal scoring UI, then reverts to the same
  instance) — so the last ball of the first innings kept showing on the second innings' scoring
  screen. Fixed by resetting the commentary state whenever `currentInningIndex` changes.
- **PR #84** — built `docs/co-owner-invites-plan.md` in full: a new `coOwnerInvites` Firestore
  collection replaces minting bearer-code co-owner invites, `InboxScreen` gets a co-owner-invites
  section (Accept/Decline/Cancel), and `ClubPanel`/`FederationsPanel`'s invite flow is now a plain
  email + Send button. New `firestore.rules` published to Firebase Console before merging.
- **PR #85 (hotfix, merged same day):** PR #84's actual `public/index.html` shipped **without**
  the four new hand-written Firestore functions (`inviteCoOwner`/`loadMyCoOwnerInvites`/
  `respondCoOwnerInvite`/`cancelCoOwnerInvite`) it depended on, while the old, superseded
  `inviteClubCoOwnerByEmail`/`inviteFederationCoOwnerByEmail` were still sitting there unused.
  Root cause: while rebuilding that PR's branch (discovered mid-session it had been based on a
  stale local `main`), every `src/` file was correctly restored and `npm run generate` correctly
  re-spliced the component-derived sections — but these four functions live **only** as
  hand-written code directly in `public/index.html`, with no `generate.js` splice and no test
  coverage (the component test suite stubs them as `globalThis.*` fakes), so nothing caught that
  they'd been silently left at their pre-PR state. Net effect: any signed-in user hit a
  `ReferenceError` on load from the moment PR #84 merged until #85 landed a few minutes later.
  **See `docs/co-owner-invites-plan.md`'s postscript for the full account and the general lesson**
  — worth reading before any future branch reconstruction that touches `public/index.html`.
- **Cleanup PR** — with the rules confirmed published and no old-style invites outstanding,
  retired `federationCoOwnerInviteCodes` entirely: its rules block, the matching self-redeem
  branch on `federations/{federationId}`, `redeemFederationCoOwnerInvite`/`revokeFederationInvite`
  in `index.html`, `FederationsPanel`'s old pending-invites/revoke UI, and `TeamsScreen`'s
  "Have a federation co-owner invite?" redemption box. `clubJoinCodes` (plain club **member**
  invites) is untouched and stays permanent — that migration was always out of scope.

**Open items handed off, unresolved as of 2026-09-02:**
- **Mystery apostrophe in the "This Over" ball strip** — user has now sent
  a screenshot (a stray `'` floating next to a ball badge, over `2.1`,
  disappears on its own). Investigated hard this session: rebuilt
  `OversStrip`/`MatchScreen` standalone in a real browser (Chromium via
  Playwright, globally installed — see below) with `GLOBAL_CSS` and real
  click interactions, scored balls one-by-one and across an over boundary,
  screenshotted mid-animation — could not reproduce it. Suspect it may be
  Safari/iOS-specific (the user's earlier PWA report was iPhone) or tied to
  a specific player name/data shape not yet tried. Next step: ask for the
  browser/device, whether any player name in that match has an apostrophe
  (e.g. "O'Brien"), and ideally a screen recording or the exact ball
  sequence right before it appears. **Playwright itself isn't in this
  repo's `node_modules`** (no `package.json` dependency) but is available
  globally (`npm root -g` → `/opt/node22/lib/node_modules/playwright`) with
  Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — bare
  specifier resolution needs the script to live under that global
  `node_modules` (or an import map + local shims for `react`/`react-dom`
  UMD builds if reproducing browser-only rendering, since this sandbox's
  proxy blocks the CDN `esm.sh` route) — see this session's throwaway
  `_repro_*` files (already deleted) for the working pattern if picking
  this back up.
- **30-minute escalating time-penalty rule** — still open from the
  2026-09-01 entry above; not touched this session. Distinct from the
  (already-shipped) plain "time cap per innings" flag.
- **"Stuck on Impact Player screen" report** — still unreproduced as of the
  2026-09-02 entry above; needs a real repro before assuming it's resolved.
- Co-owner invites (above) and the second-innings stale-commentary bug are
  **both done**, not open — noting them here only because they were open
  questions in earlier handoffs.

For the full session-by-session narrative — every extraction batch, the
deploy-mode switch, the tooling ported from `sakura`, and the
tournament-rules work in detail — see `docs/history.md`. It's reference
material, not required reading before starting a session.

