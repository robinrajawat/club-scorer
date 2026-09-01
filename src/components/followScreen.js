import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { LoadingBallIllustration } from "./illustrations.js";
import { BallCelebration, MilestoneToast } from "./scoringUiAtoms.js";
import { MatchStatsPanel } from "./scorecard.js";
import { unpackMatchFromFirestore } from "../core/packUtils.js";
import { matchResultText } from "../core/shareAndFormat.js";

// Public, no-auth *live* match-following page -- reached via a "?live=CODE" link (see ShareMenu,
// which creates these). Distinct from FollowTournamentScreen (a one-time snapshot read of a
// tournament's standings). Subscribes to the match in real time via
// `db.collection("liveViews").doc(code).onSnapshot(...)` -- `db` (the raw Firestore SDK instance,
// a bare global, not extracted) is stubbed the same way followTournamentScreen.test.js stubs it,
// except the stub here is an onSnapshot subscription (returning an unsubscribe function and taking
// a (doc) => void success callback plus an (err) => void error callback) rather than a one-shot
// .get() promise -- tests drive updates by calling the captured success/error callback directly.
//
// Infers boundary/wicket celebrations and milestone toasts by diffing each new snapshot against
// the previous one (see the comment on the celebration effect below for the exact rules) rather
// than reacting to a specific scoring event, since there isn't one to hang off of here the way
// MatchScreen's own handleRun/celebrateWicket have. Covered by
// tests/unit/components/followScreen.test.js.

