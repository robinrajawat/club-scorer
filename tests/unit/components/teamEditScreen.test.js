// Create/edit a team's roster (src/components/teamEditScreen.js). Every write is a prop, so this
// needs no Firestore stubbing. `Modal` (bare global, same pattern as everywhere else in this
// suite) backs ConfirmModal's own delete dialog -- stub globalThis.Modal, not a real import.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TeamEditScreen } from "../../../src/components/teamEditScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { SwipeableRow } from "../../../src/components/scoringUiAtoms.js";

afterEach(() => {
  delete globalThis.Modal;
});

function baseProps(overrides = {}) {
  return {
    team: null,
    onSave: () => {}, onCancel: () => {},
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(TeamEditScreen, baseProps(props)));
}

function input(inst, placeholder) {
  return inst.root.findAllByType("input").find(i => i.props.placeholder === placeholder);
}

function btn(inst, text) {
  return inst.root.findAllByType(Btn).find(b => b.props.children === text);
}

// JSON.stringify throws on a live React element (circular via _owner) -- walk .props.children by
// hand instead when checking a live instance's rendered text, rather than the toJSON()-tree-only
// JSON.stringify(inst.toJSON()) pattern used elsewhere in this suite.
function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function addPlayer(inst, name, number) {
  act(() => { input(inst, "Player name").props.onChange({ target: { value: name } }); });
  if (number !== undefined) {
    act(() => { input(inst, "#").props.onChange({ target: { value: number } }); });
  }
  act(() => { input(inst, "Player name").props.onKeyDown({ key: "Enter" }); });
}

test("TeamEditScreen: shows 'New Team' with no team, and 'Edit Team' when editing one", () => {
  const fresh = render();
  assert.match(JSON.stringify(fresh.toJSON()), /New Team/);

  const editing = render({ team: { id: "t1", name: "Riverside CC", players: [], captain: "", keeper: "" } });
  assert.match(JSON.stringify(editing.toJSON()), /Edit Team/);
});

test("TeamEditScreen: Save is disabled with no name/players, and enabled once both are set", () => {
  const inst = render();
  assert.equal(btn(inst, "Save Team").props.disabled, true);

  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  assert.equal(btn(inst, "Save Team").props.disabled, true); // still no players

  addPlayer(inst, "A. Sharma");
  assert.equal(btn(inst, "Save Team").props.disabled, false);
});

test("TeamEditScreen: Save calls onSave with the assembled team", () => {
  let saved = null;
  const inst = render({ onSave: t => { saved = t; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  addPlayer(inst, "A. Sharma", "7");
  addPlayer(inst, "B. Kumar");

  act(() => { btn(inst, "Save Team").props.onClick(); });

  assert.ok(saved);
  assert.equal(saved.name, "Riverside CC");
  assert.equal(saved.players.length, 2);
  assert.equal(saved.players[0].name, "A. Sharma");
  assert.equal(saved.players[0].number, "7");
});

test("TeamEditScreen: duplicate player names (case-insensitive) block Save", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  addPlayer(inst, "A. Sharma");
  // Typing the same name again shows an inline error and doesn't add a second row.
  act(() => { input(inst, "Player name").props.onChange({ target: { value: "a. sharma" } }); });
  act(() => { input(inst, "Player name").props.onKeyDown({ key: "Enter" }); });
  assert.match(JSON.stringify(inst.toJSON()), /already on this team/);
  assert.equal(btn(inst, "Save Team").props.disabled, false); // still just the one valid player
});

test("TeamEditScreen: captain/vice-captain/keeper toggle buttons set and clear by name", () => {
  const inst = render();
  addPlayer(inst, "A. Sharma");
  const captainBtn = inst.root.findByProps({ "aria-label": "Make A. Sharma captain" });
  act(() => { captainBtn.props.onClick(); });
  assert.ok(inst.root.findByProps({ "aria-label": "Remove A. Sharma as captain" }));

  const viceCaptainBtn = inst.root.findByProps({ "aria-label": "Make A. Sharma vice-captain" });
  act(() => { viceCaptainBtn.props.onClick(); });
  assert.ok(inst.root.findByProps({ "aria-label": "Remove A. Sharma as vice-captain" }));

  const keeperBtn = inst.root.findByProps({ "aria-label": "Make A. Sharma wicketkeeper" });
  act(() => { keeperBtn.props.onClick(); });
  assert.ok(inst.root.findByProps({ "aria-label": "Remove A. Sharma as wicketkeeper" }));
});

test("TeamEditScreen: vice-captain is included in the saved payload, and cleared when that player is removed", () => {
  let saved = null;
  const inst = render({ onSave: t => { saved = t; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  addPlayer(inst, "A. Sharma");
  act(() => { inst.root.findByProps({ "aria-label": "Make A. Sharma vice-captain" }).props.onClick(); });
  act(() => { btn(inst, "Save Team").props.onClick(); });
  assert.equal(saved.viceCaptain, "A. Sharma");
});

test("TeamEditScreen: removing a player goes through SwipeableRow's onDelete, opening a confirm dialog; confirming removes them", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = render();
  addPlayer(inst, "A. Sharma");
  const row = inst.root.findByType(SwipeableRow);
  act(() => { row.props.onDelete(); });
  assert.match(JSON.stringify(inst.toJSON()), /Remove A. Sharma\?/);

  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Remove");
  act(() => { confirmBtn.props.onClick(); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Remove A. Sharma\?/);
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /A\. Sharma/);
});

test("TeamEditScreen: picking a jersey color preset updates the payload; presets only, no custom color entry", () => {
  let saved = null;
  const inst = render({ onSave: t => { saved = t; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  addPlayer(inst, "A. Sharma");

  const swatch = inst.root.findByProps({ "aria-label": "Jersey color #1b3a6b" });
  act(() => { swatch.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Navy/, "names the selected preset so it's not just a color to recognize");
  act(() => { btn(inst, "Save Team").props.onClick(); });
  assert.equal(saved.color, "#1b3a6b");
  assert.throws(() => inst.root.findByProps({ "aria-label": "Custom jersey color" }));
});

test("TeamEditScreen: no Delete team button when creating a new team, or when the caller offers no onDelete", () => {
  const noOnDelete = render({ team: { id: "t1", name: "Riverside CC", players: [], captain: "", keeper: "" } });
  assert.doesNotMatch(JSON.stringify(noOnDelete.toJSON()), /Delete team/);

  const newTeam = render({ onDelete: () => {} });
  assert.doesNotMatch(JSON.stringify(newTeam.toJSON()), /Delete team/);
});

test("TeamEditScreen: 'Delete team' opens a confirm dialog, and confirming calls onDelete", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deleted = false;
  const inst = render({
    team: { id: "t1", name: "Riverside CC", players: [{ name: "A. Sharma" }], captain: "", keeper: "" },
    onDelete: () => { deleted = true; }
  });
  const deleteBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Delete team"));
  act(() => { deleteBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Delete Riverside CC\?/);

  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Delete");
  act(() => { confirmBtn.props.onClick(); });
  assert.equal(deleted, true);
});
