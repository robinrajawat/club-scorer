// A roster picker and the "have a match code" join bar (src/components/pickerAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { PlayerPicker, JoinCodeBar } from "../../../src/components/pickerAtoms.js";
import { RoleBadge } from "../../../src/components/scoringUiAtoms.js";

test("PlayerPicker: renders one button per roster name (minus excluded ones), calls onChange on click", () => {
  let picked = null;
  const root = renderer.create(React.createElement(PlayerPicker, {
    roster: ["P1", "P2", "P3"], value: null, exclude: "P2", onChange: n => { picked = n; }
  })).root;
  const buttons = root.findAllByType("button");
  assert.equal(buttons.length, 2); // P2 excluded
  buttons[0].props.onClick();
  assert.equal(picked, "P1");
});

test("PlayerPicker: falls back to a plain TextField when there's no roster to pick from", () => {
  const tree = renderer.create(React.createElement(PlayerPicker, {
    roster: [], value: "typed name", onChange: () => {}, placeholder: "Enter a name"
  })).toJSON();
  assert.equal(tree.type, "input");
  assert.equal(tree.props.value, "typed name");
});

test("PlayerPicker: shows the captain/keeper role badge next to the matching name", () => {
  const inst = renderer.create(React.createElement(PlayerPicker, {
    roster: ["P1", "P2"], value: null, onChange: () => {}, captain: "P1"
  }));
  const badges = inst.root.findAllByType(RoleBadge);
  assert.equal(badges.length, 2);
  assert.equal(badges[0].props.isCaptain, true, "P1's badge flagged as captain");
  assert.equal(badges[1].props.isCaptain, false, "P2's badge not flagged as captain");
});

test("JoinCodeBar: collapsed by default, expands to a text field + Join button on click", () => {
  const inst = renderer.create(React.createElement(JoinCodeBar, { onJoin: async () => ({ ok: true }) }));
  let text = JSON.stringify(inst.toJSON());
  assert.match(text, /Have a match code/);
  assert.doesNotMatch(text, /Enter code/);

  act(() => {
    inst.root.findByType("button").props.onClick();
  });
  text = JSON.stringify(inst.toJSON());
  assert.match(text, /Enter code/);
});

test("JoinCodeBar: submitting a valid code cleans/uppercases it and calls onJoin", async () => {
  let submittedWith = null;
  const onJoin = async code => { submittedWith = code; return { ok: true }; };
  const inst = renderer.create(React.createElement(JoinCodeBar, { onJoin }));
  act(() => { inst.root.findByType("button").props.onClick(); }); // open
  const input = inst.root.findByType("input");
  act(() => { input.props.onChange({ target: { value: "ab-cd 12" } }); });
  const joinButton = inst.root.findAllByType("button").find(b => b.props.children === "Join");
  await act(async () => { await joinButton.props.onClick(); });
  assert.equal(submittedWith, "ABCD12");
});

test("JoinCodeBar: shows the server's error message when onJoin reports failure", async () => {
  const onJoin = async () => ({ ok: false, error: "No match found for that code." });
  const inst = renderer.create(React.createElement(JoinCodeBar, { onJoin }));
  act(() => { inst.root.findByType("button").props.onClick(); }); // open
  const input = inst.root.findByType("input");
  act(() => { input.props.onChange({ target: { value: "XYZ" } }); });
  const joinButton = inst.root.findAllByType("button").find(b => b.props.children === "Join");
  await act(async () => { await joinButton.props.onClick(); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /No match found for that code\./);
});
