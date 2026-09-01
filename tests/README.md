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
- `src/components/*.js` / `tests/unit/components/*.test.js` —
  presentational React components (see `handoff-prompt.md`'s "React
  component extraction" section for the splice mechanism). Rendered with
  `react-test-renderer` (a `devDependency`, pinned to `18.3.1` — the
  exact React version `docs/index.html` loads from CDN, so tests exercise
  the real thing, not a version-skewed stand-in). Unlike the `src/core/`
  modules, files here **do** use real `import`s (`react`, `./theme.js`,
  `./icons.js`, and any already-extracted `src/core/`/sibling
  `src/components/` module a component needs) — stripped the same way at
  splice time, but needed here so a test can actually render the
  component rather than just parse it. A component whose test only needs to
  check its own prop wiring, not a real DOM dependency it uses (e.g.
  `ConfirmModal`, which uses `Modal`), gets a local stub set on
  `globalThis` in that test file instead of a real import — see
  `formUiAtoms.test.js` for the pattern. **A component using `useEffect`
  to start a timer/subscription must be `.unmount()`-ed after each render
  in its test** — react-test-renderer only runs cleanup functions on
  unmount, and a live `setInterval` left running keeps the test process
  alive indefinitely instead of exiting (see `InningsTimer`'s tests in
  `scoringUiAtoms.test.js`).
- `src/components/modal.js` / `tests/unit/components/modal.test.js` —
  `Modal` calls real DOM APIs (`window.visualViewport`, `window.scrollY`/
  `scrollTo`, `document.body.style`, `document.activeElement`,
  `document.addEventListener`) directly in its effects, for scroll-lock
  and focus-trap behavior, so this is the one component test file that
  needs a real DOM: `jsdom` (a `devDependency`, pinned to `30.0.1`) is
  installed on `globalThis.window`/`globalThis.document` in `beforeEach`
  and removed in `afterEach`, scoped to this file only — every other test
  file in this suite deliberately runs under plain Node with no DOM.
  Every mount/unmount/interaction is wrapped in `act()` (from
  `react-test-renderer`) — without it, Modal's passive effects can flush
  *after* the test function returns, sometimes inside a later test after
  `afterEach` has already deleted `globalThis.window`. jsdom doesn't
  implement `window.scrollTo()` or a writable `window.scrollY`, and
  `react-test-renderer` doesn't mount refs to real DOM nodes, so the test
  stubs both directly (see the file's own comments for specifics) rather
  than skip the behavior they gate.
- `src/components/matchInsightCards.js` /
  `tests/unit/components/matchInsightCards.test.js` — post-match insight
  charts/cards (`RunRateChart`, `RunsPerOverChart`, `SyncConflictModal`,
  `PlayerOfMatchCard`, `BestFielderCard`). All pure presentational, no DOM
  APIs. The two award-picker cards call `saveMatch` (a Firestore write
  still living in `docs/index.html`, not extracted) from their `pick()`
  handler — one test stubs `globalThis.saveMatch` locally to exercise a
  real "Confirm" click without touching Firebase, same pattern as
  `Modal`'s stub in `formUiAtoms.test.js`.
- `src/components/shareMenus.js` / `tests/unit/components/shareMenus.test.js`
  — `MoveTeamMenu`/`ShareMenu`, two portal popover menus
  (`ReactDOM.createPortal(..., document.body)`, plus
  `getBoundingClientRect`/`window.innerWidth`/`innerHeight` and, for
  `ShareMenu`, `navigator.clipboard`). **The one component test file in
  this repo that renders through real `react-dom` instead of
  `react-test-renderer`** — `react-test-renderer` can't host a portal
  targeting a genuine DOM node (its own reconciler only understands its
  own fake instance tree; confirmed by trying it, which throws
  `parentInstance.children.indexOf is not a function` deep in the commit
  phase). Uses `createRoot` (from the `react-dom`/`react-dom/client`
  `devDependencies`, both pinned `18.3.1`) rendering into a jsdom
  `container`, with `globalThis.ReactDOM` set to the real package so the
  component's own bare `ReactDOM.createPortal` reference resolves, and
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true` to silence React's `act()`
  warning. See the file's own comments for the rest of what's specific to
  testing a portal this way (an async handler's post-`await` state update
  needing its own `act()`, a real `setTimeout` needing to be waited out
  before `afterEach` tears the DOM down, and Node's own read-only
  `navigator` global needing `Object.defineProperty` instead of a plain
  assignment).
- `src/components/scoreboardAtoms.js` /
  `tests/unit/components/scoreboardAtoms.test.js` — three small
  live-scoring display atoms. `OversStrip` (swipeable per-over strip) and
  `FixturePollSummary` (yes/no/maybe tally chips) are pure, no DOM APIs.
  `SyncStatusBanner` reads `navigator.onLine` and `window`'s
  `online`/`offline` events directly — jsdom again, same shape as
  `modal.test.js` (`react-test-renderer` this time, no portal, so no need
  for the real-`react-dom` approach `shareMenus.test.js` needed). Its
  `handleTap` calls `flushPendingWrites` (a Firestore write, still in
  `docs/index.html`, not extracted) — stubbed on `globalThis` the same
  way `saveMatch` was for `matchInsightCards.test.js`.
- `src/components/scorecard.js` / `tests/unit/components/scorecard.test.js`
  — the full ball-by-ball scorecard: `InningScorecard` (one innings'
  batting/bowling tables), `MatchStatsPanel` (tabs between innings plus
  the live-summary card, overs strip, and charts), `ScorecardOverlay`
  (the full-screen sheet wrapping it all with an export/close header),
  plus `PrintReport`/`TournamentPrintReport` (the "print-only" CSS-class
  summary sheets rendered only into the browser's print output).
  All pure presentational, no DOM APIs — built entirely from
  already-extracted `src/components/`/`src/core/` pieces.

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
