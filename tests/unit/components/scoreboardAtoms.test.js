// Live-scoring display atoms (src/components/scoreboardAtoms.js). OversStrip and
// FixturePollSummary are pure presentational, no DOM APIs. SyncStatusBanner reads
// navigator.onLine and window's online/offline events directly (like Modal), so its tests run
// against a real jsdom-backed window/document/navigator installed on globalThis for the duration
// of each test -- see beforeEach/afterEach, and modal.test.js for why this is scoped per-file.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { OversStrip, FixturePollSummary, SyncStatusBanner } from "../../../src/components/scoreboardAtoms.js";

test("OversStrip: renders 'Not started' for an empty over, ball badges for a started one", () => {
  const overs = [[{ runs: 4 }, { runs: 1, kind: "wicket" }], []];
  const inst = renderer.create(React.createElement(OversStrip, { overs, ballsPerOver: 6 }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Not started/);
  assert.match(text, /THIS OVER/);
});

test("OversStrip: shows a per-over runs/wickets summary next to a completed over's label", () => {
  const overs = [[{ runs: 4 }, { runs: 1, kind: "wicket" }], [{ runs: 2 }]];
  const inst = renderer.create(React.createElement(OversStrip, { overs, ballsPerOver: 6 }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /5 runs, 1 wkt/);
});

test("FixturePollSummary: renders nothing for an empty/missing list", () => {
  assert.equal(renderer.create(React.createElement(FixturePollSummary, { items: [] })).toJSON(), null);
  assert.equal(renderer.create(React.createElement(FixturePollSummary, { items: null })).toJSON(), null);
});

test("FixturePollSummary: shows yes/no/maybe counts, and the team name once there's more than one item", () => {
  const items = [
    { code: "a", team: { name: "Riverside CC" }, yes: 8, no: 1, maybe: 2 },
    { code: "b", team: { name: "Oakwood CC" }, yes: 5, no: 0, maybe: 0 }
  ];
  const text = JSON.stringify(renderer.create(React.createElement(FixturePollSummary, { items })).toJSON());
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
  assert.match(text, /8/);
  assert.doesNotMatch(text, /"0 no"|0,"no"/);

  const single = [{ code: "a", team: { name: "Riverside CC" }, yes: 8, no: 0, maybe: 0 }];
  const singleText = JSON.stringify(renderer.create(React.createElement(FixturePollSummary, { items: single })).toJSON());
  assert.doesNotMatch(singleText, /Riverside CC/);
});

let dom;

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
  delete globalThis.flushPendingWrites;
});

test("SyncStatusBanner: renders nothing with a zero count", () => {
  const inst = renderer.create(React.createElement(SyncStatusBanner, { count: 0, onSynced: () => {} }));
  assert.equal(inst.toJSON(), null);
});

test("SyncStatusBanner: reads navigator.onLine for its initial online/offline copy", () => {
  Object.defineProperty(dom.window.navigator, "onLine", { value: false, configurable: true });
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(SyncStatusBanner, { count: 3, onSynced: () => {} }));
  });
  try {
    assert.match(JSON.stringify(inst.toJSON()), /You're offline/);
  } finally {
    act(() => { inst.unmount(); });
  }
});

test("SyncStatusBanner: tapping retries via the (stubbed) flushPendingWrites and calls onSynced", async () => {
  Object.defineProperty(dom.window.navigator, "onLine", { value: true, configurable: true });
  let flushCalls = 0;
  globalThis.flushPendingWrites = () => { flushCalls++; return Promise.resolve({ lastError: null }); };
  let synced = false;
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(SyncStatusBanner, { count: 2, onSynced: () => { synced = true; } }));
  });
  try {
    const button = inst.root.findByType("button");
    assert.match(JSON.stringify(inst.toJSON()), /2 matches not synced/);
    await act(async () => {
      button.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.equal(flushCalls, 1);
    assert.equal(synced, true);
  } finally {
    act(() => { inst.unmount(); });
  }
});

test("SyncStatusBanner: an onRetry override is used instead of flushPendingWrites", async () => {
  // MatchScreen passes its own onRetry (see matchScreen.js's retrySync) because flushPendingWrites
  // deliberately skips whatever match is currently open there -- without this override, tapping
  // retry on the exact match being scored would silently no-op forever.
  Object.defineProperty(dom.window.navigator, "onLine", { value: true, configurable: true });
  let flushCalls = 0;
  globalThis.flushPendingWrites = () => { flushCalls++; return Promise.resolve({ lastError: null }); };
  let retryCalls = 0;
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(SyncStatusBanner, {
      count: 1, onSynced: () => {},
      onRetry: () => { retryCalls++; return Promise.resolve({ lastError: null }); }
    }));
  });
  try {
    const button = inst.root.findByType("button");
    await act(async () => {
      button.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.equal(retryCalls, 1);
    assert.equal(flushCalls, 0);
  } finally {
    act(() => { inst.unmount(); });
  }
});

test("SyncStatusBanner: surfaces the error flushPendingWrites reports, and clears it once count hits 0", async () => {
  Object.defineProperty(dom.window.navigator, "onLine", { value: true, configurable: true });
  globalThis.flushPendingWrites = () => Promise.resolve({ lastError: "Permission denied" });
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(SyncStatusBanner, { count: 1, onSynced: () => {} }));
  });
  try {
    const button = inst.root.findByType("button");
    await act(async () => {
      button.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.match(JSON.stringify(inst.toJSON()), /Permission denied/);

    act(() => { inst.update(React.createElement(SyncStatusBanner, { count: 0, onSynced: () => {} })); });
    assert.equal(inst.toJSON(), null);
  } finally {
    act(() => { inst.unmount(); });
  }
});
