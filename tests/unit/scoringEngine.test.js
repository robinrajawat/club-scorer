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
import { newInning, applyBall, ensureBatsman, ensureBowler } from "../../src/core/scoringEngine.js";

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
