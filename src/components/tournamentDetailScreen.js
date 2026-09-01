import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { CalendarClock, Cap, ChevronLeft, Download, Pencil, Plus, Share, Trophy } from "./icons.js";
import { Btn, ConfirmModal } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { StandingsTable } from "./tableAtoms.js";
import { ExportTournamentPdfButton } from "./exportButtons.js";
import { TournamentPrintReport } from "./scorecard.js";
import { TournamentShareModal, QualificationCalculatorModal } from "./miscModals.js";
import { FixturesSection } from "./fixturesSection.js";
import { computePlayerStats, suggestPlayerOfTournament, allMatchPlayers } from "../core/statsAndFixtures.js";
import { matchResultText, safeFilenamePart } from "../core/shareAndFormat.js";
import { computeStandings, computeGroupStandings } from "../core/appLogic.js";

// A single tournament's own screen: schedule (via FixturesSection)/standings/stats/matches tabs,
// Player of the Tournament, Orange/Purple Cap and Table Topper callouts, share, PDF export, a
// qualification-scenario calculator, and delete. `loadTournamentMatches` runs from a mount-time
// useEffect -- a bare-global Firestore call, not extracted, stubbed the usual way.
// `downloadCSV` (also a bare global, for the per-tab stats export) is only called from its own
// button handler. `TournamentShareModal`/`QualificationCalculatorModal` reference Modal as a bare
// global internally, so tests that open either one stub it too. Covered by
// tests/unit/components/tournamentDetailScreen.test.js.

