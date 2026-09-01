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

test("BallCelebration: null with no celebration, otherwise OUT!/SIX!/FOUR! based on type", () => {
  assert.equal(renderer.create(React.createElement(BallCelebration, { celebration: null })).toJSON(), null);
  const wicketTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: "wicket", key: 1 } })).toJSON();
  assert.equal(wicketTree.children[0].children[0], "OUT!");
  const sixTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: 6, key: 2 } })).toJSON();
  assert.equal(sixTree.children[0].children[0], "SIX!");
  const fourTree = renderer.create(React.createElement(BallCelebration, { celebration: { type: 4, key: 3 } })).toJSON();
  assert.equal(fourTree.children[0].children[0], "FOUR!");
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
