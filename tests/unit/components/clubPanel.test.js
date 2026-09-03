// Full club administration (src/components/clubPanel.js). Every write action is a prop; the one
// bare global is `searchAddress` (network call from the debounced address-search effect inside
// "Edit club details"), not exercised by these tests since none of them touch the address field.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { ClubPanel } from "../../../src/components/clubPanel.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.searchAddress;
  delete globalThis.Modal;
});

function club(overrides = {}) {
  return {
    id: "c1", name: "Riverside CC", ownerUid: "owner1", memberUids: ["owner1"],
    umpires: [], visibility: "private",
    ...overrides
  };
}

function baseProps(overrides = {}) {
  return {
    clubs: [], activeClubId: null, onSelect: () => {}, currentUid: "owner1",
    onCreate: () => Promise.resolve({ ok: true }), onJoin: () => Promise.resolve({ ok: true }),
    onInvite: () => Promise.resolve({ ok: true }), onInviteCoOwner: () => Promise.resolve({ ok: true }),
    onCancelCoOwnerInvite: () => Promise.resolve({ ok: true }),
    onLeave: () => {}, onDelete: () => {}, onRename: () => Promise.resolve({ ok: true }),
    onUpdateDescription: () => Promise.resolve({ ok: true }), onUpdateAddress: () => Promise.resolve({ ok: true }),
    onUploadLogo: () => Promise.resolve({ ok: true }), onRemoveLogo: () => Promise.resolve({ ok: true }),
    onLeaveFederation: () => {}, onRemoveMember: () => Promise.resolve({ ok: true }),
    onRemoveCoOwner: () => Promise.resolve({ ok: true }), onRevokeInvite: () => Promise.resolve({ ok: true }),
    onSetVisibility: () => Promise.resolve({ ok: true }), onSearchPublicFederations: () => Promise.resolve([]),
    onRequestFederationAffiliation: () => Promise.resolve({ ok: true }), onOpenRecords: () => {},
    onAddUmpire: () => Promise.resolve({ ok: true }), onRemoveUmpire: () => Promise.resolve({ ok: true }),
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(ClubPanel, baseProps(props)));
}

function openManage(inst) {
  const manageBtn = inst.root.findAllByType("button").find(b => b.props.children === "Manage");
  act(() => { manageBtn.props.onClick(); });
}

test("ClubPanel: creating a club fills the name field and calls onCreate, then onSelect with the new club", async () => {
  let createdWith = null;
  let selected = null;
  const inst = render({
    onCreate: name => { createdWith = name; return Promise.resolve({ ok: true, club: { id: "newClub" } }); },
    onSelect: id => { selected = id; }
  });
  const addBtn = inst.root.findByProps({ "aria-label": "Add or join a club" });
  act(() => { addBtn.props.onClick(); });

  const nameField = inst.root.findByType("input");
  act(() => { nameField.props.onChange({ target: { value: "Oakwood CC" } }); });

  const createBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Create"));
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith, "Oakwood CC");
  assert.equal(selected, "newClub");
});

