// Federation administration, the sibling of ClubPanel (src/components/federationsPanel.js). Every
// write action is a prop -- no bare globals, no mount effect.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FederationsPanel } from "../../../src/components/federationsPanel.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";

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

function federation(overrides = {}) {
  return {
    id: "fed1", name: "County League", createdBy: "owner1", affiliatedClubIds: [],
    visibility: "private",
    ...overrides
  };
}

function baseProps(overrides = {}) {
  return {
    federationsById: {}, clubs: [], currentUid: "owner1",
    onCreateFederation: () => Promise.resolve({ ok: true }),
    onSearchPublicFederations: () => Promise.resolve([]), onSearchPublicClubs: () => Promise.resolve([]),
    onRequestFederationAffiliation: () => Promise.resolve({ ok: true }),
    onSetFederationVisibility: () => Promise.resolve({ ok: true }), onLeaveFederation: () => {},
    onLoadFederationTeams: () => Promise.resolve([]), onLoadFederationMembers: () => Promise.resolve([]),
    onRenameFederation: () => Promise.resolve({ ok: true }), onUpdateFederationDescription: () => Promise.resolve({ ok: true }),
    onInviteFederationCoOwnerByEmail: () => Promise.resolve({ ok: true }), onRemoveFederationCoOwner: () => Promise.resolve({ ok: true }),
    onCancelCoOwnerInvite: () => Promise.resolve({ ok: true }),
    onKickClubFromFederation: () => Promise.resolve({ ok: true }), onDeleteFederation: () => Promise.resolve({ ok: true }),
    onCancelFederationRequest: () => Promise.resolve({ ok: true }),
    onOpenRecords: () => {},
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(FederationsPanel, baseProps(props)));
}

function openManage(inst, name) {
  const manageBtn = inst.root.findAllByType("button").find(b => b.props.children === "Manage");
  act(() => { manageBtn.props.onClick(); });
}

test("FederationsPanel: creating a federation fills the name field and calls onCreateFederation", async () => {
  let createdWith = null;
  const inst = render({ onCreateFederation: name => { createdWith = name; return Promise.resolve({ ok: true }); } });
  const addBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Federation"));
  act(() => { addBtn.props.onClick(); });

  const nameField = inst.root.findByType("input");
  act(() => { nameField.props.onChange({ target: { value: "County League" } }); });

  const createBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Create"));
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith, "County League");
});

