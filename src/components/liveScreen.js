import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronRight, Trophy } from "./icons.js";
import { TextField } from "./formUiAtoms.js";
import { EmptyState, LoadingNote } from "./illustrations.js";
import { matchScoreLine } from "../core/shareAndFormat.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// The Live tab: the app-wide, unbounded view of the two live feeds (/liveMatches,
// /liveTournaments). A match card opens the live scoring/scorecard screen, a tournament card
// opens FollowTournamentScreen's read-only standings snapshot -- a tournament here is for
// watching a table, not scoring.
//
// Structured as two independent axes rather than one flat, recency-sorted scroll: WHAT (Matches /
// Tournaments -- different destinations, so never interleaved) and WHEN (Live / Results, or Live /
// Recently Finished for tournaments -- since a finished tournament showing under a section
// literally called "Live" read as a labeling bug, reported live, even once it was split out into
// its own clearly-headed section: "finished living inside live is misleading"). Live is always
// the view you land on; switching to Results/Recently Finished is a deliberate tap, not something
// you scroll past. A search box filters both feeds client-side (already fully loaded in memory,
// same as everywhere else this pattern's used) by team name, tournament name, or the tournament
// badge a match shows, narrowing whichever tab is currently open -- same persistent-inline-box
// placement as Home's own search. `watcherMode` (set when a signed-out visitor tapped "I'm
// watching" on WelcomeScreen -- see cricketScorer.js's handleWatch/exitWatcherMode) hides the
// TabBar (passed in via showTabBar, not handled here) and adds a single low-key way back to
// sign-in at the bottom of the screen, rather than stranding a watcher with no path to scoring.
// Covered by tests/unit/components/liveScreen.test.js.
export function LiveScreen({
  liveMatches = [],
  onOpenLiveMatch,
  liveTournaments = [],
  onOpenLiveTournament,
  tournamentNameById = {},
  showTabBar = false,
  loading = false,
  watcherMode = false,
  onExitWatcherMode
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("matches"); // matches | tournaments
  const [matchTab, setMatchTab] = useState("live"); // live | results
  const [tourneyTab, setTourneyTab] = useState("live"); // live | finished

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
  // m.status is the match's own real status; a tournament has no single status field, so
  // `champion` (see renderTournamentRow's own comment) stands in for it here too.
  const liveNowMatches = filteredMatches.filter(m => m.status !== "complete");
  const finishedMatches = filteredMatches.filter(m => m.status === "complete");
  const liveNowTournaments = filteredTournaments.filter(t => !t.champion);
  const finishedTournaments = filteredTournaments.filter(t => t.champion);

  function segmentedControl(options, active, onSelect) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        background: COLORS.creamDark,
        padding: 4,
        borderRadius: 12,
        marginBottom: 18
      }
    }, options.map(opt => /*#__PURE__*/React.createElement("button", {
      key: opt.key,
      type: "button",
      onClick: () => onSelect(opt.key),
      className: "cs-btn",
      "aria-pressed": active === opt.key,
      style: {
        flex: 1,
        border: "none",
        borderRadius: 9,
        padding: "9px 0",
        cursor: "pointer",
        fontFamily: "'Inter'",
        fontSize: 13,
        fontWeight: 700,
        background: active === opt.key ? COLORS.surface : "transparent",
        color: active === opt.key ? COLORS.pitch : COLORS.inkSoft,
        boxShadow: active === opt.key ? "0 1px 3px rgba(42,36,32,0.08)" : "none"
      }
    }, opt.label)));
  }

  // A pill-row sub-selector (Live/Results, Live/Recently Finished) -- distinct from the segmented
  // control above (that one swaps WHAT you're browsing; this one swaps WHEN). `accentColor` is the
  // active pill's own color (red for matches' Live, gold for tournaments' Live) -- Results/
  // Recently Finished always uses the same muted ink-soft tone regardless, since "this is over"
  // isn't a state that should compete visually with "this is live right now."
  function tabPills(options, active, onSelect) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 18
      }
    }, options.map(opt => {
      const isActive = active === opt.key;
      const color = isActive ? opt.accentColor || COLORS.pitch : COLORS.inkSoft;
      return /*#__PURE__*/React.createElement("button", {
        key: opt.key,
        type: "button",
        onClick: () => onSelect(opt.key),
        className: "cs-btn",
        "aria-pressed": isActive,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1.5px solid ${isActive ? color : COLORS.cardDivider}`,
          borderRadius: 20,
          padding: "7px 14px",
          cursor: "pointer",
          fontFamily: "'Inter'",
          fontSize: 12.5,
          fontWeight: 700,
          background: isActive ? color : COLORS.surface,
          color: isActive ? COLORS.creamFixed : COLORS.inkSoft
        }
      }, opt.dot && /*#__PURE__*/React.createElement("span", {
        "aria-hidden": "true",
        style: { width: 6, height: 6, borderRadius: "50%", background: isActive ? COLORS.creamFixed : COLORS.live }
      }), opt.label);
    }));
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

  const isMatches = view === "matches";
  const currentList = isMatches ? matchTab === "live" ? liveNowMatches : finishedMatches : tourneyTab === "live" ? liveNowTournaments : finishedTournaments;
  const currentRenderer = isMatches ? renderMatchRow : renderTournamentRow;
  // Shown only when the search itself found something (filteredEmpty already covers "nothing at
  // all"), but the specific tab currently open happens to have none of it -- e.g. a search that
  // only matches a finished match, while sitting on the Live tab.
  const emptyForTab = !filteredEmpty && currentList.length === 0 ? isMatches ? matchTab === "live" ? "No live matches right now." : "No results yet." : tourneyTab === "live" ? "No live tournaments right now." : "No tournaments have finished yet." : null;

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
  })), rawEmpty && !loading && /*#__PURE__*/React.createElement(EmptyState, null, "Nothing live right now."), !rawEmpty && /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", {
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
    }, "×") : null),
    filteredEmpty ? /*#__PURE__*/React.createElement(EmptyState, null, "Nothing matches “", query, "”.") : /*#__PURE__*/React.createElement(React.Fragment, null,
      segmentedControl([
        { key: "matches", label: "Matches" },
        { key: "tournaments", label: "Tournaments" }
      ], view, setView),
      isMatches ? tabPills([
        { key: "live", label: `Live (${liveNowMatches.length})`, dot: true, accentColor: COLORS.live },
        { key: "results", label: `Results (${finishedMatches.length})`, accentColor: COLORS.inkSoft }
      ], matchTab, setMatchTab) : tabPills([
        { key: "live", label: `Live (${liveNowTournaments.length})`, accentColor: COLORS.gold },
        { key: "finished", label: `Recently Finished (${finishedTournaments.length})`, accentColor: COLORS.inkSoft }
      ], tourneyTab, setTourneyTab),
      emptyForTab ? /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: "'Inter'",
          fontSize: 13,
          color: COLORS.inkSoft,
          textAlign: "center",
          padding: "24px 0"
        }
      }, emptyForTab) : currentList.map(currentRenderer)
    )
  ), watcherMode && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onExitWatcherMode,
    className: "cs-btn",
    style: {
      marginTop: 24,
      alignSelf: "center",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.inkSoft,
      textDecoration: "underline"
    }
  }, "Sign in to score a match"));
}
