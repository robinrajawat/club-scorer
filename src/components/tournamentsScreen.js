import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Pencil, Plus, Trophy } from "./icons.js";
import { Btn, TextField, PinnableChip, RuleChoice } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS_COLORS } from "./tournamentStatus.js";
import { VenueEditModal } from "./venueAndDateModals.js";
import { isClubOwner, tournamentStatus, tournamentDateRangeLabel } from "../core/miscHelpers.js";
import { knockoutStagesPreview, withPinnedFirst, DEFAULT_RULES } from "../core/appLogic.js";
import { nonStandardRulesText, buildMapsUrl } from "../core/shareAndFormat.js";

// The "Cups" list: club/federation source chips, create-tournament (with optional group-stage
// split) and create-series forms, a status/search filter over the list, and each tournament as a
// tappable row. Every write action is a prop (onCreateTournament/onCreateSeries) -- no bare
// globals, no mount effect. `Modal` (bare global, same as everywhere else in this suite) backs the
// create-series dialog only -- create-tournament is an inline card, not a modal. Covered by
// tests/unit/components/tournamentsScreen.test.js.

// A boolean rule shown as a labeled On/Off pill button -- same visual as SetupScreen's own
// freeHit/superOver toggles, factored out here since the tournament rules editor below needs
// several of these (freeHit, superOver, wideNoballCountsAsBall, impactPlayerEnabled) and copying
// this block four times just to swap the label/value/setter would be pure duplication. Its sibling
// export just below, NullableNumberRule, carries no comment of its own -- see docs/history.md's
// "React component extraction" section for why a comment directly above a non-first export in a
// multi-export file gets glued onto the wrong one by generate.js's splice mechanism. In short:
// NullableNumberRule renders a rule that's either null ("no limit"/unset) or a positive integer,
// same shape as SetupScreen's own maxOversPerBowler/powerplayOvers/timeCapMinutes/retirementRuns
// editors minus that editor's auto-suggest-from-a-single-match's-overs wiring (its `seed` prop is
// passed in already computed instead, since this file's equivalent, defaultOvers, is an optional
// string, not a live match in progress).
export function ToggleRule({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => onChange(!value),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: value ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: value ? "#fff" : COLORS.ink,
      boxShadow: value ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, value ? "On" : "Off"));
}
export function NullableNumberRule({
  label,
  value,
  onChange,
  seed,
  unit,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, label), value === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => onChange(seed),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, "None — tap to set one") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: String(value),
    onChange: v => onChange(v.replace(/[^0-9]/g, "")),
    onBlur: () => {
      const n = parseInt(String(value), 10);
      onChange(isNaN(n) || n < 1 ? 1 : n);
    },
    style: {
      textAlign: "center",
      padding: "12px 8px"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.ink
    }
  }, unit), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, hint), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onChange(null),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      textDecoration: "underline",
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "None")));
}
// A small uppercase divider between logical groups of rules (Format, Extras, Bowling limits,
// Batting rules, Special rules) -- the rules editor used to be one flat, un-differentiated list of
// 16+ fields, all styled identically, with no visual signal for where one topic ended and the next
// began. Gold, not the same inkSoft used by every individual field's own label, so the two levels
// (section vs. field) read as genuinely different tiers rather than just more of the same text.
// `first` drops the top border/extra margin, since the very first section sits right under the
// "Customize" toggle's own explanatory sentence and doesn't need a second divider on top of that.
export function RuleSectionHeader({
  label,
  first
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: first ? 4 : 22,
      marginBottom: 2,
      paddingTop: first ? 0 : 14,
      borderTop: first ? "none" : `1px solid ${COLORS.creamDark}`,
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.gold,
      textTransform: "uppercase"
    }
  }, label);
}
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
  // Tournament-level defaults -- set once at creation, then inherited by every fixture started
  // from this tournament (SetupScreen seeds its own `overs`/`matchRules` state from
  // presetTournament.defaultOvers/defaultRules), instead of only becoming the default
  // retroactively once the first fixture happens to get scored with whatever it was set to.
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [defaultOvers, setDefaultOvers] = useState("");
  // A tournament-wide default venue -- fixtureRow.js already falls back to `fixture.venue ||
  // tournament.venue` for any fixture that hasn't set its own, but there was no UI to actually set
  // it. Useful for a one-day/one-ground tournament where every fixture is the same venue and
  // re-entering it per match is pure repetition. A fixture's own venue, when set, still wins.
  const [venue, setVenue] = useState("");
  const [venueLat, setVenueLat] = useState(null);
  const [venueLng, setVenueLng] = useState(null);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [tournamentRules, setTournamentRules] = useState({
    ...DEFAULT_RULES
  });
  // Same paginated pattern as SetupScreen's own "New Match" flow -- one page at a time instead of
  // one long scroll past teams, groups, and (now that it covers every match rule, not just 5) a
  // much longer rules editor than when this form was first built.
  const CREATE_TOURNAMENT_PAGE_ORDER = ["details", "rules", "review"];
  const CREATE_TOURNAMENT_PAGE_LABELS = {
    details: "Teams & Format",
    rules: "Match Rules",
    review: "Review"
  };
  const [currentPage, setCurrentPage] = useState(CREATE_TOURNAMENT_PAGE_ORDER[0]);
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
    setRulesExpanded(false);
    setDefaultOvers("");
    setVenue("");
    setVenueLat(null);
    setVenueLng(null);
    setTournamentRules({
      ...DEFAULT_RULES
    });
    setCurrentPage(CREATE_TOURNAMENT_PAGE_ORDER[0]);
    setCreating(true);
  }
  const currentPageIndex = CREATE_TOURNAMENT_PAGE_ORDER.indexOf(currentPage);
  // "details" is the only page with fields that can actually block moving on -- rules and review
  // are both always valid (rules is optional by design, review has nothing left to fill in).
  // Matches submitCreate's own gating exactly -- advanceExceedsGroupSize only ever shows an
  // advisory warning below (never blocked Create before this form was paginated), so it doesn't
  // block Next either.
  const detailsPageValid = name.trim() && selectedTeams.length >= 2;
  const createPageValid = currentPage === "details" ? detailsPageValid : true;
  function goNextPage() {
    if (!createPageValid || currentPageIndex >= CREATE_TOURNAMENT_PAGE_ORDER.length - 1) return;
    setCurrentPage(CREATE_TOURNAMENT_PAGE_ORDER[currentPageIndex + 1]);
  }
  function goBackPage() {
    if (currentPageIndex === 0) {
      setCreating(false);
      return;
    }
    setCurrentPage(CREATE_TOURNAMENT_PAGE_ORDER[currentPageIndex - 1]);
  }
  async function submitCreate() {
    if (!name.trim() || selectedTeams.length < 2 || busy) return;
    setBusy(true);
    setError("");
    const groups = useGroups ? GROUP_LABELS.slice(0, numGroups).map((label, i) => ({
      label,
      teams: selectedTeams.filter(t => teamGroupIndex(t) === i)
    })).filter(g => g.teams.length > 0) : null;
    const oversNum = parseInt(defaultOvers || "0", 10);
    const rulesChanged = JSON.stringify(tournamentRules) !== JSON.stringify(DEFAULT_RULES);
    const result = await onCreateTournament(name.trim(), selectedTeams, groups, useGroups ? advancePerGroup : null, oversNum > 0 ? oversNum : null, rulesChanged ? tournamentRules : null, venue.trim() ? { venue: venue.trim(), venueLat, venueLng } : null);
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
  // Collapsed by default, same reasoning as SetupScreen's own match-rules editor: standard rules
  // are right most of the time, so this shouldn't force a scroll past several settings on every
  // tournament creation. Originally kept deliberately smaller than SetupScreen's match-level
  // editor (only overs/squad size/wide-no-ball value/Free Hit), but that meant every OTHER rule
  // still had to be re-entered per fixture even though this editor exists for exactly that reason
  // -- now full parity with SetupScreen's match rules editor.
  function renderTournamentRulesSection() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: rulesExpanded ? 10 : 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.inkSoft
      }
    }, "Match rules (optional)"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "cs-btn cs-shine",
      onClick: () => setRulesExpanded(e => !e),
      style: {
        padding: "6px 13px",
        borderRadius: 18,
        border: "none",
        cursor: "pointer",
        background: COLORS.surface,
        boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 12.5,
        color: COLORS.ink
      }
    }, rulesExpanded ? "Hide" : "Customize")), rulesExpanded && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12,
        color: COLORS.inkSoft,
        lineHeight: 1.5,
        marginBottom: 10
      }
    }, "Every fixture started from this tournament will use these settings automatically -- no need to re-enter them per match."), /*#__PURE__*/React.createElement(RuleSectionHeader, {
      label: "Format",
      first: true
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Overs per innings"
      // A full-width text input for what's always a 1-2 digit number looked oversized next to
      // every other numeric rule here (retirement cap, big hit, etc.), which all use this same
      // narrow, fixed-width box via NullableNumberRule.
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 64
      }
    }, /*#__PURE__*/React.createElement(TextField, {
      value: defaultOvers,
      onChange: v => setDefaultOvers(v.replace(/[^0-9]/g, "")),
      placeholder: "20",
      style: {
        textAlign: "center",
        padding: "12px 8px"
      }
    }))), /*#__PURE__*/React.createElement(RuleChoice, {
      label: "Players per side",
      value: tournamentRules.playersPerSide,
      onChange: v => setTournamentRules(r => ({
        ...r,
        playersPerSide: v
      })),
      options: [{
        value: 6,
        label: "6"
      }, {
        value: 7,
        label: "7"
      }, {
        value: 8,
        label: "8"
      }, {
        value: 9,
        label: "9"
      }, {
        value: 10,
        label: "10"
      }, {
        value: 11,
        label: "11 (standard)"
      }]
    }), /*#__PURE__*/React.createElement(RuleChoice, {
      label: "Balls per over",
      value: tournamentRules.ballsPerOver,
      onChange: v => setTournamentRules(r => ({
        ...r,
        ballsPerOver: v
      })),
      options: [{
        value: 4,
        label: "4 (kids)"
      }, {
        value: 5,
        label: "5"
      }, {
        value: 6,
        label: "6 (standard)"
      }, {
        value: 8,
        label: "8"
      }]
    }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
      label: "Extras"
    }), /*#__PURE__*/React.createElement(RuleChoice, {
      label: "Runs on a wide",
      value: tournamentRules.wideRuns,
      onChange: v => setTournamentRules(r => ({
        ...r,
        wideRuns: v
      })),
      options: [{
        value: 1,
        label: "1 (standard)"
      }, {
        value: 2,
        label: "2"
      }]
    }), /*#__PURE__*/React.createElement(RuleChoice, {
      label: "Runs on a no-ball",
      value: tournamentRules.noballRuns,
      onChange: v => setTournamentRules(r => ({
        ...r,
        noballRuns: v
      })),
      options: [{
        value: 1,
        label: "1 (standard)"
      }, {
        value: 2,
        label: "2"
      }]
    }), /*#__PURE__*/React.createElement(ToggleRule, {
      label: "Free hit after a no-ball",
      value: tournamentRules.freeHit,
      onChange: v => setTournamentRules(r => ({
        ...r,
        freeHit: v
      }))
    }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
      label: "Bowling limits"
    }), /*#__PURE__*/React.createElement(NullableNumberRule, {
      label: "Max overs per bowler",
      value: tournamentRules.maxOversPerBowler,
      onChange: v => setTournamentRules(r => ({
        ...r,
        maxOversPerBowler: v
      })),
      seed: Math.max(1, Math.ceil(parseInt(defaultOvers || "20", 10) / 5)),
      unit: "overs each",
      hint: "suggested from your overs per innings, editable"
    }), /*#__PURE__*/React.createElement(NullableNumberRule, {
      label: "Powerplay",
      value: tournamentRules.powerplayOvers,
      onChange: v => setTournamentRules(r => ({
        ...r,
        powerplayOvers: v
      })),
      seed: (() => {
        const n = parseInt(defaultOvers || "20", 10);
        return Math.min(n, n <= 20 ? 6 : Math.round(n / 5));
      })(),
      unit: "overs",
      hint: "at the start of each innings, shown as a badge while it's in effect"
    }), /*#__PURE__*/React.createElement(NullableNumberRule, {
      label: "Time cap per innings",
      value: tournamentRules.timeCapMinutes,
      onChange: v => setTournamentRules(r => ({
        ...r,
        timeCapMinutes: v
      })),
      seed: Math.max(10, Math.round(parseInt(defaultOvers || "20", 10) * 4.5)),
      unit: "minutes",
      hint: "a flag once you're past it, not a stop"
    }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
      label: "Batting rules"
    }), /*#__PURE__*/React.createElement(NullableNumberRule, {
      label: "Retirement run cap",
      value: tournamentRules.retirementRuns,
      onChange: v => setTournamentRules(r => ({
        ...r,
        retirementRuns: v
      })),
      seed: 25,
      unit: "runs — must retire",
      hint: "a batsman reaching this is prompted to retire (not out)"
    }), /*#__PURE__*/React.createElement(NullableNumberRule, {
      label: "Big hit bonus",
      value: tournamentRules.bigHitRuns,
      onChange: v => setTournamentRules(r => ({
        ...r,
        bigHitRuns: v
      })),
      seed: 10,
      unit: "runs on a big hit",
      hint: "a six clearing your ground's extra-distance boundary rope scores this many instead of the standard 6"
    }), /*#__PURE__*/React.createElement(NullableNumberRule, {
      label: "Maximum hit bonus",
      value: tournamentRules.maxHitRuns,
      onChange: v => setTournamentRules(r => ({
        ...r,
        maxHitRuns: v
      })),
      seed: 15,
      unit: "runs on a maximum hit",
      hint: "a second, independent bonus-hit tier -- use it however suits your ground (e.g. an even longer boundary than Big Hit above)"
    }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
      label: "Special rules"
    }), /*#__PURE__*/React.createElement(ToggleRule, {
      label: "Super Over if the match ties",
      value: tournamentRules.superOver,
      onChange: v => setTournamentRules(r => ({
        ...r,
        superOver: v
      }))
    }), /*#__PURE__*/React.createElement(ToggleRule, {
      label: "Wide/no-ball counts as a ball",
      value: tournamentRules.wideNoballCountsAsBall,
      onChange: v => setTournamentRules(r => ({
        ...r,
        wideNoballCountsAsBall: v
      }))
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.creamDark}`,
        background: COLORS.cream
      }
      // Set apart in its own bordered/tinted box (rather than three more rows in the flat stack
      // above and below it) since it isn't one toggle but a small cluster of related controls --
      // on/off, how many overs, and the wide/no-ball exception -- that read as one segmented unit
      // much more easily than as three rows visually indistinguishable from every rule around
      // them. Same treatment as SetupScreen's identical cluster.
    }, /*#__PURE__*/React.createElement(ToggleRule, {
      // A generic bucket for "the last N overs behave differently", kept separate from any one
      // specific rule (today just the wide/no-ball toggle below) -- see isInLastOvers in
      // scoringEngine.js.
      label: "Last over rules",
      value: tournamentRules.lastOverRules && tournamentRules.lastOverRules.enabled,
      onChange: v => setTournamentRules(r => ({
        ...r,
        lastOverRules: { ...(r.lastOverRules || {}), enabled: v }
      }))
    }), tournamentRules.lastOverRules && tournamentRules.lastOverRules.enabled && /*#__PURE__*/React.createElement(RuleChoice, {
      label: "Applies to the last",
      value: tournamentRules.lastOverRules.overCount || 1,
      onChange: v => setTournamentRules(r => ({
        ...r,
        lastOverRules: { ...(r.lastOverRules || {}), overCount: v }
      })),
      options: [1, 2, 3, 4, 5].map(n => ({
        value: n,
        label: n === 1 ? "1 over" : `${n} overs`
      }))
    }), tournamentRules.lastOverRules && tournamentRules.lastOverRules.enabled && tournamentRules.wideNoballCountsAsBall && /*#__PURE__*/React.createElement(ToggleRule, {
      label: "Wide/no-ball illegal again in the last over(s)",
      value: tournamentRules.lastOverRules.wideNoballIllegalAgain,
      onChange: v => setTournamentRules(r => ({
        ...r,
        lastOverRules: { ...(r.lastOverRules || {}), wideNoballIllegalAgain: v }
      }))
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.creamDark}`,
        background: COLORS.cream
      }
      // Same reasoning as the Last over rules box above -- a toggle plus its own conditional
      // sub-control reads as one segmented unit more easily boxed than left as two more rows in
      // the flat stack.
    }, /*#__PURE__*/React.createElement(ToggleRule, {
      label: "Impact Player substitution",
      value: tournamentRules.impactPlayerEnabled,
      onChange: v => setTournamentRules(r => ({
        ...r,
        impactPlayerEnabled: v
      }))
    }), tournamentRules.impactPlayerEnabled && /*#__PURE__*/React.createElement(RuleChoice, {
      label: "Substitutions allowed per team",
      value: tournamentRules.impactPlayerMaxSubs,
      onChange: v => setTournamentRules(r => ({
        ...r,
        impactPlayerMaxSubs: v
      })),
      options: [{
        value: 1,
        label: "1 (standard)"
      }, {
        value: 2,
        label: "2"
      }]
    }))));
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
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 14
    }
  }, "Step ", currentPageIndex + 1, " of ", CREATE_TOURNAMENT_PAGE_ORDER.length, " · ", CREATE_TOURNAMENT_PAGE_LABELS[currentPage]), currentPage === "details" && /*#__PURE__*/React.createElement(Field, {
    label: "Tournament name"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: name,
    onChange: setName,
    placeholder: "e.g. Summer T20 League"
  })), currentPage === "details" && /*#__PURE__*/React.createElement(Field, {
    label: "Default venue (optional)"
    // Every fixture created from this tournament falls back to this venue unless it sets its own
    // -- handy for a one-day/one-ground tournament where re-entering the same venue per fixture
    // would be pure repetition.
  }, venue ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      fontWeight: 600,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, "📍 ", venue), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVenueModalOpen(true),
    className: "cs-btn",
    "aria-label": "Edit venue",
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
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 11
  }))) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVenueModalOpen(true),
    className: "cs-btn",
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, "Add a venue")), currentPage === "details" && venueModalOpen && /*#__PURE__*/React.createElement(VenueEditModal, {
    value: venue,
    initialLat: venueLat,
    initialLng: venueLng,
    clubs: clubs,
    onSave: (v, lat, lng) => {
      setVenue(v || "");
      setVenueLat(lat != null ? lat : null);
      setVenueLng(lng != null ? lng : null);
    },
    onClose: () => setVenueModalOpen(false)
  }), currentPage === "details" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      margin: "14px 0 8px"
    }
  }, "Participating teams (", selectedTeams.length, " selected)"), currentPage === "details" && /*#__PURE__*/React.createElement("div", {
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
  }, n))), currentPage === "details" && federationTeamOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "From federation clubs"), currentPage === "details" && federationTeamOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "\u00b7 ", t.clubName)))), currentPage === "details" && selectedTeams.length >= 2 && !useGroups && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, `${selectedTeams.length} teams, one round-robin table \u2192 ${knockoutStagesPreview(selectedTeams.length)}.`), currentPage === "details" && selectedTeams.length >= 4 && /*#__PURE__*/React.createElement("div", {
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
  }, `${numGroups} groups, top ${advancePerGroup} from each advance (${numGroups * advancePerGroup} teams) \u2192 ${knockoutStagesPreview(numGroups * advancePerGroup)}.`), /*#__PURE__*/React.createElement("div", {
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
  }, GROUP_LABELS[teamGroupIndex(t)].replace("Group ", ""))))))), currentPage === "rules" && renderTournamentRulesSection(), currentPage === "review" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      lineHeight: 1.8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, name.trim() || "Untitled tournament")), /*#__PURE__*/React.createElement("div", null, selectedTeams.length, " teams: ", selectedTeams.join(", ")), /*#__PURE__*/React.createElement("div", null, useGroups ? `${numGroups} groups, top ${advancePerGroup} from each \u2192 ${numGroups * advancePerGroup} qualifiers \u2192 ${knockoutStagesPreview(numGroups * advancePerGroup)}.` : `One round-robin table \u2192 ${knockoutStagesPreview(selectedTeams.length)}.`), defaultOvers && /*#__PURE__*/React.createElement("div", null, defaultOvers, "-over innings by default"), nonStandardRulesText(tournamentRules) && /*#__PURE__*/React.createElement("div", null, "House rules: ", nonStandardRulesText(tournamentRules))), error && /*#__PURE__*/React.createElement("div", {
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
    onClick: goBackPage,
    style: {
      flex: 1
    }
  }, currentPageIndex === 0 ? "Cancel" : "Back"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: currentPage === "review" ? !name.trim() || selectedTeams.length < 2 || busy : !createPageValid,
    onClick: () => currentPage === "review" ? submitCreate() : goNextPage(),
    style: {
      flex: 2
    }
  }, currentPage === "review" ? busy ? "Creating\u2026" : "Create" : currentPageIndex === CREATE_TOURNAMENT_PAGE_ORDER.length - 2 ? "Review" : "Next"))), visibleTournaments.length > 0 ? visibleTournaments.map(t => /*#__PURE__*/React.createElement("button", {
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
