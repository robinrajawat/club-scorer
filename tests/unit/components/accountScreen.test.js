// The signed-in-or-not account/settings screen (src/components/accountScreen.js). Every Firebase
// Auth/Firestore call this screen makes -- submitBetaRequest, loadFeedback, loadBetaRequests (a
// mount effect, only for a signed-in admin), linkPasswordCredential, linkGoogleCredential,
// signUpEmail, signInEmail, sendPasswordReset -- is a bare global, same pattern
// WelcomeScreen/AuthActionScreen already established, stubbed per test as needed. `Modal` (bare
// global) backs the delete-account dialog. Export/import (handleExport/handleImportFile) touch
// real browser-only APIs (Blob, URL.createObjectURL, FileReader) from inside their own click
// handlers -- like ExportPdfButton's window.print(), these tests confirm the buttons render and
// gate correctly but don't click through them, a disclosed gap rather than pulling in jsdom for it.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { AccountScreen } from "../../../src/components/accountScreen.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.submitBetaRequest;
  delete globalThis.loadFeedback;
  delete globalThis.loadBetaRequests;
  delete globalThis.linkPasswordCredential;
  delete globalThis.linkGoogleCredential;
  delete globalThis.signUpEmail;
  delete globalThis.signInEmail;
  delete globalThis.sendPasswordReset;
});

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function baseProps(overrides = {}) {
  return {
    user: null, profile: null, myPlayer: null, isAdmin: false,
    onOpenFeedbackInbox: () => {}, onOpenBetaTesters: () => {}, onOpenClub: () => {},
    isBetaTester: false, onGenerateDummyData: () => Promise.resolve({ ok: true, clubIds: [] }),
    onWipeDummyData: () => Promise.resolve({ ok: true }),
    clubs: [], federationsById: {},
    onSignIn: () => Promise.resolve({ ok: true }), onSignOut: () => Promise.resolve({ ok: true }),
    onSaveProfile: () => Promise.resolve(), onExportData: () => Promise.resolve({}),
    onImportData: () => Promise.resolve({ ok: true }), onDeleteAccount: () => Promise.resolve(),
    onBack: () => {}, redirectError: "", linkStatus: "", onClearLinkStatus: () => {},
    ...overrides
  };
}

function render(props) {
  let inst;
  act(() => { inst = renderer.create(React.createElement(AccountScreen, baseProps(props))); });
  return inst;
}

function input(inst, placeholder) {
  return inst.root.findAllByType("input").find(i => i.props.placeholder === placeholder);
}

function btn(inst, text) {
  return inst.root.findAllByType(Btn).find(b => b.props.children === text);
}

test("AccountScreen: signed out shows a Google sign-in button, and clicking it calls onSignIn", () => {
  let called = false;
  const inst = render({ onSignIn: () => { called = true; return Promise.resolve({ ok: true }); } });
  assert.match(JSON.stringify(inst.toJSON()), /Not signed in/);
  const signInBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Sign in with Google"));
  act(() => { signInBtn.props.onClick(); });
  assert.equal(called, true);
});

test("AccountScreen: signed-out email sign-in calls signInEmail with the typed credentials", async () => {
  let signedInWith = null;
  globalThis.signInEmail = (email, password) => { signedInWith = { email, password }; return Promise.resolve({ ok: true }); };
  const inst = render();
  const emailToggle = inst.root.findAllByType("button").find(b => b.props.children === "Sign in with email instead");
  act(() => { emailToggle.props.onClick(); });
  act(() => { input(inst, "Email").props.onChange({ target: { value: "a@x.com" } }); });
  act(() => { input(inst, "Password").props.onChange({ target: { value: "hunter2" } }); });
  await act(async () => { btn(inst, "Sign in").props.onClick(); });
  assert.deepEqual(signedInWith, { email: "a@x.com", password: "hunter2" });
});

test("AccountScreen: editing the display name enables Save, and Save calls onSaveProfile", () => {
  let saved = null;
  const inst = render({
    user: { uid: "u1", displayName: "Robin Singh", email: "robin@x.com", providerData: [] },
    onSaveProfile: p => { saved = p; return Promise.resolve(); }
  });
  assert.equal(btn(inst, "Save").props.disabled, true);
  act(() => { input(inst, "Your name").props.onChange({ target: { value: "Robin S." } }); });
  assert.equal(btn(inst, "Save").props.disabled, false);
  act(() => { btn(inst, "Save").props.onClick(); });
  assert.deepEqual(saved, { displayName: "Robin S." });
});

test("AccountScreen: signing out asks for confirmation, and confirming signs out and goes back", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let signedOut = false, wentBack = false;
  const inst = render({
    user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] },
    onSignOut: () => { signedOut = true; return Promise.resolve({ ok: true }); },
    onBack: () => { wentBack = true; }
  });
  act(() => { btn(inst, "Sign out").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Sign out\?/);
  // Both the row's own Sign out button and ConfirmModal's confirm button share the text "Sign
  // out" -- go through the modal's onConfirm prop directly rather than an ambiguous text match.
  const confirmModal = inst.root.findByType(ConfirmModal);
  await act(async () => { confirmModal.props.onConfirm(); });
  assert.equal(signedOut, true);
  assert.equal(wentBack, true);
});

