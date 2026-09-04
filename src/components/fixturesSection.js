import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { BookOpen, Plus, Trophy } from "./icons.js";
import { Btn, ConfirmModal, TextField } from "./formUiAtoms.js";
import { FixtureRow } from "./fixtureRow.js";
import { uid, generateRoundRobinFixtures, generateGroupRoundRobinFixtures } from "../core/statsAndFixtures.js";
import {
  computeStandings, computeGroupStandings, applicableKnockoutStages, matchWinner,
  crossGroupKnockoutPairs, KNOCKOUT_STAGES, BRACKET_SEED_PAIRS
} from "../core/appLogic.js";

// A tournament's schedule tab: generate/add group-stage fixtures, propose each knockout round once
// the previous one is decided (Quarterfinal/Semifinal/Final, or cross-group pairing for a grouped
// tournament), a freeform "Playoffs" section for a manually-added custom-stage fixture (e.g. the
// IPL's Qualifier 1/Eliminator/Qualifier 2/Final shape the app doesn't auto-generate), and a champion
// banner once the final is decided. Every write action is a prop (onUpdateTournament) -- no bare
// globals, no mount effect. Covered by tests/unit/components/fixturesSection.test.js.

export function FixturesSection({
  tournament,
  matches,
  onStartFixtureMatch,
  onUpdateTournament,
  onOpenMatch,
  onOpenRecords,
  canManage = true,
  clubs = [],
  clubTeamsById = {}
}) {
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newA, setNewA] = useState("");
  const [newB, setNewB] = useState("");
  // Blank means a regular fixture (counts toward the round-robin table, same as always). A label
  // here reuses the exact same `stage` field the auto-generated knockout bracket already tags its
  // own fixtures with — so a manually-added "Qualifier 1"/"Eliminator" fixture is excluded from
  // the league table by computeStandings automatically, with no separate mechanism needed. Lets
  // someone build a playoff structure the app doesn't auto-generate (the IPL's Qualifier 1 /
  // Eliminator / Qualifier 2 / Final shape, rather than a straight elimination bracket) without
  // those matches silently inflating the league standings the way an auto-generated knockout
  // fixture used to before that had a name at all.
  const [newStage, setNewStage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const fixtures = tournament.fixtures || [];
  const matchById = new Map((matches || []).map(m => [m.id, m]));
  // Once a fixture's match is complete it's finished business for the schedule — the result lives
  // in Matches now, so the fixture list only needs to keep showing what's still upcoming or in
  // progress.
  const isFixturePlayed = f => !!(f.matchId && matchById.get(f.matchId) && matchById.get(f.matchId).status === "complete");
  async function generate(double) {
    if (!canManage) return;
    setBusy(true);
    // Regenerating the group stage only ever touches group fixtures — any knockout rounds already
    // proposed (which only make sense once fixed teams/results exist) are left alone.
    const generated = tournament.groups && tournament.groups.length ? generateGroupRoundRobinFixtures(tournament.groups, double) : generateRoundRobinFixtures(tournament.teams, double);
    await onUpdateTournament({
      ...tournament,
      fixtures: [...generated, ...fixtures.filter(f => f.stage)]
    });
    setBusy(false);
  }
  function requestClearAll() {
    if (!canManage) return;
    setConfirmClearAll(true);
  }
  async function clearAll() {
    setConfirmClearAll(false);
    setBusy(true);
    await onUpdateTournament({
      ...tournament,
      fixtures: []
    });
    setBusy(false);
  }
  function updateDate(fixtureId, date) {
    if (!canManage) return;
    onUpdateTournament({
      ...tournament,
      fixtures: fixtures.map(f => f.id === fixtureId ? {
        ...f,
        date
      } : f)
    });
  }
  // Same fixture-overrides-tournament venue field as handleEditVenueFromHome -- this is the
  // schedule tab's equivalent, saving straight to the tournament doc like updateDate above.
  function editVenue(fixtureId, venue, lat, lng) {
    if (!canManage) return;
    onUpdateTournament({
      ...tournament,
      fixtures: fixtures.map(f => f.id === fixtureId ? {
        ...f,
        venue: venue || null,
        venueLat: lat != null ? lat : null,
        venueLng: lng != null ? lng : null
      } : f)
    });
  }
  function requestDeleteFixture(fixtureId) {
    if (!canManage) return;
    setConfirmDeleteId(fixtureId);
  }
  function deleteFixture(fixtureId) {
    if (!canManage) return;
    onUpdateTournament({
      ...tournament,
      fixtures: fixtures.filter(fx => fx.id !== fixtureId)
    });
    setConfirmDeleteId(null);
  }
  async function addFixture() {
    if (!canManage) return;
    if (!newA || !newB || newA === newB || busy) return;
    setBusy(true);
    await onUpdateTournament({
      ...tournament,
      fixtures: [...fixtures, {
        id: uid(),
        teamA: newA,
        teamB: newB,
        date: "",
        matchId: null,
        stage: newStage.trim() || undefined
      }]
    });
    setBusy(false);
    setAdding(false);
    setNewA("");
    setNewB("");
    setNewStage("");
  }
  // ---- Knockout stages (Quarterfinal / Semifinal / Final), proposed once applicable ----
  const standings = computeStandings(tournament, matches || []);
  const groupStandings = computeGroupStandings(tournament, matches || []);
  const advancePerGroup = tournament.advancePerGroup || 2;
  // A grouped tournament's bracket size is the QUALIFIER count (groups × advancePerGroup), not the
  // total team count — a straight round-robin with 8 teams goes to a Quarterfinal, but 2 groups of
  // 4 with the top 2 advancing is only ever 4 qualifiers, i.e. a Semifinal. Using teams.length here
  // would ask for an 8-team bracket that this format never produces enough winners for.
  const stages = applicableKnockoutStages(groupStandings ? groupStandings.length * advancePerGroup : tournament.teams.length);
  const groupFixtures = fixtures.filter(f => !f.stage);
  const upcomingGroupFixtures = groupFixtures.filter(f => !isFixturePlayed(f));
  const playedGroupCount = groupFixtures.length - upcomingGroupFixtures.length;
  // Manually-added fixtures with a custom stage label (see addFixture's newStage) — a playoff
  // shape the app doesn't auto-generate, like the IPL's Qualifier 1/Eliminator/Qualifier 2/Final,
  // as opposed to the standard Quarterfinal/Semifinal/Final bracket the app DOES build itself.
  // Kept a separate bucket from groupFixtures (so a custom playoff fixture never gates
  // groupStageDone/the auto-bracket's readiness below) and rendered in its own section further
  // down — being excluded from groupFixtures is what already keeps these off the league table
  // too (see computeStandings), but that's not the same as being visible in the schedule, and a
  // fixture that's correctly excluded from the table but invisible everywhere else isn't useful.
  const standardStageLabels = new Set(KNOCKOUT_STAGES.map(s => s.label));
  const customStageFixtures = fixtures.filter(f => f.stage && !standardStageLabels.has(f.stage));
  function fixturesForStage(label) {
    return fixtures.filter(f => f.stage === label);
  }
  function stageDecided(label) {
    const fx = fixturesForStage(label);
    return fx.length > 0 && fx.every(f => f.matchId && matchWinner(matchById.get(f.matchId), matchById));
  }
  // Group stage is "done" (and thus the first knockout round can be proposed) once every group
  // fixture has a complete match. Deliberately requires at least one fixture to actually exist —
  // this used to also treat ZERO fixtures as trivially "done" (for a tournament that skips the
  // group stage entirely and goes straight to a bracket), but that's indistinguishable from "just
  // created, fixtures never generated yet," which is the far more common way to hit zero — and
  // either way, a knockout seeded off computeStandings when nothing's been played yet isn't a real
  // seed at all: every team is tied 0-0-0, so it silently fell back to whatever order they were
  // selected in at creation, not anything resembling qualification.
  const groupStageDone = groupFixtures.length > 0 && groupFixtures.every(f => f.matchId && matchById.get(f.matchId) && matchById.get(f.matchId).status === "complete");
  const nextStageIndex = stages.findIndex(s => fixturesForStage(s.label).length === 0);
  const nextStageReady = nextStageIndex === -1 ? false : nextStageIndex === 0 ? groupStageDone : stageDecided(stages[nextStageIndex - 1].label);
  async function generateStage(index) {
    if (!canManage) return;
    const stage = stages[index];
    let pairs;
    if (index === 0 && groupStandings) {
      // Entry round of a grouped tournament: cross-group pairing (Group A #1 vs Group B #2, etc.)
      // instead of a single overall-standings seed — see crossGroupKnockoutPairs for why.
      pairs = crossGroupKnockoutPairs(groupStandings, advancePerGroup);
    } else if (index === 0) {
      // Entry round: seed straight off the standings, keeping #1 and #2 apart until the final.
      const top = standings.map(r => r.team).slice(0, stage.size);
      pairs = (BRACKET_SEED_PAIRS[stage.size] || []).map(([a, b]) => [top[a], top[b]]);
    } else {
      // Later rounds: teams are just the winners of the previous round, taken in the order those
      // fixtures were generated (already bracket-consistent), paired up sequentially.
      const winners = fixturesForStage(stages[index - 1].label).map(f => matchWinner(matchById.get(f.matchId), matchById));
      pairs = [];
      for (let k = 0; k < winners.length; k += 2) pairs.push([winners[k], winners[k + 1]]);
    }
    const newFixtures = pairs.filter(([a, b]) => a && b).map(([a, b]) => ({
      id: uid(),
      teamA: a,
      teamB: b,
      date: "",
      matchId: null,
      stage: stage.label
    }));
    if (!newFixtures.length) return;
    setBusy(true);
    await onUpdateTournament({
      ...tournament,
      fixtures: [...fixtures, ...newFixtures]
    });
    setBusy(false);
  }
  const finalStage = stages.length ? stages[stages.length - 1] : null;
  const championFixture = finalStage && stageDecided(finalStage.label) ? fixturesForStage(finalStage.label)[0] : null;
  const champion = championFixture ? matchWinner(matchById.get(championFixture.matchId), matchById) : null;
  // A simple, ungrouped list rather than knockoutSection's bracket-progression machinery — the
  // app has no idea how a freeform label like "Qualifier 1" or "Eliminator" is meant to connect
  // to the next one (unlike the standard bracket, where "winner of Semifinal 1 plays winner of
  // Semifinal 2" is a known, fixed rule), so this just shows what's been added by hand, in
  // whatever order, each labeled with its own stage.
  const customStageSection = customStageFixtures.length === 0 ? null : /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 4
    }
  }, "Playoffs"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, "Added by hand \u2014 kept out of the points table and NRR, same as the knockout bracket below."), customStageFixtures.map(f => /*#__PURE__*/React.createElement(React.Fragment, {
    key: f.id
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.pitch,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4
    }
  }, f.stage), /*#__PURE__*/React.createElement(FixtureRow, {
    fixture: f,
    tournament: tournament,
    match: f.matchId ? matchById.get(f.matchId) : null,
    onScore: () => f.matchId ? onOpenMatch(matchById.get(f.matchId) || f.matchId) : onStartFixtureMatch(tournament, f),
    onUpdateDate: canManage ? date => updateDate(f.id, date) : undefined,
    onDelete: canManage ? () => requestDeleteFixture(f.id) : undefined,
    onEditVenue: canManage ? (venue, lat, lng) => editVenue(f.id, venue, lat, lng) : undefined,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  }))));
  const knockoutSection = stages.length === 0 ? null : /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
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
  }, "Knockouts"), champion && /*#__PURE__*/React.createElement("div", {
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
  }, champion, " won the tournament"), onOpenRecords && /*#__PURE__*/React.createElement("button", {
    onClick: onOpenRecords,
    className: "cs-btn cs-shine",
    style: {
      marginLeft: "auto",
      flexShrink: 0,
      background: "rgba(46,28,4,0.14)",
      border: "none",
      borderRadius: 8,
      color: "#2e1c04",
      cursor: "pointer",
      padding: "6px 10px",
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 11.5,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(BookOpen, {
    size: 13
  }), "Record Book")), stages.flatMap(s => fixturesForStage(s.label)).filter(f => !isFixturePlayed(f)).map(f => /*#__PURE__*/React.createElement(FixtureRow, {
    key: f.id,
    fixture: f,
    tournament: tournament,
    match: f.matchId ? matchById.get(f.matchId) : null,
    onScore: () => f.matchId ? onOpenMatch(matchById.get(f.matchId) || f.matchId) : onStartFixtureMatch(tournament, f),
    onUpdateDate: canManage ? date => updateDate(f.id, date) : undefined,
    onDelete: canManage ? () => requestDeleteFixture(f.id) : undefined,
    onEditVenue: canManage ? (venue, lat, lng) => editVenue(f.id, venue, lat, lng) : undefined,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  })), (() => {
    const playedKnockoutCount = stages.flatMap(s => fixturesForStage(s.label)).filter(f => isFixturePlayed(f)).length;
    return playedKnockoutCount > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft,
        marginBottom: 10
      }
    }, playedKnockoutCount, playedKnockoutCount === 1 ? " fixture played \u2014 see Matches for the result." : " fixtures played \u2014 see Matches for results.");
  })(), nextStageIndex !== -1 && canManage && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => generateStage(nextStageIndex),
    disabled: busy || !nextStageReady,
    style: {
      width: "100%"
    }
  }, busy ? "Generating\u2026" : `Propose ${stages[nextStageIndex].label}`), !nextStageReady && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 6
    }
  }, nextStageIndex === 0 ? groupFixtures.length === 0 ? "Generate or add group fixtures first, then complete them to unlock this." : "Complete every group fixture to unlock this." : `Complete the ${stages[nextStageIndex - 1].label} to unlock this.`)));
  const fixtureToConfirmDelete = confirmDeleteId ? fixtures.find(f => f.id === confirmDeleteId) : null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "Fixtures"), fixtures.length > 0 && canManage && /*#__PURE__*/React.createElement("button", {
    onClick: requestClearAll,
    disabled: busy,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Clear all")), groupFixtures.length === 0 && !adding ? (canManage ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => generate(false),
    disabled: busy,
    style: {
      flex: "1 1 auto"
    }
  }, busy ? "Generating\u2026" : "Generate Round-Robin"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => generate(true),
    disabled: busy,
    style: {
      flex: "1 1 auto"
    }
  }, "Home & Away")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      marginBottom: 12
    }
  }, "No fixtures yet \u2014 only the club owner can add them.")) : upcomingGroupFixtures.map((f, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: f.id
  }, f.group && f.group !== (upcomingGroupFixtures[i - 1] && upcomingGroupFixtures[i - 1].group) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: i > 0 ? 10 : 0,
      marginBottom: 4
    }
  }, f.group), /*#__PURE__*/React.createElement(FixtureRow, {
    fixture: f,
    tournament: tournament,
    match: f.matchId ? matchById.get(f.matchId) : null,
    onScore: () => f.matchId ? onOpenMatch(matchById.get(f.matchId) || f.matchId) : onStartFixtureMatch(tournament, f),
    onUpdateDate: canManage ? date => updateDate(f.id, date) : undefined,
    onDelete: canManage ? () => requestDeleteFixture(f.id) : undefined,
    onEditVenue: canManage ? (venue, lat, lng) => editVenue(f.id, venue, lat, lng) : undefined,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  }))), playedGroupCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: upcomingGroupFixtures.length > 0 ? 2 : 0,
      marginBottom: 8
    }
  }, playedGroupCount, playedGroupCount === 1 ? " fixture played \u2014 see Matches for the result." : " fixtures played \u2014 see Matches for results."), adding ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: newA,
    onChange: e => setNewA(e.target.value),
    style: {
      flex: 1,
      minWidth: 0,
      fontFamily: "'Inter'",
      fontSize: 13,
      padding: "8px 6px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: COLORS.surface
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Team\u2026"), tournament.teams.map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n))), /*#__PURE__*/React.createElement("select", {
    value: newB,
    onChange: e => setNewB(e.target.value),
    style: {
      flex: 1,
      minWidth: 0,
      fontFamily: "'Inter'",
      fontSize: 13,
      padding: "8px 6px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: COLORS.surface
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "vs Team\u2026"), tournament.teams.map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Stage (optional) \u2014 leave blank for a regular fixture that counts toward the table. Label it and it's kept out of the points table/NRR, same as the auto-generated knockout bracket \u2014 use this for a playoff shape the app doesn't build automatically, like the IPL's Qualifier 1 / Eliminator / Qualifier 2 / Final."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 8
    }
  }, ["Qualifier 1", "Eliminator", "Qualifier 2"].map(label => /*#__PURE__*/React.createElement("button", {
    key: label,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setNewStage(newStage === label ? "" : label),
    style: {
      padding: "6px 12px",
      borderRadius: 16,
      border: "none",
      cursor: "pointer",
      background: newStage === label ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: newStage === label ? "#fff" : COLORS.ink,
      boxShadow: newStage === label ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12
    }
  }, label))), /*#__PURE__*/React.createElement(TextField, {
    value: newStage,
    onChange: setNewStage,
    placeholder: "Or type a custom stage name\u2026",
    style: {
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setAdding(false),
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: addFixture,
    disabled: !newA || !newB || newA === newB || busy,
    style: {
      flex: 2
    }
  }, "Add Fixture"))) : canManage && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setNewA("");
      setNewB("");
      setNewStage("");
      setAdding(true);
    },
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      padding: "6px 2px",
      marginTop: fixtures.length > 0 ? 4 : 0
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " Add a fixture")), customStageSection, knockoutSection, fixtureToConfirmDelete && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Remove this fixture?",
    message: `${fixtureToConfirmDelete.teamA} vs ${fixtureToConfirmDelete.teamB} will be removed from the schedule. This can\u2019t be undone.`,
    confirmLabel: "Remove",
    onConfirm: () => deleteFixture(fixtureToConfirmDelete.id),
    onCancel: () => setConfirmDeleteId(null)
  }), confirmClearAll && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Clear all fixtures?",
    message: "This only removes the schedule \u2014 already-scored matches and the table are untouched.",
    confirmLabel: "Clear all",
    onConfirm: clearAll,
    onCancel: () => setConfirmClearAll(false)
  }));
}
