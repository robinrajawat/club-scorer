# Club Scorer

Ball-by-ball cricket scoring for friendly club games — single-file, no build step.

## Publish on GitHub Pages

1. Create a new GitHub repo (e.g. `cricket-scorer`).
2. Add this `index.html` to the root of the repo (commit it directly, no build needed).
3. Go to **Settings → Pages** in the repo.
4. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
5. GitHub will give you a URL like `https://yourusername.github.io/cricket-scorer/` — that's your app.

## Notes

- **Data storage:** matches and teams are saved in the browser's `localStorage`, tied to that specific browser on that specific device. It won't sync between your phone and a teammate's phone, and clearing Safari's site data will wipe it. There's no login.
- **Add to Home Screen (iPhone):** open the published URL in Safari → tap Share → **Add to Home Screen**. It'll behave like a native app icon.
- **PDF export:** the "Export PDF" buttons use your browser's native print dialog — choose "Save as PDF" as the destination.
- No backend, no dependencies to install — React and fonts load from CDN at runtime, everything else is one HTML file.
