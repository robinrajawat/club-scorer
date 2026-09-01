import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { ArrowLeftRight, ChevronRight } from "./icons.js";
import { BallBadge } from "./matchDisplayAtoms.js";
import { ballLabelsForOver } from "../core/miscHelpers.js";

// Small live-scoring display atoms: OversStrip (the swipeable per-over ball-by-ball strip),
// FixturePollSummary (yes/no/maybe availability-poll tally chips), and SyncStatusBanner (the
// "N matches not synced" banner with online/offline awareness). Covered by
// tests/unit/components/scoreboardAtoms.test.js.
//
// SyncStatusBanner reads navigator.onLine and window's online/offline events directly, so like
// Modal it needs a real jsdom-backed DOM to test meaningfully. Its handleTap calls
// `flushPendingWrites` (a Firestore write, defined in public/index.html, not extracted -- needs the
// Firebase SDK global) from an onClick handler, same pattern as saveMatch elsewhere in this app.

export function OversStrip({
  overs,
  ballsPerOver
}) {
  // Normalize once, up front, rather than trusting every element of `overs` to already be an
  // array -- this is exactly the shape that crashed FollowScreen's render (balls.reduce/.filter
  // is not a function) when unpackMatchFromFirestore let a malformed non-array "balls" entry
  // through. Defensive here too, not just at the unpack step, so no other future data-shape
  // surprise (a different sync path, an older cached doc, etc.) can crash this component again.
  const safeOvers = (overs || []).map(balls => Array.isArray(balls) ? balls : []);
  const scrollRef = useRef(null);
  const totalBalls = safeOvers.reduce((s, o) => s + o.length, 0);
  const lastIndex = safeOvers.length - 1;
  const [activeIndex, setActiveIndex] = useState(lastIndex);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
    setActiveIndex(lastIndex);
  }, [totalBalls, safeOvers.length]);
  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }
  function jumpToNow() {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: scrollRef.current.scrollWidth,
      behavior: "smooth"
    });
    setActiveIndex(lastIndex);
  }
  return /*#__PURE__*/React.createElement("div", null, safeOvers.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "← scroll for previous overs"), activeIndex !== lastIndex && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: jumpToNow,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 11.5,
      cursor: "pointer",
      padding: 0,
      display: "flex",
      alignItems: "center",
      gap: 3
    }
  }, "Jump to now ", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 13
  }))), /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    onScroll: handleScroll,
    className: "cs-no-scrollbar",
    style: {
      display: "flex",
      overflowX: "auto",
      scrollSnapType: "x mandatory",
      WebkitOverflowScrolling: "touch"
    }
  }, safeOvers.map((balls, i) => {
    const isCurrent = i === lastIndex;
    // Per-over runs/wickets summary, shown next to the over's label. This replaces the "This
    // over: N" line that used to live up in the score header (below the main score) -- keeping
    // it here instead means it also comes for free on every previous over as you scroll back,
    // rather than only ever describing the in-progress one.
    const overRuns = balls.reduce((s, ev) => s + (ev.runs || 0), 0);
    const overWkts = balls.filter(ev => ev.kind === "wicket").length;
    const overSummary = balls.length === 0 ? null : `${overRuns} run${overRuns === 1 ? "" : "s"}${overWkts > 0 ? `, ${overWkts} wkt${overWkts === 1 ? "" : "s"}` : ""}`;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: "0 0 100%",
        width: "100%",
        scrollSnapAlign: "start",
        scrollSnapStop: "always"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: isCurrent ? COLORS.turf : COLORS.inkSoft
      }
    }, isCurrent ? "THIS OVER" : `OVER ${i + 1}`), overSummary && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11,
        fontWeight: 600,
        color: COLORS.inkSoft
      }
    }, overSummary)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }
    }, balls.length === 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12.5,
        color: COLORS.inkSoft,
        fontStyle: "italic"
      }
    }, "Not started") : balls.map((ev, bi) => /*#__PURE__*/React.createElement(BallBadge, {
      key: bi,
      ev: ev,
      label: ballLabelsForOver(i, balls)[bi]
    }))));
  })));
}

export function FixturePollSummary({
  items
}) {
  if (!items || items.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.code,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700
    }
  }, items.length > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontWeight: 600,
      maxWidth: 70,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, it.team.name), it.yes > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.pitch
    }
  }, it.yes, " yes"), it.no > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.ball
    }
  }, it.no, " no"), it.maybe > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.gold
    }
  }, it.maybe, " maybe"))));
}

export function SyncStatusBanner({
  count,
  dark,
  onSynced
}) {
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState(null);
  // Distinguishes "there's genuinely no connection right now" from "online, but the last sync
  // attempt failed for some other reason" (a real conflict, unpublished rules, etc.) -- those need
  // different wording. Retrying does nothing while offline, so telling someone to "tap to retry"
  // in that state is either a no-op or actively misleading; once a real connection issue is the
  // cause, "tap to retry" is exactly the right, actionable copy.
  const [isOnline, setIsOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  // Once the outbox is empty, whatever lastError was showing is no longer relevant — without this,
  // it would silently resurface next time count goes above 0 for a completely unrelated reason
  // (a different match failing later), reading as if it were about that new failure.
  useEffect(() => {
    if (!count) setLastError(null);
  }, [count]);
  if (!count) return null;
  async function handleTap() {
    if (syncing) return;
    setSyncing(true);
    setLastError(null);
    const {
      lastError: error
    } = await flushPendingWrites();
    // Without the onSynced() call, a tap that actually succeeds (clears the outbox) still leaves
    // the banner reading the old count — nothing refreshes it until the next 15s background poll
    // or an 'online' event, so a successful retry looks indistinguishable from tapping doing
    // nothing. And without surfacing `error`, a retry that keeps genuinely failing (bad auth,
    // unpublished Firestore rules, a real conflict) looks exactly the same as that same silent
    // nothing — this is what tells the person WHY it's still stuck instead of just inviting them
    // to tap the same button again.
    if (onSynced) onSynced();
    setLastError(error || null);
    setSyncing(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleTap,
    disabled: syncing,
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: dark ? "rgba(242,236,217,0.14)" : "rgba(230,84,75,0.1)",
      border: `1px solid ${dark ? "rgba(242,236,217,0.35)" : COLORS.live + "55"}`,
      borderRadius: 10,
      color: dark ? COLORS.creamFixed : "#b3392f",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      padding: "6px 10px",
      cursor: syncing ? "default" : "pointer"
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 13
  }), syncing ? "Syncing\u2026" : !isOnline ? `You're offline \u2014 ${count} match${count === 1 ? "" : "es"} will sync automatically` : `${count} match${count === 1 ? "" : "es"} not synced \u2014 tap to retry`), lastError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: dark ? "rgba(242,236,217,0.75)" : "#b3392f",
      textAlign: "center",
      maxWidth: 280
    }
  }, lastError));
}
