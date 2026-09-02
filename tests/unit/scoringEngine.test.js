// Regression suite for the ball-by-ball scoring engine (src/core/scoringEngine.js).
//
// Each case here exists because of a real bug that reached production and was hard to trace once
// it did:
//   - "golden duck reappears as pickable" — a dismissed batsman's own replacement, if dismissed
//     before ever facing a run ball, had no record yet and could be picked again on the very
//     wicket that got them out.
//   - "empty bowler key corrupts sync" — a ball scored with no bowler assigned silently created a
//     literal empty-string key in inning.bowlers, which Firestore then rejected wholesale on the
//     next sync with an error that gave no indication of where the problem was.
// Both were only found after real (production) reports. This suite exists so the NEXT bug in this
// family fails `npm test` instead of a phone screen days or weeks later.

import test from "node:test";
import assert from "node:assert/strict";
import { newInning, applyBall, ensureBatsman, ensureBowler, isWideNoballLegal, isInLastOvers, retirementCapDue, retirementCapThreshold } from "../../src/core/scoringEngine.js";

const rules = { ballsPerOver: 6, wideRuns: 1, noballRuns: 1, freeHit: true };

function freshInning(maxWickets, roster) {
  const inn = newInning("TeamA", "TeamB", rules, maxWickets != null ? maxWickets : 10);
  inn.strikerName = roster[0];
  inn.nonStrikerName = roster[1];
  ensureBatsman(inn, roster[0]);
  ensureBatsman(inn, roster[1]);
  inn.bowlerName = "B1";
  ensureBowler(inn, "B1");
  return inn;
}

function excludeListFor(inn, justRetiredName) {
  return Object.keys(inn.batsmen).filter(
    n => n === justRetiredName || !(inn.batsmen[n].retiredHurt && !inn.batsmen[n].out)
  );
}

function poolFor(roster, inn, justRetiredName) {
  const excluded = new Set(excludeListFor(inn, justRetiredName));
  return roster.filter(n => !excluded.has(n));
}

function bowl(inn, opts) {
  return applyBall(inn, {
    kind: "wicket",
    wicketType: "Bowled",
    legal: true,
    runsBeforeWicket: 0,
    runsCreditTo: inn.strikerName,
    ...opts
  });
}

test("golden duck: replacement batsman not selectable on the wicket that just dismissed them", () => {
  const roster = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11"];
  let inn = freshInning(10, roster);
  inn = bowl(inn, { newBatsman: "P3" }); // wicket 1: P1 out, P3 comes in
  const pool = poolFor(roster, inn, null);
  assert.ok(!pool.includes("P3"), `pool was [${pool.join(", ")}]`);
});

test("full collapse: innings ends cleanly on the last wicket, no already-out/currently-batting name reappears", () => {
  const roster = Array.from({ length: 11 }, (_, i) => "P" + (i + 1));
  const maxWickets = 10;
  let inn = freshInning(maxWickets, roster);
  let clean = true;
  let ended = false;
  for (let i = 1; i <= maxWickets; i++) {
    if (!inn.bowlerName) {
      inn.bowlerName = "B1"; // rotate back to the same bowler between overs — irrelevant to this test
      ensureBowler(inn, "B1");
    }
    const isLast = inn.wickets + 1 >= maxWickets;
    if (isLast) {
      inn = bowl(inn, { newBatsman: "" });
      ended = true;
      break;
    }
    const pool = poolFor(roster, inn, null);
    const bad = pool.filter(n => (inn.batsmen[n] && inn.batsmen[n].out) || n === inn.strikerName || n === inn.nonStrikerName);
    if (bad.length) clean = false;
    inn = bowl(inn, { newBatsman: pool[0] });
  }
  assert.ok(ended);
  assert.ok(clean);
});

test("retire hurt: excluded immediately, clears on return, correctly recorded as active striker", () => {
  const roster = ["P1", "P2", "P3", "P4", "P5"];
  let inn = freshInning(10, roster);
  inn = { ...inn, batsmen: { ...inn.batsmen, P1: { ...inn.batsmen.P1, retiredHurt: true } }, strikerName: "" };
  let pool = poolFor(roster, inn, "P1");
  assert.ok(!pool.includes("P1"), "retiring batsman excluded immediately (justRetiredName)");
  inn = { ...inn, strikerName: "P3" };
  ensureBatsman(inn, "P3");
  inn = bowl(inn, { runsCreditTo: "P3", newBatsman: "P1" }); // P3 out, P1 returns
  assert.ok(!inn.batsmen.P1.retiredHurt, "retiredHurt cleared once the batsman returns");
  assert.equal(inn.strikerName, "P1", "P1 correctly recorded as active striker again");
});

test("swap-strike run out: correct batsman marked out, the other credited the run", () => {
  const roster = ["P1", "P2", "P3"];
  let inn = freshInning(10, roster);
  inn = { ...inn, strikerName: "P2", nonStrikerName: "P1" }; // simulates Swap Strike in the wicket popup
  inn = applyBall(inn, {
    kind: "wicket",
    wicketType: "Run out",
    legal: true,
    runsBeforeWicket: 1,
    runsCreditTo: "P1",
    newBatsman: "P3"
  });
  assert.equal(inn.batsmen.P2.out, true);
  assert.notEqual(inn.batsmen.P1.out, true);
  assert.equal(inn.batsmen.P1.runs, 1);
});

