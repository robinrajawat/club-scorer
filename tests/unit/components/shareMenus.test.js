// Portal popover menus (src/components/shareMenus.js). Both MoveTeamMenu and ShareMenu call
// ReactDOM.createPortal(..., document.body) directly, along with getBoundingClientRect,
// window.innerWidth/innerHeight, and (ShareMenu only) navigator.clipboard -- real DOM APIs, same
// as Modal. Unlike every other component test in this directory, these render through real
// react-dom (createRoot) into a jsdom container instead of react-test-renderer: react-test-renderer
// manages its own fake "instance" tree and can't host a portal whose target is a real DOM node
// (confirmed by trying it first -- it throws "parentInstance.children.indexOf is not a function"
// deep in its own commit phase), so a portal that targets a genuine document.body needs a genuine
// DOM-backed renderer end to end.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { MoveTeamMenu, ShareMenu } from "../../../src/components/shareMenus.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let dom, container, root;

// Node has a built-in read-only `navigator` global (getter-only, no setter) since Node 21, so a
// plain `globalThis.navigator = ...` assignment throws -- redefine the property instead.
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.ReactDOM = ReactDOM;
  setNavigator(dom.window.navigator);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.ReactDOM;
  delete globalThis.navigator;
});

// A real, positioned, document-attached button so MoveTeamMenu/ShareMenu's own getBoundingClientRect
// reads back a fixed, predictable rect (jsdom's own layout engine always reports 0s).
function stubRect(el, rect) {
  el.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...rect });
}

test("MoveTeamMenu: renders nothing when there's nowhere else to move the team", () => {
  act(() => {
    root.render(React.createElement(MoveTeamMenu, {
      team: { id: "t1" }, clubs: [], currentClubId: null, onMove: () => {}
    }));
  });
  assert.equal(container.innerHTML, "");
});

test("MoveTeamMenu: opens a portal menu listing destinations, picking one calls onMove and closes it", async () => {
  let movedTo;
  act(() => {
    root.render(React.createElement(MoveTeamMenu, {
      team: { id: "t1" }, clubs: [{ id: "c1", name: "Riverside CC" }], currentClubId: "c2",
      onMove: (team, destId) => { movedTo = destId; }
    }));
  });
  const trigger = container.querySelector("[aria-label='Move team']");
  stubRect(trigger, { top: 40, bottom: 60, left: 10, right: 90 });
  // Nothing portaled to document.body until opened.
  assert.doesNotMatch(document.body.innerHTML, /Riverside CC/);

  act(() => { trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.match(document.body.innerHTML, /Riverside CC/);
  assert.match(document.body.innerHTML, /My Teams/);

  const destButton = [...document.body.querySelectorAll("button")].find(b => b.textContent === "Riverside CC");
  assert.ok(destButton);
  // handlePick is async (awaits onMove before its own setBusy(false)), so its state update after
  // that await lands in a later microtask -- flush it inside act() rather than let it warn as an
  // update outside of act.
  await act(async () => {
    destButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(movedTo, "c1");
  // Menu closes after a pick.
  assert.doesNotMatch(document.body.innerHTML, /Riverside CC/);
});

test("ShareMenu: opens a portal menu with invite/share/copy rows, closes on scrim click", () => {
  act(() => {
    root.render(React.createElement(ShareMenu, {
      match: { status: "live", shareCode: "ABC123" },
      onGetCode: () => Promise.resolve({ ok: true, code: "ABC123" }),
      onGetViewCode: () => Promise.resolve({ ok: true, code: "VIEW1" })
    }));
  });
  const trigger = container.querySelector("[aria-label='Share']");
  stubRect(trigger, { top: 40, bottom: 60, left: 10, right: 90 });
  act(() => { trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

  assert.match(document.body.innerHTML, /ABC123/);
  assert.match(document.body.innerHTML, /Share live score/);
  assert.match(document.body.innerHTML, /Share match details/);

  // The full-screen scrim (the portal's first child) closes the menu when clicked.
  const scrim = [...document.body.querySelectorAll("div")].find(d => d.getAttribute("style")?.includes("position: fixed") && d.getAttribute("style")?.includes("inset: 0px"));
  assert.ok(scrim);
  act(() => { scrim.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.doesNotMatch(document.body.innerHTML, /Share live score/);
});

test("ShareMenu: clicking 'Copy link' fetches a view code and copies the follow URL to the clipboard", async () => {
  const writeText = [];
  setNavigator({
    ...dom.window.navigator,
    clipboard: { writeText: text => { writeText.push(text); return Promise.resolve(); } }
  });
  act(() => {
    root.render(React.createElement(ShareMenu, {
      match: { status: "live", shareCode: "ABC123" },
      onGetCode: () => Promise.resolve({ ok: true, code: "ABC123" }),
      onGetViewCode: () => Promise.resolve({ ok: true, code: "VIEW1" })
    }));
  });
  const trigger = container.querySelector("[aria-label='Share']");
  stubRect(trigger, { top: 40, bottom: 60, left: 10, right: 90 });
  act(() => { trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

  const copyLinkBtn = [...document.body.querySelectorAll("button")].find(b => b.textContent === "Copy link");
  assert.ok(copyLinkBtn);
  await act(async () => {
    copyLinkBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(writeText.length, 1);
  assert.match(writeText[0], /VIEW1/);

  // flashCopied's own setTimeout(1500) would otherwise fire after this test (and this file's
  // afterEach) has already torn globalThis.window down, throwing "window is not defined" from
  // inside React's own scheduler -- wait it out for real, while window still exists, instead of
  // leaving it to fire into a deleted DOM.
  await act(async () => { await new Promise(r => setTimeout(r, 1600)); });
});
