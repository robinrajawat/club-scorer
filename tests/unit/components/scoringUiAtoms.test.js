// Presentational React components used on the live scoring screen (src/components/scoringUiAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import {
  RoleBadge, BallCelebration, MilestoneToast, OdometerScore, InningsTimer, SwipeableRow
} from "../../../src/components/scoringUiAtoms.js";

test("RoleBadge: renders C/WK/C·WK based on the flags, null when neither is set", () => {
  assert.equal(renderer.create(React.createElement(RoleBadge, { isCaptain: false, isKeeper: false })).toJSON(), null);
  assert.equal(renderer.create(React.createElement(RoleBadge, { isCaptain: true, isKeeper: false })).toJSON().children[0], "C");
  assert.equal(renderer.create(React.createElement(RoleBadge, { isCaptain: false, isKeeper: true })).toJSON().children[0], "WK");
  assert.equal(renderer.create(React.createElement(RoleBadge, { isCaptain: true, isKeeper: true })).toJSON().children[0], "C·WK");
});

test("RoleBadge: isImpact renders an 'IP' badge, alongside a role badge when both apply", () => {
  assert.equal(renderer.create(React.createElement(RoleBadge, { isImpact: false })).toJSON(), null);
  assert.equal(renderer.create(React.createElement(RoleBadge, { isImpact: true })).toJSON().children[0], "IP");
  const both = renderer.create(React.createElement(RoleBadge, { isCaptain: true, isImpact: true })).toJSON();
  assert.equal(both.length, 2);
  assert.equal(both[0].children[0], "C");
  assert.equal(both[1].children[0], "IP");
});

test("BallCelebration: null with no celebration, otherwise OUT!/SIX!/FOUR! based on type", () => {
  assert.equal(renderer.create(React.createElement(BallCelebration, { celebration: null })).toJSON(), null);
  const wicketTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: "wicket", key: 1 } })).toJSON();
  assert.equal(wicketTree.children[0].children[0], "OUT!");
  const sixTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: 6, key: 2 } })).toJSON();
  assert.equal(sixTree.children[0].children[0], "SIX!");
  const fourTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: 4, key: 3 } })).toJSON();
  assert.equal(fourTree.children[0].children[0], "FOUR!");
});

// A bonus-hit tier (Big Hit, Maximum Hit, or any future one) passes its own name straight through
// as celebration.type -- shown as its own uppercased text, styled gold like a six (see isSix in
// applyBall: every bonus-hit tier is a genuine six for every other purpose too), not a generic
// "SIX!" that read oddly for a ball that scored a bonus total (e.g. 10), not literally six.
test("BallCelebration: a bonus-hit tier's own label renders uppercased, styled like a six", () => {
  const bigHitTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: "Big Hit", key: 1 } })).toJSON();
  assert.equal(bigHitTree.children[0].children[0], "BIG HIT!");
  const maxHitTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: "Maximum Hit", key: 2 } })).toJSON();
  assert.equal(maxHitTree.children[0].children[0], "MAXIMUM HIT!");
  // Same gold background/text color as a plain six -- confirm it isn't accidentally styled as a four.
  const sixTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: 6, key: 3 } })).toJSON();
  assert.equal(bigHitTree.children[0].props.style.background, sixTree.children[0].props.style.background);
});

test("MilestoneToast: null with no toast, otherwise renders the milestone text and its icon", () => {
  assert.equal(renderer.create(React.createElement(MilestoneToast, { toast: null })).toJSON(), null);
  const tree = renderer.create(React.createElement(MilestoneToast, {
    toast: { key: 1, milestone: { type: "hatTrick", text: "Hat-trick for P1" } }
  })).toJSON();
  const inner = tree.children[0];
  assert.equal(inner.children[1], "Hat-trick for P1");
});

test("OdometerScore: renders one nested span pair per character", () => {
  const tree = renderer.create(React.createElement(OdometerScore, { text: "42" })).toJSON();
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].children[0].children[0], "4");
  assert.equal(tree.children[1].children[0].children[0], "2");
});

test("InningsTimer: renders nothing at all without a startedAt (and starts no timer to clean up)", () => {
  const inst = renderer.create(React.createElement(InningsTimer, { startedAt: null }));
  assert.equal(inst.toJSON(), null);
  inst.unmount();
});

test("InningsTimer: shows minutes elapsed, hours once over 60 minutes", () => {
  // Unmount after each assertion -- the component's useEffect starts a setInterval (ticking the
  // display once a minute) that's only cleared on unmount; leaving it running keeps the test
  // process alive indefinitely instead of exiting once tests finish.
  const fiveMinAgo = Date.now() - 5 * 60000;
  const inst1 = renderer.create(React.createElement(InningsTimer, { startedAt: fiveMinAgo }));
  assert.equal(inst1.toJSON().children[1], "5m");
  inst1.unmount();

  const ninetyMinAgo = Date.now() - 90 * 60000;
  const inst2 = renderer.create(React.createElement(InningsTimer, { startedAt: ninetyMinAgo }));
  assert.equal(inst2.toJSON().children[1], "1h 30m");
  inst2.unmount();
});

test("SwipeableRow: renders its children and a delete button with the given label", () => {
  const tree = renderer.create(React.createElement(SwipeableRow, { onDelete: () => {}, deleteLabel: "Remove" },
    React.createElement("span", null, "row content")
  )).toJSON();
  // First child is the reveal-on-swipe delete button layer, second is the row content itself.
  const deleteButton = tree.children[0].children[0];
  assert.equal(deleteButton.type, "button");
  assert.ok(deleteButton.children.includes("Remove"));
  const rowContent = tree.children[1];
  assert.equal(rowContent.children[0].children[0], "row content");
});
