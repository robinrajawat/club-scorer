// Registry of currently-mounted MatchScreen setters, keyed by match id
// (src/core/liveMatchRegistry.js). A background sync (flushPendingWrites) needs a way to update a
// live-open match's writeSeq without going through React's normal render path — this is that
// channel.

import test from "node:test";
import assert from "node:assert/strict";
import { registerLiveMatch, unregisterLiveMatch, notifyLiveMatchSynced } from "../../src/core/liveMatchRegistry.js";

test("notifyLiveMatchSynced: calls the registered setter for that match id with an updated writeSeq", () => {
  let capturedUpdater = null;
  registerLiveMatch("m1", updater => { capturedUpdater = updater; });
  notifyLiveMatchSynced("m1", 7);
  assert.equal(typeof capturedUpdater, "function");
  const result = capturedUpdater({ id: "m1", writeSeq: 3, teamA: "A" });
  assert.deepEqual(result, { id: "m1", writeSeq: 7, teamA: "A" });
  unregisterLiveMatch("m1");
});

test("notifyLiveMatchSynced: the updater passes through unchanged if the current match id doesn't match", () => {
  let capturedUpdater = null;
  registerLiveMatch("m2", updater => { capturedUpdater = updater; });
  notifyLiveMatchSynced("m2", 9);
  const other = { id: "different-match", writeSeq: 1 };
  assert.equal(capturedUpdater(other), other);
  unregisterLiveMatch("m2");
});

test("notifyLiveMatchSynced: no-ops for an unregistered id or a null writeSeq", () => {
  // Neither of these should throw.
  notifyLiveMatchSynced("never-registered", 5);
  let called = false;
  registerLiveMatch("m3", () => { called = true; });
  notifyLiveMatchSynced("m3", null);
  assert.equal(called, false);
  unregisterLiveMatch("m3");
});

test("unregisterLiveMatch: a match no longer notified after unregistering", () => {
  let called = false;
  registerLiveMatch("m4", () => { called = true; });
  unregisterLiveMatch("m4");
  notifyLiveMatchSynced("m4", 1);
  assert.equal(called, false);
});
