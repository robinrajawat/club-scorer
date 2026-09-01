// Bottom-sheet modal shell (src/components/modal.js). Unlike the other component tests in this
// directory, Modal reads real window/document APIs (visualViewport, scrollY, body.style,
// activeElement, addEventListener) directly in its effects rather than through ambient globals a
// caller supplies -- so these tests run against a real jsdom-backed window/document, installed on
// globalThis only for the duration of each test (see beforeEach/afterEach) so the many other test
// files in this repo, which deliberately run under plain Node with no DOM, keep working unchanged.
// Every mount/unmount/state-changing interaction is wrapped in act() so Modal's effects (which run
// as passive effects, not synchronously with render) are guaranteed to have flushed by the time
// each assertion runs, and don't leak into a later test after globalThis.window is torn down.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Modal } from "../../../src/components/modal.js";

let dom;

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body><button id=\"opener\">Open</button></body></html>", {
    url: "https://example.test/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
});

test("Modal: renders children inside a dialog, sized off window.innerHeight when visualViewport is unavailable", () => {
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(Modal, { onClose: () => {} }, "hello"));
  });
  try {
    const dialog = inst.root.findByProps({ role: "dialog" });
    assert.equal(dialog.props["aria-modal"], "true");
    assert.equal(dialog.props.style.maxHeight, window.innerHeight * 0.85);
    assert.ok(JSON.stringify(inst.toJSON()).includes("hello"));
  } finally {
    act(() => { inst.unmount(); });
  }
});

test("Modal: clicking the scrim backdrop calls onClose, clicking the sheet itself does not", () => {
  let closed = false;
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(Modal, { onClose: () => { closed = true; } }, "content"));
  });
  try {
    const dialog = inst.root.findByProps({ role: "dialog" });
    dialog.props.onClick({ stopPropagation: () => {} });
    assert.equal(closed, false);
    const scrim = inst.root.children[0];
    scrim.props.onClick();
    assert.equal(closed, true);
  } finally {
    act(() => { inst.unmount(); });
  }
});

test("Modal: pressing Escape calls onClose", () => {
  let closed = false;
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(Modal, { onClose: () => { closed = true; } }, "content"));
  });
  try {
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    });
    assert.equal(closed, true);
  } finally {
    act(() => { inst.unmount(); });
  }
});

test("Modal: locks body scroll position while mounted and restores it on unmount", () => {
  // jsdom doesn't implement actual page scrolling, so window.scrollTo() is a no-op and scrollY
  // stays read-only at 0 -- stub both directly to exercise Modal's save/restore logic for real.
  Object.defineProperty(window, "scrollY", { value: 240, configurable: true });
  const scrollToCalls = [];
  window.scrollTo = (...args) => scrollToCalls.push(args);
  const opener = document.getElementById("opener");
  opener.focus();
  assert.equal(document.activeElement, opener);

  // react-test-renderer doesn't mount to a real DOM, so sheetRef.current is null by default and
  // Modal's own sheetRef.current.focus() call would silently no-op -- createNodeMock stands in a
  // real, document-attached element for the dialog's ref so the focus-trap effect has something
  // real to focus, and document.activeElement genuinely moves.
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(Modal, { onClose: () => {} }, "content"), {
      createNodeMock: element => {
        if (element.props.role !== "dialog") return null;
        const node = document.createElement("div");
        // jsdom only makes an element focusable (a valid document.activeElement) once it has an
        // explicit tabindex -- matching the real dialog div's own tabIndex: -1 prop.
        node.setAttribute("tabindex", "-1");
        document.body.appendChild(node);
        return node;
      }
    });
  });
  assert.equal(document.body.style.position, "fixed");
  assert.equal(document.body.style.top, "-240px");
  // Focus should have moved to the sheet itself while the modal is open.
  assert.notEqual(document.activeElement, opener);

  act(() => { inst.unmount(); });
  assert.equal(document.body.style.position, "");
  // Restores the saved scroll position itself, rather than letting the browser do it.
  assert.deepEqual(scrollToCalls, [[0, 240]]);
  // Focus returns to whatever opened the sheet once it closes.
  assert.equal(document.activeElement, opener);
});

test("Modal: tracks window.visualViewport height when the API is present, and unsubscribes on unmount", () => {
  const listeners = {};
  const stubViewport = {
    height: 500,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type, fn) => { if (listeners[type] === fn) delete listeners[type]; }
  };
  window.visualViewport = stubViewport;
  try {
    let inst;
    act(() => {
      inst = renderer.create(React.createElement(Modal, { onClose: () => {} }, "content"));
    });
    try {
      let dialog = inst.root.findByProps({ role: "dialog" });
      assert.equal(dialog.props.style.maxHeight, 500 * 0.85);
      assert.equal(typeof listeners.resize, "function");
      assert.equal(typeof listeners.scroll, "function");

      stubViewport.height = 300;
      act(() => { listeners.resize(); });
      dialog = inst.root.findByProps({ role: "dialog" });
      assert.equal(dialog.props.style.maxHeight, 300 * 0.85);
    } finally {
      act(() => { inst.unmount(); });
    }
    assert.equal(listeners.resize, undefined);
    assert.equal(listeners.scroll, undefined);
  } finally {
    delete window.visualViewport;
  }
});
