import React from "react";
import { COLORS } from "./theme.js";
import { ChevronRight, Trophy } from "./icons.js";
import { EmptyStateBallIllustration } from "./illustrations.js";
import { matchScoreLine } from "../core/shareAndFormat.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// The full-list destination behind each "See all" on the Home screen's Live now / Live
// tournaments preview strips -- those strips only ever show a handful of cards (see
// LIVE_HOME_LIMIT in homeScreen.js), this is the unbounded view of the same two live feeds
// (/liveMatches, /liveTournaments), kept as separate sections rather than one interleaved list
// since they lead to genuinely different destinations: a match card opens the live scoring/
// scorecard screen, a tournament card opens FollowTournamentScreen's read-only standings
// snapshot -- a tournament here is for watching a table, not scoring. Covered by
// tests/unit/components/liveScreen.test.js.
export function LiveScreen({
  liveMatches = [],
  onOpenLiveMatch,
  liveTournaments = [],
  onOpenLiveTournament,
  tournamentNameById = {},
  showTabBar = false
}) {
  // Same fallback chain as the Home screen's own "Live now" strip: tournamentNameById only knows
  // this account's own tournaments, liveTournaments (the public mirror) fills the gap for anyone
  // else's non-private one, and a match whose tournament is neither just gets no badge at all.
  const liveTournamentNameById = {};
  liveTournaments.forEach(t => {
    liveTournamentNameById[t.tournamentId] = t.name;
  });
  const tournamentNameForBadge = id => tournamentNameById[id] || liveTournamentNameById[id] || null;

  function sectionLabel(dotColor, text) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: dotColor,
        boxShadow: `0 0 0 3px ${dotColor === COLORS.live ? "rgba(230,84,75,0.18)" : "rgba(184,146,74,0.18)"}`,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 1.2,
        color: COLORS.inkSoft,
        textTransform: "uppercase"
      }
    }, text));
  }

  function liveRow(key, onClick, content) {
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      type: "button",
      onClick: onClick,
      className: "cs-btn",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        width: "100%",
        textAlign: "left",
        background: COLORS.surface,
        border: "none",
        borderRadius: 14,
        padding: "12px 14px",
        marginBottom: 8,
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: { minWidth: 0, flex: 1 }
    }, content), /*#__PURE__*/React.createElement(ChevronRight, {
      size: 17,
      style: { color: COLORS.inkSoft, opacity: 0.55, flexShrink: 0 }
    }));
  }

  function renderMatchRow(m) {
    return liveRow(m.id, () => onOpenLiveMatch && onOpenLiveMatch(m.id), /*#__PURE__*/React.createElement(React.Fragment, null, m.tournamentId && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "'Inter'",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: COLORS.gold,
        marginBottom: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement(Trophy, {
      size: 10,
      style: { flexShrink: 0 }
    }), tournamentNameForBadge(m.tournamentId)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 14,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, m.teamA, " ", /*#__PURE__*/React.createElement("span", {
      style: { color: COLORS.inkSoft, fontWeight: 500 }
    }, "vs"), " ", m.teamB), matchScoreLine(m) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12.5,
        fontWeight: 600,
        color: COLORS.inkSoft,
        marginTop: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, matchScoreLine(m))));
  }

  function renderTournamentRow(t) {
    return liveRow(t.tournamentId, () => onOpenLiveTournament && onOpenLiveTournament(t.shareCode), /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 14,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12.5,
        fontWeight: 600,
        color: COLORS.inkSoft,
        marginTop: 3
      }
    }, t.teamsCount, " team", t.teamsCount === 1 ? "" : "s")));
  }

  const isEmpty = liveMatches.length === 0 && liveTournaments.length === 0;

  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20,
      paddingLeft: 16,
      paddingRight: 16,
      // See the matching comment in homeScreen.js's own root style -- reserves clearance under
      // the fixed TabBar when it's showing.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 60px + env(safe-area-inset-bottom))` : 60,
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 20
    }
  }, "Live"), isEmpty && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px"
    }
  }, /*#__PURE__*/React.createElement(EmptyStateBallIllustration, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      marginTop: 12
    }
  }, "Nothing live right now.")), liveMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 26 }
  }, sectionLabel(COLORS.live, `Matches (${liveMatches.length})`), liveMatches.map(renderMatchRow)), liveTournaments.length > 0 && /*#__PURE__*/React.createElement("div", null, sectionLabel(COLORS.gold, `Tournaments (${liveTournaments.length})`), liveTournaments.map(renderTournamentRow)));
}
