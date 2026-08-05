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
- Create a **club** to share rosters with your teammates: everyone in the club can see the same teams and use them for scoring, but only the club's owner can edit them. Join a club with an email-locked invite code from the owner; leave any time. Only the owner can rename the club, edit its description, or move teams in and out.
- Move an existing personal team into a club (or back out) from the Teams screen without re-entering it — owner only.
- Requires signing in with Google — clubs are per-account, not per-device.
- Affiliate a club with a **federation** (e.g. a league or association like "DCF") using an email-locked invite from the federation owner. Any other club in the same federation shows up as selectable opponents when you build a tournament — so if Billund Club and Esbjerg Club are both in DCF, Billund can build a tournament against Esbjerg's teams without ever recreating Esbjerg's roster. Federation visibility is read-only and name-only: it never exposes another club's matches, membership, or player list.
- Club roles: just **owner** and **member**. The owner can add a **co-owner** — identical rights to the owner — by inviting them by email; there's no separate "admin" tier. Only the owner/co-owner can rename the club, edit its description, invite members or co-owners, manage teams and tournaments, remove members, or affiliate/leave a federation; only the original owner can delete the club outright.
- Federation roles: same owner/co-owner model. A federation's creator is its permanent owner and can rename it, edit its description, remove a member club (kicking a club only revokes its visibility in that federation — it never touches the removed club's own data), invite a club to affiliate by email, or add a co-owner by email. Every invite in the app — club membership, club co-ownership, federation affiliation, federation co-ownership — is addressed to one specific email address and only becomes real once someone signed in with that exact email redeems the code; there's no open user directory or search anywhere in this app, so email is the only way to name a specific person.
- All of the above — creating/joining/renaming clubs, member and co-owner management, federation affiliation — lives under **Account → Manage Clubs & Federations**, not the Teams screen. Teams stays a fast roster picker for scoring; administering who's in a club or federation is a separate, less-frequent task.

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
- **Federations** — a much thinner sharing tier on top of clubs. Affiliating a club with a federation code publishes that club's team *names* (nothing else) into a directory any other member club can read, purely so tournaments can pick opponents from another club without recreating their roster. It grants no access to matches, membership, or players.

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