test("hat-trick spans an over boundary for the same bowler", () => {
  let inn = freshInning(10, ["B1", "B2", "B3", "B4", "B5"]);
  inn.bowlerName = "A";
  ensureBowler(inn, "A");
  for (let i = 0; i < 5; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
  inn = bowl(inn, { newBatsman: "B3" }); // over 1 ball 6 — wicket 1
  inn.bowlerName = "A";
  ensureBowler(inn, "A");
  inn = bowl(inn, { runsCreditTo: "B3", newBatsman: "B4" }); // over 2 ball 1 — wicket 2
  inn = bowl(inn, { runsCreditTo: "B4", newBatsman: "B5" }); // over 2 ball 2 — wicket 3
  assert.ok(inn.milestones.some(m => m.type === "hatTrick"));
});

test("hat-trick survives an intervening over bowled by someone else", () => {
  let inn = freshInning(10, ["B1", "B2", "B3", "B4", "B5"]);
  inn.bowlerName = "A";
  ensureBowler(inn, "A");
  for (let i = 0; i < 5; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
  inn = bowl(inn, { newBatsman: "B3" }); // over 1 ball 6 — wicket 1 by A
  inn.bowlerName = "C";
  ensureBowler(inn, "C");
  for (let i = 0; i < 6; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 }); // full wicketless over by C
  inn.bowlerName = "A";
  ensureBowler(inn, "A");
  inn = bowl(inn, { runsCreditTo: "B3", newBatsman: "B4" }); // over 3 ball 1 — wicket 2 by A
  inn = bowl(inn, { runsCreditTo: "B4", newBatsman: "B5" }); // over 3 ball 2 — wicket 3 by A
  assert.ok(inn.milestones.some(m => m.type === "hatTrick"));
});

test("a wide between two wickets does not break the hat-trick streak", () => {
  let inn = freshInning(10, ["B1", "B2", "B3", "B4", "B5"]);
  inn.bowlerName = "A";
  ensureBowler(inn, "A");
  for (let i = 0; i < 5; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
  inn = bowl(inn, { newBatsman: "B3" });
  inn.bowlerName = "A";
  ensureBowler(inn, "A");
  inn = bowl(inn, { runsCreditTo: "B3", newBatsman: "B4" });
  inn = applyBall(inn, { kind: "wide", runs: 1 });
  inn = bowl(inn, { runsCreditTo: "B4", newBatsman: "B5" });
  assert.ok(inn.milestones.some(m => m.type === "hatTrick"));
});

test("a ball scored with no bowler assigned is refused, not silently corrupted", () => {
  const inn = freshInning(10, ["P1", "P2"]);
  const corrupted = { ...inn, bowlerName: "" };
  const before = JSON.stringify(corrupted);
  const after = applyBall(corrupted, { kind: "run", legal: true, runs: 1 });
  assert.equal(JSON.stringify(after), before, "inning left unchanged");
  assert.ok(!Object.prototype.hasOwnProperty.call(after.bowlers, ""), "no empty-string key created in bowlers");
});

test("a ball scored with no striker assigned is refused, not silently corrupted", () => {
  const inn = freshInning(10, ["P1", "P2"]);
  const corrupted = { ...inn, strikerName: "" };
  const before = JSON.stringify(corrupted);
  const after = applyBall(corrupted, { kind: "wicket", wicketType: "Bowled", legal: true, runsBeforeWicket: 0, runsCreditTo: "P2", newBatsman: "P3" });
  assert.equal(JSON.stringify(after), before);
});

test("penalty still applies despite no striker/bowler (they don't need one)", () => {
  const inn = freshInning(10, ["P1", "P2"]);
  const corrupted = { ...inn, strikerName: "", bowlerName: "" };
  const before = corrupted.runs || 0;
  const after = applyBall(corrupted, { kind: "penalty", runs: 5 });
  assert.equal(after.runs, before + 5);
});

// wideNoballCountsAsBall (final-over wide/no-ball illegal-again switch) -- a wide/no-ball is
// always illegal (re-bowled) per the standard Laws unless this house rule is on, in which case
// it counts as a legal ball everywhere EXCEPT the innings' final over, where it reverts to the
// standard illegal behavior.
function finalOverInning(overrides, oversLimit) {
  const inn = newInning("TeamA", "TeamB", { ...rules, ...overrides }, 10, oversLimit);
  inn.strikerName = "P1";
  inn.nonStrikerName = "P2";
  ensureBatsman(inn, "P1");
  ensureBatsman(inn, "P2");
  inn.bowlerName = "B1";
  ensureBowler(inn, "B1");
  return inn;
}

test("wideNoballCountsAsBall off (default): a wide never counts as a legal ball, in any over", () => {
  const inn = finalOverInning({ wideNoballCountsAsBall: false }, 2);
  const after = applyBall(inn, { kind: "wide", runs: 0 });
  assert.equal(after.legalBalls, 0, "wide doesn't advance the over");
});

test("wideNoballCountsAsBall on: a wide counts as a legal ball in a non-final over", () => {
  let inn = finalOverInning({ wideNoballCountsAsBall: true }, 2);
  inn = applyBall(inn, { kind: "wide", runs: 0 });
  assert.equal(inn.legalBalls, 1, "wide advances the over, over 1 of 2 isn't the final over");
});

test("wideNoballCountsAsBall on, with lastOverRules off: a no-ball still counts as legal in what would be the final over -- there's no exception without opting in", () => {
  let inn = finalOverInning({ wideNoballCountsAsBall: true }, 2);
  for (let i = 0; i < 6; i++) inn = applyBall(inn, { kind: "run", runs: 0 });
  assert.equal(inn.legalBalls, 6, "first over complete, now bowling the final over");
  inn.bowlerName = "B2";
  ensureBowler(inn, "B2");
  inn = applyBall(inn, { kind: "noball", runs: 0 });
  assert.equal(inn.legalBalls, 7, "no lastOverRules exception configured, so it advances the over like any other over");
});

test("lastOverRules.wideNoballIllegalAgain: a no-ball reverts to illegal (re-bowled) in the configured last over(s)", () => {
  let inn = finalOverInning({
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: true }
  }, 2);
  // Complete the first (non-final) over with 6 legal runs balls.
  for (let i = 0; i < 6; i++) inn = applyBall(inn, { kind: "run", runs: 0 });
  assert.equal(inn.legalBalls, 6, "first over complete, now bowling the final over");
  inn.bowlerName = "B2";
  ensureBowler(inn, "B2");
  inn = applyBall(inn, { kind: "noball", runs: 0 });
  assert.equal(inn.legalBalls, 6, "no-ball in the last over doesn't advance it, must be re-bowled");
});

test("lastOverRules.enabled without wideNoballIllegalAgain: last-over window exists, but this specific rule stays off", () => {
  let inn = finalOverInning({
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: false }
  }, 2);
  for (let i = 0; i < 6; i++) inn = applyBall(inn, { kind: "run", runs: 0 });
  inn.bowlerName = "B2";
  ensureBowler(inn, "B2");
  inn = applyBall(inn, { kind: "noball", runs: 0 });
  assert.equal(inn.legalBalls, 7, "wideNoballIllegalAgain is off, so the last-over window has no effect on legality");
});

