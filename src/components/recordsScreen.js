import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, Download, Trophy } from "./icons.js";
import { TextField } from "./formUiAtoms.js";
import { RecordTable } from "./tableAtoms.js";
import { computeClubRecords } from "../core/statsAndFixtures.js";
import { safeFilenamePart } from "../core/shareAndFormat.js";
import { computeTournamentPlacement } from "../core/appLogic.js";
import { relativeDayLabel } from "../core/miscHelpers.js";

// A club's or federation's "Record Book": career milestones (centuries, five-wicket hauls, biggest
// wins), umpire appearance counts, and one placement (champion/runner-up) per tournament, with an
// all-time/current-year tab, a team filter, a player-name search, and a CSV export. Covered by
// tests/unit/components/recordsScreen.test.js.
//
// `loadFederationTournaments`/`loadClubTournaments`/`loadTournamentMatches` run together from a
// single mount-time useEffect -- bare-global Firestore calls, not extracted, stubbed the usual way.
// `downloadMultiSectionCSV` (also a bare global -- builds a CSV string via the already-extracted
// `multiSectionCSV`, then triggers a real download via a further-nested `downloadTextFile`, both
// real-DOM and neither extracted) is only ever called from the "Export all as CSV" button's own
// handler, never during render, so it just needs stubbing in the one test that clicks it.

