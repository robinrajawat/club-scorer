# Regression suite

```
npm test
```

Run this before pushing any change that touches scoring, standings, or
DLS logic. The tested logic lives in `src/core/` — `docs/index.html` is
generated from those modules (see `scripts/generate.js`), so testing
`src/core/` directly and keeping `docs/index.html` in sync via
`npm run generate` is what tests exactly what's about to ship, without
`docs/index.html` and its logic ever being able to silently drift apart.
Run `npm run generate:verify` to check that they haven't (it fails loudly
if `docs/index.html` doesn't match what `src/core/*.js` would produce).

- `src/core/scoringEngine.js` / `tests/unit/scoringEngine.test.js` —
  the ball-by-ball scoring engine (`newInning`, `applyBall`,
  `ensureBatsman`, `ensureBowler`).
- `src/core/packUtils.js` / `tests/unit/packUtils.test.js` — Firestore
  write-shaping, validation, and read-side normalization
  (`packMatchForFirestore`, `findEmptyKeyPath`,
  `unpackMatchFromFirestore`).
- `src/core/appLogic.js` / `tests/unit/appLogic.test.js` — tournament
  standings and DLS (`computeStandings`, `dlsTarget`,
  `dlsResourcePercent`, `oversLeftTrueDecimal`); the file also carries
  some unrelated app-wide helpers (local-storage prefs, a couple of UI
  hooks) that aren't unit-testable in Node and aren't covered here.
- `src/core/statsAndFixtures.js` / `tests/unit/statsAndFixtures.test.js` —
  round-robin fixture generation, player/club stats aggregation, and the
  Player-of-the-Match / Best-Fielder / Player-of-the-Tournament suggestion
  heuristics.
- `src/core/shareAndFormat.js` / `tests/unit/shareAndFormat.test.js` —
  fixture date/time parsing & formatting, `.ics`/CSV export, and match/poll
  share-text & URL builders (`buildPollUrl`/`buildFollowUrl` read
  `window.location` in the browser but fall back to a relative URL via
  `try`/`catch` anywhere that isn't available, including Node — that
  fallback branch is what's tested here).
- `src/core/miscHelpers.js` / `tests/unit/miscHelpers.test.js` — a
  grab-bag of small, pure helpers: admin-email checks, match/invite
  codes, address/weather formatting, CSV parsing for bulk player import,
  club/federation ownership checks, date labels, tournament status,
  player avatars, over-label parsing, feedback/auth-error copy, and
  `window.location` query-param readers (same try/catch fallback pattern
  as `buildPollUrl`/`buildFollowUrl` above).
- `src/core/liveMatchRegistry.js` / `tests/unit/liveMatchRegistry.test.js`
  — the in-memory registry a background sync uses to update a live-open
  match's `writeSeq` outside React's normal render path. Pure closures
  over a plain object, no DOM.
- `src/core/localStorageOutbox.js` /
  `tests/unit/localStorageOutbox.test.js` — the localStorage-backed match
  index, offline write outbox, and per-match undo history. Every
  localStorage access goes through a `try`/`catch`, which is what makes
  it testable in Node: the bare `localStorage` global throws a
  `ReferenceError` there, caught the same way a real
  `QuotaExceededError` would be — so the test file installs a small
  in-memory `localStorage` polyfill (and, for one case, a throwing one)
  on `globalThis` to exercise the real success and quota-exceeded paths.

`pack-utils`, `scoring-engine`, and `app-logic` are each one contiguous
span of `docs/index.html`, spliced in as a block
(`// GENERATED-START: <name>` / `// GENERATED-END: <name>`).
`statsAndFixtures.js`, `shareAndFormat.js`, `miscHelpers.js`,
`liveMatchRegistry.js`, and `localStorageOutbox.js` (plus
`unpackMatchFromFirestore` in `packUtils.js`) are different: their
functions are scattered as individual, non-contiguous declarations among
`docs/index.html`'s React components, so each one is wrapped in place with
its own `// GENERATED-FN-START: <name>` / `// GENERATED-FN-END: <name>`
pair instead of being physically relocated — see `scripts/generate.js`'s
`FUNCTIONS` list for the pattern to follow when pulling out the next
scattered pure-logic function.

Every case in this suite exists because of a real bug that shipped and
was hard to trace once it did, or because the logic it covers is
high-stakes and had zero coverage — see the comment at the top of each
test file. When you fix a bug in this logic, add a case for it before
considering the fix done.
