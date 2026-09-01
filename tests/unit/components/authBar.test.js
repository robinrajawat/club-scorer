// Account button + popover menu in the app header (src/components/authBar.js). Its menu calls
// ReactDOM.createPortal(..., document.body) directly (a bare global, same as ShareMenu/
// MoveTeamMenu) only once open, so tests render through real react-dom (createRoot) into a jsdom
// container instead of react-test-renderer -- same setup as shareMenus.test.js, for the same
// reason (react-test-renderer can't host a portal targeting a real DOM node). ConfirmModal (shown
// for the sign-out confirm step) references Modal as its own separate bare global, stubbed too.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { AuthBar } from "../../../src/components/authBar.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let dom, container, root;

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.ReactDOM = ReactDOM;
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.ReactDOM;
  delete globalThis.Modal;
});

function stubRect(el, rect) {
  el.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect });
}

function baseProps(overrides = {}) {
  return {
    user: null, profile: null,
    onOpenAccount: () => {}, onOpenSharedLinks: () => {}, onOpenHelp: () => {}, onOpenFeedback: () => {},
    onOpenAbout: () => {}, onSignOut: () => Promise.resolve({ ok: true }),
    themePref: "system", onSetTheme: () => {},
    ...overrides
  };
}

function openMenu() {
  const trigger = container.querySelector("[aria-label='Account menu']");
  stubRect(trigger, { top: 40, bottom: 60, left: 10, right: 90 });
  act(() => { trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
}

test("AuthBar: signed out shows 'Sign in', and the closed menu is not portaled yet", () => {
  act(() => { root.render(React.createElement(AuthBar, baseProps())); });
  assert.match(container.innerHTML, /Sign in/);
  assert.doesNotMatch(document.body.innerHTML, /Manage account/);
});

test("AuthBar: opening the menu shows 'Sign in' as a menu item when signed out", () => {
  act(() => { root.render(React.createElement(AuthBar, baseProps())); });
  openMenu();
  assert.match(document.body.innerHTML, /Sign in/);
});

test("AuthBar: opening the menu when signed in shows 'Manage account' and the person's first name/email", () => {
  act(() => {
    root.render(React.createElement(AuthBar, baseProps({ user: { displayName: "Robin Singh", email: "robin@example.com" } })));
  });
  openMenu();
  assert.match(document.body.innerHTML, /Manage account/);
  assert.match(document.body.innerHTML, />Robin</);
  assert.match(document.body.innerHTML, /robin@example\.com/);
});

test("AuthBar: 'Shared Links' is hidden when signed out", () => {
  act(() => { root.render(React.createElement(AuthBar, baseProps())); });
  openMenu();
  assert.doesNotMatch(document.body.innerHTML, /Shared Links/);
});

test("AuthBar: 'Shared Links' shows when signed in and onOpenSharedLinks is provided", () => {
  act(() => {
    root.render(React.createElement(AuthBar, baseProps({ user: { displayName: "Robin" }, onOpenSharedLinks: () => {} })));
  });
  openMenu();
  assert.match(document.body.innerHTML, /Shared Links/);
});

test("AuthBar: clicking a menu item calls its handler and closes the menu", () => {
  let opened = false;
  act(() => { root.render(React.createElement(AuthBar, baseProps({ onOpenHelp: () => { opened = true; } }))); });
  openMenu();
  const helpBtn = [...document.body.querySelectorAll("button")].find(b => b.textContent.includes("Help & FAQ"));
  act(() => { helpBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(opened, true);
  assert.doesNotMatch(document.body.innerHTML, /Help & FAQ/);
});

test("AuthBar: theme buttons call onSetTheme with the picked value", () => {
  let picked = null;
  act(() => { root.render(React.createElement(AuthBar, baseProps({ onSetTheme: v => { picked = v; } }))); });
  openMenu();
  const darkBtn = [...document.body.querySelectorAll("button")].find(b => b.textContent === "Dark");
  act(() => { darkBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(picked, "dark");
});

test("AuthBar: 'Sign out' opens a ConfirmModal, confirming calls onSignOut and closes the dialog on success", async () => {
  let signedOut = false;
  act(() => {
    root.render(React.createElement(AuthBar, baseProps({
      user: { displayName: "Robin" },
      onSignOut: () => { signedOut = true; return Promise.resolve({ ok: true }); }
    })));
  });
  openMenu();
  const signOutBtn = [...document.body.querySelectorAll("button")].find(b => b.textContent.includes("Sign out"));
  act(() => { signOutBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  const stubModal = document.body.querySelector("[data-stub-modal]");
  assert.ok(stubModal);

  const confirmBtn = [...stubModal.querySelectorAll("button")].find(b => b.textContent === "Sign out");
  await act(async () => {
    confirmBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(signedOut, true);
  assert.equal(document.body.querySelector("[data-stub-modal]"), null);
});

test("AuthBar: a failed sign-out keeps the confirm dialog open with the error shown", async () => {
  act(() => {
    root.render(React.createElement(AuthBar, baseProps({
      user: { displayName: "Robin" },
      onSignOut: () => Promise.resolve({ ok: false, error: "Network error — try again." })
    })));
  });
  openMenu();
  const signOutBtn = [...document.body.querySelectorAll("button")].find(b => b.textContent.includes("Sign out"));
  act(() => { signOutBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

  const stubModal = document.body.querySelector("[data-stub-modal]");
  const confirmBtn = [...stubModal.querySelectorAll("button")].find(b => b.textContent === "Sign out");
  await act(async () => {
    confirmBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(document.body.innerHTML, /Network error — try again\./);
  assert.ok(document.body.querySelector("[data-stub-modal]"));
});
