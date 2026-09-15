import React from "react";
import { COLORS } from "./theme.js";
import { House, ScorePad, Trophy, Users } from "./icons.js";

// Four root destinations: Home (live matches/results/fixtures -- everyone's, plus your own
// completed ones; the app's default landing screen, see cricketScorer.js's cold-landing comment),
// Score (your own scoring queue -- in progress, up next, upcoming), Cups (every tournament/series
// you've created), and Teams (every roster you've created -- MyTeamsScreen directly, no club
// wrapper around it; see docs/simplification-plan.md for why club/federation management was
// removed and this tab now points straight at personal teams instead of a Clubs/Federations
// browser).
// `screen` is CricketScorer's own app-level screen key, reused directly rather than inventing a
// separate "tab" concept -- TAB_BAR_SCREENS (see cricketScorer.js) is the single source of truth
// for which screens show this bar at all. Home's own screen key stays "live" (LiveScreen) and
// Score's stays "home" (HomeScreen) -- renaming those internally would ripple through every
// setScreen("home"/"live") call site and test in the app for no user-visible benefit; only the
// label, icon, and position shown here changed, reported live: "Score might be the most logical
// name" for the scoring-queue tab, and "we can actually use home for live tab... sounds logical as
// the default landing happens there."
export const TABS = [
  { screen: "live", label: "Home", Icon: House },
  { screen: "home", label: "Score", Icon: ScorePad },
  { screen: "tournaments", label: "Cups", Icon: Trophy },
  { screen: "teams", label: "Teams", Icon: Users }
];

// Height of the pill itself (safe-area padding aside) -- unlike MatchScreen's scoring pad, this
// bar's content never changes shape, so a plain constant is safe here rather than needing
// MatchScreen's ResizeObserver-measured approach (see docs/history.md's "This Over" rendering-bug
// writeup for why that measuring exists at all).
const PILL_HEIGHT = 58;
// Gap the pill sits above the screen's bottom edge, on top of the safe-area inset (see the
// `bottom` offset below). WhatsApp's own bottom bar sits flush against the safe area with no
// extra gap at all -- user feedback confirmed any added gap here still reads as "floating too
// high" by comparison, so this stays 0 and the pill shape alone (rounded corners, shadow) is what
// visually distinguishes it from a plain flush bar.
const BOTTOM_GAP = 0;
// Total vertical footprint of the tab bar from the screen's bottom edge, safe-area aside --
// exported so CricketScorer can reserve the same amount of bottom padding under each tab screen's
// own scrollable content (bar height plus the gap it floats above the edge with), otherwise the
// last bit of content on any of the five tab screens renders partially hidden underneath it, the
// exact bug class history already hit once with the scoring pad.
export const TAB_BAR_HEIGHT = PILL_HEIGHT + BOTTOM_GAP;

// Reported live: the pill "looks good when I am using PWA otherwise it touches the browser's
// search bar" -- installed-PWA devices with a home-indicator report a real env(safe-area-inset-
// bottom), which is what gave the pill its floating clearance; a plain browser tab reports 0 for
// that same env(), so bottom: 0 sat the pill flush against the true edge of the viewport, right
// where Chrome/Safari's own bottom URL/search bar lives. `max()` guarantees a floating look either
// way -- real safe-area insets (already bigger than 12px on every current home-indicator device)
// pass through untouched, a plain browser tab's 0 is floored to 12px -- with no display-mode
// detection needed. Exported so every screen that reserves bottom padding to clear this bar (see
// TAB_BAR_HEIGHT's own usages) adds the same floor, not just the bar itself.
export const TAB_BAR_SAFE_BOTTOM = "max(env(safe-area-inset-bottom), 12px)";

export function TabBar({ active, onSelect, homeBadgeCount = 0 }) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Primary",
    style: {
      position: "fixed",
      bottom: `calc(${BOTTOM_GAP}px + ${TAB_BAR_SAFE_BOTTOM})`,
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
