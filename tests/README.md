# Regression suite

```
node tests/run.js
```

Run this before pushing any change that touches scoring logic
(`newInning`, `applyBall`, `ensureBatsman`, `ensureBowler`,
`packMatchForFirestore`, `findEmptyKeyPath`).

This does **not** test a copy of that logic — `run.js` extracts the
functions straight out of the current `index.html` between the
`TEST-EXTRACT-START` / `TEST-EXTRACT-END` comment markers, so it
always tests exactly what's about to ship. If you move or rename any
of those functions, keep the markers around them (see the comments
next to each one in `index.html`) — the test runner will throw a
clear error naming the missing marker rather than silently testing
stale code.

Every case in this suite exists because of a real bug that shipped
and was hard to trace once it did — see the comment at the top of
`run.js` for the two so far. When you fix a bug in the scoring
engine, add a case here for it before considering the fix done.
