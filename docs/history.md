# Club Scorer — session history

This is the detailed, session-by-session narrative behind
`docs/handoff-prompt.md`'s "Current state" summary — every extraction
batch, the bugs hit and fixed along the way, and the reasoning behind past
decisions (the deploy-mode switch, the tooling ported from `sakura`, the
tournament special-rules work). It's reference material: read a section
when you need the "why" behind something in the codebase. It is not
required reading before starting a session — `docs/handoff-prompt.md`
covers everything you need for that.

## Session log

*(Append to this section at the end of every session. If it looks stale or
contradicts `docs/handoff-prompt.md`'s "Current state" summary, trust that
summary — this log is the detailed record behind it, not the other way
round.)*

**2026-09-01: four PRs landed this session.** #2 added this prompt. #3
extracted the scoring engine/Firestore helpers/standings+DLS into tested
`src/core/` modules with a `generate`/`generate:verify` splice-back
pipeline. #4 moved the deploy-served files (`index.html`, `sw.js`,
`manifest.json`, `icons/`, `CNAME`) into a folder then named `docs/` and
`firestore.rules`/`storage.rules` into `firebase/`, since classic GitHub
Pages only served from a repo's root or a folder literally named `docs/`
— the required manual Settings → Pages → source change to `main`/`/docs`
was done and the live site confirmed working. (That folder was later
renamed to `public/` once Pages moved to Actions-based deployment — see
"GitHub Pages deploy-mode switch" below — so every reference to `docs/`
elsewhere in this file describes history, not the current layout.) A
fifth PR extracted
`src/core/statsAndFixtures.js` (round-robin fixture generation, player/club
stats, Player-of-the-Match/Best-Fielder/Player-of-the-Tournament
suggestion) — the first module built from **scattered, non-contiguous**
functions rather than one contiguous span, via the new
`GENERATED-FN-START`/`GENERATED-FN-END` per-function marker mechanism in
`scripts/generate.js` (see `tests/README.md` for how it differs from the
block-based `GENERATED-START`/`GENERATED-END` markers).

A sixth PR extracted `src/core/shareAndFormat.js` (fixture date/time
parsing & formatting, `.ics`/CSV export, match/poll share-text & URL
builders) — 31 more scattered declarations via the same `GENERATED-FN`
mechanism, including two (`buildPollUrl`/`buildFollowUrl`) that read
`window.location` in the browser but fall back to a relative URL via
`try`/`catch` anywhere that isn't available (including Node), so they're
still meaningfully testable there. A seventh PR extracted
`src/core/miscHelpers.js` (admin-email checks, match/invite codes,
address/weather formatting, CSV parsing for bulk player import,
club/federation ownership checks, date labels, tournament status, player
avatars, over-label parsing — 24 more declarations) plus
`unpackMatchFromFirestore` into `packUtils.js` alongside its counterpart
`packMatchForFirestore`.

An eighth PR went back through the ~33 remaining functions individually
(each needed its own judgment call, per the note this section used to
carry) and found most were extractable after all: `buildClaudeFixPrompt`/
`accountExistsLinkInfo`/`friendlyEmailAuthError` plus five
`window.location` query-param readers (`getFollowCodeFromUrl` and
siblings — turned out to already have the same `try`/`catch` guard as
`buildPollUrl`, no code change needed) joined `miscHelpers.js`;
`registerLiveMatch`/`unregisterLiveMatch`/`notifyLiveMatchSynced` (a
pure in-memory registry, no DOM at all) became
`src/core/liveMatchRegistry.js`; and the whole localStorage-backed match
index / offline outbox / undo-history cluster (`lsSetItem` and 15 more)
became `src/core/localStorageOutbox.js`, tested against an in-memory
`localStorage` polyfill installed on `globalThis`.

**What's left of the standalone (non-component) functions** — genuinely
not worth extracting, not just unstarted: `ttlTimestamp` (needs the
Firebase SDK global, no Node-side mock exists); `downloadTextFile`/
`downloadCSV`/`downloadMultiSectionCSV` (DOM Blob/anchor-click side
effects, nothing to unit-test); `resizeImageToDataURL`
(FileReader/canvas) and `shareText` (`navigator.share`/clipboard)
(browser-only APIs, side-effecting); `highlightMatch`/`renderMatchCard`
(produce React elements, not data).

## React component extraction (complete)

A ninth PR started pulling the ~93 React components out of
`public/index.html` into `src/components/`, using the same `GENERATED-FN`
per-function marker mechanism — components turned out to need it just
like the scattered functions did (they're not one contiguous span
either), landing 18 of the smallest, purely presentational leaf
components with no test coverage (a disclosed gap at the time — real
component tests need a React test renderer, which this repo hadn't
added, and adding an npm dependency unprompted wasn't this session's
call to make).

A tenth PR closed that gap: **this repo now has its first two npm
`devDependencies`, `react` and `react-test-renderer`, both pinned to
`18.3.1`** — the exact version `public/index.html` loads from CDN, so
tests exercise the real thing rather than a version-skewed stand-in.
`node_modules/` is gitignored (`.gitignore` didn't exist before this —
now it does, just that one line). This changes the pattern for
`src/components/` files specifically, worth knowing before continuing:

- **Component files now use real `import`s** — `import React from
  "react"`, `import { useState, useEffect, useRef } from "react"` where
  hooks are used, `import { COLORS } from "./theme.js"`, icons from
  `./icons.js`, and any already-extracted `src/core/`/sibling
  `src/components/` function a component actually calls (e.g.
  `PlayerAvatar` imports `playerInitials`/`playerAvatarColor` from
  `../core/miscHelpers.js`; `PinnableChip` imports `useLongPress` from
  `../core/appLogic.js`). These imports are stripped the same way as
  always at splice time (`toGlobalScript`'s regex doesn't care what a
  module imports from) — but they're needed now so a *test* can actually
  render the component, not just parse the file.
- **`COLORS` and the whole hand-rolled icon set (`Icon` plus 38 icon
  components, `src/components/theme.js` and `src/components/icons.js`)
  got extracted in this same PR**, specifically to unblock real rendering
  of components that use them — a one-time foundational cost that
  future component batches now just import from, no re-extraction
  needed. `Btn` came along too (`formUiAtoms.js`), since `ConfirmModal`
  needed it to render for real.
- **If a src/core/ function you're now calling for real (not just
  importing) turns out to need a React hook, add the import** —
  `appLogic.js`'s `useLongPress` needed `useRef`, which nothing had
  actually *called* before (earlier tests only imported/asserted on
  plain-logic exports from that file, never one that touches a hook).
  Caught by actually running `PinnableChip`'s render test, not by
  `generate:verify` or the syntax check — neither one calls anything,
  they only reproduce/parse text.
- **A component that still depends on something not yet extracted**
  (e.g. `ConfirmModal` needs `Modal`, which reads
  `window.visualViewport` with no guard — a real DOM dependency, not
  just an ambient global, and a bigger lift than a plain presentational
  leaf) gets a **local stub in its own test file**, set on `globalThis`
  before rendering, rather than a real import or a skipped test — see
  `formUiAtoms.test.js`'s `ConfirmModal` test for the pattern.
- **A component using `useEffect` to start a timer/subscription must be
  `.unmount()`-ed after each render in its test.** Missed this once
  already: `InningsTimer`'s `setInterval` isn't cleared until unmount,
  and `react-test-renderer` doesn't unmount automatically — an
  unmounted instance's live interval kept the whole test process from
  exiting instead of just failing loudly, and only showed up as the
  test run hanging. See `scoringUiAtoms.test.js` for the fix.
- **`generate.js` itself got one hardening fix in this PR**: the
  per-declaration text extraction now appends exactly one trailing
  newline even when the source file has none at all (`\s*$` instead of
  `\s+$` in the replace), so a declaration appended by hand without a
  final newline (exactly what happened extracting `Btn`) can't silently
  glue its closing brace onto the next line's `GENERATED-FN-END` marker
  — caught by the parity diff showing a one-line change instead of
  zero, not by anything more automatic.
- Components can still be extracted in any order/grouping — cross-
  component references don't need to travel together, since every
  component stays reachable as a global at its original textual
  position regardless of which file its own declaration now lives in.

