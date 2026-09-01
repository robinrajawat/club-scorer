import { DEFAULT_RULES } from "./appLogic.js";

// The ball-by-ball scoring engine. Self-contained aside from DEFAULT_RULES (imported above) —
// everything else it needs (ensureBatsman, ensureBowler, oversLabel, runsDisplay) is defined below
// in this same file. Covered by tests/unit/scoringEngine.test.js.
export function newInning(battingTeam, bowlingTeam, rules, maxWickets, oversLimit) {
  const r = {
    ...DEFAULT_RULES,
    ...rules
  };
  // Defensive coercion: SetupScreen stores these as raw digit-strings while the user is actively
  // typing (see the maxOversPerBowler/powerplayOvers/timeCapMinutes TextFields), only clamping to
  // a real number on blur. This is the actual point these get used for scoring math, so make sure
  // a stray string can never reach here even if blur didn't fire for some reason.
  if (r.maxOversPerBowler != null) {
    const n = parseInt(String(r.maxOversPerBowler), 10);
    r.maxOversPerBowler = isNaN(n) || n < 1 ? null : n;
  }
  if (r.powerplayOvers != null) {
    const n = parseInt(String(r.powerplayOvers), 10);
    r.powerplayOvers = isNaN(n) || n < 1 ? null : n;
  }
  if (r.timeCapMinutes != null) {
    const n = parseInt(String(r.timeCapMinutes), 10);
    r.timeCapMinutes = isNaN(n) || n < 1 ? null : n;
  }
  return {
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    overs: [[]],
    // array of overs, each an array of ball events
    startedAt: Date.now(),
    // wall-clock time the innings began — powers the innings timer on the scoring screen
    batsmen: {},
    // name -> {runs, balls, out, how}
    battingOrder: [],
    bowlers: {},
    // name -> {ballsBowled, runs, wickets, maidens}
    bowlingOrder: [],
    extras: {
      wide: 0,
      noball: 0,
      bye: 0,
      legbye: 0,
      penalty: 0
    },
    strikerName: "",
    nonStrikerName: "",
    bowlerName: "",
    lastBowlerName: "",
    overBowlers: [],
    // name of the bowler of each completed over, in order — used to suggest the next bowler
    fallOfWickets: [],
    // {score, wicket, over, batsman}
    partnerships: [],
    // {batter1, batter2, runs, balls, wicket, unbeaten} — one entry per COMPLETED stand, pushed
    // when it ends (a wicket, a retirement) or when the innings itself ends with the pair still
    // together (unbeaten: true, see checkInningEnd). "wicket" is which fall-of-wicket number the
    // stand corresponds to (the 1st-wicket stand, 2nd-wicket stand, etc.), not a count of
    // dismissals within it. Powers the Record Book's Biggest Partnerships list — see
    // computeClubRecords — but only for matches scored after this field existed; older matches
    // simply have an empty array here, same as any other feature added after the fact.
    penalties: [],
    // {score, over, runs} — penalty runs aren't tied to any delivery, so they never appear in the
    // ball-by-ball log; this is what lets them show up anywhere at all instead of just silently
    // moving the total.
    complete: false,
    partnershipRuns: 0,
    partnershipBalls: 0,
    // Legal balls since the batting side's last boundary actually hit off the bat (fours/sixes
    // credited to a batsman — see boundaryHitByBat in applyBall). Deliberately NOT any ball that
    // merely results in 4/6 runs some other way (a wide running away to the fence, a bye) — those
    // aren't a batting boundary and shouldn't reset a drought that's fundamentally about timing.
    ballsSinceBoundary: 0,
    // Consecutive legal-ball wickets per bowler (resets on any non-wicket legal ball; wides/
    // no-balls neither extend nor break it) — how hat-tricks are detected in applyBall.
    bowlerWicketStreak: {},
    // Milestones crossed during this innings (individual 50s/100s, 5-wicket hauls, hat-tricks,
    // 50+ partnerships) — appended live, in applyBall, as they happen. Shown in the permanent
    // scorecard/commentary (see InningScorecard).
    milestones: [],
    // Same idea, but for the toast-only moments (team totals, maiden overs, ducks) that are worth
    // a celebration pop-up but not worth permanently logging on the scorecard — see applyBall's
    // milestone-detection section and MatchScreen's commit().
    toastMilestones: [],
    // house rules baked in at innings start, so a mid-match account-settings change never
    // affects an innings already in progress
    ballsPerOver: r.ballsPerOver,
    wideRuns: r.wideRuns,
    noballRuns: r.noballRuns,
    freeHitEnabled: r.freeHit,
    freeHitActive: false,
    maxOversPerBowler: r.maxOversPerBowler || null,
    powerplayOvers: r.powerplayOvers || null,
    timeCapMinutes: r.timeCapMinutes || null,
    retirementRuns: r.retirementRuns || null,
    wideNoballCountsAsBall: r.wideNoballCountsAsBall || false,
    // The innings' total legal overs, baked in here purely so applyBall (which only ever sees this
    // inning, never the match) can tell whether the ball it's about to score is in the final over —
    // the one thing wideNoballCountsAsBall needs and nothing else here does. null for any caller
    // that doesn't pass one (every test fixture, e.g.) simply means "no final-over cutoff", i.e.
    // wideNoballCountsAsBall (if on at all) applies to every over uniformly. Same "baked in at
    // innings start" caveat as every other house rule above: a mid-chase DLS overs revision won't
    // retroactively change this.
    oversLimit: oversLimit != null ? oversLimit : null,
    // Baked in once here rather than recomputed from the roster on every check — this is what
    // lets applyBall (which has no access to the match object, only this inning) use the right
    // all-out threshold instead of a hardcoded 10. Falls back to 10 only if a caller genuinely
    // didn't pass one, which every real call site below does.
    maxWickets: maxWickets != null ? maxWickets : 10
  };
}
export function ensureBatsman(inning, name) {
  if (!name) return;
  if (!inning.batsmen[name]) {
    inning.batsmen[name] = {
      runs: 0,
      balls: 0,
      out: false,
      how: "",
      fours: 0,
      sixes: 0
    };
    inning.battingOrder = [...inning.battingOrder, name];
  } else if (inning.batsmen[name].retiredHurt) {
    // Anyone actually being confirmed as the active striker/non-striker can't simultaneously be
    // "currently retired, sitting out" — clears the moment they resume. Every call site here means
    // "this name is now an active batsman" (a new one, an opener, or someone coming back in), so
    // this is the one place that needs to know about resuming rather than duplicating it at each
    // call site. See retireBatsman/confirmNewBatsman below for where retiredHurt gets set, and the
    // Next batsman picker's excludeList for what makes a retired player selectable again at all.
    inning.batsmen[name] = {
      ...inning.batsmen[name],
      retiredHurt: false,
      retiredAtCap: false
    };
  }
}
export function ensureBowler(inning, name) {
  if (!name) return;
  if (!inning.bowlers[name]) {
    inning.bowlers[name] = {
      ballsBowled: 0,
      runs: 0,
      wickets: 0,
      maidens: 0
    };
    inning.bowlingOrder = [...inning.bowlingOrder, name];
  }
}
// Whether a wide/no-ball counts as a legal (over-completing) delivery right now. Standard Laws:
// always false, every wide/no-ball is re-bowled. The wideNoballCountsAsBall house rule flips that
// to true everywhere EXCEPT the innings' final over, where it reverts to the standard illegal-ball
// behavior -- the "final-over wide/no-ball illegal again" switch. Exported (not inlined in
// applyBall) because the wicket-on-a-wide/no-ball path decides legality at the call site
// (matchScreen.js builds event.legal itself, since a wicket's legality also depends on the
// dismissal, not just the extra) and needs the identical answer rather than a second copy of this
// logic drifting out of sync.
export function isWideNoballLegal(inning) {
  if (!inning.wideNoballCountsAsBall) return false;
  if (inning.oversLimit == null) return true;
  const bpo = inning.ballsPerOver || 6;
  const currentOver = Math.floor(inning.legalBalls / bpo);
  const isFinalOver = currentOver >= Math.floor(inning.oversLimit) - 1;
  return !isFinalOver;
}
export function oversLabel(legalBalls, ballsPerOver) {
  const bpo = ballsPerOver || 6;
  const o = Math.floor(legalBalls / bpo);
  const b = legalBalls % bpo;
  return `${o}.${b}`;
}
export function crr(runs, legalBalls, ballsPerOver) {
  if (legalBalls === 0) return "0.00";
  return (runs / legalBalls * (ballsPerOver || 6)).toFixed(2);
}

