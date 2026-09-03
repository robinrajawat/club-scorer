// Combined inbox screen (src/components/inboxScreen.js): availability polls awaiting a response,
// plus club-federation affiliation requests. Every write action is a prop, so most tests need no
// stubbing at all. The one exception: tapping a poll item opens AvailabilityPollModal, which
// references Modal as a bare global and calls loadTeamPolls/loadPollByCode from its own mount
// effect -- same stubbing pattern as availabilityPollModal.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { InboxScreen } from "../../../src/components/inboxScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { AvailabilityPollModal } from "../../../src/components/availabilityPollModal.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadTeamPolls;
  delete globalThis.loadPollByCode;
});

const club = { id: "c1", name: "Riverside CC", ownerUid: "owner1" };
const federation = { id: "fed1", name: "County League", createdBy: "fedOwner1" };

function baseProps(overrides = {}) {
  return {
    requests: [], clubs: [club], federationsById: { fed1: federation }, currentUid: "owner1",
    currentEmail: "owner1@example.com",
    onRespond: () => Promise.resolve({ ok: true }), onCancel: () => Promise.resolve({ ok: true }),
    onCompleteJoin: () => Promise.resolve({ ok: true }), onBack: () => {},
    coOwnerInvites: [], onRespondCoOwnerInvite: () => Promise.resolve({ ok: true }),
    onCancelCoOwnerInvite: () => Promise.resolve({ ok: true }),
    ...overrides
  };
}

test("InboxScreen: shows 'Nothing pending right now' when everything is empty", () => {
  const inst = renderer.create(React.createElement(InboxScreen, baseProps()));
  assert.equal(hasText(inst.toJSON(), "Nothing pending right now."), true);
});

test("InboxScreen: an incoming club_to_federation request (I own the federation) shows Accept/Decline", async () => {
  let respondedWith = null;
  const requests = [{ id: "r1", direction: "club_to_federation", status: "pending", clubId: "c1", federationId: "fed1" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    requests, currentUid: "fedOwner1",
    onRespond: (id, accept) => { respondedWith = { id, accept }; return Promise.resolve({ ok: true }); }
  })));
  assert.equal(hasText(inst.toJSON(), "Needs your response"), true);
  const acceptBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Accept"));
  await act(async () => {
    acceptBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(respondedWith, { id: "r1", accept: true });
});

test("InboxScreen: an outgoing request (I own the club) shows 'Sent' with a Cancel request link", async () => {
  let cancelledId = null;
  const requests = [{ id: "r2", direction: "club_to_federation", status: "pending", clubId: "c1", federationId: "fed1" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    requests, onCancel: id => { cancelledId = id; return Promise.resolve({ ok: true }); }
  })));
  assert.equal(hasText(inst.toJSON(), "Sent — waiting on a response"), true);
  const cancelBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Cancel request"));
  await act(async () => {
    cancelBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(cancelledId, "r2");
});

test("InboxScreen: an 'accepted' club_to_federation request I own shows 'Finish joining', wired to onCompleteJoin", async () => {
  let finalizedWith = null;
  const requests = [{ id: "r3", direction: "club_to_federation", status: "accepted", clubId: "c1", federationId: "fed1" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    requests, onCompleteJoin: (id, clubId, fedId) => { finalizedWith = { id, clubId, fedId }; return Promise.resolve({ ok: true }); }
  })));
  assert.equal(hasText(inst.toJSON(), "Approved — finish joining"), true);
  const finishBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Finish joining"));
  await act(async () => {
    finishBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(finalizedWith, { id: "r3", clubId: "c1", fedId: "fed1" });
});

test("InboxScreen: a failed respond shows the returned error", async () => {
  const requests = [{ id: "r1", direction: "club_to_federation", status: "pending", clubId: "c1", federationId: "fed1" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    requests, currentUid: "fedOwner1",
    onRespond: () => Promise.resolve({ ok: false, error: "That request no longer exists." })
  })));
  const acceptBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Accept"));
  await act(async () => {
    acceptBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(hasText(inst.toJSON(), "That request no longer exists."), true);
});

test("InboxScreen: an incoming co-owner invite addressed to my email shows Accept/Decline, wired to onRespondCoOwnerInvite", async () => {
  let respondedWith = null;
  const coOwnerInvites = [{ id: "inv1", scope: "club", entityId: "c1", email: "owner1@example.com", status: "pending", createdByName: "Sam" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    coOwnerInvites,
    onRespondCoOwnerInvite: (id, accept) => { respondedWith = { id, accept }; return Promise.resolve({ ok: true }); }
  })));
  assert.equal(hasText(inst.toJSON(), "Co-owner invites"), true);
  assert.equal(hasText(inst.toJSON(), "Riverside CC"), true);
  const acceptBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Accept"));
  await act(async () => {
    acceptBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(respondedWith, { id: "inv1", accept: true });
});

