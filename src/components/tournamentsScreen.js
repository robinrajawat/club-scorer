import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Plus, Trophy } from "./icons.js";
import { Btn, TextField, PinnableChip } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS_COLORS } from "./tournamentStatus.js";
import { isClubOwner, tournamentStatus, tournamentDateRangeLabel } from "../core/miscHelpers.js";
import { knockoutStagesPreview, withPinnedFirst } from "../core/appLogic.js";

// The "Cups" list: club/federation source chips, create-tournament (with optional group-stage
// split) and create-series forms, a status/search filter over the list, and each tournament as a
// tappable row. Every write action is a prop (onCreateTournament/onCreateSeries) -- no bare
// globals, no mount effect. `Modal` (bare global, same as everywhere else in this suite) backs the
// create-series dialog only -- create-tournament is an inline card, not a modal. Covered by
// tests/unit/components/tournamentsScreen.test.js.

export function TournamentsScreen({
  tournaments,
  clubs,
  activeClubId,
  onSelectSource,
  myFederations = [],
  activeFederationId,
  onSelectFederationSource,
  teamOptions,
  federationTeamOptions = [],
  onCreateTournament,
  onCreateSeries,
  onOpenTournament,
  onOpenRecords,
  onBack,
  currentUid,
  clubsLoading,
  federationsLoading,
  pinnedClubIds = [],
  onTogglePinClub,
  pinnedFederationIds = [],
  onTogglePinFederation
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | upcoming | ongoing | completed
  const [useGroups, setUseGroups] = useState(false);
  const [numGroups, setNumGroups] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  // The advance-per-group picker offers 1/2/3 unconditionally, with no upper bound tied to how
  // many teams actually end up in the smallest group -- so it's entirely possible to pick a
  // combination that's mathematically impossible (e.g. 4 teams split into 4 groups of 1, with
  // "advance 3" selected). Computed here so the group-shape hint below can catch it and say so
  // plainly instead of confidently stating a qualifier count that can't really happen.
  const smallestGroupSize = numGroups > 0 ? Math.floor(selectedTeams.length / numGroups) : 0;
  const advanceExceedsGroupSize = advancePerGroup > smallestGroupSize;
  const [groupOverrides, setGroupOverrides] = useState({}); // team name -> group index, only for teams manually re-assigned off the auto-split
  const GROUP_LABELS = ["Group A", "Group B", "Group C", "Group D"];
  // Auto-split (round-robin through the group count, in selection order) unless the person
  // tapped a team to move it to a different group — new teams added after that still fall into
  // the auto-split rather than needing every team re-assigned from scratch.
  function teamGroupIndex(team) {
    // If numGroups shrinks after a team was manually cycled to a higher-numbered group (e.g. moved
    // to Group D, then the count drops back to 2), that stored override is now out of range —
    // falling through to the auto-split default here instead of returning it directly is what
    // stops the team from silently vanishing out of every group at submit time (nothing would
    // match an index that no longer exists).
    const override = groupOverrides[team];
    if (override !== undefined && override < numGroups) return override;
    return selectedTeams.indexOf(team) % numGroups;
  }
  function cycleTeamGroup(team) {
    setGroupOverrides(o => ({
      ...o,
      [team]: (teamGroupIndex(team) + 1) % numGroups
    }));
  }
  const [creatingSeries, setCreatingSeries] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [seriesTeamA, setSeriesTeamA] = useState("");
  const [seriesTeamB, setSeriesTeamB] = useState("");
  const [seriesMatchCount, setSeriesMatchCount] = useState("3");
  const [seriesError, setSeriesError] = useState("");
  const [seriesBusy, setSeriesBusy] = useState(false);
  const visibleTournaments = tournaments.filter(t => (statusFilter === "all" || tournamentStatus(t) === statusFilter) && (!searchTerm.trim() || t.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const activeClub = activeClubId ? clubs.find(c => c.id === activeClubId) || null : null;
  const activeClubName = activeClub && activeClub.name;
  // myFederations is already scoped to federations this user owns/co-owns (see myOwnedFederationIds
  // upstream), so finding activeFederationId in it is really just a defensive existence check —
  // the chip row below can only ever select an id that's already in that list.
  const activeFederation = activeFederationId ? myFederations.find(f => f.id === activeFederationId) || null : null;
  const activeFederationName = activeFederation && activeFederation.name;
  const canManage = activeFederationId ? !!activeFederation : !activeClubId || isClubOwner(activeClub, currentUid);
  const totalTeamOptions = teamOptions.length + federationTeamOptions.length;
  // federationTeamOptions holds {clubName, teamName, teamId, clubId} objects (needed as objects
  // for the chip picker below, which shows each team alongside its club name). The series-create
  // Team A/B <select> dropdowns only need the name string, same as teamOptions -- mixing the raw
  // objects into that string list crashed React (error #31: object passed as <option> children).
  const federationTeamNames = federationTeamOptions.map(t => t.teamName);
  function toggleTeam(n) {
    setSelectedTeams(s => s.includes(n) ? s.filter(x => x !== n) : [...s, n]);
  }
  function openCreate() {
    setName("");
    setSelectedTeams([]);
    setError("");
    setCreating(true);
  }
  async function submitCreate() {
    if (!name.trim() || selectedTeams.length < 2 || busy) return;
    setBusy(true);
    setError("");
    const groups = useGroups ? GROUP_LABELS.slice(0, numGroups).map((label, i) => ({
      label,
      teams: selectedTeams.filter(t => teamGroupIndex(t) === i)
    })).filter(g => g.teams.length > 0) : null;
    const result = await onCreateTournament(name.trim(), selectedTeams, groups, useGroups ? advancePerGroup : null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Couldn't create the tournament.");
      return;
    }
    setCreating(false);
  }
  function openCreateSeries() {
    setSeriesName("");
    setSeriesTeamA("");
    setSeriesTeamB("");
    setSeriesMatchCount("3");
    setSeriesError("");
    setCreatingSeries(true);
  }
  async function submitCreateSeries() {
    if (seriesBusy) return;
    if (!seriesTeamA || !seriesTeamB || seriesTeamA === seriesTeamB) {
      setSeriesError("Pick two different teams.");
      return;
    }
    const count = parseInt(seriesMatchCount || "0", 10);
    if (!count || count < 1) {
      setSeriesError("Enter how many matches this series has.");
      return;
    }
    setSeriesBusy(true);
    setSeriesError("");
    const label = seriesName.trim() || `${seriesTeamA} vs ${seriesTeamB}`;
    const result = await onCreateSeries(label, seriesTeamA, seriesTeamB, count);
    setSeriesBusy(false);
    if (!result.ok) {
      setSeriesError(result.error || "Couldn't create the series.");
      return;
    }
    setCreatingSeries(false);
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
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 22,
    style: {
      color: COLORS.pitch
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch
    }
  }, "Cups"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowInfo(v => !v),
    "aria-label": showInfo ? "Hide info" : "What's this screen for?",
    "aria-expanded": showInfo,
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      flexShrink: 0,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 17
  })), (clubsLoading || federationsLoading) && /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Refreshing\u2026",
    size: 14,
    style: {
      fontSize: 11.5
    }
  })), showInfo && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5,
      background: COLORS.surface,
      borderRadius: 12,
      padding: "10px 12px"
    }
  }, "Tournaments & series \u2014 group matches together for a running points table, or track a run of head-to-head games instead. Tag a match with a tournament from its setup screen."), (clubs.length > 0 || myFederations.length > 0) && /*#__PURE__*/React.createElement(React.Fragment, null, (clubs.length + myFederations.length > 2) && /*#__PURE__*/React.createElement("div", {
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
      paddingBottom: 4,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onSelectSource(null);
      onSelectFederationSource(null);
    },
    style: {
      padding: "7px 13px",
      borderRadius: 20,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      border: !activeClubId && !activeFederationId ? "none" : `1px solid ${COLORS.willow}`,
      background: !activeClubId && !activeFederationId ? COLORS.pitchFixed : COLORS.surface,
      color: !activeClubId && !activeFederationId ? "#fff" : COLORS.inkSoft,
      whiteSpace: "nowrap",
      flexShrink: 0
    }
  }, "All"), withPinnedFirst(clubs, pinnedClubIds).map(c => /*#__PURE__*/React.createElement(PinnableChip, {
    key: c.id,
    label: c.name,
    active: activeClubId === c.id,
    pinned: pinnedClubIds.includes(c.id),
    onSelect: () => onSelectSource(c.id),
    onTogglePin: () => onTogglePinClub(c.id)
  })), withPinnedFirst(myFederations, pinnedFederationIds).map(f => /*#__PURE__*/React.createElement(PinnableChip, {
    key: f.id,
    label: f.name,
    active: activeFederationId === f.id,
    pinned: pinnedFederationIds.includes(f.id),
    onSelect: () => onSelectFederationSource(f.id),
    onTogglePin: () => onTogglePinFederation(f.id),
    dashed: true
  })))), !creating && canManage && /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: openCreate,
    disabled: totalTeamOptions < 2,
    style: {
      width: "100%",
      padding: "14px",
      fontSize: 15,
      marginBottom: 16,
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 18,
    strokeWidth: 2.5
  }), activeFederationName ? ` New Tournament in ${activeFederationName}` : activeClubName ? ` New Tournament in ${activeClubName}` : " New Tournament"), !creating && canManage && totalTeamOptions >= 2 && /*#__PURE__*/React.createElement("button", {
    onClick: openCreateSeries,
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "center",
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      marginTop: -8,
      marginBottom: 16,
      textDecoration: "underline"
    }
  }, "or start a head-to-head series instead"), tournaments.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: "Search by name"
  }), /*#__PURE__*/React.createElement("div", {
    className: "cs-no-scrollbar",
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      paddingBottom: 2,
      marginTop: 8
    }
  }, [["all", "All"], ["upcoming", "Upcoming"], ["ongoing", "Ongoing"], ["completed", "Completed"]].map(([key, label]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    onClick: () => setStatusFilter(key),
    style: {
      padding: "5px 11px",
      borderRadius: 20,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      border: statusFilter === key ? "none" : `1px solid ${COLORS.willow}`,
      background: statusFilter === key ? COLORS.pitchFixed : COLORS.surface,
      color: statusFilter === key ? "#fff" : COLORS.inkSoft,
      whiteSpace: "nowrap"
    }
  }, label)))), creatingSeries && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setCreatingSeries(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "New series"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "A head-to-head set of matches between two teams \u2014 a running series score instead of a points table. Good for a 3-match ODI series or a weekend rematch."), /*#__PURE__*/React.createElement(Field, {
    label: "Series name (optional)"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: seriesName,
    onChange: setSeriesName,
    placeholder: "e.g. Summer Derby"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Team A"
  }, /*#__PURE__*/React.createElement("select", {
    value: seriesTeamA,
    onChange: e => setSeriesTeamA(e.target.value),
    style: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.willow}`,
      fontFamily: "'Inter'",
      fontSize: 14,
      background: COLORS.surface,
      color: COLORS.ink
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Choose a team\u2026"), [...teamOptions, ...federationTeamNames].filter((v, i, arr) => arr.indexOf(v) === i).map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)))), /*#__PURE__*/React.createElement(Field, {
    label: "Team B"
  }, /*#__PURE__*/React.createElement("select", {
    value: seriesTeamB,
    onChange: e => setSeriesTeamB(e.target.value),
    style: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.willow}`,
      fontFamily: "'Inter'",
      fontSize: 14,
      background: COLORS.surface,
      color: COLORS.ink
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Choose a team\u2026"), [...teamOptions, ...federationTeamNames].filter((v, i, arr) => arr.indexOf(v) === i).map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)))), /*#__PURE__*/React.createElement(Field, {
    label: "Number of matches"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: seriesMatchCount,
    onChange: v => setSeriesMatchCount(v.replace(/[^0-9]/g, "")),
    placeholder: "3"
  })), seriesError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ball,
      marginBottom: 10
    }
  }, seriesError), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: seriesBusy,
    onClick: submitCreateSeries,
    style: {
      width: "100%"
    }
  }, seriesBusy ? "Creating\u2026" : "Create series")), !canManage && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      marginTop: -8,
      marginBottom: 16
    }
  }, `Only the owner of "${activeClubName}" can add tournaments.`), totalTeamOptions < 2 && !creating && canManage && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      marginTop: -8,
      marginBottom: 16
    }
  }, activeFederationName ? `${activeFederationName}'s member clubs need at least 2 teams between them first.` : activeClubName ? `${activeClubName} needs at least 2 saved (or federation-visible) teams first.` : "Save at least 2 teams first (Teams screen)."), creating && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Tournament name"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: name,
    onChange: setName,
    placeholder: "e.g. Summer T20 League"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      margin: "14px 0 8px"
    }
  }, "Participating teams (", selectedTeams.length, " selected)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14
    }
  }, teamOptions.map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    onClick: () => toggleTeam(n),
    className: "cs-btn cs-shine",
    style: {
      padding: "8px 13px",
      borderRadius: 18,
      border: "none",
      cursor: "pointer",
      background: selectedTeams.includes(n) ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: selectedTeams.includes(n) ? "#fff" : COLORS.ink,
      boxShadow: selectedTeams.includes(n) ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5
    }
  }, n))), federationTeamOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "From federation clubs"), federationTeamOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14
    }
  }, federationTeamOptions.map(t => /*#__PURE__*/React.createElement("button", {
    key: `${t.clubId}_${t.teamId}`,
    type: "button",
    onClick: () => toggleTeam(t.teamName),
    className: "cs-btn cs-shine",
    style: {
      padding: "8px 13px",
      borderRadius: 18,
      border: selectedTeams.includes(t.teamName) ? "none" : `1px dashed ${COLORS.gold}`,
      cursor: "pointer",
      background: selectedTeams.includes(t.teamName) ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: selectedTeams.includes(t.teamName) ? "#fff" : COLORS.ink,
      boxShadow: selectedTeams.includes(t.teamName) ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5
    }
  }, t.teamName, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.65,
      fontWeight: 500
    }
  }, "\u00b7 ", t.clubName)))), selectedTeams.length >= 2 && !useGroups && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, `${selectedTeams.length} teams, one round-robin table \u2192 ${knockoutStagesPreview(selectedTeams.length)}.`), selectedTeams.length >= 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: useGroups ? 10 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, "Split into groups"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setUseGroups(g => !g),
    style: {
      padding: "6px 13px",
      borderRadius: 18,
      border: "none",
      cursor: "pointer",
      background: useGroups ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: useGroups ? "#fff" : COLORS.ink,
      boxShadow: useGroups ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5
    }
  }, useGroups ? "On" : "Off")), useGroups && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 10
    }
  }, "Each group plays round-robin only within itself, then the top teams from every group cross over into a knockout \u2014 e.g. Group A's #1 plays Group B's #2."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 5
    }
  }, "Number of groups"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, [2, 3, 4].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setNumGroups(n),
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      border: "none",
      cursor: "pointer",
      background: numGroups === n ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: numGroups === n ? "#fff" : COLORS.ink,
      boxShadow: numGroups === n ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13
    }
  }, n)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 5
    }
  }, "Advance per group"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, [1, 2, 3].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setAdvancePerGroup(n),
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      border: "none",
      cursor: "pointer",
      background: advancePerGroup === n ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: advancePerGroup === n ? "#fff" : COLORS.ink,
      boxShadow: advancePerGroup === n ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13
    }
  }, n))))), advanceExceedsGroupSize ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 6,
      padding: "8px 10px",
      marginBottom: 12,
      background: "rgba(184,137,43,0.14)",
      border: "1px solid rgba(184,137,43,0.35)",
      borderRadius: 10,
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.gold,
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement(AlertTriangle, {
    size: 14,
    style: {
      flexShrink: 0,
      marginTop: 1
    }
  }), `${numGroups} groups from ${selectedTeams.length} teams means the smallest group only has ${smallestGroupSize} \u2014 not enough to advance ${advancePerGroup}. Lower "Advance per group" or add more teams.`) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, `${numGroups} groups, top ${advancePerGroup} from each advance \u2192 ${numGroups * advancePerGroup} qualifiers \u2192 ${knockoutStagesPreview(numGroups * advancePerGroup)}.`), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Tap a team to move it to a different group"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, selectedTeams.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => cycleTeamGroup(t),
    style: {
      padding: "7px 12px",
      borderRadius: 16,
      border: "none",
      cursor: "pointer",
      background: COLORS.surface,
      boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      color: COLORS.ink,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, t, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.pitch,
      background: `color-mix(in srgb, ${COLORS.pitch} 14%, ${COLORS.surface})`,
      padding: "1.5px 6px",
      borderRadius: 8
    }
  }, GROUP_LABELS[teamGroupIndex(t)].replace("Group ", ""))))))), error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setCreating(false),
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !name.trim() || selectedTeams.length < 2 || busy,
    onClick: submitCreate,
    style: {
      flex: 2
    }
  }, busy ? "Creating\u2026" : "Create"))), visibleTournaments.length > 0 ? visibleTournaments.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => onOpenTournament(t),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: "none",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 10,
      cursor: "pointer",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14.5,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, t.name), t.kind === "series" && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontFamily: "'Inter'",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: COLORS.pitch,
      border: `1.2px solid ${COLORS.pitch}`,
      padding: "1.5px 6px",
      borderRadius: 10
    }
  }, "Series"), /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontFamily: "'Inter'",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: TOURNAMENT_STATUS_COLORS[tournamentStatus(t)],
      background: `color-mix(in srgb, ${TOURNAMENT_STATUS_COLORS[tournamentStatus(t)]} 16%, ${COLORS.surface})`,
      border: `1px solid color-mix(in srgb, ${TOURNAMENT_STATUS_COLORS[tournamentStatus(t)]} 45%, transparent)`,
      padding: "1.5px 6px",
      borderRadius: 10
    }
  }, TOURNAMENT_STATUS_LABELS[tournamentStatus(t)])), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft
    }
  }, t.kind === "series" ? `${(t.fixtures || []).length} match${(t.fixtures || []).length === 1 ? "" : "es"}` : `${t.teams.length} teams`, tournamentDateRangeLabel(t) && ` · ${tournamentDateRangeLabel(t)}`, !activeClubId && t._clubId && ` · ${(clubs.find(c => c.id === t._clubId) || {}).name || "a club"}`, !activeFederationId && t._federationId && ` · ${(myFederations.find(f => f.id === t._federationId) || {}).name || "a federation"}`)), /*#__PURE__*/React.createElement(ChevronRight, {
    size: 18,
    style: {
      color: COLORS.inkSoft,
      flexShrink: 0
    }
  }))) : !creating && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 20px",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 13.5,
      lineHeight: 1.6
    }
  }, tournaments.length > 0 ? "No tournaments match your search/filter." : activeClubName ? `No tournaments in ${activeClubName} yet.` : "No tournaments yet."));
}
