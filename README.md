# Club Scorer

Ball-by-ball cricket scoring for friendly club games — single-file, no build step.

## Publish on GitHub Pages

1. Create a new GitHub repo (e.g. `cricket-scorer`).
2. Add this `index.html` to the root of the repo (commit it directly, no build needed).
3. Go to **Settings → Pages** in the repo.
4. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
5. GitHub will give you a URL like `https://yourusername.github.io/cricket-scorer/` — that's your app.

## Notes

- **Data storage:** by default, matches and teams are saved in the browser's `localStorage`, tied to that specific browser on that specific device. Two ways to sync across devices:
  - **Sign in with Google** — tap the account button (top-right on the home screen) to open the Account screen, sign in, and optionally set a display name. Your matches and teams then sync to your account and follow you to any device you sign into. No password is ever seen by this app.
  - **Match codes** — no sign-in needed. Tap "Get Code" on an in-progress match to generate an 8-character code; a teammate enters it under "Have a match code?" on their home screen to pick up scoring on their phone. Anyone with the code can read/write that match, so treat it like a shareable link.
  If you don't use either, everything stays local and won't sync, and clearing Safari's site data will wipe it.
- **Add to Home Screen (iPhone):** open the published URL in Safari → tap Share → **Add to Home Screen**. It'll behave like a native app icon.
- **PDF export:** the "Export PDF" buttons use your browser's native print dialog — choose "Save as PDF" as the destination.
- No backend, no dependencies to install — React and fonts load from CDN at runtime, everything else is one HTML file.
