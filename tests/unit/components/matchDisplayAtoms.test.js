// Small presentational match-display components (src/components/matchDisplayAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { BallBadge, VisibilitySwitch, MatchInfoFold } from "../../../src/components/matchDisplayAtoms.js";

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
test("BallBadge: ev.bigHit gets the same gold styling as a plain six, even though its runs don't equal 6", () => {
  const sixTree = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 6, display: "6" } })).toJSON();
  const bigHitTree = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 10, display: "10", bigHit: "Big Hit" } })).toJSON();
  const plainTenRuns = renderer.create(React.createElement(BallBadge, { ev: { kind: "run", runs: 10, display: "10" } })).toJSON();
  assert.equal(bigHitTree.children[0].props.style.background, sixTree.children[0].props.style.background);
  assert.notEqual(plainTenRuns.children[0].props.style.background, sixTree.children[0].props.style.background);
});

test("VisibilitySwitch: shows Public/Private text based on isPublic, '…' while busy", () => {
  const pub = renderer.create(React.createElement(VisibilitySwitch, { isPublic: true, onChange: () => {} })).toJSON();
  assert.ok(pub.children.includes("Public"));
  const priv = renderer.create(React.createElement(VisibilitySwitch, { isPublic: false, onChange: () => {} })).toJSON();
  assert.ok(priv.children.includes("Private"));
  const busy = renderer.create(React.createElement(VisibilitySwitch, { isPublic: true, busy: true, onChange: () => {} })).toJSON();
  assert.ok(busy.children.includes("…"));
});

test("VisibilitySwitch: clicking toggles onChange with the flipped value, ignored while busy", () => {
  let seen = null;
  const notBusy = renderer.create(React.createElement(VisibilitySwitch, { isPublic: true, onChange: v => { seen = v; } })).toJSON();
  notBusy.props.onClick();
  assert.equal(seen, false);

  seen = "unchanged";
  const busy = renderer.create(React.createElement(VisibilitySwitch, { isPublic: true, busy: true, onChange: v => { seen = v; } })).toJSON();
  busy.props.onClick();
  assert.equal(seen, "unchanged");
});

test("MatchInfoFold: renders nothing when there's no toss, house rules, or umpires to show", () => {
  const tree = renderer.create(React.createElement(MatchInfoFold, { match: { toss: null, rules: null, innings: [] } })).toJSON();
  assert.equal(tree, null);
});

test("MatchInfoFold: starts collapsed, expands on click to reveal toss/rules/umpire text", () => {
  const match = {
    toss: { wonBy: "A", decision: "Bat" },
    rules: { freeHit: true },
    umpire1: "U1",
    umpire2: "U2",
    innings: []
  };
  const inst = renderer.create(React.createElement(MatchInfoFold, { match }));
  let text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /won the toss/);

  const root = inst.root;
  root.findByType("button").props.onClick();
  text = JSON.stringify(inst.toJSON());
  assert.match(text, /A won the toss, chose to bat/);
  assert.match(text, /Free Hit enabled/);
  assert.match(text, /Umpires: U1, U2/);
});
