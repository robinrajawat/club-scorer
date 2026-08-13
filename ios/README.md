# Cricket Scorer — iOS

Native SwiftUI port. Source files live under `CricketScorer/CricketScorer/` —
there's no `.xcodeproj` committed (binary project files diff badly and are easy
to corrupt outside Xcode), so the first step is generating one locally.

## 1. Create the Xcode project

1. Open Xcode → File → New → Project → iOS → App.
2. Product name: `CricketScorer`. Interface: SwiftUI. Language: Swift.
3. Bundle identifier: `com.robinrajawat.cricketscorer`.
4. Save it *inside* `ios/CricketScorer/` (so it sits next to this repo's source
   files, not nested another level deeper).
5. Delete the default `ContentView.swift` and `CricketScorerApp.swift` that
   Xcode generates — the ones in this repo replace them.
6. Drag the `App/`, `Views/`, `Models/`, `Services/` folders from this repo
   into the Xcode project navigator. Check "Copy items if needed" is
   **unchecked** (they're already in place) and "Create groups" is selected.

## 2. Add Firebase

1. Xcode → File → Add Package Dependencies →
   `https://github.com/firebase/firebase-ios-sdk`.
2. Add these products to the `CricketScorer` target: `FirebaseAuth`,
   `FirebaseCore`. (`FirebaseFirestore` comes later once match data syncing
   is ported.)
3. In the [Firebase console](https://console.firebase.google.com), open the
   same project the web app uses, add an iOS app with the bundle ID above,
   download `GoogleService-Info.plist`, and drag it into the Xcode project
   root (target membership: `CricketScorer`). This file is gitignored — it's
   not committed, so every machine building this needs its own copy from the
   console.

## 3. Run on your iPhone with a free Apple ID

1. Plug in your iPhone, or use wireless debugging (Xcode → Window → Devices
   and Simulators → pair once over the same Wi-Fi).
2. Project settings → Signing & Capabilities → Team → sign in with your
   Apple ID → it creates a "Personal Team" automatically. No paid enrollment
   needed for this.
3. Select your iPhone as the run destination, hit Run.
4. First run: on the iPhone, Settings → General → VPN & Device Management →
   trust your developer certificate.
5. The build expires after 7 days — just re-run from Xcode to re-sign, no
   other setup needed.

**Free-tier limits to know:** no TestFlight or App Store distribution, no
Push Notifications capability, and Apple caps you at 10 new app IDs per
rolling 7 days — so stick with this one bundle ID rather than recreating the
project under a new identifier.

## What's ported so far

- Email/password sign-in, sign-up, and password reset, with error copy
  matching the web app's `friendlyEmailAuthError()`.
- Welcome screen layout (logo, Google button, divider, email flow).
- Home screen: local matches list, new match, swipe to delete.
- New match setup: team names, players, overs, who bats first — plus,
  since this session, a "fill from saved team" menu sourced from a Teams
  screen (add/edit/delete saved rosters, search).
- Full ball-by-ball scoring: runs, wides, no-balls, byes, leg byes,
  wickets (with type — including run-out with completed-runs credit),
  free hits, automatic strike rotation (including the
  odd-runs-on-last-ball rule and crossing on completed run-out runs),
  new-bowler and new-batter prompts, second-innings target/required-rate,
  undo of the last-recorded ball, and a result screen.
- Tournaments: create a round-robin from ≥2 saved teams, start/resume each
  fixture as a real match, and a points/NRR standings table. Deliberately
  scoped down from the web app — no groups, no knockout stage, no
  qualification-scenario math (see STATUS.md).

This is a genuinely playable single-device scorer end to end — not a demo
screen.

## Known simplifications (vs. the web app)

These are deliberate cuts to get a working core loop shipped, not bugs:

- **No cloud sync yet.** Matches are stored locally on-device
  (`UserDefaults`/JSON) via `MatchStore`. The web app's Firestore sync,
  multi-device continuity, and share/live-follow links aren't ported.
- **No Google sign-in yet** — see below.
- **No records/series stats, no PDF export, no polls, no push
  notifications.**
- **No manual batting-order override** — next batter is chosen from a
  picker of unused players, not a drag-reordered lineup.
- **Tournaments are single-group round-robin only** — no groups, no
  knockout bracket, no Super Over tie-break, no no-result/abandoned-match
  handling, no DLS/revised-overs. See STATUS.md's TournamentEngine notes
  for the full list of what a real port still needs versus this first slice.

Five items formerly on this list — run-out partial runs, free-hit
tracking, undo, teams/players management, and a first tournaments slice —
now have source written. See STATUS.md for what changed in each and
what's still unverified, since none of it has been run in Xcode yet.

## What's stubbed

- **Google sign-in** — needs the `GoogleSignIn-iOS` SDK plus the
  `REVERSED_CLIENT_ID` URL scheme from `GoogleService-Info.plist` registered
  in Info.plist. Wiring it before that config exists fails silently on
  device, so `signInWithGoogle()` currently returns a clear "not yet wired
  up" message instead.
