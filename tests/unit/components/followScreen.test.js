// Public live-match-following page (src/components/followScreen.js). Subscribes via
// `db.collection("liveViews").doc(code).onSnapshot(onNext, onError)` -- `db` (the raw Firestore
// SDK instance, a bare global, not extracted) is stubbed with a fake onSnapshot that captures the
// success/error callbacks so tests can drive updates by calling them directly, and returns an
// unsubscribe function whose call is also tracked.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FollowScreen } from "../../../src/components/followScreen.js";
import { BallCelebration, MilestoneToast } from "../../../src/components/scoringUiAtoms.js";

afterEach(() => {
  delete globalThis.db;
});

function inning(overrides = {}) {
  return {
    battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
    runs: 85, wickets: 3, legalBalls: 72, ballsPerOver: 6,
    battingOrder: ["Virat Kohli"], bowlingOrder: ["Jasprit Bumrah"],
    batsmen: { "Virat Kohli": { runs: 50, balls: 40, fours: 5, sixes: 1, out: false } },
    bowlers: { "Jasprit Bumrah": { ballsBowled: 24, runs: 30, wickets: 1, maidens: 0 } },
    extras: {}, fallOfWickets: [], toastMilestones: [],
    strikerName: "Virat Kohli", nonStrikerName: null, bowlerName: "Jasprit Bumrah",
    complete: false, overs: [[{ kind: "run", runs: 4 }], []],
    ...overrides
  };
}

function matchWith(innings, overrides = {}) {
  return {
    teamA: "Riverside CC", teamB: "Oakwood CC",
    oversLimit: 20, currentInningIndex: innings.length - 1, status: "in-progress",
    innings,
    ...overrides
  };
}

function dbStub(captured) {
  return {
    collection: name => {
      assert.equal(name, "liveViews");
      return {
        doc: code => ({
          onSnapshot: (onNext, onError) => {
            captured.onNext = onNext;
            captured.onError = onError;
            return () => { captured.unsubscribed = true; };
          }
        })
      };
    }
  };
}

function renderScreen(captured, extraProps = {}) {
  globalThis.db = dbStub(captured);
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(FollowScreen, { code: "ABC123", onExit: () => {}, ...extraProps }));
  });
  return inst;
}

test("FollowScreen: shows a loading state until the first snapshot arrives", () => {
  const captured = {};
  const inst = renderScreen(captured);
  assert.match(JSON.stringify(inst.toJSON()), /Loading live score/);
});

test("FollowScreen: doc.exists === false shows 'Match not found'", () => {
  const captured = {};
  const inst = renderScreen(captured);
  act(() => { captured.onNext({ exists: false }); });
  assert.match(JSON.stringify(inst.toJSON()), /Match not found/);
});

test("FollowScreen: an onSnapshot error shows a friendly message", () => {
  const captured = {};
  const inst = renderScreen(captured);
  act(() => { captured.onError({ code: "permission-denied", message: "nope" }); });
  assert.match(JSON.stringify(inst.toJSON()), /isn't available right now/);
});

test("FollowScreen: a found snapshot shows the two team names and 'Live'", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const match = matchWith([inning()]);
  act(() => { captured.onNext({ exists: true, data: () => match }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
  assert.match(text, /"Live"/);
});

test("FollowScreen: a completed match shows the result text instead of 'Live'", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const complete = matchWith([
    inning({ complete: true, runs: 150 }),
    inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 120, wickets: 10, complete: true })
  ], { status: "complete" });
  act(() => { captured.onNext({ exists: true, data: () => complete }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /"Final"/);
  assert.match(text, /Riverside CC won by 30 runs/);
});

test("FollowScreen: skips the celebration on the very first snapshot, then celebrates a boundary on the next one", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const first = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => first }); });
  assert.equal(inst.root.findByType(BallCelebration).props.celebration, null);

  const withSix = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }, { kind: "run", runs: 6, battedRuns: 6 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => withSix }); });
  const celebration = inst.root.findByType(BallCelebration).props.celebration;
  assert.equal(celebration.type, 6);
});

// BUG FIX: this used to check lastBall.runs directly (the ball's raw total), so a 4-run bye/leg-bye
// -- the bat never involved at all -- wrongly triggered a boundary celebration for viewers, while a
// genuine six off a no-ball (stored total 7, including the 1-run penalty) never did. battedRuns
// (set in applyBall -- see its own comment there) is the value that's actually correct here.
test("FollowScreen: a bye reaching the boundary never celebrates, a genuine six off a no-ball always does", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const first = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => first }); });

  const withBye = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }, { kind: "bye", runs: 4 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => withBye }); });
  assert.equal(inst.root.findByType(BallCelebration).props.celebration, null);

  const withNoballSix = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }, { kind: "bye", runs: 4 }, { kind: "noball", runs: 7, battedRuns: 6 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => withNoballSix }); });
  assert.equal(inst.root.findByType(BallCelebration).props.celebration.type, 6);
});

test("FollowScreen: a new toastMilestones entry queues a MilestoneToast on the next snapshot", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const first = matchWith([inning({ toastMilestones: [] })]);
  act(() => { captured.onNext({ exists: true, data: () => first }); });
  assert.equal(inst.root.findByType(MilestoneToast).props.toast, null);

  const withMilestone = matchWith([inning({ toastMilestones: [{ type: "fifty", name: "Virat Kohli" }] })]);
  act(() => { captured.onNext({ exists: true, data: () => withMilestone }); });
  const toast = inst.root.findByType(MilestoneToast).props.toast;
  assert.equal(toast.milestone.name, "Virat Kohli");
});

test("FollowScreen: unsubscribes from the snapshot listener on unmount", () => {
  const captured = {};
  const inst = renderScreen(captured);
  act(() => { inst.unmount(); });
  assert.equal(captured.unsubscribed, true);
});

test("FollowScreen: no code shows not-found without ever calling db", () => {
  let called = false;
  globalThis.db = { collection: () => { called = true; return { doc: () => ({ onSnapshot: () => () => {} }) }; } };
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(FollowScreen, { code: "", onExit: () => {} }));
  });
  assert.equal(called, false);
  assert.match(JSON.stringify(inst.toJSON()), /Match not found/);
});
