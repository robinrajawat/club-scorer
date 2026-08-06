# Club Scorer

Ball-by-ball cricket scoring for friendly club and social games. Single HTML file, no installs, no build step — open it in a browser and start scoring.

**Live app:** https://www.clubscorer.com/

## Features

**Scoring**
- Ball-by-ball scoring for runs, wides, no-balls, byes, leg byes, and every dismissal type (bowled, caught, LBW, stumped, hit wicket, run out).
- Catch dismissals default the fielder to the wicketkeeper — most catches are theirs — but it's a one-tap change to anyone else on the picker.
- Automatic strike rotation, bowler tracking, and over completion. The over-by-over ball strip shows each delivery's over.ball number (e.g. `2.1`, `2.2`); a wide or no-ball doesn't consume a legal-ball slot, so it's labeled with the same number as whichever legal delivery eventually completes it.
- A running innings timer sits next to the run rate on the scoring screen — wall-clock time since the innings began, not a stopwatch (drinks breaks and delays just show up as time passing).
- Undo any ball if you tap the wrong thing mid-over.
- Short a player, or a match that just can't continue with a full XI? The "next batsman" prompt has a fallback to end the innings right there, behind a confirmation, instead of forcing you through an artificial 10-wicket wait.
- Retire a batsman who has to leave mid-innings — "Retired hurt" doesn't count as a wicket (no ball, no bowler credit, just a gap to fill with the next batsman); "Retired out" counts exactly like a normal dismissal. Scoped to whoever's currently on strike — swap strike first if it's the other end that needs to leave.
- House rules per match: balls per over, runs conceded on a wide or no-ball, Free Hit, and a maximum overs cap per bowler.
- Set an optional venue when starting a match — shown on the live scoring/follow screens and on the exported PDF.
- Match details (toss, house rules) are tucked behind a "Match details" toggle rather than always on screen, since most matches use the standard rules.
- Milestone toasts for the moments worth a moment — 50s and 100s for a batsman or a partnership, a 5-wicket haul, a hat-trick. Deliberately skips team totals crossing 50/100 (that's just the scoreboard doing its job), golden ducks (not something to celebrate for whoever's out), and maiden overs (barely an event) — all three still happen, they just don't interrupt the score with a toast.

**Teams & clubs**
- Save team rosters once, reuse them across matches. Set a captain and wicketkeeper per team; they're marked on the scorecard. Give a team a jersey color and it shows as a small swatch next to its name in the team list.
- Create a **club** to share rosters with your teammates: everyone in the club can see the same teams and use them for scoring, but only the club's owner can edit them. Join a club with an email-locked invite code from the owner; leave any time. Only the owner can rename the club, edit its description, or move teams in and out.
- Move an existing personal team into a club (or back out) from the Teams screen without re-entering it — owner only.
- Requires signing in with Google — clubs are per-account, not per-device.
- **Borrow a player** from another club's public player directory instead of re-typing their details — search by name, add them to your roster. A borrowed player's name, email, age, role, and batting/bowling hand stay locked (they're that club's to manage, shown with a "Borrowed" badge); jersey number is always yours to set locally, since that can genuinely differ between the teams they turn out for.
- **Federations** (a league or association, e.g. "DCF") are their own independent thing, not owned by any club. A club or federation can be switched to **Public**, which makes it discoverable by name (and owner) to any signed-in user. From there, either side can propose affiliating — a club owner searching for and requesting to join a public federation, or a federation owner searching for and inviting a public club — and the other side accepts or declines from a **Requests** screen (with a notification badge next to the profile button for anything waiting on you). Once affiliated, any other club in the same federation shows up as selectable opponents when you build a tournament — so if Billund Club and Esbjerg Club are both in DCF, Billund can build a tournament against Esbjerg's teams without ever recreating Esbjerg's roster.
- Club roles: just **owner** and **member**. The owner can add a **co-owner** — identical rights to the owner — by inviting them by email; there's no separate "admin" tier. Only the owner/co-owner can rename the club, edit its description, invite members or co-owners, manage teams and tournaments, remove members, or affiliate/leave a federation; only the original owner can delete the club outright.
- Federation roles: same owner/co-owner model. A federation's creator is its permanent owner and can rename it, edit its description, remove a member club (kicking a club only revokes its visibility in that federation — it never touches the removed club's own data), and add a co-owner by email.
- Removing a player from a team's roster goes through a confirmation, same as every other destructive action in the app — no more one-tap accidental removals.
- All of the above — creating/joining/renaming clubs, member and co-owner management, federation affiliation — lives under **Account → Manage Clubs & Federations**, not the Teams screen. Teams stays a fast roster picker for scoring; administering who's in a club or federation is a separate, less-frequent task.

