// Small, self-contained decorative/status React components -- loading spinners, empty-state art,
// the app icon mark. Covered by tests/unit/components/illustrations.test.js using
// react-test-renderer.

import React from "react";
import { COLORS } from "./theme.js";

export function AppMark({
  size
}) {
  const scale = 192 / 144; // inverse of the ~75%-of-canvas content box shared by every icon export
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: 0,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "./icons/icon-512.png",
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: size * scale,
      height: size * scale,
      transform: "translate(-50%, -50%)"
    }
  }));
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
    r: "16",
    fill: `url(#cs-ball-grad)`,
    stroke: COLORS.ball,
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 10 C 17 16, 17 28, 12 34",
    stroke: "#f5ded9",
    strokeWidth: "1.3",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M32 10 C 27 16, 27 28, 32 34",
    stroke: "#f5ded9",
    strokeWidth: "1.3",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "cs-ball-grad",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: COLORS.ballLight
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: COLORS.ball
  }))));
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
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "26",
    cy: "26",
    r: "19",
    stroke: COLORS.willow,
    strokeWidth: "1.6",
    fill: "rgba(201,168,118,0.08)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 15 C 20 22, 20 30, 14 37",
    stroke: COLORS.willow,
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M38 15 C 32 22, 32 30, 38 37",
    stroke: COLORS.willow,
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round"
  }));
}

// The "nothing here yet" state every list screen (Home, Live, My Teams, Cups, Players, Inbox)
// falls back to -- same look everywhere on purpose, so it doesn't matter which screen you're on.
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
