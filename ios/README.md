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

## What's stubbed

- **Google sign-in** — needs the `GoogleSignIn-iOS` SDK plus the
  `REVERSED_CLIENT_ID` URL scheme from `GoogleService-Info.plist` registered
  in Info.plist. Wiring it before that config exists fails silently on
  device, so `signInWithGoogle()` currently returns a clear "not yet wired
  up" message instead.
- Everything past sign-in: home screen, match scoring, teams, tournaments,
  sync. Ports next once auth is confirmed working end-to-end on your phone.
