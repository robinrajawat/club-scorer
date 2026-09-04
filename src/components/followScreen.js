import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { LoadingBallIllustration } from "./illustrations.js";
import { BallCelebration, MilestoneToast } from "./scoringUiAtoms.js";
import { BallBadge } from "./matchDisplayAtoms.js";
import { MatchStatsPanel } from "./scorecard.js";
import { unpackMatchFromFirestore } from "../core/packUtils.js";
import { matchResultText, matchScoreLine } from "../core/shareAndFormat.js";
import { lastBallCommentary } from "../core/scoringEngine.js";

// Public, no-auth *live* match-following page -- reached either via a "?live=CODE" link (see
// ShareMenu, which creates these; subscribes to db.collection("liveViews").doc(code)) or, now, by
// tapping a card in the Home screen's "Live now" feed (see loadLiveMatches in index.html), which
// passes a matchId instead and subscribes to db.collection("liveMatches").doc(matchId) -- a
// different collection but the exact same packMatchForFirestore document shape, so every render
// path below is identical regardless of which one supplied the match. Exactly one of code/matchId
// is expected to be set. Distinct from FollowTournamentScreen (a one-time snapshot read of a
// tournament's standings). `db` (the raw Firestore SDK instance, a bare global, not extracted) is
// stubbed the same way followTournamentScreen.test.js stubs it, except the stub here is an
// onSnapshot subscription (returning an unsubscribe function and taking a (doc) => void success
// callback plus an (err) => void error callback) rather than a one-shot .get() promise -- tests
// drive updates by calling the captured success/error callback directly.
//
// Infers boundary/wicket celebrations and milestone toasts by diffing each new snapshot against
// the previous one (see the comment on the celebration effect below for the exact rules) rather
// than reacting to a specific scoring event, since there isn't one to hang off of here the way
// MatchScreen's own handleRun/celebrateWicket have. Covered by
// tests/unit/components/followScreen.test.js.

