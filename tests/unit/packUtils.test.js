// Firestore write-shaping/validation helpers (src/core/packUtils.js).
//
// "empty bowler key corrupts sync" reached production because a ball scored with no bowler
// assigned silently created a literal empty-string key in inning.bowlers, which Firestore then
// rejected wholesale on the next sync with an error that gave no indication of where the problem
// was. This suite exists so the next case in this family fails `npm test`, not a phone screen.

import test from "node:test";
import assert from "node:assert/strict";
import { packMatchForFirestore, findEmptyKeyPath, unpackMatchFromFirestore } from "../../src/core/packUtils.js";
import { newInning, applyBall, ensureBatsman, ensureBowler } from "../../src/core/scoringEngine.js";

test("findEmptyKeyPath finds an injected empty batsmen key, ignores empty string values", () => {
  const bad = { innings: [{ batsmen: { P1: {}, "": {} } }] };
  assert.equal(findEmptyKeyPath(bad, ""), "innings[0].batsmen");
  const ok = { strikerName: "", innings: [{ batsmen: { P1: {} } }] };
  assert.equal(findEmptyKeyPath(ok, ""), null);
});

test("a normal over of real scoring never produces an empty-string key anywhere once packed", () => {
  const rules = { ballsPerOver: 6, wideRuns: 1, noballRuns: 1, freeHit: true };
  const roster = ["P1", "P2", "P3", "P4", "P5"];
  let inn = newInning("TeamA", "TeamB", rules, 10);
  inn.strikerName = roster[0];
  inn.nonStrikerName = roster[1];
  ensureBatsman(inn, roster[0]);
  ensureBatsman(inn, roster[1]);
  inn.bowlerName = "B1";
  ensureBowler(inn, "B1");

  inn = applyBall(inn, { kind: "run", legal: true, runs: 1 });
  inn = applyBall(inn, { kind: "run", legal: true, runs: 4 });
  inn = applyBall(inn, { kind: "wide", runs: 1 });
  inn = applyBall(inn, {
    kind: "wicket", wicketType: "Bowled", legal: true, runsBeforeWicket: 0,
    runsCreditTo: inn.strikerName, newBatsman: "P3"
  });
  inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
  inn = applyBall(inn, { kind: "run", legal: true, runs: 6 });

  const packed = packMatchForFirestore({ id: "test", innings: [inn] });
  assert.equal(findEmptyKeyPath(packed, ""), null);
});

// Real, currently-reported production bug: "Function Transaction.set() called with invalid data.
// Unsupported field value: undefined". applyBall's shared ball-log push (scoringEngine.js) sets
// `bigHit: event.bigHit || undefined` unconditionally, on every single ball -- not just bonus
// hits -- so a plain run/wide/wicket/etc. genuinely has a `bigHit` key whose value is the JS
// primitive `undefined`, not merely a key that was never set. Firestore's client SDK rejects that
// outright, and packMatchForFirestore previously passed it straight through unchanged.
test("packMatchForFirestore: strips a field that's explicitly undefined (e.g. a plain ball's bigHit), not just missing", () => {
  const rules = { ballsPerOver: 6, wideRuns: 1, noballRuns: 1, freeHit: true };
  let inn = newInning("TeamA", "TeamB", rules, 10);
  inn.strikerName = "P1";
  inn.nonStrikerName = "P2";
  ensureBatsman(inn, "P1");
  ensureBatsman(inn, "P2");
  inn.bowlerName = "B1";
  ensureBowler(inn, "B1");
  inn = applyBall(inn, { kind: "run", runs: 1 });
  assert.equal("bigHit" in inn.overs[0][0], true, "sanity check -- applyBall really sets the key to undefined, doesn't just skip it");
  assert.equal(inn.overs[0][0].bigHit, undefined);

  const packed = packMatchForFirestore({ id: "test", innings: [inn] });
  assert.equal("bigHit" in packed.innings[0].overs[0].balls[0], false, "the key must be gone entirely -- Firestore rejects an explicit undefined the same as it would reject the key existing at all");
});

test("unpackMatchFromFirestore: round-trips packMatchForFirestore's overs-wrapping back to plain arrays", () => {
  const match = { id: "test", innings: [{ overs: [[{ kind: "run", runs: 1 }], []] }] };
  const packed = packMatchForFirestore(match);
  const unpacked = unpackMatchFromFirestore(packed);
  assert.deepEqual(unpacked.innings[0].overs, match.innings[0].overs);
});

test("unpackMatchFromFirestore: normalizes a malformed non-array overs entry to [] instead of crashing downstream", () => {
  const malformed = { id: "test", innings: [{ overs: [{ notAnArray: true }, null, [{ kind: "run" }]] }] };
  const unpacked = unpackMatchFromFirestore(malformed);
  assert.deepEqual(unpacked.innings[0].overs, [[], [], [{ kind: "run" }]]);
});