**Players**
- A cross-club public player directory: publish a player from your club's roster (name + email, optionally age/role/batting-and-bowling hand), and any club can find and borrow them without retyping their details.
- Search the directory and open a player's profile to see their stats — runs, highest score, batting average and strike rate, wickets, best bowling figures, economy, and catches taken — scoped to their home club's own tournaments (there's no way to see every match a player's ever played across the whole app, since matches aren't indexed globally; the profile says so explicitly rather than pretending to be comprehensive).
- The home club's owner can unpublish a player (pulls them out of the directory without breaking any roster that already borrowed them) or delete their profile outright. Stats are computed fresh from match data every time, never stored on the player doc, so deleting a profile never loses history.

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
- Full backup and restore for a signed-in account, from Account → Your data: export your profile, teams, and matches to a `.json` file, and import that file back in later — into the same account to restore, or into a different one to migrate. Doesn't cover clubs (those are shared state owned by membership, not something a personal backup can safely restore) or matches only ever shared via a match code (those were never tied to your account to begin with).

**After the match**
- Full scorecard with batting and bowling figures, toss result, and Player of the Match.
- Saved matches show a relative date at a glance — Today, Yesterday, or the day and date further back.

**Tournaments**
- Build a group stage with one tap — round-robin fixtures (single or double, so every team plays every other team once or twice) generated automatically from whichever teams you pick, including teams borrowed from other clubs in the same federation. Dates are left blank on generation and filled in later per-fixture with a native date/time picker, since a real club season's scheduling rarely maps onto anything a generator could guess.
- Once the group stage is far enough along, a knockout bracket generates itself from the standings — Quarterfinal, Semifinal, or straight to a Final depending on how many teams are in it — seeded so the top two seeds can't meet before the final. The champion is declared automatically the moment the Final is decided.
- A **qualification calculator**: pick your team and a rival, plug in their current net run rate, and it works out the run target or rate you need in an upcoming fixture to overtake them in the table — handy in the business end of a round-robin where net run rate is close.
- Points table computed automatically from results, with net run rate.
- Batting and bowling stats scoped to that tournament only — no noisy all-time numbers.
- Player of the Tournament — auto-suggested (runs + 20 per wicket) or picked manually.
- Search tournaments by name and filter by status — Upcoming, Ongoing, Completed — computed from whether any of the tournament's fixtures have actually been played. Newest tournaments sort to the top, and each one shows its scheduled date range at a glance.
- "My Tournaments" shows a merged view across your personal tournaments and every club's, each tagged with which club it's from — pick a specific club chip to narrow down to just that club's list.
- **Share a live tournament** the same way you'd share a live match — a read-only link anyone can open to follow standings and fixtures as they update, revocable any time, with no way to edit anything even with the link.
- Export fixtures to your calendar as an `.ics` file, or export the whole standings-and-fixtures view to PDF via your browser's print dialog (same mechanism as a match scorecard).

**Works anywhere**
- Installable to your phone's home screen on both iOS and Android for an app-like icon and experience.
- Once loaded, the app keeps working with no signal — handy for grounds with patchy reception.
- Light, dark, or match-your-phone theme, set from Account → Appearance. Device-local, so it's a per-device preference rather than something that follows your account.

**No ads, no locked features**
- Everything in this app is free, with nothing gated behind a paywall or subscription. If Club Scorer is useful for your club, there's a low-key "Buy me a coffee" link tucked into Account → About — genuinely optional, never asked for anywhere else.

## Data & privacy

By default, matches and teams are saved in your browser's `localStorage`, tied to that browser on that device. A few ways to sync or share, all optional:

- **Sign in with Google** — tap the account button on the home screen. Your matches, teams, and clubs then follow you to any device you sign into. No password is ever seen by this app.
- **Score codes** — no sign-in needed. Tap "Invite to help score" on an in-progress match and share the code with a teammate so they can score along from their own phone. Anyone with this code can read *and write* that match, so treat it like a shared password, not a link to hand out publicly.
- **View links** — tap "Share live score" for a link anyone can open to watch the score update live. This is read-only: opening it, or even knowing the code inside the URL, never grants scoring access. Tournaments have the same read-only sharing for standings and fixtures.
- **Clubs** — team rosters shared with people who've joined via an invite code you generated. Only members can see or edit a club's teams; membership is by Google account, not by device. Club membership and co-ownership invites are always addressed to one specific email address, and only become real once someone signs in with that exact email — there's no way to invite "whoever finds this."
- **Federations** — a club or federation owner can switch on a **Public** toggle, which publishes a lightweight directory entry (just the name and owner's name — never the roster, member list, or anything else) so the other side can find and request affiliation. This is the one place in the app with an actual search/directory feature; everything else (club membership, co-ownership, federation co-ownership) stays strictly email-invite-only, with no way to browse or discover a person. Once affiliated, a club's team *names* (nothing else) become visible in the federation's directory, purely so tournaments can pick opponents from another club without recreating their roster — it grants no access to matches, membership, or players.
- **Public player directory** — publishing a player (from a team's roster) makes their name and whatever optional details you add (age, role, batting/bowling hand) findable by any signed-in user, so another club can borrow them onto their own roster without retyping. Unpublish or delete them any time from the player's profile — only their home club's owner can.

If you use none of the above, everything stays local, and clearing your browser's site data will wipe it.

## Running your own copy

This is a static site with a Firebase backend for the optional sync/sharing features (Google sign-in and Firestore). If you fork this to run your own instance:

1. Create a Firebase project, enable **Authentication** (Google provider) and **Firestore Database**.
2. Update the `firebaseConfig` object near the top of `index.html` with your project's config.
3. Paste [`firestore.rules`](firestore.rules) into **Firebase Console → Firestore Database → Rules → Publish**. The app will still load and score matches locally without this, but score codes, view links, account sync, clubs, federations, and the public player/club/federation directories all depend on it — none of that is optional plumbing, it's the actual access-control model, so don't skip it.
4. Serve `index.html`, `sw.js`, and `manifest.json` from the same origin (GitHub Pages, or any static host) — the service worker and manifest paths assume they're siblings of `index.html`.

No build step, no `npm install` — it's plain React and Firebase loaded from CDN `<script>` tags.

## License

MIT — see [LICENSE](LICENSE).
