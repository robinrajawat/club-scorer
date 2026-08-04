# Club Scorer

Ball-by-ball cricket scoring for friendly club and social games. Single HTML file, no installs, no build step — open it in a browser and start scoring.

**Live app:** https://robinrajawat.github.io/cricket-scorer

## Features

**Scoring**
- Ball-by-ball scoring for runs, wides, no-balls, byes, leg byes, and every dismissal type (bowled, caught, LBW, stumped, hit wicket, run out).
- Automatic strike rotation, bowler tracking, and over completion.
- Undo any ball if you tap the wrong thing mid-over.
- House rules per match: balls per over, runs conceded on a wide or no-ball, Free Hit, and a maximum overs cap per bowler.

**Teams**
- Save team rosters once, reuse them across matches.
- Set a captain and wicketkeeper per team; they're marked on the scorecard.

**Live score & sharing**
- A run rate chart plots both innings on the same graph, with wickets marked on the line.
- Get a match code and share a link (WhatsApp or anywhere else) so others can follow the score live, no app or sign-in needed on their end.
- A teammate with the code can also pick up scoring from their own phone.

**Sync & accounts**
- Sign in with Google to sync your matches and teams across devices.
- No sign-in required — everything works fully offline and stays local to your device if you'd rather not create an account.

**After the match**
- Full scorecard with batting and bowling figures, toss result, and Player of the Match.
- Career stats — batting and bowling numbers aggregated across all your matches.
- Export any scorecard to PDF via your browser's print dialog.

**Works anywhere**
- Add it to your phone's home screen for an app-like icon and experience.
- Once loaded, the app keeps working with no signal — handy for grounds with patchy reception.

## Data & privacy

By default, matches and teams are saved in your browser's `localStorage`, tied to that browser on that device. Two ways to sync across devices, both optional:

- **Sign in with Google** — tap the account button on the home screen. Your matches and teams then follow you to any device you sign into. No password is ever seen by this app.
- **Match codes** — no sign-in needed. Tap "Get Code" on an in-progress match and share the code with a teammate so they can follow or score along. Anyone with the code can read/write that match, so treat it like a shareable link.

If you use neither, everything stays local, and clearing your browser's site data will wipe it.

## License

MIT — see [LICENSE](LICENSE).
