import { matchScoreLine } from "./shareAndFormat.js";

// localStorage-backed match index, offline write outbox, and per-match undo history. Every
// localStorage access here goes through a try/catch (lsSetItem's own comment explains why), which
// means it's meaningfully testable in Node too: referencing the bare `localStorage` global throws
// a ReferenceError there, caught the same way a real QuotaExceededError would be -- so
// tests/unit/localStorageOutbox.test.js installs a small in-memory localStorage polyfill to
// exercise the real success paths, plus a throwing one for the QuotaExceededError branch.

export const LS_PREFIX = "cricket-scorer:";

export const PENDING_PREFIX = `${LS_PREFIX}pending:`;

export function lsSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return {
      ok: true
    };
  } catch (e) {
    const quotaExceeded = e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014);
    console.error("localStorage.setItem failed —", key, e);
    return {
      ok: false,
      quotaExceeded,
      error: quotaExceeded ? "This device's local storage is full — free up space (delete old matches, or clear other apps' data) so this can be saved." : e && e.message || "Couldn't save locally."
    };
  }
}

export function lsGetIndex() {
  try {
    return JSON.parse(localStorage.getItem(`${LS_PREFIX}matches-index`) || "[]");
  } catch (e) {
    return [];
  }
}

export function lsSetIndex(idx) {
  const result = lsSetItem(`${LS_PREFIX}matches-index`, JSON.stringify(idx.slice(0, 50)));
  if (!result.ok) console.error("index save failed", result.error);
}

export function upsertLocalPointer(match, extra) {
  let idx = lsGetIndex().filter(m => m.id !== match.id);
  idx.unshift({
    id: match.id,
    teamA: match.teamA,
    teamB: match.teamB,
    teamAId: match.teamAId || null,
    teamBId: match.teamBId || null,
    oversLimit: match.oversLimit,
    updatedAt: Date.now(),
    status: match.status,
    shareCode: match.shareCode || null,
    viewCode: match.viewCode || null,
    tournamentId: match.tournamentId || null,
    // Cloud-synced matches arrive on the Home screen as full match docs (see loadIndex), so
    // MatchScoreLine can be computed there directly from match.innings. A local-only pointer is
    // all Home ever sees for an offline/not-signed-in match, though -- there's no full match doc
    // riding along with it -- so the score has to be baked in here, at save time, or the list item
    // would have nothing to show at all for those matches.
    scoreLine: matchScoreLine(match),
    // Which signed-in account's own private /users/{uid}/matches collection this pointer mirrors,
    // if any -- lets loadIndex tell a pointer left behind by a PREVIOUS account that signed into
    // this same device (e.g. one phone passed around at the ground to score) apart from one that's
    // still this account's own, so it isn't shown as a "Continue scoring" card to an account that
    // has no actual access to it. Only ever set explicitly via `extra` by the account-owned save
    // path (savePrimaryMatch's cloud:true branch, in index.html) -- a shared/guest pointer (cloud:
    // false) has no single owning account by design, that's the whole point of a match code
    // working across devices/accounts, so it stays null here and is never filtered by uid.
    ownerUid: null,
    ...extra
  });
  lsSetIndex(idx);
}

export function lsPendingIds() {
  try {
    return JSON.parse(localStorage.getItem(`${LS_PREFIX}pending-ids`) || "[]");
  } catch (e) {
    return [];
  }
}

export function lsSetPendingIds(ids) {
  const result = lsSetItem(`${LS_PREFIX}pending-ids`, JSON.stringify(ids));
  if (!result.ok) console.error("save pending-ids failed", result.error);
}

export function queuePendingWrite(match) {
  try {
    const result = lsSetItem(PENDING_PREFIX + match.id, JSON.stringify(match));
    if (!result.ok) {
      console.error("queue pending write failed", result.error);
      return;
    }
    const ids = lsPendingIds();
    if (!ids.includes(match.id)) lsSetPendingIds([...ids, match.id]);
  } catch (e) {
    console.error("queue pending write failed", e);
  }
}

export function clearPendingWrite(id) {
  try {
    localStorage.removeItem(PENDING_PREFIX + id);
    lsSetPendingIds(lsPendingIds().filter(x => x !== id));
  } catch (e) {
    console.error("clear pending write failed", e);
  }
}

export function pendingWriteCount() {
  return lsPendingIds().length;
}

export function pruneOrphanedPendingWrites() {
  try {
    const ids = lsPendingIds();
    if (ids.length === 0) return;
    const index = lsGetIndex();
    // lsGetIndex silently returns [] both when there's genuinely nothing there AND when the stored
    // JSON failed to parse (see its own try/catch) — those two cases are indistinguishable from
    // here, and treating the second one as "nothing exists, so every queued write is orphaned"
    // would delete real, not-yet-synced scoring data outright. Only prune against a non-empty
    // index, where a missing id is unambiguous; if the index looks empty, leave the outbox alone
    // rather than risk it.
    if (index.length === 0) return;
    const indexIds = new Set(index.map(m => m.id));
    for (const id of ids) {
      if (!indexIds.has(id)) {
        console.error("[outbox] pruning orphaned pending write for a deleted/unknown match:", id);
        clearPendingWrite(id);
      }
    }
  } catch (e) {
    console.error("prune orphaned pending writes failed", e);
  }
}

export function undoHistoryKey(matchId) {
  return `${LS_PREFIX}undoHistory:${matchId}`;
}

export function loadUndoHistory(matchId) {
  try {
    return JSON.parse(localStorage.getItem(undoHistoryKey(matchId)) || "[]");
  } catch (e) {
    return [];
  }
}

export function saveUndoHistory(matchId, history) {
  const result = lsSetItem(undoHistoryKey(matchId), JSON.stringify(history));
  if (!result.ok) console.error("save undo history failed", result.error);
}

export function clearUndoHistory(matchId) {
  try {
    localStorage.removeItem(undoHistoryKey(matchId));
  } catch (e) {
    /* noop */
  }
}
