// The live scoring screen (src/components/matchScreen.js). `saveMatch` (a Firestore write) is the
// one bare global -- every test that scores a ball needs it stubbed, since every commit() fires a
// fire-and-forget queueSave() -> saveMatch() promise chain even when the test never awaits it.
// `match` is a fully controlled prop here (not internal state), so the render helper below wires
// setMatch to actually re-render the tree with the latest match, the same way the real App does.
// Small 3-player rosters with maxWickets=2 (passed directly to newInning) keep all-out/last-wicket
// scenarios reachable without scoring through a full XI. `Modal` (bare global) backs nearly every
// dialog this screen opens (wicket/extra/custom-runs/retire/next-bowler/match-menu), so it's
// stubbed once for the whole file rather than per test.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach, beforeEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { MatchScreen } from "../../../src/components/matchScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { PlayerPicker } from "../../../src/components/pickerAtoms.js";
import { SyncConflictModal } from "../../../src/components/matchInsightCards.js";
import { ResultScreen } from "../../../src/components/resultScreen.js";
import { SuperOverOpenersSetup, SecondInningsSetup } from "../../../src/components/inningsSetupScreens.js";
import { newInning } from "../../../src/core/scoringEngine.js";

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});
// InningsTimer runs a real 30s setInterval that isn't cleared until unmount -- react-test-renderer
// doesn't unmount automatically, and a leaked interval keeps the whole test process alive well
// past every test finishing (the same InningsTimer gotcha documented in scoringUiAtoms.test.js).
// mountedInstances tracks every renderMatch() result so afterEach can unmount them all.
let mountedInstances = [];

afterEach(() => {
  mountedInstances.forEach(inst => inst.unmount());
  mountedInstances = [];
  delete globalThis.saveMatch;
  delete globalThis.Modal;
});

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function buildInning(battingTeam, bowlingTeam, overrides = {}) {
  return {
    ...newInning(battingTeam, bowlingTeam, {}, 2),
    strikerName: "A", nonStrikerName: "B", bowlerName: "X",
    ...overrides
  };
}

function baseMatch(overrides = {}) {
  const i1 = buildInning("Riverside CC", "Oakwood CC");
  return {
    id: "m1", teamA: "Riverside CC", teamB: "Oakwood CC",
    teamARoster: ["A", "B", "C"], teamBRoster: ["X", "Y", "Z"],
    teamACaptain: "A", teamAKeeper: "B", teamBCaptain: "X", teamBKeeper: "Y",
    oversLimit: 20, status: "in-progress", currentInningIndex: 0, innings: [i1],
    rules: {}, writeSeq: 0,
    ...overrides
  };
}

function renderMatch(matchState, extraProps = {}) {
  let current = matchState;
  let inst;
  const setMatch = updater => {
    current = typeof updater === "function" ? updater(current) : updater;
    inst.update(React.createElement(MatchScreen, {
      match: current, setMatch, onExit: () => {}, pendingCount: 0, onPendingSynced: () => {},
      tournament: null, ...extraProps
    }));
  };
  act(() => {
    inst = renderer.create(React.createElement(MatchScreen, {
      match: current, setMatch, onExit: () => {}, pendingCount: 0, onPendingSynced: () => {},
      tournament: null, ...extraProps
    }));
  });
  mountedInstances.push(inst);
  return {
    get inst() { return inst; },
    get match() { return current; },
    get inning() { return current.innings[current.currentInningIndex]; }
  };
}

function btn(ctx, text) {
  return ctx.inst.root.findAllByType(Btn).find(b => b.props.children === text);
}

// The main scoring row's 0/1/2/3/4/6 run buttons stay mounted behind every modal (Modal is just
// an overlay, not a replacement), so a same-numbered Btn inside an open modal (the Extra amount
// picker, the overthrow bonus buttons) isn't unique by text alone -- scope the search to inside
// the stubbed Modal itself.
function modalBtn(ctx, text) {
  const modal = ctx.inst.root.findAllByProps({ "data-stub-modal": true }).pop();
  return modal.findAllByType(Btn).find(b => b.props.children === text);
}

test("MatchScreen: shows the live score header", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const text = JSON.stringify(ctx.inst.toJSON());
  // OdometerScore renders each character of "0-0" as its own nested animated span, so the score
  // itself isn't one contiguous string in the tree -- check the overs/CRR line instead, which is
  // plain joined text (still split across separate JSX children, but not per-character).
  assert.match(text, /"\(","0\.0","\/","20","\)"/);
  assert.match(text, /"CRR ","0\.00"/);
  assert.match(text, /RIVERSIDE CC/);
});

