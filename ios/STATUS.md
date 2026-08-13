# iOS native rewrite — status (parked, source-only progress since)

Last worked on: August 2026. Parked in favor of the existing PWA — see
"Why parked" below. Tell Claude to read this file to pick the thread back up.

**Important caveat on everything below "What's built":** the environment
this was written in has no Swift toolchain and no Xcode — it's a Linux
sandbox. The scoring-engine refinements described here were written
against the existing code's patterns and reviewed by eye (brace/paren
balance checked mechanically), but **not compiled, not run, and not
tested on a simulator or device.** Treat them as a first draft to verify
in Xcode, not as working code. This doesn't change the "why parked"
calculus — see that section — it's just cleanup of a few known gaps
while parked, done the only way possible without a Mac in the loop.

## Where this came from

Cricket Scorer already exists as a mature single-file web app
(`index.html` at repo root) with Firebase Auth + Firestore, a PWA manifest,
and a service worker — genuinely feature-complete: teams, tournaments,
records/series stats, live-follow/share links, PDF export.

This `ios/` folder is a from-scratch SwiftUI native rewrite of that app,
not a wrapper around the web version. Decision context: a `WKWebView` wrap
was considered and rejected (feels like a website, weak App Review case) in
favor of native SwiftUI, on the reasoning that native gestures/animations/
push notifications are worth the much larger build cost — see "Why parked"
for the reconsideration of that tradeoff.

## Why parked

Comparing native progress against the already-working PWA, the honest
sizing was: 6–10 weeks of focused solo work to reach real parity (sync,
teams, tournaments with NRR/qualification logic, records, sharing, PDF
export). Tournaments and sync are the two genuinely hard remaining pieces;
everything else is volume more than difficulty. Decided to park rather than
ship a native app that's a downgrade from the PWA for weeks/months.

**Before resuming, worth re-asking:** is the goal still "real native app
in the App Store," or would getting the PWA even better (push notification
reliability, install prompts, offline robustness) get 80% of the value for
a fraction of the effort? The PWA already has `manifest.json` + `sw.js` +
offline support working. Re-litigate this, don't just resume out of
momentum.

## What's built (~15% of full parity)

All under `ios/CricketScorer/CricketScorer/`:

- **Auth** (`Services/AuthViewModel.swift`, `Views/WelcomeView.swift`):
  email/password sign-in, sign-up, password reset. Error copy ported from
  the web app's `friendlyEmailAuthError()`. Google sign-in is stubbed (see
  below).
- **Home** (`Views/HomeView.swift`): local matches list, new match button,
  swipe to delete.
- **New match setup** (`Views/NewMatchView.swift`): team names, players
  (comma-separated text entry, now with an optional "fill from saved
  team" menu — see Teams below), overs limit, who bats first.
- **Live scoring** (`Views/MatchScoringView.swift`,
  `Services/ScoringEngine.swift`, `Models/Match.swift`): full ball-by-ball
  engine — runs, wides, no-balls, byes, leg byes, wickets with type,
  automatic strike rotation (including the "odd runs on last ball of over"
  rule), new-bowler and new-batter prompts, over/innings/match completion,
  second-innings target and required run rate.
- **Teams** (`Models/Team.swift`, `Services/TeamStore.swift`,
  `Views/TeamsListView.swift`, `Views/TeamEditorView.swift`): save/edit/
  delete named rosters, searchable list, and a menu in New match setup to
  prefill a team's name/players from a saved one. Local-only persistence,
  same pattern as matches.
- **Tournaments** (`Models/Tournament.swift`,
  `Services/TournamentEngine.swift`, `Services/TournamentStore.swift`,
  `Views/TournamentsListView.swift`, `Views/TournamentDetailView.swift`,
  `Views/TournamentEditorView.swift`): create a single round-robin group
  from ≥2 saved Teams (auto-generates fixtures), start/resume each fixture
  as a real Match, and a points/NRR standings table computed from
  completed matches. Deliberately narrow first slice — see "Recent source
  changes" below for exactly what's cut versus the web app's full system.
- **Result** (`Views/ResultView.swift`): basic result summary + both
  innings' scorecards.
- **Persistence** (`Services/MatchStore.swift`): local-only, UserDefaults +
  JSON via Codable. No cloud sync.

This is a genuinely playable single-device scorer end to end — not a demo
screen. Not yet run on-device to confirm the build actually compiles/runs
in Xcode (was about to be tried on a 17 Pro / iOS 26.5 with a free Apple ID
when this got parked).

## Known simplifications in what's built

- No manual batting-order override — next batter comes from a picker of
  unused players, not a drag-reordered lineup.
- Saved teams are copied into a match at creation time (name + roster
  text), not referenced by id — editing a saved team afterward doesn't
  update matches already created from it. Verified this matches the web
  app's own behavior (`selectTeamA`/`selectTeamB` in index.html do the same
  local-state copy), except the web app *also* keeps a `teamId` on the
  match for traceability, which this doesn't yet.

