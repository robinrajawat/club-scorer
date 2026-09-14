// The "inbox" screen (src/components/inboxScreen.js): now just a plain activity feed. Availability
// polls and club/federation affiliation requests/co-owner invites -- this screen's whole original
// reason for existing -- were removed alongside clubs/federations (see
// docs/simplification-plan.md); `activity`/`notifyActivity` are kept as dormant infrastructure for
// a possible future team-sharing feature, so this screen stays too, reduced to what that dormant
// data can actually drive.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { InboxScreen } from "../../../src/components/inboxScreen.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function baseProps(overrides = {}) {
  return {
    activity: [], onBack: () => {},
    ...overrides
  };
}

test("InboxScreen: shows 'Nothing here right now' when there's no activity", () => {
  const inst = renderer.create(React.createElement(InboxScreen, baseProps()));
  assert.equal(hasText(inst.toJSON(), "Nothing here right now."), true);
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
