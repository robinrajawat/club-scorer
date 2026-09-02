import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronRight } from "./icons.js";
import { tossText, nonStandardRulesText, umpiresText } from "../core/shareAndFormat.js";

// Small presentational components for displaying a match: a single ball's colored badge, a
// public/private visibility toggle, and the collapsible toss/house-rules/umpires fold shown above
// the scorecard. Covered by tests/unit/components/matchDisplayAtoms.test.js using
// react-test-renderer.

export function BallBadge({
  ev,
  label
}) {
  let bg = COLORS.creamDark,
    color = COLORS.ink,
    shadow = "0 1px 2px rgba(42,36,32,0.1)",
    border = `1px solid ${COLORS.willow}`;
  if (ev.kind === "wicket") {
    bg = `linear-gradient(160deg, ${COLORS.ballLightFixed}, ${COLORS.ballFixed})`;
    color = "#fff";
    border = "none";
    shadow = "0 2px 6px rgba(139,30,30,0.4)";
  } else if (ev.kind === "wide") {
    // Split from "noball" below deliberately -- a wide can never have a genuine batted boundary
    // (the ball's unplayable by definition, that's what makes it a wide). Always purple,
    // unconditionally.
    bg = "linear-gradient(160deg, #9d6bc7, #7b3fa0)";
    color = "#fff";
    border = "none";
    shadow = "0 2px 6px rgba(123,63,160,0.35)";
  } else if (ev.battedRuns === 4) {
    // ev.battedRuns (see its comment in scoringEngine.js's applyBall), not ev.runs -- ev.runs is
    // the ball's raw total, which for a no-ball includes the extras penalty (a genuine six off a
    // default-penalty no-ball stores runs:7, never matching a plain ===6 check), for an
    // overthrow-topped-up hit includes the bonus on top, and for a bye/leg-bye is a running total
    // the bat was never involved in at all -- any of which could previously coincide with 4 or 6
    // and get colored as a batted boundary that never actually happened.
    bg = `linear-gradient(160deg, #5c9436, ${COLORS.turf})`;
    color = "#fff";
    border = "none";
    shadow = "0 2px 6px rgba(74,124,46,0.35)";
  } else if (ev.battedRuns === 6 || ev.bigHit) {
    // Gold, not a darker shade of the fours green (the original version of this) and not purple
    // (a brief second attempt) -- gold carries real "biggest/best" weight (gold medal, a golden
    // moment) that a six, arguably the single most dramatic thing that can happen on a ball,
    // deserves more than either alternative gave it. Swapped with wide/no-ball above rather than
    // introduced fresh -- gold already existed in this app's palette, just attached to the wrong
    // event.
    //
    // ev.bigHit alongside the battedRuns===6 check -- a big hit's total (e.g. 10) doesn't match 6,
    // but it's still exactly a six for styling purposes, same as it is for stats (see isSix in
    // applyBall). Without this it fell through to the default, unremarkable badge color, looking
    // no different from an ordinary single run.
    bg = `linear-gradient(160deg, #d4a544, ${COLORS.gold})`;
    color = "#2e1c04";
    border = "none";
    shadow = "0 2px 6px rgba(184,137,43,0.35)";
  } else if (ev.kind === "noball") {
    // Checked AFTER battedRuns===4/6 above, unlike "wide" -- unlike a wide, a no-ball CAN have a
    // genuine batted boundary, so a six hit off a no-ball needs to reach the gold branch above, not
    // get short-circuited into purple before battedRuns is ever even checked. Only reaches here for
    // a no-ball that WASN'T also a four or six.
    bg = "linear-gradient(160deg, #9d6bc7, #7b3fa0)";
    color = "#fff";
    border = "none";
    shadow = "0 2px 6px rgba(123,63,160,0.35)";
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 28,
      height: 28,
      borderRadius: "50%",
      background: bg,
      color,
      border,
      boxShadow: shadow,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      fontWeight: 700,
      padding: "0 4px",
      animation: "cs-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)"
    }
  }, ev.display), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 9,
      color: COLORS.inkSoft,
      lineHeight: 1
    }
  }, label));
}

export function VisibilitySwitch({
  isPublic,
  busy,
  onChange,
  publicHint = "Public \u2014 discoverable by search",
  privateHint = "Private \u2014 not discoverable"
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => !busy && onChange(!isPublic),
    disabled: busy,
    className: "cs-btn",
    "aria-label": isPublic ? "Make private" : "Make public",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: "none",
      border: `1px solid ${isPublic ? COLORS.gold : COLORS.willow}`,
      borderRadius: 20,
      padding: "3px 9px 3px 3px",
      cursor: busy ? "default" : "pointer",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 10.5,
      color: isPublic ? COLORS.gold : COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 15,
      borderRadius: 8,
      background: isPublic ? COLORS.gold : COLORS.willow,
      position: "relative",
      flexShrink: 0,
      transition: "background 0.15s ease"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 1.5,
      left: isPublic ? 12 : 1.5,
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: COLORS.surface,
      transition: "left 0.15s ease",
      boxShadow: "0 1px 2px rgba(0,0,0,0.25)"
    }
  })), busy ? "\u2026" : isPublic ? "Public" : "Private");
}

export function MatchInfoFold({
  match
}) {
  const [open, setOpen] = useState(false);
  const toss = tossText(match.toss);
  const houseRules = nonStandardRulesText(match.rules);
  const umpires = umpiresText(match);
  if (!toss && !houseRules && !umpires) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px 0",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      padding: 0,
      display: "flex",
      alignItems: "center",
      gap: 3,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.inkSoft,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(ChevronRight, {
    size: 12,
    style: {
      transform: open ? "rotate(90deg)" : "none",
      transition: "transform 0.15s ease"
    }
  }), "Match details"), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.6
    }
  }, toss, toss && (houseRules || umpires) && /*#__PURE__*/React.createElement("br", null), houseRules && /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "House rules: ", houseRules), houseRules && umpires && /*#__PURE__*/React.createElement("br", null), umpires));
}
