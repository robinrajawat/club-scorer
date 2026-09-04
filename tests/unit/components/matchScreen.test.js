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
import { SyncStatusBanner } from "../../../src/components/scoreboardAtoms.js";
import { JSDOM } from "jsdom";
import { ResultScreen } from "../../../src/components/resultScreen.js";
import { SuperOverOpenersSetup, SecondInningsSetup } from "../../../src/components/inningsSetupScreens.js";
import { newInning } from "../../../src/core/scoringEngine.js";
import { COLORS } from "../../../src/components/theme.js";

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
  delete globalThis.flushPendingWrites;
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
    get inning() { return current.innings[current.currentInningIndex]; },
    setMatch
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

function bigHitBtn(ctx) {
  return ctx.inst.root.findAllByType(Btn).find(b => typeof b.props.children === "string" && b.props.children.startsWith("Big Hit"));
}

function maxHitBtn(ctx) {
  return ctx.inst.root.findAllByType(Btn).find(b => typeof b.props.children === "string" && b.props.children.startsWith("Maximum Hit"));
}

test("MatchScreen: tags a batsman or bowler who came on as an Impact Player sub with an 'IP' badge", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch({
    impactSubs: [{ inName: "B", outName: "C", team: "Riverside CC" }]
  }));
  const text = JSON.stringify(ctx.inst.toJSON());
  assert.equal((text.match(/"IP"/g) || []).length, 1); // only B (non-striker), not A or bowler X
});

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

