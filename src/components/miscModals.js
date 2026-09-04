import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Table2, Share, Users, Trophy } from "./icons.js";
import { Btn, TextField } from "./formUiAtoms.js";
import { markTourSeen, computeQualificationTarget, decimalOversToLabel } from "../core/appLogic.js";

// A grab-bag of one-off Modal-wrapped screens that don't share enough with any other file to
// justify their own: FirstLaunchTour (the swipeable first-run welcome tour, using TOUR_SLIDES
// below), TournamentShareModal (create/copy/stop a read-only public tournament link), and
// QualificationCalculatorModal (works out the NRR a team needs against a tied rival). Covered by
// tests/unit/components/miscModals.test.js.
//
// All three reference Modal as a bare, unimported global -- same pattern as ConfirmModal in
// formUiAtoms.js -- so their own tests can stub `globalThis.Modal` with a plain pass-through
// component rather than pulling in jsdom; see playerModals.test.js for the same pattern.
// TournamentShareModal reads window.location.origin/pathname directly during render (not just
// from a handler), so its test also needs a lightweight globalThis.window stub with just enough
// shape for that -- no full jsdom needed since nothing else here touches a real DOM API.

export const TOUR_SLIDES = [{
  icon: Table2,
  title: "Score ball-by-ball, works offline",
  body: "Runs, wides, no-balls, every dismissal type \u2014 sign-in is optional, and it keeps working with no signal once it's loaded."
}, {
  icon: Share,
  title: "Share your score two ways",
  body: "A score code gives full scoring access \u2014 for a teammate co-scoring alongside you. A view code is read-only, for anyone just following along. They're never interchangeable."
}, {
  icon: Users,
  title: "Clubs, federations, and borrowed players",
  body: "Save a team's roster once and reuse it. A club can affiliate with a federation to play other clubs' teams, and you can borrow a player from another club's public directory without retyping their details."
}, {
  icon: Trophy,
  title: "Tournaments or a simple series",
  body: "Build a full tournament \u2014 round-robin, self-seeding knockout, points table \u2014 or a head-to-head series between two teams with just a running score."
}];

export function FirstLaunchTour({
  onDone
}) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === TOUR_SLIDES.length - 1;
  function finish() {
    markTourSeen();
    onDone();
  }
  const current = TOUR_SLIDES[slide];
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: finish
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 6,
      marginBottom: 18
    }
  }, TOUR_SLIDES.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: i === slide ? 18 : 6,
      height: 6,
      borderRadius: 3,
      background: i === slide ? COLORS.pitch : COLORS.creamDark,
      transition: "width 0.2s ease"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(current.icon, {
    size: 40,
    style: {
      color: COLORS.pitch
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 21,
      color: COLORS.pitch,
      textAlign: "center",
      marginBottom: 8
    }
  }, current.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      lineHeight: 1.6,
      marginBottom: 22,
      padding: "0 6px"
    }
  }, current.body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, !isLast && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: finish,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      flex: 1
    }
  }, "Skip"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: isLast ? finish : () => setSlide(s => s + 1),
    style: {
      flex: isLast ? 1 : 2
    }
  }, isLast ? "Get started" : "Next")));
}

export function TournamentShareModal({
  tournament,
  standings,
  onClose,
  onUpdateTournament
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const code = tournament.shareCode || null;
  const link = code ? `${window.location.origin}${window.location.pathname}?tournament=${code}` : "";
  async function handleShare() {
    setBusy(true);
    setError("");
    const result = await shareTournament(tournament, standings);
    setBusy(false);
    if (result.ok) {
      if (!tournament.shareCode) onUpdateTournament({
        ...tournament,
        shareCode: result.code
      });
    } else {
      setError(result.error || "Couldn't create a share link.");
    }
  }
  async function handleStop() {
    if (!code) return;
    setBusy(true);
    setError("");
    const result = await stopSharingTournament(tournament.id, code);
    setBusy(false);
    if (result.ok) {
      onUpdateTournament({
        ...tournament,
        shareCode: null
      });
    } else {
      setError(result.error || "Couldn't stop sharing.");
    }
  }
  function handleCopy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Share this tournament"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Anyone with the link can view standings and fixtures \u2014 no account needed. It updates itself automatically as results come in, so there's usually nothing to do here beyond copying the link below \u2014 \"Refresh now\" is only for forcing an update on the spot. A link that's gone unused for a long stretch may also expire on its own on some servers."), code ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: COLORS.cream,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, link), /*#__PURE__*/React.createElement("button", {
    onClick: handleCopy,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12,
      cursor: "pointer",
      flexShrink: 0
    }
  }, copied ? "Copied!" : "Copy")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontSize: 12,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: handleShare,
    disabled: busy,
    style: {
      flex: 1
    }
  }, busy ? "\u2026" : "Refresh now"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: handleStop,
    disabled: busy,
    style: {
      flex: 1
    }
  }, "Stop sharing"))) : /*#__PURE__*/React.createElement(React.Fragment, null, error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontSize: 12,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleShare,
    disabled: busy,
    style: {
      width: "100%"
    }
  }, busy ? "Creating\u2026" : "Create share link")));
}

