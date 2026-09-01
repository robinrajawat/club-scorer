import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, Trophy, Undo2 } from "./icons.js";
import { Btn, ConfirmModal } from "./formUiAtoms.js";
import { ExportPdfButton } from "./exportButtons.js";
import { PlayerOfMatchCard, BestFielderCard } from "./matchInsightCards.js";
import { ShareMenu } from "./shareMenus.js";
import { InningScorecard } from "./scorecard.js";
import { uid } from "../core/statsAndFixtures.js";
import { matchResultText, tossText, nonStandardRulesText } from "../core/shareAndFormat.js";
import { genMatchCode } from "../core/miscHelpers.js";
import { newInning } from "../core/scoringEngine.js";
import { captainFor, keeperFor, numbersFor } from "../core/appLogic.js";

// Match-complete result screen: winner banner, share/export/View Super Over actions, Player of the
// Match / Best Fielder cards, and both innings' scorecards. Covered by
// tests/unit/components/resultScreen.test.js.
//
// `saveTransition`/`saveMatch`/`loadMatch` are bare-global Firestore calls, not extracted, called
// only from button handlers (starting/viewing a Super Over, sharing a code, reopening the last
// innings) -- never during render or a mount effect -- so tests just stub whichever one the
// exercised action needs.

export function ResultScreen({
  match,
  setMatch,
  onExit
}) {
  const [i1, i2] = match.innings;
  const resultText = matchResultText(match);
  const toss = tossText(match.toss);
  const houseRules = nonStandardRulesText(match.rules);
  const [startingSuperOver, setStartingSuperOver] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const isTied = resultText === "Match tied";
  const canOfferSuperOver = isTied && match.rules && match.rules.superOver && !match.superOverMatchId;
  // Extends the same "reopen for corrections" mechanism the innings break already offers
  // (goBackToFirstInnings, above) one step further: the match's LAST innings only, from full
  // completion. Reverting inn.complete/match.status is the entire footprint of what
  // checkInningEnd changed when the match finished (see there) -- undoing exactly that, nothing
  // more, is what makes reopening safe rather than a half-applied "sort of complete" state.
  // Deliberately not offered for an EARLIER innings once a later one has real balls in it (e.g.
  // reopening the 1st innings after the 2nd has started): the 2nd innings' target, its "chase
  // complete" result, and (in a tournament) NRR/standings all derive from that 1st-innings total,
  // and none of that gets reconciled by this — that's a bigger edit than a correction tool should
  // silently attempt. Also withheld once a Super Over already exists off this match
  // (match.superOverMatchId) -- the two matches' data stops making sense together otherwise.
  function reopenLastInnings() {
    const lastIdx = match.innings.length - 1;
    const updatedMatch = {
      ...match,
      innings: match.innings.map((inn, i) => i === lastIdx ? {
        ...inn,
        complete: false
      } : inn),
      status: "in-progress",
      // Also clears noResult -- a match declared No Result (declareNoResult, on the main scoring
      // screen) never actually completed its current innings normally, so this same reopen path
      // handles undoing that too, not just a genuine finished result. Without clearing this, a
      // reopened-then-properly-finished match would still show "No result" afterward, since
      // nothing else ever unsets it once it's true.
      noResult: false
    };
    setMatch(updatedMatch);
    saveTransition(updatedMatch, setMatch);
  }
  // The team that CHASED in this match bats first in the super over — that's the standard
  // convention (whoever set the target doesn't also get the advantage of knowing exactly what's
  // needed twice in a row). Everything else about it is just a fresh 1-over 2-innings match; the
  // normal engine (openers setup, chase mechanics, completion, result text) handles the rest
  // exactly as it would for any other match — a super over has no special rules of its own beyond
  // "one over per side."
  async function handleStartSuperOver() {
    if (startingSuperOver) return;
    setStartingSuperOver(true);
    const superOverRules = {
      ...match.rules,
      maxOversPerBowler: 1
    };
    const newMatch = {
      id: uid(),
      teamA: match.teamA,
      teamB: match.teamB,
      teamAId: match.teamAId || null,
      teamBId: match.teamBId || null,
      teamARoster: match.teamARoster,
      teamBRoster: match.teamBRoster,
      teamACaptain: match.teamACaptain,
      teamAKeeper: match.teamAKeeper,
      teamAColor: match.teamAColor || null,
      teamBCaptain: match.teamBCaptain,
      teamBKeeper: match.teamBKeeper,
      teamBColor: match.teamBColor || null,
      oversLimit: 1,
      // A Super Over is created here directly, bypassing SetupScreen entirely (there's no setup
      // screen for it at all) -- so venue and umpires, which only ever get entered there, would
      // otherwise just be missing from the Super Over's own match details, even though it's
      // played immediately after the main match, at the same ground, almost always by the same
      // umpires. Carried over from the parent rather than left blank.
      venue: match.venue || null,
      umpire1: match.umpire1 || null,
      umpire2: match.umpire2 || null,
      currentInningIndex: 0,
      status: "in-progress",
      rules: superOverRules,
      toss: null,
      playerOfMatch: null,
      bestFielder: null,
      innings: [newInning(i2.battingTeam, i2.bowlingTeam, superOverRules, 2), newInning(i2.bowlingTeam, i2.battingTeam, superOverRules, 2)],
      awaitingSecondInningsSetup: false,
      awaitingFirstInningsSetup: true,
      isSuperOver: true,
      parentMatchId: match.id
    };
    // Save the parent's link to the super over BEFORE swapping local state away from it — once
    // setMatch(newMatch) runs below, this component is looking at the new match, not this one.
    await saveMatch({
      ...match,
      superOverMatchId: newMatch.id
    });
    const result = await saveMatch(newMatch);
    // Without merging the confirmed writeSeq back in here, the local state would carry a stale
    // (undefined) seq into the very next save — picking Super Over openers — which would then
    // read as a conflict against the server's actual seq and get silently dropped by
    // SuperOverOpenersSetup's merge-only success handler. That's exactly what left
    // awaitingFirstInningsSetup stuck at true on the server: the local screen looked fine
    // (optimistic update) while the real fix never reached Firestore.
    setMatch(result.ok && result.writeSeq != null ? {
      ...newMatch,
      writeSeq: result.writeSeq
    } : newMatch);
  }
  async function handleViewSuperOver() {
    const linked = await loadMatch(match.superOverMatchId);
    if (linked) setMatch(linked);
  }
  async function handleViewParentMatch() {
    const parent = await loadMatch(match.parentMatchId);
    if (parent) setMatch(parent);
  }
  async function handleGetCode() {
    if (match.shareCode) return {
      ok: true,
      code: match.shareCode
    };
    const updated = {
      ...match,
      shareCode: genMatchCode()
    };
    const result = await saveMatch(updated);
    if (result.ok) {
      setMatch({
        ...updated,
        writeSeq: result.writeSeq
      });
      return {
        ok: true,
        code: updated.shareCode
      };
    }
    return {
      ok: false,
      error: result.error || (result.conflict ? "This match changed on another device \u2014 reopen it to see the latest before sharing a code." : undefined)
    };
  }
  async function handleGetViewCode() {
    if (match.viewCode) return {
      ok: true,
      code: match.viewCode
    };
    const updated = {
      ...match,
      viewCode: genMatchCode()
    };
    const result = await saveMatch(updated);
    if (result.ok) {
      setMatch({
        ...updated,
        writeSeq: result.writeSeq
      });
      return {
        ok: true,
        code: updated.viewCode
      };
    }
    return {
      ok: false,
      error: result.error || (result.conflict ? "This match changed on another device \u2014 reopen it to see the latest before sharing a link." : undefined)
    };
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
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Matches"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ShareMenu, {
    match: match,
    onGetCode: handleGetCode,
    onGetViewCode: handleGetViewCode,
    style: {
      background: COLORS.pitchFixed,
      border: "none",
      color: "#fff"
    }
  }), /*#__PURE__*/React.createElement(ExportPdfButton, {
    match: match,
    style: {
      background: COLORS.pitchFixed,
      border: "none",
      color: "#fff"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchDarkFixed})`,
      color: COLORS.creamFixed,
      borderRadius: 18,
      padding: "26px 20px",
      textAlign: "center",
      marginBottom: 22,
      boxShadow: "0 8px 24px rgba(45,80,22,0.3)",
      animation: "cs-slideUp 0.35s ease"
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 30,
    strokeWidth: 1.8,
    style: {
      marginBottom: 10,
      opacity: 0.95
    }
  }), match.isSuperOver && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: "uppercase",
      opacity: 0.8,
      marginBottom: 4
    }
  }, "Super Over"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 21,
      lineHeight: 1.3
    }
  }, resultText), (toss || houseRules) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.85,
      marginTop: 10,
      lineHeight: 1.6
    }
  }, toss, toss && houseRules && /*#__PURE__*/React.createElement("br", null), houseRules && /*#__PURE__*/React.createElement("span", null, "House rules: ", houseRules))), match.isSuperOver && match.parentMatchId && /*#__PURE__*/React.createElement("button", {
    onClick: handleViewParentMatch,
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "center",
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 12,
      padding: "10px 14px",
      marginBottom: 14,
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }
  }, "The main match was tied \u2014 view it"), canOfferSuperOver && /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleStartSuperOver,
    disabled: startingSuperOver,
    style: {
      width: "100%",
      marginBottom: 14
    }
  }, startingSuperOver ? "Starting\u2026" : "Start Super Over"), match.superOverMatchId && /*#__PURE__*/React.createElement(Btn, {
    onClick: handleViewSuperOver,
    style: {
      width: "100%",
      marginBottom: 14
    }
  }, "View Super Over"), !match.superOverMatchId && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setConfirmReopen(true),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      width: "100%",
      textAlign: "center",
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      padding: "4px 4px 14px"
    }
  }, /*#__PURE__*/React.createElement(Undo2, {
    size: 13
  }), "Fix a mistake"), confirmReopen && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Reopen this match?",
    message: `${match.noResult ? `This resumes play in ${match.innings[match.innings.length - 1].battingTeam}'s innings, right where it was abandoned` : `This reopens ${match.innings[match.innings.length - 1].battingTeam}'s completed innings so you can fix a mistake`} -- Undo and everything else work again from there, same as during live scoring. Only the last innings can be reopened this way; if the mistake was actually in an earlier innings, this can't fix it without also affecting what came after.${match.tournamentId ? " This match is tagged to a tournament -- if it's a knockout-bracket fixture and a later round has already been set up from its result, changing the winner here won't update that fixture automatically; you'll need to fix that one by hand too if the winner ends up different." : ""}`,
    confirmLabel: "Reopen",
    cancelLabel: "Cancel",
    variant: "default",
    onConfirm: () => {
      setConfirmReopen(false);
      reopenLastInnings();
    },
    onCancel: () => setConfirmReopen(false)
  }), isTied && match.rules && match.rules.superOver ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      marginBottom: 14,
      fontStyle: "italic"
    }
  }, "Player of the Match will be picked once the Super Over settles it.") : /*#__PURE__*/React.createElement(PlayerOfMatchCard, {
    match: match,
    setMatch: setMatch
  }), /*#__PURE__*/React.createElement(BestFielderCard, {
    match: match,
    setMatch: setMatch
  }), [i1, i2].filter(Boolean).map((inn, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)",
      animation: `cs-slideUp 0.3s ease ${0.08 + idx * 0.06}s backwards`
    }
  }, /*#__PURE__*/React.createElement(InningScorecard, {
    inning: inn,
    battingCaptain: captainFor(match, inn.battingTeam),
    battingKeeper: keeperFor(match, inn.battingTeam),
    bowlingCaptain: captainFor(match, inn.bowlingTeam),
    bowlingKeeper: keeperFor(match, inn.bowlingTeam),
    battingNumbers: numbersFor(match, inn.battingTeam),
    bowlingNumbers: numbersFor(match, inn.bowlingTeam)
  }))));
}