// ---------- Ball event application ----------
// event: { kind: 'run'|'wide'|'noball'|'bye'|'legbye'|'wicket', runs, wicketType, newBatsman }
// A ball's "display" string for the over strip / ball-by-ball log embeds the completed/overthrow
// split when event.overthrow is present — "2+1" for 2 run plus a 1-run overthrow bonus — instead
// of collapsing it into a bare total that gives no hint anything unusual happened. Same reasoning
// for shortRun — "2 SR" instead of a bare "2" that gives no hint a run was called short (the
// batsmen attempted more, but one didn't make their ground in time, so it doesn't count). Doesn't
// need its own arithmetic anywhere else: unlike overthrow, a short run has nothing to do with
// whether the ball reached the boundary, so it never interacts with the fours/sixes detection in
// applyBall — the total passed in here is already the final, correct, post-deduction number by
// the time it gets this far (see confirmCustomRuns).
export function runsDisplay(total, overthrow, shortRun) {
  const base = overthrow ? `${total - overthrow}+${overthrow}` : String(total);
  return shortRun ? `${base} SR` : base;
}
export function applyBall(inning, event) {
  // Penalty runs (always exactly 5, per the Laws) aren't tied to any delivery — no ball bowled,
  // no batsman/bowler figures affected, no entry in the over's ball-by-ball log. Handled entirely
  // separately from the rest of the ball pipeline below. Still logged to inning.penalties so it's
  // a traceable event on the scorecard (see InningScorecard) rather than just moving the total.
  if (event.kind === "penalty") {
    const beforeTeamRuns = inning.runs || 0;
    const afterTeamRuns = beforeTeamRuns + event.runs;
    const updated = {
      ...inning,
      runs: afterTeamRuns,
      extras: {
        ...inning.extras,
        penalty: (inning.extras.penalty || 0) + event.runs
      },
      penalties: [...(inning.penalties || []), {
        runs: event.runs,
        score: afterTeamRuns,
        wickets: inning.wickets,
        over: oversLabel(inning.legalBalls, inning.ballsPerOver)
      }]
    };
    // A penalty bypasses the rest of the ball pipeline entirely (no delivery, nothing else to
    // update), but the team-total toast further down never runs for it either as a result — a
    // penalty landing right on top of a 50/100 line would otherwise silently never announce it.
    // Self-contained here rather than not bothering to check at all.
    if (afterTeamRuns >= 50 && Math.floor(afterTeamRuns / 50) > Math.floor(beforeTeamRuns / 50)) {
      updated.toastMilestones = [...(inning.toastMilestones || []), {
        type: "teamTotal",
        text: `${updated.battingTeam} reach ${Math.floor(afterTeamRuns / 50) * 50}`,
        over: oversLabel(inning.legalBalls, inning.ballsPerOver),
        score: `${afterTeamRuns}-${inning.wickets}`
      }];
    }
    return updated;
  }
  // Free hit: a non-run-out dismissal can't stand on a free-hit ball. Reroute it to a dot ball
  // rather than crediting the wicket — the UI also hides the disallowed wicket types while a
  // free hit is active, this is just a safety net.
  if (inning.freeHitActive && event.kind === "wicket" && event.wicketType !== "Run out") {
    event = {
      kind: "run",
      runs: 0
    };
  }
  // Defense in depth: a delivery should never be recorded with no striker/non-striker/bowler
  // assigned — normally prevented by the UI (needsNewBatsman/needsNewBowler hide the scoring
  // buttons whenever one is missing), but this app has no realtime sync between devices scoring
  // the same shared match — each one only reconciles with the server at save time (see the
  // writeSeq conflict check), so one device's view of who's currently batting/bowling can go
  // stale relative to another's for a stretch. If a ball ever gets applied against a state that's
  // missing one of these, silently proceeding corrupts data far more subtly than refusing to:
  // downstream, `cur.bowlers[cur.bowlerName] = bowler` (unlike ensureBatsman/ensureBowler, which
  // guard against an empty name) would happily create a bowler record keyed by a literal empty
  // string — which Firestore then rejects outright with an opaque "Document fields must not be
  // empty", failing sync for the ENTIRE match, not just this one ball. Refusing outright here is a
  // strictly safer failure mode: the ball simply doesn't get recorded (matching what the UI
  // already visually promised by hiding the scoring buttons) instead of silently corrupting the
  // innings. Logged so a real hit is traceable instead of just vanishing.
  if (event.kind !== "penalty" && (!inning.strikerName || !inning.nonStrikerName || !inning.bowlerName)) {
    console.error("[applyBall] refused \u2014 missing striker/non-striker/bowler for this delivery", {
      strikerName: inning.strikerName,
      nonStrikerName: inning.nonStrikerName,
      bowlerName: inning.bowlerName,
      eventKind: event.kind
    });
    return inning;
  }
  const cur = {
    ...inning
  };
  cur.overs = cur.overs.map(o => [...o]);
  cur.batsmen = {
    ...cur.batsmen
  };
  cur.bowlers = {
    ...cur.bowlers
  };
  cur.extras = {
    ...cur.extras
  };
  ensureBatsman(cur, cur.strikerName);
  ensureBatsman(cur, cur.nonStrikerName);
  ensureBowler(cur, cur.bowlerName);
  cur.bowlerWicketStreak = { ...(inning.bowlerWicketStreak || {}) };
  cur.milestones = [...(inning.milestones || [])];
  cur.toastMilestones = [...(inning.toastMilestones || [])];
  const ballBowlerName = cur.bowlerName; // stable even if this ball completes the over below,
  // which clears cur.bowlerName
  const bowler = {
    ...cur.bowlers[cur.bowlerName]
  };
  let legalBall = true;
  let runsThisBall = 0;
  let display = "";
  let strikeChanges = false;
  let dismissedName = null;
  let creditsBowler = false;
  let justBowledMaiden = null; // bowler name, set below when a completed over concedes 0 runs
  let justBowledWicketMaiden = null; // same, but that over also took a wicket
  // Whether a batsman was PERSONALLY credited a four or six this ball — set at each of the four
  // spots below that actually touch a batsman's fours/sixes tally. Deliberately not derived from
  // runsThisBall (which also includes wide/bye boundary-equivalents that were never hit off the
  // bat) — see ballsSinceBoundary's own comment in newInning for why that distinction matters.
  let boundaryHitByBat = false;
  if (event.kind === "run") {
    runsThisBall = event.runs;
    cur.runs += event.runs;
    // A boundary means the BAT sent it to the rope — only the completed portion of a composite
    // total counts, never the overthrow bonus on top. Without this, "2 run + a 2-run overthrow"
    // (any total that happens to land on 4 or 6) got wrongly counted as a genuine four/six, since
    // this used to check event.runs (the total) rather than what was actually struck. Matters for
    // the batsman's own fours/sixes tally and now also for boundaryHitByBat (the drought toast) —
    // an overthrow has nothing to do with the batsman's own timing, same reasoning as why a wide
    // reaching the boundary was already excluded there.
    const battedRuns = event.runs - (event.overthrow || 0);
    if (battedRuns === 4 || battedRuns === 6) boundaryHitByBat = true;
    cur.batsmen[cur.strikerName] = {
      ...cur.batsmen[cur.strikerName],
      runs: cur.batsmen[cur.strikerName].runs + event.runs,
      balls: cur.batsmen[cur.strikerName].balls + 1,
      fours: cur.batsmen[cur.strikerName].fours + (battedRuns === 4 ? 1 : 0),
      sixes: cur.batsmen[cur.strikerName].sixes + (battedRuns === 6 ? 1 : 0)
    };
    bowler.runs += event.runs;
    bowler.ballsBowled += 1;
    display = runsDisplay(event.runs, event.overthrow, event.shortRun);
    if (event.runs % 2 === 1) strikeChanges = true;
  } else if (event.kind === "wide") {
    legalBall = isWideNoballLegal(cur);
    runsThisBall = (cur.wideRuns || 1) + (event.runs || 0);
    cur.runs += runsThisBall;
    bowler.runs += runsThisBall;
    cur.extras.wide += runsThisBall;
    display = event.runs ? `Wd+${runsDisplay(event.runs, event.overthrow, event.shortRun)}` : "Wd";
    if ((event.runs || 0) % 2 === 1) strikeChanges = true;
  } else if (event.kind === "noball") {
    legalBall = isWideNoballLegal(cur);
    runsThisBall = (cur.noballRuns || 1) + (event.runs || 0);
    cur.runs += runsThisBall;
    bowler.runs += runsThisBall;
    // BUG FIX: this used to always add exactly 1 here regardless of the configured no-ball
    // penalty (cur.noballRuns) — fine for the default 1-run no-ball, but for any match using a
    // custom no-ball rule (e.g. 2 runs), extras.noball silently under-counted by the difference
    // every time, so the scorecard's Extras total stopped reconciling with the actual score
    // (batting total + extras < inning.runs). Any runs off the bat still go to the batsman below,
    // same as before — only the penalty portion belongs in extras.
    cur.extras.noball += cur.noballRuns || 1;
    // Same reasoning as the "run" branch above — only the batted portion (excluding any overthrow
    // bonus) counts as a genuine boundary.
    const battedRuns = (event.runs || 0) - (event.overthrow || 0);
    if (battedRuns === 4 || battedRuns === 6) boundaryHitByBat = true;
    cur.batsmen[cur.strikerName] = {
      ...cur.batsmen[cur.strikerName],
      runs: cur.batsmen[cur.strikerName].runs + (event.runs || 0),
      fours: cur.batsmen[cur.strikerName].fours + (battedRuns === 4 ? 1 : 0),
      sixes: cur.batsmen[cur.strikerName].sixes + (battedRuns === 6 ? 1 : 0)
    };
    display = event.runs ? `Nb+${runsDisplay(event.runs, event.overthrow, event.shortRun)}` : "Nb";
    if ((event.runs || 0) % 2 === 1) strikeChanges = true;
    if (cur.freeHitEnabled) cur.freeHitActive = true;
  } else if (event.kind === "bye" || event.kind === "legbye") {
    runsThisBall = event.runs;
    cur.runs += event.runs;
    cur.extras[event.kind] += event.runs;
    cur.batsmen[cur.strikerName] = {
      ...cur.batsmen[cur.strikerName],
      balls: cur.batsmen[cur.strikerName].balls + 1
    };
    bowler.ballsBowled += 1;
    display = `${event.kind === "bye" ? "B" : "Lb"}${runsDisplay(event.runs, event.overthrow, event.shortRun)}`;
    if (event.runs % 2 === 1) strikeChanges = true;
  } else if (event.kind === "wicket") {
    cur.wickets += 1;
    legalBall = event.legal !== false;
    // A run out or a stumping is the only dismissals that can happen on an otherwise-normal
    // delivery OR on a wide (a run out can also happen on a no-ball) — event.extraKind carries
    // which. Mirrors the standalone wide/noball branches above exactly: a wide's entire run total
    // (the fixed penalty AND any further running) is extras, never personal runs; a no-ball's
    // fixed penalty is extras but anything actually run/hit is credited to the batsman.
    const runsBeforeWicket = Math.max(0, event.runsBeforeWicket || 0);
    // Whoever actually faced this ball — event.runsCreditTo, snapshotted in handleWicket before
    // the wicket-details popup could touch strikerName at all — not cur.strikerName, which by
    // commit time may only reflect who ends up recorded as out (see dismissedName below) after a
    // Swap Strike used in that same popup for a non-striker run out. In the far more common case
    // (no swap happened) these are the same name, so this changes nothing there. Falls back to
    // cur.strikerName for safety if a caller ever omits it — there isn't one today, every path
    // through confirmWicketDetails sets it.
    const creditTo = event.runsCreditTo || cur.strikerName;
    if (event.extraKind === "wide") {
      const wideTotal = (cur.wideRuns || 1) + runsBeforeWicket;
      runsThisBall = wideTotal;
      cur.runs += wideTotal;
      bowler.runs += wideTotal;
      cur.extras.wide += wideTotal;
    } else if (event.extraKind === "noball") {
      const noballPenalty = cur.noballRuns || 1;
      runsThisBall = noballPenalty + runsBeforeWicket;
      cur.runs += runsThisBall;
      bowler.runs += runsThisBall;
      cur.extras.noball += noballPenalty;
      if (cur.freeHitEnabled) cur.freeHitActive = true;
      if (runsBeforeWicket > 0) {
        if (runsBeforeWicket === 4 || runsBeforeWicket === 6) boundaryHitByBat = true;
        cur.batsmen[creditTo] = {
          ...cur.batsmen[creditTo],
          runs: cur.batsmen[creditTo].runs + runsBeforeWicket,
          fours: cur.batsmen[creditTo].fours + (runsBeforeWicket === 4 ? 1 : 0),
          sixes: cur.batsmen[creditTo].sixes + (runsBeforeWicket === 6 ? 1 : 0)
        };
      }
    } else if (runsBeforeWicket > 0) {
      // Fair ball: runs actually completed by running before the dismissal — the caller only ever
      // sends a nonzero value for Run out (the one dismissal where the ball stays live and the
      // pair can genuinely be mid-run when the wicket falls; every other type is a dead ball the
      // instant it happens, so there's nothing to complete). Credited to the team total, the
      // bowler's runs conceded, and the batsman who actually ran for them — the run genuinely
      // happened, only someone ends up out instead of everyone home safe.
      cur.runs += runsBeforeWicket;
      bowler.runs += runsBeforeWicket;
      runsThisBall = runsBeforeWicket;
      if (runsBeforeWicket === 4 || runsBeforeWicket === 6) boundaryHitByBat = true;
      cur.batsmen[creditTo] = {
        ...cur.batsmen[creditTo],
        runs: cur.batsmen[creditTo].runs + runsBeforeWicket,
        fours: cur.batsmen[creditTo].fours + (runsBeforeWicket === 4 ? 1 : 0),
        sixes: cur.batsmen[creditTo].sixes + (runsBeforeWicket === 6 ? 1 : 0)
      };
    }
    dismissedName = cur.strikerName;
    const wt = event.wicketType || "out";
    // Run out, hit the ball twice, and obstructing the field are all dismissals that don't credit
    // the bowler in the Laws -- a run out is a fielding-side dismissal, and the other two are the
    // batsman doing something illegal that isn't really "the bowler getting them out" in any sense
    // the wicket column is meant to track.
    creditsBowler = !["Run out", "Hit the ball twice", "Obstructing the field"].includes(wt);
    let howText;
    if (wt === "Run out") {
      howText = event.fielderName ? `run out (${event.fielderName})` : "run out";
    } else if (wt === "Caught") {
      const fielder = event.fielderName || cur.bowlerName;
      howText = fielder === cur.bowlerName ? `c & b ${cur.bowlerName}` : `c ${fielder} b ${cur.bowlerName}`;
    } else if (wt === "Hit the ball twice" || wt === "Obstructing the field") {
      // Neither credits the bowler (see creditsBowler above) and neither has a "prefix + bowler
      // name" scorecard convention the way Bowled/LBW/Stumped/Hit wicket do -- real scorecards just
      // show these standalone, e.g. "obstructing the field", with no fielder or bowler attribution
      // at all. Handled as its own branch rather than falling into the prefix map below, which
      // would otherwise silently default to "b" (Bowled) for any wicketType it doesn't recognize --
      // exactly the wrong, misleading text for a dismissal that has nothing to do with being bowled.
      howText = wt.toLowerCase();
    } else {
      const prefix = {
        Bowled: "b",
        LBW: "lbw b",
        Stumped: "st b",
        "Hit wicket": "hit wkt b"
      }[wt] || "b";
      howText = `${prefix} ${cur.bowlerName}`;
    }
    if (legalBall) {
      // Balls faced goes to whoever actually faced this delivery (creditTo — see above), which is
      // usually the same person being marked out here, but not always: after a Swap Strike for a
      // non-striker run out, creditTo is still the original striker while cur.strikerName is now
      // whoever's actually out. Two separate updates when they differ, so neither clobbers the
      // other; one merged update when they're the same name, same as before this distinction
      // existed.
      if (creditTo === cur.strikerName) {
        cur.batsmen[cur.strikerName] = {
          ...cur.batsmen[cur.strikerName],
          balls: cur.batsmen[cur.strikerName].balls + 1,
          out: true,
          how: howText
        };
      } else {
        cur.batsmen[creditTo] = {
          ...cur.batsmen[creditTo],
          balls: cur.batsmen[creditTo].balls + 1
        };
        cur.batsmen[cur.strikerName] = {
          ...cur.batsmen[cur.strikerName],
          out: true,
          how: howText
        };
      }
      bowler.ballsBowled += 1;
      if (creditsBowler) bowler.wickets += 1;
    } else {
      cur.batsmen[cur.strikerName] = {
        ...cur.batsmen[cur.strikerName],
        out: true,
        how: howText
      };
    }
    cur.fallOfWickets = [...cur.fallOfWickets, {
      score: cur.runs,
      wicket: cur.wickets,
      over: oversLabel(cur.legalBalls + (legalBall ? 1 : 0), cur.ballsPerOver),
      batsman: dismissedName
    }];
    const extraPrefix = event.extraKind === "wide" ? "Wd+" : event.extraKind === "noball" ? "Nb+" : "";
    display = runsBeforeWicket > 0 ? `${extraPrefix}${runsBeforeWicket}+W` : `${extraPrefix}W`;
    cur.strikerName = event.newBatsman || "";
    // Create (or resume) the incoming batsman's record immediately rather than waiting for their
    // first ball — applyBall previously only ensured the OUTGOING striker/non-striker (see the
    // ensureBatsman calls at the top of this function), so a replacement who was then dismissed
    // before ever facing a "run" ball (a golden duck) had no entry in cur.batsmen yet. That left
    // them invisible to the Next batsman picker's excludeList (which only scans existing
    // cur.batsmen keys), so they'd show up as pickable again on the very wicket that dismissed
    // them. ensureBatsman also covers a returning retired-hurt batsman, clearing that flag the
    // moment they're back at the crease rather than waiting for their first ball either.
    ensureBatsman(cur, cur.strikerName);
  }
  // Guarded to match ensureBatsman/ensureBowler's own "never key a record by an empty name"
  // rule — normally unreachable now that the guard above refuses a bowler-less delivery outright,
  // but kept here too as a second layer: this is the exact line that used to silently create a
  // literal empty-string bowler key (see that guard's comment for why that's so damaging).
  if (cur.bowlerName) cur.bowlers[cur.bowlerName] = bowler;
  // Captured before the wicket-ball reset just below, specifically so the partnership milestone
  // check further down (afterPartnership) can still see a partnership that reached 50/100 in the
  // SAME ball it ended on — a run out with runs completed before the wicket (runsThisBall > 0 on
  // a wicket ball) can genuinely push a partnership across a line and end it in one motion ("out
  // going for the milestone run"), and that's a real moment worth the toast, not a reason to
  // silently skip it just because the running partnership tally itself needs to reset to 0 for
  // whatever comes next.
  const partnershipRunsPeak = (cur.partnershipRuns || 0) + runsThisBall;
  cur.partnershipRuns = partnershipRunsPeak;
  // Same reasoning as partnershipRunsPeak just above — captured before the wicket-ball reset so
  // "how long had this stand lasted" is still available for the Breakthrough toast below, on the
  // very ball it ends.
  const partnershipBallsPeak = (cur.partnershipBalls || 0) + (legalBall ? 1 : 0);
  if (legalBall) cur.partnershipBalls = partnershipBallsPeak;
  // Legal balls since the batting side's last genuine boundary — see ballsSinceBoundary's comment
  // in newInning. A boundary resets it regardless of whether THIS specific ball was legal (a
  // no-ball hit for four still counts); absent that, it only advances on a legal ball, matching
  // partnershipBalls' own convention just above.
  if (boundaryHitByBat) {
    cur.ballsSinceBoundary = 0;
  } else if (legalBall) {
    cur.ballsSinceBoundary = (cur.ballsSinceBoundary || 0) + 1;
  }
  if (event.kind === "wicket") {
    // Captured before the reset just below — dismissedName (the outgoing batter, set earlier in
    // this branch) and cur.nonStrikerName (the survivor, untouched by anything above) are exactly
    // the two names that formed the stand this wicket just ended. Guarded on both being present
    // since a genuine wicket always has both, but this runs on every wicket-kind ball including
    // edge cases (e.g. a very first-ball dismissal) where being defensive costs nothing.
    if (dismissedName && cur.nonStrikerName) {
      cur.partnerships = [...(cur.partnerships || []), {
        batter1: dismissedName,
        batter2: cur.nonStrikerName,
        runs: partnershipRunsPeak,
        balls: partnershipBallsPeak,
        wicket: cur.wickets,
        unbeaten: false
      }];
    }
    cur.partnershipRuns = 0;
    cur.partnershipBalls = 0;
  }
  const lastOverIdx = cur.overs.length - 1;
  cur.overs[lastOverIdx] = [...cur.overs[lastOverIdx], {
    display,
    kind: event.kind,
    runs: runsThisBall
  }];
  if (legalBall) {
    cur.legalBalls += 1;
    cur.freeHitActive = false; // a fair (or fair-but-illegal-for-batsman... i.e. any counted) ball consumes the free hit
    // Was hardcoded to `< 10` — same bug class as checkInningEnd's allOut and needsNewBatsman
    // (see maxWicketsFor). cur.maxWickets is baked in at newInning time since applyBall has no
    // access to the match object (rosters) to compute it live.
    if (cur.legalBalls % (cur.ballsPerOver || 6) === 0 && cur.wickets < (cur.maxWickets != null ? cur.maxWickets : 10)) {
      const finishedOver = cur.overs[lastOverIdx];
      const bowlerRunsThisOver = finishedOver.reduce((s, b) => s + (b.kind === "bye" || b.kind === "legbye" ? 0 : b.runs || 0), 0);
      if (bowlerRunsThisOver === 0 && cur.bowlers[cur.bowlerName]) {
        cur.bowlers[cur.bowlerName] = {
          ...cur.bowlers[cur.bowlerName],
          maidens: (cur.bowlers[cur.bowlerName].maidens || 0) + 1
        };
        justBowledMaiden = cur.bowlerName; // captured before cur.bowlerName is cleared below
        if (finishedOver.some(b => b.kind === "wicket")) {
          justBowledWicketMaiden = cur.bowlerName;
        }
      }
      cur.overs = [...cur.overs, []];
      cur.overBowlers = [...cur.overBowlers, cur.bowlerName];
      cur.lastBowlerName = cur.bowlerName;
      cur.bowlerName = "";
      strikeChanges = !strikeChanges; // extra swap at end of over (net effect: swap unless odd run already swapped -> then no swap)
    }
  }
  if (strikeChanges) {
    const tmp = cur.strikerName;
    cur.strikerName = cur.nonStrikerName;
    cur.nonStrikerName = tmp;
  }
  // ---- Milestone detection --------------------------------------------------------------
  // Derived from the SAME before(`inning`)/after(`cur`) state everything above just produced,
  // rather than a separate reconstruction pass — so it can never drift out of sync with the
  // scoring logic itself. Every milestone here is appended to cur.milestones (shown permanently
  // on the scorecard/commentary — see InningScorecard) and returned alongside the ball event so
  // MatchScreen can also pop a toast for whichever ones are new on THIS ball.
  const milestoneOver = oversLabel(cur.legalBalls, cur.ballsPerOver);
  const milestoneScore = `${cur.runs}-${cur.wickets}`;
  // Batting: 50, 100, 150... — any batsman whose total just crossed a 50-run line this ball.
  Object.keys(cur.batsmen).forEach(name => {
    const before = (inning.batsmen[name] && inning.batsmen[name].runs) || 0;
    const after = cur.batsmen[name].runs;
    if (after >= 50 && Math.floor(after / 50) > Math.floor(before / 50)) {
      cur.milestones.push({
        type: "batting",
        text: `${name} brings up ${Math.floor(after / 50) * 50}`,
        over: milestoneOver,
        score: milestoneScore
      });
    }
  });
  // Hat-trick: this bowler's third straight credited wicket on a legal delivery (wides/no-balls
  // neither extend nor break the streak — only legal deliveries count, per the Laws).
  if (legalBall) {
    cur.bowlerWicketStreak[ballBowlerName] = event.kind === "wicket" && creditsBowler ? (cur.bowlerWicketStreak[ballBowlerName] || 0) + 1 : 0;
    if (event.kind === "wicket" && creditsBowler && cur.bowlerWicketStreak[ballBowlerName] === 3) {
      cur.milestones.push({
        type: "hatTrick",
        text: `${ballBowlerName} completes a hat-trick!`,
        over: milestoneOver,
        score: milestoneScore
      });
    }
  }
  // 5-wicket haul: this bowler's tally just reached exactly five.
  if (event.kind === "wicket" && legalBall && creditsBowler && cur.bowlers[ballBowlerName] && cur.bowlers[ballBowlerName].wickets === 5) {
    cur.milestones.push({
      type: "fiveFor",
      text: `${ballBowlerName} takes a 5-wicket haul`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // Partnership: 50, 100, 150... for the pair batting together this ball. Checked against
  // partnershipRunsPeak (captured above, before any wicket-ball reset) rather than
  // cur.partnershipRuns, and named from inning.strikerName/nonStrikerName (the pair as they stood
  // for this ball) rather than cur.strikerName/nonStrikerName — both matter specifically for a
  // wicket ball: cur.partnershipRuns is already back to 0 by here, and cur.strikerName has already
  // become the incoming new batsman, neither of which is who actually built this partnership.
  const beforePartnership = inning.partnershipRuns || 0;
  const afterPartnership = partnershipRunsPeak;
  if (afterPartnership >= 50 && Math.floor(afterPartnership / 50) > Math.floor(beforePartnership / 50)) {
    cur.milestones.push({
      type: "partnership",
      text: `${inning.strikerName} & ${inning.nonStrikerName} put on ${Math.floor(afterPartnership / 50) * 50}`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // ---- Toast-only milestones -------------------------------------------------------------
  // Same detection idea as above, but pushed to cur.toastMilestones instead of cur.milestones —
  // worth a celebration pop-up, not worth permanently cluttering the scorecard (see
  // toastMilestones' definition in newInning and MatchScreen's commit()).
  // Team total: 50, 100, 150... crossed this ball. Worded distinctly from the individual batting
  // milestone above ("reaches" vs "brings up") so the two don't read like the same event at a
  // glance when both fire close together.
  const beforeTeamRuns = inning.runs || 0;
  const afterTeamRuns = cur.runs;
  if (afterTeamRuns >= 50 && Math.floor(afterTeamRuns / 50) > Math.floor(beforeTeamRuns / 50)) {
    cur.toastMilestones.push({
      type: "teamTotal",
      text: `${cur.battingTeam} reach ${Math.floor(afterTeamRuns / 50) * 50}`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // Boundary drought broken: the first boundary in a while. inning.ballsSinceBoundary (before this
  // ball) is the drought length being broken — deliberately not cur.ballsSinceBoundary, which this
  // same ball has already reset to 0 by the time this check runs. Only fires for a genuine batting
  // boundary (boundaryHitByBat) — a wide or bye running away to the fence doesn't end a drought
  // that's fundamentally about the batting side's timing, since the bat was never involved.
  const BOUNDARY_DROUGHT_BALLS = 18;
  if (boundaryHitByBat && (inning.ballsSinceBoundary || 0) >= BOUNDARY_DROUGHT_BALLS) {
    cur.toastMilestones.push({
      type: "boundaryDrought",
      text: `First boundary in ${inning.ballsSinceBoundary} balls`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // Maiden over: set above, right when the over closes with 0 runs conceded. A wicket maiden gets
  // its own, more specific toast instead of both firing back to back for the same over.
  if (justBowledWicketMaiden) {
    cur.toastMilestones.push({
      type: "wicketMaiden",
      text: `${justBowledWicketMaiden} bowls a wicket maiden`,
      over: milestoneOver,
      score: milestoneScore
    });
  } else if (justBowledMaiden) {
    cur.toastMilestones.push({
      type: "maiden",
      text: `${justBowledMaiden} bowls a maiden`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // Duck (3 tiers), for the batsman dismissed on this ball (dismissedName, tracked above for
  // fallOfWickets). All three require runs === 0 at dismissal; they differ on how they got there:
  //  - regular duck: faced 1+ balls before this one, never scored
  //  - golden duck: out on the very first ball THEY faced — including being run out attempting a
  //    run themselves on their first ball, since they did face that delivery
  //  - diamond duck: out having never faced a single ball at all. Two ways there: the classic case
  //    is a non-striker run out (dismissedName isn't who this ball's runs are credited to — see
  //    event.runsCreditTo/isDismissedTheBallFacer — meaning they weren't the one facing it), now
  //    correctly detectable since Swap Strike lets a non-striker be the one actually marked out.
  //    The other is a striker run out on a wide/no-ball before ever getting to face a fair ball —
  //    still a diamond duck even though they nominally "faced" the illegal delivery, since it
  //    never counted as a ball faced in the first place.
  if (dismissedName && cur.batsmen[dismissedName] && cur.batsmen[dismissedName].runs === 0) {
    const facedBefore = inning.batsmen[dismissedName] && inning.batsmen[dismissedName].balls || 0;
    const isDismissedTheBallFacer = dismissedName === (event.runsCreditTo || cur.strikerName);
    let duckType = "duck";
    let duckText = `${dismissedName} out for a duck`;
    if (facedBefore === 0 && event.wicketType === "Run out" && (!legalBall || !isDismissedTheBallFacer)) {
      duckType = "diamondDuck";
      duckText = `${dismissedName} out for a diamond duck`;
    } else if (facedBefore === 0) {
      duckType = "goldenDuck";
      duckText = `${dismissedName} out for a golden duck`;
    }
    cur.toastMilestones.push({
      type: duckType,
      text: duckText,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // Breakthrough: a wicket that ends a stand which had lasted a while — partnershipBallsPeak
  // (captured above, before the wicket-ball reset) is how long the JUST-ENDED partnership had run,
  // in legal balls, at the moment this wicket fell. 24 balls (4 overs) is the starting threshold —
  // long enough that ending it is genuinely a moment, not so long it rarely fires.
  const BREAKTHROUGH_BALLS = 24;
  if (event.kind === "wicket" && partnershipBallsPeak >= BREAKTHROUGH_BALLS) {
    cur.toastMilestones.push({
      type: "breakthrough",
      text: `Breakthrough! ${partnershipRunsPeak}-run stand broken after ${partnershipBallsPeak} balls`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // 3-wicket haul: this bowler's tally just reached exactly three. A step below the 5-for (which
  // stays a permanent scorecard milestone), so this one's toast-only.
  if (event.kind === "wicket" && legalBall && creditsBowler && cur.bowlers[ballBowlerName] && cur.bowlers[ballBowlerName].wickets === 3) {
    cur.toastMilestones.push({
      type: "threeFor",
      text: `${ballBowlerName} picks up a 3-wicket haul`,
      over: milestoneOver,
      score: milestoneScore
    });
  }
  // Double-wicket over: 2 wickets (any kind — run outs count too) falling in the same over. Uses
  // cur.overs[lastOverIdx], the over this ball actually landed in, which stays correct even on the
  // ball that closes the over out (lastOverIdx is captured before a fresh empty over is appended).
  if (event.kind === "wicket") {
    const wicketsThisOver = cur.overs[lastOverIdx].filter(b => b.kind === "wicket").length;
    if (wicketsThisOver === 2) {
      cur.toastMilestones.push({
        type: "doubleWicket",
        text: `Two wickets in the over for ${ballBowlerName}`,
        over: milestoneOver,
        score: milestoneScore
      });
    }
  }
  return cur;
}