export function TournamentDetailScreen({
  tournament,
  onBack,
  backLabel = "Cups",
  onStartMatch,
  onStartFixtureMatch,
  onUpdateTournament,
  onOpenMatch,
  onDeleteTournament,
  onOpenRecords,
  canManage = true,
  clubs = [],
  clubTeamsById = {}
}) {
  const [matches, setMatches] = useState(null); // null = loading
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteTournament, setConfirmDeleteTournament] = useState(false);
  const [statsTab, setStatsTab] = useState("batting"); // batting | bowling
  const [editingPOT, setEditingPOT] = useState(false);
  const [potDraft, setPotDraft] = useState("");
  const [potBusy, setPotBusy] = useState(false);
  const [showQualCalc, setShowQualCalc] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule");
  useEffect(() => {
    let cancelled = false;
    loadTournamentMatches(tournament.id).then(m => {
      if (!cancelled) setMatches(m);
    });
    return () => {
      cancelled = true;
    };
  }, [tournament.id]);
  const standings = matches ? computeStandings(tournament, matches) : [];
  const groupStandings = matches ? computeGroupStandings(tournament, matches) : null;
  const tournamentMatches = matches ? matches.filter(m => m.tournamentId === tournament.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
  const completedTournamentMatches = tournamentMatches.filter(m => m.status === "complete");
  const tournamentPlayerStats = computePlayerStats(completedTournamentMatches);
  const tournamentBatters = [...tournamentPlayerStats].filter(p => p.balls > 0).sort((a, b) => b.runs - a.runs).slice(0, 10);
  const tournamentBowlers = [...tournamentPlayerStats].filter(p => p.ballsBowled > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, 10);
  // Orange/Purple Cap: the tournament's leading run-scorer/wicket-taker — literally just the top
  // row of the same batting/bowling leaderboards already computed above for the Tournament Stats
  // tables, surfaced as their own callout since "who's leading" is the thing people actually look
  // for first, same reasoning as Player of the Tournament just below.
  // Player of the Tournament is an end-of-tournament award -- showing (or letting someone pick) a
  // "winner" while matches remain unplayed is premature: the auto-suggestion would keep changing
  // as more fixtures complete, and a manual pick wouldn't update to reflect it. Only Table Toppers
  // and the Orange/Purple Cap stay visible mid-tournament (see comment there) -- those are
  // legitimately interesting as live standings, not a final award. completedTournamentMatches.some
  // rather than the lighter matchId-only tournamentStatus() check used on the tournament list --
  // this screen already has full match data loaded, so it can confirm each fixture's match is
  // actually complete, not just linked.
  const tournamentFixtures = tournament.fixtures || [];
  const isTournamentComplete = tournamentFixtures.length > 0 && tournamentFixtures.every(f => f.matchId && completedTournamentMatches.some(m => m.id === f.matchId));
  const orangeCap = tournamentBatters[0] || null;
  const purpleCap = tournamentBowlers[0] || null;
  // Table Toppers: the standings leader, but only once someone's actually played — computeStandings
  // seeds every team at 0 points, so with nothing played yet "the leader" is just whichever team
  // happens to sort first and would be a meaningless callout.
  const tableTopper = standings[0] && standings[0].played > 0 ? standings[0] : null;
  const suggestedPOT = suggestPlayerOfTournament(completedTournamentMatches);
  const allPOTCandidates = Array.from(new Set(completedTournamentMatches.flatMap(m => allMatchPlayers(m)))).sort();
  const finalPOT = tournament.playerOfTournament || suggestedPOT;
  function startEditPOT() {
    if (!canManage) return;
    setPotDraft(tournament.playerOfTournament || suggestedPOT || "");
    setEditingPOT(true);
  }
  async function savePOT() {
    if (!canManage || !potDraft) return;
    setPotBusy(true);
    await onUpdateTournament({
      ...tournament,
      playerOfTournament: potDraft
    });
    setPotBusy(false);
    setEditingPOT(false);
  }
  async function resetPOTToSuggestion() {
    if (!canManage) return;
    setPotBusy(true);
    await onUpdateTournament({
      ...tournament,
      playerOfTournament: null
    });
    setPotBusy(false);
    setEditingPOT(false);
  }
  function handleDelete() {
    if (!canManage) return;
    setConfirmDeleteTournament(true);
  }
  function confirmDelete() {
    setConfirmDeleteTournament(false);
    setDeleting(true);
    onDeleteTournament(tournament);
  }
  const headerCellStyle = {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5
  };
  const dataCellStyle = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12.5,
    textAlign: "right"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
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
  }), " " + backLabel), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch
    }
  }, tournament.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, matches !== null && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowShare(true),
    className: "cs-btn",
    "aria-label": "Share tournament",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 4,
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Share, {
    size: 17
  })), canManage && /*#__PURE__*/React.createElement("button", {
    onClick: handleDelete,
    disabled: deleting,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "underline",
      flexShrink: 0,
      padding: 4
    }
  }, deleting ? "Deleting\u2026" : "Delete"))), matches === null ?  /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0"
    }
  }, /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading standings\u2026",
    size: 28,
    style: {
      flexDirection: "column",
      justifyContent: "center"
    }
  })) : /*#__PURE__*/React.createElement(React.Fragment, null,
    showShare && /*#__PURE__*/React.createElement(TournamentShareModal, {
    tournament: tournament,
    standings: standings,
    onClose: () => setShowShare(false),
    onUpdateTournament: onUpdateTournament
  }),
    isTournamentComplete && /*#__PURE__*/React.createElement("div", {
  style: {
    background: `linear-gradient(160deg, ${COLORS.surface}, ${COLORS.cream})`,
    borderRadius: 16,
    padding: "16px 18px",
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
    border: `1.5px solid ${COLORS.gold}`
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: editingPOT ? 12 : 4
  }
}, /*#__PURE__*/React.createElement(Trophy, {
  size: 16,
  color: COLORS.gold
}), /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.inkSoft
  }
}, "Player of the Tournament")), editingPOT ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("select", {
  value: potDraft,
  onChange: e => setPotDraft(e.target.value),
  style: {
    width: "100%",
    fontFamily: "'Inter'",
    fontSize: 14,
    padding: "9px 8px",
    borderRadius: 8,
    border: `1px solid ${COLORS.willow}`,
    background: COLORS.surface,
    marginBottom: 10
  }
}, /*#__PURE__*/React.createElement("option", {
  value: ""
}, "Choose a player\u2026"), allPOTCandidates.map(n => /*#__PURE__*/React.createElement("option", {
  key: n,
  value: n
}, n))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 8
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  disabled: potBusy || !potDraft,
  onClick: savePOT,
  style: {
    flex: 1,
    padding: "9px",
    fontSize: 13,
    borderRadius: 10,
    minHeight: 38
  }
}, potBusy ? "Saving\u2026" : "Save"), tournament.playerOfTournament && /*#__PURE__*/React.createElement(Btn, {
  disabled: potBusy,
  onClick: resetPOTToSuggestion,
  style: {
    flex: 1,
    padding: "9px",
    fontSize: 13,
    borderRadius: 10,
    minHeight: 38
  }
}, "Use suggestion"), /*#__PURE__*/React.createElement(Btn, {
  disabled: potBusy,
  onClick: () => setEditingPOT(false),
  style: {
    flex: 1,
    padding: "9px",
    fontSize: 13,
    borderRadius: 10,
    minHeight: 38
  }
}, "Cancel"))) : finalPOT ? /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 20,
    color: COLORS.pitch
  }
}, finalPOT), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 11.5,
    color: COLORS.inkSoft,
    marginTop: 2
  }
}, tournament.playerOfTournament ? "Selected manually" : "Auto-suggested \u2014 runs + 20 per wicket")), canManage && /*#__PURE__*/React.createElement("button", {
  onClick: startEditPOT,
  className: "cs-btn",
  style: {
    background: "none",
    border: "none",
    color: COLORS.pitch,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 12,
    padding: 4,
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(Pencil, {
  size: 13
}), " Edit")) : /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 13,
    color: COLORS.inkSoft,
    fontStyle: "italic"
  }
}, "No completed matches yet \u2014 play a match to get a suggestion, or ", /*#__PURE__*/React.createElement("button", {
  onClick: startEditPOT,
  className: "cs-btn",
  style: {
    background: "none",
    border: "none",
    color: COLORS.pitch,
    textDecoration: "underline",
    cursor: "pointer",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 13,
    padding: 0
  }
}, "pick one manually"), ".")),
    (orangeCap || purpleCap || tableTopper) && /*#__PURE__*/React.createElement("div", {
  style: {
    background: `linear-gradient(160deg, ${COLORS.surface}, ${COLORS.cream})`,
    borderRadius: 16,
    padding: "16px 18px",
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
    border: `1.5px solid ${COLORS.gold}`,
    display: "flex",
    flexDirection: "column",
    gap: 14
  }
}, orangeCap && /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Cap, {
  size: 26,
  style: {
    color: "#e8791c",
    flexShrink: 0
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minWidth: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#e8791c"
  }
}, "Orange Cap \u2014 most runs"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 16,
    color: COLORS.pitch,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, orangeCap.name)), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.pitch,
    flexShrink: 0
  }
}, orangeCap.runs, " runs")), purpleCap && /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Cap, {
  size: 26,
  style: {
    color: "#7b3fa0",
    flexShrink: 0
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minWidth: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#7b3fa0"
  }
}, "Purple Cap \u2014 most wickets"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 16,
    color: COLORS.pitch,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, purpleCap.name)), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.pitch,
    flexShrink: 0
  }
}, purpleCap.wickets, " wkts")), tableTopper && /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(Trophy, {
  size: 20,
  style: {
    color: COLORS.gold
  }
})), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minWidth: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.inkSoft
  }
}, "Table Toppers"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 16,
    color: COLORS.pitch,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, tableTopper.team)), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.pitch,
    flexShrink: 0
  }
}, tableTopper.points, " pts"))),
    /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16
    }
  }, [{
    key: "schedule",
    label: "Schedule"
  }, {
    key: "standings",
    label: "Standings"
  }, {
    key: "stats",
    label: "Stats"
  }, {
    key: "matches",
    label: "Matches"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.key,
    type: "button",
    onClick: () => setActiveTab(t.key),
    className: "cs-btn",
    style: {
      flex: 1,
      padding: "9px 4px",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      background: activeTab === t.key ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: activeTab === t.key ? "#fff" : COLORS.inkSoft,
      boxShadow: activeTab === t.key ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12.5
    }
  }, t.label))),
    activeTab === "schedule" && matches !== null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => onStartMatch(tournament),
    style: {
      width: "100%",
      padding: "12px",
      fontSize: 13.5,
      marginBottom: 20,
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16,
    strokeWidth: 2.5
  }), " Score an Extra Match (not on the fixture list)"), /*#__PURE__*/React.createElement(FixturesSection, {
    tournament: tournament,
    matches: matches,
    onStartFixtureMatch: onStartFixtureMatch,
    onUpdateTournament: onUpdateTournament,
    onOpenMatch: onOpenMatch,
    onOpenRecords: onOpenRecords,
    canManage: canManage,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  })),
    activeTab === "standings" && /*#__PURE__*/React.createElement(React.Fragment, null, groupStandings ? /*#__PURE__*/React.createElement(React.Fragment, null, groupStandings.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.label
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.pitch,
      marginBottom: 8
    }
  }, g.label), /*#__PURE__*/React.createElement(StandingsTable, {
    standings: g.standings
  })))) : /*#__PURE__*/React.createElement(StandingsTable, {
    standings: standings
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(ExportTournamentPdfButton, {
    tournament: tournament
  }), (tournament.fixtures || []).some(f => f.date) && /*#__PURE__*/React.createElement(Btn, {
    onClick: () => downloadTextFile(`${tournament.name.replace(/[^a-z0-9]+/gi, "-")}-fixtures.ics`, "text/calendar", buildTournamentICS(tournament)),
    style: {
      flex: 1,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement(CalendarClock, {
    size: 14
  }), " Add to calendar")), tournament.teams.length > 1 && /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowQualCalc(true),
    style: {
      width: "100%",
      marginBottom: 20,
      fontSize: 12.5,
      padding: "10px"
    }
  }, "Qualification calculator"), showQualCalc && /*#__PURE__*/React.createElement(QualificationCalculatorModal, {
    tournament: tournament,
    standings: standings,
    onClose: () => setShowQualCalc(false),
    onSave: scenario => onUpdateTournament({
      ...tournament,
      qualificationScenario: scenario
    })
  })),
    activeTab === "stats" && /*#__PURE__*/React.createElement("div", {
  style: {
    marginBottom: 20
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    marginBottom: 10
  }
}, "Tournament Stats"), tournamentPlayerStats.length === 0 ? /*#__PURE__*/React.createElement("div", {
  style: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    textAlign: "center",
    fontFamily: "'Inter'",
    fontSize: 13,
    color: COLORS.inkSoft
  }
}, "No completed balls scored in this tournament yet.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 8,
    marginBottom: 12
  }
}, ["batting", "bowling"].map(t => /*#__PURE__*/React.createElement("button", {
  key: t,
  onClick: () => setStatsTab(t),
  className: "cs-btn cs-shine",
  style: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 10,
    border: "none",
    background: statsTab === t ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
    color: statsTab === t ? "#fff" : COLORS.ink,
    boxShadow: statsTab === t ? "0 3px 10px rgba(45,80,22,0.3)" : "0 1px 3px rgba(42,36,32,0.06)",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textTransform: "capitalize"
  }
}, t))), /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: () => {
    const rows = statsTab === "batting" ? tournamentBatters : tournamentBowlers;
    const headers = statsTab === "batting" ? ["Player", "Runs", "Innings", "Average", "Strike Rate"] : ["Player", "Wickets", "Runs Conceded", "Average", "Economy"];
    const csvRows = statsTab === "batting" ? rows.map(p => [p.name, p.runs, p.battingInnings, p.battingAvg === null ? "" : p.battingAvg.toFixed(1), p.strikeRate === null ? "" : p.strikeRate.toFixed(1)]) : rows.map(p => [p.name, p.wickets, p.runsConceded, p.bowlingAvg === null ? "" : p.bowlingAvg.toFixed(1), p.economy === null ? "" : p.economy.toFixed(2)]);
    downloadCSV(`${safeFilenamePart(tournament.name)}-${statsTab}`, headers, csvRows);
  },
  className: "cs-btn",
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    padding: "8px 0",
    marginBottom: 12,
    borderRadius: 10,
    border: `1px solid ${COLORS.willow}`,
    background: COLORS.surface,
    color: COLORS.pitch,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer"
  }
}, /*#__PURE__*/React.createElement(Download, {
  size: 14
}), "Export CSV"), /*#__PURE__*/React.createElement("div", {
  style: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
  }
}, statsTab === "batting" ? tournamentBatters.length === 0 ? /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 13,
    color: COLORS.inkSoft,
    fontStyle: "italic"
  }
}, "No batting data yet.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "grid",
    gridTemplateColumns: "1.8fr 0.6fr 0.6fr 0.7fr 0.7fr",
    gap: 4,
    padding: "0 2px 6px",
    borderBottom: `1.5px solid ${COLORS.willow}`
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "left"
  }
}, "Player"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Runs"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Inn"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Avg"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "SR")), tournamentBatters.map(p => /*#__PURE__*/React.createElement("div", {
  key: p.name,
  style: {
    display: "grid",
    gridTemplateColumns: "1.8fr 0.6fr 0.6fr 0.7fr 0.7fr",
    gap: 4,
    padding: "7px 2px",
    borderBottom: `1px dashed ${COLORS.creamDark}`,
    fontFamily: "'Inter'"
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 13,
    fontWeight: 600,
    color: COLORS.ink,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, p.name), /*#__PURE__*/React.createElement("span", {
  style: {
    ...dataCellStyle,
    fontWeight: 700
  }
}, p.runs), /*#__PURE__*/React.createElement("span", {
  style: dataCellStyle
}, p.battingInnings), /*#__PURE__*/React.createElement("span", {
  style: dataCellStyle
}, p.battingAvg === null ? "-" : p.battingAvg.toFixed(1)), /*#__PURE__*/React.createElement("span", {
  style: dataCellStyle
}, p.strikeRate === null ? "-" : p.strikeRate.toFixed(0))))) : tournamentBowlers.length === 0 ? /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 13,
    color: COLORS.inkSoft,
    fontStyle: "italic"
  }
}, "No bowling data yet.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "grid",
    gridTemplateColumns: "1.8fr 0.6fr 0.6fr 0.7fr 0.7fr",
    gap: 4,
    padding: "0 2px 6px",
    borderBottom: `1.5px solid ${COLORS.willow}`
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "left"
  }
}, "Player"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Wkts"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Runs"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Avg"), /*#__PURE__*/React.createElement("span", {
  style: {
    ...headerCellStyle,
    textAlign: "right"
  }
}, "Econ")), tournamentBowlers.map(p => /*#__PURE__*/React.createElement("div", {
  key: p.name,
  style: {
    display: "grid",
    gridTemplateColumns: "1.8fr 0.6fr 0.6fr 0.7fr 0.7fr",
    gap: 4,
    padding: "7px 2px",
    borderBottom: `1px dashed ${COLORS.creamDark}`,
    fontFamily: "'Inter'"
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 13,
    fontWeight: 600,
    color: COLORS.ink,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, p.name), /*#__PURE__*/React.createElement("span", {
  style: {
    ...dataCellStyle,
    fontWeight: 700,
    color: COLORS.ball
  }
}, p.wickets), /*#__PURE__*/React.createElement("span", {
  style: dataCellStyle
}, p.runsConceded), /*#__PURE__*/React.createElement("span", {
  style: dataCellStyle
}, p.bowlingAvg === null ? "-" : p.bowlingAvg.toFixed(1)), /*#__PURE__*/React.createElement("span", {
  style: dataCellStyle
}, p.economy === null ? "-" : p.economy.toFixed(2)))))))),
    activeTab === "matches" && (tournamentMatches.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 13
    }
  }, "No matches scored in this tournament yet.") : tournamentMatches.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => onOpenMatch(m.id),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: "none",
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      cursor: "pointer",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      color: COLORS.ink
    }
  }, m.teamA, " vs ", m.teamB), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: m.status === "complete" ? COLORS.inkSoft : COLORS.turf,
      fontWeight: m.status === "complete" ? 500 : 700,
      flexShrink: 0,
      marginLeft: 10
    }
  }, m.status === "complete" ? matchResultText(m) || "Result unavailable" : "In progress")))),
    /*#__PURE__*/React.createElement(TournamentPrintReport, {
    tournament: tournament,
    standings: standings
  })
  ), confirmDeleteTournament && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Delete this tournament?",
    message: `Delete "${tournament.name}"? Matches already scored in it are untouched, but the tournament and its table go away for good.`,
    confirmLabel: "Delete",
    onConfirm: confirmDelete,
    onCancel: () => setConfirmDeleteTournament(false)
  }));
}
