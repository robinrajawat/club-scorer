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
- `src/components/infoScreens.js` /
  `tests/unit/components/infoScreens.test.js` — secondary, mostly-static
  account/info screens: `HelpScreen` (searchable FAQ, using
  `highlightMatch`/`HELP_SECTIONS` — both extracted alongside it since
  neither was used anywhere else), `AboutScreen`, `FeedbackScreen`,
  `SharedLinksScreen`, `BetaTestersScreen`. Most call a not-yet-extracted
  Firestore function only from an event handler (`submitFeedback`,
  `onRevokeShareCode`/`onRevokeViewCode` as props) — but
  `BetaTestersScreen` calls `loadBetaRequests`/`loadBetaTesters` from a
  **mount-time** `useEffect`, so its test stubs those on `globalThis`
  *before* rendering and wraps the initial `renderer.create()` itself in
  `act()`, not just later interactions, since the effect's state update
  follows immediately after mount. Also worth knowing: a data literal's
  own bare identifier (`HELP_SECTIONS`' copy interpolates `POLL_TTL_DAYS`
  in a template string) won't show up in a `React.createElement(X` grep
  for dependencies — it only surfaces as a `ReferenceError` once a test
  actually imports and runs the file.
- `src/components/playerModals.js` /
  `tests/unit/components/playerModals.test.js` — `EditPlayerModal` and
  `TransferPlayerModal`. `src/components/miscModals.js` /
  `tests/unit/components/miscModals.test.js` — `FirstLaunchTour` and
  `TournamentShareModal`. Both files reference `Modal` as a bare,
  unimported global (same pattern as `ConfirmModal`), not a real
  `import` — a real import binds the identifier at module load, so
  `globalThis.Modal = StubModal` (the trick every other `Modal`-using
  test uses to avoid jsdom) would silently do nothing and the test would
  hit `Modal`'s real `window`-dependent effects instead. `FirstLaunchTour`
  also needed two more bare-global stubs (`lsSetItem`, `LS_PREFIX`, both
  really from `localStorageOutbox.js`) because its `finish()` calls
  `markTourSeen()` (`appLogic.js`), which calls those — real in
  `docs/index.html`'s single scope, not in `appLogic.js`'s own module
  scope under test. `TournamentShareModal` reads
  `window.location.origin`/`pathname` directly during render, so its
  test stubs a minimal `globalThis.window` object rather than pulling in
  jsdom.
- `src/components/venueAndDateModals.js` /
  `tests/unit/components/venueAndDateModals.test.js` — `VenueEditModal`
  (address search with a club-address shortcut) and `FixtureDateTimeModal`
  (a small custom date/time picker, using `WEEKDAY_LABELS`/`MONTH_LABELS`).
  Same `Modal`-as-bare-global stub pattern. `VenueEditModal`'s address
  search (`searchAddress`, a debounced Nominatim fetch, still in
  `docs/index.html`, not extracted) is gated behind a 400ms `setTimeout`
  and a 3-character minimum — tests exercise the venue-length-under-3
  path and the independent, non-debounced club-address-shortcut path
  without ever reaching that timer, rather than waiting it out or
  risking a leaked timer. `QualificationCalculatorModal` (in
  `miscModals.js`/`miscModals.test.js`) works out the NRR a team needs
  against a tied rival — its test exercises the real
  `computeQualificationTarget` math end to end, not just the component's
  own rendering.
- `src/components/availabilityPollModal.js` /
  `tests/unit/components/availabilityPollModal.test.js` —
  `AvailabilityPollModal`, the team availability-poll sheet
  (list/create/view-responses). Same `Modal`-as-bare-global stub
  pattern. Its `loadTeamPolls` runs from a mount-time `useEffect` (not
  just a handler), so every test stubs it — along with
  `loadPollByCode`/`createAvailabilityPoll`/`deleteAvailabilityPoll`,
  the other bare-global Firestore calls it uses — and wraps the initial
  render in `act()`, same pattern as `BetaTestersScreen`.
- `src/components/upcomingFixtureCard.js` /
  `tests/unit/components/upcomingFixtureCard.test.js` —
  `UpcomingFixtureCard`, the Home-screen fixture card with inline
  date/venue-edit/availability-poll modals and a weather forecast. Two
  mount-time `useEffect`s call `loadFixturePollSummary`/
  `fetchFixtureWeather` (bare-global Firestore/network calls, not
  extracted) — stubbed and wrapped in `act()` the same way as
  `AvailabilityPollModal`/`BetaTestersScreen`. Its own "which team?"
  picker (shown when both fixture sides resolve to a team this person
  manages) uses `Modal` as a bare global too.
