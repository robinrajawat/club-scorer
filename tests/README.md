# Regression suite

```
npm test
```

Run this before pushing any change that touches scoring, standings, or
DLS logic. The tested logic lives in `src/core/` — `docs/index.html` is
generated from those modules (see `scripts/generate.js`), so testing
`src/core/` directly and keeping `docs/index.html` in sync via
`npm run generate` is what tests exactly what's about to ship, without
`docs/index.html` and its logic ever being able to silently drift apart.
Run `npm run generate:verify` to check that they haven't (it fails loudly
if `docs/index.html` doesn't match what `src/core/*.js` would produce).

- `src/core/scoringEngine.js` / `tests/unit/scoringEngine.test.js` —
  the ball-by-ball scoring engine (`newInning`, `applyBall`,
  `ensureBatsman`, `ensureBowler`).
- `src/core/packUtils.js` / `tests/unit/packUtils.test.js` — Firestore
  write-shaping and validation (`packMatchForFirestore`,
  `findEmptyKeyPath`).
- `src/core/appLogic.js` / `tests/unit/appLogic.test.js` — tournament
  standings and DLS (`computeStandings`, `dlsTarget`,
  `dlsResourcePercent`, `oversLeftTrueDecimal`); the file also carries
  some unrelated app-wide helpers (local-storage prefs, a couple of UI
  hooks) that aren't unit-testable in Node and aren't covered here.
- `src/core/statsAndFixtures.js` / `tests/unit/statsAndFixtures.test.js` —
  round-robin fixture generation, player/club stats aggregation, and the
  Player-of-the-Match / Best-Fielder / Player-of-the-Tournament suggestion
  heuristics.

The first three modules above are each one contiguous span of
`docs/index.html`, spliced in as a block (`// GENERATED-START: <name>` /
`// GENERATED-END: <name>`). `statsAndFixtures.js` is different: its
functions are scattered as individual, non-contiguous declarations among
`docs/index.html`'s React components, so each one is wrapped in place with
its own `// GENERATED-FN-START: <name>` / `// GENERATED-FN-END: <name>`
pair instead of being physically relocated — see `scripts/generate.js`'s
`FUNCTIONS` list for the pattern to follow when pulling out the next
scattered pure-logic function.

Every case in this suite exists because of a real bug that shipped and
was hard to trace once it did, or because the logic it covers is
high-stakes and had zero coverage — see the comment at the top of each
test file. When you fix a bug in this logic, add a case for it before
considering the fix done.
