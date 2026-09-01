// Squad -> playing-XI picker (src/components/playingXIPicker.js). Every callback is a prop, no
// bare globals, so no stubbing is needed at all.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { PlayingXIPicker } from "../../../src/components/playingXIPicker.js";

const squad = [{ name: "Virat Kohli" }, { name: "Rohit Sharma" }, { name: "Jasprit Bumrah" }];

test("PlayingXIPicker: shows selected count, toggles a player in via onToggle", () => {
  let toggled = null;
  const inst = renderer.create(React.createElement(PlayingXIPicker, {
    label: "Playing XI", squad, selected: [], required: 2, onToggle: name => { toggled = name; }
  }));
  assert.match(JSON.stringify(inst.toJSON()), /"0","\/","2"/);
  const btn = inst.root.findAllByType("button")[0];
  btn.props.onClick();
  assert.equal(toggled, "Virat Kohli");
});

test("PlayingXIPicker: pool players beyond `required` selected are disabled", () => {
  const inst = renderer.create(React.createElement(PlayingXIPicker, {
    label: "Playing XI", squad, selected: ["Virat Kohli", "Rohit Sharma"], required: 2, onToggle: () => {}
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /"2","\/","2"/);
  // The one remaining pool player (not yet selected) is shown, but disabled -- the XI is full.
  const poolBtn = inst.root.findAllByType("button").find(b => Array.isArray(b.props.children) && b.props.children.includes("Jasprit Bumrah"));
  assert.equal(poolBtn.props.disabled, true);
});

test("PlayingXIPicker: with onSetCaptain/onSetKeeper, a selected pill gets C/WK buttons that toggle", () => {
  let captainSet = null, keeperSet = null;
  const inst = renderer.create(React.createElement(PlayingXIPicker, {
    label: "Playing XI", squad, selected: ["Virat Kohli"], required: 2,
    onToggle: () => {}, onSetCaptain: n => { captainSet = n; }, onSetKeeper: n => { keeperSet = n; }
  }));
  const captainBtn = inst.root.findByProps({ "aria-label": "Make Virat Kohli captain" });
  captainBtn.props.onClick();
  assert.equal(captainSet, "Virat Kohli");
  const keeperBtn = inst.root.findByProps({ "aria-label": "Make Virat Kohli wicketkeeper" });
  keeperBtn.props.onClick();
  assert.equal(keeperSet, "Virat Kohli");
});

test("PlayingXIPicker: with onNumberChange, a selected pill gets a jersey-number input", () => {
  let numberChange = null;
  const inst = renderer.create(React.createElement(PlayingXIPicker, {
    label: "Playing XI", squad, selected: ["Virat Kohli"], required: 2,
    onToggle: () => {}, numbers: {}, onNumberChange: (name, value) => { numberChange = { name, value }; }
  }));
  const input = inst.root.findByProps({ "aria-label": "Jersey number for Virat Kohli (this match only)" });
  input.props.onChange({ target: { value: "18a" } });
  assert.deepEqual(numberChange, { name: "Virat Kohli", value: "18" });
});

test("PlayingXIPicker: search box appears once the squad exceeds 15 and filters the pool", () => {
  const bigSquad = Array.from({ length: 20 }, (_, i) => ({ name: `Player ${i + 1}` }));
  const inst = renderer.create(React.createElement(PlayingXIPicker, {
    label: "Playing XI", squad: bigSquad, selected: [], required: 11, onToggle: () => {}
  }));
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "Player 3" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Player 3/);
  assert.doesNotMatch(text, /"Player 1"/);
});