export function QualificationCalculatorModal({
  tournament,
  standings,
  onClose,
  onSave
}) {
  const saved = tournament.qualificationScenario || {};
  const [myTeam, setMyTeam] = useState(saved.myTeam || "");
  const [rivalTeam, setRivalTeam] = useState(saved.rivalTeam || "");
  const [rivalNRR, setRivalNRR] = useState(saved.rivalNRR != null ? String(saved.rivalNRR) : "");
  const [battingFirst, setBattingFirst] = useState(saved.battingFirst !== false);
  const [oversLimit, setOversLimit] = useState(saved.oversLimit ? String(saved.oversLimit) : "20");
  const [knownRuns, setKnownRuns] = useState("");
  const [saved_, setSaved_] = useState(false);
  const myStats = standings.find(r => r.team === myTeam);
  const oversLimitNum = parseFloat(oversLimit);
  const rivalNRRNum = parseFloat(rivalNRR);
  const knownRunsNum = parseFloat(knownRuns);
  const canCompute = myStats && Number.isFinite(rivalNRRNum) && Number.isFinite(oversLimitNum) && oversLimitNum > 0 && Number.isFinite(knownRunsNum) && knownRunsNum >= 0;
  const result = canCompute ? computeQualificationTarget({
    stats: myStats,
    rivalNRR: rivalNRRNum,
    battingFirst,
    oversLimit: oversLimitNum,
    knownRuns: knownRunsNum
  }) : null;
  function handleRivalChange(name) {
    setRivalTeam(name);
    const r = standings.find(x => x.team === name);
    if (r) setRivalNRR(r.nrr.toFixed(3));
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Qualification calculator"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Assumes you and the rival finish tied on points \u2014 this only works out the net run rate side of it."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: myTeam,
    onChange: e => setMyTeam(e.target.value),
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
  }, "Your team\u2026"), tournament.teams.map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n))), /*#__PURE__*/React.createElement("select", {
    value: rivalTeam,
    onChange: e => handleRivalChange(e.target.value),
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
  }, "Rival to beat\u2026"), tournament.teams.filter(n => n !== myTeam).map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Rival's NRR"), /*#__PURE__*/React.createElement(TextField, {
    value: rivalNRR,
    onChange: setRivalNRR,
    inputMode: "decimal",
    placeholder: "0.500"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Overs limit"), /*#__PURE__*/React.createElement(TextField, {
    value: oversLimit,
    onChange: setOversLimit,
    inputMode: "decimal",
    placeholder: "20"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: battingFirst ? "primary" : "default",
    onClick: () => setBattingFirst(true),
    style: {
      flex: 1,
      fontSize: 12.5
    }
  }, "We bat first"), /*#__PURE__*/React.createElement(Btn, {
    variant: !battingFirst ? "primary" : "default",
    onClick: () => setBattingFirst(false),
    style: {
      flex: 1,
      fontSize: 12.5
    }
  }, "We bowl first")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, battingFirst ? "Runs we set batting first" : "Target we're chasing"), /*#__PURE__*/React.createElement(TextField, {
    value: knownRuns,
    onChange: setKnownRuns,
    inputMode: "decimal",
    placeholder: battingFirst ? "e.g. 180" : "e.g. 170"
  })), !myTeam ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "Pick your team to see its current NRR figures.") : result && /*#__PURE__*/React.createElement("div", {
    style: {
      background: result.achievable ? "rgba(74,124,46,0.1)" : "rgba(139,30,30,0.08)",
      border: `1.5px solid ${result.achievable ? "rgba(74,124,46,0.3)" : "rgba(139,30,30,0.25)"}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      color: result.achievable ? COLORS.turf : COLORS.ball,
      lineHeight: 1.5
    }
  }, !result.achievable ? "Not achievable this match \u2014 even the best possible result on this side of it wouldn't reach that NRR." : result.kind === "restrict" ? `Restrict ${rivalTeam || "them"} to ${Math.max(0, result.maxConcede)} or fewer.` : result.anyWinWorks ? "Any win at all gets you there." : `Chase it down within ${decimalOversToLabel(result.maxOversForDisplay, 6)} overs.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onClose,
    style: {
      flex: 1
    }
  }, "Close"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !myTeam || !rivalTeam,
    onClick: () => {
      onSave({
        myTeam,
        rivalTeam,
        rivalNRR: rivalNRRNum,
        battingFirst,
        oversLimit: oversLimitNum,
        // Frozen at save time — the live banner in MatchScreen has no independent way to reach
        // this tournament's other matches (matches don't record which club/tournament-source
        // loaded them beyond a bare tournamentId), so it reuses this snapshot rather than
        // recomputing standings itself. Reopen and re-save the calculator if other results come
        // in before the match this was set up for.
        myStats: myStats ? {
          runsFor: myStats.runsFor,
          oversFor: myStats.oversFor,
          runsAgainst: myStats.runsAgainst,
          oversAgainst: myStats.oversAgainst
        } : null
      });
      setSaved_(true);
      setTimeout(() => setSaved_(false), 1500);
    },
    style: {
      flex: 1
    }
  }, saved_ ? "Saved!" : "Save for live tracking")));
}
