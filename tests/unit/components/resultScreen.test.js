// Match-complete result screen (src/components/resultScreen.js). `saveTransition`/`saveMatch`/
// `loadMatch` are bare-global Firestore calls, called only from button handlers, so each test
// stubs whichever one its action needs. ShareMenu's own popover uses a real DOM portal (see
// shareMenus.test.js) -- tests here call its onGetCode/onGetViewCode props directly via
// findByType(ShareMenu) instead of opening the popover, so react-test-renderer alone is enough.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { ResultScreen } from "../../../src/components/resultScreen.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";
import { ShareMenu } from "../../../src/components/shareMenus.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.saveTransition;
  delete globalThis.saveMatch;
  delete globalThis.loadMatch;
  delete globalThis.Modal;
});

function inning(overrides = {}) {
  return {
    battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
    runs: 150, wickets: 8, legalBalls: 120, ballsPerOver: 6, maxWickets: 10,
    battingOrder: ["Virat Kohli"], bowlingOrder: ["Jasprit Bumrah"],
    batsmen: { "Virat Kohli": { runs: 55, balls: 40, fours: 5, sixes: 1, out: false } },
    bowlers: { "Jasprit Bumrah": { ballsBowled: 24, runs: 30, wickets: 2, maidens: 0 } },
    extras: {}, fallOfWickets: [],
    complete: true, overs: [],
    ...overrides
  };
}

function completeMatch(overrides = {}) {
  const i1 = inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150, wickets: 8 });
  const i2 = inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 120, wickets: 10 });
  return {
    id: "m1", teamA: "Riverside CC", teamB: "Oakwood CC",
    teamARoster: ["Virat Kohli"], teamBRoster: ["Jasprit Bumrah"],
    teamACaptain: "Virat Kohli", teamAKeeper: "", teamBCaptain: "Jasprit Bumrah", teamBKeeper: "",
    oversLimit: 20, status: "complete", innings: [i1, i2], rules: {},
    playerOfMatch: "Virat Kohli", bestFielder: "Rohit Sharma",
    ...overrides
  };
}

function renderScreen(match, extraProps = {}) {
  let currentMatch = match;
  const setMatch = updater => { currentMatch = typeof updater === "function" ? updater(currentMatch) : updater; };
  return renderer.create(React.createElement(ResultScreen, { match, setMatch, onExit: () => {}, ...extraProps }));
}

test("ResultScreen: shows the win-by-runs result text and both innings' scorecards", () => {
  const inst = renderScreen(completeMatch());
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC won by 30 runs/);
  assert.match(text, /Virat Kohli/);
  assert.match(text, /Jasprit Bumrah/);
});

test("ResultScreen: 'Fix a mistake' opens a ConfirmModal, and confirming reopens the last innings via saveTransition", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let savedTransition = null;
  globalThis.saveTransition = m => { savedTransition = m; };
  const inst = renderScreen(completeMatch());
  const fixBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Fix a mistake"));
  act(() => { fixBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  act(() => { modal.props.onConfirm(); });
  assert.equal(savedTransition.status, "in-progress");
  assert.equal(savedTransition.innings[1].complete, false);
});

test("ResultScreen: a tied match with superOver rule shows 'Start Super Over', which creates and saves the new match", async () => {
  const saved = [];
  globalThis.saveMatch = m => { saved.push(m); return Promise.resolve({ ok: true, writeSeq: 5 }); };
  let latestMatch = null;
  const tied = completeMatch({
    innings: [inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150 }), inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 150 })],
    rules: { superOver: true }
  });
  const inst = renderer.create(React.createElement(ResultScreen, {
    match: tied, setMatch: m => { latestMatch = m; }, onExit: () => {}
  }));
  assert.match(JSON.stringify(inst.toJSON()), /Match tied/);
  const startBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Start Super Over"));
  await act(async () => {
    startBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(saved.length, 2);
  assert.equal(saved[0].superOverMatchId, saved[1].id);
  assert.equal(latestMatch.isSuperOver, true);
  assert.equal(latestMatch.writeSeq, 5);
});