- `src/components/tournamentStatus.js` /
  `tests/unit/components/tournamentStatus.test.js` —
  `TOURNAMENT_STATUS_LABELS`/`TOURNAMENT_STATUS_COLORS`, the display
  lookup tables for `tournamentStatus()`'s (`miscHelpers.js`) return
  values; the test checks every status that function can actually
  return has an entry in both.
- `src/components/fixtureRow.js` /
  `tests/unit/components/fixtureRow.test.js` — `FixtureRow`, a sibling
  of `UpcomingFixtureCard` for the tournament fixtures list (rather than
  the Home screen's upcoming-fixtures view). Same shape, same
  `Modal`-as-bare-global and mount-effect-stub patterns.
- `src/components/inningsSetupScreens.js` /
  `tests/unit/components/inningsSetupScreens.test.js` — the first two
  actual screens extracted (`SuperOverOpenersSetup`, `SecondInningsSetup`,
  the between-innings opener-picker screens). Both call `saveTransition`
  (a bare global wrapping `saveMatch`, a Firestore write, not extracted)
  only from their own button handlers, never during render, so it's
  stubbed on `globalThis` only in the tests that click those buttons —
  no mount-time effect here, unlike the last several batches.
- `src/components/searchAndRequestPanel.js` /
  `tests/unit/components/searchAndRequestPanel.test.js` — a generic
  "search a directory, then request/link to a result" panel (reused for
  club-to-federation and player-transfer flows). All Firestore access
  (`onSearch`/`onRequest`) is passed in as props, not a bare global, so
  no stubbing is needed at all.
- `src/components/authActionScreen.js` /
  `tests/unit/components/authActionScreen.test.js` — the landing screen
  for a Firebase Auth email action link (reset password, verify email,
  undo an email change). `auth` (the Firebase Auth SDK instance, a bare
  global, not extracted) is called directly from a mount-time
  `useEffect`, so every test stubs it and wraps the initial render in
  `act()`; `sendPasswordReset` (also a bare global) is only ever called
  from the "resend" button's handler.
- `src/components/playingXIPicker.js` /
  `tests/unit/components/playingXIPicker.test.js` — `PlayingXIPicker`,
  the squad-to-playing-XI picker (with optional captain/keeper/jersey-
  number controls, and a search box once the squad exceeds 15). Every
  callback is a prop, no bare globals at all.
- `src/components/myTeamsScreen.js` / `tests/unit/components/myTeamsScreen.test.js`
  — `MyTeamsScreen`, the merged personal-and-club teams list. Every
  write action is a prop too; its one Firestore-adjacent piece
  (`AvailabilityPollModal`, for "poll availability") is already its own
  tested module, so the one test that opens it just needs the same
  `Modal`/`loadTeamPolls` stubs `availabilityPollModal.test.js` already
  established.
- `src/components/followTournamentScreen.js` /
  `tests/unit/components/followTournamentScreen.test.js` —
  `FollowTournamentScreen`, the read-only public standings/fixtures view
  opened via a `?tournament=CODE` link. Calls
  `db.collection("tournamentViews").doc(code).get()` directly from a
  mount-time `useEffect` — the first extraction to stub the raw
  Firestore SDK instance itself (`db`, a bare global, not extracted)
  rather than one of the app's own wrapper functions; the stub is a
  small mock object with a `.collection().doc().get()` chain resolving
  to a mock snapshot (`.exists`/`.data()`).
- `src/components/pollRespondScreen.js` /
  `tests/unit/components/pollRespondScreen.test.js` —
  `PollRespondScreen`, the public availability-poll response screen
  opened via a poll link. `loadPollByCode` runs from a mount-time
  `useEffect` and `submitPollResponse` from the submit handler — both
  bare globals, not extracted, stubbed the same way
  `availabilityPollModal.test.js` stubs them.
- `src/components/screenAtoms.js` (`NavWrap` case, in the same
  `tests/unit/components/screenAtoms.test.js`) — the screen-transition
  wrapper. No bare globals; the test just checks it renders its children
  and switches which CSS animation it applies based on `direction`.
- `src/components/icons.js` (`Cap`, folded into the existing icon set) —
  no dedicated test, matching the file's established convention: icons
  are pure/stateless leaves covered only transitively, through whatever
  screen renders them.
- `src/components/welcomeScreen.js` /
  `tests/unit/components/welcomeScreen.test.js` — `WelcomeScreen`, the
  signed-out landing screen (Google sign-in, email sign-in/sign-up/
  reset, or continue without an account). `signUpEmail`/`signInEmail`/
  `sendPasswordReset` are bare-global Firebase Auth wrappers, called
  only from the email-submit handler — never during render or a mount
  effect — so each test just stubs the one it needs, no `act()`-wrapped
  mount required.
- `src/components/seriesDetailScreen.js` /
  `tests/unit/components/seriesDetailScreen.test.js` —
  `SeriesDetailScreen`, the "series" detail screen (teamA vs teamB over
  N fixtures, e.g. a 3-match ODI series). `loadTournamentMatches` runs
  from a mount-time `useEffect`; it also renders one `FixtureRow` per
  fixture, so tests additionally stub `FixtureRow`'s own `Modal`/
  `loadFixturePollSummary` bare globals — reusing `fixtureRow.test.js`'s
  own setup. Uses `computeSeriesScore` from `src/core/appLogic.js` (not
  a new export — see the note in `handoff-prompt.md` about not
  re-extracting a function that's already inside an existing module
  splice).
- `src/components/inboxScreen.js` /
  `tests/unit/components/inboxScreen.test.js` — `InboxScreen`, the
  combined inbox (availability polls awaiting a response, plus club-
  federation affiliation requests). No mount effect and every write
  action is a prop; the one test that opens `AvailabilityPollModal`
  (tapping a poll item) stubs `Modal`/`loadTeamPolls`/`loadPollByCode`
  the same way `availabilityPollModal.test.js` does.
- `src/components/resultScreen.js` /
  `tests/unit/components/resultScreen.test.js` — `ResultScreen`, the
  match-complete screen. `saveTransition`/`saveMatch`/`loadMatch` are
  bare globals called only from button handlers, so each test stubs
  just what its action needs; `ConfirmModal`'s own `Modal` bare global
  also needs stubbing for the "Fix a mistake" test. First
  already-extracted screen to render `ShareMenu` directly — since
  `ShareMenu` only creates its `ReactDOM.createPortal` once its popover
  is actually open, mounting it closed is fine under
  `react-test-renderer`; tests exercise `onGetCode`/`onGetViewCode` by
  grabbing the `ShareMenu` element (`findByType(ShareMenu)`) and calling
  those props directly, without ever opening the popover (that's
  `shareMenus.test.js`'s job).
- `src/components/playersScreen.js` /
  `tests/unit/components/playersScreen.test.js` — `PlayersScreen`, the
  public player directory. Both mount effects call props
  (`onLoadPublicPlayers`/`onComputeCareerStats`), not bare globals, so
  no Firestore stubbing anywhere; the only stub needed is `Modal`, for
  the tests that open `ConfirmModal`/`EditPlayerModal`/
  `TransferPlayerModal`.
- `src/components/followScreen.js` /
  `tests/unit/components/followScreen.test.js` — `FollowScreen`, the
  public live match-following page. Subscribes via
  `db.collection("liveViews").doc(code).onSnapshot(onNext, onError)` —
  a new stubbing shape (a fake `onSnapshot` that captures the success/
  error callbacks and returns a tracked unsubscribe function, rather
  than resolving a one-shot promise); tests drive updates by calling
  the captured `onNext`/`onError` directly. Celebration/milestone-toast
  tests call `onNext` twice and check `BallCelebration`/
  `MilestoneToast`'s own props via `findByType`.
- `src/components/authBar.js` / `tests/unit/components/authBar.test.js`
  — `AuthBar`, the account button + popover menu in the app header.
  Like `ShareMenu`/`MoveTeamMenu`, its menu only calls
  `ReactDOM.createPortal(..., document.body)` once open, so this test
  file uses the same real react-dom+jsdom rendering `shareMenus.test.js`
  established, not `react-test-renderer`. Also stubs `Modal` (a
  separate bare global) for the sign-out `ConfirmModal`.
- `src/components/feedbackInboxScreen.js` /
  `tests/unit/components/feedbackInboxScreen.test.js` —
  `FeedbackInboxScreen`, the admin-only feedback/crash-report inbox.
  `loadFeedback` runs from a mount-time `useEffect`;
  `updateFeedbackStatus`/`updateFeedbackPriority`/`deleteFeedback` are
  bare globals from button handlers, stubbed per test.
  `navigator.clipboard.writeText` (for "Copy prompt") uses the same
  `Object.defineProperty` workaround for Node's read-only `navigator`
  as `shareMenus.test.js`. Several action buttons only render once a
  row is expanded, so most tests click the row header first.
- `src/components/recordsScreen.js` /
  `tests/unit/components/recordsScreen.test.js` — `RecordsScreen`, a
  club's/federation's Record Book. `loadFederationTournaments`/
  `loadClubTournaments`/`loadTournamentMatches` all run together from
  one mount-time `useEffect`; `downloadMultiSectionCSV` is stubbed only
  in the export test. Also imports `ISO_DATETIME_RE` from
  `shareAndFormat.js` and sets it on `globalThis` — `appLogic.js`'s
  `computeTournamentPlacement` references it as a bare global, and this
  is the first test file to actually exercise that code path.
- `src/components/fixturesSection.js` /
  `tests/unit/components/fixturesSection.test.js` — `FixturesSection`,
  a tournament's schedule tab. No bare globals of its own (every write
  is `onUpdateTournament`); each rendered fixture goes through
  `FixtureRow`, so its `Modal`/`loadFixturePollSummary` stubs are
  needed too. The knockout-proposal test exercises a real
  `computeStandings`/`applicableKnockoutStages`/`BRACKET_SEED_PAIRS`
  round trip with an actual completed match. The champion banner
  renders `champion` and `" won the tournament"` as two separate JSX
  children, so its assertion matches
  `/"Riverside CC"," won the tournament"/`, not a plain substring.
- `src/components/tournamentsScreen.js` /
  `tests/unit/components/tournamentsScreen.test.js` —
  `TournamentsScreen`, the "Cups" list (source chips, create-tournament
  with an optional group split, create-series, status/search filter).
  Every write is a prop; the only bare global is `Modal`, for the
  create-series dialog.
- `src/components/tournamentDetailScreen.js` /
  `tests/unit/components/tournamentDetailScreen.test.js` —
  `TournamentDetailScreen`, a single tournament's own screen (schedule/
  standings/stats/matches tabs, Player of the Tournament, Orange/Purple
  Cap, share, PDF export, qualification calculator, delete).
  `loadTournamentMatches` runs from a mount-time `useEffect`;
  `downloadCSV` (a bare global, distinct from `RecordsScreen`'s
  `downloadMultiSectionCSV`) is stubbed only in the export test.
  `TournamentShareModal`/`QualificationCalculatorModal`/`ConfirmModal`
  all reference `Modal` as a bare global, so tests that open any of
  them stub it too.