export function RecordsScreen({
  sourceType,
  // "club" | "federation"
  sourceId,
  sourceName,
  onBack
}) {
  const [matches, setMatches] = useState(null); // null = loading
  const [tournaments, setTournaments] = useState(null); // null = loading; needed for title placements, not just matches
  const [recordsTab, setRecordsTab] = useState("allTime"); // "allTime" | "currentYear"
  const [teamFilter, setTeamFilter] = useState("all"); // "all" | a team name from matches
  const [playerQuery, setPlayerQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tlist = sourceType === "federation" ? await loadFederationTournaments(sourceId) : await loadClubTournaments(sourceId);
      const lists = await Promise.all(tlist.map(t => loadTournamentMatches(t.id)));
      if (!cancelled) {
        setMatches(lists.flat());
        setTournaments(tlist);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceType, sourceId]);
  // Local midnight Jan 1 of the current year — matches.createdAt is a plain epoch-ms timestamp
  // (see relativeDayLabel's own local-date handling elsewhere), so "current year" here means the
  // person's own calendar year, not UTC's.
  const currentYear = new Date().getFullYear();
  const yearStartTs = new Date(currentYear, 0, 1).getTime();
  // Every team name that's appeared on either side of a match here, for the team filter's
  // dropdown — deliberately derived from the matches themselves rather than a roster list, so it
  // only ever offers teams that could actually narrow the records down to something non-empty.
  const teamOptions = matches ? [...new Set(matches.flatMap(m => [m.teamA, m.teamB]).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : [];
  // Team filter narrows at the match level (only matches that team actually played in) before
  // aggregation, so it correctly scopes team totals/win margins AND the player leaderboards
  // (whoever played in those specific matches) with the same computeClubRecords logic used
  // everywhere else — no separate per-team code path needed.
  const teamFilteredMatches = matches && teamFilter !== "all" ? matches.filter(m => m.teamA === teamFilter || m.teamB === teamFilter) : matches;
  const records = teamFilteredMatches ? computeClubRecords(teamFilteredMatches, recordsTab === "currentYear" ? yearStartTs : undefined) : null;
  // Titles — one placement per tournament (see computeTournamentPlacement), scoped by the same
  // Year/team filters as the rest of the page even though it's computed from tournaments+matches
  // rather than computeClubRecords' match-only aggregation. Sorted newest-first so a club's most
  // recent silverware leads, same instinct as "recent form" mattering more than old history.
  // effectiveTs prefers the decided fixture's actual date over the tournament doc's createdAt —
  // createdAt is just "when the tournament was set up," which can be months before a long
  // season's final actually gets played, so it's a worse proxy for "which year did this happen."
  const placements = (tournaments || []).map(t => {
    const p = computeTournamentPlacement(t, matches);
    if (!p) return null;
    const effectiveTs = p.decidedDate ? new Date(p.decidedDate + "T00:00:00").getTime() : t.createdAt || 0;
    const year = p.decidedDate ? Number(p.decidedDate.slice(0, 4)) : t.createdAt ? new Date(t.createdAt).getFullYear() : null;
    return { ...p, effectiveTs, year };
  }).filter(Boolean).filter(p => recordsTab !== "currentYear" || p.effectiveTs >= yearStartTs).filter(p => teamFilter === "all" || p.champion === teamFilter || p.runnerUp === teamFilter).sort((a, b) => b.effectiveTs - a.effectiveTs);
  // Title tally per team, for the "most decorated" summary line above the year-by-year list —
  // counts championships only (a runner-up finish isn't a title), across whatever's in scope.
  const titleCounts = placements.reduce((acc, p) => {
    acc[p.champion] = (acc[p.champion] || 0) + 1;
    return acc;
  }, {});
  const titleEntries = Object.entries(titleCounts);
  const maxTitles = titleEntries.length ? Math.max(...titleEntries.map(([, c]) => c)) : 0;
  const titleLeaders = titleEntries.filter(([, c]) => c === maxTitles);
  // Only surface the "most decorated" banner when there's a single, unambiguous leader — a tie
  // (e.g. two teams with 1 title each) has no honest "most" to report. The full year-by-year list
  // below still shows every title either way, so nothing is hidden, just not mis-claimed.
  const mostTitled = titleLeaders.length === 1 ? titleLeaders[0] : null;
  const dateLabel = ts => ts ? relativeDayLabel(ts) || "\u2014" : "\u2014";
  // Player search is a client-side filter on already-computed rows (name is always the first
  // cell) — applies only to the player-named leaderboards/milestones, not the team-total or
  // win-margin tables, which have no player name to match against.
  const query = playerQuery.trim().toLowerCase();
  function playerRows(rows, emptyText) {
    if (!query) return {
      rows,
      emptyText
    };
    const filtered = rows.filter(r => String(r[0]).toLowerCase().includes(query));
    return {
      rows: filtered,
      emptyText: filtered.length === 0 ? `No one matching "${playerQuery.trim()}".` : emptyText
    };
  }
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
  }), " Cups"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Record Book"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, recordsTab === "currentYear" ? `${currentYear} records for ${sourceName}, across every completed match in every tournament ${sourceType === "federation" ? "the federation itself has" : "the club has"} run this year.` : `All-time records for ${sourceName}, across every completed match in every tournament ${sourceType === "federation" ? "the federation itself has" : "the club has"} run.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 20
    }
  }, [{
    value: "allTime",
    label: "All Time"
  }, {
    value: "currentYear",
    label: String(currentYear)
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.value,
    onClick: () => setRecordsTab(t.value),
    className: "cs-btn cs-shine",
    style: {
      flex: 1,
      padding: "9px 0",
      borderRadius: 10,
      border: "none",
      background: recordsTab === t.value ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: recordsTab === t.value ? "#fff" : COLORS.ink,
      boxShadow: recordsTab === t.value ? "0 3px 10px rgba(45,80,22,0.3)" : "0 1px 3px rgba(42,36,32,0.06)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }
  }, t.label))), placements.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "Titles"), mostTitled && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: `linear-gradient(160deg, #d4a544, ${COLORS.gold})`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 10,
      color: "#2e1c04",
      boxShadow: "0 3px 12px rgba(184,137,43,0.35)"
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 18
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13.5
    }
  }, `${mostTitled[0]} \u2014 most decorated, ${mostTitled[1]} title${mostTitled[1] === 1 ? "" : "s"}`)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: "4px 14px",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, placements.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.tournamentId,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 0",
      borderTop: i > 0 ? `1px dashed ${COLORS.creamDark}` : "none"
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 15,
    color: COLORS.gold,
    style: {
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
      fontWeight: 700,
      fontSize: 13,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, p.tournamentName), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 1
    }
  }, p.runnerUp ? `Runner-up: ${p.runnerUp}` : "\u00a0")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      color: COLORS.ink
    }
  }, p.champion), p.year && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft
    }
  }, p.year)))))), matches && matches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: teamFilter,
    onChange: e => setTeamFilter(e.target.value),
    style: {
      flex: 1,
      padding: "9px 10px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.willow}`,
      fontFamily: "'Inter'",
      fontSize: 13,
      background: COLORS.surface,
      color: COLORS.ink
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All teams"), teamOptions.map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }, t))), /*#__PURE__*/React.createElement(TextField, {
    value: playerQuery,
    onChange: setPlayerQuery,
    placeholder: "Search a player\u2026",
    autoCapitalize: "words",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    style: {
      flex: 1,
      padding: "9px 10px",
      fontSize: 13
    }
  })), !records ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 20,
      textAlign: "center",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft
    }
  }, "Loading records\u2026") : records.matchCount === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 20,
      textAlign: "center",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft
    }
  }, recordsTab === "currentYear" ? `No completed matches in ${currentYear} yet.` : "No completed matches yet \u2014 records fill in once tournament matches are finished.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, `Based on ${records.matchCount} completed match${records.matchCount === 1 ? "" : "es"}.`), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => downloadMultiSectionCSV(`${safeFilenamePart(sourceName)}-record-book-${recordsTab === "currentYear" ? currentYear : "all-time"}`, [{
      title: "Most Runs",
      headers: ["Player", "Runs", "Innings", "Average", "SR"],
      rows: records.mostRuns.map(p => [p.name, p.runs, p.battingInnings, p.battingAvg === null ? "" : p.battingAvg.toFixed(1), p.strikeRate === null ? "" : p.strikeRate.toFixed(0)])
    }, {
      title: "Highest Individual Scores",
      headers: ["Player", "Best"],
      rows: records.bestIndividualScores.map(p => [p.name, p.bestBattingLabel])
    }, {
      title: "Centuries",
      headers: ["Player", "Score", "Team", "Date"],
      rows: records.centuries.map(c => [c.name, `${c.runs}${c.out ? "" : "*"}`, c.team, dateLabel(c.date)])
    }, {
      title: "Biggest Partnerships",
      headers: ["Batters", "Runs", "Balls", "Team", "Date"],
      rows: records.biggestPartnerships.map(p => [`${p.batter1} & ${p.batter2}`, `${p.runs}${p.unbeaten ? "*" : ""}`, p.balls, p.team, dateLabel(p.date)])
    }, {
      title: "Most Wickets",
      headers: ["Player", "Wickets", "Runs", "Average", "Economy"],
      rows: records.mostWickets.map(p => [p.name, p.wickets, p.runsConceded, p.bowlingAvg === null ? "" : p.bowlingAvg.toFixed(1), p.economy === null ? "" : p.economy.toFixed(2)])
    }, {
      title: "Best Bowling Figures",
      headers: ["Player", "Best"],
      rows: records.bestBowlingFigures.map(p => [p.name, p.bestBowlingLabel])
    }, {
      title: "Five-Wicket Hauls",
      headers: ["Player", "Figures", "Team", "Date"],
      rows: records.fiveWicketHauls.map(f => [f.name, `${f.wickets}/${f.runs}`, f.team, dateLabel(f.date)])
    }, {
      title: "Most Catches",
      headers: ["Player", "Catches"],
      rows: records.mostCatches.map(p => [p.name, p.catches])
    }, {
      title: "Most Matches Umpired",
      headers: ["Umpire", "Matches"],
      rows: records.mostMatchesUmpired.map(u => [u.name, u.count])
    }, {
      title: "Highest Team Totals",
      headers: ["Team", "Opponent", "Score", "Date"],
      rows: records.highestTotals.map(t => [t.team, t.opponent, `${t.runs}/${t.wickets}`, dateLabel(t.date)])
    }, {
      title: "Lowest Totals (all out)",
      headers: ["Team", "Opponent", "Score", "Date"],
      rows: records.lowestAllOutTotals.map(t => [t.team, t.opponent, `${t.runs}/${t.wickets}`, dateLabel(t.date)])
    }, {
      title: "Biggest Wins by Runs",
      headers: ["Winner", "Beat", "Margin", "Date"],
      rows: records.winsByRuns.map(w => [w.winner, w.loser, `${w.margin} run${w.margin === 1 ? "" : "s"}`, dateLabel(w.date)])
    }, {
      title: "Biggest Wins by Wickets",
      headers: ["Winner", "Beat", "Margin", "Date"],
      rows: records.winsByWickets.map(w => [w.winner, w.loser, `${w.margin} wkt${w.margin === 1 ? "" : "s"}`, dateLabel(w.date)])
    }]),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: "100%",
      padding: "9px 0",
      marginBottom: 18,
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
  }), "Export all as CSV"), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Most Runs",
    columns: [{
      label: "Player",
      width: "1.7fr"
    }, {
      label: "Runs",
      align: "right",
      mono: true
    }, {
      label: "Inn",
      align: "right",
      mono: true
    }, {
      label: "Avg",
      align: "right",
      mono: true
    }, {
      label: "SR",
      align: "right",
      mono: true
    }],
    ...playerRows(records.mostRuns.map(p => [p.name, p.runs, p.battingInnings, p.battingAvg === null ? "\u2014" : p.battingAvg.toFixed(1), p.strikeRate === null ? "\u2014" : p.strikeRate.toFixed(0)]), "No batting data yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Highest Individual Scores",
    columns: [{
      label: "Player",
      width: "1.7fr"
    }, {
      label: "Best",
      align: "right",
      mono: true
    }],
    ...playerRows(records.bestIndividualScores.map(p => [p.name, p.bestBattingLabel]), "No batting data yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Centuries",
    columns: [{
      label: "Player",
      width: "1.5fr"
    }, {
      label: "Score",
      align: "right",
      mono: true
    }, {
      label: "Team",
      width: "1.2fr"
    }, {
      label: "Date",
      align: "right"
    }],
    ...playerRows(records.centuries.map(c => [c.name, `${c.runs}${c.out ? "" : "*"}`, c.team, dateLabel(c.date)]), "No centuries scored yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Biggest Partnerships",
    columns: [{
      label: "Batters",
      width: "1.4fr"
    }, {
      label: "Runs",
      align: "right",
      mono: true
    }, {
      label: "Balls",
      align: "right",
      mono: true
    }, {
      label: "Team",
      width: "0.9fr"
    }, {
      label: "Date",
      align: "right"
    }],
    ...playerRows(records.biggestPartnerships.map(p => [`${p.batter1} & ${p.batter2}`, `${p.runs}${p.unbeaten ? "*" : ""}`, p.balls, p.team, dateLabel(p.date)]), "No partnerships recorded yet \u2014 only matches scored since this feature shipped count.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Most Wickets",
    columns: [{
      label: "Player",
      width: "1.7fr"
    }, {
      label: "Wkts",
      align: "right",
      mono: true
    }, {
      label: "Runs",
      align: "right",
      mono: true
    }, {
      label: "Avg",
      align: "right",
      mono: true
    }, {
      label: "Econ",
      align: "right",
      mono: true
    }],
    ...playerRows(records.mostWickets.map(p => [p.name, p.wickets, p.runsConceded, p.bowlingAvg === null ? "\u2014" : p.bowlingAvg.toFixed(1), p.economy === null ? "\u2014" : p.economy.toFixed(2)]), "No bowling data yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Best Bowling Figures",
    columns: [{
      label: "Player",
      width: "1.7fr"
    }, {
      label: "Best",
      align: "right",
      mono: true
    }],
    ...playerRows(records.bestBowlingFigures.map(p => [p.name, p.bestBowlingLabel]), "No bowling data yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Five-Wicket Hauls",
    columns: [{
      label: "Player",
      width: "1.5fr"
    }, {
      label: "Figures",
      align: "right",
      mono: true
    }, {
      label: "Team",
      width: "1.2fr"
    }, {
      label: "Date",
      align: "right"
    }],
    ...playerRows(records.fiveWicketHauls.map(f => [f.name, `${f.wickets}/${f.runs}`, f.team, dateLabel(f.date)]), "No five-wicket hauls yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Most Catches",
    columns: [{
      label: "Player",
      width: "1.7fr"
    }, {
      label: "Catches",
      align: "right",
      mono: true
    }],
    ...playerRows(records.mostCatches.map(p => [p.name, p.catches]), "No catches recorded yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Most Matches Umpired",
    columns: [{
      label: "Umpire",
      width: "1.7fr"
    }, {
      label: "Matches",
      align: "right",
      mono: true
    }],
    ...playerRows(records.mostMatchesUmpired.map(u => [u.name, u.count]), "No umpires recorded yet.")
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Highest Team Totals",
    columns: [{
      label: "Team",
      width: "1.2fr"
    }, {
      label: "Opponent",
      width: "1.2fr"
    }, {
      label: "Score",
      align: "right",
      mono: true
    }, {
      label: "Date",
      align: "right"
    }],
    rows: records.highestTotals.map(t => [t.team, t.opponent, `${t.runs}/${t.wickets}`, dateLabel(t.date)]),
    emptyText: "No completed innings yet."
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Lowest Totals (all out)",
    columns: [{
      label: "Team",
      width: "1.2fr"
    }, {
      label: "Opponent",
      width: "1.2fr"
    }, {
      label: "Score",
      align: "right",
      mono: true
    }, {
      label: "Date",
      align: "right"
    }],
    rows: records.lowestAllOutTotals.map(t => [t.team, t.opponent, `${t.runs}/${t.wickets}`, dateLabel(t.date)]),
    emptyText: "No team has been bowled out yet."
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Biggest Wins by Runs",
    columns: [{
      label: "Winner",
      width: "1.2fr"
    }, {
      label: "Beat",
      width: "1.2fr"
    }, {
      label: "Margin",
      align: "right",
      mono: true
    }, {
      label: "Date",
      align: "right"
    }],
    rows: records.winsByRuns.map(w => [w.winner, w.loser, `${w.margin} run${w.margin === 1 ? "" : "s"}`, dateLabel(w.date)]),
    emptyText: "No results decided by runs yet."
  }), /*#__PURE__*/React.createElement(RecordTable, {
    title: "Biggest Wins by Wickets",
    columns: [{
      label: "Winner",
      width: "1.2fr"
    }, {
      label: "Beat",
      width: "1.2fr"
    }, {
      label: "Margin",
      align: "right",
      mono: true
    }, {
      label: "Date",
      align: "right"
    }],
    rows: records.winsByWickets.map(w => [w.winner, w.loser, `${w.margin} wkt${w.margin === 1 ? "" : "s"}`, dateLabel(w.date)]),
    emptyText: "No results decided by wickets yet."
  })));
}