test("MatchScreen: tapping a run button commits the ball and updates the score", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const fourBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 4);
  await act(async () => {
    fourBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 4);
  assert.match(JSON.stringify(ctx.inst.toJSON()), /4-0/);
});

test("MatchScreen: a non-last wicket opens the Next batsman prompt, and confirming it commits the wicket", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const wicketBtn = btn(ctx, "Wicket");
  act(() => { wicketBtn.props.onClick(); });
  const bowledBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Bowled");
  act(() => { bowledBtn.props.onClick(); });
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Next batsman/);

  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  const confirmBtn = btn(ctx, "Confirm");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.wickets, 1);
  assert.equal(ctx.inning.strikerName, "C");
  assert.equal(ctx.inning.batsmen.A.out, true);
});

test("MatchScreen: a Caught wicket requires a fielder before Confirm is enabled", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  act(() => { btn(ctx, "Wicket").props.onClick(); });
  const caughtBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Caught");
  act(() => { caughtBtn.props.onClick(); });

  const confirmBtn = () => ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm");
  // Keeper (B) is pre-filled as the default fielder for a catch.
  assert.equal(confirmBtn().props.disabled, false);

  const fielderPicker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { fielderPicker.props.onChange(""); });
  assert.equal(confirmBtn().props.disabled, true);

  act(() => { fielderPicker.props.onChange("Y"); });
  act(() => { confirmBtn().props.onClick(); });
  // Not the last wicket (max 2), so the catch itself is only pending -- it doesn't actually
  // commit until the next batsman is confirmed, same flow as the plain-wicket test above.
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Next batsman/);
  const nextBatsmanPicker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { nextBatsmanPicker.props.onChange("C"); });
  await act(async () => {
    btn(ctx, "Confirm").props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.batsmen.A.how, "c Y b X");
});

test("MatchScreen: a Wide extra credits runs to the team without consuming a legal ball", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  act(() => { btn(ctx, "Extra").props.onClick(); });
  act(() => { modalBtn(ctx, "Wide").props.onClick(); });
  // The 0/1/2/3/4 picker here is runs ON TOP OF the standard wide penalty (byes run off a wide),
  // not the total -- "0" is a plain wide with nothing extra.
  const zeroBtn = modalBtn(ctx, 0);
  await act(async () => {
    zeroBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 1);
  assert.equal(ctx.inning.extras.wide, 1);
  assert.equal(ctx.inning.legalBalls, 0);
});

test("MatchScreen: the 'Other' runs modal combines completed runs, an overthrow bonus, and a short-run deduction", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  act(() => { btn(ctx, "Other").props.onClick(); });
  const completedInput = ctx.inst.root.findAllByType("input").find(i => i.props.placeholder === "Runs the batsmen ran");
  act(() => { completedInput.props.onChange({ target: { value: "2" } }); });
  const overthrowInput = ctx.inst.root.findAllByType("input").find(i => i.props.placeholder === "Extra runs from the misfield");
  act(() => { overthrowInput.props.onChange({ target: { value: "1" } }); });
  const shortRunToggle = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Short run"));
  act(() => { shortRunToggle.props.onClick(); });
  // "Total: " and the computed number are separate JSX children (the number sits inside its own
  // nested <strong>), so this is checked after confirming instead of matching the raw JSON here.

  const confirmBtn = btn(ctx, "Confirm");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 2);
});

test("MatchScreen: Undo reverts the last committed ball", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const twoBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 2);
  await act(async () => {
    twoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 2);

  const undoBtn = ctx.inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Undo last ball"));
  await act(async () => {
    undoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 0);
});

test("MatchScreen: Swap Strike swaps the striker and non-striker", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const swapBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Swap Strike"));
  act(() => { swapBtn.props.onClick(); });
  assert.equal(ctx.inning.strikerName, "B");
  assert.equal(ctx.inning.nonStrikerName, "A");
});

test("MatchScreen: retiring the striker hurt clears their slot without counting as a wicket", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const retireBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Retire");
  act(() => { retireBtn.props.onClick(); });
  const retireHurtBtn = btn(ctx, "Retired hurt (not out)");
  act(() => { retireHurtBtn.props.onClick(); });
  assert.equal(ctx.inning.strikerName, "");
  assert.equal(ctx.inning.wickets, 0);
  assert.equal(ctx.inning.batsmen.A.retiredHurt, true);
});

