// One-off Modal-wrapped screens (src/components/miscModals.js). Both reference Modal as a bare,
// unimported global (same pattern as ConfirmModal), so tests stub globalThis.Modal with a plain
// pass-through rather than pulling in jsdom -- see playerModals.test.js for the same pattern.
// TournamentShareModal reads window.location.origin/pathname directly during render, so its own
// tests also stub a minimal globalThis.window -- just enough shape for that, no full jsdom.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer from "react-test-renderer";
import { TOUR_SLIDES, FirstLaunchTour, TournamentShareModal } from "../../../src/components/miscModals.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  // FirstLaunchTour's finish() calls markTourSeen() (src/core/appLogic.js), which calls lsSetItem
  // -- a bare global cross-reference to localStorageOutbox.js's own export, real in
  // docs/index.html's single scope but not in appLogic.js's own module scope under test.
  globalThis.lsSetItem = () => ({ ok: true });
  globalThis.LS_PREFIX = "cricket-scorer:";
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.lsSetItem;
  delete globalThis.LS_PREFIX;
});

test("TOUR_SLIDES: is a non-empty list of {icon, title, body} slides", () => {
  assert.ok(TOUR_SLIDES.length > 0);
  for (const slide of TOUR_SLIDES) {
    assert.equal(typeof slide.title, "string");
    assert.equal(typeof slide.body, "string");
    assert.equal(typeof slide.icon, "function");
  }
});

test("FirstLaunchTour: steps through slides with Next, finishes (marking the tour seen) on the last one", () => {
  let done = false;
  const inst = renderer.create(React.createElement(FirstLaunchTour, { onDone: () => { done = true; } }));
  assert.match(JSON.stringify(inst.toJSON()), new RegExp(TOUR_SLIDES[0].title));

  for (let i = 0; i < TOUR_SLIDES.length - 1; i++) {
    const nextBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Next");
    assert.ok(nextBtn, `expected a Next button on slide ${i}`);
    nextBtn.props.onClick();
  }
  assert.match(JSON.stringify(inst.toJSON()), new RegExp(TOUR_SLIDES[TOUR_SLIDES.length - 1].title));

  const finishBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Get started");
  assert.ok(finishBtn);
  finishBtn.props.onClick();
  assert.equal(done, true);
});

test("FirstLaunchTour: Skip finishes immediately from any slide before the last", () => {
  let done = false;
  const inst = renderer.create(React.createElement(FirstLaunchTour, { onDone: () => { done = true; } }));
  const skipBtn = inst.root.findAllByType("button").find(b => b.props.children === "Skip");
  assert.ok(skipBtn);
  skipBtn.props.onClick();
  assert.equal(done, true);
});

test("TournamentShareModal: offers to create a share link when the tournament has none yet", () => {
  globalThis.window = { location: { origin: "https://example.test", pathname: "/" } };
  try {
    const inst = renderer.create(React.createElement(TournamentShareModal, {
      tournament: { name: "Summer Cup" }, standings: [],
      onClose: () => {}, onUpdateTournament: () => {}
    }));
    const text = JSON.stringify(inst.toJSON());
    assert.match(text, /Create share link/);
    assert.doesNotMatch(text, /Stop sharing/);
  } finally {
    delete globalThis.window;
  }
});

test("TournamentShareModal: shows the link and Refresh/Stop sharing once a shareCode exists, calls onUpdateTournament to clear it", async () => {
  globalThis.window = { location: { origin: "https://example.test", pathname: "/" } };
  globalThis.stopSharingTournament = () => Promise.resolve({ ok: true });
  try {
    let updated = null;
    const inst = renderer.create(React.createElement(TournamentShareModal, {
      tournament: { name: "Summer Cup", shareCode: "ABC123" }, standings: [],
      onClose: () => {}, onUpdateTournament: t => { updated = t; }
    }));
    const text = JSON.stringify(inst.toJSON());
    assert.match(text, /https:\/\/example\.test\/\?tournament=ABC123/);
    const stopBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Stop sharing");
    assert.ok(stopBtn);
    await stopBtn.props.onClick();
    assert.equal(updated.shareCode, null);
  } finally {
    delete globalThis.window;
    delete globalThis.stopSharingTournament;
  }
});
