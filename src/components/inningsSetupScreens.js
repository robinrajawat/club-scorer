import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Table2, Undo2 } from "./icons.js";
import { Btn, ConfirmModal } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { PlayerPicker } from "./pickerAtoms.js";
import { ScorecardOverlay } from "./scorecard.js";
import { ensureBatsman, ensureBowler } from "../core/scoringEngine.js";
import { rosterFor, captainFor, keeperFor, numbersFor } from "../core/appLogic.js";

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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 16px 60px",
      maxWidth: 560,
      margin: "0 auto",
      animation: "cs-fadeIn 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
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
  }), "Correct"))), /*#__PURE__*/React.createElement("div", {
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
  }, "Start 2nd Innings"), showScorecard && /*#__PURE__*/React.createElement(ScorecardOverlay, {
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
}