test("MatchScreen: the next-bowler prompt appears at an over boundary, and confirming it sets the bowler", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const overBoundaryInning = buildInning("Riverside CC", "Oakwood CC", {
    legalBalls: 6, bowlerName: "", lastBowlerName: "X",
    overs: [[{ kind: "run", runs: 1 }], []]
  });
  const ctx = renderMatch(baseMatch({ innings: [overBoundaryInning] }));
  assert.match(JSON.stringify(ctx.inst.toJSON()), /next bowler/);

  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("Y"); });
  const confirmBtn = btn(ctx, "Confirm");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.bowlerName, "Y");
});

test("MatchScreen: ending the innings early via the match menu marks it complete and starts the next one", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const menuBtn = ctx.inst.root.findAllByProps({ "aria-label": "Match menu" })[0];
  act(() => { menuBtn.props.onClick(); });
  const endInningsBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "End innings");
  act(() => { endInningsBtn.props.onClick(); });
  const confirmBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "End innings");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.match.innings[0].complete, true);
  assert.equal(ctx.match.awaitingSecondInningsSetup, true);
});

test("MatchScreen: abandoning the match via the match menu ends it with no result", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const menuBtn = ctx.inst.root.findAllByProps({ "aria-label": "Match menu" })[0];
  act(() => { menuBtn.props.onClick(); });
  const abandonBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Abandon match");
  act(() => { abandonBtn.props.onClick(); });
  const confirmBtn = ctx.inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Abandon"));
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.match.status, "complete");
  assert.equal(ctx.match.noResult, true);
});

test("MatchScreen: manually revising the target during a chase updates the match", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", { complete: true, runs: 120 });
  const i2 = buildInning("Oakwood CC", "Riverside CC");
  const ctx = renderMatch(baseMatch({ currentInningIndex: 1, innings: [i1, i2], oversLimit: 20 }));

  const menuBtn = ctx.inst.root.findAllByProps({ "aria-label": "Match menu" })[0];
  act(() => { menuBtn.props.onClick(); });
  const reviseBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Revise target");
  act(() => { reviseBtn.props.onClick(); });

  const targetInput = ctx.inst.root.findAllByType("input").find(i => i.props.placeholder === "e.g. 120");
  act(() => { targetInput.props.onChange({ target: { value: "90" } }); });
  const oversInput = ctx.inst.root.findAllByType("input").find(i => i.props.placeholder && i.props.placeholder.startsWith("e.g. 15"));
  act(() => { oversInput.props.onChange({ target: { value: "15" } }); });

  const setBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "Set new target");
  await act(async () => {
    setBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.match.revisedTarget, 90);
  assert.equal(ctx.match.revisedOvers, 15);
});

test("MatchScreen: a sync conflict from another device opens the resolution modal", async () => {
  let calls = 0;
  globalThis.saveMatch = () => {
    calls++;
    return calls === 1
      ? Promise.resolve({ conflict: true, remoteMatch: baseMatch({ writeSeq: 9 }) })
      : Promise.resolve({ ok: true, writeSeq: 10 });
  };
  const ctx = renderMatch(baseMatch());
  const oneBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 1);
  await act(async () => {
    oneBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const conflictModal = ctx.inst.root.findByType(SyncConflictModal);
  assert.ok(conflictModal);
  await act(async () => {
    conflictModal.props.onKeepMine();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inst.root.findAllByType(SyncConflictModal).length, 0);
});

test("MatchScreen: renders SuperOverOpenersSetup/SecondInningsSetup/ResultScreen for their respective match states", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const superOverCtx = renderMatch(baseMatch({ awaitingFirstInningsSetup: true, isSuperOver: true }));
  assert.ok(superOverCtx.inst.root.findByType(SuperOverOpenersSetup));

  const firstDone = buildInning("Riverside CC", "Oakwood CC", { complete: true, runs: 150 });
  const secondPlaceholder = buildInning("Oakwood CC", "Riverside CC", { strikerName: "", nonStrikerName: "", bowlerName: "" });
  const secondInningsCtx = renderMatch(baseMatch({
    currentInningIndex: 1, awaitingSecondInningsSetup: true, innings: [firstDone, secondPlaceholder]
  }));
  assert.ok(secondInningsCtx.inst.root.findByType(SecondInningsSetup));

  const i1 = buildInning("Riverside CC", "Oakwood CC", { complete: true, runs: 150 });
  const i2 = buildInning("Oakwood CC", "Riverside CC", { complete: true, runs: 120 });
  const doneCtx = renderMatch(baseMatch({ status: "complete", innings: [i1, i2] }));
  assert.ok(doneCtx.inst.root.findByType(ResultScreen));
});
