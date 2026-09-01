// Top-level crash boundary (src/components/errorBoundary.js) wrapping <CricketScorer /> at the
// bootstrap render call. `reportErrorAuto`/`submitFeedback` (bare globals, Firestore writes) and
// `RECENT_CONSOLE_ERRORS` (a bare global ring buffer, shared and populated elsewhere in
// docs/index.html, not specific to this component) are stubbed per test. A minimal
// `globalThis.window = { location: { reload: () => {} } }` covers the Reload button's one DOM
// touch -- no jsdom needed since nothing else here reads a real DOM API.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { ErrorBoundary } from "../../../src/components/errorBoundary.js";

afterEach(() => {
  delete globalThis.reportErrorAuto;
  delete globalThis.submitFeedback;
  delete globalThis.RECENT_CONSOLE_ERRORS;
  delete globalThis.window;
});

function Boom() {
  throw new Error("boom");
}

// React logs the caught error to the console even with an error boundary present -- silence that
// expected noise for these tests specifically, restoring it afterward.
function withSilencedConsoleError(fn) {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

test("ErrorBoundary: renders its children normally when nothing throws", () => {
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(ErrorBoundary, null, React.createElement("div", null, "hello")));
  });
  assert.match(JSON.stringify(inst.toJSON()), /hello/);
});

test("ErrorBoundary: catching a render error shows the fallback and auto-reports it", async () => {
  let reported = null;
  globalThis.reportErrorAuto = (message, extra) => {
    reported = { message, extra };
    return Promise.resolve({ ok: true });
  };
  let inst;
  await withSilencedConsoleError(async () => {
    await act(async () => {
      inst = renderer.create(React.createElement(ErrorBoundary, null, React.createElement(Boom)));
      await new Promise(r => setTimeout(r, 0));
    });
  });
  assert.match(JSON.stringify(inst.toJSON()), /Something went wrong/);
  assert.match(JSON.stringify(inst.toJSON()), /has been reported automatically/);
  assert.ok(reported.message.includes("boom"));
  assert.equal(reported.extra.source, "ErrorBoundary");
});

test("ErrorBoundary: shows a failure note when auto-reporting itself fails", async () => {
  globalThis.reportErrorAuto = () => Promise.resolve({ ok: false });
  let inst;
  await withSilencedConsoleError(async () => {
    await act(async () => {
      inst = renderer.create(React.createElement(ErrorBoundary, null, React.createElement(Boom)));
      await new Promise(r => setTimeout(r, 0));
    });
  });
  assert.match(JSON.stringify(inst.toJSON()), /Couldn't report this automatically/);
});

test("ErrorBoundary: sending a follow-up note calls submitFeedback and shows a thank-you", async () => {
  globalThis.reportErrorAuto = () => Promise.resolve({ ok: true });
  globalThis.RECENT_CONSOLE_ERRORS = [{ message: "earlier error" }];
  let sentPayload = null;
  globalThis.submitFeedback = payload => {
    sentPayload = payload;
    return Promise.resolve({ ok: true });
  };
  let inst;
  await withSilencedConsoleError(async () => {
    await act(async () => {
      inst = renderer.create(React.createElement(ErrorBoundary, null, React.createElement(Boom)));
      await new Promise(r => setTimeout(r, 0));
    });
  });

  const textarea = inst.root.findByType("textarea");
  act(() => { textarea.props.onChange({ target: { value: "I was scoring a wide" } }); });
  const sendBtn = inst.root.findAllByType("button").find(b => b.props.children === "Send this detail too" || b.props.children === "Sending…");
  await act(async () => {
    sendBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });

  assert.equal(sentPayload.kind, "error");
  assert.match(sentPayload.message, /I was scoring a wide/);
  assert.deepEqual(sentPayload.extra.consoleLog, [{ message: "earlier error" }]);
  assert.match(JSON.stringify(inst.toJSON()), /that extra detail has been sent too/);
});

test("ErrorBoundary: the Reload button reloads the page", async () => {
  globalThis.reportErrorAuto = () => Promise.resolve({ ok: true });
  let reloaded = false;
  globalThis.window = { location: { reload: () => { reloaded = true; } } };
  let inst;
  await withSilencedConsoleError(async () => {
    await act(async () => {
      inst = renderer.create(React.createElement(ErrorBoundary, null, React.createElement(Boom)));
      await new Promise(r => setTimeout(r, 0));
    });
  });
  const reloadBtn = inst.root.findAllByType("button").find(b => b.props.children === "Reload");
  act(() => { reloadBtn.props.onClick(); });
  assert.equal(reloaded, true);
});