test("InboxScreen: an outgoing co-owner invite I sent shows a Cancel invite link, wired to onCancelCoOwnerInvite", async () => {
  let cancelledId = null;
  const coOwnerInvites = [{ id: "inv2", scope: "federation", entityId: "fed1", email: "sam@example.com", status: "pending", createdBy: "owner1" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    coOwnerInvites,
    onCancelCoOwnerInvite: id => { cancelledId = id; return Promise.resolve({ ok: true }); }
  })));
  assert.equal(hasText(inst.toJSON(), "Co-owner invites sent"), true);
  const cancelBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Cancel invite"));
  await act(async () => {
    cancelBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(cancelledId, "inv2");
});

test("InboxScreen: tapping a poll item opens AvailabilityPollModal for that item's team, and closing it calls onPollsChanged", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  globalThis.loadTeamPolls = () => Promise.resolve([]);
  globalThis.loadPollByCode = () => Promise.resolve(null);
  let pollsChanged = false;
  const pollItems = [{ code: "POLL1", team: { id: "t1", name: "Riverside 1st XI" }, pendingCount: 3, question: "" }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({ pollItems, onPollsChanged: () => { pollsChanged = true; } })));

  const pollBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside 1st XI"));
  await act(async () => {
    pollBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const modal = inst.root.findByType(AvailabilityPollModal);
  assert.equal(modal.props.team.id, "t1");
  assert.equal(modal.props.initialCode, "POLL1");

  await act(async () => {
    modal.props.onClose();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(pollsChanged, true);
});

test("InboxScreen: activity items render with an unread dot, prefer entityName over a local lookup, and 'Mark all read' calls onMarkActivityRead with only the unread ids", async () => {
  let markedIds = null;
  const activity = [
    { id: "a1", kind: "joined", scope: "club", entityId: "unknown-club", entityName: "Riverside CC", actorName: "Sam", role: "member", read: false, createdAt: 2000 },
    { id: "a2", kind: "removed", scope: "club", entityId: "unknown-club", entityName: "Riverside CC", actorName: "Pat", read: true, createdAt: 1000 }
  ];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    activity,
    onMarkActivityRead: ids => { markedIds = ids; return Promise.resolve(); }
  })));
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Sam.*joined.*Riverside CC/);
  assert.match(json, /You were removed from.*Riverside CC.*by.*Pat/);

  const markAllBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Mark all read"));
  await act(async () => {
    markAllBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(markedIds, ["a1"]);
});

test("InboxScreen: 'Mark all read' is hidden once every activity item is already read", () => {
  const activity = [{ id: "a1", kind: "left", scope: "club", entityId: "c1", entityName: "Riverside CC", actorName: "Sam", read: true, createdAt: 1000 }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({ activity })));
  const markAllBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Mark all read"));
  assert.equal(markAllBtn, undefined);
});

test("InboxScreen: 'Clear all' calls onDeleteActivity with every activity id, and a per-item '×' clears just that one", async () => {
  let clearedWith = null;
  const activity = [
    { id: "a1", kind: "joined", scope: "club", entityId: "unknown-club", entityName: "Riverside CC", actorName: "Sam", role: "member", read: false, createdAt: 2000 },
    { id: "a2", kind: "removed", scope: "club", entityId: "unknown-club", entityName: "Riverside CC", actorName: "Pat", read: true, createdAt: 1000 }
  ];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({
    activity,
    onDeleteActivity: ids => { clearedWith = ids; return Promise.resolve(); }
  })));

  const clearOneBtn = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Clear this notification");
  await act(async () => {
    clearOneBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(clearedWith, "a1");

  const clearAllBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Clear all"));
  await act(async () => {
    clearAllBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(clearedWith, ["a1", "a2"]);
});

test("InboxScreen: activity has no clear affordances when onDeleteActivity isn't provided", () => {
  const activity = [{ id: "a1", kind: "left", scope: "club", entityId: "c1", entityName: "Riverside CC", actorName: "Sam", read: true, createdAt: 1000 }];
  const inst = renderer.create(React.createElement(InboxScreen, baseProps({ activity })));
  assert.equal(inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Clear this notification"), undefined);
  assert.equal(inst.root.findAllByType("button").find(b => hasText(b.props.children, "Clear all")), undefined);
});
