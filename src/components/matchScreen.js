import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { AlertTriangle, ArrowLeftRight, ChevronDown, ChevronLeft, Check, MoreVertical, Table2, Undo2 } from "./icons.js";
import { Field } from "./screenAtoms.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";
import { RoleBadge, BallCelebration, MilestoneToast, OdometerScore, InningsTimer } from "./scoringUiAtoms.js";
import { BallBadge } from "./matchDisplayAtoms.js";
import { OversStrip, SyncStatusBanner } from "./scoreboardAtoms.js";
import { PlayerPicker } from "./pickerAtoms.js";
import { ExportPdfButton } from "./exportButtons.js";
import { ScorecardOverlay } from "./scorecard.js";
import { SyncConflictModal } from "./matchInsightCards.js";
import { ShareMenu } from "./shareMenus.js";
import { SuperOverOpenersSetup, SecondInningsSetup } from "./inningsSetupScreens.js";
import { ResultScreen } from "./resultScreen.js";
import { applyBall, crr, ensureBatsman, ensureBowler, isWideNoballLegal, newInning, oversLabel } from "../core/scoringEngine.js";
import {
  battingTeamXISize, bowlersAtMaxOvers, captainFor, computeQualificationTarget,
  decimalOversToLabel, dlsResourcePercent, dlsTarget, inPowerplay, isOverTimeCap, keeperFor,
  maxWicketsFor, numberFor, numbersFor, oversLeftTrueDecimal, rosterFor, suggestedNextBowler
} from "../core/appLogic.js";
import { chasingInfo } from "../core/shareAndFormat.js";
import { clearPendingWrite, loadUndoHistory, saveUndoHistory } from "../core/localStorageOutbox.js";
import { registerLiveMatch, unregisterLiveMatch } from "../core/liveMatchRegistry.js";
import { genMatchCode } from "../core/miscHelpers.js";

// The live scoring screen: run/extra/wicket entry, undo, swap strike, retire, end-innings-early/
// no-result/revised-target (DLS-assisted or manual), the between-deliveries next-batsman/next-
// bowler prompts, sync-conflict resolution (another device's write racing this one), and the
// NRR qualification banner. Delegates out to SuperOverOpenersSetup/SecondInningsSetup while an
// innings' openers haven't been set yet, and to ResultScreen once the match is complete -- all
// three already extracted, referenced here as ordinary imports rather than bare globals since
// this screen renders them directly as an early return, not via any closure/prop indirection.
// `saveMatch` (a Firestore write) is the one bare global -- every other write (undo history,
// live-match registry, pending-write cleanup) already goes through an extracted core helper.
// `MAX_UNDO_HISTORY` (a standalone top-level const, previously part of no module or component,
// used only here) travels alongside MatchScreen in this same file as its own GENERATED-FN
// export, same treatment SETUP_PAGE_LABELS got in setupScreen.js's own batch. Every nested
// helper (confirmWicketDetails, computeDLSPreview, undo, swapStrike, etc.) has no call site
// outside this component, so all of them travel verbatim with no closure-breaking refactor
// needed -- unlike HomeScreen's renderMatchCard, which did. Covered by
// tests/unit/components/matchScreen.test.js.

export const MAX_UNDO_HISTORY = 30;