export function FollowScreen({
  code,
  onExit
}) {
  const [match, setMatch] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | found | not-found | error
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  // Boundary/wicket pops and milestone toasts for the person following along, not just the
  // scorer -- same BallCelebration/MilestoneToast components MatchScreen uses, but there's no
  // direct "a six just happened" event here to hang off of the way handleRun/celebrateWicket have
  // on the scoring side. This is inferred instead, by diffing each new Firestore snapshot against
  // the previous one:
  //   - Boundary/wicket: exactly one new ball landed since last snapshot (ballCount went up by
  //     exactly 1, not more), and that ball is kind 'wicket', or kind 'run'/'noball' with runs
  //     4 or 6 -- the same two conditions handleRun/handleExtra actually celebrate on the scoring
  //     side (a bye/legbye reaching the boundary is deliberately NOT a celebration there either).
  //   - Milestones: inn.toastMilestones (already synced -- packMatchForFirestore only special-
  //     cases .overs, everything else on the inning object passes through untouched) grew since
  //     last snapshot; the new entries get queued the same two-effect way MatchScreen's own
  //     milestoneQueue does below, for the same reason documented there (a stuck-toast bug from
  //     collapsing the promote-next and schedule-dismiss effects into one).
  // Both deliberately skip entirely (no celebration, scorecard still updates correctly) on the
  // FIRST snapshot after mount (nothing to diff against yet -- would otherwise replay a whole
  // match's history of fours/sixes/milestones the moment someone opens the link) and on any gap
  // bigger than one new ball (a follower's connection blipped, or they just joined mid-over) --
  // ambiguous which ball to celebrate, and celebrating a whole stack at once would look broken
  // rather than exciting.
  const [celebration, setCelebration] = useState(null);
  const [milestoneToast, setMilestoneToast] = useState(null);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const prevBallCountRef = useRef(null);
  const prevMilestoneCountRef = useRef(null);
  const prevInningIdxRef = useRef(null);
  useEffect(() => {
    if (milestoneToast || milestoneQueue.length === 0) return;
    const [next, ...rest] = milestoneQueue;
    setMilestoneToast({
      milestone: next,
      key: Date.now()
    });
    setMilestoneQueue(rest);
  }, [milestoneToast, milestoneQueue]);
  useEffect(() => {
    if (!milestoneToast) return;
    const key = milestoneToast.key;
    const timer = setTimeout(() => {
      setMilestoneToast(t => t && t.key === key ? null : t);
    }, 2600);
    return () => clearTimeout(timer);
  }, [milestoneToast]);
  useEffect(() => {
    if (!match || !match.innings) return;
    const inningIdx = match.currentInningIndex != null ? match.currentInningIndex : match.innings.length - 1;
    const inn = match.innings[inningIdx];
    if (!inn) return;
    const ballCount = (inn.overs || []).reduce((s, o) => s + (Array.isArray(o) ? o.length : 0), 0);
    const milestoneCount = (inn.toastMilestones || []).length;
    const sameInning = prevInningIdxRef.current === inningIdx;
    if (sameInning && prevBallCountRef.current != null && ballCount === prevBallCountRef.current + 1) {
      // Finding "the ball that was just scored" isn't simply overs[last][last]: applyBall starts a
      // NEW empty over the moment a legal ball completes one, in the exact same commit that added
      // that final ball -- so a boundary or wicket landing on the last ball of an over would put
      // the just-started (empty) over last, with the actual ball one array back. Walking backward
      // past any empty trailing over(s) finds the real most recent ball regardless of whether one
      // just started; this exact miss would otherwise silently swallow the celebration for every
      // over-ending boundary/wicket, arguably the most dramatic ball of the over to miss.
      const overs = inn.overs || [];
      let lastBall = null;
      for (let i = overs.length - 1; i >= 0 && !lastBall; i--) {
        const o = overs[i];
        if (Array.isArray(o) && o.length > 0) lastBall = o[o.length - 1];
      }
      if (lastBall && lastBall.kind === "wicket") {
        const key = Date.now();
        setCelebration({
          type: "wicket",
          key
        });
        setTimeout(() => setCelebration(c => c && c.key === key ? null : c), 1000);
      } else if (lastBall && (lastBall.kind === "run" || lastBall.kind === "noball") && (lastBall.runs === 4 || lastBall.runs === 6)) {
        const key = Date.now();
        setCelebration({
          type: lastBall.runs,
          key
        });
        setTimeout(() => setCelebration(c => c && c.key === key ? null : c), 1000);
      }
    }
    if (sameInning && prevMilestoneCountRef.current != null && milestoneCount > prevMilestoneCountRef.current) {
      const newOnes = (inn.toastMilestones || []).slice(prevMilestoneCountRef.current);
      setMilestoneQueue(q => [...q, ...newOnes]);
    }
    prevBallCountRef.current = ballCount;
    prevMilestoneCountRef.current = milestoneCount;
    prevInningIdxRef.current = inningIdx;
  }, [match]);
  useEffect(() => {
    if (!code) {
      setStatus("not-found");
      return;
    }
    const unsub = db.collection("liveViews").doc(code).onSnapshot(doc => {
      if (!doc.exists) {
        setStatus("not-found");
        return;
      }
      const m = unpackMatchFromFirestore(doc.data());
      setMatch(m);
      const startedIdx = m.innings.reduce((acc, inn, idx) => inn.battingOrder && inn.battingOrder.length > 0 ? idx : acc, 0);
      setTab(startedIdx);
      setStatus("found");
    }, err => {
      console.error("[follow] snapshot error \u2014 code:", err.code, "message:", err.message);
      setError(err.code === "permission-denied" ? "This live link isn't available right now." : err.message || "Couldn't load this match.");
      setStatus("error");
    });
    return unsub;
  }, [code]);
  const wrapStyle = {
    minHeight: "100vh",
    background: COLORS.cream,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,36,32,0.045) 28px)"
  };
  if (status === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(LoadingBallIllustration, {
      style: {
        margin: "0 auto 12px"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        color: COLORS.inkSoft,
        fontSize: 13
      }
    }, "Loading live score\u2026")));
  }
  if (status === "not-found" || status === "error") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        maxWidth: 320
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'DM Serif Display', serif",
        fontSize: 20,
        color: COLORS.ink,
        marginBottom: 8
      }
    }, status === "not-found" ? "Match not found" : "Couldn't load this match"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft,
        lineHeight: 1.5,
        marginBottom: 20
      }
    }, status === "not-found" ? "This link may be wrong, or the match was removed." : error), /*#__PURE__*/React.createElement("button", {
      className: "cs-btn cs-shine",
      onClick: onExit,
      style: {
        background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})`,
        border: "none",
        borderRadius: 10,
        color: "#fff",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 13.5,
        padding: "10px 20px",
        cursor: "pointer"
      }
    }, "Go to Club Scorer")));
  }
  const resultText = matchResultText(match);
  const inningsBreak = match.awaitingSecondInningsSetup && match.status !== "complete";
  const inningsBreakText = inningsBreak && match.innings[0] ? `Innings break \u2014 ${match.innings[0].bowlingTeam} need ${match.innings[0].runs + 1} to win` : null;
  return /*#__PURE__*/React.createElement("div", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement(BallCelebration, {
    celebration: celebration
  }), /*#__PURE__*/React.createElement(MilestoneToast, {
    toast: milestoneToast
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchDarkFixed})`,
      color: COLORS.creamFixed,
      padding: "16px 16px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, match.status !== "complete" && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: inningsBreak ? COLORS.willow : COLORS.live,
      animation: inningsBreak ? "none" : "cs-pulse 1.6s ease infinite",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      opacity: 0.85
    }
  }, match.status === "complete" ? "Final" : inningsBreak ? "Innings Break" : "Live")), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "cs-btn",
    style: {
      background: "rgba(242,236,217,0.14)",
      border: "1px solid rgba(242,236,217,0.35)",
      borderRadius: 8,
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      padding: "6px 10px"
    }
  }, "Exit")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      marginTop: 4,
      maxWidth: 560,
      margin: "4px auto 0"
    }
  }, match.teamA, " vs ", match.teamB), (resultText || inningsBreakText) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      fontWeight: 600,
      opacity: 0.9,
      maxWidth: 560,
      margin: "4px auto 0"
    }
  }, resultText || inningsBreakText)), /*#__PURE__*/React.createElement(MatchStatsPanel, {
    match: match,
    tab: tab,
    setTab: setTab,
    showOvers: true
  }));
}