test("MatchScreen: shows a one-line commentary for the last ball, and clears it on Undo", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const fourBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 4);
  await act(async () => {
    fourBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  // X is the bowler, A the striker -- see buildInning/baseMatch above. The outcome ("FOUR!") is a
  // separate, colored span from the plain-text lead -- see the color-coded-outcome redesign below.
  // Scoped to the commentary line's own container (fontSize 12.5) since BallCelebration's "FOUR!"
  // banner is a second, unrelated element with the exact same text showing at the same moment.
  let text = JSON.stringify(ctx.inst.toJSON());
  assert.match(text, /"X to A: "/);
  assert.match(text, /"FOUR!"/);
  const commentaryLine = ctx.inst.root.findAll(n => n.type === "div" && n.props.style && n.props.style.fontSize === 12.5 && n.props.style.color === COLORS.inkSoft)[0];
  assert.ok(commentaryLine, "the commentary line's container renders");
  const outcomeSpan = commentaryLine.findAllByType("span")[0];
  assert.equal(outcomeSpan.props.children, "FOUR!");
  assert.equal(outcomeSpan.props.style.color, COLORS.turf, "a four is colored the same green as its ball badge");

  const undoBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Undo"));
  await act(async () => {
    undoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  // Scoped the same way as above -- BallCelebration's own "FOUR!" banner is unrelated and keeps
  // showing on its own timer regardless of undo, so checking the whole tree would find that instead.
  assert.doesNotMatch(JSON.stringify(ctx.inst.toJSON()), /"X to A: "/);
  assert.equal(ctx.inst.root.findAll(n => n.type === "div" && n.props.style && n.props.style.fontSize === 12.5 && n.props.style.color === COLORS.inkSoft).length, 0);
});

// BUG FIX: MatchScreen never unmounts across the innings break -- it just renders
// SecondInningsSetup in place of the normal scoring UI while awaitingSecondInningsSetup is true,
// then reverts to this same component instance once the 2nd innings starts. ballCommentary has no
// self-clearing timer (unlike celebration/milestoneToast), so without a reset keyed on
// currentInningIndex, the LAST ball of the FIRST innings kept showing on the second innings'
// scoring screen until a ball was actually scored in it.
test("MatchScreen: the previous innings' last-ball commentary doesn't carry over once the 2nd innings starts", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const fourBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 4);
  await act(async () => {
    fourBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(ctx.inst.toJSON()), /"X to A: "/);

  const secondInning = buildInning("Oakwood CC", "Riverside CC", { strikerName: "X", nonStrikerName: "Y", bowlerName: "A" });
  act(() => {
    ctx.setMatch(m => ({
      ...m, currentInningIndex: 1, awaitingSecondInningsSetup: false,
      innings: [{ ...m.innings[0], complete: true }, secondInning]
    }));
  });
  assert.doesNotMatch(JSON.stringify(ctx.inst.toJSON()), /"X to A: "/);
});

test("MatchScreen: the Big Hit button only appears when bigHitRuns is set, and scores its bonus runs as a six", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const plainCtx = renderMatch(baseMatch());
  assert.equal(bigHitBtn(plainCtx), undefined, "rule is off by default, no button shown");

  const i1 = buildInning("Riverside CC", "Oakwood CC", { bigHitRuns: 10 });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  const btn2 = bigHitBtn(ctx);
  assert.ok(btn2, "Big Hit button shown once the rule is configured");
  await act(async () => {
    btn2.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 10);
  assert.equal(ctx.inning.batsmen.A.sixes, 1, "a big hit is still a six for stats purposes");
});

// Big Hit and Maximum Hit are two fully independent bonus-hit tiers -- a club can turn on either,
// both, or neither. Both buttons must show side by side when both are configured, each scoring
// its own configured total.
test("MatchScreen: Big Hit and Maximum Hit are independent -- both buttons show and score correctly when both are set", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", { bigHitRuns: 10, maxHitRuns: 15 });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  assert.ok(bigHitBtn(ctx), "Big Hit button shown");
  const maxBtn = maxHitBtn(ctx);
  assert.ok(maxBtn, "Maximum Hit button shown independently");
  await act(async () => {
    maxBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 15);
  assert.equal(ctx.inning.batsmen.A.sixes, 1, "a maximum hit is still a six for stats purposes");
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

// BUG FIX (UX): tapping "Wide"/"No Ball" used to always navigate to a third screen just to tap
// "0" for the overwhelmingly common plain-extra case -- the one score-a-ball path in the app that
// took three taps instead of one or two, unlike every other quick-score button. "Wide" (and "No
// Ball", see extraQuickPick in matchScreen.js) now commits that 0-extra-runs case on this same
// tap; the rarer case where the ball was also run/hit for more still has its own "+runs" button.
test("MatchScreen: tapping 'Wide' commits a plain wide immediately, without a third tap for '0'", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  act(() => { btn(ctx, "Extra").props.onClick(); });
  await act(async () => {
    modalBtn(ctx, "Wide").props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 1);
  assert.equal(ctx.inning.extras.wide, 1);
  assert.equal(ctx.inning.legalBalls, 0);
});

test("MatchScreen: the Wide/No Ball '+runs' button still reaches the runs-on-top picker for the rarer case", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  act(() => { btn(ctx, "Extra").props.onClick(); });
  act(() => { modalBtn(ctx, "Wide +runs").props.onClick(); });
  // The 0/1/2/3/4 picker here is runs ON TOP OF the standard wide penalty (byes run off a wide),
  // not the total -- "2" means 1 (the wide) + 2 = 3 total.
  const twoBtn = modalBtn(ctx, 2);
  await act(async () => {
    twoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.runs, 3);
  assert.equal(ctx.inning.extras.wide, 3);
  assert.equal(ctx.inning.legalBalls, 0);
});

// BUG FIX: the illegal-again note used to say "this flips back in the last over" regardless of
// whether the current ball was actually inside that window -- forward-looking wording that made
// sense before the window started, but read as contradictory nonsense once inside it (attached to
// "doesn't count as a legal delivery", as if the flip it's describing were still pending when it
// had already happened).
test("MatchScreen: the Wide/No Ball legality note reads forward-looking before the last over, and present-tense once inside it", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const rules = { wideNoballCountsAsBall: true, lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: true }, oversLimit: 2, ballsPerOver: 6 };

  const beforeLastOver = renderMatch(baseMatch({ innings: [buildInning("Riverside CC", "Oakwood CC", { ...rules, legalBalls: 0 })] }));
  act(() => { btn(beforeLastOver, "Extra").props.onClick(); });
  act(() => { modalBtn(beforeLastOver, "Wide +runs").props.onClick(); });
  const beforeText = JSON.stringify(beforeLastOver.inst.toJSON());
  assert.match(beforeText, /counts as a legal delivery this over/);
  assert.match(beforeText, /this flips back to the standard rule in the last over/);

  const inLastOver = renderMatch(baseMatch({ innings: [buildInning("Riverside CC", "Oakwood CC", { ...rules, legalBalls: 6 })] }));
  act(() => { btn(inLastOver, "Extra").props.onClick(); });
  act(() => { modalBtn(inLastOver, "Wide +runs").props.onClick(); });
  const inText = JSON.stringify(inLastOver.inst.toJSON());
  assert.match(inText, /doesn't count as a legal delivery, so it's re-bowled/);
  assert.match(inText, /back to the standard rule for the last over/);
  assert.doesNotMatch(inText, /this flips back to the standard rule/, "must not read as forward-looking once already inside the window");
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

// BUG FIX: confirmNewBowler used to commit with no preceding pushHistory() -- unlike every other
// committed action in this file (see the "Timed Out isn't fixable with Undo" precedent above, the
// project's own standard: a committed action must go through pushHistory()+commit() so Undo
// genuinely reverts it). Without it, "Undo last ball" right after picking the wrong bowler for a
// new over had no checkpoint of its own to step back to -- before this fix, tapping Undo here was
// simply a no-op (there was no history entry to pop at all, since this inning was never scored
// through a real committed ball first), which happens every single over of every match.
test("MatchScreen: picking a new bowler pushes its own Undo checkpoint", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const overBoundaryInning = buildInning("Riverside CC", "Oakwood CC", {
    legalBalls: 6, runs: 3, bowlerName: "", lastBowlerName: "X",
    overs: [[{ kind: "run", runs: 3 }], []]
  });
  const ctx = renderMatch(baseMatch({ innings: [overBoundaryInning] }));

  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("Y"); });
  const confirmBtn = btn(ctx, "Confirm");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.bowlerName, "Y");

  const undoBtn = ctx.inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Undo last ball"));
  await act(async () => {
    undoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.bowlerName, "", "the bowler pick itself reverts, not some earlier ball");
  assert.equal(ctx.inning.runs, 3, "the already-scored over is untouched -- Undo didn't reach past the bowler pick");
});

