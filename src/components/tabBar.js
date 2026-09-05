import React from "react";
import { COLORS } from "./theme.js";
import { House, Radio, Shield, Trophy, Users } from "./icons.js";

// The five root destinations a person actually returns to over and over: Home (their own stuff),
// Live (everyone else's live matches/tournaments -- the old app-wide feed, moved off Home), Cups
// (tournaments/series), Teams (roster/team management -- the "my-teams" screen, confusingly not
// the one literally named TeamsScreen) and Clubs (TeamsScreen itself: Clubs/Federations browsing).
// `screen` is CricketScorer's own app-level screen key, reused directly rather than inventing a
// separate "tab" concept -- TAB_BAR_SCREENS (see cricketScorer.js) is the single source of truth
// for which screens show this bar at all.
export const TABS = [
  { screen: "home", label: "Home", Icon: House },
  { screen: "live", label: "Live", Icon: Radio },
  { screen: "tournaments", label: "Cups", Icon: Trophy },
  { screen: "my-teams", label: "Teams", Icon: Users },
  { screen: "teams", label: "Clubs", Icon: Shield }
];

// Height of the pill itself (safe-area padding aside) -- unlike MatchScreen's scoring pad, this
// bar's content never changes shape, so a plain constant is safe here rather than needing
// MatchScreen's ResizeObserver-measured approach (see docs/history.md's "This Over" rendering-bug
// writeup for why that measuring exists at all).
const PILL_HEIGHT = 58;
// Gap the floating pill sits above the screen's bottom edge (safe-area inset aside) -- see the
// `bottom` offset below.
const BOTTOM_GAP = 14;
// Total vertical footprint of the tab bar from the screen's bottom edge, safe-area aside --
// exported so CricketScorer can reserve the same amount of bottom padding under each tab screen's
// own scrollable content (bar height plus the gap it floats above the edge with), otherwise the
// last bit of content on any of the five tab screens renders partially hidden underneath it, the
// exact bug class history already hit once with the scoring pad.
export const TAB_BAR_HEIGHT = PILL_HEIGHT + BOTTOM_GAP;

export function TabBar({ active, onSelect, homeBadgeCount = 0 }) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Primary",
    style: {
      position: "fixed",
      bottom: `calc(${BOTTOM_GAP}px + env(safe-area-inset-bottom))`,
      left: 16,
      right: 16,
      maxWidth: 560,
      margin: "0 auto",
      zIndex: 40,
      background: COLORS.surface,
      borderRadius: PILL_HEIGHT / 2,
      boxShadow: "0 2px 8px rgba(42,36,32,0.10), 0 10px 28px rgba(42,36,32,0.16)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: PILL_HEIGHT,
      padding: "0 6px"
    }
  }, TABS.map(({ screen, label, Icon }) => {
    const isActive = active === screen;
    return /*#__PURE__*/React.createElement("button", {
      key: screen,
      type: "button",
      onClick: () => onSelect(screen),
      className: "cs-btn",
      "aria-label": screen === "home" && homeBadgeCount > 0 ? `${label}, ${homeBadgeCount} pending` : label,
      "aria-current": isActive ? "page" : undefined,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        background: "none",
        border: "none",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: { position: "relative", display: "inline-flex" }
    }, /*#__PURE__*/React.createElement(Icon, {
      size: 21,
      style: {
        color: isActive ? COLORS.pitch : COLORS.inkSoft,
        strokeWidth: isActive ? "2.4" : "2"
      }
    }), screen === "home" && homeBadgeCount > 0 && /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        top: -3,
        right: -6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        minWidth: 13,
        height: 13,
        padding: "0 3px",
        borderRadius: 7,
        background: COLORS.ballFixed,
        color: "#fff",
        fontFamily: "'Inter'",
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: `0 0 0 1.5px ${COLORS.surface}`
      }
    }, homeBadgeCount > 9 ? "9+" : homeBadgeCount)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: isActive ? 700 : 600,
        color: isActive ? COLORS.pitch : COLORS.inkSoft
      }
    }, label));
  })));
}
