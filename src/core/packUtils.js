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
  return {
    ...match,
    innings: match.innings.map(inn => ({
      ...inn,
      overs: inn.overs.map(balls => ({
        balls
      }))
    }))
  };
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