// Same fix, the confirmNewBatsman side: its non-wicket branch (picking a replacement after e.g. a
// retirement, as opposed to the pendingWicket branch just above it, which already pushes its own
// history since that commit IS the dismissal itself) had the same missing-checkpoint bug.
test("MatchScreen: picking a replacement batsman after a retirement pushes its own Undo checkpoint", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const ctx = renderMatch(baseMatch());
  const retireBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Retire");
  act(() => { retireBtn.props.onClick(); });
  const retireHurtBtn = btn(ctx, "Retired hurt (not out)");
  act(() => { retireHurtBtn.props.onClick(); });
  assert.equal(ctx.inning.strikerName, "", "sanity check -- needs a replacement batsman");

  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  const confirmBtn = btn(ctx, "Confirm");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.strikerName, "C");

  const undoBtn = ctx.inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Undo last ball"));
  await act(async () => {
    undoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.strikerName, "", "the replacement pick itself reverts, not the retirement underneath it");
  assert.equal(ctx.inning.batsmen.A.retiredHurt, true, "the retirement that opened this slot is still intact");
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

// BUG FIX: this used to sum every ball's raw runs including byes/leg-byes, overstating the
// bowler's own figures for that over compared to what's actually recorded against them (byes/
// leg-byes are never charged to a bowler -- see applyBall's identical exclusion for maiden
// detection). A misfield that ran byes made the recap contradict the bowler's real stats.
test("MatchScreen: the next-bowler prompt's over recap excludes byes/leg-byes from the bowler's runs", () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const overBoundaryInning = buildInning("Riverside CC", "Oakwood CC", {
    legalBalls: 6, bowlerName: "", lastBowlerName: "X",
    overs: [[{ kind: "run", runs: 1 }, { kind: "bye", runs: 4 }, { kind: "legbye", runs: 2 }], []]
  });
  const ctx = renderMatch(baseMatch({ innings: [overBoundaryInning] }));
  const text = JSON.stringify(ctx.inst.toJSON());
  assert.match(text, /"X",": ","1"," run"/, "only the 1 genuine run off the bat counts toward X's own figures, not the 6 in byes/leg-byes");
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

// BUG FIX: retirementRuns (the 25-run mandatory-retirement house rule) was missing from the list
// of house rules carried over into the 2nd innings' newInning() call -- every other rule there
// (maxOversPerBowler, powerplayOvers, timeCapMinutes, wideNoballCountsAsBall, lastOverRules) was
// explicitly forwarded, but retirementRuns silently fell back to DEFAULT_RULES' null, so the cap
// simply never kicked in for anyone batting in the 2nd innings.
test("MatchScreen: ending the innings early carries the retirement-runs house rule into the 2nd innings", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", { retirementRuns: 25 });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  const menuBtn = ctx.inst.root.findAllByProps({ "aria-label": "Match menu" })[0];
  act(() => { menuBtn.props.onClick(); });
  const endInningsBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "End innings");
  act(() => { endInningsBtn.props.onClick(); });
  const confirmBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "End innings");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.match.innings[1].retirementRuns, 25);
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

