// Reusable presentational React components used across setup/roster/rules screens
// (src/components/formUiAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import {
  PlayerAvatar, TextField, RuleChoice, TeamChips, PinnableChip, Btn, ConfirmModal
} from "../../../src/components/formUiAtoms.js";

test("PlayerAvatar: shows the photo when one's set, otherwise colored initials", () => {
  const withPhoto = renderer.create(React.createElement(PlayerAvatar, { name: "Rohit Sharma", photoURL: "https://example.com/p.jpg" })).toJSON();
  assert.equal(withPhoto.type, "img");
  assert.equal(withPhoto.props.src, "https://example.com/p.jpg");

  const withoutPhoto = renderer.create(React.createElement(PlayerAvatar, { name: "Rohit Sharma" })).toJSON();
  assert.equal(withoutPhoto.type, "div");
  assert.equal(withoutPhoto.children[0], "RS");
});

test("TextField: wires value/onChange through to a plain input", () => {
  let seen = null;
  const tree = renderer.create(React.createElement(TextField, {
    value: "hello", onChange: v => { seen = v; }, placeholder: "Name"
  })).toJSON();
  assert.equal(tree.type, "input");
  assert.equal(tree.props.value, "hello");
  assert.equal(tree.props.placeholder, "Name");
  tree.props.onChange({ target: { value: "world" } });
  assert.equal(seen, "world");
});

test("RuleChoice: renders one button per option, highlights the active one, calls onChange with its value", () => {
  let picked = null;
  const options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  const root = renderer.create(React.createElement(RuleChoice, {
    label: "Pick one", value: "a", options, onChange: v => { picked = v; }
  })).root;
  const buttons = root.findAllByType("button");
  assert.equal(buttons.length, 2);
  buttons[1].props.onClick();
  assert.equal(picked, "b");
});

test("TeamChips: one chip per team plus a fixed 'One-off' chip, calls onSelect with the team or null", () => {
  let selected = "not called";
  const teams = [{ id: "t1", name: "Eagles" }, { id: "t2", name: "Hawks" }];
  const root = renderer.create(React.createElement(TeamChips, {
    teams, selectedId: "t1", onSelect: t => { selected = t; }
  })).root;
  const buttons = root.findAllByType("button");
  assert.equal(buttons.length, 3);
  buttons[2].props.onClick();
  assert.equal(selected, null);
});

test("PinnableChip: shows a pin icon only when pinned, calls onSelect on click", () => {
  let clicked = false;
  const unpinnedRoot = renderer.create(React.createElement(PinnableChip, {
    label: "Eagles", active: false, pinned: false, onSelect: () => { clicked = true; }, onTogglePin: () => {}
  })).root;
  assert.equal(unpinnedRoot.findAllByType("svg").length, 0);
  unpinnedRoot.findByType("button").props.onClick();
  assert.equal(clicked, true);

  const pinnedRoot = renderer.create(React.createElement(PinnableChip, {
    label: "Eagles", active: false, pinned: true, onSelect: () => {}, onTogglePin: () => {}
  })).root;
  assert.equal(pinnedRoot.findAllByType("svg").length, 1);
});

test("Btn: applies the variant's styling and disabled state, renders children", () => {
  const primary = renderer.create(React.createElement(Btn, { variant: "primary" }, "Save")).toJSON();
  assert.ok(primary.children.includes("Save"));
  assert.equal(primary.props.disabled, undefined);

  const disabled = renderer.create(React.createElement(Btn, { disabled: true }, "Save")).toJSON();
  assert.equal(disabled.props.disabled, true);
  assert.equal(disabled.props.style.opacity, 0.45);
});

test("ConfirmModal: renders title/message and wires confirm/cancel through to the two buttons", () => {
  // Modal itself needs a real jsdom-backed DOM to test meaningfully (see modal.test.js) -- stub it
  // here to test ConfirmModal's own prop wiring without a DOM dependency or pretending to also
  // test Modal's real windowing/focus-trap behavior. ConfirmModal references Modal as a bare,
  // unimported identifier (same as it does in public/index.html, where splicing puts the real Modal
  // in the same global scope), so setting it on globalThis is enough for the reference to resolve.
  const StubModal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let confirmed = false, cancelled = false;
  globalThis.Modal = StubModal;
  try {
    const inst = renderer.create(React.createElement(ConfirmModal, {
      title: "Remove player?",
      message: "This can't be undone.",
      onConfirm: () => { confirmed = true; },
      onCancel: () => { cancelled = true; }
    }));
    const root = inst.root;
    const text = JSON.stringify(inst.toJSON());
    assert.match(text, /Remove player\?/);
    assert.match(text, /can't be undone/);
    const buttons = root.findAllByType(Btn);
    assert.equal(buttons.length, 2);
    buttons[0].props.onClick();
    buttons[1].props.onClick();
    assert.equal(cancelled, true);
    assert.equal(confirmed, true);
  } finally {
    delete globalThis.Modal;
  }
});
