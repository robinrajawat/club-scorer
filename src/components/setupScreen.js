import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Trophy, ArrowLeftRight, Pencil } from "./icons.js";
import { Field } from "./screenAtoms.js";
import { TextField, RuleChoice, TeamChips, Btn } from "./formUiAtoms.js";
import { PlayingXIPicker } from "./playingXIPicker.js";
import { PlayerPicker } from "./pickerAtoms.js";
import { RuleSectionHeader } from "./tournamentsScreen.js";
import { VenueEditModal } from "./venueAndDateModals.js";
import { VisibilitySwitch } from "./matchDisplayAtoms.js";
import { DEFAULT_RULES } from "../core/appLogic.js";
import { tossText, umpiresText, nonStandardRulesText, wideNoballLastOverExceptionLabel } from "../core/shareAndFormat.js";

// The multi-page "New Match" setup flow: teams & format, toss, match rules, playing XI (only
// shown when at least one side has a saved squad), opening line-up, then a review page before
// handing the built-up state to onStart. Paginated with a pageOrder array, so only one page's
// worth of fields shows at a time, with Next/Review disabled until that page is actually
// complete (pageValid). Every write is a prop (onStart/onCancel) -- no bare Firestore globals,
// no mount-time effect that reaches outside the component. SETUP_PAGE_LABELS travels alongside
// it here (shared between the top and bottom progress indicators) even though it was a bare
// top-level const in public/index.html, not part of any module or component before -- it's used
// nowhere else, so it lives here as its own export rather than in a shared core module. No
// per-export comment above it below, to avoid generate.js's findNamedExport comment-glue bug
// (see docs/history.md) since it isn't the file's first export.
// Covered by tests/unit/components/setupScreen.test.js.

export const SETUP_PAGE_LABELS = {
  teams: "Teams & Format",
  rules: "Match Rules",
  xi: "Playing XI",
  openers: "Opening Line-up",
  review: "Review"
};

