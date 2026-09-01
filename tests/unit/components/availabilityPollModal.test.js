// Team availability-poll sheet (src/components/availabilityPollModal.js). References Modal as a
// bare, unimported global, so tests stub globalThis.Modal without pulling in jsdom -- same pattern
// as ConfirmModal/playerModals.js. loadTeamPolls/loadPollByCode/createAvailabilityPoll/
// deleteAvailabilityPoll are bare-global Firestore calls (not extracted, need the Firebase SDK);
// loadTeamPolls in particular runs from a mount-time useEffect, not just a handler, so every test
// stubs it and wraps the initial render in act().

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { AvailabilityPollModal } from "../../../src/components/availabilityPollModal.js";
import { Btn, TextField } from "../../../src/components/formUiAtoms.js";

const team = { id: "t1", name: "Riverside 1st XI", players: ["Virat Kohli", "Rohit Sharma"] };

// A React element's own fields (e.g. _owner, pointing back into the fiber tree) make
// JSON.stringify throw on circular structure -- walk .props.children by hand instead, ignoring
// every other field, to text-match nested content without ever stringifying a live element.
function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadTeamPolls;
  delete globalThis.loadPollByCode;
  delete globalThis.createAvailabilityPoll;
  delete globalThis.deleteAvailabilityPoll;
});

async function renderWithPolls(polls, extraProps = {}) {
  globalThis.loadTeamPolls = () => Promise.resolve(polls);
  globalThis.loadPollByCode = code => Promise.resolve(polls.find(p => p.code === code) || null);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(AvailabilityPollModal, {
      clubId: "c1", clubName: "Riverside CC", team, onClose: () => {}, ...extraProps
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("AvailabilityPollModal: lists existing polls with their yes/no/maybe counts", async () => {
  const polls = [{
    code: "ABC123", question: "Free Saturday?", fixtureDate: "2026-09-05",
    createdAt: Date.now(), responses: { "Virat Kohli": { status: "yes" }, "Rohit Sharma": { status: "no" } }
  }];
  const inst = await renderWithPolls(polls);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Free Saturday\?/);
  assert.match(text, /1 yes/);
  assert.match(text, /1 no/);
  assert.match(text, /0 maybe/);
});

test("AvailabilityPollModal: shows an empty state with no polls yet", async () => {
  const inst = await renderWithPolls([]);
  assert.match(JSON.stringify(inst.toJSON()), /No polls sent yet/);
});

test("AvailabilityPollModal: creates a new poll via the (stubbed) createAvailabilityPoll and shows the share link", async () => {
  const inst = await renderWithPolls([]);
  globalThis.createAvailabilityPoll = (clubId, clubName, teamId, teamName, roster, question) => Promise.resolve({
    ok: true, code: "NEWCODE", poll: { question, fixtureDate: null, createdAt: Date.now() }
  });

  const newPollBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New poll"));
  act(() => { newPollBtn.props.onClick(); });

  const questionField = inst.root.findByType(TextField);
  act(() => { questionField.props.onChange("Free this weekend?"); });

  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create & get link");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });

  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Poll created/);
  assert.match(text, /NEWCODE/);
});

test("AvailabilityPollModal: opening results loads the full poll and shows each roster player's response", async () => {
  const polls = [{
    code: "ABC123", question: "Free Saturday?", fixtureDate: null,
    createdAt: Date.now(), roster: ["Virat Kohli", "Rohit Sharma"],
    responses: { "Virat Kohli": { status: "yes" } }
  }];
  const inst = await renderWithPolls(polls);
  const pollRowBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Free Saturday?"));
  await act(async () => {
    pollRowBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Virat Kohli/);
  assert.match(text, /Rohit Sharma/);
  assert.match(text, /Yes/);
});

test("AvailabilityPollModal: deleting a poll confirms first, then calls the (stubbed) deleteAvailabilityPoll", async () => {
  const polls = [{
    code: "ABC123", question: "Free Saturday?", fixtureDate: null,
    createdAt: Date.now(), roster: [], responses: {}
  }];
  const inst = await renderWithPolls(polls);
  let deletedCode = null;
  globalThis.deleteAvailabilityPoll = (clubId, teamId, code) => { deletedCode = code; return Promise.resolve({ ok: true }); };

  const pollRowBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Free Saturday?"));
  await act(async () => {
    pollRowBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const deleteBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Delete");
  act(() => { deleteBtn.props.onClick(); });
  // Both the results view's own "Delete" button and ConfirmModal's confirm button (confirmLabel
  // is "Delete" too) now match "Delete" -- the confirm one renders last, after the sheet content.
  const deleteBtns = inst.root.findAllByType(Btn).filter(b => b.props.children === "Delete");
  const confirmBtn = deleteBtns[deleteBtns.length - 1];
  assert.equal(deleteBtns.length, 2);
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(deletedCode, "ABC123");
});

test("AvailabilityPollModal: opens straight to results when given an initialCode that still exists", async () => {
  const polls = [{
    code: "ABC123", question: "Free Saturday?", fixtureDate: null,
    createdAt: Date.now(), roster: ["Virat Kohli"], responses: {}
  }];
  const inst = await renderWithPolls(polls, { initialCode: "ABC123" });
  assert.match(JSON.stringify(inst.toJSON()), /Free Saturday\?/);
});
