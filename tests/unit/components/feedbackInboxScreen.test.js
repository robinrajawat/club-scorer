// Admin-only feedback/crash-report inbox (src/components/feedbackInboxScreen.js). `loadFeedback`
// runs from a mount-time useEffect; `updateFeedbackStatus`/`updateFeedbackPriority`/`deleteFeedback`
// are bare-global Firestore calls from button handlers -- all stubbed per test. `navigator.clipboard`
// needs the Object.defineProperty workaround for Node's read-only `navigator` global.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FeedbackInboxScreen } from "../../../src/components/feedbackInboxScreen.js";
import { ConfirmModal } from "../../../src/components/formUiAtoms.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

afterEach(() => {
  delete globalThis.loadFeedback;
  delete globalThis.updateFeedbackStatus;
  delete globalThis.updateFeedbackPriority;
  delete globalThis.deleteFeedback;
  delete globalThis.navigator;
  delete globalThis.Modal;
});

function item(overrides = {}) {
  return {
    id: "f1", kind: "feedback", message: "Love the app!", email: "robin@example.com",
    createdAt: Date.now(), status: "open", priority: "medium",
    ...overrides
  };
}

async function renderScreen(items, extraProps = {}) {
  globalThis.loadFeedback = () => Promise.resolve(items);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(FeedbackInboxScreen, { onBack: () => {}, ...extraProps }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("FeedbackInboxScreen: loads and shows items matching the default filters (open status)", async () => {
  const inst = await renderScreen([item(), item({ id: "f2", status: "fixed", message: "Now fixed" })]);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Love the app!/);
  assert.doesNotMatch(text, /Now fixed/);
});

test("FeedbackInboxScreen: kind filter narrows the visible list", async () => {
  const inst = await renderScreen([item({ kind: "feedback" }), item({ id: "f2", kind: "error", message: "Crashed on submit" })]);
  const kindSelect = inst.root.findAllByType("select")[0];
  act(() => { kindSelect.props.onChange({ target: { value: "error" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Crashed on submit/);
  assert.doesNotMatch(text, /Love the app!/);
});

test("FeedbackInboxScreen: expanding a row shows its URL and user agent", async () => {
  const inst = await renderScreen([item({ url: "https://clubscorer.app/match/abc", userAgent: "TestAgent/1.0" })]);
  const header = inst.root.findAllByType("div").find(d => typeof d.props.onClick === "function" && hasText(d.props.children, "Love the app!"));
  act(() => { header.props.onClick(); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /clubscorer\.app\/match\/abc/);
  assert.match(text, /TestAgent\/1\.0/);
});

test("FeedbackInboxScreen: cycling priority calls updateFeedbackPriority with the next value", async () => {
  let updatedTo = null;
  globalThis.updateFeedbackPriority = (id, priority) => { updatedTo = { id, priority }; return Promise.resolve({ ok: true }); };
  const inst = await renderScreen([item({ priority: "medium" })]);
  const header = inst.root.findAllByType("div").find(d => typeof d.props.onClick === "function" && hasText(d.props.children, "Love the app!"));
  act(() => { header.props.onClick(); });
  const priorityBtn = inst.root.findAllByType("button").find(b => b.props.title === "Tap to cycle priority");
  await act(async () => {
    priorityBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(updatedTo, { id: "f1", priority: "high" });
});

test("FeedbackInboxScreen: cycling status calls updateFeedbackStatus with the next value", async () => {
  let updatedTo = null;
  globalThis.updateFeedbackStatus = (id, status, note) => { updatedTo = { id, status, note }; return Promise.resolve({ ok: true }); };
  const inst = await renderScreen([item({ status: "open" })]);
  const header = inst.root.findAllByType("div").find(d => typeof d.props.onClick === "function" && hasText(d.props.children, "Love the app!"));
  act(() => { header.props.onClick(); });
  const statusBtn = inst.root.findAllByType("button").find(b => b.props.title === "Tap to cycle status");
  await act(async () => {
    statusBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedTo.id, "f1");
  assert.equal(updatedTo.status, "planned");
});

test("FeedbackInboxScreen: editing then saving a note calls updateFeedbackStatus with the draft note", async () => {
  let updatedTo = null;
  globalThis.updateFeedbackStatus = (id, status, note) => { updatedTo = { id, status, note }; return Promise.resolve({ ok: true }); };
  const inst = await renderScreen([item()]);
  const header = inst.root.findAllByType("div").find(d => typeof d.props.onClick === "function" && hasText(d.props.children, "Love the app!"));
  act(() => { header.props.onClick(); });

  const textarea = inst.root.findByType("textarea");
  act(() => { textarea.props.onChange({ target: { value: "Investigating" } }); });

  const saveBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Save note"));
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(updatedTo, { id: "f1", status: "open", note: "Investigating" });
});

test("FeedbackInboxScreen: 'Copy prompt' writes a Claude fix prompt to the clipboard", async () => {
  const written = [];
  setNavigator({ clipboard: { writeText: text => { written.push(text); return Promise.resolve(); } } });
  const inst = await renderScreen([item({ message: "Crashes on submit" })]);
  const header = inst.root.findAllByType("div").find(d => typeof d.props.onClick === "function" && hasText(d.props.children, "Crashes on submit"));
  act(() => { header.props.onClick(); });

  const copyBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Copy prompt"));
  act(() => { copyBtn.props.onClick(); });
  assert.equal(written.length, 1);
  assert.match(written[0], /Crashes on submit/);
});

test("FeedbackInboxScreen: 'Delete' opens a ConfirmModal, and confirming calls deleteFeedback and removes the row", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deletedId = null;
  globalThis.deleteFeedback = id => { deletedId = id; return Promise.resolve({ ok: true }); };
  const inst = await renderScreen([item()]);
  const header = inst.root.findAllByType("div").find(d => typeof d.props.onClick === "function" && hasText(d.props.children, "Love the app!"));
  act(() => { header.props.onClick(); });
  const deleteBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Delete"));
  act(() => { deleteBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  await act(async () => {
    modal.props.onConfirm();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(deletedId, "f1");
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Love the app!/);
});
