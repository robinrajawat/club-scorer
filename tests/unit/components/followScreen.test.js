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

// FollowScreen now keeps a real setInterval alive for as long as it's mounted (the staleness
// hint's clock -- see followScreen.js). None of these tests unmount their own instance (most
// don't need to, for everything else they check), so left alone that timer would keep node:test's
// process alive past every synchronous assertion finishing, since a live interval blocks a clean
// exit the same way an open server handle would. Tracking every rendered instance here and
// unmounting each in afterEach -- rather than adding an unmount call to every test -- fixes this
// once, for all of them, regardless of which helper below created the instance.
const renderedInstances = [];
// Node has a built-in read-only `navigator` global (getter-only, no setter) since Node 21, so a
// plain `globalThis.navigator = ...` assignment throws -- redefine the property instead, same
// pattern shareMenus.test.js already uses for the same reason.
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}
afterEach(() => {
  delete globalThis.db;
  delete globalThis.navigator;
  while (renderedInstances.length > 0) {
    const inst = renderedInstances.pop();
    // One test unmounts its own instance already (to assert on the resulting unsubscribe) --
    // react-test-renderer's unmount is idempotent, but wrapped defensively anyway since a second
    // call here is purely a cleanup nicety, not something worth a test failure over either way.
    try {
      act(() => { inst.unmount(); });
    } catch (e) { /* already unmounted */ }
  }
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

function dbStub(captured, expectedCollection = "liveViews") {
  return {
    collection: name => {
      assert.equal(name, expectedCollection);
      return {
        doc: idOrCode => {
          captured.docId = idOrCode;
          return {
            onSnapshot: (onNext, onError) => {
              captured.onNext = onNext;
              captured.onError = onError;
              return () => { captured.unsubscribed = true; };
            }
          };
        }
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
  renderedInstances.push(inst);
  return inst;
}

test("FollowScreen: shows a loading state until the first snapshot arrives", () => {
  const captured = {};
  const inst = renderScreen(captured);
  assert.match(JSON.stringify(inst.toJSON()), /Loading live score/);
});

test("FollowScreen: a matchId prop (Home screen's Live now feed) subscribes to liveMatches/{matchId} instead of liveViews/{code}", () => {
  const captured = {};
  globalThis.db = dbStub(captured, "liveMatches");
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(FollowScreen, { matchId: "m42", onExit: () => {} }));
  });
  renderedInstances.push(inst);
  assert.equal(captured.docId, "m42");
  act(() => { captured.onNext({ exists: true, data: () => matchWith([inning()]) }); });
  assert.match(JSON.stringify(inst.toJSON()), /Riverside CC/);
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

test("FollowScreen: shows no last-ball commentary on the first snapshot, then a persistent line for the next ball, cleared on a new innings", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const first = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => first }); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /SIX!|FOUR!|OUT!/);

  const withSix = matchWith([inning({ overs: [[{ kind: "run", runs: 1 }, { kind: "run", runs: 6, battedRuns: 6 }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => withSix }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Jasprit Bumrah to Virat Kohli/);
  assert.match(text, /SIX!/);

  // A second innings starting fresh (a new inningIdx, ballCount reset) clears the stale line from
  // the innings that just ended rather than leaving a misleading "last ball" up.
  const secondInnings = matchWith([
    inning({ overs: [[{ kind: "run", runs: 1 }, { kind: "run", runs: 6, battedRuns: 6 }]] }),
    inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", overs: [[]] })
  ], { currentInningIndex: 1 });
  act(() => { captured.onNext({ exists: true, data: () => secondInnings }); });
  // Not "SIX!" alone -- the boundary-pop celebration banner from the earlier snapshot also renders
  // that word and (deliberately, separately) only clears itself on its own timer, not on this
  // reset. The lead text ("X to Y: ") only ever comes from ballCommentary, so it's the one string
  // that actually proves the STALE COMMENTARY LINE specifically was cleared.
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Jasprit Bumrah to Virat Kohli/);
});

test("FollowScreen: a completed over shows a summary popup (bowler, ball-by-ball, runs/wickets), replacing last-ball commentary, until a real ball lands in the next over", () => {
  const captured = {};
  const inst = renderScreen(captured);
  const midOver = matchWith([inning({ overs: [[{ kind: "run", runs: 1, display: "1" }, { kind: "run", runs: 4, battedRuns: 4, display: "4" }]] })]);
  act(() => { captured.onNext({ exists: true, data: () => midOver }); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /"Over ","1"," ·/);

  const overComplete = matchWith([inning({
    overs: [[
      { kind: "run", runs: 1, display: "1" }, { kind: "run", runs: 4, battedRuns: 4, display: "4" },
      { kind: "wicket", display: "W" }, { kind: "run", runs: 0, display: "•" },
      { kind: "run", runs: 6, battedRuns: 6, display: "6" }, { kind: "run", runs: 1, display: "1" }
    ], []],
    fallOfWickets: [{ batsman: "Virat Kohli" }],
    batsmen: { "Virat Kohli": { runs: 50, balls: 40, fours: 5, sixes: 1, out: true, how: "b Bumrah" } }
  })]);
  act(() => { captured.onNext({ exists: true, data: () => overComplete }); });
  let text = JSON.stringify(inst.toJSON());
  // JSON.stringify keeps each JSX child as its own quoted array element, so these match the
  // split form ("Over ","1"," · Jasprit Bumrah") rather than one contiguous string.
  assert.match(text, /"Over ","1"," · Jasprit Bumrah"/);
  assert.match(text, /"12"," run","s",", 1 wkt"/);
  assert.match(text, /"6"/); // the six's BallBadge display
  // Last-ball commentary is suppressed while the over summary is showing -- would otherwise
  // duplicate the same ball (a six) the summary already lists.
  assert.doesNotMatch(text, /Jasprit Bumrah to Virat Kohli/);

  const nextBall = matchWith([inning({
    overs: [[
      { kind: "run", runs: 1 }, { kind: "run", runs: 4, battedRuns: 4 }, { kind: "wicket" },
      { kind: "run", runs: 0 }, { kind: "run", runs: 6, battedRuns: 6 }, { kind: "run", runs: 1 }
    ], [{ kind: "run", runs: 1 }]]
  })]);
  act(() => { captured.onNext({ exists: true, data: () => nextBall }); });
  text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /"Over ","1"," ·/);
  assert.match(text, /Jasprit Bumrah to Virat Kohli/);
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
  renderedInstances.push(inst);
  assert.equal(called, false);
  assert.match(JSON.stringify(inst.toJSON()), /Match not found/);
});

test("FollowScreen: Share prefers navigator.share, passing the follow-code URL, when available", () => {
  const captured = {};
  const inst = renderScreen(captured);
  act(() => { captured.onNext({ exists: true, data: () => matchWith([inning()]) }); });
  let shared = null;
  setNavigator({ share: opts => { shared = opts; return Promise.resolve(); } });
  const shareBtn = inst.root.findByProps({ "aria-label": "Share this match" });
  act(() => { shareBtn.props.onClick(); });
  assert.ok(shared);
  assert.match(shared.url, /follow=ABC123/);
  assert.match(shared.title, /Riverside CC/);
});

test("FollowScreen: Share falls back to a clipboard copy (with the matchId-based URL) when there's no navigator.share, and flashes 'Copied!'", () => {
  const captured = {};
  globalThis.db = { collection: () => ({ doc: () => ({ onSnapshot: onNext => { captured.onNext = onNext; return () => {}; } }) }) };
  let inst;
  act(() => { inst = renderer.create(React.createElement(FollowScreen, { matchId: "m42", onExit: () => {} })); });
  renderedInstances.push(inst);
  act(() => { captured.onNext({ exists: true, data: () => matchWith([inning()]) }); });
  let copied = null;
  setNavigator({ clipboard: { writeText: url => { copied = url; return Promise.resolve(); } } });
  const shareBtn = inst.root.findByProps({ "aria-label": "Share this match" });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Copied!/);
  act(() => { shareBtn.props.onClick(); });
  assert.match(copied, /followMatch=m42/);
  assert.match(JSON.stringify(inst.toJSON()), /Copied!/);
});

test("FollowScreen: shows a 'no updates in a while' hint only once several minutes pass with no new snapshot on a still-live match", t => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  const captured = {};
  const inst = renderScreen(captured);
  act(() => { captured.onNext({ exists: true, data: () => matchWith([inning()]) }); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /No updates in a while/);

  // Under 3 minutes: still ordinary -- a gap between overs, a wicket, a field change.
  act(() => { t.mock.timers.tick(90 * 1000); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /No updates in a while/);

  // Past 3 minutes with nothing new: worth a gentle nudge.
  act(() => { t.mock.timers.tick(2 * 60 * 1000); });
  assert.match(JSON.stringify(inst.toJSON()), /No updates in a while/);

  // A fresh snapshot arriving resets the clock -- the hint clears immediately rather than
  // lingering until the next tick.
  act(() => { captured.onNext({ exists: true, data: () => matchWith([inning({ overs: [[{ kind: "run", runs: 1 }]] })]) }); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /No updates in a while/);
});

test("FollowScreen: never shows the staleness hint on a completed match", t => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  const captured = {};
  const inst = renderScreen(captured);
  const complete = matchWith([inning({ complete: true })], { status: "complete" });
  act(() => { captured.onNext({ exists: true, data: () => complete }); });
  act(() => { t.mock.timers.tick(10 * 60 * 1000); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /No updates in a while/);
});