test("MatchScreen: toggling Visibility in the match menu flips match.private and saves it", async () => {
  let saved = null;
  globalThis.saveMatch = m => { saved = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  const ctx = renderMatch(baseMatch({ private: false }));
  const menuBtn = ctx.inst.root.findAllByProps({ "aria-label": "Match menu" })[0];
  act(() => { menuBtn.props.onClick(); });
  const visibilityToggle = ctx.inst.root.findAllByProps({ "aria-label": "Make private" })[0];
  assert.ok(visibilityToggle, "starts public, so the switch offers to make it private");
  await act(async () => {
    visibilityToggle.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.match.private, true);
  assert.equal(saved.private, true);
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
  // BUG FIX: isInLastOvers reads the 2nd innings' OWN baked-in oversLimit, not match.revisedOvers
  // -- without patching it here too, a last-over house rule (e.g. wideNoballIllegalAgain) kept
  // computing "the last over" against the original, pre-revision limit for the rest of the chase,
  // and so never actually triggered once the revised, shorter innings ended before reaching it.
  assert.equal(ctx.match.innings[1].oversLimit, 15);
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

test("MatchScreen: SyncStatusBanner's tap-to-retry actually saves THIS match, instead of silently no-op'ing via flushPendingWrites (real bug -- flushPendingWrites deliberately skips whatever match is open here)", async () => {
  // SyncStatusBanner reads navigator.onLine and window's online/offline events (see
  // scoreboardAtoms.test.js) -- this file otherwise has no DOM, so it needs a scoped-to-this-test
  // jsdom install/teardown rather than the file-wide beforeEach/afterEach every other test here uses.
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  let saveCalls = 0;
  globalThis.saveMatch = () => { saveCalls++; return Promise.resolve({ ok: true, writeSeq: 2 }); };
  let flushCalls = 0;
  globalThis.flushPendingWrites = () => { flushCalls++; return Promise.resolve({ remaining: 0, lastError: null }); };
  let inst;
  act(() => {
    inst = renderer.create(React.createElement(MatchScreen, {
      match: baseMatch(), setMatch: () => {}, onExit: () => {}, pendingCount: 1, onPendingSynced: () => {}, tournament: null
    }));
  });
  try {
    const banner = inst.root.findByType(SyncStatusBanner);
    const button = banner.findByType("button");
    await act(async () => {
      button.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.equal(saveCalls, 1);
    assert.equal(flushCalls, 1);
  } finally {
    act(() => { inst.unmount(); });
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.navigator;
  }
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

// The retirement-cap prompt renders as a plain (bare-global-stubbed) Modal, not ConfirmModal --
// it needs a conditional third state (striker over the cap / non-striker over the cap, needing a
// swap first) that ConfirmModal's fixed confirm/cancel API can't express. Scoped the same way
// modalBtn does, since more than one stubbed modal can exist in the tree across a test.
function capRetireModal(ctx) {
  return ctx.inst.root.findAllByProps({ "data-stub-modal": true }).pop();
}

test("MatchScreen: reaching the retirement run cap (while on strike) opens a mandatory retire prompt, confirming retires them not out", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", {
    retirementRuns: 25,
    batsmen: { A: { runs: 23, balls: 10, out: false, how: "", fours: 0, sixes: 0 } }
  });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  // An even number of runs, deliberately -- an odd run rotates strike, which is exactly the
  // separate scenario the next test below covers.
  const twoBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 2);
  await act(async () => {
    twoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const modalText = JSON.stringify(ctx.inst.toJSON());
  assert.match(modalText, /A/);
  assert.match(modalText, /must retire/);
  assert.match(modalText, /25 runs/);
  const confirmBtn = capRetireModal(ctx).findAllByType(Btn).find(b => b.props.children === "Confirm retirement (not out)");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.batsmen.A.out, false);
  assert.equal(ctx.inning.batsmen.A.retiredHurt, true);
  assert.equal(ctx.inning.batsmen.A.retiredAtCap, 25);
  assert.equal(ctx.inning.strikerName, "");
});

test("MatchScreen: when the NON-striker is over the retirement cap, the prompt offers Swap Strike instead of a direct confirm", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  // B is at the non-striker's end already over the cap -- purely derived from initial state, no
  // ball needs to be scored to trigger this.
  const i1 = buildInning("Riverside CC", "Oakwood CC", {
    retirementRuns: 25,
    batsmen: {
      A: { runs: 0, balls: 0, out: false, how: "", fours: 0, sixes: 0 },
      B: { runs: 26, balls: 20, out: false, how: "", fours: 0, sixes: 0 }
    }
  });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  const modalText = JSON.stringify(ctx.inst.toJSON());
  // capRetireName and " must retire" render as separate JSX children, not one concatenated
  // string -- same split-text gotcha as "Step 1 of 4" elsewhere in this suite.
  assert.match(modalText, /"B"," must retire"/);
  assert.doesNotMatch(modalText, /Confirm retirement/);
  const swapBtn = capRetireModal(ctx).findAllByType("button").find(b => hasText(b.props.children, "Swap Strike"));
  act(() => { swapBtn.props.onClick(); });
  assert.equal(ctx.inning.strikerName, "B");

  // B is now actually on strike -- the same prompt (still open, B still over the cap) should have
  // switched to the direct confirm button.
  const confirmBtn = capRetireModal(ctx).findAllByType(Btn).find(b => b.props.children === "Confirm retirement (not out)");
  await act(async () => {
    confirmBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.batsmen.B.out, false);
  assert.equal(ctx.inning.batsmen.B.retiredHurt, true);
});

test("MatchScreen: dismissing the retirement cap prompt with 'Not now' lets scoring continue, and it reopens on the next ball if still over the cap", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", {
    retirementRuns: 25,
    batsmen: { A: { runs: 25, balls: 10, out: false, how: "", fours: 0, sixes: 0 } }
  });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  const notNowBtn = capRetireModal(ctx).findAllByType("button").find(b => b.props.children === "Not now");
  act(() => { notNowBtn.props.onClick(); });
  assert.equal(ctx.inst.root.findAllByProps({ "data-stub-modal": true }).length, 0);

  // Still over the cap, not yet retired -- the next committed ball (a leg bye here, so A's own
  // total doesn't even need to change) re-nags, since commit() resets the dismissal. Checking
  // BOTH ends (see needsCapRetirement/capRetireName) is what makes this robust even if the leg
  // bye's own run count happens to rotate strike -- A stays over the cap whichever end they're at.
  act(() => { btn(ctx, "Extra").props.onClick(); });
  act(() => { modalBtn(ctx, "Leg Bye").props.onClick(); });
  await act(async () => {
    modalBtn(ctx, 1).props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(ctx.inst.root.findAllByProps({ "data-stub-modal": true }).length > 0);
});

test("MatchScreen: a batsman returning from cap retirement isn't immediately re-prompted to retire again (real infinite-loop bug)", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", {
    retirementRuns: 25,
    batsmen: { A: { runs: 23, balls: 10, out: false, how: "", fours: 0, sixes: 0 } }
  });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));

  // Push A to the cap and confirm the mandatory retirement.
  const twoBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === 2);
  await act(async () => {
    twoBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const confirmRetireBtn = capRetireModal(ctx).findAllByType(Btn).find(b => b.props.children === "Confirm retirement (not out)");
  await act(async () => {
    confirmRetireBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.batsmen.A.capRetiredThreshold, 25);

  // A just vacated this slot, so the Next batsman prompt can't bring them straight back in yet --
  // bring in C instead (see the excludeList/justRetiredName comment in matchScreen.js).
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Next batsman/);
  let picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  await act(async () => {
    btn(ctx, "Confirm").props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.strikerName, "C");

  // C gets out -- a genuine wicket falls, so A is eligible to resume on this next prompt.
  act(() => { btn(ctx, "Wicket").props.onClick(); });
  act(() => {
    ctx.inst.root.findAllByType("button").find(b => b.props.children === "Bowled").props.onClick();
  });
  picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("A"); });
  await act(async () => {
    btn(ctx, "Confirm").props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.strikerName, "A");

  // The real bug: A's runs (25) still sit at the cap from their first stint. Without
  // capRetiredThreshold guarding needsCapRetirement, this would immediately reopen the
  // mandatory retire prompt with no way to actually resume batting.
  assert.equal(ctx.inst.root.findAllByProps({ "data-stub-modal": true }).length, 0);
  assert.doesNotMatch(JSON.stringify(ctx.inst.toJSON()), /must retire/);
});

