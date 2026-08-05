# Club Scorer

Ball-by-ball cricket scoring for friendly club and social games. Single HTML file, no installs, no build step — open it in a browser and start scoring.

**Live app:** https://robinrajawat.github.io/cricket-scorer

## Features

**Scoring**
- Ball-by-ball scoring for runs, wides, no-balls, byes, leg byes, and every dismissal type (bowled, caught, LBW, stumped, hit wicket, run out).
- Automatic strike rotation, bowler tracking, and over completion.
- Undo any ball if you tap the wrong thing mid-over.
- House rules per match: balls per over, runs conceded on a wide or no-ball, Free Hit, and a maximum overs cap per bowler.
- Match details (toss, house rules) are tucked behind a "Match details" toggle rather than always on screen, since most matches use the standard rules.

**Teams & clubs**
- Save team rosters once, reuse them across matches. Set a captain and wicketkeeper per team; they're marked on the scorecard.
- Create a **club** to share rosters with your teammates: everyone in the club can see and edit the same teams, so whoever's scoring doesn't have to re-type a squad someone else already entered. Join a club with an invite code from an existing member; leave any time.
- Move an existing personal team into a club (or back out) from the Teams screen without re-entering it.
- Requires signing in with Google — clubs are per-account, not per-device.

**Live score & sharing**
- Runs-per-over and run-rate charts, with the most expensive over highlighted and each bar labeled.
- Two distinct kinds of sharing, deliberately kept separate:
  - **"Invite to help score"** — gives a code that grants full scoring access. Share it only with someone you actually want scoring alongside you.
  - **"Share live score"** — gives a read-only link anyone can open to follow along (WhatsApp or anywhere else), with no way to edit the match even if they have the link. This is a genuinely different code from the scoring one, not just a hidden button, so a viewer link can never be used to gain write access.
- Export any scorecard to PDF via your browser's print dialog.

**Sync, offline, and multi-device scoring**
- Sign in with Google to sync your matches, teams, and clubs across devices. No sign-in required — everything works fully offline and stays local to your device if you'd rather not create an account.
- If you lose signal mid-match (common enough at most grounds), scoring keeps working and queues locally; it retries automatically once you're back online, with a small "not synced" indicator so you know it hasn't gone through yet.
- If a match is being scored from two devices at once (via an "Invite to help score" code) and they genuinely diverge, you'll get a clear prompt to pick which version to keep rather than one device silently overwriting the other.

**After the match**
- Full scorecard with batting and bowling figures, toss result, and Player of the Match.

**Tournaments**
- Points table computed automatically from results, with net run rate.
- Batting and bowling stats scoped to that tournament only — no noisy all-time numbers.
- Player of the Tournament — auto-suggested (runs + 20 per wicket) or picked manually.

**Works anywhere**
- Installable to your phone's home screen on both iOS and Android for an app-like icon and experience.
- Once loaded, the app keeps working with no signal — handy for grounds with patchy reception.

## Data & privacy

By default, matches and teams are saved in your browser's `localStorage`, tied to that browser on that device. A few ways to sync or share, all optional:

- **Sign in with Google** — tap the account button on the home screen. Your matches, teams, and clubs then follow you to any device you sign into. No password is ever seen by this app.
- **Score codes** — no sign-in needed. Tap "Invite to help score" on an in-progress match and share the code with a teammate so they can score along from their own phone. Anyone with this code can read *and write* that match, so treat it like a shared password, not a link to hand out publicly.
- **View links** — tap "Share live score" for a link anyone can open to watch the score update live. This is read-only: opening it, or even knowing the code inside the URL, never grants scoring access.
- **Clubs** — team rosters shared with people who've joined via an invite code you generated. Only members can see or edit a club's teams; membership is by Google account, not by device.

If you use none of the above, everything stays local, and clearing your browser's site data will wipe it.

## Running your own copy

This is a static site with a Firebase backend for the optional sync/sharing features (Google sign-in and Firestore). If you fork this to run your own instance:

1. Create a Firebase project, enable **Authentication** (Google provider) and **Firestore Database**.
2. Update the `firebaseConfig` object near the top of `index.html` with your project's config.
3. Paste [`firestore.rules`](firestore.rules) into **Firebase Console → Firestore Database → Rules → Publish**. The app will still load and score matches locally without this, but score codes, view links, account sync, and clubs all depend on it — none of that is optional plumbing, it's the actual access-control model, so don't skip it.
4. Serve `index.html`, `sw.js`, and `manifest.json` from the same origin (GitHub Pages, or any static host) — the service worker and manifest paths assume they're siblings of `index.html`.

No build step, no `npm install` — it's plain React and Firebase loaded from CDN `<script>` tags.

## License

MIT — see [LICENSE](LICENSE).
