// Small presentational React components used on the live scoring screen: role/celebration/
// milestone indicators, the odometer-style score digit animation, the innings timer, and the
// swipeable list-row-with-delete pattern used elsewhere too. Covered by
// tests/unit/components/scoringUiAtoms.test.js using react-test-renderer.

import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { CalendarClock, Trash2 } from "./icons.js";
import { hasSeenSwipeHint, markSwipeHintSeen } from "../core/appLogic.js";

export function RoleBadge({
  isCaptain,
  isKeeper
}) {
  if (!isCaptain && !isKeeper) return null;
  const label = isCaptain && isKeeper ? "C\u00B7WK" : isCaptain ? "C" : "WK";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      marginLeft: 5,
      padding: "1px 5px",
      borderRadius: 5,
      background: isCaptain ? "rgba(184,137,43,0.16)" : "rgba(45,80,22,0.12)",
      color: isCaptain ? COLORS.gold : COLORS.turf,
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: 0.3,
      verticalAlign: "middle",
      fontFamily: "'Inter'"
    }
  }, label);
}

export function BallCelebration({
  celebration
}) {
  if (!celebration) return null;
  const isWicket = celebration.type === "wicket";
  // A bonus-hit tier's own configured name ("Big Hit", "Maximum Hit", or whatever a future tier is
  // called) rather than a fixed "SIX!" -- handleRun passes the tier's label straight through as
  // celebration.type for exactly this. Still styled and gold-colored the same as a six (see isSix
  // in applyBall -- every bonus-hit tier is a genuine six for every other purpose too), just with
  // its own name on screen instead of a generic one that reads oddly for a bonus total (e.g. 10),
  // not literally six.
  const isBonusHit = !isWicket && typeof celebration.type === "string";
  const isSix = celebration.type === 6 || isBonusHit;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 80
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: celebration.key,
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 46,
      // Text color needs to follow the background now, not stay a flat white -- gold is light
      // enough that white text on it would fail contrast the same way the "gold" Btn variant
      // already avoids by using dark text instead; wicket/four's backgrounds stay dark enough for
      // white to keep working there.
      color: isSix ? "#2e1c04" : "#fff",
      padding: "16px 38px",
      borderRadius: 22,
      letterSpacing: 1,
      background: isWicket ? `linear-gradient(160deg, #b3392f, ${COLORS.ballFixed})` : isSix ? `linear-gradient(160deg, #d4a544, ${COLORS.gold})` : `linear-gradient(160deg, #5c9436, ${COLORS.turfFixed})`,
      boxShadow: isWicket ? "0 16px 44px rgba(139,30,30,0.5)" : isSix ? "0 16px 44px rgba(184,137,43,0.45)" : "0 16px 44px rgba(74,124,46,0.45)",
      animation: "cs-boundaryPop 1s cubic-bezier(0.22, 1, 0.36, 1) forwards"
    }
  }, isWicket ? "OUT!" : isBonusHit ? `${celebration.type.toUpperCase()}!` : isSix ? "SIX!" : "FOUR!"));
}

export const MILESTONE_ICONS = {
  batting: "\u{1F3CF}",
  hatTrick: "\u{1F3A9}",
  fiveFor: "\u{1F3AF}",
  partnership: "\u{1F91D}",
  teamTotal: "\u{1F4C8}",
  maiden: "\u{1F6E1}\u{FE0F}",
  wicketMaiden: "\u{1F5E1}\u{FE0F}",
  duck: "\u{1F986}",
  goldenDuck: "\u{1F425}",
  diamondDuck: "\u{1F48E}",
  threeFor: "\u{1F94A}",
  doubleWicket: "\u{1F4A5}",
  breakthrough: "\u{26A1}",
  boundaryDrought: "\u{1F387}"
};

export function MilestoneToast({
  toast
}) {
  if (!toast) return null;
  const m = toast.milestone;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: "max(14px, env(safe-area-inset-top))",
      left: 0,
      zIndex: 79,
      pointerEvents: "none",
      display: "flex",
      justifyContent: "center",
      // Previously `left: 50%` + a matching translateX(-50%) on the inner pill, with nothing
      // capping how wide that inner element could grow — a long bowler/team name on a long
      // template (e.g. "Two wickets in the over for {name}", which front-loads 29 characters of
      // fixed text before the name even starts) could run past the screen edge on a narrow phone
      // and render invisibly off-canvas, which is what looked like the message being cut off.
      // Centering via a full-width flex row instead, so the maxWidth+wrap below on the pill itself
      // has room to actually take effect.
      width: "100vw"
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: toast.key,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      maxWidth: "min(88vw, 380px)",
      background: `linear-gradient(160deg, #d4a544, ${COLORS.gold})`,
      color: "#2e1c04",
      padding: "10px 18px",
      borderRadius: 20,
      boxShadow: "0 8px 24px rgba(184,137,43,0.45)",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      whiteSpace: "normal",
      textAlign: "center",
      lineHeight: 1.3,
      animation: "cs-toastDown 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      flexShrink: 0
    }
  }, MILESTONE_ICONS[m.type] || "\u2728"), m.text));
}

export function OdometerScore({
  text,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      ...style
    }
  }, text.split("").map((ch, i) => /*#__PURE__*/React.createElement("span", {
    key: `slot${i}`,
    style: {
      display: "inline-block",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("span", {
    key: `pos${i}-${ch}`,
    style: {
      display: "inline-block",
      animation: "cs-digitRoll 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
    }
  }, ch))));
}

export function InningsTimer({
  startedAt,
  overCap
}) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => forceTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      color: overCap ? COLORS.gold : "inherit",
      fontWeight: overCap ? 700 : "inherit"
    }
  }, /*#__PURE__*/React.createElement(CalendarClock, {
    size: 12
  }), label);
}

export function SwipeableRow({
  children,
  onDelete,
  deleteLabel = "Delete",
  onSwipeStart
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);
  const moved = useRef(false);
  const REVEAL = 78;
  function pointerX(e) {
    return e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  }
  function onPointerDown(e) {
    startX.current = pointerX(e);
    startDragX.current = dragX;
    moved.current = false;
    setDragging(true);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const delta = pointerX(e) - startX.current;
    if (Math.abs(delta) > 4) {
      // First real movement of an actual swipe (not just a tap) -- the person has now
      // demonstrably discovered the gesture, so the "swipe to delete" hint text has done its job
      // and can stop showing, here and on any other screen using the same shared flag.
      if (!moved.current && !hasSeenSwipeHint()) {
        markSwipeHintSeen();
        onSwipeStart && onSwipeStart();
      }
      moved.current = true;
    }
    let next = startDragX.current + delta;
    next = Math.max(-REVEAL - 24, Math.min(0, next));
    setDragX(next);
  }
  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    setDragX(dragX < -REVEAL * 0.55 ? -REVEAL : 0);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 14,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onDelete();
      setDragX(0);
    },
    className: "cs-btn",
    style: {
      width: REVEAL,
      background: `linear-gradient(160deg, ${COLORS.ballLightFixed}, ${COLORS.ballFixed})`,
      color: "#fff",
      border: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 10.5,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 16
  }), deleteLabel)), /*#__PURE__*/React.createElement("div", {
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
    onPointerCancel: endDrag,
    onClickCapture: e => {
      if (moved.current || dragX !== 0) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    style: {
      position: "relative",
      zIndex: 1,
      background: COLORS.cream,
      transform: `translateX(${dragX}px)`,
      transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
      touchAction: "pan-y"
    }
  }, children));
}