// BUG FIX: matchWinner (appLogic.js) already follows match.superOverMatchId to resolve who
// actually won for points/NRR/knockout advancement, but this banner used to just say "Match tied"
// forever, even once the linked Super Over had actually finished and decided the match -- the only
// way to see who really won was to tap into the separate Super Over match and read its own screen.
test("ResultScreen: once the linked Super Over is complete and decisive, the banner names the actual winner instead of just 'Match tied'", async () => {
  const tied = completeMatch({
    innings: [inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150 }), inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 150 })],
    rules: { superOver: true },
    superOverMatchId: "so1"
  });
  const superOver = completeMatch({
    id: "so1", isSuperOver: true,
    innings: [inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 10 }), inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 14 })]
  });
  globalThis.loadMatch = id => { assert.equal(id, "so1"); return Promise.resolve(superOver); };
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(ResultScreen, { match: tied, setMatch: () => {}, onExit: () => {} }));
    await new Promise(r => setTimeout(r, 0));
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Match tied.*Oakwood CC won the Super Over/, "Oakwood chased the Super Over's target (14 > 10) so they're the actual winner");
  // "Start Super Over" must not be offered again -- one was already played and decided.
  assert.equal(inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Start Super Over")), undefined);
});

test("ResultScreen: 'View Super Over' loads the linked match via loadMatch", async () => {
  const linked = completeMatch({ id: "so1", isSuperOver: true });
  globalThis.loadMatch = id => { assert.equal(id, "so1"); return Promise.resolve(linked); };
  let latestMatch = null;
  const inst = renderer.create(React.createElement(ResultScreen, {
    match: completeMatch({ superOverMatchId: "so1" }), setMatch: m => { latestMatch = m; }, onExit: () => {}
  }));
  const viewBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "View Super Over"));
  await act(async () => {
    viewBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(latestMatch.id, "so1");
});

test("ResultScreen: a tied super over shows a link back to the parent match, loaded via loadMatch", async () => {
  const parent = completeMatch({ id: "parent1" });
  globalThis.loadMatch = id => { assert.equal(id, "parent1"); return Promise.resolve(parent); };
  let latestMatch = null;
  const inst = renderer.create(React.createElement(ResultScreen, {
    match: completeMatch({ isSuperOver: true, parentMatchId: "parent1" }), setMatch: m => { latestMatch = m; }, onExit: () => {}
  }));
  const viewParentBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "The main match was tied"));
  await act(async () => {
    viewParentBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(latestMatch.id, "parent1");
});

test("ResultScreen: ShareMenu's onGetCode generates and saves a share code the first time, then reuses it", async () => {
  let savedMatch = null;
  globalThis.saveMatch = m => { savedMatch = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  let latestMatch = completeMatch();
  const inst = renderer.create(React.createElement(ResultScreen, {
    match: latestMatch, setMatch: m => { latestMatch = m; }, onExit: () => {}
  }));
  const shareMenu = inst.root.findByType(ShareMenu);
  let result;
  await act(async () => {
    result = await shareMenu.props.onGetCode();
  });
  assert.equal(result.ok, true);
  assert.equal(typeof result.code, "string");
  assert.equal(savedMatch.shareCode, result.code);
});

test("ResultScreen: isTied + superOver rule hides PlayerOfMatchCard in favor of an explanatory note", () => {
  const tied = completeMatch({
    innings: [inning({ battingTeam: "Riverside CC", runs: 150 }), inning({ battingTeam: "Oakwood CC", runs: 150 })],
    rules: { superOver: true }
  });
  const inst = renderScreen(tied);
  assert.match(JSON.stringify(inst.toJSON()), /Player of the Match will be picked once the Super Over settles it\./);
});
