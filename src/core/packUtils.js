// Firestore write-shaping and validation helpers. Self-contained — no dependencies outside this
// file — and covered by tests/unit/packUtils.test.js.
export function packMatchForFirestore(match) {
  // Firestore rejects any array that directly contains another array ("nested arrays").
  // inning.overs is exactly that: an array of per-over ball-event arrays. Every previous fix in
  // this area was chasing symptoms — this is the actual reason every write here has always failed.
  // Wrap each over's ball array in a small object so the outer structure becomes array-of-maps
  // (which Firestore allows) instead of array-of-arrays (which it rejects outright). This only
  // affects what gets sent to Firestore — the runtime/in-memory shape the whole engine uses is
  // untouched.
  const packed = {
    ...match,
    innings: match.innings.map(inn => ({
      ...inn,
      overs: inn.overs.map(balls => ({
        balls
      }))
    }))
  };
  // Firestore's client SDK rejects ANY field whose value is the JS primitive `undefined` outright
  // ("Function Transaction.set() called with invalid data. Unsupported field value: undefined") --
  // a real, currently-reported production failure, not a hypothetical. Several call sites build
  // objects with a `foo || undefined` pattern (e.g. every ball's `bigHit` field in
  // scoringEngine.js's applyBall -- explicitly `undefined`, not merely absent, on every single ball
  // that isn't a bonus hit), which is indistinguishable from a real value once assigned as an
  // object key -- unlike a key that was simply never set. JSON.stringify already silently drops any
  // object key whose value is undefined (though it turns an undefined ARRAY ELEMENT into null
  // instead -- not a concern here, nothing in a match document is ever an array of possibly-missing
  // values), so round-tripping through it is the simplest reliable fix, cheaper than writing and
  // maintaining a bespoke recursive walker for what JSON already does correctly. packMatchForFirestore
  // builds a brand new object above anyway, so nothing here depends on identity surviving intact.
  return JSON.parse(JSON.stringify(packed));
}
// Firestore rejects a map with a literal empty-string key ("Document fields must not be empty"),
// which gives no indication of WHERE in a large match document that key is — unhelpful even with
// devtools open, and unreachable at all when the person reporting it is on a phone. This walks the
// data that's actually about to be sent and returns a human-readable path to the first empty key
// it finds (or null), so savePrimaryMatch can catch this before attempting the write and surface
// exactly where the problem is — e.g. "innings[1].batsmen" for an empty batsman name.
export function findEmptyKeyPath(obj, path) {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const found = findEmptyKeyPath(obj[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  for (const k of Object.keys(obj)) {
    if (k === "") return path || "(root)";
    const found = findEmptyKeyPath(obj[k], path ? `${path}.${k}` : k);
    if (found) return found;
  }
  return null;
}

// The read-side counterpart to packMatchForFirestore above -- undoes its overs-wrapping and
// defensively normalizes any overs entry that isn't already a plain array (a genuine production
// crash: a malformed historical write left a non-array overs entry, which then crashed
// OversStrip's render downstream). Covered by tests/unit/packUtils.test.js.
export function unpackMatchFromFirestore(match) {
  if (!match || !match.innings) return match;
  return {
    ...match,
    innings: match.innings.map(inn => ({
      ...inn,
      // `o.balls || []` only guarded against o.balls being falsy -- if it was truthy but NOT
      // actually an array (an empty object from some malformed historical write, say), it passed
      // straight through unchanged. That silently produced a non-array "balls" entry in overs,
      // which then crashed OversStrip's render later (balls.reduce/.filter is not a function) --
      // a genuine reported crash on FollowScreen, not a hypothetical. Also guards `o` itself being
      // null/undefined, which the old ternary's else-branch would have thrown on immediately
      // (Cannot read properties of null (reading 'balls')) rather than falling back to [].
      overs: (inn.overs || []).map(o => {
        if (Array.isArray(o)) return o;
        const balls = o && o.balls;
        return Array.isArray(balls) ? balls : [];
      })
    }))
  };
}
