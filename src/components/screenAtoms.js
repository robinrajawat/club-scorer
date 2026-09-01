import React from "react";
import { COLORS } from "./theme.js";
import { Share } from "./icons.js";
import { withPinnedFirst } from "../core/appLogic.js";
import { PinnableChip } from "./formUiAtoms.js";

// Small presentational components used across setup/list screens: a labeled form-field wrapper,
// the "add to home screen" install hint banner, and the personal/club source chip row shared by
// Teams/Tournaments. Covered by tests/unit/components/screenAtoms.test.js using
// react-test-renderer.

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

export function ClubSourceSelector({
  clubs,
  activeClubId,
  onSelect,
  pinnedClubIds = [],
  onTogglePinClub
}) {
  const orderedClubs = withPinnedFirst(clubs, pinnedClubIds);
  const chipStyle = active => ({
    padding: "7px 13px",
    borderRadius: 20,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    border: active ? "none" : `1px solid ${COLORS.willow}`,
    background: active ? COLORS.pitchFixed : COLORS.surface,
    color: active ? "#fff" : COLORS.inkSoft,
    whiteSpace: "nowrap"
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, clubs.length > 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      marginBottom: 6
    }
  }, "\u2192 swipe to see more \u00b7 press and hold to pin"), /*#__PURE__*/React.createElement("div", {
    className: "cs-no-scrollbar",
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onSelect(null),
    style: chipStyle(!activeClubId)
  }, "My Teams"), orderedClubs.map(c => /*#__PURE__*/React.createElement(PinnableChip, {
    key: c.id,
    label: c.name,
    active: activeClubId === c.id,
    pinned: pinnedClubIds.includes(c.id),
    onSelect: () => onSelect(c.id),
    onTogglePin: () => onTogglePinClub(c.id)
  }))));
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