test("MatchScreen: Timed Out on the Next batsman prompt records a wicket for the named player without them taking strike", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", { strikerName: "", nonStrikerName: "B" });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Next batsman/);

  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  const timedOutBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Timed Out"));
  act(() => { timedOutBtn.props.onClick(); });
  const confirmTimedOutBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "Declare Timed Out");
  await act(async () => {
    confirmTimedOutBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.batsmen.C.out, true);
  assert.equal(ctx.inning.batsmen.C.how, "Timed out");
  assert.equal(ctx.inning.batsmen.C.balls, 0);
  assert.equal(ctx.inning.wickets, 1);
  // C never actually took strike -- the prompt should still be open, asking for someone else.
  assert.equal(ctx.inning.strikerName, "");
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Next batsman/);
});

test("MatchScreen: Timed Out also resolves a pending wicket (the outgoing batsman still gets recorded) in the same commit", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  // maxWickets raised above the default 2 -- A's dismissal plus C's timed-out wicket is 2 down,
  // which would otherwise genuinely complete the innings and switch ctx.inning to a fresh innings
  // 2 by the time this test checks it, unrelated to what's actually being tested here.
  const i1 = buildInning("Riverside CC", "Oakwood CC", { maxWickets: 5 });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  act(() => { btn(ctx, "Wicket").props.onClick(); });
  const bowledBtn = ctx.inst.root.findAllByType("button").find(b => b.props.children === "Bowled");
  act(() => { bowledBtn.props.onClick(); });
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Next batsman/);

  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  const timedOutBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Timed Out"));
  act(() => { timedOutBtn.props.onClick(); });
  const confirmTimedOutBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "Declare Timed Out");
  await act(async () => {
    confirmTimedOutBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  // The original wicket (A, bowled) is resolved, and C is separately timed out -- two wickets down.
  assert.equal(ctx.inning.batsmen.A.out, true);
  assert.equal(ctx.inning.batsmen.A.how, "b X");
  assert.equal(ctx.inning.batsmen.C.out, true);
  assert.equal(ctx.inning.batsmen.C.how, "Timed out");
  assert.equal(ctx.inning.wickets, 2);
  assert.equal(ctx.inning.strikerName, "");
});

