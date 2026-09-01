// localStorage-backed match index, offline write outbox, and per-match undo history
// (src/core/localStorageOutbox.js). Every localStorage access here goes through a try/catch, which
// is exactly what makes it testable in Node: this file installs a small in-memory localStorage
// polyfill (and, for one case, a throwing one) on globalThis before each test.

import test from "node:test";
import assert from "node:assert/strict";
import {
  lsSetItem, lsGetIndex, lsSetIndex, upsertLocalPointer,
  lsPendingIds, lsSetPendingIds, queuePendingWrite, clearPendingWrite, pendingWriteCount,
  pruneOrphanedPendingWrites, undoHistoryKey, loadUndoHistory, saveUndoHistory, clearUndoHistory
} from "../../src/core/localStorageOutbox.js";

function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); }
  };
  return store;
}

test.beforeEach(() => {
  installFakeLocalStorage();
});

test.after(() => {
  delete globalThis.localStorage;
});

test("lsSetItem: succeeds against a working localStorage", () => {
  const result = lsSetItem("k", "v");
  assert.deepEqual(result, { ok: true });
  assert.equal(globalThis.localStorage.getItem("k"), "v");
});

test("lsSetItem: reports quotaExceeded distinctly from other failures", () => {
  globalThis.localStorage = {
    setItem: () => { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; }
  };
  const result = lsSetItem("k", "v");
  assert.equal(result.ok, false);
  assert.equal(result.quotaExceeded, true);
  assert.match(result.error, /local storage is full/);
});

test("lsSetItem: a non-quota failure reports quotaExceeded:false with the raw error message", () => {
  globalThis.localStorage = {
    setItem: () => { throw new Error("some other failure"); }
  };
  const result = lsSetItem("k", "v");
  assert.equal(result.ok, false);
  assert.equal(result.quotaExceeded, false);
  assert.equal(result.error, "some other failure");
});

test("lsGetIndex/lsSetIndex: round-trips a match index, capped at 50 entries", () => {
  const long = Array.from({ length: 60 }, (_, i) => ({ id: "m" + i }));
  lsSetIndex(long);
  const read = lsGetIndex();
  assert.equal(read.length, 50);
  assert.equal(read[0].id, "m0");
});

test("lsGetIndex: returns [] for missing or corrupt stored JSON rather than throwing", () => {
  assert.deepEqual(lsGetIndex(), []);
  globalThis.localStorage.setItem("cricket-scorer:matches-index", "{not json");
  assert.deepEqual(lsGetIndex(), []);
});

test("upsertLocalPointer: adds a new pointer to the front, replaces an existing one by id rather than duplicating", () => {
  upsertLocalPointer({ id: "m1", teamA: "A", teamB: "B", status: "live", innings: [] });
  upsertLocalPointer({ id: "m2", teamA: "C", teamB: "D", status: "live", innings: [] });
  let idx = lsGetIndex();
  assert.equal(idx.length, 2);
  assert.equal(idx[0].id, "m2", "newest first");

  upsertLocalPointer({ id: "m1", teamA: "A", teamB: "B", status: "complete", innings: [] });
  idx = lsGetIndex();
  assert.equal(idx.length, 2, "still 2 entries, not 3 — m1 was replaced, not duplicated");
  assert.equal(idx[0].id, "m1");
  assert.equal(idx[0].status, "complete");
});

test("pending write outbox: queue, count, clear", () => {
  assert.equal(pendingWriteCount(), 0);
  queuePendingWrite({ id: "m1", teamA: "A" });
  queuePendingWrite({ id: "m2", teamA: "B" });
  assert.equal(pendingWriteCount(), 2);
  assert.deepEqual(lsPendingIds().sort(), ["m1", "m2"]);

  clearPendingWrite("m1");
  assert.equal(pendingWriteCount(), 1);
  assert.deepEqual(lsPendingIds(), ["m2"]);
});

test("queuePendingWrite: queueing the same match id twice doesn't duplicate the pending-ids entry", () => {
  queuePendingWrite({ id: "m1", teamA: "A" });
  queuePendingWrite({ id: "m1", teamA: "A", teamB: "updated" });
  assert.deepEqual(lsPendingIds(), ["m1"]);
});

test("pruneOrphanedPendingWrites: drops a queued write for a match no longer in the index", () => {
  queuePendingWrite({ id: "orphan", teamA: "A" });
  queuePendingWrite({ id: "kept", teamA: "B" });
  lsSetIndex([{ id: "kept" }]);
  pruneOrphanedPendingWrites();
  assert.deepEqual(lsPendingIds(), ["kept"]);
});

test("pruneOrphanedPendingWrites: leaves the outbox alone when the index looks empty (ambiguous with corrupt JSON)", () => {
  queuePendingWrite({ id: "m1", teamA: "A" });
  // No lsSetIndex call — index is empty, which could mean "genuinely nothing" or "failed to parse".
  pruneOrphanedPendingWrites();
  assert.deepEqual(lsPendingIds(), ["m1"], "nothing pruned since the index itself is ambiguous");
});

test("undo history: save, load, clear round-trip, scoped per match id", () => {
  saveUndoHistory("m1", [{ kind: "run", runs: 4 }]);
  saveUndoHistory("m2", [{ kind: "run", runs: 6 }]);
  assert.deepEqual(loadUndoHistory("m1"), [{ kind: "run", runs: 4 }]);
  assert.deepEqual(loadUndoHistory("m2"), [{ kind: "run", runs: 6 }]);

  clearUndoHistory("m1");
  assert.deepEqual(loadUndoHistory("m1"), []);
  assert.deepEqual(loadUndoHistory("m2"), [{ kind: "run", runs: 6 }], "clearing m1 doesn't touch m2");
});

test("undoHistoryKey: distinct, deterministic keys per match id", () => {
  assert.notEqual(undoHistoryKey("m1"), undoHistoryKey("m2"));
  assert.equal(undoHistoryKey("m1"), undoHistoryKey("m1"));
});
