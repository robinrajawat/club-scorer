// Registry of currently-mounted MatchScreen setters, keyed by match id. flushPendingWrites() runs
// on a timer/'online' event entirely outside React, with no normal way to reach a live component's
// state -- this is that channel. Pure in-memory closures, no DOM. Covered by
// tests/unit/liveMatchRegistry.test.js.

export const liveMatchSetters = {};

export function registerLiveMatch(id, setMatch) {
  liveMatchSetters[id] = setMatch;
}

export function unregisterLiveMatch(id) {
  delete liveMatchSetters[id];
}

export function notifyLiveMatchSynced(id, writeSeq) {
  if (writeSeq == null) return;
  const setMatch = liveMatchSetters[id];
  if (setMatch) setMatch(cur => cur && cur.id === id ? {
    ...cur,
    writeSeq
  } : cur);
}
