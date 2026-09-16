import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Bell, ChevronLeft, Pencil, Pin, Plus, Shield, Users } from "./icons.js";
import { LoadingNote, EmptyState } from "./illustrations.js";
import { FabButton } from "./screenAtoms.js";
import { SwipeableRow } from "./scoringUiAtoms.js";
import { hasSeenSwipeHint } from "../core/appLogic.js";
import { TAB_BAR_HEIGHT, TAB_BAR_SAFE_BOTTOM } from "./tabBar.js";
import { AuthBar } from "./authBar.js";

// The "Teams" tab -- every team is just the account's own now (no club wrapper, no "nested inside
// a club's own admin screen" mode, no source-chip picker across multiple clubs -- all of that went
// alongside club/federation management, see docs/simplification-plan.md). Per-team new/edit/delete
// actions remain. Covered by tests/unit/components/myTeamsScreen.test.js.
//
// Every write action is a prop (onDeleteTeam/onEditTeam/etc.), not a bare global.

export function MyTeamsScreen({
  teams = [],
  teamsLoading = false,
  matches,
  onBack,
  onNewTeam,
  onEditTeam,
  onDeleteTeam,
  onTogglePin,
  showTabBar = false,
  user,
  profile,
  onOpenAccount,
  onOpenInbox,
  inboxBadgeCount = 0,
  onOpenHelp,
  onOpenFeedback,
  onOpenAbout,
  onSignOut,
  themePref,
  onSetTheme
}) {
  // Same shared, learn-once flag as Home's Saved Matches list -- see hasSeenSwipeHint's own
  // comment for why this is one flag across both screens rather than two separate ones.
  const [showSwipeHint, setShowSwipeHint] = useState(() => !hasSeenSwipeHint());
  function teamMatchCount(teamId) {
    return matches.filter(m => m.teamAId === teamId || m.teamBId === teamId).length;
  }
  // Pinned teams first, otherwise the incoming order (already alpha, per handleSaveTeam) -- a
  // stable sort on just "is it pinned" preserves that alpha order within each group without this
  // screen needing to re-sort by name itself.
  const sortedTeams = [...teams].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20,
      paddingLeft: 16,
      paddingRight: 16,
      // See the matching comment in homeScreen.js's own root style -- reserves clearance under
      // the fixed TabBar when it's showing.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 60px + ${TAB_BAR_SAFE_BOTTOM})` : 60,
      maxWidth: 560,
      margin: "0 auto",
      // Lets EmptyState (flex: 1, further down) center in whatever space is actually left under
      // the header once teams.length === 0 -- see its own comment. Harmless when there are teams:
      // the wrapper below only opts into flex itself in the empty case, so a populated list keeps
      // its old plain-block, hug-its-content height exactly as before.
      display: "flex",
      flexDirection: "column",
      minHeight: "100dvh"
    }
  }, onBack && /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back",
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Users, {
    size: 22,
    style: {
      color: COLORS.gold
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch
    }
  }, teams.length > 0 ? `Teams · ${teams.length}` : "Teams"), teamsLoading && /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Refreshing…",
    size: 14,
    style: {
      fontSize: 11.5
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, onOpenInbox && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenInbox,
    "aria-label": inboxBadgeCount > 0 ? `Inbox, ${inboxBadgeCount} pending` : "Inbox",
    className: "cs-btn",
    style: {
      position: "relative",
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "none",
      border: "none",
      borderRadius: "50%",
      color: COLORS.pitch,
      cursor: "pointer",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Bell, {
    size: 19
  }), inboxBadgeCount > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 4,
      right: 4,
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
      boxShadow: `0 0 0 1.5px ${COLORS.creamFixed}`
    }
  }, inboxBadgeCount > 9 ? "9+" : inboxBadgeCount)), /*#__PURE__*/React.createElement(AuthBar, {
    user: user,
    profile: profile,
    onOpenAccount: onOpenAccount,
    onOpenHelp: onOpenHelp,
    onOpenFeedback: onOpenFeedback,
    onOpenAbout: onOpenAbout,
    onSignOut: onSignOut,
    themePref: themePref,
    onSetTheme: onSetTheme
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Build a simple roster once, then reuse it for every match or tournament you score."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 18,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, !showTabBar && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end"
    }
    // The FAB below (see the bottom of this component) is the "add a team" entry point on the
    // Teams tab itself, same as every other tab-bar screen's own create flow -- this inline "+
    // New" link only still renders for the no-tab-bar drill-in (onBack set, reached from
    // elsewhere in the app rather than as the Teams tab), which has no FAB of its own. The count
    // now lives in the page's own "Teams · N" heading above instead of a repeated inline label
    // here -- this card's only section was always its team list, so a second "Teams" eyebrow
    // right above it was pure repetition.
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onNewTeam,
    "aria-label": "New team",
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 3,
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: "4px 2px"
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14,
    strokeWidth: 2.5
  }), "New")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: teams.length > 0 ? 10 : 14,
      ...(teams.length === 0 ? { flex: 1, display: "flex", flexDirection: "column" } : {})
    }
  }, teamsLoading && teams.length === 0 ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading your teams…",
    size: 20,
    style: {
      padding: "10px 4px"
    }
  }) : teams.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, null, "No teams saved yet.", /*#__PURE__*/React.createElement("br", null), "Add one to reuse its line-up in future matches.") : /*#__PURE__*/React.createElement(React.Fragment, null, showSwipeHint && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.inkSoft,
      opacity: 0.7,
      marginBottom: 4
    }
  }, "← swipe to pin or delete"), sortedTeams.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      animation: `cs-slideUp 0.3s ease ${i * 0.04}s backwards`,
      marginBottom: i === sortedTeams.length - 1 ? 0 : 6
    }
  }, /*#__PURE__*/React.createElement(SwipeableRow, {
    onDelete: () => onDeleteTeam(t.id, null),
    deleteLabel: "Delete",
    onSwipeStart: () => setShowSwipeHint(false),
    extraIcon: onTogglePin ? Pin : undefined,
    extraLabel: "Pin",
    extraActiveLabel: "Unpin",
    extraActive: !!t.pinned,
    onExtra: onTogglePin ? () => onTogglePin(t) : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "cs-row",
    style: {
      background: COLORS.creamDark,
      padding: "12px 12px",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => onEditTeam(t),
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEditTeam(t);
      }
    },
    role: "button",
    tabIndex: 0,
    style: {
      cursor: "pointer",
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7
    }
  // A crest, not a plain dot -- "shield" reads correctly here (heraldry, a team's own colors),
  // unlike as a stand-in for "a group of people" (rejected for the Teams tab itself, kept Users
  // there). `fill`/`stroke` are CSS properties, not the SVG presentation attributes Icon hardcodes
  // (see icons.js), so setting them in `style` overrides the shared outline-icon default to give a
  // solid, team-colored crest instead of just another stroke-only icon.
  }, t.color && /*#__PURE__*/React.createElement(Shield, {
    size: 15,
    style: {
      fill: t.color,
      stroke: COLORS.creamDark,
      strokeWidth: 1,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13.5,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, t.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 1
    }
  }, t.players.length, " player", t.players.length === 1 ? "" : "s", " · ", teamMatchCount(t.id), " match", teamMatchCount(t.id) === 1 ? "" : "es", " played"), (t.captain || t.viceCaptain || t.keeper) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 4
    }
    // Same quick, display-only summary TeamEditScreen's own roster card shows -- who's tagged
    // what without opening the team to check.
  }, t.captain && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.gold,
      background: "rgba(184,137,43,0.16)",
      padding: "2px 7px",
      borderRadius: 10
    }
  }, "C · ", t.captain), t.viceCaptain && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      color: "#7a5c22",
      background: "rgba(201,168,118,0.3)",
      padding: "2px 7px",
      borderRadius: 10
    }
  }, "VC · ", t.viceCaptain), t.keeper && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.turf,
      background: "rgba(45,80,22,0.12)",
      padding: "2px 7px",
      borderRadius: 10
    }
  }, "WK · ", t.keeper))), /*#__PURE__*/React.createElement("button", {
    onClick: () => onEditTeam(t),
    className: "cs-btn",
    "aria-label": `Edit ${t.name}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: 8,
      borderRadius: 8,
      display: "flex",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 15
  })))))))))
), showTabBar && /*#__PURE__*/React.createElement(FabButton, {
    onClick: onNewTeam,
    label: "New team"
  }))
}
