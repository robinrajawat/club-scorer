import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { LoadingBallIllustration } from "./illustrations.js";
import { BallCelebration, MilestoneToast } from "./scoringUiAtoms.js";
import { MatchStatsPanel } from "./scorecard.js";
import { Share, Check, Info } from "./icons.js";
import { unpackMatchFromFirestore } from "../core/packUtils.js";
import { matchResultText, matchScoreLine, buildFollowUrl, buildFollowMatchUrl, tossText, nonStandardRulesText, umpiresText } from "../core/shareAndFormat.js";
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
  // Brief "Copied!" confirmation after the Share button falls back to clipboard (no
  // navigator.share on this browser) -- see handleShare below.
  const [linkCopied, setLinkCopied] = useState(false);
  // Toss/house-rules/umpires now live behind a header info icon instead of a "Match details"
  // disclosure sitting in the page flow between the header and the scorecard -- see the Modal
  // near the bottom of this render. MatchStatsPanel is told not to render its own copy of these
  // (or the venue line, shown in the header here instead) when showOvers is true; see scorecard.js.
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  // Wall-clock time a real snapshot last actually arrived (not just re-rendered) -- feeds the
  // "might be stale" hint below. `now` exists purely to force a re-render on a timer so that hint
  // can appear/disappear on its own even while no new snapshot ever arrives (a dropped connection
  // looks identical to a quiet passage of play until you compare against the clock, not the data).
  const [lastUpdateAt, setLastUpdateAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
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
      setLastUpdateAt(Date.now());
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
  // Ticks `now` every 15s purely to re-evaluate the staleness hint below on a clock, independent
  // of whether a new snapshot ever arrives -- 15s is plenty precise for a hint that only kicks in
  // once several minutes have passed, and doesn't re-render this screen anywhere near as often as
  // a genuinely live match already does on its own from real snapshots.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
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
  // Same three fields MatchInfoFold already surfaces on the scorer's own Scorecard overlay --
  // reused directly here rather than through that component, since this needs an icon-triggered
  // Modal instead of an inline collapsible.
  const tossInfo = tossText(match.toss);
  const houseRules = nonStandardRulesText(match.rules);
  const umpires = umpiresText(match);
  const hasMatchDetails = !!(tossInfo || houseRules || umpires);
  // Several minutes with no snapshot at all, on a match that isn't finished, is unusual enough to
  // be worth a gentle nudge -- normal gaps between overs/wickets/drinks breaks are nowhere near
  // this long. Never shown once the match is complete: no further update is expected anyway, so
  // flagging one that "hasn't arrived" would just be a false alarm.
  const STALE_AFTER_MS = 3 * 60 * 1000;
  const isStale = match.status !== "complete" && lastUpdateAt != null && now - lastUpdateAt > STALE_AFTER_MS;
  // Builds whichever URL this screen was actually reached by -- a code-based link if code is set,
  // the newer matchId-based one otherwise (see buildFollowMatchUrl/getFollowMatchIdFromUrl) --
  // then prefers the native share sheet when the browser has one, falling back to a clipboard copy
  // with a brief "Copied!" confirmation otherwise. No third path: a browser with neither still
  // leaves the link visible in the address bar to copy by hand.
  function handleShare() {
    const url = code ? buildFollowUrl(code) : matchId ? buildFollowMatchUrl(matchId) : null;
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: `${match.teamA} vs ${match.teamB} \u2014 Club Scorer`,
        text: matchScoreLine(match) || undefined,
        url
      }).catch(() => {});
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }
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
  }, match.status === "complete" ? "Final" : inningsBreak ? "Innings Break" : "Live"), isStale && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      opacity: 0.75,
      fontStyle: "italic"
    }
  }, "· No updates in a while")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleShare,
    className: "cs-btn",
    "aria-label": "Share this match",
    style: {
      background: "rgba(242,236,217,0.14)",
      border: "1px solid rgba(242,236,217,0.35)",
      borderRadius: 8,
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      padding: "6px 10px",
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, linkCopied ? /*#__PURE__*/React.createElement(Check, {
    size: 13
  }) : /*#__PURE__*/React.createElement(Share, {
    size: 13
  }), linkCopied ? "Copied!" : "Share"), /*#__PURE__*/React.createElement("button", {
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
  }, "Exit"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      marginTop: 4,
      maxWidth: 560,
      margin: "4px auto 0"
    }
  }, match.teamA, " vs ", match.teamB), (match.venue || hasMatchDetails) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      maxWidth: 560,
      margin: "3px auto 0"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.85
    }
  }, match.venue && `📍 ${match.venue}`), hasMatchDetails && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowMatchDetails(true),
    className: "cs-btn",
    "aria-label": "Match details",
    style: {
      background: "none",
      border: "none",
      padding: 2,
      display: "flex",
      color: COLORS.creamFixed,
      opacity: 0.85,
      cursor: "pointer",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 15
  }))), (resultText || inningsBreakText) && /*#__PURE__*/React.createElement("div", {
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
    showOvers: true,
    ballCommentary: !inningsBreak ? ballCommentary : null,
    overSummary: !inningsBreak ? overSummary : null
  }), showMatchDetails && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowMatchDetails(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 18,
      color: COLORS.ink,
      marginBottom: 10
    }
  }, "Match details"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.7
    }
  }, tossInfo, tossInfo && (houseRules || umpires) && /*#__PURE__*/React.createElement("br", null), houseRules && /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "House rules: ", houseRules), houseRules && umpires && /*#__PURE__*/React.createElement("br", null), umpires)));
}
