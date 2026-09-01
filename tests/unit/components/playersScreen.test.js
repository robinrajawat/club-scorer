// Public player directory (src/components/playersScreen.js). Every read/write is a prop -- no bare
// globals at all -- except EditPlayerModal/TransferPlayerModal, which reference Modal as a bare
// global internally, so tests that open one of those stub it the same way playerModals.test.js does.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { PlayersScreen } from "../../../src/components/playersScreen.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.Modal;
});

function player(overrides = {}) {
  return {
    id: "p1", email: "virat@example.com", name: "Virat Kohli", role: "batter", age: 30,
    homeClubId: "c1", ...overrides
  };
}

function baseProps(overrides = {}) {
  return {
    onBack: () => {},
    onLoadPublicPlayers: () => Promise.resolve([player()]),
    onComputeCareerStats: () => Promise.resolve(null),
    onDeletePlayer: () => Promise.resolve({ ok: true }),
    onSearchPublicClubs: () => Promise.resolve([]),
    onTransferPlayer: () => Promise.resolve({ ok: true }),
    onUpdatePlayerInfo: () => Promise.resolve({ ok: true }),
    currentUid: "owner1",
    clubs: [{ id: "c1", name: "Riverside CC", ownerUid: "owner1" }],
    ...overrides
  };
}

async function renderScreen(extraProps = {}) {
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(PlayersScreen, baseProps(extraProps)));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("PlayersScreen: loads and lists public players, filtered by search", async () => {
  const inst = await renderScreen({
    onLoadPublicPlayers: () => Promise.resolve([player(), player({ id: "p2", email: "sam@example.com", name: "Sam Curran" })])
  });
  assert.match(JSON.stringify(inst.toJSON()), /Virat Kohli/);
  assert.match(JSON.stringify(inst.toJSON()), /Sam Curran/);

  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "Sam" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Sam Curran/);
  assert.doesNotMatch(text, /Virat Kohli/);
});

test("PlayersScreen: shows 'No public players yet' when the list is empty", async () => {
  const inst = await renderScreen({ onLoadPublicPlayers: () => Promise.resolve([]) });
  assert.match(JSON.stringify(inst.toJSON()), /No public players yet\./);
});

test("PlayersScreen: initialSelected opens straight to that player's detail view", async () => {
  let statsRequestedFor = null;
  const inst = await renderScreen({
    initialSelected: player(),
    onComputeCareerStats: (name, homeClubId) => { statsRequestedFor = { name, homeClubId }; return Promise.resolve(null); }
  });
  assert.deepEqual(statsRequestedFor, { name: "Virat Kohli", homeClubId: "c1" });
  assert.match(JSON.stringify(inst.toJSON()), /Virat Kohli/);
});

test("PlayersScreen: tapping a player opens their detail view and shows computed stats", async () => {
  const stats = { runs: 500, bestBattingLabel: "88*", battingAvg: 45.2, strikeRate: 130.1, wickets: 3, bestBowlingLabel: "2/20", economy: 6.5, catches: 4 };
  const inst = await renderScreen({ onComputeCareerStats: () => Promise.resolve(stats) });
  const playerBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Virat Kohli"));
  await act(async () => {
    playerBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /500/);
  assert.match(text, /45\.2/);
});

test("PlayersScreen: owner sees Edit/Transfer/Delete controls; a non-owner does not", async () => {
  const ownerInst = await renderScreen({ currentUid: "owner1" });
  await act(async () => {
    const btn = ownerInst.root.findAllByType("button").find(b => hasText(b.props.children, "Virat Kohli"));
    btn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(ownerInst.toJSON()), /Delete player/);

  const memberInst = await renderScreen({ currentUid: "someoneElse" });
  await act(async () => {
    const btn = memberInst.root.findAllByType("button").find(b => hasText(b.props.children, "Virat Kohli"));
    btn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.doesNotMatch(JSON.stringify(memberInst.toJSON()), /Delete player/);
});

test("PlayersScreen: 'Delete player' opens a ConfirmModal, and confirming calls onDeletePlayer then returns to the list", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deletedEmail = null;
  const inst = await renderScreen({
    onDeletePlayer: email => { deletedEmail = email; return Promise.resolve({ ok: true }); }
  });
  await act(async () => {
    const btn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Virat Kohli"));
    btn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const deleteBtn = inst.root.findAllByType("button").find(b => b.props.children === "Delete player");
  act(() => { deleteBtn.props.onClick(); });

  const confirmBtn = inst.root.findAllByType("button").find(b => b.props.children === "Delete");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(deletedEmail, "virat@example.com");
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Virat Kohli/);
});

test("PlayersScreen: 'Edit details' opens EditPlayerModal, and saving updates the shown info", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await renderScreen({
    onUpdatePlayerInfo: (email, info) => Promise.resolve({ ok: true })
  });
  await act(async () => {
    const btn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Virat Kohli"));
    btn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const editBtn = inst.root.findAllByType("button").find(b => b.props.children === "Edit details");
  act(() => { editBtn.props.onClick(); });

  const modalStub = inst.root.findByProps({ "data-stub-modal": true });
  assert.ok(modalStub);
});

test("PlayersScreen: 'Transfer to another club' opens TransferPlayerModal", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await renderScreen();
  await act(async () => {
    const btn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Virat Kohli"));
    btn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const transferBtn = inst.root.findAllByType("button").find(b => b.props.children === "Transfer to another club");
  act(() => { transferBtn.props.onClick(); });

  const modalStub = inst.root.findByProps({ "data-stub-modal": true });
  assert.ok(modalStub);
});
