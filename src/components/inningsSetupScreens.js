import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Table2, Undo2 } from "./icons.js";
import { Btn, ConfirmModal } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { PlayerPicker } from "./pickerAtoms.js";
import { ScorecardOverlay } from "./scorecard.js";
import { ensureBatsman, ensureBowler, oversLabel } from "../core/scoringEngine.js";
import { rosterFor, benchFor, impactSubsRemainingFor, captainFor, keeperFor, numbersFor } from "../core/appLogic.js";

// Screens shown between innings, before scoring resumes: SuperOverOpenersSetup (pick openers for a
// one-over-each decider) and SecondInningsSetup (pick openers for the chase, with a scorecard
// look-back and a "fix a mistake" reopen-first-innings escape hatch). Covered by
// tests/unit/components/inningsSetupScreens.test.js.
//
// Both call `saveTransition` (a bare global, defined in public/index.html, not extracted -- it wraps
// `saveMatch`, a Firestore write) only from their own `start()`/`goBackToFirstInnings()` handlers,
// never during render, so it's stubbed on `globalThis` only in the tests that click those buttons.

export function SuperOverOpenersSetup({
  match,
  setMatch
}) {
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const inn = match.innings[0];
  const canStart = striker.trim() && nonStriker.trim() && striker.trim() !== nonStriker.trim() && bowler.trim();
  function start() {
    const updated = {
      ...inn,
      strikerName: striker.trim(),
      nonStrikerName: nonStriker.trim(),
      bowlerName: bowler.trim()
    };
    ensureBatsman(updated, updated.strikerName);
    ensureBatsman(updated, updated.nonStrikerName);
    ensureBowler(updated, updated.bowlerName);
    const updatedMatch = {
      ...match,
      innings: [updated, match.innings[1]],
      awaitingFirstInningsSetup: false
    };
    setMatch(updatedMatch);
    saveTransition(updatedMatch, setMatch);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 16px 60px",
      maxWidth: 560,
      margin: "0 auto",
      animation: "cs-fadeIn 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.gold,
      textTransform: "uppercase",
      marginBottom: 6
    }
  }, "Super Over"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 6
    }
  }, "One over each, winner takes it"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 14,
      color: COLORS.inkSoft,
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, inn.battingTeam, " bat first."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: `Opening striker (${inn.battingTeam})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inn.battingTeam),
    value: striker,
    onChange: setStriker,
    exclude: nonStriker,
    placeholder: "Batsman name",
    captain: captainFor(match, inn.battingTeam),
    keeper: keeperFor(match, inn.battingTeam),
    numbers: numbersFor(match, inn.battingTeam)
  })), /*#__PURE__*/React.createElement(Field, {
    label: `Opening non-striker (${inn.battingTeam})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inn.battingTeam),
    value: nonStriker,
    onChange: setNonStriker,
    exclude: striker,
    placeholder: "Batsman name",
    captain: captainFor(match, inn.battingTeam),
    keeper: keeperFor(match, inn.battingTeam),
    numbers: numbersFor(match, inn.battingTeam)
  })), /*#__PURE__*/React.createElement(Field, {
    label: `Opening bowler (${inn.bowlingTeam})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inn.bowlingTeam),
    value: bowler,
    onChange: setBowler,
    placeholder: "Bowler name",
    captain: captainFor(match, inn.bowlingTeam),
    keeper: keeperFor(match, inn.bowlingTeam),
    numbers: numbersFor(match, inn.bowlingTeam)
  }))), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !canStart,
    onClick: start,
    style: {
      width: "100%"
    }
  }, "Start Super Over"));
}

// Applies one Impact Player substitution: swaps outName for inName in that team's XI (and out of
// its bench), counts one more against the team's impactPlayerMaxSubs allowance (a tournament's own
// rule book can set this above the standard 1 -- e.g. Billund's allows up to 2), drops outName
// from captain/keeper if they held either (same "can't stay captain/keeper once out of the XI"
// rule toggleAXI enforces at setup time), and logs it to match.impactSubs for the scorecard. Every
// picker on the app already reads the XI via rosterFor, so updating teamARoster/teamBRoster here
// is the entire mechanism -- nothing else needs to know a substitution happened. Its sibling
// export just below, ImpactPlayerCard, carries no comment of its own -- see docs/history.md's
// "React component extraction" section for why a comment directly above a non-first export in a
// multi-export file gets glued onto the wrong one by generate.js's splice mechanism. In short:
// ImpactPlayerCard renders one team's substitution card -- nothing unless the rule is on, this
// team still has at least one substitution remaining, AND actually has a bench to draw from (a
// team entered as free-form names with no saved squad has no wider pool, same gap
// rosterFor/benchFor already have). Shown for both teams on the same Innings Break screen, since
// the Laws allow either side to make its substitution(s) any time before the start of the other
// team's innings -- this screen is exactly that point.
export function confirmImpactSub(match, setMatch, team, outName, inName) {
  const isTeamA = team === match.teamA;
  const rosterKey = isTeamA ? "teamARoster" : "teamBRoster";
  const benchKey = isTeamA ? "teamABench" : "teamBBench";
  const usedKey = isTeamA ? "teamAImpactUsed" : "teamBImpactUsed";
  const captainKey = isTeamA ? "teamACaptain" : "teamBCaptain";
  const keeperKey = isTeamA ? "teamAKeeper" : "teamBKeeper";
  // Recorded on the sub itself (not re-derived at undo time) so undoLastImpactSub can restore
  // exactly what this substitution cleared, even if captain/keeper has changed again since.
  const wasCaptain = match[captainKey] === outName;
  const wasKeeper = match[keeperKey] === outName;
  const updatedMatch = {
    ...match,
    [rosterKey]: (match[rosterKey] || []).map(n => n === outName ? inName : n),
    [benchKey]: (match[benchKey] || []).filter(n => n !== inName),
    [usedKey]: (match[usedKey] || 0) + 1,
    [captainKey]: wasCaptain ? "" : match[captainKey],
    [keeperKey]: wasKeeper ? "" : match[keeperKey],
    impactSubs: [...(match.impactSubs || []), {
      team,
      outName,
      inName,
      wasCaptain,
      wasKeeper
    }]
  };
  setMatch(updatedMatch);
  saveTransition(updatedMatch, setMatch);
}
// Reverses the most recent substitution THIS team made (mirrors the app's other undo affordances,
// e.g. "Undo last ball" -- always the last action, never an arbitrary pick from history, so there's
// no ambiguity about what "undo" means once more than one sub has happened). Puts the incoming
// player back on the bench (they haven't taken the field yet -- this is a correction, not a second
// real substitution), restores captain/keeper if this sub was the one that cleared it, and drops
// the logged entry entirely rather than leaving a cancelled-out record for the scorecard to show.
export function undoLastImpactSub(match, setMatch, team) {
  const subs = match.impactSubs || [];
  let lastIndex = -1;
  for (let i = subs.length - 1; i >= 0; i--) {
    if (subs[i].team === team) {
      lastIndex = i;
      break;
    }
  }
  if (lastIndex === -1) return;
  const sub = subs[lastIndex];
  const isTeamA = team === match.teamA;
  const rosterKey = isTeamA ? "teamARoster" : "teamBRoster";
  const benchKey = isTeamA ? "teamABench" : "teamBBench";
  const usedKey = isTeamA ? "teamAImpactUsed" : "teamBImpactUsed";
  const captainKey = isTeamA ? "teamACaptain" : "teamBCaptain";
  const keeperKey = isTeamA ? "teamAKeeper" : "teamBKeeper";
  const updatedMatch = {
    ...match,
    [rosterKey]: (match[rosterKey] || []).map(n => n === sub.inName ? sub.outName : n),
    [benchKey]: [...(match[benchKey] || []), sub.inName],
    [usedKey]: Math.max(0, (match[usedKey] || 0) - 1),
    [captainKey]: sub.wasCaptain ? sub.outName : match[captainKey],
    [keeperKey]: sub.wasKeeper ? sub.outName : match[keeperKey],
    impactSubs: subs.filter((_, i) => i !== lastIndex)
  };
  setMatch(updatedMatch);
  saveTransition(updatedMatch, setMatch);
}
export function ImpactPlayerCard({
  match,
  setMatch,
  team
}) {
  const [outName, setOutName] = useState("");
  const [inName, setInName] = useState("");
  if (!match.rules || !match.rules.impactPlayerEnabled) {
    return null;
  }
  const bench = benchFor(match, team);
  const remaining = impactSubsRemainingFor(match, team);
  const subs = match.impactSubs || [];
  // Every substitution THIS team has made so far, in order -- not just the most recent one. A
  // tournament's impactPlayerMaxSubs can allow more than 1 (e.g. Billund's allows 2), and the
  // card used to only ever track/show the single last sub, so a team's FIRST substitution silently
  // disappeared from the UI the moment they made a second one. Only the actual last entry gets an
  // Undo button -- undoLastImpactSub only ever reverses the most recent, never an arbitrary pick.
  const teamSubs = subs.filter(s => s.team === team);
  const lastSub = teamSubs.length ? teamSubs[teamSubs.length - 1] : null;
  const canOfferNew = remaining > 0 && bench.length > 0;
  // Nothing to offer and nothing to undo -- e.g. the rule's on but this team never had a bench to
  // draw from. Once ANY substitution has happened, the card stays (in a reduced form below) purely
  // so it's never a one-way door -- see the "correct the substitution" gap this replaced.
  if (!canOfferNew && !lastSub) {
    return null;
  }
  const canConfirm = outName.trim() && inName.trim();
  function confirm() {
    confirmImpactSub(match, setMatch, team, outName.trim(), inName.trim());
    setOutName("");
    setInName("");
  }
  const undoRow = teamSubs.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: canOfferNew ? 14 : 0,
      paddingTop: canOfferNew ? 14 : 0,
      borderTop: canOfferNew ? `1px solid ${COLORS.creamDark}` : "none",
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, teamSubs.map((sub, i) => /*#__PURE__*/React.createElement("div", {
    key: `${sub.outName}-${sub.inName}-${i}`,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.4
    }
  }, teamSubs.length > 1 ? `Sub ${i + 1}: ` : "", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, sub.outName), " → ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, sub.inName)), sub === lastSub && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => undoLastImpactSub(match, setMatch, team),
    className: "cs-btn",
    style: {
      background: "none",
      border: `1.5px solid ${COLORS.creamDark}`,
      borderRadius: 20,
      padding: "6px 12px",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 11.5,
      color: COLORS.ink,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "Undo"))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.gold,
      textTransform: "uppercase",
      marginBottom: 6
    }
  }, `Impact Player — ${team}`), canOfferNew ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, remaining > 1 ? `${remaining} substitutions remaining for this team. The player going off takes no further part in the match.` : "Last substitution remaining for this team. The player going off takes no further part in the match."), /*#__PURE__*/React.createElement(Field, {
    label: "Player going off"
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, team),
    value: outName,
    onChange: setOutName,
    placeholder: "Player name",
    captain: captainFor(match, team),
    keeper: keeperFor(match, team),
    numbers: numbersFor(match, team)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Player coming on"
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: bench,
    value: inName,
    onChange: setInName,
    placeholder: "Bench player name",
    numbers: numbersFor(match, team)
  })), /*#__PURE__*/React.createElement(Btn, {
    disabled: !canConfirm,
    onClick: confirm,
    style: {
      width: "100%",
      marginTop: 4
    }
  }, "Confirm substitution")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
  }, "No substitutions left for this team."), undoRow);
}
export function SecondInningsSetup({
  match,
  setMatch
}) {
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [showScorecard, setShowScorecard] = useState(false);
  const [confirmGoBack, setConfirmGoBack] = useState(false);
  const inn = match.innings[1];
  const target = match.innings[0].runs + 1;
  // Whether either team has anything Impact-Player-related to show right now -- a substitution
  // still to make, or a past one still undoable. Kept local rather than exported: it only exists
  // to decide whether this screen's own first step is worth showing at all, same reasoning as
  // ImpactPlayerCard's own "nothing to offer and nothing to undo" null-return just above.
  function teamHasImpactActivity(team) {
    if (!match.rules || !match.rules.impactPlayerEnabled) return false;
    const canOfferNew = impactSubsRemainingFor(match, team) > 0 && benchFor(match, team).length > 0;
    const hasPastSub = (match.impactSubs || []).some(s => s.team === team);
    return canOfferNew || hasPastSub;
  }
  const impactAvailable = teamHasImpactActivity(inn.bowlingTeam) || teamHasImpactActivity(inn.battingTeam);
  // A separate first step, not inline above the lineup pickers -- cramming both onto one screen
  // meant a lot of scrolling just to reach "Start 2nd Innings", and there was no way back up to fix
  // a substitution once you'd scrolled past it. Skips straight to lineups when there's nothing
  // Impact-Player-related to do, so the common case (the rule's off) sees no extra step at all.
  const [step, setStep] = useState(impactAvailable ? "impact" : "lineups");
  const canStart = striker.trim() && nonStriker.trim() && striker.trim() !== nonStriker.trim() && bowler.trim();
  function start() {
    const updated = {
      ...inn,
      strikerName: striker.trim(),
      nonStrikerName: nonStriker.trim(),
      bowlerName: bowler.trim()
    };
    ensureBatsman(updated, updated.strikerName);
    ensureBatsman(updated, updated.nonStrikerName);
    ensureBowler(updated, updated.bowlerName);
    const updatedMatch = {
      ...match,
      innings: [match.innings[0], updated],
      awaitingSecondInningsSetup: false
    };
    setMatch(updatedMatch);
    saveTransition(updatedMatch, setMatch);
  }
  // Reopens the just-finished 1st innings for corrections. The 2nd innings placeholder created at
  // the break hasn't been started yet (no openers picked), so dropping it back off the innings
  // array loses nothing — the scorer lands back on the normal live-scoring screen for innings 1,
  // where Undo and every other correction tool already works.
  function goBackToFirstInnings() {
    const revertedFirst = {
      ...match.innings[0],
      complete: false
    };
    const updatedMatch = {
      ...match,
      innings: [revertedFirst],
      currentInningIndex: 0,
      awaitingSecondInningsSetup: false
    };
    setMatch(updatedMatch);
    saveTransition(updatedMatch, setMatch);
  }
  const header = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch
    }
  }, "Innings Break"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowScorecard(true),
    className: "cs-btn cs-shine",
    "aria-label": "Scorecard",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 20,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Table2, {
    size: 15
  }), "Scorecard"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setConfirmGoBack(true),
    className: "cs-btn cs-shine",
    "aria-label": "Back to 1st innings",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 20,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Undo2, {
    size: 15
  }), "Correct")));
  // The 1st innings' own score and the chase target, right at the top of BOTH steps of this
  // screen -- the Impact Player step (shown first whenever there's any Impact Player activity to
  // offer) used to show neither, only a generic "make a substitution" line, so seeing what was
  // actually just posted meant clicking into the full Scorecard overlay. A quick glance shouldn't
  // need that.
  const firstInningsSummary = /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 4
    }
  }, "1st innings"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.pitch
    }
  }, match.innings[0].battingTeam, " ", match.innings[0].runs, "/", match.innings[0].wickets), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginTop: 2
    }
  }, "(", oversLabel(match.innings[0].legalBalls, match.innings[0].ballsPerOver), " overs)")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.gold,
      textTransform: "uppercase",
      marginBottom: 4
    }
  }, "Target"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.pitch
    }
  }, target)));
  const overlays = /*#__PURE__*/React.createElement(React.Fragment, null, showScorecard && /*#__PURE__*/React.createElement(ScorecardOverlay, {
    match: {
      ...match,
      innings: [match.innings[0]]
    },
    onClose: () => setShowScorecard(false)
  }), confirmGoBack && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Back to 1st innings?",
    message: `This reopens ${match.innings[0].battingTeam}'s completed innings so you can fix a mistake — the 2nd innings hasn't started yet, so nothing from it is lost. You'll pick openers again when you're ready to move on.`,
    confirmLabel: "Go back",
    cancelLabel: "Cancel",
    variant: "default",
    onConfirm: () => {
      setConfirmGoBack(false);
      goBackToFirstInnings();
    },
    onCancel: () => setConfirmGoBack(false)
  }));
  if (step === "impact") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "24px 16px 60px",
        maxWidth: 560,
        margin: "0 auto",
        animation: "cs-fadeIn 0.3s ease"
      }
    }, header, firstInningsSummary, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 14,
        color: COLORS.inkSoft,
        marginBottom: 20,
        lineHeight: 1.5
      }
    }, "Either team can make an Impact Player substitution now, before the chase starts."), /*#__PURE__*/React.createElement(ImpactPlayerCard, {
      match: match,
      setMatch: setMatch,
      team: inn.bowlingTeam
    }), /*#__PURE__*/React.createElement(ImpactPlayerCard, {
      match: match,
      setMatch: setMatch,
      team: inn.battingTeam
    }), /*#__PURE__*/React.createElement(Btn, {
      variant: "primary",
      onClick: () => setStep("lineups"),
      style: {
        width: "100%"
      }
    }, "Continue to lineups"), overlays);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 16px 60px",
      maxWidth: 560,
      margin: "0 auto",
      animation: "cs-fadeIn 0.3s ease"
    }
  }, header, firstInningsSummary, impactAvailable && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setStep("impact"),
    className: "cs-btn cs-shine",
    "aria-label": "Back to Impact Player",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: "none",
      border: "none",
      padding: 0,
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      color: COLORS.gold,
      cursor: "pointer"
    }
  }, "← Impact Player"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 14,
      color: COLORS.inkSoft,
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, inn.battingTeam, " need ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, target), " runs to win from ", match.oversLimit, " overs."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: `Opening striker (${inn.battingTeam})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inn.battingTeam),
    value: striker,
    onChange: setStriker,
    exclude: nonStriker,
    placeholder: "Batsman name",
    captain: captainFor(match, inn.battingTeam),
    keeper: keeperFor(match, inn.battingTeam),
    numbers: numbersFor(match, inn.battingTeam)
  })), /*#__PURE__*/React.createElement(Field, {
    label: `Opening non-striker (${inn.battingTeam})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inn.battingTeam),
    value: nonStriker,
    onChange: setNonStriker,
    exclude: striker,
    placeholder: "Batsman name",
    captain: captainFor(match, inn.battingTeam),
    keeper: keeperFor(match, inn.battingTeam),
    numbers: numbersFor(match, inn.battingTeam)
  })), /*#__PURE__*/React.createElement(Field, {
    label: `Opening bowler (${inn.bowlingTeam})`
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inn.bowlingTeam),
    value: bowler,
    onChange: setBowler,
    placeholder: "Bowler name",
    captain: captainFor(match, inn.bowlingTeam),
    keeper: keeperFor(match, inn.bowlingTeam),
    numbers: numbersFor(match, inn.bowlingTeam)
  }))), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !canStart,
    onClick: start,
    style: {
      width: "100%"
    }
  }, "Start 2nd Innings"), overlays);
}