Components extracted so far: `src/components/illustrations.js` (`AppMark`,
`LoadingBallIllustration`, `LoadingNote`, `EmptyStateBallIllustration`),
`src/components/scoringUiAtoms.js` (`RoleBadge`, `BallCelebration`,
`MILESTONE_ICONS`, `MilestoneToast`, `OdometerScore`, `InningsTimer`,
`SwipeableRow`), `src/components/formUiAtoms.js` (`PlayerAvatar`,
`TextField`, `RuleChoice`, `TeamChips`, `PinnableChip`,
`HomeUtilityButton`, `Btn`, `ConfirmModal`), `src/components/theme.js`
(`COLORS`), `src/components/icons.js` (`Icon` + 38 icons),
`src/components/matchDisplayAtoms.js` (`BallBadge`, `VisibilitySwitch`,
`MatchInfoFold`), `src/components/screenAtoms.js` (`Field`,
`InstallHintBanner`, `ClubSourceSelector`), `src/components/tableAtoms.js`
(`StandingsTable`, `RecordTable`), `src/components/pickerAtoms.js`
(`PlayerPicker`, `JoinCodeBar`), `src/components/exportButtons.js`
(`ExportPdfButton`, `ExportTournamentPdfButton`), `src/components/modal.js`
(`Modal`), `src/components/matchInsightCards.js` (`RunRateChart`,
`RunsPerOverChart`, `SyncConflictModal`, `PlayerOfMatchCard`,
`BestFielderCard`), `src/components/shareMenus.js` (`MoveTeamMenu`,
`ShareMenu`), `src/components/scoreboardAtoms.js` (`OversStrip`,
`FixturePollSummary`, `SyncStatusBanner`), `src/components/scorecard.js`
(`InningScorecard`, `MatchStatsPanel`, `ScorecardOverlay`, `PrintReport`,
`TournamentPrintReport`), `src/components/infoScreens.js`
(`highlightMatch`, `HELP_SECTIONS`, `HelpScreen`, `AboutScreen`,
`FeedbackScreen`, `SharedLinksScreen`, `BetaTestersScreen`),
`src/components/playerModals.js` (`PLAYER_ROLES`, `PLAYER_HANDS`,
`EditPlayerModal`, `TransferPlayerModal`), `src/components/miscModals.js`
(`TOUR_SLIDES`, `FirstLaunchTour`, `TournamentShareModal`,
`QualificationCalculatorModal`), `src/components/venueAndDateModals.js`
(`VenueEditModal`, `WEEKDAY_LABELS`, `MONTH_LABELS`, `FixtureDateTimeModal`),
`src/components/availabilityPollModal.js` (`AvailabilityPollModal`),
`src/components/upcomingFixtureCard.js` (`UpcomingFixtureCard`),
`src/components/tournamentStatus.js` (`TOURNAMENT_STATUS_LABELS`,
`TOURNAMENT_STATUS_COLORS`), `src/components/fixtureRow.js` (`FixtureRow`),
`src/components/inningsSetupScreens.js` (`SuperOverOpenersSetup`,
`SecondInningsSetup`), `src/components/searchAndRequestPanel.js`
(`SearchAndRequestPanel`), `src/components/authActionScreen.js`
(`AuthActionScreen`), `src/components/playingXIPicker.js`
(`PlayingXIPicker`), `src/components/myTeamsScreen.js` (`MyTeamsScreen`)
— all now with real `tests/unit/components/*.test.js` coverage, except `ConfirmModal` (tests
its own prop wiring against a stubbed `Modal`, not `Modal` itself) and
`exportButtons.js` (tests rendering/state only — both buttons call
`window.print()`/`document.title` from inside their `onClick` handler,
never during render, so they're safely renderable without a DOM stub, but
clicking them isn't exercised). `modal.test.js` and `scoreboardAtoms.test.js`
(for `SyncStatusBanner`) test real DOM behavior via jsdom, and
`shareMenus.test.js` renders through real `react-dom` rather than
`react-test-renderer` — see below.

Every batch since `matchDisplayAtoms.js`/`screenAtoms.js` has picked
components specifically chosen to be fully renderable using only
already-extracted pieces (e.g. `PlayerPicker` imports `RoleBadge` from
`scoringUiAtoms.js` and `TextField` from `formUiAtoms.js`) — components
that pull in siblings still living in `public/index.html` (e.g.
`ScorecardOverlay` needs `MatchStatsPanel`, which itself needs
`RunRateChart`/`RunsPerOverChart`/`OversStrip`, none extracted yet) are
set aside for a batch where those siblings come along too, rather than
extracted with an untested/unstubbed dependency. `ExportPdfButton` is
now available for whenever `ScorecardOverlay` is tackled.

**`Modal` was extracted in an eleventh PR**, to `src/components/modal.js`,
closing the gap the previous paragraph used to describe. Unlike
`ConfirmModal` (which only *uses* `Modal`, so a stub was enough), `Modal`
itself calls real DOM APIs directly in its body and effects —
`window.visualViewport`, `window.scrollY`/`scrollTo`, `document.body`,
`document.activeElement`, `document.addEventListener` — for scroll-lock
and focus-trap behavior, so this repo now has its third npm
`devDependency`, **`jsdom` (pinned `30.0.1`)**, used only by
`tests/unit/components/modal.test.js`. That file installs a real
`JSDOM`-backed `window`/`document` on `globalThis` in `beforeEach` and
deletes them in `afterEach`, so no other test file (which all
deliberately run under plain Node with no DOM) is affected. Notes for the
next DOM-dependent component:

- **Every mount/unmount/state-changing interaction must go through
  `act()`** (imported from `react-test-renderer`) — Modal's effects run
  as passive effects, not synchronously with `renderer.create()`, so
  without `act()` they can flush *after* the test function returns,
  sometimes inside a *later* test after `afterEach` has already deleted
  `globalThis.window` (surfaced as a `ReferenceError: window is not
  defined` thrown from inside React's own commit phase, in a test that
  otherwise looked unrelated).
- **jsdom doesn't implement `window.scrollTo()`** (logs "Not implemented"
  and no-ops) and `window.scrollY` is a read-only getter that stays `0` —
  stub both directly (`Object.defineProperty(window, "scrollY", ...)`,
  reassign `window.scrollTo`) to exercise the real save/restore logic
  rather than skip it.
- **`react-test-renderer` doesn't mount to a real DOM**, so a ref like
  `Modal`'s `sheetRef` is `null` by default and a real-DOM-only effect
  (`sheetRef.current.focus()`) silently no-ops. Pass `createNodeMock` to
  `renderer.create(element, { createNodeMock })` to hand back a real,
  `document.body`-attached, `tabindex`-bearing element for the ref to
  focus for real.
- `window.visualViewport` isn't implemented by jsdom either — tested via
  a small hand-rolled stub object (`{ height, addEventListener,
  removeEventListener }`) assigned directly to `window.visualViewport`,
  covering both the with- and without-the-API code paths.

A twelfth PR picked off five more components with no dependency on any
not-yet-extracted sibling: `src/components/matchInsightCards.js`
(`RunRateChart`, `RunsPerOverChart` — pure SVG charts, no DOM APIs at all;
`SyncConflictModal` — builds its own overlay rather than using `Modal`,
so needed no DOM stub either; `PlayerOfMatchCard`/`BestFielderCard` — the
two post-match award-picker cards). The two award cards call `saveMatch`
(a Firestore write, still in `public/index.html`, unextracted — needs the
Firebase SDK global) from their `pick()` handler; rather than leave that
untested, one test stubs `globalThis.saveMatch` locally (same pattern as
`Modal` in `formUiAtoms.test.js`) to exercise a real "Confirm" click.