test("FederationsPanel: 'Find a federation' searches and requests to join on behalf of the selected club", async () => {
  let requestedWith = null;
  const inst = render({
    clubs: [{ id: "c1", name: "Riverside CC" }],
    onSearchPublicFederations: () => Promise.resolve([{ federationId: "fed1", name: "County League" }]),
    onRequestFederationAffiliation: (direction, clubId, fedId) => { requestedWith = { direction, clubId, fedId }; return Promise.resolve({ ok: true }); }
  });
  const addBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Federation"));
  act(() => { addBtn.props.onClick(); });
  const findBtn = inst.root.findAllByType("button").find(b => b.props.children === "Find a federation");
  act(() => { findBtn.props.onClick(); });

  const searchField = inst.root.findByType("input");
  act(() => { searchField.props.onChange({ target: { value: "County" } }); });
  const searchBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Search"));
  await act(async () => {
    searchBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const requestBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Request"));
  await act(async () => {
    requestBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(requestedWith, { direction: "club_to_federation", clubId: "c1", fedId: "fed1" });
});

test("FederationsPanel: opening Manage loads member clubs via onLoadFederationMembers/onLoadFederationTeams/onSearchPublicClubs", async () => {
  let membersLoaded = false, teamsLoaded = false, directoryLoaded = false;
  const inst = render({
    federationsById: { fed1: federation() },
    onLoadFederationMembers: () => { membersLoaded = true; return Promise.resolve([]); },
    onLoadFederationTeams: () => { teamsLoaded = true; return Promise.resolve([]); },
    onSearchPublicClubs: () => { directoryLoaded = true; return Promise.resolve([]); }
  });
  await act(async () => {
    openManage(inst);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(membersLoaded, true);
  assert.equal(teamsLoaded, true);
  assert.equal(directoryLoaded, true);
  assert.match(JSON.stringify(inst.toJSON()), /No clubs affiliated yet\./);
});

test("FederationsPanel: editing name & description saves via onRenameFederation/onUpdateFederationDescription", async () => {
  let renamedWith = null, descUpdatedWith = null;
  const inst = render({
    federationsById: { fed1: federation() },
    onRenameFederation: (id, name) => { renamedWith = { id, name }; return Promise.resolve({ ok: true }); },
    onUpdateFederationDescription: (id, desc) => { descUpdatedWith = { id, desc }; return Promise.resolve({ ok: true }); }
  });
  await act(async () => {
    openManage(inst);
    await new Promise(r => setTimeout(r, 0));
  });
  const editBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Edit federation name & description"));
  act(() => { editBtn.props.onClick(); });

  const nameField = inst.root.findAllByType("input")[0];
  act(() => { nameField.props.onChange({ target: { value: "County Premier League" } }); });

  const saveBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Save"));
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(renamedWith, { id: "fed1", name: "County Premier League" });
  assert.equal(descUpdatedWith, null);
});

test("FederationsPanel: removing a member club opens a ConfirmModal, and confirming calls onKickClubFromFederation", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let kickedWith = null;
  const inst = render({
    federationsById: { fed1: federation({ affiliatedClubIds: ["c1"] }) },
    onLoadFederationMembers: () => Promise.resolve([{ clubId: "c1", clubName: "Riverside CC" }]),
    onKickClubFromFederation: (fedId, clubId) => { kickedWith = { fedId, clubId }; return Promise.resolve({ ok: true }); }
  });
  await act(async () => {
    openManage(inst);
    await new Promise(r => setTimeout(r, 0));
  });
  const removeBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Remove"));
  act(() => { removeBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  await act(async () => {
    modal.props.onConfirm();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(kickedWith, { fedId: "fed1", clubId: "c1" });
});

test("FederationsPanel: 'Find a club to invite' requests federation_to_club affiliation for the found club", async () => {
  let requestedWith = null;
  const inst = render({
    federationsById: { fed1: federation() },
    onSearchPublicClubs: () => Promise.resolve([{ clubId: "c1", name: "Riverside CC" }]),
    onRequestFederationAffiliation: (direction, clubId, fedId) => { requestedWith = { direction, clubId, fedId }; return Promise.resolve({ ok: true }); }
  });
  await act(async () => {
    openManage(inst);
    await new Promise(r => setTimeout(r, 0));
  });
  const findClubBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Find a club to invite"));
  act(() => { findClubBtn.props.onClick(); });

  const searchFields = inst.root.findAllByType("input");
  const searchField = searchFields[searchFields.length - 1];
  act(() => { searchField.props.onChange({ target: { value: "Riverside" } }); });
  const searchBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Search"));
  await act(async () => {
    searchBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const inviteBtn = inst.root.findAllByType("button").find(b => b.props.children === "Invite");
  await act(async () => {
    inviteBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(requestedWith, { direction: "federation_to_club", clubId: "c1", fedId: "fed1" });
});

test("FederationsPanel: inviting a co-owner by email calls onInviteFederationCoOwnerByEmail and shows a confirmation", async () => {
  let invitedWith = null;
  const inst = render({
    federationsById: { fed1: federation() },
    onInviteFederationCoOwnerByEmail: (fedId, email) => { invitedWith = { fedId, email }; return Promise.resolve({ ok: true }); }
  });
  await act(async () => {
    openManage(inst);
    await new Promise(r => setTimeout(r, 0));
  });
  const coOwnerBtn = inst.root.findAllByType("button").find(b => b.props.children === "+ Invite a co-owner");
  act(() => { coOwnerBtn.props.onClick(); });

  const emailField = inst.root.findByType("input");
  act(() => { emailField.props.onChange({ target: { value: "sam@example.com" } }); });

  const submitBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Invite"));
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(invitedWith, { fedId: "fed1", email: "sam@example.com" });
  assert.match(JSON.stringify(inst.toJSON()), /Invite sent to/);
  assert.match(JSON.stringify(inst.toJSON()), /sam@example\.com/);
});

test("FederationsPanel: a pending co-owner invite shows in the manage panel with a Cancel action wired to onCancelCoOwnerInvite", async () => {
  let cancelledId = null;
  const inst = render({
    federationsById: { fed1: federation() },
    coOwnerInvites: [{ id: "inv1", scope: "federation", entityId: "fed1", email: "sam@example.com", status: "pending" }],
    onCancelCoOwnerInvite: id => { cancelledId = id; return Promise.resolve({ ok: true }); }
  });
  await act(async () => {
    openManage(inst);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /Pending co-owner invites/);
  assert.match(JSON.stringify(inst.toJSON()), /sam@example\.com/);
  const cancelBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Cancel") && b.props["aria-label"] === "Cancel invite to sam@example.com");
  await act(async () => {
    cancelBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(cancelledId, "inv1");
});

test("FederationsPanel: 'Delete this federation' only shows once no clubs are affiliated, and confirming calls onDeleteFederation", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deletedId = null;
  const withClubs = render({
    federationsById: { fed1: federation({ affiliatedClubIds: ["c1"] }) },
    onLoadFederationMembers: () => Promise.resolve([{ clubId: "c1", clubName: "Riverside CC" }])
  });
  await act(async () => { openManage(withClubs); await new Promise(r => setTimeout(r, 0)); });
  assert.doesNotMatch(JSON.stringify(withClubs.toJSON()), /Delete this federation/);

  const inst = render({
    federationsById: { fed1: federation({ affiliatedClubIds: [] }) },
    onDeleteFederation: id => { deletedId = id; return Promise.resolve({ ok: true }); }
  });
  await act(async () => { openManage(inst); await new Promise(r => setTimeout(r, 0)); });
  const deleteBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Delete this federation"));
  act(() => { deleteBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  await act(async () => {
    modal.props.onConfirm();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(deletedId, "fed1");
});

test("FederationsPanel: toggling visibility calls onSetFederationVisibility with the new state", async () => {
  let setTo = null;
  const inst = render({
    federationsById: { fed1: federation({ visibility: "private" }) },
    onSetFederationVisibility: (id, isPublic) => { setTo = { id, isPublic }; return Promise.resolve({ ok: true }); }
  });
  const publicBtn = inst.root.findByProps({ "aria-label": "Make public" });
  await act(async () => {
    publicBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(setTo, { id: "fed1", isPublic: true });
});

test("FederationsPanel: a club owner can stop sharing (leave) a federation", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let leftWith = null;
  const inst = render({
    federationsById: { fed1: federation() },
    clubs: [{ id: "c1", name: "Riverside CC", ownerUid: "owner1", federationIds: ["fed1"] }],
    onLeaveFederation: (clubId, fedId) => { leftWith = { clubId, fedId }; }
  });
  const stopSharingBtn = inst.root.findByProps({ "aria-label": "Stop sharing Riverside CC with County League" });
  act(() => { stopSharingBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  act(() => { modal.props.onConfirm(); });
  assert.deepEqual(leftWith, { clubId: "c1", fedId: "fed1" });
});
