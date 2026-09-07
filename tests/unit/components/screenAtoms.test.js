// Small presentational components used across setup/list screens (src/components/screenAtoms.js).
// FabButton calls ReactDOM.createPortal(..., document.body) directly (a bare global, same as
// AuthBar's menu/ShareMenu), so its test renders through real react-dom (createRoot) into a jsdom
// container instead of react-test-renderer -- same setup as authBar.test.js/shareMenus.test.js,
// for the same reason (react-test-renderer can't host a portal targeting a real DOM node).

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import renderer from "react-test-renderer";
import { FabButton, Field, InstallHintBanner, NavWrap } from "../../../src/components/screenAtoms.js";

test("Field: renders the label above its children", () => {
  const tree = renderer.create(React.createElement(Field, { label: "Team name" }, "content")).toJSON();
  assert.equal(tree.children[0].children[0], "Team name");
  assert.equal(tree.children[1], "content");
});

test("InstallHintBanner: calls onDismiss when the close button is clicked", () => {
  let dismissed = false;
  const root = renderer.create(React.createElement(InstallHintBanner, { onDismiss: () => { dismissed = true; } })).root;
  root.findByProps({ "aria-label": "Dismiss" }).props.onClick();
  assert.equal(dismissed, true);
});

test("NavWrap: renders its children, keyed by navKey, using the 'back' animation only when direction is 'back'", () => {
  const forward = renderer.create(React.createElement(NavWrap, { navKey: "a", direction: "forward" }, "content")).toJSON();
  assert.equal(forward.children[0], "content");
  assert.match(forward.props.style.animation, /cs-navInRight/);

  const back = renderer.create(React.createElement(NavWrap, { navKey: "b", direction: "back" }, "content")).toJSON();
  assert.match(back.props.style.animation, /cs-navInLeft/);
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let dom, container, root;

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.ReactDOM = ReactDOM;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.ReactDOM;
});

test("FabButton: portals a button labeled/found by its aria-label straight onto document.body, and calls onClick", () => {
  let clicked = false;
  act(() => { root.render(React.createElement(FabButton, { onClick: () => { clicked = true; }, label: "New Match" })); });
  // Not inside the local container -- it portaled past it, straight onto document.body.
  assert.doesNotMatch(container.innerHTML, /New Match/);
  const btn = document.body.querySelector("[aria-label='New Match']");
  assert.ok(btn);
  act(() => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(clicked, true);
});