A thirteenth PR took on `MoveTeamMenu`/`ShareMenu`
(`src/components/shareMenus.js`) — the two portal popover menus flagged
above. They confirmed a real limit of `react-test-renderer` worth
knowing before reaching for it again: **`react-test-renderer` cannot
host a portal whose target is a real DOM node.** `ReactDOM.createPortal`
still runs (it's just a function call), but react-test-renderer's own
reconciler manages its own fake "instance" tree and has no host-config
path for mutating a genuine `document.body` — trying it throws
`parentInstance.children.indexOf is not a function` deep in its commit
phase. So these two are the one pair of component tests in this repo
that render through **real `react-dom`** (`createRoot` from
`react-dom/client`, into a jsdom `container` appended to `document.body`)
instead of `react-test-renderer` — this repo's fourth and fifth npm
`devDependencies`, `react-dom` and (already covered above) `jsdom`, both
still pinned to the same versions as `react`/`react-test-renderer`. Notes
for next time a portal-based component comes up:

- `globalThis.ReactDOM = ReactDOM` (the real npm package) so the
  component's own bare `ReactDOM.createPortal` reference resolves —
  same ambient-global pattern as everywhere else, just backed by the
  real thing instead of react-test-renderer's stand-in.
- `globalThis.IS_REACT_ACT_ENVIRONMENT = true` silences React's "not
  configured to support act()" warning; interact through real DOM
  events (`el.dispatchEvent(new window.MouseEvent("click", { bubbles:
  true }))`) wrapped in `act()`, same discipline as `modal.test.js`.
- An `async` handler's state update *after* its own `await` lands in a
  later microtask, outside a synchronous `act(() => {...})` — wrap
  those specific interactions in `await act(async () => { ...;  await
  new Promise(r => setTimeout(r, 0)); })` instead, so the update is
  still inside `act()` when it runs.
- A real `setTimeout` a component itself schedules (`ShareMenu`'s
  `flashCopied`, a 1.5s "Copied!" flash) will otherwise fire *after*
  the test — and this file's `afterEach` — has already torn
  `globalThis.window` down, throwing `ReferenceError: window is not
  defined` from inside React's scheduler. Wait it out for real inside
  the test (`await act(async () => { await new Promise(r =>
  setTimeout(r, 1600)); })`) while `window` still exists, rather than
  leave it to fire later into a deleted DOM.
- Node has a built-in read-only `navigator` global (getter-only, no
  setter, since Node 21) — a plain `globalThis.navigator = ...`
  assignment throws; use `Object.defineProperty(globalThis,
  "navigator", { value, configurable: true, writable: true })` instead.
- `react-test-renderer`'s refs are never real DOM nodes, but plain
  `react-dom` refs *are* — no `createNodeMock` needed here, but
  `getBoundingClientRect()` still needs stubbing per-test (jsdom's own
  layout engine always reports zeros), same idea as `Modal`'s
  `createNodeMock` trick, simpler to apply since it's just a method on
  a real element.

A fourteenth PR extracted three more small display atoms into
`src/components/scoreboardAtoms.js`: `OversStrip` (the swipeable
per-over ball-by-ball strip, pure — no DOM APIs), `FixturePollSummary`
(yes/no/maybe availability tally chips, pure), and `SyncStatusBanner`
(the "N matches not synced" banner). `SyncStatusBanner` reads
`navigator.onLine` and `window`'s `online`/`offline` events directly, so
it needed the jsdom pattern — same shape as `Modal`, just `react-test-renderer`
this time (no portal involved, so no need for the real-`react-dom`
approach `shareMenus.test.js` needed). Its `handleTap` calls
`flushPendingWrites` (a Firestore write, still in `public/index.html`, not
extracted), stubbed on `globalThis` the same way `saveMatch` was for
`PlayerOfMatchCard`/`BestFielderCard`.

A fifteenth PR unblocked and extracted the full scorecard:
`ScorecardOverlay` (the full-screen sheet a scorer opens from the match
header) needed `MatchStatsPanel`, which itself needed `InningScorecard`
plus `MatchInfoFold`/`OversStrip`/`RunRateChart`/`RunsPerOverChart` —
all of which the last three batches happened to have already extracted,
so this batch pulled in the two that were still missing
(`InningScorecard`, `MatchStatsPanel`) and `ScorecardOverlay` itself
together, into `src/components/scorecard.js`. Worth remembering:
**re-check a previously-blocked component's dependency list after each
batch** — a component set aside earlier for "needs siblings not
extracted yet" can quietly become extractable once those siblings land
for an unrelated reason, exactly what happened here.

A sixteenth PR added `PrintReport`/`TournamentPrintReport` to the same
`scorecard.js` file — the "print-only" CSS-class summary sheets that
only render into the browser's print output. `PrintReport` reuses
`InningScorecard`, which is why it belongs there rather than its own
file. Both turned out fully self-contained once `matchResultText`/
`tossText`/`umpiresText`/`nonStandardRulesText` (all in
`shareAndFormat.js` already) were the only pieces still missing.

A seventeenth PR extracted the secondary, mostly-static account/info
screens into `src/components/infoScreens.js`: `HelpScreen` (searchable
FAQ — brought `highlightMatch` and its `HELP_SECTIONS` data array along,
since both were only ever used there and had no other reason to stay
behind), `AboutScreen`, `FeedbackScreen`, `SharedLinksScreen` (revoke a
match's active share/view codes), and `BetaTestersScreen` (admin
approve/decline/revoke beta access). Two things worth flagging for
next time: (1) **a data literal's own bare identifiers are easy to miss**
— `HELP_SECTIONS`' copy text interpolates `POLL_TTL_DAYS` in a template
literal, which the usual `React.createElement(X` grep for component/icon
references doesn't catch, and only surfaced as a `ReferenceError` when
the test file actually imported and ran it; (2) `BetaTestersScreen` is
the first screen whose `useEffect` calls a not-yet-extracted Firestore
function (`loadBetaRequests`/`loadBetaTesters`) on **mount**, not just
from an event handler — its test stubs those on `globalThis` before
rendering and wraps the initial render itself in `act()`, not just the
later interactions, since the effect's state update happens right after
mount.

An eighteenth PR noticed that `Modal` landing (PR #14) quietly unblocked
a whole cluster of `Modal`-wrapped screens that had nothing left
stopping their extraction, and took the smaller half of that cluster:
`src/components/playerModals.js` (`PLAYER_ROLES`, `PLAYER_HANDS`,
`EditPlayerModal`, `TransferPlayerModal`) and
`src/components/miscModals.js` (`TOUR_SLIDES`, `FirstLaunchTour`,
`TournamentShareModal`). Three things worth carrying forward:

- **New `Modal`-using files should keep referencing `Modal` as a bare,
  unimported global, not a real `import { Modal } from "./modal.js"`**
  — a real import binds the identifier at module load, so
  `globalThis.Modal = StubModal` (the established no-jsdom testing
  trick) silently has no effect and the test hits `Modal`'s real
  `window`-dependent effects instead, with a `ReferenceError: window is
  not defined` the first sign something's wrong. `ConfirmModal` in
  `formUiAtoms.js` got this right from the start (per its own comment);
  these two files initially imported for real and had to be walked
  back once the tests explained why.
- **A cross-module bare-global reference can go two levels deep and
  still need stubbing.** `FirstLaunchTour`'s `finish()` calls
  `markTourSeen()` (`src/core/appLogic.js`), which itself calls
  `lsSetItem`/reads `LS_PREFIX` — both bare globals belonging to
  `localStorageOutbox.js`, real in `public/index.html`'s single scope but
  not in `appLogic.js`'s own module scope under test. Its test stubs
  both on `globalThis` before clicking anything that reaches `finish()`.
- `TournamentShareModal` reads `window.location.origin`/`pathname`
  directly during **render**, not just from a handler — its test stubs
  a minimal `globalThis.window = { location: { origin, pathname } }`
  rather than pulling in jsdom, since nothing else in the file touches
  a real DOM API.

A nineteenth PR finished the rest of that `Modal`-unblocked cluster:
`src/components/venueAndDateModals.js` (`VenueEditModal`,
`WEEKDAY_LABELS`, `MONTH_LABELS`, `FixtureDateTimeModal`) and, appended
to `miscModals.js`, `QualificationCalculatorModal`. `VenueEditModal`'s
own address search (`searchAddress`, a debounced Nominatim fetch,
still in `public/index.html`, not extracted — network-touching and
side-effecting) is gated behind a 400ms `setTimeout` and a 3-character
minimum; its tests exercise the venue-length-under-3 path and the
independent club-address-shortcut path (computed with no debounce at
all) without ever reaching that timer, since triggering it for real
would mean either waiting out 400ms per test or risking a leaked timer
if a test doesn't unmount before it fires — the same category of
disclosed gap as `ExportPdfButton`'s untested click, just for a fetch
instead of `window.print()`.

`UpcomingFixtureCard` now only needs `AvailabilityPollModal` to be
fully unblocked (it needs `FixtureDateTimeModal`/`VenueEditModal`/
`AvailabilityPollModal`/`FixturePollSummary`, and the first, second, and
fourth are now all extracted).

A twentieth PR finished the `Modal`-unblocked cluster entirely:
`src/components/availabilityPollModal.js` (`AvailabilityPollModal` —
the team availability-poll sheet: list/create/view-responses, ~470
lines). Its `loadTeamPolls` runs from a mount-time `useEffect`, same
stubbing pattern as `BetaTestersScreen`. This was also the last
dependency `UpcomingFixtureCard` needed (`FixtureDateTimeModal`/
`VenueEditModal`/`AvailabilityPollModal`/`FixturePollSummary` are now
all extracted), so it's unblocked and ready for its own batch next.

A twenty-first PR extracted `UpcomingFixtureCard` itself
(`src/components/upcomingFixtureCard.js`) — the Home-screen fixture
card with inline date/venue-edit/availability-poll modals and a weather
forecast. Two mount-time `useEffect`s call not-yet-extracted
Firestore/network functions (`loadFixturePollSummary`,
`fetchFixtureWeather`), stubbed the same way as `AvailabilityPollModal`/
`BetaTestersScreen`; its own "which team?" picker uses `Modal` as a bare
global too.

A twenty-second PR picked up the remaining small leftovers:
`src/components/tournamentStatus.js` (`TOURNAMENT_STATUS_LABELS`,
`TOURNAMENT_STATUS_COLORS`) and `src/components/fixtureRow.js`
(`FixtureRow` — a sibling of `UpcomingFixtureCard` for the tournament
fixtures list, same shape and same jsdom-free `Modal`-stub pattern).

**`renderMatchCard` turned out not to be independently extractable**,
worth recording so it isn't attempted the same way again: despite
sitting at column 0 with no visible indentation (an artifact of
whatever produced this file, not a reliable signal), it's a function
declared *inside* `HomeScreen`'s own body, closing over `HomeScreen`'s
local state and props (`onOpen`, `tournamentNameById`,
`setConfirmDeleteId`, `setShowSwipeHint`, `onGetShareCode`,
`onGetViewCode`) rather than receiving them as parameters. Extracting
it alone would need those closed-over names turned into explicit
parameters — a real (if small) behavior-preserving refactor of every
call site inside `HomeScreen`, not the same kind of verbatim
lift-and-splice this session has done everywhere else. It has to come
out together with `HomeScreen` itself, or as a deliberate refactor
pass, not as its own quick batch.

A twenty-third PR extracted the first two actual screens:
`src/components/inningsSetupScreens.js` (`SuperOverOpenersSetup`,
`SecondInningsSetup` — the between-innings opener-picker screens,
~107/~193 lines, the two smallest of what's left). Confirms the pattern
for the screens ahead: both call `saveTransition` (a bare global,
wraps `saveMatch`, a Firestore write, not extracted) only from their
own button handlers, never during render, so it needed stubbing only
in the tests that actually click those buttons — no mount-time effect
this time, a bit simpler than the last several batches.

A twenty-fourth PR extracted two more: `src/components/searchAndRequestPanel.js`
(`SearchAndRequestPanel` — a generic "search a directory, then
request/link to a result" panel reused for club-to-federation and
player-transfer flows; its Firestore access is passed in as props, not
a bare global, so no stubbing was needed at all) and
`src/components/authActionScreen.js` (`AuthActionScreen` — the landing
screen for a Firebase Auth email action link). `AuthActionScreen` calls
`auth` (the Firebase Auth SDK instance, a bare global, not extracted)
directly from a mount-time `useEffect`, same stubbing pattern as
`AvailabilityPollModal`/`BetaTestersScreen`.

A twenty-fifth PR extracted `src/components/playingXIPicker.js`
(`PlayingXIPicker` — squad-to-playing-XI picker with optional captain/
keeper/jersey-number controls, every callback a prop, no bare globals
at all) and `src/components/myTeamsScreen.js` (`MyTeamsScreen` — the
merged personal-and-club teams list). `MyTeamsScreen` is a genuinely
clean screen extraction: every write action is a prop too, and its one
Firestore-adjacent piece (`AvailabilityPollModal`, for "poll
availability") is already its own tested module — nothing new to stub
here beyond what that module's own test file already covers.

A twenty-sixth PR extracted two public share-link screens:
`src/components/followTournamentScreen.js` (`FollowTournamentScreen` —
read-only standings/fixtures view opened via a `?tournament=CODE` link)
and `src/components/pollRespondScreen.js` (`PollRespondScreen` — the
public availability-poll response screen opened via a poll link).
`FollowTournamentScreen` reads its snapshot directly via
`db.collection("tournamentViews").doc(code).get()` from a mount-time
`useEffect` — the first extraction to stub the raw Firestore SDK
instance itself (`db`, a bare global, not extracted) rather than one of
the app's own Firestore-wrapper functions; the stub is a small mock
object with a `.collection().doc().get()` chain resolving to a mock
snapshot (`.exists`/`.data()`). `PollRespondScreen` calls
`loadPollByCode` (mount effect) and `submitPollResponse` (submit
handler), both matching the already-established bare-global
Firestore-wrapper stubbing pattern from `AvailabilityPollModal`.
`FollowScreen` (the *live*, `onSnapshot`-subscribed match-following
screen — not to be confused with `FollowTournamentScreen`) was surveyed
and deliberately deferred again: real-time snapshot diffing with
multiple `useRef`s for ball-celebration/milestone toasts is a
meaningfully different, harder case than either of this batch's two
screens and deserves its own dedicated batch.

A twenty-seventh PR extracted three more, closing out the last of the
small/presentational leftovers before the remaining large screens:
`Cap` (an icon — folded into the existing `src/components/icons.js`)
and `NavWrap` (the screen-transition wrapper — folded into the existing
`src/components/screenAtoms.js`), plus the first real signed-out screen,
`src/components/welcomeScreen.js` (`WelcomeScreen` — Google/email
sign-in, sign-up, and password reset). `WelcomeScreen` calls
`signUpEmail`/`signInEmail`/`sendPasswordReset` (bare-global Firebase
Auth wrappers, not extracted) only from its email-submit handler, never
during render or a mount effect, so no `act()`-wrapped-mount stubbing
was needed — just a plain per-test stub, same shape as
`authActionScreen.test.js`'s `sendPasswordReset` case.

This batch also surfaced a real bug in the splice tooling worth noting
for every future batch that adds a new export to an **existing**
multi-export `src/components/*.js` file (as opposed to a brand-new
file with one export): `scripts/generate.js`'s `findNamedExport` slices
each declaration from its own `export function/const` line up to the
*next* `export` match in the file (or EOF) — so any comment placed
**above** a newly-added export, when that export isn't first in the
file, gets glued onto the end of the *previous* export's spliced text
instead, silently duplicating (and misplacing) the comment in
`public/index.html` at the previous export's location. First caught here
via the mandatory pre-test byte-diff check against the pre-batch
snapshot, before any test was written — exactly what that check exists
to catch. Fixed by dropping the per-export leading comment entirely for
`Cap`/`NavWrap` (matching `icons.js`'s and `screenAtoms.js`'s own
existing convention of no per-function comments, file-level header
only). Rule going forward: never put an explanatory comment directly
above a newly-added export in a file that already has other exports —
either match the file's existing no-per-function-comment convention, or
put the new export first/last with nothing following it in the file if
a leading comment is really wanted.

A twenty-eighth PR extracted `src/components/seriesDetailScreen.js`
(`SeriesDetailScreen` — the "series" detail screen: teamA vs teamB over
N fixtures, e.g. a 3-match ODI series; running score, each fixture via
`FixtureRow`, Player of the Series, delete). `loadTournamentMatches`
(mount-effect, bare global) needed the usual stubbing; since it also
renders one `FixtureRow` per fixture, its tests additionally stub
`FixtureRow`'s own `Modal`/`loadFixturePollSummary` dependencies —
exactly `fixtureRow.test.js`'s own setup, reused here.

This batch also caught a real mistake before it went anywhere near a
commit: `computeSeriesScore` (which `SeriesDetailScreen` calls) and its
own helper `matchWinner` looked like fresh, never-extracted pure logic,
so the first pass added them as new `GENERATED-FN` entries in
`src/core/statsAndFixtures.js`. They aren't new — both already live
inside `src/core/appLogic.js`, part of its **module**-level splice (the
whole `public/index.html` span from `// GENERATED-START: app-logic` to
`// GENERATED-END: app-logic`, lines ~4871–6174, gets replaced wholesale
from `appLogic.js` on every `generate` run). Adding `GENERATED-FN`
markers *inside* a span a module splice already owns doesn't work — the
module replacement wipes them out before the function-level splice ever
runs, and generate.js failed loudly with a clear "could not find
markers" error on the very first `npm run generate` of the batch, before
any test was written. Fixed by dropping the duplicate `GENERATED-FN`
entries and re-pointing `SeriesDetailScreen`'s import of
`computeSeriesScore` at `src/core/appLogic.js`, where it already lived.
**Rule for every future batch:** before wrapping a "new" top-level
function's `public/index.html` declaration in `GENERATED-FN-START`/`END`
markers, grep `src/core/*.js` and `src/components/*.js` for
`export function <name>`/`export const <name>` first — it may already
be part of an existing module or component extraction, especially for
small pure-logic helpers that read as self-contained.

A twenty-ninth PR extracted `src/components/inboxScreen.js`
(`InboxScreen` — the combined "inbox": availability polls waiting on a
response, plus club-federation affiliation requests sent or received).
A genuinely clean extraction: no mount effect at all, every write
action (respond/cancel/complete-join) is a prop, and the one Firestore-
adjacent piece — `AvailabilityPollModal`, opened when a poll item is
tapped — is already its own tested module, so its tests only needed the
same `Modal`/`loadTeamPolls`/`loadPollByCode` stubs
`availabilityPollModal.test.js` already established, not anything new.

A thirtieth PR extracted `src/components/resultScreen.js`
(`ResultScreen` — the match-complete screen: winner banner, share/
export/View-Super-Over actions, Player of the Match / Best Fielder
cards, both innings' scorecards). Its dependency read applied the
lesson from `SeriesDetailScreen`'s batch directly: `newInning` turned
out to already be inside `src/core/scoringEngine.js`'s module splice,
and `captainFor`/`keeperFor`/`numbersFor` inside `src/core/appLogic.js`'s
— both grepped for and confirmed *before* touching `generate.js`, so no
false start this time. `saveTransition`/`saveMatch`/`loadMatch` (bare
globals) are all called from button handlers, never render or a mount
effect, so tests stub only what each exercised action needs. One new
testing wrinkle: this is the first already-extracted screen to render
`ShareMenu` (from `shareMenus.js`) directly and unconditionally.
`ShareMenu`'s popover only creates its `ReactDOM.createPortal` once
`open` is true, so simply mounting the closed button is fine under
`react-test-renderer` — but exercising `ResultScreen`'s own
`onGetCode`/`onGetViewCode` handlers doesn't require opening that
popover at all: the tests grab the `ShareMenu` element via
`findByType(ShareMenu)` and call `.props.onGetCode()` /
`.props.onGetViewCode()` directly, sidestepping the portal entirely
(`ShareMenu`'s own popover behavior is already covered by
`shareMenus.test.js`).

A thirty-first PR extracted `src/components/playersScreen.js`
(`PlayersScreen` — the public player directory: search all players any
club has made public, view one's details/stats, and, for the home
club's owner, edit/transfer/delete). Another genuinely clean
extraction, cleaner even than `InboxScreen`: both mount effects
(loading the public players list, and opening straight to
`initialSelected` when handed one) call props
(`onLoadPublicPlayers`/`onComputeCareerStats`), not bare globals, so no
Firestore stubbing was needed anywhere — the only stub any test needed
was `Modal`, for the three tests that open `ConfirmModal`/
`EditPlayerModal`/`TransferPlayerModal`.

A thirty-second PR finally took on `FollowScreen` (`src/components/followScreen.js`)
— the public *live* match-following page (distinct from
`FollowTournamentScreen`'s one-time snapshot read), deferred twice
earlier in this session for its real-time complexity. Subscribes via
`db.collection("liveViews").doc(code).onSnapshot(onNext, onError)` — a
new stubbing shape, since every prior mount-effect Firestore call in
this session was a one-shot `.then()`/`.get()`. The stub's fake
`onSnapshot` captures the success/error callbacks instead of resolving
a promise, so tests drive updates by calling the captured callback
directly with a fake snapshot (`{ exists, data() }`), and the stub
returns an unsubscribe function whose call is tracked too (confirmed
called on unmount). The screen infers boundary/wicket celebrations and
milestone toasts by diffing each new snapshot against the previous one
(ball count +1 and the last ball's kind/runs; `toastMilestones` array
growing) rather than reacting to a specific scoring event — tests for
this call the captured `onNext` twice in a row and check
`BallCelebration`/`MilestoneToast`'s own `celebration`/`toast` props
directly via `findByType`, confirming the first snapshot never
celebrates (nothing to diff against yet) and the second one does.

A thirty-third PR extracted `src/components/authBar.js` (`AuthBar` —
the account button in the app header: "Sign in" or an avatar, opening a
popover menu for account/shared-links/sign-out, theme toggle, help/
feedback/about, and a "buy me a coffee" link). Like `ShareMenu`/
`MoveTeamMenu`, its menu calls `ReactDOM.createPortal(..., document.body)`
(a bare global) only once open, so it needed the real react-dom+jsdom
rendering `shareMenus.test.js` already established rather than
`react-test-renderer`. Every write action is a prop; the only bare
global besides `ReactDOM` itself is `Modal` (for the sign-out
`ConfirmModal`). One easy test mistake caught and fixed here: the menu
header shows the *first name only* (`label`, split off `displayName`),
not the person's full name — a test asserting on `"Robin Singh"`
correctly failed until narrowed to `"Robin"`.

A thirty-fourth PR extracted `src/components/feedbackInboxScreen.js`
(`FeedbackInboxScreen` — the admin-only feedback/crash-report inbox:
filter by kind/status, expand a row for its full details, cycle
priority/status, jot a private resolution note, copy a ready-to-paste
Claude fix prompt, or delete). `loadFeedback` runs from a mount-time
`useEffect`; `updateFeedbackStatus`/`updateFeedbackPriority`/
`deleteFeedback` (bare globals) are called from their respective button
handlers. `navigator.clipboard.writeText` needed the same
`Object.defineProperty` workaround for Node's read-only `navigator`
global other tests in this suite already use. One easy layout mistake
caught early: several action buttons (priority/status/copy/delete) only
render once a row is expanded — three tests initially failed trying to
find them before clicking the row header to open it first.

A thirty-fifth PR extracted `src/components/recordsScreen.js`
(`RecordsScreen` — a club's/federation's "Record Book": career
milestones, umpire appearance counts, one placement per tournament,
an all-time/current-year tab, a team filter, a player-name search, and
a CSV export). `loadFederationTournaments`/`loadClubTournaments`/
`loadTournamentMatches` all run together from a single mount-time
`useEffect`; `downloadMultiSectionCSV` (also a bare global — builds via
the already-extracted `multiSectionCSV` then triggers a real download,
neither itself extracted) is stubbed only in the export test. Two build
mistakes caught by the mandatory pipeline before any test ran:
`safeFilenamePart` was imported from the wrong file
(`statsAndFixtures.js` instead of `shareAndFormat.js`, where it
actually lives — `npm run generate` failed immediately with a clear
"does not provide an export" error) and `computeTournamentPlacement`
(already inside `appLogic.js`'s module) itself references
`ISO_DATETIME_RE` as a bare global from `shareAndFormat.js` — genuine
in `public/index.html`'s single script scope, but undefined under Node
until the test file explicitly imports and sets it on `globalThis`, the
first time any test has exercised that particular code path.

A thirty-sixth PR extracted `src/components/fixturesSection.js`
(`FixturesSection` — a tournament's schedule tab: generate/add group-
stage fixtures, propose each knockout round once the previous one is
decided, a freeform "Playoffs" section for manually-added custom-stage
fixtures, and a champion banner). A genuinely clean extraction on the
Firestore front — every write action is `onUpdateTournament`, no bare
globals, no mount effect of its own — but the most logic-heavy
component tested so far: exercising the knockout-proposal path needed a
real `computeStandings`/`applicableKnockoutStages`/`BRACKET_SEED_PAIRS`
round trip (all already inside `appLogic.js`'s module) with an actual
completed match to seed the Final from. One test-writing snag: the
champion banner renders `champion` and `" won the tournament"` as two
separate JSX children, not one concatenated string, so
`JSON.stringify`-based text matching needed
`/"Riverside CC"," won the tournament"/`, not a plain substring match —
the same two-array-elements gotcha `PlayingXIPicker`'s tests hit
earlier this session with `"0","/","2"`.

A thirty-seventh PR extracted `src/components/tournamentsScreen.js`
(`TournamentsScreen` — the "Cups" list: club/federation source chips,
create-tournament with an optional group-stage split, create-series,
a status/search filter, and each tournament as a tappable row). Every
write action is a prop (`onCreateTournament`/`onCreateSeries`); the
only bare global is `Modal`, backing the create-series dialog only
(create-tournament is an inline card). At ~820 lines this is the
biggest component extracted so far, but the dependency read went
smoothly — everything it touches (`withPinnedFirst`,
`knockoutStagesPreview`, `tournamentStatus`, `tournamentDateRangeLabel`,
`TOURNAMENT_STATUS_LABELS`/`COLORS`) was already extracted from earlier
batches, and all 8 tests passed on the first run.

A thirty-eighth PR extracted `src/components/tournamentDetailScreen.js`
(`TournamentDetailScreen` — a single tournament's own screen: schedule/
standings/stats/matches tabs, Player of the Tournament, Orange/Purple
Cap and Table Topper callouts, share, PDF export, a qualification-
scenario calculator, and delete). `loadTournamentMatches` runs from a
mount-time `useEffect`; `downloadCSV` (a bare global, distinct from
`RecordsScreen`'s `downloadMultiSectionCSV` — a single-table export
rather than multi-section) is called only from its own button handler.
`TournamentShareModal`/`QualificationCalculatorModal` (both already
extracted) reference `Modal` as a bare global internally, so tests that
open either stub it too — same for `ConfirmModal`'s delete-confirm
dialog. Caught two missing icon imports (`Trophy`, then `CalendarClock`/
`Cap`/`Pencil`) via the same `ReferenceError`-on-first-render pattern
seen before — worth grepping the *entire* `React.createElement(X` list
up front next time rather than fixing them one crash at a time.

A thirty-ninth PR extracted `src/components/clubPanel.js` (`ClubPanel` —
full club administration: create/join, an owner-only "Manage" mode
covering invite-a-member, invite-a-co-owner, umpires, members,
federation-affiliation search, and delete, plus a self-service "Edit
club details" form with a debounced Nominatim address search). At
~1487 lines this is now the single biggest component extracted this
session — bigger even than `TournamentsScreen`. Every write action is a
prop; the sole bare global is `searchAddress` (also used independently
by `VenueEditModal`), from the debounced address-search effect, not
exercised by any test since none of them touch the address field. Along
the way, `CLUB_LOGO_UPLOAD_ENABLED` (a standalone `const ... = true`
feature flag, sitting between the `app-logic` and `scoring-engine`
module spans — not itself part of either) got its own first-ever
`GENERATED-FN` extraction into `miscHelpers.js`, appended at the very
end of the file to avoid the leading-comment glue bug documented
earlier. Nearly every test initially failed on subtle layout
assumptions, all fixed by reading the actual JSX rather than guessing:
most of "Manage club"'s owner-only UI (the edit-details form, invite
sections, umpires, members, danger zone) is gated on `activeIsOwner &&
manageOpen`, so it isn't visible until a "Manage" click; a hidden
`<input type="file">` for the logo upload sits ahead of every other
`<input>` once `manageOpen` is true, breaking naive `findByType("input")`
lookups; `VisibilitySwitch` is a single toggle button identified by
`aria-label` ("Make public"/"Make private"), not text; and
`SearchAndRequestPanel` requires an explicit "Search" button click
before results (and their "Request" buttons) appear — typing alone
doesn't trigger a search.

A fortieth PR extracted `src/components/federationsPanel.js`
(`FederationsPanel` — `ClubPanel`'s sibling: create/find-and-request-
to-join a federation, and per-federation owner-only "Manage" mode —
edit name/description, invite a club by search or by email, invite/
remove a co-owner, remove a member club, cancel a pending outgoing
invite, delete once no clubs remain affiliated). Every write action is
a prop, no bare globals, no mount effect — "Manage" loads its member-
club list via `onLoadFederationMembers`/`onLoadFederationTeams`/
`onSearchPublicClubs`, all props, from its own click handler rather
than `useEffect`. The dependency read paid off directly this time: 9 of
10 tests passed on the very first run, the best first-pass rate of any
large screen this session — the one miss was a `findAllByType("button").find(...)`
substring match ("Invite") accidentally matching "+ Invite a co-owner"
before the actual per-search-result "Invite" button; fixed with an
exact `===` match instead of `hasText`.

This unblocks `TeamsScreen` (882 lines), which renders both `ClubPanel`
and `FederationsPanel` as tabs — now that both exist, `TeamsScreen`
itself is next.

A forty-first PR extracted `src/components/teamsScreen.js`
(`TeamsScreen` — the "Clubs" screen: a Clubs/Federations tab rendering
`ClubPanel`/`FederationsPanel`, plus, once a club is active, its player
pool — quick-add, bulk paste/upload preview, active/inactive toggle,
edit, remove, "create a team from everyone tagged X" — and a federation
co-owner invite-code redemption box). Every write action is a prop, no
bare globals, no mount effect. Now that `ClubPanel`/`FederationsPanel`
both exist, this was a clean prop-passthrough extraction: all 9 tests
passed on the first run.

A forty-second PR finally extracted `src/components/homeScreen.js`
(`HomeScreen` — the app's landing screen: saved matches by status,
unified search across matches/teams/players/tournaments/clubs/
federations/help, the account bar, and entry points into every other
top-level screen). This is the batch that resolved the `renderMatchCard`
blocker flagged back when it first turned up: rather than leave
`HomeScreen` stuck, its nested `renderMatchCard(m, i)` was given a
deliberate, disclosed, behavior-preserving refactor — the six values it
used to close over (`onOpen`, `setConfirmDeleteId`, `setShowSwipeHint`,
`tournamentNameById`, `onGetShareCode`, `onGetViewCode`) became an
explicit third parameter, destructured right in the parameter list so
the function body needed zero changes, and all four call sites (all
still inside `HomeScreen` itself) were updated to pass that object
explicitly. This was verified two ways: first that the marker-wrapped
splice step itself stays byte-identical against a post-refactor
snapshot (same discipline as every other batch), and separately that
the refactor commit against the true pre-refactor `public/index.html`
touches *only* the signature and the four call sites, nothing else. The
other nested helpers in the same body (`renderClubRow`, `renderCupRow`,
`renderFederationRow`, `renderHelpRow`, `renderTeamRow`,
`searchResultRow`, `seeAllLink`, `roleLabel`, `categorySectionLabel`)
needed no such treatment and simply traveled along verbatim — they have
no call sites outside `HomeScreen`'s own render, unlike `renderMatchCard`
which is called from four places within it. **Rule for any future nested
helper blocking an extraction:** it only needs the parameter-object
refactor if something *outside* the parent still needs to call it
directly; if every call site is inside the same parent being extracted,
it travels for free. Two easy import misses caught by a broader
dependency sweep (not just `React.createElement(X` — icon components can
also arrive as plain prop *values*, e.g. `icon: Users`/`icon: Shield`
passed to `HomeUtilityButton`, which a createElement-only grep misses):
`Shield`/`Users` from `icons.js`, and `HELP_SECTIONS` (already in
`infoScreens.js`) for the search's help-entries filter.

A forty-third PR extracted `src/components/setupScreen.js`
(`SetupScreen` — the multi-page "New Match" flow: teams & format, toss,
match rules, playing XI when a saved squad is picked, opening line-up,
then a review page before handing everything to `onStart`). A clean
extraction on the Firestore front — every write is a prop, no bare
globals, no mount effect that reaches outside the component — but it
surfaced one more instance of the "check before extracting as new" rule
from `SeriesDetailScreen`'s batch, this time for something that *wasn't*
already extracted anywhere: `SETUP_PAGE_LABELS`, a standalone top-level
`const` sitting just after `// GENERATED-END: app-logic` in
`public/index.html`, used nowhere but this screen. Since nothing else
references it, it was extracted as its own `GENERATED-FN` export
alongside `SetupScreen` in the same file, rather than folded into
`appLogic.js`'s wholesale module splice (which would work at
runtime too, since everything ends up flat global scope either way,
but would misattribute a screen-only constant to a shared core module
for no reason). One page-change `useEffect` calls `window.scrollTo`
directly (to reset scroll position between pages) — its test stubs a
minimal `globalThis.window = { scrollTo: () => {} }` rather than pull
in jsdom for one call, same pattern as `TournamentShareModal`'s own
minimal window stub. Also worth remembering for the next screen with a
paginated review step: JSX renders `"Step ", currentPageIndex + 1, "
of ", pageOrder.length` as four separate children, not one
concatenated string — the same `JSON.stringify`-split gotcha
`PlayingXIPicker`/`FixturesSection` hit earlier, so tests match
`/"Step ","1"," of ","4"/`, not a plain `/Step 1 of 4/` substring.

A forty-fourth PR extracted `src/components/teamEditScreen.js`
(`TeamEditScreen` — create/edit a team's roster: name, jersey color,
add/remove players typed/borrowed-from-another-club/copied-from-the-
club-pool, captain/keeper toggles, per-player publish/unpublish to the
shared player directory). Every Firestore-reaching write is a prop;
the one bare global is `checkDeletedBorrowedPlayers` (flags a borrowed
roster row whose source player doc was since deleted outright), called
from a mount-time `useEffect` only when the roster already has a
borrowed player with an email — most tests never trigger it. One real
mistake caught by the mandatory pre-test byte-diff check, not a test
failure: the first pass imported `Modal` for real
(`import { Modal } from "./modal.js"`) since this screen also renders
it directly for its own borrow/pool-picker dialogs, not just via
`ConfirmModal`. That's exactly the mistake flagged when
`playerModals.js`/`miscModals.js` were extracted — a real import binds
`Modal` at module load, so a test's `globalThis.Modal = StubModal`
silently does nothing and the real DOM-dependent `Modal` runs instead.
Fixed before any test was written by dropping the import and keeping
`Modal` as a bare, unimported global, matching every other
`Modal`-using file in this repo. Also worth remembering:
`JSON.stringify` on a *live* React element (as opposed to a
`renderer.toJSON()` tree) throws on the `_owner` circular reference —
one test needed the hand-rolled `hasText` walker (checking
`.props.children` directly) instead of `JSON.stringify(...).includes(...)`
to search a live `findAllByType("button")` result.

A forty-fifth PR extracted `src/components/accountScreen.js`
(`AccountScreen` — the signed-in-or-not account/settings screen:
profile display name, own public player-profile summary, sign-in
method linking, sign out, admin tools with Feedback Inbox/Beta Testers
counts, beta-tester tools including dummy sandbox data, export/import a
JSON backup, account deletion — or, signed out, the Google/email
sign-in form). At ~1273 lines this is the largest non-`Modal`-blocked
screen extracted so far. Every one of its eight Firebase Auth/
Firestore calls (`submitBetaRequest`, `loadFeedback`, `loadBetaRequests`
— an admin-only mount effect — `linkPasswordCredential`,
`linkGoogleCredential`, `signUpEmail`, `signInEmail`,
`sendPasswordReset`) is a bare global, the same pattern
`WelcomeScreen`/`AuthActionScreen` already established; `Modal` (kept
bare and unimported, per the rule from `TeamEditScreen`'s batch) backs
the delete-account dialog. `handleExport`/`handleImportFile` touch real
browser-only APIs (`Blob`, `URL.createObjectURL`, `FileReader`) from
inside their own click handlers — tests confirm those two buttons
render and gate correctly (disabled/enabled, busy label) without
clicking through them, the same disclosed-gap shape as
`ExportPdfButton`'s untested `window.print()`. One test mistake caught
and fixed here: the sign-out row's own button and `ConfirmModal`'s
confirm button both render the text "Sign out" (the row's label and
`ConfirmModal`'s `confirmLabel` happen to match) — a
`findAllByType(Btn).find(b => b.props.children === "Sign out")` search
after opening the dialog silently matched the *first* one again
(reopening the same dialog, not confirming); fixed by grabbing
`ConfirmModal`'s own `onConfirm` prop directly via `findByType(ConfirmModal)`
instead of searching by ambiguous button text.

A forty-sixth PR extracted `src/components/matchScreen.js`
(`MatchScreen` — the live scoring screen: run/extra/wicket entry, undo,
swap strike, retire, end-innings-early/no-result/revised-target
(DLS-assisted or manual), the between-deliveries next-batsman/next-
bowler prompts, sync-conflict resolution, and the NRR qualification
banner). At ~2453 lines, the single biggest component extracted this
session. Delegates out to `SuperOverOpenersSetup`/`SecondInningsSetup`
(while an innings' openers aren't set) and `ResultScreen` (once the
match is complete) via real imports rather than bare globals, since
this screen renders them directly as an early return, not through any
closure/prop indirection the way `HomeScreen`'s `renderMatchCard` did —
so despite its size, every one of its ~24 local nested helper functions
(`confirmWicketDetails`, `computeDLSPreview`, `undo`, `swapStrike`,
etc.) traveled verbatim, no closure-breaking refactor needed anywhere.
`MAX_UNDO_HISTORY` (a standalone top-level const, previously part of no
module, used only here) got the same `SETUP_PAGE_LABELS` treatment —
its own `GENERATED-FN` export alongside the component in the same file.
`saveMatch` is the one bare global; every other write (undo history,
live-match registry, pending-write cleanup) already goes through an
extracted core helper.

Testing this one surfaced two new lessons worth carrying forward
(beyond the usual dependency-read discipline — this batch's read also
caught a genuinely missed import, `crr` from `scoringEngine.js`, via
the standard bare-function-call grep):

- **`match` is a fully controlled prop here, not internal state** — the
  first screen this session where the test render helper had to wire
  `setMatch` to actually call `renderer.update(...)` with the latest
  match on every commit, the same way the real App re-renders it,
  rather than just capturing the latest value in a variable (the
  pattern every prior screen's tests used, since none of them needed
  the UI itself to reflect a post-interaction state change).
- **A component rendering `InningsTimer` (or anything else with a live
  `setInterval`) needs every test instance unmounted, not just the one
  the original gotcha (documented in `scoringUiAtoms.test.js`) flagged.
  With 15 tests each mounting their own instance and none unmounted,
  `node --test` hung for minutes past every test finishing — the event
  loop never drained while 15 live 30-second intervals stayed pending.
  Fixed with a shared `mountedInstances` array unmounted in `afterEach`,
  not a per-test fix.
- The main scoring row's 0/1/2/3/4/6 run buttons stay mounted **behind**
  every modal this screen opens (`Modal` is an overlay, not a
  replacement) — a same-numbered `Btn` inside an open modal (the Extra
  amount picker, the custom-runs overthrow buttons) isn't unique by
  text alone. A `modalBtn` helper scopes the search to inside the
  stubbed `Modal` itself rather than the whole tree.

A forty-seventh PR extracted the last two pieces and **finished the
entire component-extraction task**: `src/components/cricketScorer.js`
(`CricketScorer` — the root app-shell: screen routing/history,
Firebase Auth session lifecycle, and essentially every Firestore/Auth
handler the app has, ~85 local nested handlers plus ~80 bare-global
SDK calls, none of it extracted further since none are called from
outside the component; plus `FONT_LINK`/`GLOBAL_CSS`/`SCREEN_DEPTH`,
three standalone top-level consts with nowhere else to live, given the
same `SETUP_PAGE_LABELS`/`MAX_UNDO_HISTORY` treatment) and
`src/components/errorBoundary.js` (`ErrorBoundary` — the top-level
crash boundary wrapping `<CricketScorer />` at the bootstrap
`root.render()` call; a real `class ... extends React.Component`,
since `componentDidCatch`/`getDerivedStateFromError` have no hook
equivalent — the first class component this session extracted, and it
needed a genuine `generate.js` fix: `findNamedExport`'s regex only
recognized `export function`/`export const`, not `export class`, fixed
by extending it to `/^export (?:function (\w+)|const (\w+) =|class
(\w+))/gm`).

Two things worth carrying forward for any future work touching this
pipeline:

- **`wrap_markers.js`'s brace-counting has no awareness of template
  literals.** Wrapping `GLOBAL_CSS` (a `` const NAME = `...` `` whose
  value is a large CSS template literal full of its own `{`/`}`
  characters) inserted the `GENERATED-FN-END` marker mid-string a few
  lines in, corrupting the actual runtime CSS rather than just
  producing diff noise — caught by the mandatory byte-diff check
  before any test ran, not by anything in the script itself. Fixed by
  restoring from the pre-batch snapshot and inserting both `GLOBAL_CSS`'s
  and `ErrorBoundary`'s markers by hand (`Edit`, anchored on unique
  surrounding text) instead of trusting the script. **Rule: never trust
  `wrap_markers.js` for a `const` whose value is a template literal —
  insert its markers manually and confirm via diff that only marker
  lines changed.**
- **Deleting `window`/`document` between tests is unsafe for a
  component whose render body unconditionally reads `window` and whose
  mount effect leaves async work outstanding.** `CricketScorer`'s
  `refreshClubs` (three levels of `Promise.all`, one an intentionally
  un-awaited inner IIFE) can still have a continuation pending well
  after a test's own `act()`-wrapped waits return — harmless on its
  own, just a stale `setState` on an already-unmounted tree. But
  `cricketScorer.test.js` followed every other DOM-touching test
  file's per-test `delete globalThis.window` pattern (`modal.test.js`'s
  own convention) and that turned the harmless straggler into a real
  crash (`window.location` read on every render) that wedged Node's
  process exit for minutes — confirmed via `process._getActiveHandles()`/
  `process._getActiveRequests()` logging that no timer/interval was the
  cause, then confirmed the actual cause via a controlled A/B (removing
  the `after()` deletion alone made the hang and its three React
  warnings disappear, process exiting cleanly in ~1.2s). **Fixed by
  installing jsdom's `window`/`document`/`navigator`/`localStorage` ONCE
  in a file-level `before()` and deliberately never tearing them down —
  safe because `node --test` runs each test file in its own subprocess,
  so nothing leaks to other files.** This is a different, and more
  fragile, gotcha than the standard per-test jsdom teardown pattern
  every other DOM-dependent test file in this suite uses — check
  whether a future component's mount effect leaves comparable async
  work outstanding before defaulting to per-test teardown.

**Component extraction is now 100% complete** — every component that
was in `public/index.html` now lives in a tested `src/components/*.js`
module, spliced back in by `npm run generate`. `npm test` is at 449
passing tests (437 before this batch, +7 for `cricketScorer.test.js`,
+5 for `errorBoundary.test.js`).

## GitHub Pages deploy-mode switch (done)

Switched this repo's GitHub Pages deployment from "Deploy from a branch"
(source restricted to the repo root or a folder literally named `/docs`,
which is why the deployed site used to live in a folder called `docs/`
despite having nothing to do with documentation) to GitHub
Actions-based deployment, which has no folder-name restriction. Done as
two separate, deliberately ordered PRs specifically to avoid any
live-site downtime — doing the folder rename before Pages source was
switched to Actions would have 404'd the live site, since branch-deploy
mode would suddenly have found no `docs/` folder to serve from, and
there's no API access available in this environment to flip that
Settings toggle — only the project owner could do that part.

**Step one:** added `.github/workflows/deploy.yml` — `actions/checkout`
→ `actions/configure-pages` → `actions/upload-pages-artifact` (uploading
the deploy folder, so `CNAME` ships with the artifact and the custom
domain carries over automatically) → `actions/deploy-pages`. No build
step, since the deployed `index.html` is already the complete deployable
artifact (kept in sync with `src/core/*.js`/`src/components/*.js` by
`npm run generate` before every commit, same as always). Merged first,
while Pages source was still "Deploy from a branch" — safe by
construction, since a workflow with no effect on the live site either
doesn't run relevantly or has its `deploy-pages` step fail loudly (a red
Actions run, not a broken site).

**Step two:** the project owner manually flipped Settings → Pages →
Source to "GitHub Actions". Confirmed via a `workflow_dispatch` run
(`actions_run_trigger`) that completed with `conclusion: success` on all
five steps, including the actual `deploy-pages` step — this is the real
signal, not just workflow-file syntax being valid, since the same
workflow's very first run (triggered by its own merge, before the
Settings flip) had correctly failed at that exact step for the reason
described above.

**Step three:** with Actions deployment confirmed working, `docs/` was
renamed to `public/` — `git mv docs public`, `scripts/generate.js`'s
hardcoded `INDEX_HTML` path updated to `public/index.html`,
`.github/workflows/deploy.yml`'s `upload-pages-artifact` `path` and
`push.paths` filter updated to `public`, and every `docs/index.html` /
`docs/` reference across `README.md`, `handoff-prompt.md`,
`tests/README.md`, `scripts/generate.js`, and the handful of
`src/components/*.js`/`src/core/*.js`/`tests/unit/components/*.test.js`
comments that mentioned it (narrating where a not-yet-extracted bare
global still lives) updated to `public/`. One thing worth knowing if a
future rename ever needs the same treatment: a blind
find-and-replace of `docs/` → `public/` across a file that also uses
"docs" as a plain English word (this file's own `README.md`,
`handoff-prompt.md`, `package.json` — repo-level **docs**/config" line)
will mangle it into nonsense unless that occurrence is protected first —
caught and fixed here before committing, not after.

The deploy-mode switch is now fully complete: `public/index.html` is
production, deployed by `.github/workflows/deploy.yml` via GitHub
Actions, with no folder-name restriction left over from the old
branch-deploy setup.

## Tooling learnings ported from `sakura` (done)

With extraction and the deploy-mode switch both finished, this session
compared this repo's splice-from-`src/`-into-one-file pattern against a
sibling project (`sakura`) running a more mature version of the same
approach, and ported over the pieces that were genuinely cheap and
actually applicable — three PRs:

- **PR #53** added `.github/workflows/ci.yml` (the real verification
  gate this repo was missing — runs `npm test` +
  `npm run generate:verify` + the new structure check on every push/PR)
  and `scripts/validate_html_structure.py` (an HTML5-parser-based check
  guarding against a RAWTEXT-tag hijack — a stray `<title`/`</script`
  landing somewhere it shouldn't silently corrupting the main script;
  `sakura` hit this for real in production). Caught its own bug on the
  very first real run: the workflow's Node 20 pin crashed every
  jsdom-dependent test file, since `jsdom@30.0.1` only supports Node
  `^22.22.2 || ^24.15.0 || >=26.0.0` — fixed by bumping to Node 22 and
  adding an `engines` field to `package.json` so the constraint is
  documented, not just tribal knowledge.
- **PR #54** moved `handoff-prompt.md` into a new `docs/` folder — now
  that `docs/` no longer means "the deployed PWA" (freed up by the
  earlier `public/` rename), it's finally free to mean what its name
  says: project documentation, with room for more to land alongside it.
- **PR #55** added `.githooks/pre-commit` + `scripts/setup-git-identity.sh`
  (see "Git identity" above) — a local backstop for the same two things
  `ci.yml` already gates, catching a bad commit before it exists rather
  than before it merges.

**One item was explicitly evaluated and skipped, not overlooked:**
adopting Vite's `publicDir` convention for static assets. It exists to
stop a *bundler* from silently dropping/mis-hashing assets during a
build — `sakura` hit exactly that with `sw.js`/its manifest. This repo
has no bundler at all: `public/` deploys to Pages verbatim via
`actions/upload-pages-artifact`, so there's no equivalent risk for Vite
to guard against, and introducing one now would add complexity (and a
new risk surface) for a problem that doesn't exist here. Worth
re-evaluating only if this repo ever adopts a real build step for
another reason — not as a standalone change.

TypeScript and a Playwright e2e suite were discussed and deliberately
parked as bigger, lower-urgency investments (see the session's own
discussion, not repeated here) — not started, not forgotten.

## Tournament special rules (Phase 0 and Phase 1 done)

A club asked whether the app could host a tournament with a specific
set of "special rules" (8-over matches, 8-a-side, 2 runs for a
wide/no-ball, Free Hit, etc.) without re-entering them for all 7
matches. Assessed against the actual scoring engine and app logic (not
guessed), the rules split into four tiers by how much work they'd need:

1. **Already supported by existing rule fields** — overs, squad size,
   wide/no-ball run value, Free Hit, and the group-stage-into-Final
   bracket shape all already exist as configurable match rules or
   tournament group settings. The only real gap was *where* to set
   them: a tournament's `defaultRules` only ever got backfilled
   implicitly from whichever fixture happened to be scored first — there
   was no way to configure them **before** the first match, so the very
   first fixture couldn't inherit anything.
2. **Needs a manual scorer workaround today** — a 25-run auto-retirement
   with a specific return-order, a 20-second timed-out dismissal, and an
   escalating time-based run penalty (2 runs/minute past a cap) are all
   real gaps, not yet built.
3. **Structurally unsupported** — the final over's wides/no-balls
   becoming illegal again (re-bowled) is a genuine scoring-engine change:
   `applyBall` hardcodes `legalBall = false` for every wide/no-ball,
   unconditionally, for the whole innings, with zero over-number
   awareness anywhere in that code path (verified by reading
   `scoringEngine.js` directly, not assumed).
4. **A real new feature** — Impact Player substitution (a bench pool,
   swap-at-the-innings-break, max 2 swaps, no return) has no
   representation in the data model at all.

**Phase 0 closes the gap in tier 1** — an explicit rules editor at
tournament **creation** time, so an organiser sets things up once,
before any match exists, rather than relying on the first fixture's
choices becoming the accidental default:

- `TournamentsScreen`'s create-tournament form gained a collapsed-by-
  default "Match rules (optional)" section (same "Customize" pattern as
  `SetupScreen`'s own match-level rules editor, reusing the same
  `RuleChoice` component) covering **Overs per innings**, **Players per
  side**, **Runs on a wide**, **Runs on a no-ball**, and **Free hit
  after a no-ball** — deliberately not the full match-level rule set
  (`ballsPerOver`/`superOver`/`powerplayOvers`/`timeCapMinutes`/
  `maxOversPerBowler` stayed out): those are match-level knobs a
  tournament organiser doesn't typically set once up front, and keeping
  the form small mattered more than parity with every match-level field.
- `onCreateTournament` gained two new, optional, backward-compatible
  trailing params: `defaultOvers` and `defaultRules`. `null` when the
  section was never customized, matching the pre-existing behavior
  exactly — every existing call site/test kept working unchanged.
- `handleCreateTournament` (`cricketScorer.js`) stores both on the
  tournament doc. `linkFixtureToMatch` (the pre-existing implicit-
  backfill mechanism used when a tournament's rules were never set
  explicitly) now backfills `defaultOvers` the same only-if-unset way it
  already did `defaultRules`/`venue` — this was a **real pre-existing
  gap** independent of Phase 0: even the old "first fixture becomes the
  default" mechanism never carried the overs count at all, only rules
  and venue, so it's fixed here rather than left half-done alongside the
  new explicit path.
- `SetupScreen` now seeds its own `overs` state from
  `presetTournament.defaultOvers` (mirroring how it already seeds
  `venue` from `presetTournament.venue`) — this is the actual "copied to
  matches/fixtures" delivery: once a tournament's rules are set, every
  fixture scored from it starts pre-filled, no re-entry needed.

Not touched in this phase, deliberately: no display of a tournament's
configured rules on `TournamentDetailScreen`, and no way to edit them
after creation — both easy, natural follow-ups if actually wanted, but
not part of what was asked for here. Tiers 2–4 above remain open,
tracked for whenever they're picked up next.

**Phase 1 closed tier 2's two smaller items** — the 25-run retirement
(with the user's explicitly chosen simplified return semantics, not the
strict "wait for everyone else" ordering, which was scoped out as its
own bigger, separate decision — see the session's own discussion) and
Timed Out. Both surfaced real design questions only visible once
actually built, not obvious from the rule text alone:

- **`retirementRuns`** (new `DEFAULT_RULES` field, editable in
  `SetupScreen`'s match-rules editor same as `timeCapMinutes`/
  `powerplayOvers`, and folded into `nonStandardRulesText`) is baked
  into the inning at `newInning` time, same pattern as every other rule.
  `MatchScreen` derives `capRetireName` — **not** just "is the current
  striker over the cap": an odd-run delivery rotates strike, so the
  batsman who actually crossed the threshold may no longer be the one
  currently facing by the time this renders. Checking only
  `inning.strikerName` would mean a batsman who reached the cap while
  at the non-striker's end could go the rest of the innings without
  ever being prompted — caught by the second test written for this,
  not by inspection. Fixed by checking both ends and, when it's the
  non-striker who's over the cap, showing a "Swap Strike" action first
  (mirroring the voluntary retire modal's own existing pattern) instead
  of a direct confirm, since `retireBatsman` can only ever act on
  whoever's currently on strike.
- The mandatory prompt (a plain bare-global `Modal`, not `ConfirmModal`
  — it needs the conditional third swap-strike state ConfirmModal's
  fixed confirm/cancel API can't express) auto-shows whenever
  `needsCapRetirement` is true, purely derived like `needsNewBatsman`
  already is — no separate tracked boolean to drift out of sync with
  the score. Its one piece of real state, `dismissedCapRetireFor`, only
  exists so "Not now" can close the prompt without it reopening on the
  very next render; it's reset inside `commit()` itself, so the *next*
  committed ball (any of them — another run, a wicket, an undo) re-nags
  if the batsman is still over the cap and still hasn't retired,
  matching "must retire immediately" without the app being unable to
  reach Undo to fix a wrong entry that pushed someone over the cap by
  mistake.
- **A real bug caught mid-build, not by a test:** the new
  `dismissedCapRetireFor` `useState` was first declared later in the
  component (near the existing `showRetireModal`), but the derived
  `needsCapRetirement` computation that reads it sits much earlier —
  a temporal-dead-zone `ReferenceError` on every render. Moved the
  declaration up to right where it's first used. A good reminder that
  this component is ~2500 lines with hooks declared throughout, not
  all at the top — check where a new piece of state is actually read
  before assuming it's safe to declare it near thematically-related
  state further down.
- **Timed Out** doesn't fit the existing wicket-type picker at all —
  that picker is for a batsman already at the crease facing a ball;
  Timed Out is the *incoming* batsman failing to arrive before ever
  facing one. Modeled as a new `timedOutBatsman(name)` in the Next
  batsman prompt instead: builds the dismissal directly (0 runs, 0
  balls, no bowler credited — same reasoning as "retired out" and
  "run out"/"obstructing the field" not crediting the bowler) rather
  than going through `applyBall` (no actual delivery happens), and
  deliberately never sets `strikerName` — the same "who's next" prompt
  just reopens, exactly as if this player had never been offered.  If a
  wicket was already pending (the timed-out player was named right
  after an ordinary dismissal), that pending wicket is resolved first
  (`applyBall(inning, {...pendingWicket, newBatsman: ""})` — `applyBall`
  already tolerates an empty `newBatsman`, leaving nobody on strike) and
  merged into the **same** commit as the timed-out entry, so undo/
  history stays one step per real event instead of two.
- **A test-writing lesson, not a product bug:** the very first version
  of the "non-striker over the cap" test failed in a genuinely
  confusing way — `needsCapRetirement` provably `true` at the exact
  point of the JSX conditional (confirmed by temporarily logging
  inline), the stubbed modal provably present in the rendered tree
  (confirmed the same way), yet a `/B must retire/` regex against the
  dumped JSON kept failing. The cause was the same split-JSX-text
  gotcha documented elsewhere in this suite ("Step 1 of 4", etc.):
  `capRetireName` and `" must retire"` are two separate JSX children,
  not one concatenated string, so the dumped JSON never contains "B
  must retire" as one contiguous substring — it needs
  `/"B"," must retire"/`. Worth remembering next time a test failure
  looks like a genuine rendering mystery: check for this gotcha before
  assuming the component itself is broken.

**2026-09-02 session — three bugs reported together from live use, two
fixed (PR #69, merged), one left open pending a repro:**

- **Ball-strip label ambiguity.** `ballLabelsForOver` (`miscHelpers.js`)
  intentionally labels a wide/no-ball with the same over.ball number as
  whichever legal delivery eventually completes that slot (documented in
  the README) — but two adjacent badges with an identical label (e.g.
  `3.4` then `3.4`) read as a rendering glitch, worst right at the end of
  an over where it looks like the over already finished. Fixed by
  appending a trailing `*` to the wide/no-ball's own label only (`3.4*`
  then `3.4`), leaving the underlying slot-sharing numbering (and its
  existing test) untouched. Also added a short info line to the extras
  runs picker (Wide/No Ball) reading the current `wideRuns`/`noballRuns`
  value and `isWideNoballLegal` status directly, since the `Tier 3`
  final-over house rule can flip the latter mid-innings and the scorer
  had no way to see that from the picker itself.
- **Cap-retirement infinite loop — a real, unplayable bug.** `ensureBatsman`
  resuming a retired batsman only ever cleared `retiredHurt`/`retiredAtCap`,
  never their `runs`. `needsCapRetirement`'s derivation in `matchScreen.js`
  compared that same lifetime `runs` total against the flat cap, so a
  batsman returning from their first cap retirement (runs still sitting at
  or above the cap) re-triggered the mandatory prompt on the very next
  render — with everyone else also retired-and-waiting, there was no
  playable batsman left and no way to proceed. Fixed with two new
  `scoringEngine.js` exports: `retirementCapThreshold(runs, retirementRuns)`
  (rounds down to the nearest multiple of the cap) and
  `retirementCapDue(batsman, retirementRuns)` (true only once the batsman's
  current threshold exceeds `batsman.capRetiredThreshold`, a new field set
  each time `retireBatsman("cap")` fires). A returning batsman is now only
  re-flagged once they cross the *next* multiple of the cap, not the one
  they already served. Covered by unit tests on the two new exports plus a
  full `MatchScreen` component test that reproduces the exact loop
  (retire A at cap → bring in C → C out → bring A back → assert no
  re-trigger).
- **"Stuck on the Impact Player screen, can't start 2nd innings" — not
  reproduced.** A dedicated investigation read `SecondInningsSetup` and
  `ImpactPlayerCard` in `inningsSetupScreens.js` end to end and then
  actually exercised the flow with `react-test-renderer` (not just static
  reading) for both a single substitution and the per-team max of 2 — in
  every run, "Start 2nd Innings" (gated only on openers + bowler being
  picked, with zero dependency on Impact Player state) rendered enabled
  and worked. Leading theory: UX confusion, not a code block — "Confirm
  substitution" deliberately stays on the same screen (either team can use
  remaining subs any time before the innings starts) and a user tapping it
  expecting to advance may not notice the actual "Start 2nd Innings"
  button further down the same screen. Asked the user for an exact repro
  (which team, sub count, whether openers were picked before or after,
  whether the Start button was visible-but-disabled or not there at all)
  before touching any code here. If it recurs with a concrete repro, start
  from `inningsSetupScreens.js:239` (`SecondInningsSetup`) and `:168`
  (`ImpactPlayerCard`).

**2026-09-02 session, continued — eight PRs (#74–#81), all merged.** A long
run of feature requests and bug reports from live use, roughly in the order
they landed:

- **Big Hit / Maximum Hit (PR #74, extended in #75).** Two independent,
  optional bonus-hit tiers (`bigHitRuns`/`maxHitRuns` on the inning) — a
  club can attach either or both to whatever its own ground uses (a longer
  boundary rope, an even bigger one). `handleRun`'s new `bigHitLabel`
  parameter carries the tier's own configured name ("Big Hit"/"Maximum
  Hit") straight through as `event.bigHit`, which `applyBall` treats as a
  genuine six for every stat/milestone purpose (`isSix = event.bigHit ||
  battedRuns === 6`) and which `BallCelebration` shows verbatim instead of
  a generic "SIX!" — a bug fixed mid-session when it first shipped
  celebrating as plain "SIX!" regardless of the tier's name. Also fixed: a
  bonus hit's total can be odd (Maximum Hit at 15, say) and was wrongly
  rotating strike like a genuine odd-run single — a boundary is a dead ball
  the instant it lands, so `applyBall`'s strike-rotation check now
  excludes any four/six/bonus-hit explicitly, not just by even/odd parity.
- **Innings-break summary + team-name/score ambiguity (PR #75).**
  `SecondInningsSetup` now shows a first-innings score + target summary
  card at the top of both the Impact Player and lineups steps, so getting
  the context doesn't require a click into the scorecard. Fixed alongside
  it: a team named e.g. "Billund 1" next to a score like "193/1" rendered
  as "Billund 1 193/1", readable as "1193/1" — separator changed from a
  bare space to `": "`.
- **Declare Timed Out confirmation (PR #75).** Genuinely destructive (an
  irreversible-feeling dismissal with no ball bowled) and had no
  confirmation step at all before this — now behind a `ConfirmModal`, with
  an "Reverted" undo-feedback toast so cancelling out via Undo afterward is
  visibly acknowledged.
- **Self-conflicting sync race (PR #77) — the first of three sync bugs
  found this session, each a real root cause chased down from a vague
  "scores don't match" / "not syncing" report, not a guess.**
  `flushPendingWrites` (the background outbox retry, still in
  `public/index.html`, not extracted) and a live `MatchScreen`'s own
  `queueSave` chain could both attempt to save the *same* match at the
  same time from the same device — the background flush's queued snapshot
  carried a now-stale `expectedSeq`, so it could lose the Firestore
  transaction to a ball the live screen scored in the gap, surfacing as
  "Scores don't match" (`SyncConflictModal`) against this exact device's
  own write. Fixed by having `flushPendingWrites` skip whatever match is
  currently registered live (`liveMatchSetters[id]`) — that screen's own
  save chain is already the sole source of truth for it while it's open;
  unmounting re-exposes the match to the next flush via
  `unregisterLiveMatch`.
- **Stuck "tap to retry" (PR #79) — the second sync bug, and a direct,
  disclosed side effect of the fix just above.** `SyncStatusBanner`'s
  manual retry called that same `flushPendingWrites`, which now
  deliberately skips whatever match is open on screen — so if the *exact*
  match stuck in the outbox was the one being actively scored, tapping
  retry was a permanent no-op; it could only clear once some future ball
  happened to save successfully on its own. Fixed by giving
  `SyncStatusBanner` an optional `onRetry` prop (defaulting to
  `flushPendingWrites`, unchanged for every other caller); `MatchScreen`
  passes one that retries through its own `queueSave` — the same safe,
  serialized path every other save already uses — while still flushing
  any other queued match in the background.
- **Firestore rejecting the save outright (PR #81) — the third and by far
  the most serious.** A real production error report —
  `Function Transaction.set() called with invalid data. Unsupported field
  value: undefined` — traced to `applyBall`'s shared ball-log push
  (`scoringEngine.js`, the single `cur.overs[lastOverIdx] = [...]` line
  every ball kind runs through): `bigHit: event.bigHit || undefined` sets
  that key to the literal JS `undefined` on *every* ball that isn't a
  bonus hit, not just omitting it. Firestore's client SDK rejects any
  field whose value is `undefined` outright, and `packMatchForFirestore`
  (`packUtils.js`) passed the ball log straight through unchanged into
  every transactional write — meaning this had likely been silently
  failing to sync a meaningful slice of real matches since Big Hit shipped
  a few PRs earlier in this same session, invisibly, since `npm test`
  never touches a real Firestore backend and the local-storage fallback
  kept the app usable. Fixed at the actual write boundary rather than
  patching this one field: `packMatchForFirestore` now strips any
  explicitly-`undefined` field via a `JSON.parse(JSON.stringify(...))`
  round-trip before it ever reaches Firestore, closing the whole class of
  bug (there are several other `foo || undefined` patterns elsewhere in
  the codebase, all feeding transient event objects rather than persisted
  fields today, but nothing stops a future one from landing in persisted
  data the same way). **Read this before assuming a fresh sync bug is a
  new root cause — check whether the affected write actually happened
  after PR #81 landed on `main` first.**
- **Confusing wide/no-ball last-over wording (PR #80).** The "illegal
  again in the last over(s)" note always said "this flips back in the last
  over(s)" whenever that house rule was configured on, regardless of
  whether the current ball was actually inside the window — correct,
  forward-looking phrasing before the window starts, but the identical
  phrasing attached to "doesn't count as a legal delivery" once *inside*
  it read as if the flip it described were still pending when it had
  already happened. Fixed by branching the wording on
  `isInLastOvers(inning)` (already exported from `scoringEngine.js`):
  forward-looking outside the window, present-tense ("back to the standard
  rule for the last over(s)") inside it.
- **One-line ball commentary (PR #80, redesigned in #81).**
  `lastBallCommentary(before, after)` in `scoringEngine.js` derives a short
  "bowler to batter: outcome" line by diffing the inning immediately
  before/after `applyBall` — the same before/after pattern the existing
  milestone detection already uses, so it can't drift out of sync with
  what actually happened. Shown above the Overs strip on `MatchScreen`,
  cleared on Undo. Originally returned one flat string; redesigned one PR
  later, per direct user feedback ("the presentation could be better"),
  to return `{ lead, outcome, kind }` instead, so the UI can color/bold
  just the outcome word to match `BallBadge`'s own kind-based coloring
  (green four, gold six/bonus hit, red wicket, purple wide/no-ball)
  instead of one plain gray line — the `kind` a small, deliberately
  separate concept from the ball's own `event.kind`, since e.g. a bonus
  hit and a plain six share `kind: "six"` for commentary-coloring purposes
  despite having different `event.kind`/`bigHit` shapes underneath.
- **Impact Player "IP" badge (PR #79).** Previously the only place a
  substitution showed up was a one-line "Impact Player: X on for Y"
  summary at the top of the Scorecard. `RoleBadge` (already shared for
  Captain/WK) now also renders an "IP" tag next to a substitute's name
  wherever it appears — the live scoring header (striker/non-striker/
  bowler) and the scorecard's own batting/bowling rows — via a new
  `isImpactSubFor(match, name)` helper in `appLogic.js` that checks
  `match.impactSubs` (match-wide, not scoped to one innings) by
  `inName`.
- **Tournament venue + rules-editor segmentation (PR #78, mirrored onto
  the single-match editor in #79).** A tournament can now carry its own
  venue (set at creation, editable any time from
  `TournamentDetailScreen`, reusing the existing `VenueEditModal`),
  inherited by every fixture the same way tournament rules already were —
  useful for a one-day tournament played on one ground, where re-entering
  the same venue per fixture was pure friction. Alongside it, both the
  tournament and single-match rules editors were regrouped from one long
  unlabeled list into labeled sections (Format/Extras/Bowling
  limits/Batting rules/Special rules) via a new shared `RuleSectionHeader`
  component (exported from `tournamentsScreen.js`, imported into
  `setupScreen.js` rather than duplicated) plus bordered clusters for the
  Last Over Rules and Impact Player toggles.
- **Last-over-rules overs count raised from a fixed single "last over" to
  a configurable 1–5 (PR #75)**, at the same time the rules editor
  segmentation above made the now-larger settings block legible rather
  than one more unlabeled row in a wall of them.

**Left open, unresolved as of this session's end:**

- **A "mysterious apostrophe" in the "This Over" ball strip.** First
  reported verbally ("a subtle single quote... after 2 balls... it also
  disappears"), later with an actual screenshot (a stray `'` next to a
  ball badge, over-label `2.1`). Investigated hard: reading every
  candidate render path (`OversStrip`/`BallBadge`/`ballLabelsForOver`/
  `MilestoneToast`/`InningsTimer`) found nothing that could produce a bare
  `'` character. Escalated to an actual browser reproduction — no
  `playwright` in this repo's own `node_modules` (not a declared
  dependency), but it's installed globally
  (`/opt/node22/lib/node_modules/playwright`, resolvable by placing a
  script directly under that directory so Node's bare-specifier
  resolution finds it) with Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Built a harness
  serving the repo over `python3 -m http.server`, importing
  `MatchScreen`/`OversStrip`/`GLOBAL_CSS` directly as real ES modules with
  `react`/`react-dom` UMD builds (from this repo's own `node_modules`,
  since the sandbox's proxy blocks the `esm.sh` CDN route a plain import
  map would otherwise use) wired in via two tiny same-origin shim files
  re-exporting `window.React`/`window.ReactDOM`. Scored balls one at a
  time, across an over boundary (confirming the next bowler via the real
  `PlayerPicker` UI, which turned out to render a candidate's name and
  their `RoleBadge` with no separating space — `"YWK"` for a keeper named
  "Y", not "Y" — a harness-only gotcha worth remembering for the next
  from-scratch repro script), and screenshotted at several points
  including mid-`cs-pop`-animation. Never reproduced. Leading theories,
  untested: Safari/WebKit-specific rendering (the user's earlier PWA
  report was on iPhone; no WebKit browser binary is available in this
  sandbox to test directly) or a data shape not yet tried (a player name
  containing a real apostrophe, e.g. "O'Brien"). **Next step is on the
  user**: which browser/device, whether any player name in the match had
  an apostrophe, and ideally a screen recording or the exact ball sequence
  right before it appeared.
- **Co-owner invites** — scoped only (`docs/co-owner-invites-plan.md`,
  PR #76), never implemented. Needs a real Firestore rules change
  (replacing `allow list: if false` on invite docs with a filtered list
  rule) that has to be pasted into Firebase Console manually before any
  code depending on it ships — treat as its own deliberate slice of work,
  not a quick follow-on.
- **30-minute escalating time-penalty rule** — still open, carried over
  unchanged from the 2026-09-01 entry above. Not the same thing as the
  (already-shipped) flat "time cap per innings" flag.