// BUG FIX: "Declare Timed Out" used to commit the dismissal on a single tap with no confirmation
// step at all -- risky for a full out-without-facing-a-ball dismissal. It now opens a confirm
// prompt first; cancelling it must leave the match untouched.
test("MatchScreen: Declare Timed Out asks for confirmation first, and cancelling it commits nothing", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", { strikerName: "", nonStrikerName: "B" });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  const timedOutBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Timed Out"));
  act(() => { timedOutBtn.props.onClick(); });
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Declare timed out\?/);
  assert.equal(ctx.inning.wickets, 0, "no commit has happened yet, only the confirm prompt opened");

  const cancelBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "Cancel");
  act(() => { cancelBtn.props.onClick(); });
  assert.equal(ctx.inning.wickets, 0);
  assert.equal(ctx.inning.batsmen.C, undefined, "cancelling leaves C untouched, never recorded out");
  assert.doesNotMatch(JSON.stringify(ctx.inst.toJSON()), /Declare timed out\?/);
});

// Reported as "Timed Out isn't fixable with Undo" -- this confirms the underlying commit/undo
// mechanism itself is correct (timedOutBatsman goes through the same pushHistory()+commit() path
// as every other action, so the generic Undo genuinely reverts it). The likely real complaint is
// that the very SAME "Next batsman" prompt reopens either way (needsNewBatsman was never cleared,
// by design -- see timedOutBatsman's own comment), so nothing LOOKS different after tapping Undo
// even though wickets/batsmen underneath did revert -- see the follow-up UI fix below.
test("MatchScreen: Undo genuinely reverts a committed Timed Out declaration", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  const i1 = buildInning("Riverside CC", "Oakwood CC", { strikerName: "", nonStrikerName: "B" });
  const ctx = renderMatch(baseMatch({ innings: [i1] }));
  const picker = ctx.inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("C"); });
  const timedOutBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Timed Out"));
  act(() => { timedOutBtn.props.onClick(); });
  const confirmTimedOutBtn = ctx.inst.root.findAllByType(Btn).find(b => b.props.children === "Declare Timed Out");
  await act(async () => {
    confirmTimedOutBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(ctx.inning.wickets, 1);
  assert.equal(ctx.inning.batsmen.C.out, true);

  const undoBtn = ctx.inst.root.findAllByType("button").find(b => hasText(b.props.children, "Undo"));
  assert.ok(undoBtn, "an Undo/Cancel affordance must be offered right after the commit");
  act(() => { undoBtn.props.onClick(); });
  assert.equal(ctx.inning.wickets, 0, "the wicket genuinely reverts");
  assert.equal(ctx.inning.batsmen.C, undefined, "C is no longer recorded at all, same as before the declaration");
  // UX FIX: the exact same "Next batsman" sheet reopens either way (it's a full-screen Modal, and
  // needsNewBatsman stays true regardless), so without an explicit note, undoing from right here
  // looked like nothing had happened even though it genuinely had.
  assert.match(JSON.stringify(ctx.inst.toJSON()), /Reverted/);
});
