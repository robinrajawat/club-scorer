// Fixture scheduling modals (src/components/venueAndDateModals.js). Both reference Modal as a
// bare, unimported global (same pattern as ConfirmModal/playerModals.js) so tests stub
// globalThis.Modal without pulling in jsdom.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer from "react-test-renderer";
import { VenueEditModal, WEEKDAY_LABELS, MONTH_LABELS, FixtureDateTimeModal } from "../../../src/components/venueAndDateModals.js";
import { Btn, TextField } from "../../../src/components/formUiAtoms.js";

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.Modal;
});

test("WEEKDAY_LABELS/MONTH_LABELS: are the expected 7/12-entry label lists", () => {
  assert.deepEqual(WEEKDAY_LABELS, ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
  assert.equal(MONTH_LABELS.length, 12);
  assert.equal(MONTH_LABELS[0], "January");
});

test("VenueEditModal: with a short/empty venue, shows the club-address shortcuts with no search triggered", () => {
  const clubs = [
    { id: "c1", name: "Riverside CC", address: "1 River Rd", addressLat: 1, addressLng: 2 },
    { id: "c2", name: "No-address CC" } // filtered out -- no verified address
  ];
  const inst = renderer.create(React.createElement(VenueEditModal, { value: "", clubs, onSave: () => {}, onClose: () => {} }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.doesNotMatch(text, /No-address CC/);
  assert.doesNotMatch(text, /Address verified/);
});

test("VenueEditModal: picking a club shortcut fills the field and marks the address verified", () => {
  const clubs = [{ id: "c1", name: "Riverside CC", address: "1 River Rd", addressLat: 1, addressLng: 2 }];
  const inst = renderer.create(React.createElement(VenueEditModal, { value: "", clubs, onSave: () => {}, onClose: () => {} }));
  const clubBtn = inst.root.findAllByType("button")[0];
  clubBtn.props.onClick();
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Address verified/);
  assert.equal(inst.root.findByType(TextField).props.value, "1 River Rd");
});

test("VenueEditModal: starting with verified initialLat/initialLng shows the address as already verified", () => {
  const inst = renderer.create(React.createElement(VenueEditModal, {
    value: "Riverside Ground", initialLat: 1.5, initialLng: 2.5, onSave: () => {}, onClose: () => {}
  }));
  assert.match(JSON.stringify(inst.toJSON()), /Address verified/);
});

test("VenueEditModal: Save calls onSave with the venue text and coordinates, then onClose", async () => {
  let savedWith = null;
  let closed = false;
  const inst = renderer.create(React.createElement(VenueEditModal, {
    value: "Riverside Ground", initialLat: 1.5, initialLng: 2.5,
    onSave: (venue, lat, lng) => { savedWith = { venue, lat, lng }; return Promise.resolve({ ok: true }); },
    onClose: () => { closed = true; }
  }));
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  await saveBtn.props.onClick();
  assert.deepEqual(savedWith, { venue: "Riverside Ground", lat: 1.5, lng: 2.5 });
  assert.equal(closed, true);
});

test("FixtureDateTimeModal: Save is a no-op until a day is picked, calls onSave with a built ISO string once one is", () => {
  let savedIso = null;
  const inst = renderer.create(React.createElement(FixtureDateTimeModal, {
    value: "", onSave: iso => { savedIso = iso; }, onClear: () => {}, onClose: () => {}
  }));
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  saveBtn.props.onClick();
  assert.equal(savedIso, null); // nothing picked yet

  const dayButtons = inst.root.findAllByType("button").filter(b => typeof b.props.children === "number");
  dayButtons[0].props.onClick();
  saveBtn.props.onClick();
  assert.ok(savedIso);
  assert.match(savedIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
});

test("FixtureDateTimeModal: month navigation changes the visible month label", () => {
  const inst = renderer.create(React.createElement(FixtureDateTimeModal, {
    value: "", onSave: () => {}, onClear: () => {}, onClose: () => {}
  }));
  const before = JSON.stringify(inst.toJSON());
  const nextBtn = inst.root.findByProps({ "aria-label": "Next month" });
  nextBtn.props.onClick();
  const after = JSON.stringify(inst.toJSON());
  assert.notEqual(before, after);
});