test("isWideNoballLegal: with no oversLimit baked in, no last-over cutoff can ever apply", () => {
  const inn = finalOverInning({
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: true }
  }, undefined);
  assert.equal(inn.oversLimit, null);
  assert.equal(isWideNoballLegal(inn), true);
});

test("isInLastOvers: overCount controls how many overs from the end count as last over(s)", () => {
  let inn = finalOverInning({
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 2, wideNoballIllegalAgain: true }
  }, 3);
  // Over 1 of 3 -- not within the last 2 overs yet.
  assert.equal(isInLastOvers(inn), false);
  for (let i = 0; i < 6; i++) inn = applyBall(inn, { kind: "run", runs: 0 });
  // Over 2 of 3 -- IS within the last 2 overs (overs 2 and 3).
  assert.equal(isInLastOvers(inn), true);
});

// A retired batsman's `runs` is never reset when they return (ensureBatsman only clears the
// retiredHurt/retiredAtCap flags) -- without retirementCapDue's own capRetiredThreshold check,
// the mandatory retire prompt would immediately fire again the instant they're confirmed back as
// active, since their runs already sit at/past the cap from their first stint. This was a real,
// unplayable infinite-loop bug once every remaining batsman was in this state.
test("retirementCapDue: due once a batsman reaches the cap for the first time", () => {
  assert.equal(retirementCapDue({ runs: 24 }, 25), false);
  assert.equal(retirementCapDue({ runs: 25 }, 25), true);
  assert.equal(retirementCapDue({ runs: 30 }, 25), true);
});

test("retirementCapDue: not due again on return, since capRetiredThreshold already covers this stint's runs", () => {
  const returned = { runs: 25, capRetiredThreshold: 25 };
  assert.equal(retirementCapDue(returned, 25), false);
});

test("retirementCapDue: due again once a returned batsman crosses the NEXT multiple of the cap", () => {
  const returned = { runs: 49, capRetiredThreshold: 25 };
  assert.equal(retirementCapDue(returned, 25), false, "still short of the next 25-run multiple (50)");
  assert.equal(retirementCapDue({ runs: 50, capRetiredThreshold: 25 }, 25), true);
});

test("retirementCapThreshold: rounds down to the nearest multiple of the cap", () => {
  assert.equal(retirementCapThreshold(30, 25), 25);
  assert.equal(retirementCapThreshold(50, 25), 50);
  assert.equal(retirementCapThreshold(24, 25), 0);
});