export function SetupScreen({
  onStart,
  onCancel,
  teams,
  rules,
  presetTournament,
  clubUmpires,
  clubs
}) {
  const [teamAId, setTeamAId] = useState(null);
  const [teamAName, setTeamAName] = useState("");
  const [teamASquad, setTeamASquad] = useState([]); // full saved roster, if a saved team was picked
  const [teamAPlayingXI, setTeamAPlayingXI] = useState([]); // subset actually playing this match
  const [teamACaptain, setTeamACaptain] = useState("");
  const [teamAKeeper, setTeamAKeeper] = useState("");
  const [teamAColor, setTeamAColor] = useState("");
  const [teamBId, setTeamBId] = useState(null);
  const [teamBName, setTeamBName] = useState("");
  const [teamBSquad, setTeamBSquad] = useState([]);
  const [teamBPlayingXI, setTeamBPlayingXI] = useState([]);
  const [teamBCaptain, setTeamBCaptain] = useState("");
  const [teamBKeeper, setTeamBKeeper] = useState("");
  const [teamBColor, setTeamBColor] = useState("");
  // Jersey numbers as used for this match only — seeded from the saved squad's numbers when a
  // team is picked, but editable here without touching the saved team roster.
  const [teamAMatchNumbers, setTeamAMatchNumbers] = useState({});
  const [teamBMatchNumbers, setTeamBMatchNumbers] = useState({});
  const [overs, setOvers] = useState((presetTournament && presetTournament.defaultOvers && String(presetTournament.defaultOvers)) || "20");
  // Defaults from the tournament's own private flag when starting a fixture from one -- see
  // handleCreateTournament's own Visibility toggle -- but always overridable per match, same
  // "tournament sets the default, this match can differ" relationship overs/venue already have.
  const [isPrivate, setIsPrivate] = useState(!!(presetTournament && presetTournament.private));
  const [venue, setVenue] = useState((presetTournament && presetTournament.venue) || "");
  // No presetTournament.venueLat/Lng to inherit alongside the venue text above -- a tournament's
  // own default venue (see TournamentsScreen's own venue picker) doesn't carry verified coordinates
  // today, so there's nothing to seed these from yet even when the venue name itself is inherited.
  const [venueLat, setVenueLat] = useState(null);
  const [venueLng, setVenueLng] = useState(null);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  // Deliberately not inherited from presetTournament the way venue is -- a ground tends to stay
  // the same across a tournament/series, but who's umpiring rarely does, so defaulting to the
  // previous fixture's umpires here would be wrong more often than it'd save typing.
  const [umpire1, setUmpire1] = useState("");
  const [umpire2, setUmpire2] = useState("");
  const [strikerA, setStrikerA] = useState("");
  const [nonStrikerA, setNonStrikerA] = useState("");
  const [bowlerB, setBowlerB] = useState("");
  const [tossWonBy, setTossWonBy] = useState("");
  const [tossDecision, setTossDecision] = useState("");
  const [flipping, setFlipping] = useState(false);
  // A tournament/series' defaultRules (see handleUpdateTournament in startNewMatch — the first
  // fixture scored for a tournament silently becomes its default, so nobody has to configure this
  // up front) take priority over this device's own last-used rules, since a club playing in
  // someone else's tournament wants THAT tournament's rules, not whatever this phone scored last.
  const [matchRules, setMatchRules] = useState({
    ...DEFAULT_RULES,
    ...rules,
    ...(presetTournament && presetTournament.defaultRules || {}),
    maxOversPerBowler: (presetTournament && presetTournament.defaultRules && presetTournament.defaultRules.maxOversPerBowler) || (rules && rules.maxOversPerBowler) || Math.ceil(20 / 5)
  });
  const [maxOversTouched, setMaxOversTouched] = useState(false);
  // Collapsed by default: match rules rarely change from one match to the next for a given club,
  // and matchRules already starts from whatever was saved last time (see the useState above) —
  // showing the full editor open every single time someone starts a match forces a re-scroll
  // through 7 settings that are almost always already right. "Customize" reveals it on demand.
  const [rulesExpanded, setRulesExpanded] = useState(false);
  useEffect(() => {
    if (maxOversTouched) return;
    const n = parseInt(overs || "0", 10);
    if (n > 0) {
      setMatchRules(r => ({
        ...r,
        maxOversPerBowler: Math.max(1, Math.ceil(n / 5))
      }));
    }
  }, [overs, maxOversTouched]);
  function normalizePlayers(players) {
    // older saved teams may still have plain name strings instead of {name, number}
    return (players || []).map(p => typeof p === "string" ? {
      name: p,
      number: ""
    } : p);
  }
  function defaultXI(players) {
    return players.map(p => p.name).slice(0, Math.min(matchRules.playersPerSide, players.length));
  }
  function seedMatchNumbers(players) {
    return Object.fromEntries(players.filter(p => p.number).map(p => [p.name, p.number]));
  }
  function selectTeamA(team) {
    if (!team) {
      setTeamAId(null);
      setTeamAName("");
      setTeamASquad([]);
      setTeamAPlayingXI([]);
      setTeamACaptain("");
      setTeamAKeeper("");
      setTeamAColor("");
      setTeamAMatchNumbers({});
    } else {
      const label = team.name === teamBName ? `${team.name} (A)` : team.name;
      const players = normalizePlayers(team.players);
      setTeamAId(team.id);
      setTeamAName(label);
      setTeamASquad(players);
      setTeamAPlayingXI(defaultXI(players));
      setTeamACaptain(team.captain || "");
      setTeamAKeeper(team.keeper || "");
      setTeamAColor(team.color || "");
      setTeamAMatchNumbers(seedMatchNumbers(players));
    }
    setStrikerA("");
    setNonStrikerA("");
  }
  function selectTeamB(team) {
    if (!team) {
      setTeamBId(null);
      setTeamBName("");
      setTeamBSquad([]);
      setTeamBPlayingXI([]);
      setTeamBCaptain("");
      setTeamBKeeper("");
      setTeamBColor("");
      setTeamBMatchNumbers({});
    } else {
      const label = team.name === teamAName ? `${team.name} (B)` : team.name;
      const players = normalizePlayers(team.players);
      setTeamBId(team.id);
      setTeamBName(label);
      setTeamBSquad(players);
      setTeamBPlayingXI(defaultXI(players));
      setTeamBCaptain(team.captain || "");
      setTeamBKeeper(team.keeper || "");
      setTeamBColor(team.color || "");
      setTeamBMatchNumbers(seedMatchNumbers(players));
    }
    setBowlerB("");
  }
  // Coming from "Score this fixture" — try to match each fixture team name against a saved team
  // (so the full roster/XI picker still works), falling back to a plain typed name if there's no
  // match (e.g. the team was entered ad hoc and never saved). Runs once: this only ever applies to
  // a fresh Setup screen landed on directly from a fixture, not to normal team-picking afterward.
  useEffect(() => {
    if (!presetTournament || !presetTournament.fixtureTeamA) return;
    const savedA = teams.find(t => t.name === presetTournament.fixtureTeamA);
    if (savedA) selectTeamA(savedA);else setTeamAName(presetTournament.fixtureTeamA);
    const savedB = teams.find(t => t.name === presetTournament.fixtureTeamB);
    if (savedB) selectTeamB(savedB);else setTeamBName(presetTournament.fixtureTeamB);
  }, []);
  function toggleAXI(name) {
    setTeamAPlayingXI(xi => {
      if (xi.includes(name)) return xi.filter(n => n !== name);
      if (xi.length >= Math.min(matchRules.playersPerSide, teamASquad.length)) return xi;
      return [...xi, name];
    });
    // A player dropped from the XI can't stay captain/keeper for this match.
    setTeamACaptain(c => c === name ? "" : c);
    setTeamAKeeper(k => k === name ? "" : k);
    setStrikerA("");
    setNonStrikerA("");
  }
  function toggleBXI(name) {
    setTeamBPlayingXI(xi => {
      if (xi.includes(name)) return xi.filter(n => n !== name);
      if (xi.length >= Math.min(matchRules.playersPerSide, teamBSquad.length)) return xi;
      return [...xi, name];
    });
    setTeamBCaptain(c => c === name ? "" : c);
    setTeamBKeeper(k => k === name ? "" : k);
    setBowlerB("");
  }
  // These only ever touch component state for this Setup session — the saved team's own
  // numbers (edited via "Edit Team") are never written to here.
  function updateTeamANumber(name, num) {
    setTeamAMatchNumbers(n => ({
      ...n,
      [name]: num
    }));
  }
  function updateTeamBNumber(name, num) {
    setTeamBMatchNumbers(n => ({
      ...n,
      [name]: num
    }));
  }
  function flipCoin() {
    if (!teamAName.trim() || !teamBName.trim() || flipping) return;
    setFlipping(true);
    setTossWonBy("");
    // brief suspense before revealing — purely cosmetic, the actual pick is one call to Math.random
    let ticks = 0;
    const iv = setInterval(() => {
      setTossWonBy(ticks % 2 === 0 ? teamAName.trim() : teamBName.trim());
      ticks++;
      if (ticks > 8) {
        clearInterval(iv);
        setTossWonBy(Math.random() < 0.5 ? teamAName.trim() : teamBName.trim());
        setFlipping(false);
      }
    }, 90);
  }

  // roster actually offered to the opening line-up pickers: the chosen Playing XI when a saved
  // squad is in play, otherwise empty (falls back to free-text entry via PlayerPicker)
  const teamARoster = teamASquad.length ? teamAPlayingXI : [];
  const teamBRoster = teamBSquad.length ? teamBPlayingXI : [];
  // Whoever's in the saved squad but didn't make the XI -- the pool an Impact Player substitution
  // can draw from at the innings break (see SecondInningsSetup). Empty for a team with no saved
  // squad at all, same reasoning as teamARoster/teamBRoster above: there's no wider pool to bench
  // players FROM when the team was only ever a free-typed name with an XI and nothing else.
  const teamABench = teamASquad.length ? teamASquad.map(p => p.name).filter(n => !teamAPlayingXI.includes(n)) : [];
  const teamBBench = teamBSquad.length ? teamBSquad.map(p => p.name).filter(n => !teamBPlayingXI.includes(n)) : [];
  // Numbers actually used for this match: whatever's been edited in the Setup screen (defaults
  // to the saved squad's numbers, but never writes back to the saved team).
  const teamANumbers = teamAMatchNumbers;
  const teamBNumbers = teamBMatchNumbers;
  // Which team actually bats first, per the toss (or Team A by default if the toss was skipped —
  // matches the pre-toss-recording behavior). BUG FIX: this used to be assumed as always Team A
  // regardless of the toss outcome — the Opening Line-up card always asked for "Team A"'s
  // openers and "Team B"'s bowler no matter who actually won the toss and chose to bat, so a
  // Team-B-elects-to-bat result silently started the match with the wrong team's players in the
  // striker/non-striker/bowler slots. Everything below (teamAIsBattingFirst and the picker props
  // that use it) exists to make the Opening Line-up card track the toss instead of hard-coding A.
  const teamAIsBattingFirst = !(tossWonBy && tossDecision) ? true : tossDecision === "Bat" ? tossWonBy === teamAName.trim() : tossWonBy !== teamAName.trim();
  // A striker/non-striker/bowler already picked belongs to whichever team's roster was showing at
  // the time — if the toss decision then changes (or gets recorded after they were already
  // picked against the default assumption), those picks are now against the WRONG team's roster
  // and must not silently carry over.
  useEffect(() => {
    setStrikerA("");
    setNonStrikerA("");
    setBowlerB("");
  }, [teamAIsBattingFirst]);
  const aXIReady = teamASquad.length === 0 || teamAPlayingXI.length === Math.min(matchRules.playersPerSide, teamASquad.length);
  const bXIReady = teamBSquad.length === 0 || teamBPlayingXI.length === Math.min(matchRules.playersPerSide, teamBSquad.length);
  // Shown collapsed instead of the full rule editor. Unlike nonStandardRulesText (used in the
  // match summary/PDF, which stays silent about anything at its default value), this always shows
  // the core facts — balls/over and max overs per bowler are worth seeing at a glance even when
  // they're the standard values, since "is this actually a normal match" is exactly what someone
  // glancing at a collapsed card wants to confirm before they trust it and move on. The wide/no-ball
  // bit still gets the last-over caveat appended (via wideNoballLastOverExceptionLabel, shared with
  // nonStandardRulesText) -- leaving it off here just means the scorer discovers the flip mid-final-over
  // instead of at a glance.
  const wideNoballLastOverLabel = wideNoballLastOverExceptionLabel(matchRules);
  const rulesSummaryText = [`${matchRules.ballsPerOver}-ball overs`, matchRules.maxOversPerBowler ? `max ${matchRules.maxOversPerBowler} ov/bowler` : "no bowler limit", matchRules.powerplayOvers ? `${matchRules.powerplayOvers}-over powerplay` : "no powerplay", matchRules.timeCapMinutes ? `${matchRules.timeCapMinutes}-min innings target` : null, matchRules.retirementRuns ? `retire at ${matchRules.retirementRuns}` : null, matchRules.freeHit ? "Free Hit" : null, matchRules.wideNoballCountsAsBall ? `Wd/Nb counts as ball${wideNoballLastOverLabel ? ` (except ${wideNoballLastOverLabel})` : ""}` : null, matchRules.impactPlayerEnabled ? `Impact Player${matchRules.impactPlayerMaxSubs > 1 ? ` (${matchRules.impactPlayerMaxSubs} subs)` : ""}` : null, matchRules.superOver ? "Super Over" : null].filter(Boolean).join(" · ");
  // Review page's own pair, replacing rulesSummaryText there -- that one was built for a quick
  // glance while still editing rules, not the last screen before a scorer locks the match in,
  // where the other abbreviations (bowler caps, powerplay, etc.) turn ambiguous without full words.
  // coreFormatText covers balls/over and the bowler cap in full
  // words -- worth confirming even at their computed defaults, same reasoning as rulesSummaryText
  // above, so it's unconditional rather than routed through nonStandardRulesText (which would stay
  // silent on it: maxOversPerBowler defaults to a non-null computed value on every match, not just
  // customized ones, so treating it as a "house rule" deviation would defeat that function's
  // silent-when-standard design -- see nonStandardRulesText's own comment). houseRulesText covers
  // everything else -- the actual deviations from standard Laws -- via the same nonStandardRulesText
  // already used for the match result screen/PDF/scorecard and the tournament create Review page,
  // for one consistent, tested wording app-wide, and silent (like those) when every rule is standard.
  const coreFormatText = `${matchRules.ballsPerOver}-ball overs · ${matchRules.maxOversPerBowler ? `max ${matchRules.maxOversPerBowler} overs per bowler` : "no bowler limit"}`;
  const houseRulesText = nonStandardRulesText(matchRules);
  const umpiresSummaryText = umpiresText({
    umpire1: umpire1.trim(),
    umpire2: umpire2.trim()
  });
  // Coming from "Score this fixture" — the fixture already pins both teams, so the team
  // pickers/chips (which list every saved team) shouldn't be shown at all; showing them makes it
  // look like any team can still be picked when the fixture has already decided that.
  const fromFixture = !!(presetTournament && presetTournament.fixtureTeamA);
  const sameLabel = teamAName.trim() && teamBName.trim() && teamAName.trim() === teamBName.trim();
  const hasSquads = teamASquad.length > 0 || teamBSquad.length > 0;
  // A phone screen can only show one of these at a time anyway (it's all scroll either way) — the
  // real point of paging isn't saving space, it's turning "scroll past 7 rules you probably didn't
  // change" into "confirm this page and move on." xi is left out entirely when neither team has a
  // saved squad, rather than shown as an empty/skippable page — there's nothing to page through.
  const pageOrder = ["teams", "rules", ...(hasSquads ? ["xi"] : []), "openers", "review"];
  const [currentPage, setCurrentPage] = useState(pageOrder[0]);
  const currentPageIndex = pageOrder.indexOf(currentPage);
  // Per-page validity — Next/Review stays disabled until the page in front of you is actually
  // complete, same fields canStart always required, just attributed to the page that owns them.
  const pageValid = {
    teams: teamAName.trim() && teamBName.trim() && !sameLabel && overs && tossWonBy && tossDecision,
    rules: true,
    xi: aXIReady && bXIReady,
    openers: strikerA.trim() && nonStrikerA.trim() && strikerA.trim() !== nonStrikerA.trim() && bowlerB.trim(),
    review: true
  }[currentPage];
  const canStart = teamAName.trim() && teamBName.trim() && !sameLabel && overs && tossWonBy && tossDecision && aXIReady && bXIReady && strikerA.trim() && nonStrikerA.trim() && strikerA.trim() !== nonStrikerA.trim() && bowlerB.trim();
  function goNext() {
    if (!pageValid || currentPageIndex >= pageOrder.length - 1) return;
    setCurrentPage(pageOrder[currentPageIndex + 1]);
  }
  function goBack() {
    if (currentPageIndex <= 0) {
      onCancel();
      return;
    }
    setCurrentPage(pageOrder[currentPageIndex - 1]);
  }
  // Swapping which card renders doesn't move the scroll position on its own — without this, going
  // Back from partway down a long page (e.g. Playing XI) to a shorter page could leave the person
  // staring at blank space or a confusing mid-scroll view of the new page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);
  const cardStyle = {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
  };
  const sectionLabel = {
    fontFamily: "'Inter'",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    marginBottom: 12
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 20
    }
  }, "New Match"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 18
    }
  }, "Step ", currentPageIndex + 1, " of ", pageOrder.length, " \u00b7 ", SETUP_PAGE_LABELS[currentPage]), presetTournament && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "rgba(184,137,43,0.1)",
      border: "1.5px solid rgba(184,137,43,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      marginBottom: 16,
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.gold
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 15
  }), "Playing in: ", presetTournament.name), currentPage === "teams" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabel
  }, "Teams & Format"), /*#__PURE__*/React.createElement(Field, {
    label: "Batting team"
  }, fromFixture ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 15,
      fontWeight: 600,
      color: COLORS.ink,
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface
    }
  }, teamAName) : /*#__PURE__*/React.createElement(React.Fragment, null, teams.length > 0 && /*#__PURE__*/React.createElement(TeamChips, {
    teams: teams,
    selectedId: teamAId,
    onSelect: selectTeamA
  }), /*#__PURE__*/React.createElement(TextField, {
    value: teamAName,
    onChange: setTeamAName,
    placeholder: "e.g. Willow CC",
    style: teams.length > 0 ? {
      marginTop: 8
    } : {}
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Bowling team"
  }, fromFixture ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 15,
      fontWeight: 600,
      color: COLORS.ink,
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface
    }
  }, teamBName) : /*#__PURE__*/React.createElement(React.Fragment, null, teams.length > 0 && /*#__PURE__*/React.createElement(TeamChips, {
    teams: teams,
    selectedId: teamBId,
    onSelect: selectTeamB
  }), /*#__PURE__*/React.createElement(TextField, {
    value: teamBName,
    onChange: setTeamBName,
    placeholder: "e.g. Riverside XI",
    style: teams.length > 0 ? {
      marginTop: 8
    } : {}
  }))), sameLabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginTop: -4,
      marginBottom: 12
    }
  }, "Both sides have the same name — playing the same squad against itself? Edit one label above (e.g. \"", teamAName.trim(), " A\" / \"", teamAName.trim(), " B\") so the app can tell them apart."), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Format"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Overs per innings"
    // Same fix as the tournament rules editor's identical field -- a full-width text input for a
    // 1-2 digit number looked oversized next to every other numeric field on this screen.
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: overs,
    onChange: v => setOvers(v.replace(/[^0-9]/g, "")),
    placeholder: "20",
    style: {
      textAlign: "center",
      padding: "12px 8px"
    }
  }))), /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Players per side",
    value: matchRules.playersPerSide,
    onChange: v => setMatchRules(r => ({
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
      value: 11,
      label: "11 (standard)"
    }]
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Venue (optional)"
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
  }, "Add a venue")), venueModalOpen && /*#__PURE__*/React.createElement(VenueEditModal, {
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
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Umpires (optional)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: umpire1,
    onChange: setUmpire1,
    placeholder: "Umpire 1",
    list: clubUmpires && clubUmpires.length > 0 ? "cs-club-umpires" : undefined
  }), /*#__PURE__*/React.createElement(TextField, {
    value: umpire2,
    onChange: setUmpire2,
    placeholder: "Umpire 2",
    list: clubUmpires && clubUmpires.length > 0 ? "cs-club-umpires" : undefined
  })), clubUmpires && clubUmpires.length > 0 && /*#__PURE__*/React.createElement("datalist", {
    id: "cs-club-umpires"
  }, clubUmpires.map(name => /*#__PURE__*/React.createElement("option", {
    key: name,
    value: name
  }))))), currentPage === "teams" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease 0.02s backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...sectionLabel,
      marginBottom: 0
    }
  }, "Toss"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: flipCoin,
    disabled: !teamAName.trim() || !teamBName.trim() || flipping,
    style: {
      background: "none",
      border: `1.5px solid ${COLORS.creamDark}`,
      borderRadius: 20,
      padding: "5px 12px",
      cursor: teamAName.trim() && teamBName.trim() ? "pointer" : "default",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      opacity: !teamAName.trim() || !teamBName.trim() ? 0.4 : 1
    }
  }, flipping ? "Flipping…" : "🪙 Flip coin")), /*#__PURE__*/React.createElement(Field, {
    label: "Won the toss"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, [teamAName, teamBName].filter(n => n.trim()).map(name => /*#__PURE__*/React.createElement("button", {
    key: name,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setTossWonBy(name.trim()),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: tossWonBy === name.trim() ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: tossWonBy === name.trim() ? "#fff" : COLORS.ink,
      boxShadow: tossWonBy === name.trim() ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, name.trim())), ![teamAName, teamBName].some(n => n.trim()) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "Name both teams above first."))), tossWonBy && /*#__PURE__*/React.createElement(Field, {
    label: `${tossWonBy} chose to`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, ["Bat", "Bowl"].map(d => /*#__PURE__*/React.createElement("button", {
    key: d,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setTossDecision(d),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: tossDecision === d ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: tossDecision === d ? "#fff" : COLORS.ink,
      boxShadow: tossDecision === d ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, d))))), currentPage === "rules" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease 0.04s backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: rulesExpanded ? 16 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...sectionLabel,
      marginBottom: 0
    }
  }, "Match Rules"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setRulesExpanded(e => !e),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      textDecoration: "underline",
      padding: 4
    }
  }, rulesExpanded ? "Hide" : "Customize")), !rulesExpanded && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
  }, rulesSummaryText), rulesExpanded && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "Standard by default — adjust for junior or short formats."), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Format",
    first: true
  }), /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Balls per over",
    value: matchRules.ballsPerOver,
    onChange: v => setMatchRules(r => ({
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
    value: matchRules.wideRuns,
    onChange: v => setMatchRules(r => ({
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
    value: matchRules.noballRuns,
    onChange: v => setMatchRules(r => ({
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
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Free hit after a no-ball"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      freeHit: !r.freeHit
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: matchRules.freeHit ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: matchRules.freeHit ? "#fff" : COLORS.ink,
      boxShadow: matchRules.freeHit ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, matchRules.freeHit ? "On" : "Off")), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Special rules"
  }), /*#__PURE__*/React.createElement("div", {
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
  }, "Wide/no-ball counts as a ball"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      wideNoballCountsAsBall: !r.wideNoballCountsAsBall
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: matchRules.wideNoballCountsAsBall ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: matchRules.wideNoballCountsAsBall ? "#fff" : COLORS.ink,
      boxShadow: matchRules.wideNoballCountsAsBall ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, matchRules.wideNoballCountsAsBall ? "On" : "Off")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      border: `1px solid ${COLORS.creamDark}`,
      background: COLORS.cream
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
    // A generic bucket for "the last N overs behave differently", separate from any one specific
    // rule (today just the wide/no-ball toggle below) -- see isInLastOvers in scoringEngine.js.
    // Set apart in its own bordered/tinted box (rather than just another marginTop:14 row in the
    // flat stack of toggles above and below it) since it isn't one toggle but a small cluster of
    // related controls -- On/off, how many overs, and the wide/no-ball exception -- that read as
    // one segmented unit much more easily than as three rows visually indistinguishable from
    // every unrelated rule around them.
  }, "Last over rules"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      lastOverRules: { ...(r.lastOverRules || {}), enabled: !(r.lastOverRules && r.lastOverRules.enabled) }
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: matchRules.lastOverRules && matchRules.lastOverRules.enabled ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: matchRules.lastOverRules && matchRules.lastOverRules.enabled ? "#fff" : COLORS.ink,
      boxShadow: matchRules.lastOverRules && matchRules.lastOverRules.enabled ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, matchRules.lastOverRules && matchRules.lastOverRules.enabled ? "On" : "Off"), matchRules.lastOverRules && matchRules.lastOverRules.enabled && /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Applies to the last",
    value: matchRules.lastOverRules.overCount || 1,
    onChange: v => setMatchRules(r => ({
      ...r,
      lastOverRules: { ...(r.lastOverRules || {}), overCount: v }
    })),
    options: [1, 2, 3, 4, 5].map(n => ({
      value: n,
      label: n === 1 ? "1 over" : `${n} overs`
    }))
  }), matchRules.lastOverRules && matchRules.lastOverRules.enabled && matchRules.wideNoballCountsAsBall && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Wide/no-ball illegal again in the last over(s)"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      lastOverRules: { ...(r.lastOverRules || {}), wideNoballIllegalAgain: !(r.lastOverRules && r.lastOverRules.wideNoballIllegalAgain) }
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: matchRules.lastOverRules.wideNoballIllegalAgain ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: matchRules.lastOverRules.wideNoballIllegalAgain ? "#fff" : COLORS.ink,
      boxShadow: matchRules.lastOverRules.wideNoballIllegalAgain ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, matchRules.lastOverRules.wideNoballIllegalAgain ? "On" : "Off"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      border: `1px solid ${COLORS.creamDark}`,
      background: COLORS.cream
    }
    // Same reasoning as the Last over rules box above -- a toggle plus its own conditional
    // sub-control reads as one segmented unit more easily boxed than left as two more rows in the
    // flat stack. Matches the tournament rules editor's identical cluster.
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Impact Player substitution"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      impactPlayerEnabled: !r.impactPlayerEnabled
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: matchRules.impactPlayerEnabled ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: matchRules.impactPlayerEnabled ? "#fff" : COLORS.ink,
      boxShadow: matchRules.impactPlayerEnabled ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, matchRules.impactPlayerEnabled ? "On" : "Off"), matchRules.impactPlayerEnabled && /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Substitutions allowed per team",
    value: matchRules.impactPlayerMaxSubs,
    onChange: v => setMatchRules(r => ({
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
  })), /*#__PURE__*/React.createElement("div", {
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
  }, "Super Over if the match ties"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      superOver: !r.superOver
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: matchRules.superOver ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: matchRules.superOver ? "#fff" : COLORS.ink,
      boxShadow: matchRules.superOver ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, matchRules.superOver ? "On" : "Off")), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Bowling limits"
  }), /*#__PURE__*/React.createElement("div", {
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
  }, "Max overs per bowler"), matchRules.maxOversPerBowler === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => {
      setMaxOversTouched(true);
      setMatchRules(r => ({
        ...r,
        maxOversPerBowler: Math.max(1, Math.ceil(parseInt(overs || "20", 10) / 5))
      }));
    },
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
  }, "No limit \u2014 tap to set one") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: String(matchRules.maxOversPerBowler),
    onChange: v => {
      setMaxOversTouched(true);
      // Store the digits as typed, even mid-edit (including empty while the field is briefly
      // cleared before a new number is typed) instead of snapping to a coerced number on every
      // keystroke — that snap-back was fighting real typing (clear then type "45" was landing as
      // "145", since the field would jump to "1" the instant it went empty and the next digits
      // typed onto THAT rather than a blank field). Clamped for real on blur, below.
      setMatchRules(r => ({
        ...r,
        maxOversPerBowler: v.replace(/[^0-9]/g, "")
      }));
    },
    onBlur: () => {
      setMatchRules(r => {
        const n = parseInt(String(r.maxOversPerBowler), 10);
        return { ...r, maxOversPerBowler: isNaN(n) || n < 1 ? 1 : n };
      });
    },
    style: {
      textAlign: "center"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.ink
    }
  }, "overs each"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "\u2014 suggested from your total overs, editable"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setMaxOversTouched(true);
      setMatchRules(r => ({
        ...r,
        maxOversPerBowler: null
      }));
    },
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
  }, "No limit"))), /*#__PURE__*/React.createElement("div", {
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
  }, "Powerplay"), matchRules.powerplayOvers === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => {
      const n = parseInt(overs || "20", 10);
      setMatchRules(r => ({
        ...r,
        powerplayOvers: Math.min(n, n <= 20 ? 6 : Math.round(n / 5))
      }));
    },
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
  }, "None \u2014 tap to set one") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 76,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: String(matchRules.powerplayOvers),
    onChange: v => {
      // Same fix as maxOversPerBowler above — store as typed, clamp on blur.
      setMatchRules(r => ({
        ...r,
        powerplayOvers: v.replace(/[^0-9]/g, "")
      }));
    },
    onBlur: () => {
      setMatchRules(r => {
        const n = parseInt(String(r.powerplayOvers), 10);
        return { ...r, powerplayOvers: isNaN(n) || n < 1 ? 1 : n };
      });
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
  }, "overs"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "\u2014 at the start of each innings, shown as a badge while it's in effect, not enforced (there's no fielder tracking here to enforce it against)"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMatchRules(r => ({
      ...r,
      powerplayOvers: null
    })),
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
  }, "None")))), /*#__PURE__*/React.createElement("div", {
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
  }, "Time cap per innings"), matchRules.timeCapMinutes === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => {
      const n = parseInt(overs || "20", 10);
      setMatchRules(r => ({
        ...r,
        timeCapMinutes: Math.max(10, Math.round(n * 4.5))
      }));
    },
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
  }, "None \u2014 tap to set one") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 84,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: String(matchRules.timeCapMinutes),
    onChange: v => {
      // THE BUG: this used to coerce straight to a number on every keystroke, defaulting to 1 the
      // instant the field went empty (e.g. select-all + backspace before typing a fresh value).
      // That "1" landed in the DOM immediately, so the next digit typed appended onto it instead
      // of replacing a blank field — typing "45" after clearing actually produced "145". Now it
      // just stores the digits as typed (including empty mid-edit) and only clamps to a real
      // number on blur, below — so the field behaves like a normal text input while you're
      // actively typing into it.
      setMatchRules(r => ({
        ...r,
        timeCapMinutes: v.replace(/[^0-9]/g, "")
      }));
    },
    onBlur: () => {
      setMatchRules(r => {
        const n = parseInt(String(r.timeCapMinutes), 10);
        return { ...r, timeCapMinutes: isNaN(n) || n < 1 ? 1 : n };
      });
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
  }, "minutes"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "\u2014 a flag once you're past it, not a stop. The innings keeps going; an \u201cOVER TIME\u201d badge just shows up so whoever's scoring can decide what to do about it."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMatchRules(r => ({
      ...r,
      timeCapMinutes: null
    })),
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
  }, "None"))), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Batting rules"
  }), /*#__PURE__*/React.createElement("div", {
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
  }, "Retirement run cap"), matchRules.retirementRuns === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      retirementRuns: 25
    })),
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
    value: String(matchRules.retirementRuns),
    onChange: v => setMatchRules(r => ({
      ...r,
      retirementRuns: v.replace(/[^0-9]/g, "")
    })),
    onBlur: () => setMatchRules(r => {
      const n = parseInt(String(r.retirementRuns), 10);
      return { ...r, retirementRuns: isNaN(n) || n < 1 ? 1 : n };
    }),
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
  }, "runs — must retire"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "— a batsman reaching this is prompted to retire (not out); give everyone a turn to bat."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMatchRules(r => ({
      ...r,
      retirementRuns: null
    })),
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
  }, "None")), matchRules.retirementRuns !== null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 6,
      lineHeight: 1.5
    }
  }, "Return timing and order are down to your competition's own rules — e.g. some require the rest of the batting order to bat first, or returning in the order retired. The app doesn't enforce this; it's on the scorer to apply.")), /*#__PURE__*/React.createElement("div", {
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
  }, "Big hit bonus"), matchRules.bigHitRuns === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      bigHitRuns: 10
    })),
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
    value: String(matchRules.bigHitRuns),
    onChange: v => setMatchRules(r => ({
      ...r,
      bigHitRuns: v.replace(/[^0-9]/g, "")
    })),
    onBlur: () => setMatchRules(r => {
      const n = parseInt(String(r.bigHitRuns), 10);
      return { ...r, bigHitRuns: isNaN(n) || n < 1 ? 1 : n };
    }),
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
  }, "runs on a big hit"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "— a six that clears your ground's extra-distance boundary rope scores this many runs instead of the standard 6."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMatchRules(r => ({
      ...r,
      bigHitRuns: null
    })),
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
  }, "None"))), /*#__PURE__*/React.createElement("div", {
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
  }, "Maximum hit bonus"), matchRules.maxHitRuns === null ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setMatchRules(r => ({
      ...r,
      maxHitRuns: 15
    })),
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
    value: String(matchRules.maxHitRuns),
    onChange: v => setMatchRules(r => ({
      ...r,
      maxHitRuns: v.replace(/[^0-9]/g, "")
    })),
    onBlur: () => setMatchRules(r => {
      const n = parseInt(String(r.maxHitRuns), 10);
      return { ...r, maxHitRuns: isNaN(n) || n < 1 ? 1 : n };
    }),
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
  }, "runs on a maximum hit"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
    // Independent of Big Hit above -- a club can use the two tiers however suits their ground
    // (e.g. Big Hit for a second rope, Maximum Hit for an even further one), or set only one, or
    // neither. The app doesn't attach real-world meaning to either name beyond the bonus runs
    // configured here.
  }, "— a second, independent bonus-hit tier your club can use however it likes (e.g. an even longer boundary than Big Hit above)."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMatchRules(r => ({
      ...r,
      maxHitRuns: null
    })),
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
  }, "None"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, "New batsman ready time"), " — how long an incoming batsman has to be ready is down to your competition's own rules. There's no automatic clock; if they're not ready in time, record it as Timed Out from the Next Batsman prompt during scoring — a scorer judgment call, same as the umpire's in real play.")), currentPage === "xi" && (teamASquad.length > 0 || teamBSquad.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease 0.06s backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabel
  }, "Playing XI"), teamASquad.length > 0 && /*#__PURE__*/React.createElement(PlayingXIPicker, {
    label: `${teamAName || "Team A"} — pick who's playing`,
    squad: teamASquad,
    captain: teamACaptain,
    keeper: teamAKeeper,
    selected: teamAPlayingXI,
    onToggle: toggleAXI,
    onSetCaptain: setTeamACaptain,
    onSetKeeper: setTeamAKeeper,
    required: Math.min(matchRules.playersPerSide, teamASquad.length),
    numbers: teamAMatchNumbers,
    onNumberChange: updateTeamANumber
  }), teamBSquad.length > 0 && /*#__PURE__*/React.createElement(PlayingXIPicker, {
    label: `${teamBName || "Team B"} — pick who's playing`,
    squad: teamBSquad,
    captain: teamBCaptain,
    keeper: teamBKeeper,
    selected: teamBPlayingXI,
    onToggle: toggleBXI,
    onSetCaptain: setTeamBCaptain,
    onSetKeeper: setTeamBKeeper,
    required: Math.min(matchRules.playersPerSide, teamBSquad.length),
    numbers: teamBMatchNumbers,
    onNumberChange: updateTeamBNumber
  })), currentPage === "openers" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease 0.08s backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabel
  }, "Opening Line-up"), /*#__PURE__*/React.createElement(Field, {
    label: `Striker (${(teamAIsBattingFirst ? teamAName : teamBName) || (teamAIsBattingFirst ? "Team A" : "Team B")})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: teamAIsBattingFirst ? teamARoster : teamBRoster,
    value: strikerA,
    onChange: setStrikerA,
    exclude: nonStrikerA,
    placeholder: "Batsman name",
    captain: teamAIsBattingFirst ? teamACaptain : teamBCaptain,
    keeper: teamAIsBattingFirst ? teamAKeeper : teamBKeeper,
    numbers: teamAIsBattingFirst ? teamANumbers : teamBNumbers
  })), /*#__PURE__*/React.createElement(Field, {
    label: `Non-striker (${(teamAIsBattingFirst ? teamAName : teamBName) || (teamAIsBattingFirst ? "Team A" : "Team B")})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: teamAIsBattingFirst ? teamARoster : teamBRoster,
    value: nonStrikerA,
    onChange: setNonStrikerA,
    exclude: strikerA,
    placeholder: "Batsman name",
    captain: teamAIsBattingFirst ? teamACaptain : teamBCaptain,
    keeper: teamAIsBattingFirst ? teamAKeeper : teamBKeeper,
    numbers: teamAIsBattingFirst ? teamANumbers : teamBNumbers
  })), strikerA.trim() && nonStrikerA.trim() && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      const s = strikerA;
      setStrikerA(nonStrikerA);
      setNonStrikerA(s);
    },
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "4px 2px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      color: COLORS.turf
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 13
  }), "Swap ends"), /*#__PURE__*/React.createElement(Field, {
    label: `Bowler (${(teamAIsBattingFirst ? teamBName : teamAName) || (teamAIsBattingFirst ? "Team B" : "Team A")})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: teamAIsBattingFirst ? teamBRoster : teamARoster,
    value: bowlerB,
    onChange: setBowlerB,
    placeholder: "Bowler name",
    captain: teamAIsBattingFirst ? teamBCaptain : teamACaptain,
    keeper: teamAIsBattingFirst ? teamBKeeper : teamAKeeper,
    numbers: teamAIsBattingFirst ? teamBNumbers : teamANumbers
  }))), currentPage === "review" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabel
  }, "Review"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      lineHeight: 1.9
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, teamAName.trim()), " vs ", /*#__PURE__*/React.createElement("strong", null, teamBName.trim()), " \u2014 ", overs, " overs", matchRules.playersPerSide !== 11 && `, ${matchRules.playersPerSide}-a-side`, venue.trim() && ` \u2014 ${venue.trim()}`), /*#__PURE__*/React.createElement("div", null, "Toss: ", tossWonBy ? tossText({
    wonBy: tossWonBy,
    decision: tossDecision || null
  }) : "not recorded \u2014 Team A bats first by default"), /*#__PURE__*/React.createElement("div", null, "Format: ", coreFormatText), houseRulesText && /*#__PURE__*/React.createElement("div", null, "House rules: ", houseRulesText), umpiresSummaryText && /*#__PURE__*/React.createElement("div", null, umpiresSummaryText), hasSquads && /*#__PURE__*/React.createElement("div", null, "Squad: ", teamASquad.length > 0 && `${teamAName.trim()}: ${teamAPlayingXI.length} selected`, teamASquad.length > 0 && teamBSquad.length > 0 && " \u00b7 ", teamBSquad.length > 0 && `${teamBName.trim()}: ${teamBPlayingXI.length} selected`), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, teamAIsBattingFirst ? teamAName.trim() : teamBName.trim()), " opens: ", strikerA.trim(), " & ", nonStrikerA.trim(), " \u2014 ", bowlerB.trim(), " to bowl")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginTop: 12,
      lineHeight: 1.5
    }
  }, "Check this over before you start \u2014 the batting order and openers can't be changed once the first ball is bowled.")), currentPage === "review" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      animation: "cs-slideUp 0.3s ease 0.04s backwards"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabel
  }, "Visibility"), /*#__PURE__*/React.createElement(VisibilitySwitch, {
    isPublic: !isPrivate,
    onChange: pub => setIsPrivate(!pub),
    publicHint: "Public \u2014 discoverable",
    privateHint: "Private \u2014 not discoverable"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
  }, isPrivate ? "This match won't appear in the Home screen's Live now feed or app-wide search, live or after it ends. A share or view code you generate yourself still works exactly as before." : "While in progress and for a few days after it ends, this match can be found by anyone using the app \u2014 in the Live now feed and app-wide search \u2014 not just people you send a link to.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      textAlign: "center",
      marginBottom: 10
    }
  }, "Step ", currentPageIndex + 1, " of ", pageOrder.length, " \u00b7 ", SETUP_PAGE_LABELS[currentPage]), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: goBack,
    style: {
      flex: 1
    }
  }, currentPageIndex === 0 ? "Cancel" : "Back"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: currentPage === "review" ? !canStart : !pageValid,
    style: {
      flex: 2
    },
    onClick: () => {
      if (currentPage !== "review") {
        goNext();
        return;
      }
      onStart({
        teamA: teamAName.trim(),
        teamB: teamBName.trim(),
        teamAId,
        teamBId,
        oversLimit: parseInt(overs || "0", 10),
        venue: venue.trim() || null,
        venueLat: venue.trim() ? venueLat : null,
        venueLng: venue.trim() ? venueLng : null,
        umpire1: umpire1.trim() || null,
        umpire2: umpire2.trim() || null,
        battingFirstTeam: teamAIsBattingFirst ? teamAName.trim() : teamBName.trim(),
        strikerA: strikerA.trim(),
        nonStrikerA: nonStrikerA.trim(),
        bowlerB: bowlerB.trim(),
        teamARoster,
        teamBRoster,
        teamABench,
        teamBBench,
        teamACaptain,
        teamAKeeper,
        teamAColor,
        teamBCaptain,
        teamBKeeper,
        teamBColor,
        teamANumbers,
        teamBNumbers,
        rules: matchRules,
        toss: tossWonBy ? {
          wonBy: tossWonBy,
          decision: tossDecision || null
        } : null,
        tournamentId: presetTournament ? presetTournament.id : null,
        fixtureId: presetTournament ? presetTournament.fixtureId || null : null,
        private: isPrivate
      });
    }
  }, currentPage === "review" ? "Start Match" : currentPageIndex === pageOrder.length - 2 ? "Review" : "Next")));
}
