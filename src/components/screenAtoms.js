import React from "react";
import { COLORS } from "./theme.js";
import { Plus, Share } from "./icons.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// Small presentational components used across setup/list screens: a labeled form-field wrapper,
// the "add to home screen" install hint banner, and a floating "+" action button. Field and
// InstallHintBanner are covered by tests/unit/components/screenAtoms.test.js using
// react-test-renderer; FabButton portals to document.body (see its own comment), so its test
// renders through real react-dom (createRoot) into a jsdom container instead, same technique as
// authBar.test.js/shareMenus.test.js.

export function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 5
    }
  }, label), children);
}

export function InstallHintBanner({
  onDismiss
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 16px 14px",
      padding: "12px 14px",
      borderRadius: 14,
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      boxShadow: "0 1px 2px rgba(42,36,32,0.07), 0 3px 8px rgba(42,36,32,0.05)",
      display: "flex",
      alignItems: "flex-start",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Share, {
    size: 18,
    style: {
      color: COLORS.pitch,
      flexShrink: 0,
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      color: COLORS.ink,
      marginBottom: 3
    }
  }, "Add this to your home screen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
    // iOS 26 moved Share behind Safari's overflow menu -- it's no longer a single tap on a
    // visible Share icon the way earlier iOS versions had it. Confirmed via search rather than
    // assumed, since this is exactly the kind of current-OS-UI detail that goes stale fast: tap
    // the \u22ef next to the address bar first, THEN Share, THEN "Add to Home Screen". Also new in
    // iOS 26 -- an "Open as Web App" toggle in that dialog, on by default, which needs to stay on
    // for the no-browser-bar experience this banner is actually promising; worth a mention since
    // it's an easy thing to not notice and accidentally leave off.
  }, "Tap the \u22ef next to the address bar, then Share, then \u201cAdd to Home Screen.\u201d Keep \u201cOpen as Web App\u201d on \u2014 opens full-screen next time, no browser bar, and still works offline.")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDismiss,
    "aria-label": "Dismiss",
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      lineHeight: 1,
      fontSize: 20,
      color: COLORS.inkSoft,
      flexShrink: 0
    }
  }, "\u00d7"));
}

// A single fixed "+" FAB, bottom-right, above the tab bar and within the same safe-area padding
// -- replaces the top-of-screen primary "New X" button Home and Cups each used to have, which sat
// well outside comfortable one-handed thumb reach on a tall phone. Deliberately icon-only (no
// label): a "+" in the corner is an established mobile convention for "add/create new", and its
// context (which screen it's floating on) already says what it creates.
// Positioned via an invisible, non-interactive wrapper matching every other fixed-position
// element's own left/right/maxWidth/margin (see TabBar) rather than anchoring straight to the
// viewport edge -- keeps it aligned with the tab bar's own right edge on a wide (desktop-width)
// viewport instead of drifting off to the raw screen edge past the centered 560px column.
// Rendered via ReactDOM.createPortal(..., document.body) (a bare global, same as Modal/ShareMenu
// elsewhere in this suite) rather than in place -- every screen it lives on on is wrapped in
// NavWrap's own 0.32s entrance transform (see NavWrap's comment on transforms breaking
// position:fixed on descendants), and unlike a Modal, this button is visible from the very first
// frame a screen mounts, squarely inside that animation window. Without the portal it would slide
// in sideways with the rest of the screen instead of staying rock-solid like TabBar, which is
// rendered as CricketScorer's own sibling, never inside a NavWrap at all.
export function FabButton({
  onClick,
  label
}) {
  return /*#__PURE__*/ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      left: 16,
      right: 16,
      maxWidth: 560,
      margin: "0 auto",
      bottom: `calc(${TAB_BAR_HEIGHT}px + 16px + env(safe-area-inset-bottom))`,
      display: "flex",
      justifyContent: "flex-end",
      pointerEvents: "none",
      zIndex: 39
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-label": label,
    className: "cs-btn cs-shine",
    style: {
      pointerEvents: "auto",
      width: 56,
      height: 56,
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})`,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 14px rgba(45,80,22,0.4), 0 2px 8px rgba(0,0,0,0.2)"
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 26,
    strokeWidth: 2.5
  }))), document.body);
}

export function NavWrap({
  navKey,
  direction,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    key: navKey,
    style: {
      // fill-mode is 'backwards' only (not 'both'/'forwards'): once this animation ends, transform
      // must fully clear back to none. A lingering transform (even translateX(0), which is a no-op
      // visually) creates a new containing block and silently breaks position:fixed on every
      // descendant — which is what was hiding the match screen's fixed bottom scoring panel.
      animation: `${direction === "back" ? "cs-navInLeft" : "cs-navInRight"} 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards`
    }
  }, children);
}