export function FollowScreen({
  code,
  matchId,
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
  // Persistent "Bumrah to Kohli: FOUR!" line below the scoreboard -- same lastBallCommentary
  // MatchScreen's own commit() uses, fed here by diffing the previous snapshot's full inning
  // state against the new one (prevFullInningRef) rather than off a direct before/after pair the
  // way MatchScreen has one, since a follower only ever sees periodic snapshots. Deliberately not
  // gated on the same "exactly one new ball" check the celebration effect below uses --
  // lastBallCommentary already returns null on its own for a stale/completed-over comparison, so
  // it stays safe across a multi-ball gap without needing that same guard duplicated here.
  const [ballCommentary, setBallCommentary] = useState(null);
  // "Over 12 (Jasprit Bumrah): 1 4 W 0 1 6 = 12 runs, 1 wkt" -- shown from the moment an over
  // completes (the previous snapshot's inning gained a fresh trailing over, same signal
  // lastBallCommentary's own overIdx math relies on elsewhere) until a real ball lands in the new
  // one, not on a timer -- someone changing ends/fields between overs is exactly when this is
  // worth reading, and it should stay up for however long that actually takes. Takes over
  // ballCommentary's spot on screen while active rather than showing both -- the completed over's
  // last ball is already part of this summary, so repeating it right above would be redundant.
  const [overSummary, setOverSummary] = useState(null);
  const prevFullInningRef = useRef(null);
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
      } else if (lastBall && (lastBall.bigHit || lastBall.battedRuns === 4 || lastBall.battedRuns === 6)) {
        // lastBall.battedRuns (see its comment in scoringEngine.js's applyBall), not lastBall.runs
        // -- lastBall.runs is the ball's raw total, which for a no-ball includes the extras
        // penalty (a genuine six off a default-penalty no-ball stores runs:7, never matching a
        // plain ===6 check) and for an overthrow-topped-up hit includes the bonus on top, either of
        // which could previously coincide with 4 or 6 and wrongly trigger a boundary celebration
        // for viewers. Also now covers a Big Hit/Maximum Hit bonus six, which this never did before
        // (its total doesn't match 4 or 6 either) -- same `bigHit || n` pattern MatchScreen's own
        // handleRun already uses for the scorer's own celebration.
        const key = Date.now();
        setCelebration({
          type: lastBall.bigHit || lastBall.battedRuns,
          key
        });
        setTimeout(() => setCelebration(c => c && c.key === key ? null : c), 1000);
      }
    }
    if (sameInning && prevMilestoneCountRef.current != null && milestoneCount > prevMilestoneCountRef.current) {
      const newOnes = (inn.toastMilestones || []).slice(prevMilestoneCountRef.current);
      setMilestoneQueue(q => [...q, ...newOnes]);
    }
    if (sameInning && prevFullInningRef.current) {
      const commentary = lastBallCommentary(prevFullInningRef.current, inn);
      if (commentary) setBallCommentary(commentary);
    } else {
      // First snapshot after mount, or a new innings just started -- nothing to diff against yet,
      // and a stale commentary line from the innings that just ended would be actively misleading.
      setBallCommentary(null);
    }
    const overs = inn.overs || [];
    const prevOvers = prevFullInningRef.current ? prevFullInningRef.current.overs || [] : null;
    if (sameInning && prevOvers && overs.length > prevOvers.length) {
      // applyBall appends a fresh empty trailing over the instant the previous one completes, in
      // the same commit as that over's final ball -- so a grown overs.length here means the over
      // at index overs.length - 2 (not - 1, which is the just-started empty one) is the one that
      // just finished. Bowler comes from the PREVIOUS snapshot, not this one -- a new bowler for
      // the upcoming over may already be set on `inn` by the time this snapshot arrived, which
      // would misattribute the just-finished over to the wrong bowler.
      const finishedOver = overs[overs.length - 2] || [];
      setOverSummary({
        overNumber: overs.length - 1,
        bowlerName: prevFullInningRef.current.bowlerName,
        balls: finishedOver,
        runs: finishedOver.reduce((s, b) => s + (b.runs || 0), 0),
        wickets: finishedOver.filter(b => b.kind === "wicket").length
      });
    } else if (!sameInning || ballCount > (prevBallCountRef.current || 0)) {
      // A real ball landed in what's now the current over (or a new innings started) -- the
      // waiting-for-the-next-over window this summary is meant to fill is over.
      setOverSummary(null);
    }
    prevBallCountRef.current = ballCount;
    prevMilestoneCountRef.current = milestoneCount;
    prevInningIdxRef.current = inningIdx;
    prevFullInningRef.current = inn;
  }, [match]);
  useEffect(() => {
    if (!code && !matchId) {
      setStatus("not-found");
      return;
    }
    const ref = code ? db.collection("liveViews").doc(code) : db.collection("liveMatches").doc(matchId);
    const unsub = ref.onSnapshot(doc => {
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
  }, [code, matchId]);
  // Keeps the live score visible in the browser tab even when this isn't the focused tab -- lets
  // someone check on a match without switching back to it. Guarded on `typeof document` (not just
  // referenced directly) since these tests run under plain node:test, not jsdom -- same reasoning
  // exportButtons.js already documents for its own document.title use, though that one only ever
  // runs from a click handler; this needs to run passively as new snapshots arrive, so it can't
  // rely on only ever being invoked from a real browser event the way that one does. Two separate
  // effects rather than one: the empty-deps one captures whatever title was already showing at
  // mount and restores exactly that on unmount (only), so restoration isn't at the mercy of
  // whatever the second effect happened to overwrite it to most recently.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined" || !match) return;
    document.title = `${matchScoreLine(match) || `${match.teamA} vs ${match.teamB}`} · Club Scorer`;
  }, [match]);
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
  }, resultText || inningsBreakText), ballCommentary && !overSummary && !inningsBreak && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      opacity: 0.9,
      maxWidth: 560,
      margin: "6px auto 0",
      textAlign: "center"
    }
  }, ballCommentary.lead, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      // Only six/wicket get a distinct color here (gold / the header's own "live" red, both
      // guaranteed to read against the dark green header background) -- MatchScreen's own
      // four/wide/no-ball colors (turf green, purple) were tuned for its cream background and
      // would have poor contrast on this one, so those stay plain cream-white bold instead of
      // reusing that same palette verbatim.
      color: {
        six: COLORS.gold,
        wicket: COLORS.live
      }[ballCommentary.kind] || COLORS.creamFixed
    }
  }, ballCommentary.outcome))), overSummary && !inningsBreak && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: "14px auto 0",
      padding: "16px 16px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: "14px 16px",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
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
  }, "Over ", overSummary.overNumber, overSummary.bowlerName && ` · ${overSummary.bowlerName}`), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13,
      fontWeight: 700,
      color: overSummary.wickets > 0 ? COLORS.ball : COLORS.turf
    }
  }, overSummary.runs, " run", overSummary.runs === 1 ? "" : "s", overSummary.wickets > 0 && `, ${overSummary.wickets} wkt${overSummary.wickets === 1 ? "" : "s"}`)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, overSummary.balls.map((b, i) => /*#__PURE__*/React.createElement(BallBadge, {
    key: i,
    ev: b
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      marginTop: 8,
      fontStyle: "italic"
    }
  }, "Next over starting…")), /*#__PURE__*/React.createElement(MatchStatsPanel, {
    match: match,
    tab: tab,
    setTab: setTab,
    showOvers: true
  }));
}
