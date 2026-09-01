// Secondary account/info screens (src/components/infoScreens.js). Most are pure presentational
// with no DOM APIs. BetaTestersScreen calls Firestore-touching functions from a mount-time
// useEffect (loadBetaRequests/loadBetaTesters), so its tests stub those on globalThis before
// rendering, same pattern as saveMatch/flushPendingWrites elsewhere in this suite -- and since a
// mount-time effect is involved, those tests wrap render/interactions in act().

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { highlightMatch, HELP_SECTIONS, HelpScreen, AboutScreen, FeedbackScreen, SharedLinksScreen, BetaTestersScreen } from "../../../src/components/infoScreens.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

test("highlightMatch: returns the plain text unchanged with no query, wraps a case-insensitive match in <mark>", () => {
  assert.equal(highlightMatch("Powerplay badge", ""), "Powerplay badge");
  const parts = highlightMatch("Powerplay badge", "play");
  assert.ok(Array.isArray(parts));
  const marked = parts.find(p => p && p.type === "mark");
  assert.ok(marked);
  assert.equal(marked.props.children, "play");
});

test("HELP_SECTIONS: is a non-empty list of {title, entries} sections with real Q&A entries", () => {
  assert.ok(HELP_SECTIONS.length > 0);
  for (const section of HELP_SECTIONS) {
    assert.equal(typeof section.title, "string");
    assert.ok(section.entries.length > 0);
    assert.equal(typeof section.entries[0].q, "string");
    assert.equal(typeof section.entries[0].a, "string");
  }
});

test("HelpScreen: renders every section by default, filters to matching entries once searched", () => {
  const inst = renderer.create(React.createElement(HelpScreen, { onBack: () => {} }));
  const allText = JSON.stringify(inst.toJSON());
  assert.match(allText, new RegExp(HELP_SECTIONS[0].entries[0].q.slice(0, 15).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "zzzznomatch" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /No results for/);
});

test("HelpScreen: shows the 'Replay the welcome tour' link only when onReplayTour is passed", () => {
  const without = JSON.stringify(renderer.create(React.createElement(HelpScreen, { onBack: () => {} })).toJSON());
  assert.doesNotMatch(without, /Replay the welcome tour/);
  const withReplay = JSON.stringify(renderer.create(React.createElement(HelpScreen, { onBack: () => {}, onReplayTour: () => {} })).toJSON());
  assert.match(withReplay, /Replay the welcome tour/);
});

test("AboutScreen: renders without crashing and wires onBack to its back button", () => {
  let back = false;
  const inst = renderer.create(React.createElement(AboutScreen, { onBack: () => { back = true; } }));
  const backBtn = inst.root.findAllByType("button")[0];
  backBtn.props.onClick();
  assert.equal(back, true);
});

test("FeedbackScreen: sends via the (stubbed) submitFeedback and shows a thank-you", async () => {
  let sentWith = null;
  globalThis.submitFeedback = payload => { sentWith = payload; return Promise.resolve({ ok: true }); };
  try {
    const inst = renderer.create(React.createElement(FeedbackScreen, { onBack: () => {}, userEmail: "" }));
    const textarea = inst.root.findByType("textarea");
    act(() => { textarea.props.onChange({ target: { value: "Great app!" } }); });
    const sendBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Send");
    assert.ok(sendBtn);
    await act(async () => {
      sendBtn.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.equal(sentWith.message, "Great app!");
    assert.match(JSON.stringify(inst.toJSON()), /that's been sent/);
  } finally {
    delete globalThis.submitFeedback;
  }
});

test("SharedLinksScreen: lists share/view codes per match, confirms before revoking", async () => {
  const matches = [
    { id: "m1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "live", shareCode: "ABC123", viewCode: null },
    { id: "m2", teamA: "Home XI", teamB: "Away XI", status: "complete" }
  ];
  let revokedId = null;
  const inst = renderer.create(React.createElement(SharedLinksScreen, {
    matches,
    onRevokeShareCode: id => { revokedId = id; return Promise.resolve({ ok: true }); },
    onRevokeViewCode: () => Promise.resolve({ ok: true }),
    onBack: () => {}
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /ABC123/);
  assert.doesNotMatch(text, /Home XI/); // m2 has no active share/view code

  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  try {
    const revokeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Revoke");
    act(() => { revokeBtn.props.onClick(); });
    const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.variant === "danger" || b.props.children === "Revoke");
    assert.ok(confirmBtn);
    await act(async () => {
      confirmBtn.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.equal(revokedId, "m1");
  } finally {
    delete globalThis.Modal;
  }
});

test("BetaTestersScreen: loads requests/testers on mount via the (stubbed) loaders, approves a request", async () => {
  globalThis.loadBetaRequests = () => Promise.resolve([{ id: "r1", email: "a@example.com", requestedAt: Date.now() }]);
  globalThis.loadBetaTesters = () => Promise.resolve([]);
  globalThis.approveBetaRequest = () => Promise.resolve({ ok: true });
  try {
    let inst;
    await act(async () => {
      inst = renderer.create(React.createElement(BetaTestersScreen, { onBack: () => {} }));
      await new Promise(r => setTimeout(r, 0));
    });
    let text = JSON.stringify(inst.toJSON());
    assert.match(text, /a@example.com/);
    assert.match(text, /Pending requests \(1\)/);

    const approveBtn = inst.root.findAllByType("button").find(b => b.props.children === "Approve");
    assert.ok(approveBtn);
    await act(async () => {
      approveBtn.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    text = JSON.stringify(inst.toJSON());
    assert.match(text, /Pending requests \(0\)/);
    assert.match(text, /Current beta testers \(1\)/);
  } finally {
    delete globalThis.loadBetaRequests;
    delete globalThis.loadBetaTesters;
    delete globalThis.approveBetaRequest;
  }
});
