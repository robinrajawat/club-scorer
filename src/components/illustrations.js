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
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    transform: "translate(26,27) scale(1.7) translate(-12,-12)",
    stroke: COLORS.gold,
    strokeWidth: "1.2",
    fill: "rgba(184,137,43,0.08)"
  }));
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