- `src/components/clubPanel.js` / `tests/unit/components/clubPanel.test.js`
  — `ClubPanel`, full club administration (create/join, owner-only
  Manage mode, self-service edit-details form). The sole bare global is
  `searchAddress`, not exercised here. Most of the Manage UI is gated
  on `activeIsOwner && manageOpen`, so tests click "Manage" first; a
  hidden `<input type="file">` for the logo sits ahead of other inputs
  once Manage is open, so tests filter `i.props.type !== "file"`;
  `VisibilitySwitch` is identified by `aria-label`
  ("Make public"/"Make private"), not text; `SearchAndRequestPanel`
  (used for the federation-affiliation search) needs an explicit
  "Search" button click before results appear.
- `src/components/federationsPanel.js` /
  `tests/unit/components/federationsPanel.test.js` —
  `FederationsPanel`, `ClubPanel`'s sibling (create/find-and-request-
  to-join, owner-only Manage mode). No bare globals; "Manage" loads its
  member-club list via three props from its own click handler, not a
  mount effect. Note: `findAllByType("button").find(b => hasText(...))`
  with a loose substring like "Invite" can match the wrong button (e.g.
  "+ Invite a co-owner") when more than one button contains that
  substring — use an exact `b.props.children === "Invite"` match for
  the specific per-result action button instead.

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
