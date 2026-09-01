// Between-innings setup screens (src/components/inningsSetupScreens.js). Both call
// `saveTransition` (a bare global, wraps saveMatch, a Firestore write, not extracted) only from
// their own start()/goBackToFirstInnings() handlers -- stubbed on globalThis only in tests that
// click those buttons.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { SuperOverOpenersSetup, SecondInningsSetup } from "../../../src/components/inningsSetupScreens.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { PlayerPicker } from "../../../src/components/pickerAtoms.js";

afterEach(() => {
  delete globalThis.saveTransition;
  delete globalThis.Modal;
});

function inning(overrides = {}) {
  return {
    battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
    runs: 0, wickets: 0, legalBalls: 0, ballsPerOver: 6,
    battingOrder: [], bowlingOrder: [], batsmen: {}, bowlers: {},
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 }, fallOfWickets: [],
    overs: [[]],
    ...overrides
  };
}

function matchWith(innings, overrides = {}) {
  return {
    teamA: "Riverside CC", teamB: "Oakwood CC",
    teamACaptain: "", teamAKeeper: "", teamBCaptain: "", teamBKeeper: "",
    oversLimit: 20, currentInningIndex: innings.length - 1,
    innings,
    ...overrides
  };
}

test("SuperOverOpenersSetup: Start is disabled until striker/non-striker/bowler are all set and distinct", () => {
  const match = matchWith([inning()], { isSuperOver: true });
  const inst = renderer.create(React.createElement(SuperOverOpenersSetup, { match, setMatch: () => {} }));
  const startBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Start Super Over");
  assert.equal(startBtn.props.disabled, true);

  const [strikerPicker, nonStrikerPicker, bowlerPicker] = inst.root.findAllByType(PlayerPicker);
  act(() => { strikerPicker.props.onChange("Virat Kohli"); });
  act(() => { nonStrikerPicker.props.onChange("Rohit Sharma"); });
  act(() => { bowlerPicker.props.onChange("Jasprit Bumrah"); });
  const enabledBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Start Super Over");
  assert.equal(enabledBtn.props.disabled, false);
});

test("SuperOverOpenersSetup: Start sets the openers on innings[0] and saves via the (stubbed) saveTransition", () => {
  globalThis.saveTransition = () => {};
  const match = matchWith([inning()], { isSuperOver: true });
  let updated = null;
  const inst = renderer.create(React.createElement(SuperOverOpenersSetup, { match, setMatch: m => { updated = m; } }));
  const [strikerPicker, nonStrikerPicker, bowlerPicker] = inst.root.findAllByType(PlayerPicker);
  act(() => { strikerPicker.props.onChange("Virat Kohli"); });
  act(() => { nonStrikerPicker.props.onChange("Rohit Sharma"); });
  act(() => { bowlerPicker.props.onChange("Jasprit Bumrah"); });
  const startBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Start Super Over");
  act(() => { startBtn.props.onClick(); });
  assert.equal(updated.innings[0].strikerName, "Virat Kohli");
  assert.equal(updated.innings[0].nonStrikerName, "Rohit Sharma");
  assert.equal(updated.innings[0].bowlerName, "Jasprit Bumrah");
  assert.equal(updated.awaitingFirstInningsSetup, false);
});

test("SecondInningsSetup: shows the target and starts the chase with the picked openers", () => {
  globalThis.saveTransition = () => {};
  const first = inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150, wickets: 8, complete: true });
  const second = inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC" });
  const match = matchWith([first, second]);
  let updated = null;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: m => { updated = m; } }));
  assert.match(JSON.stringify(inst.toJSON()), /151/); // target = 150 + 1

  const [strikerPicker, nonStrikerPicker, bowlerPicker] = inst.root.findAllByType(PlayerPicker);
  act(() => { strikerPicker.props.onChange("Rohit Sharma"); });
  act(() => { nonStrikerPicker.props.onChange("Jasprit Bumrah"); });
  act(() => { bowlerPicker.props.onChange("Virat Kohli"); });
  const startBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Start 2nd Innings");
  act(() => { startBtn.props.onClick(); });
  assert.equal(updated.innings[1].strikerName, "Rohit Sharma");
  assert.equal(updated.awaitingSecondInningsSetup, false);
});

test("SecondInningsSetup: 'Correct' reopens the first innings, dropping the second", () => {
  globalThis.saveTransition = () => {};
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const first = inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150, wickets: 8, complete: true });
  const second = inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC" });
  const match = matchWith([first, second]);
  let updated = null;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: m => { updated = m; } }));

  const correctBtn = inst.root.findByProps({ "aria-label": "Back to 1st innings" });
  act(() => { correctBtn.props.onClick(); });
  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Go back");
  act(() => { confirmBtn.props.onClick(); });

  assert.equal(updated.innings.length, 1);
  assert.equal(updated.innings[0].complete, false);
  assert.equal(updated.currentInningIndex, 0);
});

test("SecondInningsSetup: 'Scorecard' opens the first innings' read-only overlay", () => {
  const first = inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150, wickets: 8, complete: true, battingOrder: ["Virat Kohli"], batsmen: { "Virat Kohli": { runs: 80, balls: 60, fours: 8, sixes: 2, out: false } } });
  const second = inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC" });
  const match = matchWith([first, second]);
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: () => {} }));
  const scorecardBtn = inst.root.findByProps({ "aria-label": "Scorecard" });
  act(() => { scorecardBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Virat Kohli/);
});