Four items that used to be listed here — run-out completed runs, free-hit
tracking, undo, and teams/players management — have source written now.
A fifth, a first tournaments slice, also now has source written but is
listed separately below since it's large enough to warrant its own
"what's cut" writeup rather than a one-liner. See "Recent source changes
(unverified)" below for exactly what changed and what to double-check
first in Xcode.

## Recent source changes (unverified — first Xcode build should confirm these before trusting them)

- **Run-out partial runs.** `BallEvent.runs` on a run-out dismissal now
  holds runs completed before the throw (0–3, via a stepper in the wicket
  sheet), and those runs count toward the team total and the striker's
  score the same way any other delivery's runs do. `ScoringEngine.apply`
  also now applies the batters'-crossing rotation for odd completed runs
  on a run-out, which it previously skipped entirely for any wicket.
  Worth re-checking by hand: the "who's out" picker captures a *name*
  before the ball is applied, decoupled from "striker"/"non-striker" — the
  rotation logic runs after that capture, so it shouldn't invalidate the
  name, but this is exactly the kind of ordering bug that's easy to get
  subtly wrong without a compiler and a real device to try odd-run run-outs
  against.
- **Free-hit tracking.** `InningsState.freeHitNext` and
  `BallEvent.isFreeHit` are new. A no-ball sets the next delivery as a free
  hit; the free hit carries forward through any illegal deliveries (e.g. a
  wide bowled on the free hit) rather than being consumed by them. On a
  free hit, the wicket sheet only offers "Run out" as a dismissal option,
  and `ScoringEngine.apply` independently downgrades any other wicket type
  to not-out if one somehow arrives — belt-and-suspenders, since the sheet
  is the real gate. Not yet decided/handled: some leagues also grant a free
  hit after a wide, not just a no-ball — this only implements the no-ball
  version, which is the more universal rule but worth confirming against
  whatever ruleset the target users actually play under.
- **Undo.** Deliberately *not* a hand-written "reverse the last mutation"
  function — over-completion, innings-advancement, and now free-hit state
  all interact, and reversing that correctly for every branch is a lot of
  surface area to get right blind. Instead `MatchScoringView` keeps a
  session-only stack of full `Match` snapshots, pushed before each ball is
  applied; undo just pops and restores. Simpler, but only covers scoring
  deliveries — the bowler/batter-selection prompts aren't snapshotted, so
  undo can't step back through a wrong bowler pick, only through balls.
  Also doesn't survive leaving the screen (it's plain `@State`), which is
  probably fine for "I fat-fingered the last ball" but worth deciding
  explicitly rather than assuming.
- **Teams/players management.** New `Team` model (name + player list),
  `TeamStore` for local persistence (mirrors `MatchStore`), a searchable
  `TeamsListView` (add/edit/delete), and a `TeamEditorView` with drag-to-
  reorder and swipe-to-delete for the roster. Wired into `NewMatchView` as
  a menu next to each team-name field that prefills name + comma-separated
  players from a saved team. Deliberately did *not* add a `teamId` field to
  `Match` to link a match back to the team it came from — that's a real gap
  versus the web app (see "Known simplifications" above) but adding it
  felt like scope creep for what was asked; flagging it instead of quietly
  doing extra schema work. Not yet checked: whether `EditButton()`-driven
  reordering interacts correctly with `.onMove` inside a `Form` section
  versus a plain `List` — this is a common enough SwiftUI quirk that it's
  worth specifically eyeballing on first run, not just trusting it compiles.
