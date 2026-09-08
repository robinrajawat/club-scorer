// Create/edit a team's roster (src/components/teamEditScreen.js). Every Firestore-reaching write
// is a prop; the one bare global is checkDeletedBorrowedPlayers, called from a mount-time
// useEffect only when the roster has a borrowed player with an email -- most tests never trigger
// it, so it only needs stubbing where noted. `Modal` (bare global, same pattern as everywhere else
// in this suite) backs the borrow/pool dialogs and, one module away, ConfirmModal's own delete
// dialog -- both stub globalThis.Modal, not a real import.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TeamEditScreen } from "../../../src/components/teamEditScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.checkDeletedBorrowedPlayers;
});

function baseProps(overrides = {}) {
  return {
    team: null, clubId: null, clubs: [],
    onPublishPlayer: () => Promise.resolve({ ok: true }),
    onUnpublishPlayer: () => Promise.resolve({ ok: true }),
    onUpdatePlayerInfo: () => Promise.resolve({ ok: true }),
    onLoadPublicPlayers: () => Promise.resolve([]),
    onAddPoolPlayers: () => {},
    presetTeamSeed: null,
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

test("TeamEditScreen: removing a player opens a confirm dialog, and confirming removes them", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = render();
  addPlayer(inst, "A. Sharma");
  const removeBtn = inst.root.findByProps({ "aria-label": "Remove A. Sharma" });
  act(() => { removeBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Remove A. Sharma\?/);

  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Remove");
  act(() => { confirmBtn.props.onClick(); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Remove A. Sharma\?/);
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /A\. Sharma/);
});

test("TeamEditScreen: jersey color presets and a custom color both update the payload", () => {
  let saved = null;
  const inst = render({ onSave: t => { saved = t; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  addPlayer(inst, "A. Sharma");

  const swatch = inst.root.findByProps({ "aria-label": "Jersey color #1b3a6b" });
  act(() => { swatch.props.onClick(); });
  act(() => { btn(inst, "Save Team").props.onClick(); });
  assert.equal(saved.color, "#1b3a6b");
});

test("TeamEditScreen: 'Borrow a public player' loads and lists the public directory", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = render({
    clubId: "c1",
    onLoadPublicPlayers: () => Promise.resolve([{ id: "p1", name: "C. Patel", email: "c@x.com", homeClubId: "c2" }])
  });
  const borrowBtn = inst.root.findAllByType("button").find(b =>
    Array.isArray(b.props.children) && b.props.children.some(c => typeof c === "string" && c.includes("Borrow a public player"))
  );
  await act(async () => {
    borrowBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /C\. Patel/);
});

test("TeamEditScreen: adding from the club player pool copies entries onto the roster", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = render({
    clubId: "c1",
    clubs: [{ id: "c1", name: "Riverside CC", playerPool: [{ id: "pp1", name: "D. Singh", role: "Bowler" }] }]
  });
  const poolBtn = inst.root.findAllByType("button").find(b =>
    Array.isArray(b.props.children) && b.props.children.some(c => typeof c === "string" && c.includes("Add from club pool"))
  );
  act(() => { poolBtn.props.onClick(); });
  const rowBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "D. Singh"));
  act(() => { rowBtn.props.onClick(); }); // select D. Singh in the picker
  const addSelectedBtn = inst.root.findAllByType(Btn).find(b => typeof b.props.children === "string" && b.props.children.startsWith("Add "));
  act(() => { addSelectedBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /D\. Singh/);
});

test("TeamEditScreen: flags a club roster player who isn't in the club's pool yet, with a way to add them", () => {
  let addedTo = null, addedPlayers = null;
  const inst = render({
    clubId: "c1",
    clubs: [{ id: "c1", name: "Riverside CC", playerPool: [{ id: "pp1", name: "D. Singh", role: "Bowler" }] }],
    onAddPoolPlayers: (clubId, players) => { addedTo = clubId; addedPlayers = players; }
  });
  addPlayer(inst, "D. Singh"); // already in the pool
  addPlayer(inst, "E. Rao"); // not in the pool yet

  const addBtn = inst.root.findByProps({ "aria-label": "Add E. Rao to the club player pool" });
  assert.throws(() => inst.root.findByProps({ "aria-label": "Add D. Singh to the club player pool" }));

  act(() => { addBtn.props.onClick(); });
  assert.equal(addedTo, "c1");
  assert.equal(addedPlayers.length, 1);
  assert.equal(addedPlayers[0].name, "E. Rao");
});

test("TeamEditScreen: no pool marking at all for a personal (non-club) team", () => {
  const inst = render({ clubId: null });
  addPlayer(inst, "F. Costa");
  assert.throws(() => inst.root.findByProps({ "aria-label": "Add F. Costa to the club player pool" }));
});

test("TeamEditScreen: a display-only summary shows player count and whoever's tagged captain/vice-captain/keeper", () => {
  const inst = render();
  // Reads the live (pre-toJSON) instance tree, where a numeric child is still a real number and
  // string fragments haven't been comma-joined into one big JSON blob -- .join("") reassembles a
  // span's own text across its several children the same way the browser would render it.
  function summaryText() {
    return inst.root.findAllByType("span")
      .filter(s => s.props.style && s.props.style.borderRadius === 12 && s.props.style.padding === "3px 9px")
      .map(s => [].concat(s.props.children).join(""));
  }
  addPlayer(inst, "A. Sharma");
  addPlayer(inst, "B. Kumar");
  assert.ok(summaryText().includes("2 players"));
  // Nobody's tagged yet -- no C/VC/WK summary pill.
  assert.equal(summaryText().length, 1);

  act(() => { inst.root.findByProps({ "aria-label": "Make A. Sharma captain" }).props.onClick(); });
  assert.ok(summaryText().includes("C · A. Sharma"));
  act(() => { inst.root.findByProps({ "aria-label": "Make B. Kumar vice-captain" }).props.onClick(); });
  assert.ok(summaryText().includes("VC · B. Kumar"));
  act(() => { inst.root.findByProps({ "aria-label": "Make B. Kumar wicketkeeper" }).props.onClick(); });
  assert.ok(summaryText().includes("WK · B. Kumar"));
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
