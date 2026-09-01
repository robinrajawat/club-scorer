// Player-record modals (src/components/playerModals.js). Both wrap their content in Modal, so
// their tests stub globalThis.Modal with a plain pass-through -- Modal's real DOM behavior is
// already covered by modal.test.js; TransferPlayerModal's onSearchClubs/onTransfer are passed as
// props, not bare globals, so no Firestore stubbing is needed at all.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer from "react-test-renderer";
import { PLAYER_ROLES, PLAYER_HANDS, EditPlayerModal, TransferPlayerModal } from "../../../src/components/playerModals.js";
import { Btn, TextField, ConfirmModal } from "../../../src/components/formUiAtoms.js";

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.Modal;
});

test("PLAYER_ROLES/PLAYER_HANDS: are the expected small option lists", () => {
  assert.deepEqual(PLAYER_ROLES.map(r => r.value), ["batsman", "bowler", "allrounder"]);
  assert.deepEqual(PLAYER_HANDS.map(h => h.value), ["right", "left"]);
});

test("EditPlayerModal: pre-fills from the player, saves the edited payload via onSave", async () => {
  let saved = null;
  const inst = renderer.create(React.createElement(EditPlayerModal, {
    player: { name: "Virat Kohli", age: "28", role: "batsman", battingHand: "right" },
    onSave: payload => { saved = payload; return Promise.resolve({ ok: true }); },
    onClose: () => {}
  }));
  const nameField = inst.root.findByType(TextField);
  assert.equal(nameField.props.value, "Virat Kohli");

  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children !== "Cancel");
  await saveBtn.props.onClick();
  assert.equal(saved.name, "Virat Kohli");
  assert.equal(saved.role, "batsman");
});

test("EditPlayerModal: extraFields=true also collects team/externalId/email/note", async () => {
  let saved = null;
  const inst = renderer.create(React.createElement(EditPlayerModal, {
    player: { name: "Rohit Sharma" },
    extraFields: true,
    onSave: payload => { saved = payload; return Promise.resolve({ ok: true }); },
    onClose: () => {}
  }));
  const fields = inst.root.findAllByType(TextField);
  assert.equal(fields.length, 5); // name, team, externalId, email, note
  fields[1].props.onChange("Firsts");
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children !== "Cancel");
  await saveBtn.props.onClick();
  assert.equal(saved.team, "Firsts");
});

test("EditPlayerModal: shows the save error and stays open when onSave reports failure", async () => {
  const inst = renderer.create(React.createElement(EditPlayerModal, {
    player: { name: "Virat Kohli" },
    onSave: () => Promise.resolve({ ok: false, error: "Name already taken" }),
    onClose: () => {}
  }));
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children !== "Cancel");
  await saveBtn.props.onClick();
  assert.match(JSON.stringify(inst.toJSON()), /Name already taken/);
});

test("TransferPlayerModal: searches clubs, filters out the player's own club, and confirms a transfer", async () => {
  const clubs = [
    { clubId: "home", name: "Riverside CC" },
    { clubId: "away", name: "Oakwood CC" }
  ];
  let transferredTo = null;
  const inst = renderer.create(React.createElement(TransferPlayerModal, {
    player: { name: "Virat Kohli", email: "virat@example.com", homeClubId: "home" },
    onSearchClubs: () => Promise.resolve(clubs),
    onTransfer: (email, clubId) => { transferredTo = clubId; return Promise.resolve({ ok: true }); },
    onClose: () => {}
  }));
  const searchBtn = inst.root.findAllByType(Btn)[0];
  await searchBtn.props.onClick();
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Oakwood CC/);
  assert.doesNotMatch(text, /Riverside CC/); // home club filtered out

  // Only one result survives the home-club filter, so the second <button> host element (the first
  // is the Search button's own) is that result's row.
  const pickBtn = inst.root.findAllByType("button")[1];
  pickBtn.props.onClick();
  // Picking a target swaps in ConfirmModal (still inside the stubbed Modal wrapper isn't used here).
  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Transfer");
  assert.ok(confirmBtn);
  await confirmBtn.props.onClick();
  assert.equal(transferredTo, "away");
});

test("TransferPlayerModal: shows a message when the search finds nothing", async () => {
  const inst = renderer.create(React.createElement(TransferPlayerModal, {
    player: { name: "Virat Kohli", homeClubId: "home" },
    onSearchClubs: () => Promise.resolve([]),
    onTransfer: () => Promise.resolve({ ok: true }),
    onClose: () => {}
  }));
  const searchBtn = inst.root.findAllByType(Btn)[0];
  await searchBtn.props.onClick();
  assert.match(JSON.stringify(inst.toJSON()), /No public clubs match/);
});