- **Tournaments — first slice, deliberately narrow.** Read the web app's
  actual `computeStandings()` in index.html before writing any of this
  rather than guessing at the formula. What's ported: points (win=2, tie=1)
  and the NRR calculation itself, including the "credit full overs if
  bowled out/quota completed" rule that keeps a cheap dismissal from
  inflating NRR. What's cut, and why each one specifically doesn't apply
  yet to an iOS `Match`/`Tournament` that has none of the underlying
  concepts: no **groups** (one flat round-robin only), no **knockout
  stage/bracket** (so no need yet for the web app's fixture-`stage`
  exclusion logic — that's a real piece of complexity to bring back
  later, not something this port avoided by being clever), no **Super
  Over tie-break chain** (a tied match just stays tied here), no
  **no-result/abandoned-match** handling (iOS `Match` has no status
  between "in progress" and `"complete"`), no **DLS/revised-overs**. Full
  reasoning for each cut is in the doc comment at the top of
  `TournamentEngine.swift` — read that before extending this file rather
  than re-deriving it.
  Tournament creation deliberately requires picking from *already-saved*
  Teams rather than typing rosters ad hoc, since a round-robin needs each
  team's roster available across multiple fixtures — `TournamentEditorView`
  says so plainly if no teams are saved yet, rather than degrading into
  its own free-text form.
  Starting a fixture shows an explicit "who bats first" picker
  (`FixtureStartSheet`) rather than defaulting to Team A — this
  deliberately avoids repeating a bug the web app's own comments describe
  fixing (`teamAIsBattingFirst` in index.html): hard-coding the batting
  side regardless of an actual toss/choice used to silently put the wrong
  team's players in the opening line-up.
  Not yet checked, because there's no compiler to check it: whether
  `.sheet(item:)` and `.navigationDestination(item:)` — both used here for
  the fixture-start sheet and jumping into the started match — behave as
  expected when `Fixture`/`Match` change out from under the binding mid-
  presentation. Worth a specific look on first run rather than assuming
  the pattern that worked for `MatchScoringView`'s simpler `.sheet(item:)`
  usage scales cleanly here.

None of these five touched Firestore sync, Google sign-in, records,
sharing, or PDF export — those are all still exactly where they were (see
"What's next" below), and #1 on that list — the first on-device build — is
still the real blocker before any of this can be trusted.

## What's next, roughly in priority order

1. **First on-device build.** Hasn't been verified end-to-end in Xcode yet.
   Follow `ios/README.md` setup steps. This should happen before any more
   feature work — confirms the Firebase wiring and signing actually work.
2. **Firestore sync + Google sign-in** (medium effort). The thing that
   makes this a real "your data, your devices" app instead of a local toy.
   Needs: `GoogleSignIn-iOS` SDK, `REVERSED_CLIENT_ID` URL scheme from
   `GoogleService-Info.plist`, and sync/conflict-resolution logic (two
   devices scoring the same match) — that last part is genuine logic, not
   just SDK wiring. Also blocked on things Claude can't do from a Linux
   sandbox: adding SPM package dependencies happens in Xcode's UI, and the
   `REVERSED_CLIENT_ID`/plist values come from the Firebase console, not
   from source. Whoever picks this up needs Xcode open.
3. **Records/series stats** (medium) — aggregation across matches.
4. **Sharing/live-follow links** (medium) — needs a public, unauthenticated
   read path in Firestore plus a viewer UI.
5. **PDF export** (small–medium).
6. **Polish** (ongoing) — animations, haptics, edge cases, empty states.
   Also on this list now: adding a `teamId` link from Match back to Team,
   and (larger) bringing tournaments up from the single-round-robin slice
   to groups + knockout stage + Super Over + no-result + DLS (see "Recent
   source changes" above for the specific list).

## Setup reminder for whoever opens this in Xcode

No `.xcodeproj` is committed (binary project files diff badly). Follow
`ios/README.md` to generate one. Use Xcode's file-system-synchronized
groups (blue folder icons) when adding the `App`/`Views`/`Models`/
`Services` folders, not manual drag-in of loose files — otherwise every new
Swift file needs a manual "Add Files" step in Xcode after each `git pull`.
