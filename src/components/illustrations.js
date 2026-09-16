// Small, self-contained decorative/status React components -- loading spinners, empty-state art,
// the app icon mark. Covered by tests/unit/components/illustrations.test.js using
// react-test-renderer.

import React from "react";
import { COLORS } from "./theme.js";

export function AppMark({
  size
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: "./icons/icon-512.png",
    alt: "",
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      filter: "drop-shadow(0 3px 8px rgba(20,20,20,0.3))"
    }
  });
}

export function LoadingBallIllustration({
  size = 44,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 44 44",
    fill: "none",
    style: {
      display: "block",
      animation: "cs-ballSpin 0.9s linear infinite",
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "22",
    cy: "22",
    r: "18",
    stroke: COLORS.creamDark,
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 4 A18 18 0 0 1 40 22",
    stroke: COLORS.gold,
    strokeWidth: "4",
    strokeLinecap: "round"
  }));
}

// A real coin, not a flickering label: two circular faces (Heads/Tails) glued back-to-back on a
// 3D-rotated disc. `rotationDeg` is an ever-increasing absolute angle (not reset to 0 between
// flips, so consecutive flips spin forward instead of visually snapping back) -- 0/360/720... deg
// shows Heads, 180/540/900... deg shows Tails, per the standard rotateY card-flip technique: the
// back face is pre-rotated 180deg so it lands right-side-up instead of mirrored. `spinning` swaps
// in a CSS transition so the coin visibly tumbles from its old angle to the new one; without it
// (the static pre-flip state) the coin just sits on whichever face it's already showing.
function CoinFace({
  letter,
  extraTransform = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: `linear-gradient(160deg, #d4a544, ${COLORS.gold})`,
      boxShadow: "0 2px 6px rgba(184,137,43,0.45), inset 0 0 0 2px rgba(255,255,255,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backfaceVisibility: "hidden",
      transform: extraTransform,
      fontFamily: "'DM Serif Display', serif",
      fontSize: 22,
      fontWeight: 700,
      color: "#2e1c04"
    }
  }, letter);
}
export function CoinFlipIllustration({
  rotationDeg,
  spinning,
  size = 56
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      perspective: 300,
      display: "flex",
      justifyContent: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      position: "relative",
      transformStyle: "preserve-3d",
      transform: `rotateY(${rotationDeg}deg)`,
      transition: spinning ? "transform 0.9s cubic-bezier(0.2,0.7,0.3,1)" : "none"
    }
  }, /*#__PURE__*/React.createElement(CoinFace, {
    letter: "H"
  }), /*#__PURE__*/React.createElement(CoinFace, {
    letter: "T",
    extraTransform: "rotateY(180deg)"
  })));
}

export function LoadingNote({
  label = "Loading\u2026",
  size = 16,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      ...style
    }
  }, /*#__PURE__*/React.createElement(LoadingBallIllustration, {
    size
  }), label);
}

export function EmptyStateBallIllustration() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "52",
    height: "52",
    viewBox: "0 0 52 52",
    fill: "none",
    style: {
      margin: "0 auto",
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("g", {
    transform: "translate(26,27) scale(1.9) translate(-10,-12.5)"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "14",
    height: "17",
    rx: "1.5",
    stroke: COLORS.gold,
    strokeWidth: "0.7",
    fill: "rgba(184,137,43,0.06)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6.5",
    y1: "9",
    x2: "13.5",
    y2: "9",
    stroke: COLORS.gold,
    strokeWidth: "0.7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6.5",
    y1: "13",
    x2: "11",
    y2: "13",
    stroke: COLORS.gold,
    strokeWidth: "0.7"
  })));
}

// The "nothing here yet" state every list screen (Home, Live, Teams, Cups, Inbox) falls back to
// -- same look everywhere on purpose, so it doesn't matter which screen you're on.
// Used to be copy-pasted per screen with a fixed vh-fraction minHeight to fake vertical centering
// -- that reads as "too high" on any screen with more header/search/filter chrome above it than
// whichever screen that fraction happened to be eyeballed against, since a fixed fraction of the
// WHOLE viewport has no idea how much of it the header already used. `flex: 1` on this div does
// the actual job on most screens: it fills exactly whatever space is left below the header, so it
// centers correctly regardless of how tall that header is -- the one requirement is that the
// screen's own root element is itself `display: flex, flexDirection: "column"` with a real height
// to divide up (`minHeight: "100dvh"` on that root, same pattern on every screen that relies on
// this). Screens whose root isn't (yet) restructured that way can pass `minHeight` instead (a
// plain block-level minHeight, same old fallback) -- `flex: 1` is simply ignored by a non-flex
// parent, so this stays correct either way without the caller needing two code paths.
// No card/border/background around the icon+text -- a dashed box around "nothing here" read as
// more chrome than the empty state deserved, and swallowed a screen's worth of tint on any screen
// with a lot of leftover space (see Cups vs. Live). The icon and copy alone already read as
// unmistakably empty, not broken, without a container drawing attention to itself.
export function EmptyState({
  minHeight,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      ...(minHeight ? { minHeight } : {}),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "20px 0"
    }
  }, /*#__PURE__*/React.createElement(EmptyStateBallIllustration, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginTop: 12,
      maxWidth: 280
    }
  }, children));
}