test("ClubPanel: joining with a code calls onJoin with the uppercased, sanitized code", async () => {
  let joinedWith = null;
  const inst = render({ onJoin: code => { joinedWith = code; return Promise.resolve({ ok: true }); } });
  const addBtn = inst.root.findByProps({ "aria-label": "Add or join a club" });
  act(() => { addBtn.props.onClick(); });
  const joinModeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Join with code");
  act(() => { joinModeBtn.props.onClick(); });

  const codeField = inst.root.findByType("input");
  act(() => { codeField.props.onChange({ target: { value: "abc-123" } }); });

  const joinBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Join"));
  await act(async () => {
    joinBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(joinedWith, "ABC123");
});

test("ClubPanel: selecting a club chip calls onSelect", () => {
  let selected = "not called";
  const inst = render({ clubs: [club()], onSelect: id => { selected = id; } });
  const chipBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  chipBtn.props.onClick();
  assert.equal(selected, "c1");
});

test("ClubPanel: 'Edit club name & description' saves changed fields via onRename/onUpdateDescription only", async () => {
  let renamedWith = null, descUpdatedWith = null, addressCalled = false;
  const inst = render({
    clubs: [club()], activeClubId: "c1",
    onRename: (id, name) => { renamedWith = name; return Promise.resolve({ ok: true }); },
    onUpdateDescription: (id, desc) => { descUpdatedWith = desc; return Promise.resolve({ ok: true }); },
    onUpdateAddress: () => { addressCalled = true; return Promise.resolve({ ok: true }); }
  });
  openManage(inst);
  const editBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Edit club name & description"));
  act(() => { editBtn.props.onClick(); });

  const nameField = inst.root.findAllByType("input").filter(i => i.props.type !== "file")[0];
  act(() => { nameField.props.onChange({ target: { value: "Riverside 1st CC" } }); });

  const saveBtn = inst.root.findAllByType("button").find(b => b.props.children === "Save");
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(renamedWith, "Riverside 1st CC");
  assert.equal(descUpdatedWith, null);
  assert.equal(addressCalled, false);
});

test("ClubPanel: as owner, 'Manage' reveals invite/umpire/member controls; inviting a member calls onInvite and shows a confirmation, no code", async () => {
  let invitedWith = null;
  const inst = render({
    clubs: [club()], activeClubId: "c1", currentUid: "owner1",
    onInvite: (id, email) => { invitedWith = { id, email }; return Promise.resolve({ ok: true }); }
  });
  openManage(inst);
  const inviteBtn = inst.root.findAllByType("button").find(b => b.props.children === "Invite someone");
  act(() => { inviteBtn.props.onClick(); });

  const emailField = inst.root.findAllByType("input").find(i => i.props.type !== "file");
  act(() => { emailField.props.onChange({ target: { value: "sam@example.com" } }); });

  const submitInviteBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Invite"));
  await act(async () => {
    submitInviteBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(invitedWith, { id: "c1", email: "sam@example.com" });
  assert.match(JSON.stringify(inst.toJSON()), /Invite sent to/);
  assert.match(JSON.stringify(inst.toJSON()), /sam@example\.com/);
});

test("ClubPanel: inviting a co-owner by email calls onInviteCoOwner and shows a confirmation, no code", async () => {
  let invitedWith = null;
  const inst = render({
    clubs: [club()], activeClubId: "c1", currentUid: "owner1",
    onInviteCoOwner: (id, email) => { invitedWith = { id, email }; return Promise.resolve({ ok: true }); }
  });
  openManage(inst);
  const showMembersBtn = inst.root.findAllByProps({ "aria-label": "Show members" })[0];
  act(() => { showMembersBtn.props.onClick(); });
  const coOwnerBtn = inst.root.findAllByType("button").find(b => b.props.children === "+ Invite a co-owner by email");
  act(() => { coOwnerBtn.props.onClick(); });

  const emailField = inst.root.findAllByType("input").find(i => i.props.type !== "file");
  act(() => { emailField.props.onChange({ target: { value: "sam@example.com" } }); });

  const submitBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Invite"));
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(invitedWith, { id: "c1", email: "sam@example.com" });
  assert.match(JSON.stringify(inst.toJSON()), /Invite sent to/);
  assert.match(JSON.stringify(inst.toJSON()), /sam@example\.com/);
});

test("ClubPanel: a pending co-owner invite shows in the manage panel with a Cancel action wired to onCancelCoOwnerInvite", async () => {
  let cancelledId = null;
  const inst = render({
    clubs: [club()], activeClubId: "c1", currentUid: "owner1",
    coOwnerInvites: [{ id: "inv1", scope: "club", entityId: "c1", email: "sam@example.com", status: "pending" }],
    onCancelCoOwnerInvite: id => { cancelledId = id; return Promise.resolve({ ok: true }); }
  });
  openManage(inst);
  assert.match(JSON.stringify(inst.toJSON()), /Pending invites/);
  assert.match(JSON.stringify(inst.toJSON()), /sam@example\.com/);
  const cancelBtn = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Cancel invite to sam@example.com");
  await act(async () => {
    cancelBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(cancelledId, "inv1");
});

test("ClubPanel: adding an umpire calls onAddUmpire, and removing one calls onRemoveUmpire", async () => {
  let added = null, removed = null;
  const inst = render({
    clubs: [club({ umpires: ["Dickie Bird"] })], activeClubId: "c1", currentUid: "owner1",
    onAddUmpire: (id, name) => { added = { id, name }; return Promise.resolve({ ok: true }); },
    onRemoveUmpire: (id, name) => { removed = { id, name }; }
  });
  openManage(inst);
  const showUmpiresBtn = inst.root.findByProps({ "aria-label": "Show umpires" });
  act(() => { showUmpiresBtn.props.onClick(); });

  const removeBtn = inst.root.findByProps({ "aria-label": "Remove umpire Dickie Bird" });
  act(() => { removeBtn.props.onClick(); });
  assert.deepEqual(removed, { id: "c1", name: "Dickie Bird" });

  const nameField = inst.root.findAllByType("input").find(i => i.props.type !== "file");
  act(() => { nameField.props.onChange({ target: { value: "Simon Taufel" } }); });
  const addBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Add");
  await act(async () => {
    addBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(added, { id: "c1", name: "Simon Taufel" });
});

test("ClubPanel: 'Delete club' opens a ConfirmModal, and confirming calls onDelete", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deleted = null;
  const inst = render({
    clubs: [club()], activeClubId: "c1", currentUid: "owner1",
    onDelete: id => { deleted = id; }
  });
  openManage(inst);
  const deleteBtn = inst.root.findAllByType("button").find(b => b.props.children === "Delete club");
  act(() => { deleteBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  act(() => { modal.props.onConfirm(); });
  assert.equal(deleted, "c1");
});

test("ClubPanel: toggling visibility calls onSetVisibility with the new state", async () => {
  let setTo = null;
  const inst = render({
    clubs: [club({ visibility: "private" })], activeClubId: "c1", currentUid: "owner1",
    onSetVisibility: (id, isPublic) => { setTo = { id, isPublic }; return Promise.resolve({ ok: true }); }
  });
  const publicBtn = inst.root.findByProps({ "aria-label": "Make public" });
  await act(async () => {
    publicBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(setTo, { id: "c1", isPublic: true });
});

test("ClubPanel: requesting affiliation with a found federation calls onRequestFederationAffiliation", async () => {
  let requestedWith = null;
  const inst = render({
    clubs: [club()], activeClubId: "c1", currentUid: "owner1",
    onSearchPublicFederations: () => Promise.resolve([{ federationId: "fed1", name: "County League" }]),
    onRequestFederationAffiliation: (direction, clubId, fedId) => { requestedWith = { direction, clubId, fedId }; return Promise.resolve({ ok: true }); }
  });
  openManage(inst);
  const findFedBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Find a federation to join"));
  act(() => { findFedBtn.props.onClick(); });

  const searchField = inst.root.findAllByType("input").find(i => i.props.type !== "file");
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