export function MatchScreen({
  match,
  setMatch,
  onExit,
  pendingCount,
  onPendingSynced,
  tournament
}) {
  const [padCollapsed, setPadCollapsed] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [showExtra, setShowExtra] = useState(null); // 'wide'|'noball'|'bye'|'legbye'
  const [showWicket, setShowWicket] = useState(false);
  const [customRunsFor, setCustomRunsFor] = useState(null); // null | 'run' | 'wide' | 'noball' | 'bye' | 'legbye'
  const [customRunsCompleted, setCustomRunsCompleted] = useState("");
  const [customOverthrow, setCustomOverthrow] = useState("");
  const [customShortRun, setCustomShortRun] = useState(false);
  const [newBatsmanName, setNewBatsmanName] = useState("");
  const [newBowlerPrompt, setNewBowlerPrompt] = useState(false);
  const [newBowlerName, setNewBowlerName] = useState("");
  const [history, setHistory] = useState(() => loadUndoHistory(match.id));
  const [showScorecard, setShowScorecard] = useState(false);
  const [celebration, setCelebration] = useState(null); // {type: 4|6, key}
  const [milestoneToast, setMilestoneToast] = useState(null); // {milestone, key} | null — currently showing
  const [milestoneQueue, setMilestoneQueue] = useState([]); // milestones waiting their turn to toast
  // Drains milestoneQueue one at a time — a single ball can produce more than one milestone (e.g.
  // the boundary that both brings up a batsman's fifty AND the team's hundred), and showing only
  // the last one silently dropped the others from the toast (they were still logged to the
  // scorecard either way, just never surfaced in the moment). This shows each in turn instead.
  // Split into two effects deliberately: promoting the next queued item into milestoneToast must
  // NOT live in the same effect that schedules that toast's auto-dismiss timer, because that
  // effect's own dependency array includes milestoneToast — setting it re-triggers the effect
  // immediately, and its cleanup (clearTimeout) would cancel the timer it had just created, with
  // no replacement ever scheduled. That's what made a toast look "stuck": the first one to show
  // never actually got a working dismiss timer.
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
  const [conflict, setConflict] = useState(null); // remote match, when another device's write
  // raced ours — see applySaveResult below and the resolution modal near the end of this file.
  const inningIdx = match.currentInningIndex;
  const inning = match.innings[inningIdx];
  // NRR qualification banner: only meaningful once a scenario was saved (see
  // QualificationCalculatorModal) FOR one of this match's two teams, and only shown once the
  // batting order it assumed actually matches reality — showing a wrong-order calculation would
  // be worse than showing nothing.
  const qualScenario = tournament && tournament.qualificationScenario;
  const qualMyTeam = qualScenario && qualScenario.myStats && [match.teamA, match.teamB].includes(qualScenario.myTeam) ? qualScenario.myTeam : null;
  let qualResult = null;
  let qualPending = false;
  if (qualMyTeam) {
    const firstInning = match.innings[0];
    const iBattedFirst = firstInning.battingTeam === qualMyTeam;
    if (iBattedFirst === qualScenario.battingFirst) {
      if (firstInning.complete) {
        qualResult = computeQualificationTarget({
          stats: qualScenario.myStats,
          rivalNRR: qualScenario.rivalNRR,
          battingFirst: qualScenario.battingFirst,
          oversLimit: qualScenario.oversLimit,
          knownRuns: firstInning.runs
        });
      } else {
        qualPending = true;
      }
    }
  }
  // Registers this screen so a background sync (flushPendingWrites, running on a timer completely
  // outside React) can push a newly-confirmed writeSeq in here directly — see
  // notifyLiveMatchSynced. Without this, a background sync that lands while this exact match is
  // open on screen leaves this screen's local writeSeq stale, and the next ball scored here would
  // read as a conflict with "another device" that's actually just this device's own outbox.
  useEffect(() => {
    registerLiveMatch(match.id, setMatch);
    return () => unregisterLiveMatch(match.id);
  }, [match.id, setMatch]);
  // Same fix as checkInningEnd's allOut: was hardcoded to `< 10`, which is what actually let a
  // 9-a-side match keep prompting for an 11th/10th batsman that doesn't exist in the roster.
  const needsNewBatsman = inning && !inning.strikerName && inning.wickets < maxWicketsFor(match, inning) && !inning.complete;
  // Tracks the striker name a mandatory retirement-cap prompt was last dismissed for, so "Not now"
  // can actually close the modal instead of it reopening on the very next render (needsCapRetirement
  // below is otherwise a pure derived value, recomputed every render). Reset in commit() -- every
  // committed change (another ball, a wicket, an undo) re-nags if the striker is still over the cap
  // and still hasn't actually retired, matching the rule's "must retire immediately" intent while
  // still leaving a one-tap way to reach Undo if the total needs correcting instead.
  const [dismissedCapRetireFor, setDismissedCapRetireFor] = useState(null);
  // Derived, not stored state (same pattern as needsNewBatsman above) -- purely a function of live
  // totals vs. the retirementRuns rule, so it can't drift out of sync with the actual score the way
  // a separately-tracked boolean could. Checks BOTH ends, not just the striker: an odd-run delivery
  // rotates strike, so the batsman who just crossed the cap may no longer be the one currently on
  // strike by the time this renders -- missing that would mean someone who reached the cap while at
  // the non-striker's end could go the rest of the innings without ever being prompted. Prefers the
  // striker when (rare) both happen to qualify at once, since that's the one retireBatsman can act
  // on directly with no swap needed.
  const strikerRunsForCap = inning && inning.strikerName && inning.batsmen[inning.strikerName] ? inning.batsmen[inning.strikerName].runs : 0;
  const nonStrikerRunsForCap = inning && inning.nonStrikerName && inning.batsmen[inning.nonStrikerName] ? inning.batsmen[inning.nonStrikerName].runs : 0;
  const capRetireName = inning && inning.retirementRuns && !inning.complete ? inning.strikerName && strikerRunsForCap >= inning.retirementRuns && dismissedCapRetireFor !== inning.strikerName ? inning.strikerName : inning.nonStrikerName && nonStrikerRunsForCap >= inning.retirementRuns && dismissedCapRetireFor !== inning.nonStrikerName ? inning.nonStrikerName : null : null;
  const needsCapRetirement = !!capRetireName;
  const needsNewBowler = inning && inning.legalBalls > 0 && inning.legalBalls % (inning.ballsPerOver || 6) === 0 && !inning.bowlerName && !inning.complete;
  // Same revised-values fallback as checkInningEnd -- see there for the full reasoning. Both need
  // to agree on what "the target" and "the overs limit" actually are right now, or the live
  // display would show one number while the innings actually ends against a different one. Shared
  // with MatchStatsPanel (the read-only panel FollowScreen/ScorecardOverlay both use) via
  // chasingInfo rather than duplicating this calculation a second time.
  const isChasing = inningIdx === 1;
  const chasing = chasingInfo(match);
  const target = chasing ? chasing.target : null;
  const ballsLeft = chasing ? chasing.ballsLeft : null;
  const runsNeeded = chasing ? chasing.runsNeeded : null;
  const reqRate = chasing ? chasing.reqRate : null;
  // Kept separate from chasingInfo's own internal calculation -- chasingInfo only ever returns
  // data while innings 2 is active (isChasing), but the "(X.Y/Z)" overs count in the score header
  // below needs the right limit during innings 1 too, where chasing is null.
  const effectiveOversLimit = isChasing && match.revisedOvers != null ? match.revisedOvers : match.oversLimit;
  useEffect(() => {
    if (needsNewBowler && !newBowlerName) {
      const suggested = suggestedNextBowler(inning);
      if (suggested && suggested !== inning.lastBowlerName) setNewBowlerName(suggested);
    }
  }, [needsNewBowler]);
  const atMaxOvers = needsNewBowler ? bowlersAtMaxOvers(inning) : [];
  // The over that just finished, for the next-bowler prompt below -- by the time needsNewBowler is
  // true, applyBall has already pushed a fresh empty over onto the end of inning.overs (see the
  // over-completion branch there), so the just-finished over sits one slot back, not at the end.
  const justCompletedOver = needsNewBowler ? inning.overs[inning.overs.length - 2] || [] : [];
  const justCompletedOverRuns = justCompletedOver.reduce((s, b) => s + (b.runs || 0), 0);
  const justCompletedOverWickets = justCompletedOver.filter(b => b.kind === "wicket").length;
  const bowlingRosterNames = rosterFor(match, inning.bowlingTeam);
  const eligibleAfterMaxOvers = bowlingRosterNames.filter(n => n !== inning.lastBowlerName && !atMaxOvers.includes(n));
  // if excluding maxed-out bowlers would leave nobody to pick, don't exclude them — show everyone
  // with a warning instead of a dead end
  const maxOversExcludeList = eligibleAfterMaxOvers.length > 0 ? atMaxOvers : [];
  // Every write to a shared match is optimistic-concurrency checked server-side (see
  // transactionalMatchWrite): a save carries the writeSeq it EXPECTS to still be current, and the
  // server rejects it as a conflict if that's fallen behind. Scoring balls quickly fires several
  // saves back-to-back — each one built from the same just-rendered `match` prop, since the
  // previous save's resolved writeSeq hasn't come back and re-rendered yet. Without something
  // tracking the expected seq OUTSIDE of React's render cycle, every one of those in-flight saves
  // would carry the SAME stale expectedSeq: the first to land on the server succeeds, and every
  // other one immediately reads as "another device" raced it — even on a single device, single
  // tab. writeSeqRef is that outside-of-render tracker (updated the instant a save resolves, not
  // on next render), and saveQueueRef chains saves one after another so each one reads the ref
  // AFTER the previous save has updated it, instead of racing it.
  const writeSeqRef = useRef(match.writeSeq || 0);
  const saveQueueRef = useRef(Promise.resolve());
  useEffect(() => {
    if ((match.writeSeq || 0) > writeSeqRef.current) writeSeqRef.current = match.writeSeq;
  }, [match.writeSeq]);
  // A plain ok result just needs its new writeSeq folded back into local state (and the ref, right
  // away) so the NEXT write's check is against the right baseline — cur => merge, never overwrite,
  // since local state may already have moved on by the time this resolves. A conflict result means
  // another device's write genuinely landed in between; that needs a human decision, not a silent
  // overwrite, so it opens the resolution modal instead.
  function applySaveResult(result) {
    if (result.ok && result.writeSeq != null) {
      writeSeqRef.current = result.writeSeq;
      setMatch(cur => cur ? {
        ...cur,
        writeSeq: result.writeSeq
      } : cur);
    } else if (result.conflict) {
      setConflict(result.remoteMatch);
    }
    return result;
  }
  // Every save goes through here so they're serialized: each one waits for the previous save in
  // this tab to finish (and update writeSeqRef) before it reads the expected seq and sends its own
  // write, rather than several firing in parallel off the same stale value.
  function queueSave(updated) {
    saveQueueRef.current = saveQueueRef.current.then(() => saveMatch({
      ...updated,
      writeSeq: writeSeqRef.current
    })).then(applySaveResult);
    return saveQueueRef.current;
  }
  function resolveConflictKeepMine() {
    const forced = {
      ...match,
      writeSeq: conflict.writeSeq
    };
    writeSeqRef.current = conflict.writeSeq;
    setMatch(forced);
    setConflict(null);
    queueSave(forced);
  }
  function resolveConflictUseTheirs() {
    writeSeqRef.current = conflict.writeSeq || 0;
    setMatch(conflict);
    setConflict(null);
    // The person just chose to discard their local version in favor of the server's -- any queued
    // pending write for this match (from an earlier network hiccup, now superseded) has to go too,
    // or loadMatch would keep resurrecting that stale pre-conflict snapshot on the next reopen
    // instead of what was actually just resolved here, and the next ball scored would immediately
    // conflict again. "Keep mine" doesn't need this: it re-saves through queueSave -> saveMatch,
    // which already clears the pending write itself once that save actually succeeds.
    clearPendingWrite(match.id);
  }
  function pushHistory() {
    setHistory(h => {
      const next = [...h, JSON.parse(JSON.stringify(match))];
      const trimmed = next.length > MAX_UNDO_HISTORY ? next.slice(next.length - MAX_UNDO_HISTORY) : next;
      saveUndoHistory(match.id, trimmed);
      return trimmed;
    });
  }
  function commit(newInningState, extra, force) {
    const updated = {
      ...match,
      innings: match.innings.map((inn, i) => i === inningIdx ? newInningState : inn)
    };
    checkInningEnd(updated, force);
    setMatch(updated);
    queueSave(updated);
    setDismissedCapRetireFor(null);
    // Queue every milestone that's new on this ball — see the milestoneQueue-draining effect
    // above for why this doesn't just set milestoneToast directly (a single ball can produce more
    // than one, and only showing the last one silently dropped the rest from the toast). Includes
    // both the permanent (scorecard-logged) milestones and the toast-only ones (team totals,
    // maiden overs, ducks) — same toast treatment, they just don't get written to the scorecard.
    const newMilestones = newInningState.milestones.slice((inning.milestones || []).length);
    const newToastMilestones = (newInningState.toastMilestones || []).slice((inning.toastMilestones || []).length);
    if (newMilestones.length > 0 || newToastMilestones.length > 0) {
      setMilestoneQueue(q => [...q, ...newMilestones, ...newToastMilestones]);
    }
  }
  async function handleGetCode() {
    if (match.shareCode) return {
      ok: true
    };
    const updated = {
      ...match,
      shareCode: genMatchCode()
    };
    setMatch(updated);
    const result = await queueSave(updated);
    if (result.ok) {
      return {
        ok: true,
        code: updated.shareCode
      };
    }
    return {
      ok: false,
      error: result.error || "This match changed on another device \u2014 resolve that before sharing a code."
    };
  }
  async function handleGetViewCode() {
    if (match.viewCode) return {
      ok: true
    };
    const updated = {
      ...match,
      viewCode: genMatchCode()
    };
    setMatch(updated);
    const result = await queueSave(updated);
    if (result.ok) {
      return {
        ok: true,
        code: updated.viewCode
      };
    }
    return {
      ok: false,
      error: result.error || "This match changed on another device \u2014 resolve that before sharing a link."
    };
  }
  function checkInningEnd(updated, force) {
    const inn = updated.innings[updated.currentInningIndex];
    // Revised values (see declareRevisedTarget) only ever apply to innings 2 -- a rain
    // interruption mid-chase doesn't retroactively change what innings 1 already scored or how
    // many overs it played, only what innings 2 is now trying to reach. Falls back to the
    // original oversLimit/target whenever no revision has been made, so this is a no-op for every
    // match that never uses the feature at all.
    const effectiveOversLimit = updated.currentInningIndex === 1 && updated.revisedOvers != null ? updated.revisedOvers : updated.oversLimit;
    const oversDone = inn.legalBalls >= effectiveOversLimit * (inn.ballsPerOver || 6);
    // Was hardcoded to a fixed 10 (2 for Super Over) — now uses the batting team's actual XI size,
    // so a 9-a-side match correctly goes all out on the 8th wicket instead of letting the innings
    // (and needsNewBatsman below) run all the way to a 10th wicket nobody's roster has.
    const allOut = inn.wickets >= maxWicketsFor(updated, inn);
    const effectiveTarget = updated.currentInningIndex === 1 && updated.revisedTarget != null ? updated.revisedTarget : updated.innings[0].runs + 1;
    const chaseWon = updated.currentInningIndex === 1 && inn.runs >= effectiveTarget;
    if (force || oversDone || allOut || chaseWon) {
      inn.complete = true;
      // The pair still at the crease when the innings ends (declared, overs ran out, or the
      // chase was won) never goes through applyBall's wicket-triggered partnership push, since no
      // wicket actually fell to end their stand -- it's still open, just cut short by the innings
      // itself finishing. Recorded here as unbeaten so it can still show up in the Record Book;
      // skipped when allOut, since the innings' last wicket already pushed that exact stand
      // (unbeaten: false) moments ago in applyBall, and skipped entirely if nobody's actually at
      // the crease together yet (e.g. force-ending before a second batsman ever arrived).
      //
      // Also guarded against re-recording the SAME stand a second time: "Fix a mistake" can
      // reopen an already-complete innings (inn.complete back to false, see reopenLastInnings),
      // and if it's then force-ended again with no new ball actually scored in between -- nothing
      // about strikerName/nonStrikerName/partnershipRuns/partnershipBalls would have changed, so
      // without this check the exact same unbeaten partnership would land in the array twice.
      const lastPartnership = inn.partnerships && inn.partnerships[inn.partnerships.length - 1];
      const alreadyRecorded = lastPartnership && lastPartnership.unbeaten && lastPartnership.batter1 === inn.strikerName && lastPartnership.batter2 === inn.nonStrikerName && lastPartnership.wicket === inn.wickets + 1;
      if (!allOut && !alreadyRecorded && inn.strikerName && inn.nonStrikerName && ((inn.partnershipRuns || 0) > 0 || (inn.partnershipBalls || 0) > 0)) {
        inn.partnerships = [...(inn.partnerships || []), {
          batter1: inn.strikerName,
          batter2: inn.nonStrikerName,
          runs: inn.partnershipRuns || 0,
          balls: inn.partnershipBalls || 0,
          wicket: inn.wickets + 1,
          unbeaten: true
        }];
      }
      if (updated.currentInningIndex === 0) {
        updated.currentInningIndex = 1;
        updated.innings[1] = newInning(inn.bowlingTeam, inn.battingTeam, {
          ballsPerOver: inn.ballsPerOver,
          wideRuns: inn.wideRuns,
          noballRuns: inn.noballRuns,
          freeHit: inn.freeHitEnabled,
          // Carry the rest of the house rules over too — these used to get silently dropped for
          // the 2nd innings (e.g. a configured time cap would vanish the moment the break hit).
          maxOversPerBowler: inn.maxOversPerBowler,
          powerplayOvers: inn.powerplayOvers,
          timeCapMinutes: inn.timeCapMinutes,
          wideNoballCountsAsBall: inn.wideNoballCountsAsBall
        }, updated.isSuperOver ? 2 : battingTeamXISize(updated, inn.bowlingTeam) - 1, updated.oversLimit);
        updated.awaitingSecondInningsSetup = true;
      } else {
        updated.status = "complete";
      }
    }
  }
  function handleRun(n, overthrow, shortRun) {
    pushHistory();
    commit(applyBall(inning, {
      kind: "run",
      runs: n,
      overthrow: overthrow || undefined,
      shortRun: shortRun || undefined
    }));
    setShowRuns(false);
    if (n === 4 || n === 6) {
      const key = Date.now();
      setCelebration({
        type: n,
        key
      });
      setTimeout(() => {
        setCelebration(c => c && c.key === key ? null : c);
      }, 1000);
    }
  }
  // The 0/1/2/3/4/6 (and 0-4 on extras) buttons cover the vast majority of deliveries, but an
  // overthrow can push a ball's total past what any of those cover — e.g. a single completed plus
  // a misfield running away for four more, or three run plus an overthrown boundary. This is the
  // escape hatch for those: still commits through the exact same handleRun/handleExtra path as the
  // preset buttons, just built from two typed-in numbers (what the batsmen actually ran, and the
  // overthrow bonus on top) instead of one flat total — so the ball-by-ball log can show "2+1"
  // rather than a bare "3" that gives no hint an overthrow happened. A short run (the batsmen
  // attempted more, but one of them didn't make their ground before turning) is a variant of the
  // exact same problem — the quick-pick buttons have no way to say "they ran for 3 but only 2
  // count" either — so it lives in this same modal rather than a separate one: deducted from the
  // completed/running portion specifically, never the overthrow bonus (a short run only happens
  // during active running between the wickets, an overthrow is what happens to the ball
  // afterwards, so the two are independent even on the rare ball that somehow has both).
  function confirmCustomRuns() {
    const completed = parseInt(customRunsCompleted, 10) || 0;
    const overthrow = parseInt(customOverthrow, 10) || 0;
    const rawTotal = completed + overthrow;
    const total = customShortRun ? Math.max(0, rawTotal - 1) : rawTotal;
    if (total < 0 || total > 24 || overthrow < 0) return;
    if (customRunsFor === "run") {
      handleRun(total, overthrow, customShortRun);
    } else {
      handleExtra(customRunsFor, total, overthrow, customShortRun);
    }
    setCustomRunsFor(null);
    setCustomRunsCompleted("");
    setCustomOverthrow("");
    setCustomShortRun(false);
  }
  function handleExtra(kind, n, overthrow, shortRun) {
    pushHistory();
    commit(applyBall(inning, {
      kind,
      runs: n,
      overthrow: overthrow || undefined,
      shortRun: shortRun || undefined
    }));
    setShowExtra(null);
    if (kind === "noball" && (n === 4 || n === 6)) {
      const key = Date.now();
      setCelebration({
        type: n,
        key
      });
      setTimeout(() => {
        setCelebration(c => c && c.key === key ? null : c);
      }, 1000);
    }
  }
  function handlePenalty() {
    // Penalty runs are always exactly 5 (Laws 41/42) and, in the common case this covers, go to
    // the batting side. Not tied to a delivery — no ball consumed, no bowler/batsman impact — but
    // still logged to inning.penalties (see applyBall) so it shows up as a traceable event on the
    // scorecard instead of just silently moving the total.
    pushHistory();
    commit(applyBall(inning, {
      kind: "penalty",
      runs: 5
    }));
    setShowExtra(null);
  }
  // Same one-second pop used for boundaries, in the wicket-red palette — see BallCelebration.
  // Called right after commit() at each of the three places a wicket ball actually lands (plain
  // wicket, caught-with-fielder, and the "new batsman entered" step that finalizes a pending
  // wicket) rather than at the moment the wicket TYPE is picked, since that's often not the final
  // commit (catches wait on a fielder name, non-last wickets wait on the next batsman).
  function celebrateWicket() {
    const key = Date.now();
    setCelebration({
      type: "wicket",
      key
    });
    setTimeout(() => {
      setCelebration(c => c && c.key === key ? null : c);
    }, 1000);
  }
  function handleWicket(wicketType) {
    // Same bug class as checkInningEnd's allOut / needsNewBatsman / applyBall's over-completion
    // check — was hardcoded to `+ 1 >= 10`, so a 9-a-side match's real last wicket (the 8th) still
    // fell through to the "who's the new batsman?" prompt below instead of ending the innings
    // immediately, since 9 >= 10 is false. maxWicketsFor reads the actual roster-based threshold.
    const isLast = inning.wickets + 1 >= maxWicketsFor(match, inning);
    // Only these three ever have anything to actually configure: Caught needs a fielder, Run out
    // needs the fielder/runs/ball-type picker, Stumped needs the fair/wide ball-type pick. Bowled,
    // LBW, and Hit wicket are a dead ball the instant they happen — nothing to fill in, so they
    // stay a single tap rather than adding a details step with nothing in it.
    const needsDetails = wicketType === "Caught" || wicketType === "Stumped" || wicketType === "Run out";
    if (needsDetails) {
      setShowWicket(false);
      setWicketDraft({
        wicketType,
        isLast,
        // Whoever's actually facing this ball, snapshotted now, before the popup can touch
        // strikerName at all. Needed because Swap Strike (available below, for the non-striker-
        // run-out case) commits immediately and for real — by the time Confirm is tapped,
        // inning.strikerName may no longer be the batsman who hit the ball, only whoever ends up
        // recorded as out. Runs completed before a run out (see runsDraft/confirmWicketDetails)
        // need to stay with the batsman who actually ran for them regardless of which end the
        // wicket falls at, so this is what applyBall's runsCreditTo credits them against instead
        // of just trusting cur.strikerName at commit time.
        strikerAtBallStart: inning.strikerName
      });
      setRunsDraft(0);
      // Most catches are taken by the keeper — pre-fill it as a starting point, still fully
      // editable via the PlayerPicker below for the (common enough) catch taken elsewhere. Run
      // out doesn't have an equivalent default fielder, so that field starts blank for it.
      setFielderDraftName(wicketType === "Caught" ? keeperFor(match, inning.bowlingTeam) : "");
      setWicketExtraKind(null);
      return;
    }
    pushHistory();
    if (isLast) {
      commit(applyBall(inning, {
        kind: "wicket",
        wicketType,
        legal: true,
        newBatsman: ""
      }));
      celebrateWicket();
      setShowWicket(false);
    } else {
      setShowWicket(false);
      setPendingWicket({
        kind: "wicket",
        wicketType,
        legal: true
      });
      celebrateWicket();
    }
  }
  const [pendingWicket, setPendingWicket] = useState(null);
  // The player who retired hurt to open the "Next batsman" slot currently waiting to be filled —
  // cleared the moment any batsman is confirmed into that slot. Its only job is stopping that same
  // player from selecting themselves straight back in on the very prompt their own retirement just
  // opened, since the Laws only let a retired-hurt batsman resume once the side has lost another
  // wicket in the meantime — not blocking them from EVER coming back (see the picker's excludeList
  // near the Next batsman modal, and retireBatsman below).
  const [justRetiredName, setJustRetiredName] = useState(null);
  const [wicketDraft, setWicketDraft] = useState(null); // {wicketType, isLast} — waiting on details
  const [fielderDraftName, setFielderDraftName] = useState("");
  // Runs actually completed by running before the wicket fell — only ever nonzero for Run out (see
  // confirmWicketDetails), since every other dismissal is a dead ball the instant it happens.
  const [runsDraft, setRunsDraft] = useState(0);
  // Only meaningful for Run out/Stumped: null = fair ball (the default and by far the common
  // case), "wide"/"noball" = the ball is ALSO an extra, credited alongside the dismissal in
  // applyBall (see event.extraKind there) rather than needing a separate action.
  const [wicketExtraKind, setWicketExtraKind] = useState(null);
  // Whether the pairing for the NEXT ball will come out backwards once this wicket is confirmed —
  // traced through the actual crease positions for all four combinations of even/odd runs
  // completed × whether Swap Strike was used (to mark the non-striker as the one actually out)
  // rather than the striker themselves being out:
  //   - even runs + no swap (the default case, striker themselves given out) -> BACKWARDS
  //   - odd runs + no swap -> correct as-is
  //   - even runs + swap used -> correct as-is
  //   - odd runs + swap used (the non-striker-run-out case) -> BACKWARDS
  // An earlier version of this warning only checked "odd runs" — which caught the swap case but
  // completely missed the even-runs, no-swap case, actually the MORE common one (most run outs
  // involve the striker themselves, with 0 or 2 runs already completed).
  const wasSwapped = wicketDraft && wicketDraft.strikerAtBallStart !== inning.strikerName;
  const riskOfWrongPairing = wicketDraft && (runsDraft % 2 === 0) !== wasSwapped;
  function confirmWicketDetails(nameOverride) {
    const {
      wicketType,
      isLast,
      strikerAtBallStart
    } = wicketDraft;
    const name = (nameOverride !== undefined ? nameOverride : fielderDraftName).trim();
    // A catch always has exactly one known taker, so the name is required. A run out's fielder
    // can genuinely be unclear in the moment (direct hit, relay throw) — that one's skippable, so
    // this only blocks Confirm for Caught, matching the disabled state on the button above.
    if (wicketType === "Caught" && !name) return;
    const canBeExtra = wicketType === "Run out" || wicketType === "Stumped";
    // No-ball nullifies every dismissal except Run out per the Laws — the UI already only offers
    // that option for Run out, but guard here too so a stale draft can never produce an invalid
    // "st ... (no ball)" record if this ever gets called from somewhere that skips the picker.
    const extraKind = canBeExtra ? wicketType === "Stumped" && wicketExtraKind === "noball" ? "wide" : wicketExtraKind || undefined : undefined;
    // The ball is dead the instant every dismissal except Run out happens — Bowled/LBW/Hit wicket
    // immediately; Caught the moment the ball's held (runs already crossed for don't count, per
    // the Laws); Stumped by definition means no run was in progress at all. A run out is the only
    // one where the pair can genuinely be mid-run when the wicket falls, so this is guarded here
    // too, on top of the picker only rendering for Run out above.
    const runsBeforeWicket = wicketType === "Run out" ? Math.max(0, runsDraft || 0) : 0;
    const payload = {
      kind: "wicket",
      wicketType,
      // A dismissal on an ordinary delivery is always legal. On a wide/no-ball, whether it's legal
      // follows the exact same wideNoballCountsAsBall/final-over rule as a plain wide/no-ball ball
      // — isWideNoballLegal is the single source of truth for that, so this can't drift out of sync
      // with the plain-ball branches in applyBall.
      legal: extraKind == null ? true : isWideNoballLegal(inning),
      extraKind,
      runsBeforeWicket,
      // Stays with whoever actually faced the ball even if Swap Strike was used in this same
      // popup to correctly mark the OTHER end as the one run out — see the comment on
      // strikerAtBallStart in handleWicket above.
      runsCreditTo: strikerAtBallStart,
      fielderName: name || undefined
    };
    if (isLast) {
      pushHistory();
      commit(applyBall(inning, {
        ...payload,
        newBatsman: ""
      }));
      celebrateWicket();
    } else {
      setPendingWicket(payload);
      celebrateWicket();
    }
    setWicketDraft(null);
    setFielderDraftName("");
    setRunsDraft(0);
    setWicketExtraKind(null);
  }
  function confirmNewBatsman() {
    if (!newBatsmanName.trim()) return;
    if (pendingWicket) {
      pushHistory();
      // Spread pendingWicket wholesale instead of naming each field individually — the field list
      // has grown twice already (fielderName, then extraKind/runsBeforeWicket) and each time meant
      // finding and updating both this call site and endInningEarly's matching one. Spreading means
      // any future field pendingWicket gains just flows through automatically.
      commit(applyBall(inning, {
        ...pendingWicket,
        newBatsman: newBatsmanName.trim()
      }));
      setPendingWicket(null);
    } else {
      const updated = {
        ...inning,
        strikerName: newBatsmanName.trim()
      };
      ensureBatsman(updated, updated.strikerName);
      commit(updated);
    }
    setJustRetiredName(null);
    setNewBatsmanName("");
  }
  // A player who never actually reaches the crease -- given out for failing to be ready within the
  // rule's time limit, before facing a ball. Structurally closer to retireBatsman's "out" branch
  // than to applyBall's wicket handling: no ball is bowled for this, so it's built directly rather
  // than going through applyBall, same reasoning as retireBatsman. Deliberately does NOT set
  // strikerName -- they were never actually in, so needsNewBatsman stays true and the same prompt
  // reopens asking who's coming in next, exactly as if this player had simply never been offered.
  // If a wicket is still pending (this player was named as the new batsman right after a dismissal,
  // and THEY were the one not ready), that pending wicket is resolved first with no one taking
  // strike (applyBall tolerates newBatsman: "" -- see its wicket branch), merged into the same
  // single commit rather than two, so undo/history stays one step per real event.
  function timedOutBatsman(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    pushHistory();
    const base = pendingWicket ? applyBall(inning, {
      ...pendingWicket,
      newBatsman: ""
    }) : inning;
    if (pendingWicket) setPendingWicket(null);
    const updated = {
      ...base,
      batsmen: {
        ...base.batsmen,
        [trimmed]: {
          runs: 0,
          balls: 0,
          out: true,
          how: "Timed out",
          fours: 0,
          sixes: 0
        }
      },
      battingOrder: base.battingOrder.includes(trimmed) ? base.battingOrder : [...base.battingOrder, trimmed],
      wickets: base.wickets + 1,
      fallOfWickets: [...base.fallOfWickets, {
        score: base.runs,
        wicket: base.wickets + 1,
        over: oversLabel(base.legalBalls, base.ballsPerOver),
        batsman: trimmed
      }]
    };
    commit(updated);
    setNewBatsmanName("");
  }
  // null | "stuck" (no batsman available to fill the slot) | "voluntary" (chosen to close the
  // innings out early with play still otherwise able to continue — weather, time, a forfeit, a
  // hopeless mismatch). Both funnel into the same endInningEarly below; this only decides which
  // confirmation wording is shown, since "stuck" implies you have no other option and "voluntary"
  // implies you do.
  const [endInningTrigger, setEndInningTrigger] = useState(null);
  const [confirmNoResult, setConfirmNoResult] = useState(false);
  // Separate from confirmNoResult's own confirmation modal deliberately -- this is a lighter,
  // first tap of friction before reaching either End innings or Abandon match at all, not a
  // replacement for the "are you sure" step each of them already has. Swap Strike and Retire stay
  // as direct one-tap buttons right in this card, since both are routine, about the two batsmen
  // shown right there, and safe to reach quickly -- End innings and Abandon match are neither: one
  // ends the whole current innings regardless of who's batting, the other ends the entire match,
  // and both deserve more distance from a row a scorer is tapping mid-over than a same-row,
  // same-size button gave them.
  const [showMatchMenu, setShowMatchMenu] = useState(false);
  // Only meaningful during innings 2 (isChasing) -- a revised target/overs (rain mid-chase, short
  // of full DLS) adjusts what team 2 is trying to reach, not team 1's already-played innings.
  const [showRevisedTargetModal, setShowRevisedTargetModal] = useState(false);
  const [revisedTargetInput, setRevisedTargetInput] = useState("");
  const [revisedOversInput, setRevisedOversInput] = useState("");
  // DLS-assisted mode for the same modal — off by default, preserving the plain manual-entry flow
  // this already had. r1Override is blank by default (auto-computed); typing in it is only meant
  // for the rarer case where TEAM 1's own innings was also rain-interrupted, which this app has no
  // structured interruption log for (see declareDLSRevisedTarget's own comment).
  const [dlsMode, setDlsMode] = useState(false);
  const [dlsR1Override, setDlsR1Override] = useState("");
  // G50 defaults to whatever was actually used for this match's last DLS revision, if there was
  // one (match.dlsG50, set by declareDLSRevisedTarget) -- not a hardcoded "200" every time. A
  // second rain interruption reopening this panel after the app was closed/reopened should use
  // the SAME G50 as the first, not silently fall back to the generic default and produce an
  // inconsistent target across two revisions of the same match.
  const [dlsG50Input, setDlsG50Input] = useState(String(match.dlsG50 || 200));
  const [revisedTargetError, setRevisedTargetError] = useState("");
  const [showRetireModal, setShowRetireModal] = useState(false);
  // Ends the innings right now regardless of overs/wickets remaining (checkInningEnd's `force`
  // param — see there). Reachable two ways: the "stuck, no batsman available" fallback inside the
  // Next batsman modal (an injury, a forfeit, a squad smaller than recorded at match start), or
  // voluntarily at any point during normal play from the main scoring screen. Not reversible the
  // way a single ball is via Undo, hence the confirmation gate either way.
  function endInningEarly() {
    pushHistory();
    if (pendingWicket) {
      commit(applyBall(inning, {
        ...pendingWicket,
        newBatsman: ""
      }), undefined, true);
      setPendingWicket(null);
    } else {
      commit(inning, undefined, true);
    }
    setJustRetiredName(null);
    setNewBatsmanName("");
    setEndInningTrigger(null);
  }
  // Ends the WHOLE match immediately, in either innings, with no winner at all -- rain or bad light
  // permanently stopping play too early for a fair result, distinct from endInningEarly (which
  // ends the current innings but the match still continues to a normal result, whether that's
  // moving to innings 2 or computing who won). Deliberately bypasses checkInningEnd entirely rather
  // than reusing it with some new flag -- checkInningEnd's whole job is deciding what happens NEXT
  // (innings 2 setup, or a winner), and a no-result has no "next", just an immediate, direct
  // status: "complete". No automatic detection of when this is appropriate (a genuine minimum-overs
  // threshold varies by competition and isn't something this app models) -- this is entirely the
  // scorer's own judgment call, same reasoning as endInningEarly already being a judgment call
  // rather than something the app tries to infer on its own.
  function declareNoResult() {
    pushHistory();
    const updated = {
      ...match,
      status: "complete",
      noResult: true
    };
    setMatch(updated);
    queueSave(updated);
    setConfirmNoResult(false);
  }
  // Sets match.revisedTarget/revisedOvers directly on the match, same "just overwrite it, this
  // isn't tied to the ball-by-ball pipeline" shape as declareNoResult -- checkInningEnd, the live
  // target/RRR display, matchResultText, and computeStandings' NRR calculation all already fall
  // back to these two fields wherever they'd otherwise use i1.runs + 1 / match.oversLimit for
  // innings 2 (see each of those for the full reasoning). Calling this again later in the same
  // chase (a second rain interruption) just overwrites the previous revision -- there's no cap on
  // how many times it can be adjusted, the same way real rain-affected matches sometimes need more
  // than one revision. No attempt at real DLS math here, deliberately -- this is for whatever
  // number the two captains/organizers have actually agreed on, not a calculated par score.
  function declareRevisedTarget() {
    const newTarget = parseInt(revisedTargetInput, 10);
    const newOvers = parseFloat(revisedOversInput);
    const oversAlreadyBowled = inning.legalBalls / (inning.ballsPerOver || 6);
    if (!newTarget || newTarget < 1) {
      setRevisedTargetError("Enter a target of at least 1 run.");
      return;
    }
    if (!newOvers || newOvers <= 0) {
      setRevisedTargetError("Enter the new overs limit.");
      return;
    }
    if (newOvers < oversAlreadyBowled) {
      setRevisedTargetError(`Can't be fewer than the ${oversLabel(inning.legalBalls, inning.ballsPerOver)} overs already bowled.`);
      return;
    }
    if (newOvers > match.oversLimit) {
      setRevisedTargetError(`Can't be more than the original ${match.oversLimit}-over limit.`);
      return;
    }
    pushHistory();
    const updated = {
      ...match,
      revisedTarget: newTarget,
      revisedOvers: newOvers
    };
    setMatch(updated);
    queueSave(updated);
    setShowRevisedTargetModal(false);
    setRevisedTargetInput("");
    setRevisedOversInput("");
    setRevisedTargetError("");
  }
  // Live preview only — recomputed on every render from current input state (cheap enough not to
  // need memoizing). Returns null while inputs are incomplete rather than showing a stale number.
  //
  // R1 defaults to Team 1's resource for the full original oversLimit at 0 wickets, i.e. an
  // uninterrupted innings — correct for the common case this feature already targets ("Revise
  // target" only ever appears once Team 1's innings is over, so R1 doesn't need live tracking the
  // way R2 does). If Team 1's OWN innings was also rain-interrupted, that's the one case this
  // panel doesn't compute for automatically — dlsR1Override lets the scorer type the correct R1
  // directly rather than the panel silently assuming an uninterrupted innings that didn't happen.
  //
  // R2 tracks resource LOST by this specific interruption (resource remaining right now, at the
  // moment of stopping, minus resource remaining under the new overs limit) and subtracts that
  // from match.dlsR2Available — a running total carried on the match so a second, third, etc.
  // interruption during the same chase correctly compounds instead of recomputing from scratch
  // each time. Initialized the first time this panel is used to Team 2's starting resource for the
  // original oversLimit at 0 wickets, matching §5.4 of the ICC regulations.
  function computeDLSPreview() {
    const newOvers = parseFloat(revisedOversInput);
    const G50 = parseFloat(dlsG50Input);
    if (!newOvers || newOvers <= 0 || !G50 || G50 <= 0) return null;
    const effectiveOversLimit = match.revisedOvers != null ? match.revisedOvers : match.oversLimit;
    const oversAtInterruption = oversLeftTrueDecimal(effectiveOversLimit, inning.legalBalls);
    const oversAtResumption = oversLeftTrueDecimal(newOvers, inning.legalBalls);
    const currentWickets = inning.wickets;
    const resourceAtInterruption = dlsResourcePercent(oversAtInterruption, currentWickets);
    const resourceAtResumption = dlsResourcePercent(oversAtResumption, currentWickets);
    const resourceLost = resourceAtInterruption - resourceAtResumption;
    const priorR2 = match.dlsR2Available != null ? match.dlsR2Available : dlsResourcePercent(match.oversLimit, 0);
    const R2 = Math.max(0, priorR2 - resourceLost);
    const R1 = dlsR1Override.trim() ? parseFloat(dlsR1Override) : dlsResourcePercent(match.oversLimit, 0);
    if (!R1 || R1 <= 0) return null;
    const S = match.innings[0].runs;
    const {
      target,
      par
    } = dlsTarget(S, R1, R2, G50);
    return {
      target,
      par,
      R1,
      R2,
      resourceLost
    };
  }
  function declareDLSRevisedTarget() {
    const newOvers = parseFloat(revisedOversInput);
    const oversAlreadyBowled = inning.legalBalls / (inning.ballsPerOver || 6);
    const preview = computeDLSPreview();
    if (!preview) {
      setRevisedTargetError("Enter the new overs limit (and check G50) to calculate.");
      return;
    }
    if (newOvers < oversAlreadyBowled) {
      setRevisedTargetError(`Can't be fewer than the ${oversLabel(inning.legalBalls, inning.ballsPerOver)} overs already bowled.`);
      return;
    }
    if (newOvers > match.oversLimit) {
      setRevisedTargetError(`Can't be more than the original ${match.oversLimit}-over limit.`);
      return;
    }
    pushHistory();
    const updated = {
      ...match,
      revisedTarget: preview.target,
      revisedOvers: newOvers,
      dlsR2Available: preview.R2,
      dlsG50: parseFloat(dlsG50Input)
    };
    setMatch(updated);
    queueSave(updated);
    setShowRevisedTargetModal(false);
    setRevisedTargetInput("");
    setRevisedOversInput("");
    setRevisedTargetError("");
    setDlsMode(false);
    setDlsR1Override("");
  }
  function confirmNewBowler() {
    if (!newBowlerName.trim()) return;
    const updated = {
      ...inning,
      bowlerName: newBowlerName.trim()
    };
    ensureBowler(updated, updated.bowlerName);
    commit(updated);
    setNewBowlerName("");
    setNewBowlerPrompt(false);
  }
  function undo() {
    if (history.length === 0) return;
    // The history snapshot was taken before the ball being undone, so its own writeSeq is one
    // behind whatever this device most recently confirmed with the server. Reverting the ball
    // data but keeping the CURRENT writeSeq as the expected baseline is what's actually correct
    // here: this device is the sole author of that latest confirmed write, so its own writeSeq
    // is the right thing to check the undo against — using the stale snapshot's seq instead would
    // make every undo spuriously look like a conflict with another device. queueSave reads
    // writeSeqRef itself, so the prev object's own writeSeq field here doesn't matter.
    const prev = {
      ...history[history.length - 1],
      writeSeq: match.writeSeq
    };
    setHistory(h => {
      const next = h.slice(0, -1);
      saveUndoHistory(match.id, next);
      return next;
    });
    setMatch(prev);
    queueSave(prev);
  }
  function swapStrike() {
    if (!inning.strikerName || !inning.nonStrikerName) return;
    pushHistory();
    const updated = {
      ...inning,
      strikerName: inning.nonStrikerName,
      nonStrikerName: inning.strikerName
    };
    commit(updated);
  }
  // Retiring isn't a delivery — no ball is bowled, no bowler is credited or debited, over/ball
  // counts don't move — so this bypasses the ball-event reducer entirely and mutates the inning
  // directly, same pattern as swapStrike above. Scoped to the ON-STRIKE batsman only, matching
  // this app's existing wicket model (every dismissal branch in the ball reducer already assumes
  // it's always the striker's slot that empties, including run-outs — see dismissedName there);
  // swap strike first if it's actually the non-striker who needs to leave.
  // "Retired hurt" is genuinely not out — wickets doesn't increment, no fall-of-wickets entry —
  // and reuses the same needsNewBatsman prompt as a real dismissal to get the next batsman in,
  // since one player did just leave the crease either way. They can come back later in the same
  // innings (the Laws allow a fit-again batsman to resume) — see the Next batsman picker's
  // excludeList, which is what makes them selectable again, and ensureBatsman/applyBall's wicket
  // branch, which clear retiredHurt the moment they're actually back at the crease. The one thing
  // deliberately still blocked: coming straight back on the very prompt their own retirement just
  // opened (see justRetiredName) — the Laws only allow resuming once the side's lost another
  // wicket in the meantime, not an immediate self-swap.
  // "Retired out" is treated exactly like any other dismissal (wickets increments, a
  // fall-of-wickets entry is recorded, "retired out" shows wherever a normal "how" would) except
  // no bowler is credited, since nobody dismissed them.
  function retireBatsman(kind) {
    if (!inning.strikerName) return;
    pushHistory();
    const name = inning.strikerName;
    const isOut = kind === "out";
    if (!isOut) setJustRetiredName(name);
    const updatedBatsman = isOut ? {
      ...inning.batsmen[name],
      out: true,
      retiredOut: true,
      how: "retired out"
    } : {
      ...inning.batsmen[name],
      retiredHurt: true,
      retiredAtCap: kind === "cap" ? inning.retirementRuns : false
    };
    const updated = {
      ...inning,
      batsmen: {
        ...inning.batsmen,
        [name]: updatedBatsman
      },
      wickets: isOut ? inning.wickets + 1 : inning.wickets,
      fallOfWickets: isOut ? [...inning.fallOfWickets, {
        score: inning.runs,
        wicket: inning.wickets + 1,
        over: oversLabel(inning.legalBalls, inning.ballsPerOver),
        batsman: name
      }] : inning.fallOfWickets,
      strikerName: "",
      // A retirement ends the current partnership exactly like a wicket does -- whoever comes in
      // next starts a brand new one with the survivor. Without this, applyBall's wicket branch is
      // the ONLY place partnershipRuns/partnershipBalls ever reset (retiring bypasses applyBall
      // entirely, same as swapStrike), so the next pairing would silently inherit the ended
      // partnership's tally on top of its own -- contaminating the 50/100 partnership milestone
      // and the Breakthrough toast with runs/balls that belonged to the batsman who just left.
      // Same reasoning extends to the persisted partnerships list (see newInning) -- this stand
      // is over the moment either partner leaves, retired hurt or not, so it's recorded here too,
      // never as unbeaten (that's reserved for a pair still together when the INNINGS ends).
      partnerships: inning.nonStrikerName ? [...(inning.partnerships || []), {
        batter1: name,
        batter2: inning.nonStrikerName,
        runs: inning.partnershipRuns || 0,
        balls: inning.partnershipBalls || 0,
        wicket: inning.wickets + 1,
        unbeaten: false
      }] : inning.partnerships || [],
      partnershipRuns: 0,
      partnershipBalls: 0
    };
    setShowRetireModal(false);
    commit(updated);
  }

  // First innings setup (openers + bowler) — only ever true for a freshly-created Super Over
  // match; a normal match already collects its openers in SetupScreen before the match exists.
  if (match.awaitingFirstInningsSetup) {
    return /*#__PURE__*/React.createElement(SuperOverOpenersSetup, {
      match: match,
      setMatch: setMatch
    });
  }
  // Second innings setup (openers + bowler)
  if (match.awaitingSecondInningsSetup) {
    return /*#__PURE__*/React.createElement(SecondInningsSetup, {
      match: match,
      setMatch: setMatch
    });
  }
  if (match.status === "complete") {
    return /*#__PURE__*/React.createElement(ResultScreen, {
      match: match,
      setMatch: setMatch,
      onExit: onExit
    });
  }
  // Doesn't include Timed out -- unlike every other dismissal here, it isn't tied to a delivery at
  // all (the incoming batsman simply never arrives within the time limit), so it doesn't fit this
  // list or the "tap Wicket during a live ball" flow the rest of this screen is built around. It
  // would need its own entry point (something offered alongside picking the next batsman's name,
  // not a wicket type chosen mid-delivery) to be represented properly rather than shoehorned in
  // here -- and given it's arguably the rarest dismissal in the sport's history, not worth that
  // dedicated flow for what this app is actually used for.
  const allWicketTypes = ["Bowled", "Caught", "LBW", "Stumped", "Hit wicket", "Run out", "Hit the ball twice", "Obstructing the field"];
  const wicketTypes = inning.freeHitActive ? ["Run out"] : allWicketTypes;
  const dlsPreview = showRevisedTargetModal && dlsMode ? computeDLSPreview() : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: padCollapsed ? 40 : 118,
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement(BallCelebration, {
    celebration: celebration
  }), /*#__PURE__*/React.createElement(MilestoneToast, {
    toast: milestoneToast
  }), (qualResult || qualPending) && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "8px 12px 0",
      padding: "8px 12px",
      borderRadius: 10,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.4,
      background: qualPending ? "rgba(184,137,43,0.12)" : qualResult.achievable ? "rgba(74,124,46,0.12)" : "rgba(139,30,30,0.1)",
      color: qualPending ? "#8a641f" : qualResult.achievable ? COLORS.turf : COLORS.ball
    }
  }, qualPending ? `NRR target vs ${qualScenario.rivalTeam}: locks in once this innings ends.` : !qualResult.achievable ? `Even the best result here won't get ${qualMyTeam} past ${qualScenario.rivalTeam} on NRR.` : qualResult.kind === "restrict" ? `For NRR vs ${qualScenario.rivalTeam}: restrict them to ${Math.max(0, qualResult.maxConcede)} or fewer.` : qualResult.anyWinWorks ? `For NRR vs ${qualScenario.rivalTeam}: any win gets you there.` : `For NRR vs ${qualScenario.rivalTeam}: chase it down within ${decimalOversToLabel(qualResult.maxOversExact, inning.ballsPerOver || 6)} overs.`), /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(160deg, ${COLORS.turfFixed} 0%, ${COLORS.pitchFixed} 45%, ${COLORS.pitchDarkFixed} 100%)`,
      padding: "16px 16px 22px",
      color: COLORS.creamFixed,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0.5,
      pointerEvents: "none",
      background: "radial-gradient(circle at 15% 0%, rgba(255,255,255,0.10), transparent 55%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      opacity: 0.85,
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
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowScorecard(true),
    className: "cs-btn",
    title: "Scorecard",
    "aria-label": "Scorecard",
    style: {
      background: "rgba(242,236,217,0.14)",
      border: `1px solid rgba(242,236,217,0.35)`,
      borderRadius: 8,
      color: COLORS.creamFixed,
      cursor: "pointer",
      width: 38,
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Table2, {
    size: 17
  })), /*#__PURE__*/React.createElement(ShareMenu, {
    match: match,
    onGetCode: handleGetCode,
    onGetViewCode: handleGetViewCode
  }), /*#__PURE__*/React.createElement(ExportPdfButton, {
    match: match
  }))), pendingCount > 0 && /*#__PURE__*/React.createElement(SyncStatusBanner, {
    count: pendingCount,
    dark: true,
    onSynced: onPendingSynced
  }), match.isSuperOver && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: COLORS.gold,
      marginBottom: 2
    }
  }, "Super Over"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.75,
      marginBottom: 2,
      fontWeight: 600,
      letterSpacing: 0.3
    }
  }, inning.battingTeam.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(OdometerScore, {
    text: `${inning.runs}-${inning.wickets}`,
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      fontSize: 48,
      letterSpacing: -1,
      textShadow: "0 2px 8px rgba(0,0,0,0.2)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 18,
      opacity: 0.75
    }
  }, "(", oversLabel(inning.legalBalls, inning.ballsPerOver), "/", effectiveOversLimit, ")")), isChasing && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "baseline",
      gap: 5,
      marginTop: 7,
      padding: "5px 10px",
      background: "rgba(255,255,255,0.16)",
      borderRadius: 9,
      maxWidth: "100%"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 700,
      color: "#fff"
    }
  }, "Need ", Math.max(runsNeeded, 0), " off ", Math.max(ballsLeft, 0), " ball", Math.max(ballsLeft, 0) === 1 ? "" : "s"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 10.5,
      opacity: 0.75
    }
  }, "(", oversLabel(ballsLeft, inning.ballsPerOver), " ov)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      marginTop: 8,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      opacity: 0.9,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", null, "CRR ", crr(inning.runs, inning.legalBalls, inning.ballsPerOver)), isChasing && /*#__PURE__*/React.createElement("span", null, "RRR ", reqRate), /*#__PURE__*/React.createElement(InningsTimer, {
    startedAt: inning.startedAt,
    overCap: isOverTimeCap(inning)
  }), isOverTimeCap(inning) && /*#__PURE__*/React.createElement("span", {
    style: {
      background: "rgba(244,185,66,0.22)",
      border: "1px solid rgba(244,185,66,0.55)",
      color: COLORS.gold,
      fontWeight: 700,
      padding: "2px 9px",
      borderRadius: 20,
      letterSpacing: 0.5,
      fontSize: 11.5
    }
  }, "OVER TIME"), inPowerplay(inning) && /*#__PURE__*/React.createElement("span", {
    style: {
      background: "rgba(242,236,217,0.16)",
      border: "1px solid rgba(242,236,217,0.4)",
      color: COLORS.creamFixed,
      fontWeight: 700,
      padding: "2px 9px",
      borderRadius: 20,
      letterSpacing: 0.5,
      fontSize: 11.5
    }
  }, "POWERPLAY"), inning.freeHitActive && /*#__PURE__*/React.createElement("span", {
    style: {
      background: "rgba(242,236,217,0.16)",
      border: "1px solid rgba(242,236,217,0.4)",
      color: COLORS.creamFixed,
      fontWeight: 700,
      padding: "2px 9px",
      borderRadius: 20,
      letterSpacing: 0.5,
      fontSize: 11.5
    }
  }, "FREE HIT")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      margin: "-10px 12px 0",
      borderRadius: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.07), 0 6px 18px rgba(42,36,32,0.06)",
      padding: "14px 14px",
      position: "relative",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: swapStrike,
    disabled: !inning.strikerName || !inning.nonStrikerName,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.gold,
      cursor: !inning.strikerName || !inning.nonStrikerName ? "not-allowed" : "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 2px",
      opacity: !inning.strikerName || !inning.nonStrikerName ? 0.4 : 1
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 12
  }), " Swap Strike"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowRetireModal(true),
    disabled: !inning.strikerName,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: !inning.strikerName ? "not-allowed" : "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      padding: "2px 2px",
      opacity: !inning.strikerName ? 0.4 : 1
    }
  }, "Retire")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowMatchMenu(true),
    className: "cs-btn",
    "aria-label": "Match menu",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: "2px 4px",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(MoreVertical, {
    size: 16
  }))), showMatchMenu && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowMatchMenu(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 18,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "This match"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 14
    }
  }, "Deliberately a step further away than Retire or Swap Strike \u2014 both of these end more than just the current ball, so they get an extra tap before you're even at the \u201care you sure\u201d stage."), isChasing && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setShowMatchMenu(false);
      setRevisedTargetInput(String(target));
      setRevisedOversInput(String(match.revisedOvers != null ? match.revisedOvers : match.oversLimit));
      setRevisedTargetError("");
      setShowRevisedTargetModal(true);
    },
    className: "cs-btn cs-row",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      padding: "12px 10px",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 14,
      color: COLORS.ink
    }
  }, "Revise target"), isChasing && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      padding: "0 10px 10px"
    }
  }, "Rain mid-chase, short of full DLS \u2014 set a new target and overs limit that both sides have agreed on."), isChasing && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.creamDark,
      margin: "2px 0 6px"
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setShowMatchMenu(false);
      setEndInningTrigger("voluntary");
    },
    className: "cs-btn cs-row",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      padding: "12px 10px",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 14,
      color: COLORS.ink
    }
  }, "End innings"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      padding: "0 10px 10px"
    }
  }, "Closes out the current innings early \u2014 bad weather, running out of time, a forfeit, or any other reason to stop here."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.creamDark,
      margin: "2px 0 6px"
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setShowMatchMenu(false);
      setConfirmNoResult(true);
    },
    className: "cs-btn cs-row",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      padding: "12px 10px",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 14,
      color: COLORS.ball
    }
  }, "Abandon match"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      padding: "0 10px"
    }
  }, "Ends the whole match right now, in either innings, with no winner. Use this when there's genuinely no fair way to reach a result.")), showRevisedTargetModal && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowRevisedTargetModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 18,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Revise the target"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "For whatever number both sides have actually agreed on \u2014 not a calculated par score. Can be revised again later if play's interrupted a second time."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 14
    }
  }, [{
    value: false,
    label: "Manual"
  }, {
    value: true,
    label: "Calculate with DLS"
  }].map(o => /*#__PURE__*/React.createElement("button", {
    key: String(o.value),
    type: "button",
    onClick: () => {
      setDlsMode(o.value);
      setRevisedTargetError("");
    },
    className: "cs-btn",
    style: {
      flex: 1,
      padding: "8px 0",
      borderRadius: 10,
      border: "none",
      cursor: "pointer",
      background: dlsMode === o.value ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: dlsMode === o.value ? "#fff" : COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5
    }
  }, o.label))), !dlsMode ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "New target (runs to win)"), /*#__PURE__*/React.createElement(TextField, {
    value: revisedTargetInput,
    onChange: v => setRevisedTargetInput(v.replace(/[^0-9]/g, "").slice(0, 4)),
    placeholder: "e.g. 120",
    inputMode: "numeric",
    style: {
      textAlign: "center",
      fontSize: 18,
      fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace",
      marginBottom: 14
    }
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.cream,
      borderRadius: 10,
      padding: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "G50"), /*#__PURE__*/React.createElement(TextField, {
    value: dlsG50Input,
    onChange: v => setDlsG50Input(v.replace(/[^0-9]/g, "").slice(0, 3)),
    inputMode: "numeric",
    style: {
      textAlign: "center",
      fontSize: 14,
      padding: "7px 8px"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Team 1's R1% (advanced)"), /*#__PURE__*/React.createElement(TextField, {
    value: dlsR1Override,
    onChange: v => setDlsR1Override(v.replace(/[^0-9.]/g, "").slice(0, 5)),
    placeholder: `auto: ${dlsResourcePercent(match.oversLimit, 0).toFixed(1)}`,
    inputMode: "decimal",
    style: {
      textAlign: "center",
      fontSize: 14,
      padding: "7px 8px"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: dlsPreview ? 8 : 0
    }
  }, "G50 is the average 50-over score for this level \u2014 200 is the ICC's own default below full-international/first-class level. Only fill in R1 if Team 1's OWN innings was also rain-interrupted; otherwise leave it on auto."), dlsPreview && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 8,
      padding: "8px 10px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      fontSize: 20,
      color: COLORS.pitch
    }
  }, dlsPreview.target), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.inkSoft
    }
  }, `to win \u00b7 ${dlsPreview.par} to tie \u00b7 R1 ${dlsPreview.R1.toFixed(1)}% \u00b7 R2 ${dlsPreview.R2.toFixed(1)}%`))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "New overs limit"), /*#__PURE__*/React.createElement(TextField, {
    value: revisedOversInput,
    onChange: v => setRevisedOversInput(v.replace(/[^0-9.]/g, "").slice(0, 5)),
    placeholder: `e.g. 15 (currently ${match.revisedOvers != null ? match.revisedOvers : match.oversLimit})`,
    inputMode: "decimal",
    style: {
      textAlign: "center",
      fontSize: 18,
      fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace",
      marginBottom: revisedTargetError ? 8 : 14
    }
  }), revisedTargetError && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 6,
      marginBottom: 14,
      padding: "8px 10px",
      background: "rgba(184,137,43,0.14)",
      border: `1px solid rgba(184,137,43,0.35)`,
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
  }), revisedTargetError), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setShowRevisedTargetModal(false);
      setDlsMode(false);
      setDlsR1Override("");
      setRevisedTargetError("");
    },
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: dlsMode ? declareDLSRevisedTarget : declareRevisedTarget,
    disabled: dlsMode ? !dlsPreview || !revisedOversInput.trim() : !revisedTargetInput.trim() || !revisedOversInput.trim(),
    style: {
      flex: 2
    }
  }, "Set new target"))), [inning.strikerName, inning.nonStrikerName].filter(Boolean).map(name => {
    const b = inning.batsmen[name] || {
      runs: 0,
      balls: 0
    };
    const isStriker = name === inning.strikerName;
    return /*#__PURE__*/React.createElement("div", {
      key: name,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 0",
        fontFamily: "'Inter'"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 14.5,
        fontWeight: isStriker ? 700 : 500,
        color: isStriker ? COLORS.ink : COLORS.inkSoft
      }
    }, isStriker && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: COLORS.gold,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: isStriker ? 0 : 13
      }
    }, numberFor(match, inning.battingTeam, name) && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        fontWeight: 700,
        color: COLORS.turf,
        marginRight: 2
      }
    }, "#", numberFor(match, inning.battingTeam, name)), name, /*#__PURE__*/React.createElement(RoleBadge, {
      isCaptain: name === captainFor(match, inning.battingTeam),
      isKeeper: name === keeperFor(match, inning.battingTeam)
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13.5,
        fontWeight: 600,
        color: COLORS.inkSoft
      }
    }, b.runs, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        opacity: 0.6,
        fontWeight: 400
      }
    }, "(", b.balls, ")")));
  }), inning.strikerName && inning.nonStrikerName && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      padding: "4px 0 2px",
      textAlign: "right"
    }
  }, "Partnership: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink,
      fontWeight: 600
    }
  }, inning.partnershipRuns || 0), " (", inning.partnershipBalls || 0, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.creamDark,
      margin: "9px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "'Inter'"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: COLORS.inkSoft,
      fontWeight: 500
    }
  }, numberFor(match, inning.bowlingTeam, inning.bowlerName) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.turf,
      marginRight: 2
    }
  }, "#", numberFor(match, inning.bowlingTeam, inning.bowlerName)), inning.bowlerName, /*#__PURE__*/React.createElement(RoleBadge, {
    isCaptain: inning.bowlerName === captainFor(match, inning.bowlingTeam),
    isKeeper: inning.bowlerName === keeperFor(match, inning.bowlingTeam)
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13.5,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, inning.bowlers[inning.bowlerName] ? `${oversLabel(inning.bowlers[inning.bowlerName].ballsBowled, inning.ballsPerOver)}-${inning.bowlers[inning.bowlerName].runs}-${inning.bowlers[inning.bowlerName].wickets}` : "-"))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "14px 12px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      marginBottom: 8,
      textTransform: "uppercase"
    }
  }, "Overs"), /*#__PURE__*/React.createElement(OversStrip, {
    overs: inning.overs,
    ballsPerOver: inning.ballsPerOver
  })), !needsNewBatsman && !needsNewBowler && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: COLORS.cream,
      borderRadius: "18px 18px 0 0",
      boxShadow: "0 -6px 24px rgba(42,36,32,0.12)",
      padding: padCollapsed ? "4px 12px calc(4px + env(safe-area-inset-bottom))" : "8px 12px calc(10px + env(safe-area-inset-bottom))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 536,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPadCollapsed(c => !c),
    "aria-label": padCollapsed ? "Show scoring buttons" : "Hide scoring buttons",
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      width: "100%",
      background: "none",
      border: "none",
      padding: padCollapsed ? "6px 0 2px" : "0 0 6px",
      margin: 0,
      cursor: "pointer",
      color: COLORS.inkSoft,
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent"
    }
  }, /*#__PURE__*/React.createElement(ChevronDown, {
    size: 16,
    style: {
      transform: padCollapsed ? "rotate(180deg)" : "none",
      transition: "transform 0.15s ease"
    }
  }), padCollapsed && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600
    }
  }, "Scoring")), !padCollapsed && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 7,
      marginBottom: 7
    }
  }, [0, 1, 2, 3, 4, 6].map(n => /*#__PURE__*/React.createElement(Btn, {
    key: n,
    variant: n === 4 ? "primary" : n === 6 ? "gold" : "default",
    onClick: () => handleRun(n),
    style: {
      minHeight: 40,
      padding: "9px 8px",
      fontSize: 14
    }
  }, n)), /*#__PURE__*/React.createElement(Btn, {
    variant: "default",
    onClick: () => {
      setCustomRunsFor("run");
      setCustomRunsCompleted("");
      setCustomOverthrow("");
    },
    style: {
      minHeight: 40,
      padding: "9px 8px",
      fontSize: 14
    }
  }, "Other"), /*#__PURE__*/React.createElement(Btn, {
    variant: "default",
    onClick: () => setShowExtra("choose"),
    style: {
      minHeight: 40,
      padding: "9px 8px",
      fontSize: 14
    }
  }, "Extra"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => setShowWicket(true),
    style: {
      minHeight: 40,
      padding: "9px 8px",
      fontSize: 14
    }
  }, "Wicket")), /*#__PURE__*/React.createElement(Btn, {
    onClick: undo,
    disabled: history.length === 0,
    style: {
      width: "100%",
      minHeight: 36,
      padding: "8px 12px",
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement(Undo2, {
    size: 14
  }), " Undo last ball")))), (needsNewBatsman || pendingWicket) && /*#__PURE__*/React.createElement(Modal, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, "Next batsman"), /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inning.battingTeam),
    value: newBatsmanName,
    onChange: setNewBatsmanName,
    // Anyone who's out (including retired out) is gone for good, same as anyone currently at the
    // crease already. A retired-hurt batsman IS allowed back in — the Laws let them resume once
    // the side's lost another wicket — except the one who just vacated THIS exact slot (see
    // justRetiredName): resuming has to wait for a wicket to actually fall in the meantime, not be
    // an immediate self-swap on the very prompt their own retirement opened.
    excludeList: Object.keys(inning.batsmen).filter(n => n === justRetiredName || !(inning.batsmen[n].retiredHurt && !inning.batsmen[n].out)),
    // Flags a returning retired-hurt batsman in the picker so they're not indistinguishable from
    // someone who simply hasn't batted yet — easy to conflate otherwise, especially with a near-
    // full roster where most names are legitimately still available.
    noteFor: n => inning.batsmen[n] && inning.batsmen[n].retiredHurt ? "RETURNING" : null,
    placeholder: "Batsman name",
    captain: captainFor(match, inning.battingTeam),
    keeper: keeperFor(match, inning.battingTeam),
    numbers: numbersFor(match, inning.battingTeam)
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !newBatsmanName.trim(),
    onClick: confirmNewBatsman,
    style: {
      width: "100%",
      marginTop: 10
    }
  }, "Confirm"), newBatsmanName.trim() && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => timedOutBatsman(newBatsmanName),
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "center",
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: "8px 4px 0"
    }
  }, `Declare ${newBatsmanName.trim()} Timed Out — not ready in time`), (pendingWicket || history.length > 0) && /*#__PURE__*/React.createElement("button", {
    type: "button",
    // Nothing's actually been committed yet if there's a pendingWicket (the wicket only lands via
    // confirmNewBatsman/endInningEarly, below) — so backing out here is a plain in-memory
    // discard, no history pop needed. If pendingWicket is null but we're still here, the striker
    // slot went empty via an already-committed action (a retired batsman) — that one needs a real
    // undo() to put them back.
    onClick: () => {
      if (pendingWicket) {
        setPendingWicket(null);
      } else {
        undo();
      }
      setNewBatsmanName("");
    },
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
      padding: "10px 4px 0"
    }
  }, /*#__PURE__*/React.createElement(Undo2, {
    size: 13
  }), pendingWicket ? "Cancel this wicket" : "Undo"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setEndInningTrigger("stuck"),
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
      fontSize: 12,
      cursor: "pointer",
      padding: "10px 4px 0",
      textDecoration: "underline"
    }
  }, "No more batsmen \u2014 end the innings here")), endInningTrigger && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "End the innings here?",
    message: endInningTrigger === "stuck" ? "No more batsmen available \u2014 short squad, injury, forfeit, whatever the reason. This ends the innings right now, same as if the side were all out." : "Ends the innings right now, whatever overs or wickets are left \u2014 whoever's currently batting stays not out. Use it for bad weather, running out of time, a forfeit, or any other reason to close it out early.",
    confirmLabel: "End innings",
    onConfirm: endInningEarly,
    onCancel: () => setEndInningTrigger(null)
  }), confirmNoResult && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Abandon this match?",
    message: "Ends the WHOLE match right now, in either innings, with no winner \u2014 not just this innings (that's \u201cEnd innings\u201d, further up). Use this specifically when play is stopped too early or too unevenly for a fair result: bad weather, running out of time, whatever the reason. There's no automatic check for whether it's actually too early for a result \u2014 that judgment call is entirely yours. This can't be undone the way a single ball can with Undo.",
    confirmLabel: "Abandon \u2014 No Result",
    onConfirm: declareNoResult,
    onCancel: () => setConfirmNoResult(false)
  }), needsCapRetirement && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setDismissedCapRetireFor(capRetireName)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 8
    }
  }, capRetireName, " must retire"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, `Reached ${inning.retirementRuns} runs — this tournament's rules require retiring at that point (not out, not a dismissal). They can return later once the rest of the batting order has had a turn.`), capRetireName !== inning.strikerName ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, capRetireName, " is currently at the non-striker's end — swap strike first so the retirement can be recorded against them."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: swapStrike,
    className: "cs-btn cs-shine",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "9px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      width: "100%",
      justifyContent: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 14
  }), "Swap Strike")) : /*#__PURE__*/React.createElement(Btn, {
    onClick: () => retireBatsman("cap"),
    style: {
      width: "100%",
      marginBottom: 10
    }
  }, "Confirm retirement (not out)"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setDismissedCapRetireFor(capRetireName),
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
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Not now")), showRetireModal && inning.strikerName && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowRetireModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 8
    }
  }, "Retire ", inning.strikerName, "?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 8
    }
  }, "Retired hurt doesn't count as a wicket \u2014 use it for an injury or anything that pulls them away mid-innings. Retired out counts the same as any other dismissal."), inning.nonStrikerName && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 8
    }
  }, "Only whoever's on strike can be retired here. If it's actually ", /*#__PURE__*/React.createElement("strong", null, inning.nonStrikerName), " who needs to leave, swap strike first."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: swapStrike,
    className: "cs-btn cs-shine",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 13px",
      borderRadius: 20,
      border: `1.5px solid ${COLORS.creamDark}`,
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 13
  }), "Swap Strike")), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => retireBatsman("hurt"),
    style: {
      width: "100%",
      marginBottom: 10
    }
  }, "Retired hurt (not out)"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => retireBatsman("out"),
    style: {
      width: "100%",
      marginBottom: 10
    }
  }, "Retired out (counts as a wicket)"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowRetireModal(false),
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
      fontSize: 12,
      cursor: "pointer",
      padding: "4px"
    }
  }, "Cancel")), needsNewBowler && !needsNewBatsman && !pendingWicket && /*#__PURE__*/React.createElement(Modal, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, "Over complete — next bowler"), inning.lastBowlerName && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, inning.lastBowlerName, ": ", justCompletedOverRuns, justCompletedOverRuns === 1 ? " run" : " runs", justCompletedOverWickets > 0 && `, ${justCompletedOverWickets} wicket${justCompletedOverWickets === 1 ? "" : "s"}`, " that over"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, justCompletedOver.map((ev, i) => /*#__PURE__*/React.createElement(BallBadge, {
    key: i,
    ev: ev
  })))), /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inning.bowlingTeam),
    value: newBowlerName,
    onChange: setNewBowlerName,
    exclude: inning.lastBowlerName,
    excludeList: maxOversExcludeList,
    placeholder: "Bowler name",
    captain: captainFor(match, inning.bowlingTeam),
    keeper: keeperFor(match, inning.bowlingTeam),
    numbers: numbersFor(match, inning.bowlingTeam)
  }), inning.maxOversPerBowler && atMaxOvers.length > 0 && maxOversExcludeList.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginTop: 8
    }
  }, atMaxOvers.length === 1 ? `${atMaxOvers[0]} has reached the ${inning.maxOversPerBowler}-over limit.` : `${atMaxOvers.join(", ")} have reached the ${inning.maxOversPerBowler}-over limit.`), inning.maxOversPerBowler && atMaxOvers.length > 0 && maxOversExcludeList.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginTop: 8
    }
  }, "Everyone available has reached the ", inning.maxOversPerBowler, "-over limit \u2014 pick anyway."), rosterFor(match, inning.bowlingTeam).length === 0 && newBowlerName.trim() && newBowlerName.trim() === inning.lastBowlerName && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginTop: 8
    }
  }, "Same bowler can't bowl two overs in a row."), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !newBowlerName.trim() || newBowlerName.trim() === inning.lastBowlerName,
    onClick: confirmNewBowler,
    style: {
      width: "100%",
      marginTop: 10
    }
  }, "Confirm")), showExtra && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowExtra(null)
  }, showExtra === "choose" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, "Extra"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowExtra("wide")
  }, "Wide"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowExtra("noball")
  }, "No Ball"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowExtra("bye")
  }, "Bye"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowExtra("legbye")
  }, "Leg Bye"), /*#__PURE__*/React.createElement(Btn, {
    onClick: handlePenalty,
    style: {
      gridColumn: "1 / -1"
    }
  }, "Penalty +5 (batting team)"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, {
    wide: "Wide",
    noball: "No Ball",
    bye: "Bye",
    legbye: "Leg Bye"
  }[showExtra], " — runs"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 8
    }
  }, [0, 1, 2, 3, 4].map(n => /*#__PURE__*/React.createElement(Btn, {
    key: n,
    onClick: () => handleExtra(showExtra, n)
  }, n)), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setCustomRunsFor(showExtra);
      setCustomRunsCompleted("");
      setCustomOverthrow("");
      setShowExtra(null);
    }
  }, "Other")))), showWicket && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowWicket(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, "How out?"), inning.freeHitActive && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, "Free hit \u2014 only a run out counts here."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8
    }
  }, wicketTypes.map(w => /*#__PURE__*/React.createElement(Btn, {
    key: w,
    variant: "danger",
    onClick: () => handleWicket(w)
  }, w)))), wicketDraft && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => {
      setWicketDraft(null);
      setFielderDraftName("");
      setRunsDraft(0);
      setWicketExtraKind(null);
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, wicketDraft.wicketType === "Caught" ? "Who took the catch?" : wicketDraft.wicketType === "Run out" ? "Who ran them out?" : "Stumped \u2014 was it off a wide?"), wicketDraft.wicketType === "Run out" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 8
    }
  }, "This will record ", /*#__PURE__*/React.createElement("strong", null, inning.strikerName), " as out. If it was actually ", inning.nonStrikerName || "the non-striker", " who was run out, swap strike below first — any runs completed below still go to whoever actually faced the ball, whichever end ends up out."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: swapStrike,
    className: "cs-btn cs-shine",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 13px",
      borderRadius: 20,
      border: `1.5px solid ${COLORS.creamDark}`,
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 13
  }), "Swap Strike")), wicketDraft.wicketType === "Run out" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Runs completed before the wicket"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, [0, 1, 2, 3].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setRunsDraft(n),
    style: {
      minWidth: 44,
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: runsDraft === n ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: runsDraft === n ? "#fff" : COLORS.ink,
      boxShadow: runsDraft === n ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      textAlign: "center"
    }
  }, n))), riskOfWrongPairing && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 10,
      padding: "8px 10px",
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
  }), "Strike would normally have crossed. Once the new batsman is confirmed, double-check who's actually on strike \u2014 this is separate from (and comes after) any Swap Strike you used above just to mark the right end out. Swap Strike on the main scoring screen fixes it if the pairing's wrong.")), (wicketDraft.wicketType === "Run out" || wicketDraft.wicketType === "Stumped") && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "This ball was"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, [{
    value: null,
    label: "Fair ball"
  }, {
    value: "wide",
    label: "Wide"
  }, ...wicketDraft.wicketType === "Run out" ? [{
    value: "noball",
    label: "No ball"
  }] : []].map(opt => /*#__PURE__*/React.createElement("button", {
    key: opt.label,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => setWicketExtraKind(opt.value),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: wicketExtraKind === opt.value ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: wicketExtraKind === opt.value ? "#fff" : COLORS.ink,
      boxShadow: wicketExtraKind === opt.value ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, opt.label)))), (wicketDraft.wicketType === "Caught" || wicketDraft.wicketType === "Run out") && /*#__PURE__*/React.createElement(Field, {
    label: "Fielder"
  }, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: rosterFor(match, inning.bowlingTeam),
    value: fielderDraftName,
    onChange: setFielderDraftName,
    placeholder: "Fielder name",
    captain: captainFor(match, inning.bowlingTeam),
    keeper: keeperFor(match, inning.bowlingTeam),
    numbers: numbersFor(match, inning.bowlingTeam)
  })), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: wicketDraft.wicketType === "Caught" && !fielderDraftName.trim(),
    onClick: () => confirmWicketDetails(),
    style: {
      width: "100%",
      marginTop: 10
    }
  }, "Confirm"), wicketDraft.wicketType === "Run out" && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => confirmWicketDetails(""),
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
      fontSize: 12,
      cursor: "pointer",
      padding: "10px 4px 0",
      textDecoration: "underline"
    }
  }, "Fielder unknown \u2014 skip"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setWicketDraft(null);
      setFielderDraftName("");
      setRunsDraft(0);
      setWicketExtraKind(null);
    },
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
      padding: "10px 4px 0"
    }
  }, /*#__PURE__*/React.createElement(Undo2, {
    size: 13
  }), "Cancel this wicket")), customRunsFor && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setCustomRunsFor(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 6
    }
  }, "Other runs"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "For an overthrow, a short run, or any total the quick buttons don\u2019t cover. Split it into what was actually run and any overthrow bonus, so the ball history shows \u201c2+1\u201d rather than a bare \u201c3\u201d that hides what happened."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Runs completed"), /*#__PURE__*/React.createElement(TextField, {
    value: customRunsCompleted,
    onChange: v => setCustomRunsCompleted(v.replace(/[^0-9]/g, "").slice(0, 2)),
    placeholder: "Runs the batsmen ran",
    inputMode: "numeric",
    style: {
      textAlign: "center",
      fontSize: 18,
      fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace",
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setCustomShortRun(v => !v),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      padding: "10px 12px",
      marginBottom: 14,
      borderRadius: 10,
      cursor: "pointer",
      textAlign: "left",
      border: customShortRun ? "none" : `1px solid ${COLORS.willow}`,
      background: customShortRun ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: customShortRun ? "#fff" : COLORS.ink
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      flexShrink: 0,
      border: customShortRun ? "none" : `1.5px solid ${COLORS.willow}`,
      background: customShortRun ? "rgba(255,255,255,0.25)" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, customShortRun && /*#__PURE__*/React.createElement(Check, {
    size: 13,
    strokeWidth: 3
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13
    }
  }, "Short run \u2014 deduct 1"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      opacity: 0.85
    }
  }, "A batsman didn\u2019t make their ground on one of the runs above"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Overthrow bonus"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, [1, 2, 4].map(n => /*#__PURE__*/React.createElement(Btn, {
    key: n,
    variant: customOverthrow === String(n) ? "primary" : "default",
    onClick: () => setCustomOverthrow(String(n)),
    style: {
      flex: 1
    }
  }, "+", n))), /*#__PURE__*/React.createElement(TextField, {
    value: customOverthrow,
    onChange: v => setCustomOverthrow(v.replace(/[^0-9]/g, "").slice(0, 2)),
    placeholder: "Extra runs from the misfield",
    inputMode: "numeric",
    style: {
      textAlign: "center",
      fontSize: 18,
      fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      margin: "12px 0 4px"
    }
  }, "Total: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, Math.max(0, (parseInt(customRunsCompleted, 10) || 0) + (parseInt(customOverthrow, 10) || 0) - (customShortRun ? 1 : 0))), " runs on this ball", customShortRun && " (1 deducted for the short run)"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: customRunsCompleted === "" && customOverthrow === "",
    onClick: confirmCustomRuns,
    style: {
      width: "100%",
      marginTop: 10
    }
  }, "Confirm")), showScorecard && /*#__PURE__*/React.createElement(ScorecardOverlay, {
    match: match,
    onClose: () => setShowScorecard(false)
  }), conflict && /*#__PURE__*/React.createElement(SyncConflictModal, {
    local: match,
    remote: conflict,
    onKeepMine: resolveConflictKeepMine,
    onUseTheirs: resolveConflictUseTheirs
  }));
}