test("AccountScreen: admin sees Feedback Inbox / Beta Testers rows with counts loaded on mount", async () => {
  globalThis.loadFeedback = () => Promise.resolve([{ status: "open" }, { status: "resolved" }]);
  globalThis.loadBetaRequests = () => Promise.resolve([{}, {}, {}]);
  let openedFeedback = false;
  const inst = render({
    user: { uid: "admin1", displayName: "Admin", email: "admin@x.com", providerData: [] },
    isAdmin: true,
    onOpenFeedbackInbox: () => { openedFeedback = true; }
  });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Feedback Inbox/);
  assert.match(text, /Beta Testers/);
  const feedbackRow = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Feedback Inbox"));
  act(() => { feedbackRow.props.onClick(); });
  assert.equal(openedFeedback, true);
});

test("AccountScreen: requesting beta access calls submitBetaRequest and shows confirmation", async () => {
  globalThis.submitBetaRequest = () => Promise.resolve({ ok: true });
  const inst = render({ user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] } });
  const requestBtn = btn(inst, "Request beta access");
  await act(async () => { requestBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Request sent/);
});

test("AccountScreen: beta tester tools generate and wipe dummy data", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let generated = false, wiped = false;
  const inst = render({
    user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] },
    isBetaTester: true,
    onGenerateDummyData: () => { generated = true; return Promise.resolve({ ok: true, clubIds: ["c1", "c2"] }); },
    onWipeDummyData: () => { wiped = true; return Promise.resolve({ ok: true }); }
  });
  await act(async () => { btn(inst, "Generate dummy data").props.onClick(); });
  assert.equal(generated, true);
  assert.match(JSON.stringify(inst.toJSON()), /2 boards/);

  act(() => { btn(inst, "Wipe dummy data").props.onClick(); });
  const confirmWipeBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Wipe");
  await act(async () => { confirmWipeBtn.props.onClick(); });
  assert.equal(wiped, true);
});

test("AccountScreen: deleting the account requires typing DELETE before it's enabled", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deleted = false;
  const inst = render({
    user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] },
    onDeleteAccount: () => { deleted = true; return Promise.resolve(); }
  });
  const openBtn = inst.root.findAllByType("button").find(b => b.props.children === "Delete my account");
  act(() => { openBtn.props.onClick(); });
  const confirmBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Permanently delete my account"));
  assert.equal(confirmBtn.props.disabled, true);

  const confirmInput = inst.root.findAllByType("input").find(i => i.props.placeholder === "DELETE");
  act(() => { confirmInput.props.onChange({ target: { value: "DELETE" } }); });
  const confirmBtn2 = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Permanently delete my account"));
  assert.equal(confirmBtn2.props.disabled, false);
  await act(async () => { confirmBtn2.props.onClick(); });
  assert.equal(deleted, true);
});

test("AccountScreen: deleting the sole owner of a club warns before letting the delete proceed", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = render({
    user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] },
    clubs: [{ id: "c1", name: "Riverside CC", ownerUid: "u1", coOwnerUids: [] }]
  });
  const openBtn = inst.root.findAllByType("button").find(b => b.props.children === "Delete my account");
  act(() => { openBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Riverside CC/);
  assert.match(JSON.stringify(inst.toJSON()), /permanently stuck/);
});

test("AccountScreen: linking a password and linking Google both call their bare-global helpers", async () => {
  let linkedPassword = null, linkedGoogle = false;
  globalThis.linkPasswordCredential = pw => { linkedPassword = pw; return Promise.resolve({ ok: true }); };
  globalThis.linkGoogleCredential = () => { linkedGoogle = true; return Promise.resolve({ ok: true }); };
  const inst = render({ user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] } });

  const pwInput = inst.root.findAllByType("input").find(i => i.props.placeholder === "Set a password (6+ characters)");
  act(() => { pwInput.props.onChange({ target: { value: "hunter22" } }); });
  const setBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Set");
  await act(async () => { setBtn.props.onClick(); });
  assert.equal(linkedPassword, "hunter22");

  const linkGoogleBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Link Google account"));
  await act(async () => { linkGoogleBtn.props.onClick(); });
  assert.equal(linkedGoogle, true);
});

test("AccountScreen: linkStatus banner renders and its dismiss button calls onClearLinkStatus", () => {
  let cleared = false;
  const inst = render({ linkStatus: "Google account linked.", onClearLinkStatus: () => { cleared = true; } });
  assert.match(JSON.stringify(inst.toJSON()), /Google account linked\./);
  const dismissBtn = inst.root.findByProps({ "aria-label": "Dismiss" });
  act(() => { dismissBtn.props.onClick(); });
  assert.equal(cleared, true);
});

test("AccountScreen: 'Discoverable for invites' toggle reflects isProfilePublic and calls onSetProfileVisibility", async () => {
  let setTo = null;
  const inst = render({
    user: { uid: "u1", displayName: "Robin", email: "robin@x.com", providerData: [] },
    isProfilePublic: false,
    onSetProfileVisibility: isPublic => { setTo = isPublic; return Promise.resolve({ ok: true }); }
  });
  assert.match(JSON.stringify(inst.toJSON()), /Discoverable for invites/);
  const toggle = inst.root.findByProps({ "aria-label": "Make public" });
  await act(async () => {
    toggle.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(setTo, true);
});
