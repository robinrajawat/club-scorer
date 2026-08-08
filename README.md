# Club Scorer

Ball-by-ball cricket scoring for friendly club and social games. Single HTML file, no installs, no build step — open it in a browser and start scoring.

**Live app:** https://www.clubscorer.com/

## Features

**Scoring**
- Ball-by-ball scoring for runs, wides, no-balls, byes, leg byes, and every dismissal type (bowled, caught, LBW, stumped, hit wicket, run out).
- Catch dismissals default the fielder to the wicketkeeper — most catches are theirs — but it's a one-tap change to anyone else on the picker.
- Run out also captures the fielder (skip it if who actually made the throw isn't clear), how many runs the pair had completed before the wicket fell, and whether it happened on a wide or no-ball (a stumping can be marked off a wide the same way — the Laws don't allow one off a no-ball, so that option isn't offered there). An odd number of completed runs flags a reminder to double-check the batting pair rather than the app guessing which way strike crossed.
- Every dismissal (and a retirement) is recorded against whoever's currently on strike — if it's actually the other end, Swap Strike is one tap away right inside that popup, no need to back out and find it separately first.
- The toss (who won it and what they chose) is required before a match can start. Flip Coin is just a shortcut for filling it in, not a substitute for recording it.
- Automatic strike rotation, bowler tracking, and over completion. The over-by-over ball strip shows each delivery's over.ball number (e.g. `2.1`, `2.2`); a wide or no-ball doesn't consume a legal-ball slot, so it's labeled with the same number as whichever legal delivery eventually completes it.
- A running innings timer sits next to the run rate on the scoring screen — wall-clock time since the innings began, not a stopwatch (drinks breaks and delays just show up as time passing).
- Undo any ball if you tap the wrong thing mid-over.
- Short a player, or a match that just can't continue with a full XI? The "next batsman" prompt has a fallback to end the innings right there, behind a confirmation, instead of forcing you through an artificial 10-wicket wait. The same "End innings" action is also available any time from the main scoring screen, for closing an innings out voluntarily — bad weather, running out of time, a forfeit — not just when you're stuck without a batsman.
- Retire a batsman who has to leave mid-innings — "Retired hurt" doesn't count as a wicket (no ball, no bowler credit, just a gap to fill with the next batsman); "Retired out" counts exactly like a normal dismissal. Scoped to whoever's currently on strike, with Swap Strike right there in the popup if it's the other end that needs to leave. A retired-hurt batsman can come back in later the same innings (the Laws allow it) — they just reappear as a normal option on the next batsman picker once someone else is out. The one thing still blocked: coming straight back on the very prompt their own retirement opened — resuming has to wait for the side to actually lose another wicket first, same as the real rule.
- Starting a match walks through a few short steps — Teams & Format, Match Rules, Playing XI (skipped entirely if neither team has a saved squad), Opening Line-up, then a Review screen summarizing everything (teams, toss, rules, openers) before it locks in. Match Rules collapses to a one-line summary by default and only expands if you tap "Customize" — most matches reuse whatever was set last time, so there's no need to re-scroll past 7 settings that are almost always already right. Starting a match from a tournament or series fixture inherits that tournament's rules and venue automatically once its first fixture has been scored, rather than asking again for every single fixture.
- Players per side is configurable on Teams & Format (11 standard, or 6\u20139 for a shorter format) \u2014 it sets how many players the Playing XI picker asks for, so a 9-a-side match doesn't force you to fill 11 slots just because a saved squad has more than 9 people on it.
- House rules per match: balls per over, runs conceded on a wide or no-ball, Free Hit, and a maximum overs cap per bowler.
- Optional powerplay: set how many overs at the start of each innings count as the powerplay, and a badge shows on the scoring screen while it's in effect. Informational only — there's no fielder-position tracking in the app for an actual "max fielders outside the circle" restriction to enforce, so this marks the window rather than pretending to police it.
- Optional time cap per innings: set a target in minutes, and an "OVER TIME" badge shows up once an innings runs past it. A flag, not a stop — nothing about scoring is blocked or auto-ended, since real innings overrun for all kinds of legitimate reasons (a longer changeover, a slow over, an extended drinks break) that the app has no way to judge.
- Set an optional venue when starting a match — shown on the live scoring/follow screens and on the exported PDF.
- Match details (toss, house rules) are tucked behind a "Match details" toggle rather than always on screen, since most matches use the standard rules.
- Milestone toasts for the moments worth a moment. Permanent (shown on the scorecard/commentary too): individual and partnership 50s/100s, a 5-wicket haul, a hat-trick. Toast-only (a pop-up, nothing added to the scorecard — the score itself already shows it, or it's a nice-to-notice rather than a stat): a team total crossing 50/100, a maiden over (or a wicket maiden, if it also took a wicket), a 3-wicket haul, two wickets in the same over, a duck in any of its three tiers, a breakthrough wicket ending a partnership that had lasted 24+ balls, and the first boundary after an 18+ ball drought (only counts a boundary actually hit off the bat — a wide or bye running away to the fence isn't a batting boundary and doesn't reset it).
- Found a mistake after the match already ended? "Fix a mistake" on the result screen reopens the last innings for correction — Undo and everything else works again from there, same as live scoring. Scoped to the most recent innings only: an earlier one can't be reopened once a later one has real balls in it, since the target, the result, and (in a tournament) NRR all depend on that total by then.

**Teams & clubs**
- Save team rosters once, reuse them across matches. Set a captain and wicketkeeper per team; they're marked on the scorecard. Give a team a jersey color and it shows as a small swatch next to its name in the team list.
- Create a **club** to share rosters with your teammates: everyone in the club can see the same teams and use them for scoring, but only the club's owner can edit them. Join a club with an email-locked invite code from the owner; leave any time. Only the owner can rename the club, edit its description, or move teams in and out.
- Move an existing personal team into a club (or back out) from the Teams screen without re-entering it — owner only.
- Requires signing in with Google — clubs are per-account, not per-device.
- **Borrow a player** from another club's public player directory instead of re-typing their details — search by name, add them to your roster. A borrowed player's name, email, age, role, and batting/bowling hand stay locked (they're that club's to manage, shown with a "Borrowed" badge); jersey number is always yours to set locally, since that can genuinely differ between the teams they turn out for.
- **Federations** (a league or association, e.g. "DCF") are their own independent thing, not owned by any club. A club or federation can be switched to **Public**, which makes it discoverable by name (and owner) to any signed-in user. From there, either side can propose affiliating — a club owner searching for and requesting to join a public federation, or a federation owner searching for and inviting a public club — and the other side accepts or declines from a **Requests** screen (with a notification badge next to the profile button for anything waiting on you). Once affiliated, any other club in the same federation shows up as selectable opponents when you build a tournament — so if Billund Club and Esbjerg Club are both in DCF, Billund can build a tournament against Esbjerg's teams without ever recreating Esbjerg's roster.
- A federation can also host its own tournament directly, not just lend teams to a club-hosted one — the natural fit for a district-wide or league-wide competition that isn't really "owned" by any single member club. Pick the federation as the source when creating a tournament (same chip row as switching between your own tournaments and a club's), and its team picker draws straight from every affiliated club's roster. Only the federation's owner/co-owner can create or manage one; anyone signed in can view it, the same openness as the federation's own name and team directory.
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
- Once the group stage is far enough along, a knockout bracket generates itself from the standings — Quarterfinal, Semifinal, or straight to a Final depending on how many teams are in it — seeded so the top two seeds can't meet before the final. The champion is declared automatically the moment the Final is decided. A live preview on the creation form shows what shape actually results from your team count and (if you turn groups on) your group/advance-per-group settings, before you commit to it.
- Not every tournament's playoffs are a straight elimination — the IPL's Qualifier 1 / Eliminator / Qualifier 2 / Final format gives the top two teams a second chance instead. That shape isn't auto-generated, but you can build it by hand: "Add a fixture" on the schedule lets you give a fixture a custom Stage label, which keeps it out of the points table and NRR exactly like the auto-generated bracket already is, and shows it in its own "Playoffs" section rather than mixed into the regular schedule.
- **Groups/pools**: split a tournament into 2\u20134 groups when you create it (e.g. "Group A" / "Group B") — round-robin then only happens within each group, never across them, and each group gets its own points table. Set how many teams advance per group, and the knockout bracket seeds itself cross-group (Group A's #1 plays Group B's #2, and vice versa) once every group fixture is played, rather than one combined table feeding a single seeded bracket.
- A **qualification calculator**: pick your team and a rival, plug in their current net run rate, and it works out the run target or rate you need in an upcoming fixture to overtake them in the table — handy in the business end of a round-robin where net run rate is close.
- Points table computed automatically from results, with net run rate.
- Batting and bowling stats scoped to that tournament only — no noisy all-time numbers.
- Player of the Tournament — auto-suggested (runs + 20 per wicket) or picked manually.
- Search tournaments by name and filter by status — Upcoming, Ongoing, Completed — computed from whether any of the tournament's fixtures have actually been played. Newest tournaments sort to the top, and each one shows its scheduled date range at a glance.
- "My Tournaments" shows a merged view across your personal tournaments and every club's, each tagged with which club it's from — pick a specific club chip to narrow down to just that club's list.
- **Share a live tournament** the same way you'd share a live match — a read-only link anyone can open to follow standings and fixtures as they update, revocable any time, with no way to edit anything even with the link.
- Export fixtures to your calendar as an `.ics` file, or export the whole standings-and-fixtures view to PDF via your browser's print dialog (same mechanism as a match scorecard).
- **Head-to-head series**: from the Tournaments screen, "start a head-to-head series instead" sets up a run of matches between exactly two teams — pick both teams and how many matches, and every fixture is generated between them automatically. Shows a running series score ("Riverside XI leads 2–1") instead of a points table, with the same fixture list, match-linking, and Player of the Series as a tournament. No knockout bracket, qualification calculator, live-share link, or NRR — none of that means anything for two sides just playing each other repeatedly, so it stays out rather than being included for the sake of parity.

**Works anywhere**
- Installable to your phone's home screen on both iOS and Android for an app-like icon and experience.
- Once loaded, the app keeps working with no signal — handy for grounds with patchy reception.
- Light, dark, or match-your-phone theme, set from Account → Appearance. Device-local, so it's a per-device preference rather than something that follows your account.

**Help & orientation**
- A short, dismissible tour on first launch — just the handful of things you genuinely wouldn't discover by exploring (score codes vs. view codes, borrowing a player, clubs/federations, tournaments vs. series), not a full walkthrough. Shown once per device, skippable at any point.
- A Help & FAQ screen (Account → Help & FAQ) for looking the same things up again later — short, curated answers to the non-obvious stuff, not a duplicate of this README. Includes a link to replay the first-launch tour any time.

**No ads, no locked features**
- Everything in this app is free, with nothing gated behind a paywall or subscription. If Club Scorer is useful for your club, there's a low-key "Buy me a coffee" link tucked into Account → About — genuinely optional, never asked for anywhere else.

## Data & privacy

By default, matches and teams are saved in your browser's `localStorage`, tied to that browser on that device. A few ways to sync or share, all optional:

- **Sign in with Google** — tap the account button on the home screen. Your matches, teams, and clubs then follow you to any device you sign into. No password is ever seen by this app.
- **Score codes** — no sign-in needed. Tap "Invite to help score" on an in-progress match and share the code with a teammate so they can score along from their own phone. Anyone with this code can read *and write* that match, so treat it like a shared password, not a link to hand out publicly.
- **View links** — tap "Share live score" for a link anyone can open to watch the score update live. This is read-only: opening it, or even knowing the code inside the URL, never grants scoring access. Tournaments have the same read-only sharing for standings and fixtures.
- **Clubs** — team rosters shared with people who've joined via an invite code you generated. Only members can see or edit a club's teams; membership is by Google account, not by device. Club membership and co-ownership invites are always addressed to one specific email address, and only become real once someone signs in with that exact email — there's no way to invite "whoever finds this."
- **Federations** — a club or federation owner can switch on a **Public** toggle, which publishes a lightweight directory entry (just the name and owner's name — never the roster, member list, or anything else) so the other side can find and request affiliation. This is the one place in the app with an actual search/directory feature; everything else (club membership, co-ownership, federation co-ownership) stays strictly email-invite-only, with no way to browse or discover a person. Once affiliated, a club's team *names* (nothing else) become visible in the federation's directory, purely so tournaments can pick opponents from another club without recreating their roster — it grants no access to matches, membership, or players. A federation-hosted tournament lives in that same open tier — any signed-in user can read one, same as the directory itself, rather than needing to check membership across every affiliated club (which doesn't scale as a federation grows). Only the owner/co-owner can create or edit one.
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
