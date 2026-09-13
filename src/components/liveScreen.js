import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronRight, Trophy } from "./icons.js";
import { TextField } from "./formUiAtoms.js";
import { EmptyState, LoadingNote } from "./illustrations.js";
import { matchScoreLine } from "../core/shareAndFormat.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// The Live tab: the app-wide, unbounded view of the two live feeds (/liveMatches,
// /liveTournaments), kept as separate sections rather than one interleaved list since they lead
// to genuinely different destinations: a match card opens the live scoring/scorecard screen, a
// tournament card opens FollowTournamentScreen's read-only standings snapshot -- a tournament
// here is for watching a table, not scoring. A search box filters both feeds client-side (already
// fully loaded in memory, same as everywhere else this pattern's used) by team name, tournament
// name, or the tournament badge a match shows -- same persistent-inline-box placement as Home's
// own search, not a toggled/FAB affordance, so the one "search" idiom in this app looks and
// behaves the same everywhere it appears. Covered by tests/unit/components/liveScreen.test.js.
export function LiveScreen({
  liveMatches = [],
  onOpenLiveMatch,
  liveTournaments = [],
  onOpenLiveTournament,
  tournamentNameById = {},
  showTabBar = false,
  loading = false
}) {
  const [query, setQuery] = useState("");
  // tournamentNameById only knows this account's own tournaments, liveTournaments (the public
  // mirror) fills the gap for anyone else's non-private one, and a match whose tournament is
  // neither just gets no badge at all.
  const liveTournamentNameById = {};
  liveTournaments.forEach(t => {
    liveTournamentNameById[t.tournamentId] = t.name;
  });
  const tournamentNameForBadge = id => tournamentNameById[id] || liveTournamentNameById[id] || null;
  const q = query.trim().toLowerCase();
  const filteredMatches = q ? liveMatches.filter(m => m.teamA.toLowerCase().includes(q) || m.teamB.toLowerCase().includes(q) || (tournamentNameForBadge(m.tournamentId) || "").toLowerCase().includes(q)) : liveMatches;
  const filteredTournaments = q ? liveTournaments.filter(t => t.name.toLowerCase().includes(q)) : liveTournaments;
  // Requested live: a viewer looking for how a just-finished tournament/match ended had to scan
  // the exact same recency-sorted list as someone checking what's live right now, with no way to
  // tell the two apart at a glance except opening each one. /liveMatches already retains a
  // completed match for a few days after it ends (see loadLiveMatches's own comment on why), and
  // /liveTournaments does the same for a tournament (never deleted on completion, only when the
  // owner stops sharing or its TTL lapses) -- so "recently finished" was always in this same data,
  // just not split out. m.status is the match's own real status; a tournament has no single status
  // field, so `champion` (see renderTournamentRow's own comment) stands in for it here too.
  const liveNowMatches = filteredMatches.filter(m => m.status !== "complete");
  const finishedMatches = filteredMatches.filter(m => m.status === "complete");
  const liveNowTournaments = filteredTournaments.filter(t => !t.champion);
  const finishedTournaments = filteredTournaments.filter(t => t.champion);

  // `glow` defaults to true (every LIVE section's pulsing-dot halo, keyed to the dot's own color --
  // red for matches, gold for tournaments) but is turned off for a "Recently Finished" section
  // (see the Live Now/Recently Finished split below): a halo reads as "this needs your attention
  // right now," which is exactly wrong for something that's already over. Same muted COLORS.inkSoft
  // dot + no-glow treatment a completed match's OWN row already uses elsewhere (homeScreen.js).
  function sectionLabel(dotColor, text, glow = true) {
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
        boxShadow: glow ? `0 0 0 3px ${dotColor === COLORS.live ? "rgba(230,84,75,0.18)" : "rgba(184,146,74,0.18)"}` : "none",
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
    // `champion` (null until the tournament actually has a decided result -- see
    // formatTournamentViewSnapshot in appLogic.js, and shareTournament/refreshTournamentStandingsLive
    // in index.html, which mirror it onto this same /liveTournaments doc) means the difference
    // between "browsing to check on a live tournament's standings" and "browsing to see who won" --
    // shown right here so a viewer gets that answer without tapping in at all.
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
        color: t.champion ? COLORS.gold : COLORS.inkSoft,
        marginTop: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, t.champion ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Trophy, {
      size: 12,
      style: { verticalAlign: "-1.5px", marginRight: 3 }
    }), t.champion, " won") : `${t.teamsCount} team${t.teamsCount === 1 ? "" : "s"}`)));
  }

  const rawEmpty = liveMatches.length === 0 && liveTournaments.length === 0;
  const filteredEmpty = filteredMatches.length === 0 && filteredTournaments.length === 0;

  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20,
      paddingLeft: 16,
      paddingRight: 16,
      // See the matching comment in homeScreen.js's own root style -- reserves clearance under
      // the fixed TabBar when it's showing.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 60px + env(safe-area-inset-bottom))` : 60,
      maxWidth: 560,
      margin: "0 auto",
      // Lets EmptyState (flex: 1 on itself) center in whatever space is actually left under the
      // header, rather than a fixed vh fraction of the whole screen -- see its own comment.
      display: "flex",
      flexDirection: "column",
      minHeight: "100dvh"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 20
    }
  }, "Live"), rawEmpty && loading && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px"
    }
  }, /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading…",
    size: 22,
    style: { justifyContent: "center" }
  })), rawEmpty && !loading && /*#__PURE__*/React.createElement(EmptyState, null, "Nothing live right now."), !rawEmpty && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: query,
    onChange: setQuery,
    placeholder: "Search live matches & tournaments…",
    style: { paddingRight: 38 }
  }), query ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setQuery(""),
    "aria-label": "Clear search",
    className: "cs-btn",
    style: {
      position: "absolute",
      right: 8,
      top: "50%",
      transform: "translateY(-50%)",
      width: 26,
      height: 26,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: COLORS.inkSoft,
      borderRadius: "50%",
      fontSize: 20,
      lineHeight: 1
    }
  }, "\u00d7") : null), !rawEmpty && filteredEmpty && /*#__PURE__*/React.createElement(EmptyState, null, "Nothing matches “", query, "”."),
  liveNowMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 26 }
  }, sectionLabel(COLORS.live, `Live Matches (${liveNowMatches.length})`), liveNowMatches.map(renderMatchRow)),
  liveNowTournaments.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 26 }
  }, sectionLabel(COLORS.gold, `Live Tournaments (${liveNowTournaments.length})`), liveNowTournaments.map(renderTournamentRow)),
  finishedMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 26 }
  }, sectionLabel(COLORS.inkSoft, `Recently Finished Matches (${finishedMatches.length})`, false), finishedMatches.map(renderMatchRow)),
  finishedTournaments.length > 0 && /*#__PURE__*/React.createElement("div", null, sectionLabel(COLORS.inkSoft, `Recently Finished Tournaments (${finishedTournaments.length})`, false), finishedTournaments.map(renderTournamentRow)));
}
