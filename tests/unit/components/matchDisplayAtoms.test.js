// Small presentational match-display components (src/components/matchDisplayAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { BallBadge } from "../../../src/components/matchDisplayAtoms.js";

test("BallBadge: shows the ball's display text, optionally its over.ball label", () => {
  const tree = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 1, display: "1" }, label: "2.3" })).toJSON();
  assert.equal(tree.children[0].children[0], "1");
  assert.ok(tree.children[1].children.includes("2.3"));

  const noLabel = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 0, display: "•" } })).toJSON();
  assert.equal(noLabel.children.length, 1);
});

// A big/maximum hit's runs (e.g. 10) never match the plain `runs === 6` gold-six check, so without
// ev.bigHit the badge fell through to the default, unremarkable color -- looking identical to an
// ordinary single run despite being a genuine six. ev.bigHit is a truthy string ("Big Hit"/
// "Maximum Hit") in practice, but only truthiness should matter here.
// BUG FIX: this used to check ev.runs directly, which is the ball's raw total -- wrong for a
// no-ball (includes the extras penalty), an overthrow-topped-up hit (includes the bonus), and a
// bye/leg-bye (the bat was never involved at all). Any of those could coincide with 4 or 6 and get
// colored like a batted boundary that never happened. ev.battedRuns (set in applyBall) is the
// value that's actually correct for this check in every case -- see its own comment there.
test("BallBadge: a bye/leg-bye reaching the boundary never gets the batted-boundary color", () => {
  const bye = renderer.create(React.createElement(BallBadge, { ev: { kind: "bye", runs: 4, display: "B4" } })).toJSON();
  const legbye = renderer.create(React.createElement(BallBadge, { ev: { kind: "legbye", runs: 6, display: "Lb6" } })).toJSON();
  const plainFour = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 4, battedRuns: 4, display: "4" } })).toJSON();
  const plainSix = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 6, battedRuns: 6, display: "6" } })).toJSON();
  assert.notEqual(bye.children[0].props.style.background, plainFour.children[0].props.style.background);
  assert.notEqual(legbye.children[0].props.style.background, plainSix.children[0].props.style.background);
});

test("BallBadge: a genuine six off a no-ball gets the gold six color, not purple no-ball color", () => {
  // Stored runs includes the 1-run no-ball penalty (7), but battedRuns correctly says 6.
  const noballSix = renderer.create(React.createElement(BallBadge, { ev: { kind: "noball", runs: 7, battedRuns: 6, display: "Nb+6" } })).toJSON();
  const plainSix = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 6, battedRuns: 6, display: "6" } })).toJSON();
  const plainNoball = renderer.create(React.createElement(BallBadge, { ev: { kind: "noball", runs: 1, display: "Nb" } })).toJSON();
  assert.equal(noballSix.children[0].props.style.background, plainSix.children[0].props.style.background);
  assert.notEqual(noballSix.children[0].props.style.background, plainNoball.children[0].props.style.background);
});

test("BallBadge: ev.bigHit gets the same gold styling as a plain six, even though its runs don't equal 6", () => {
  const sixTree = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 6, battedRuns: 6, display: "6" } })).toJSON();
  const bigHitTree = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 10, battedRuns: 10, display: "10", bigHit: "Big Hit" } })).toJSON();
  const plainTenRuns = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 10, battedRuns: 10, display: "10" } })).toJSON();
  assert.equal(bigHitTree.children[0].props.style.background, sixTree.children[0].props.style.background);
  assert.notEqual(plainTenRuns.children[0].props.style.background, sixTree.children[0].props.style.background);
});
