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

// Impact Player substitution (impactPlayerEnabled) -- offered on this same Innings Break screen,
// for either team, since the Laws allow the swap any time before the other team's innings starts.
function impactMatch(overrides = {}) {
  const first = inning({ battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 150, wickets: 8, complete: true });
  const second = inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC" });
  return matchWith([first, second], {
    rules: { impactPlayerEnabled: true },
    teamARoster: ["Virat Kohli", "Rohit Sharma"],
    teamBRoster: ["Ben Stokes", "Joe Root"],
    teamABench: ["Hardik Pandya"],
    teamBBench: ["Jofra Archer"],
    ...overrides
  });
}

test("SecondInningsSetup: no Impact Player step when the rule is off -- lands straight on lineups", () => {
  const match = matchWith([inning({ complete: true }), inning()], {
    teamARoster: ["Virat Kohli"], teamABench: ["Hardik Pandya"]
  });
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: () => {} }));
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Impact Player/);
  assert.match(JSON.stringify(inst.toJSON()), /Opening striker/);
});

test("SecondInningsSetup: no Impact Player step when both teams have an empty bench", () => {
  const match = impactMatch({ teamABench: [], teamBBench: [] });
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: () => {} }));
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Impact Player/);
  assert.match(JSON.stringify(inst.toJSON()), /Opening striker/);
});

test("SecondInningsSetup: opens on a dedicated Impact Player step (not mixed in with the lineup pickers), with a way back to it from lineups", () => {
  const match = impactMatch();
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: () => {} }));
  const html = JSON.stringify(inst.toJSON());
  assert.match(html, /Impact Player — Riverside CC/);
  assert.match(html, /Impact Player — Oakwood CC/);
  // Only the 2 (out/in) pickers per team's Impact Player card -- no opener/bowler pickers on this
  // first step, and no "Opening striker" text either.
  assert.equal(inst.root.findAllByType(PlayerPicker).length, 4);
  assert.doesNotMatch(html, /Opening striker/);

  act(() => { btn(inst, "Continue to lineups").props.onClick(); });
  const lineupsHtml = JSON.stringify(inst.toJSON());
  assert.match(lineupsHtml, /Opening striker/);
  assert.doesNotMatch(lineupsHtml, /Impact Player — Riverside CC/);
  assert.ok(inst.root.findByProps({ "aria-label": "Back to Impact Player" }));

  act(() => { inst.root.findByProps({ "aria-label": "Back to Impact Player" }).props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Impact Player — Riverside CC/);
});

function btn(inst, text) {
  return inst.root.findAllByType(Btn).find(b => b.props.children === text);
}

test("SecondInningsSetup: Confirm substitution is disabled until both a player going off and coming on are picked", () => {
  const match = impactMatch();
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: () => {} }));
  const confirmBtns = inst.root.findAllByType(Btn).filter(b => b.props.children === "Confirm substitution");
  assert.equal(confirmBtns.length, 2);
  assert.ok(confirmBtns.every(b => b.props.disabled === true));
});

test("SecondInningsSetup: confirming a substitution swaps the roster/bench, marks the team's swap used, and logs it", () => {
  globalThis.saveTransition = () => {};
  const match = impactMatch();
  let updated = null;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: m => { updated = m; } }));
  // Riverside CC's card is rendered first (bowlingTeam, per the card order in SecondInningsSetup).
  const [outPicker, inPicker] = inst.root.findAllByType(PlayerPicker).slice(0, 2);
  act(() => { outPicker.props.onChange("Virat Kohli"); });
  act(() => { inPicker.props.onChange("Hardik Pandya"); });
  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm substitution" && !b.props.disabled);
  act(() => { confirmBtn.props.onClick(); });

  assert.deepEqual(updated.teamARoster, ["Hardik Pandya", "Rohit Sharma"]);
  assert.deepEqual(updated.teamABench, []);
  assert.equal(updated.teamAImpactUsed, 1);
  assert.deepEqual(updated.impactSubs, [{ team: "Riverside CC", outName: "Virat Kohli", inName: "Hardik Pandya", wasCaptain: false, wasKeeper: false }]);
  // Untouched -- only Riverside CC's own fields change.
  assert.deepEqual(updated.teamBRoster, ["Ben Stokes", "Joe Root"]);
  assert.equal(updated.teamBImpactUsed, undefined);
});

test("SecondInningsSetup: a substituted-out captain/keeper loses that role", () => {
  globalThis.saveTransition = () => {};
  const match = impactMatch({ teamACaptain: "Virat Kohli", teamAKeeper: "Virat Kohli" });
  let updated = null;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: m => { updated = m; } }));
  const [outPicker, inPicker] = inst.root.findAllByType(PlayerPicker).slice(0, 2);
  act(() => { outPicker.props.onChange("Virat Kohli"); });
  act(() => { inPicker.props.onChange("Hardik Pandya"); });
  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm substitution" && !b.props.disabled);
  act(() => { confirmBtn.props.onClick(); });
  assert.equal(updated.teamACaptain, "");
  assert.equal(updated.teamAKeeper, "");
  assert.deepEqual(updated.impactSubs, [{ team: "Riverside CC", outName: "Virat Kohli", inName: "Hardik Pandya", wasCaptain: true, wasKeeper: true }]);
});

test("SecondInningsSetup: a team's card switches to an 'Undo' affordance once its swap is used, offering no new substitution -- the other team's full card stays", () => {
  globalThis.saveTransition = () => {};
  const match = impactMatch();
  let updated = null;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: m => { updated = m; } }));
  const [outPicker, inPicker] = inst.root.findAllByType(PlayerPicker).slice(0, 2);
  act(() => { outPicker.props.onChange("Virat Kohli"); });
  act(() => { inPicker.props.onChange("Hardik Pandya"); });
  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm substitution" && !b.props.disabled);
  act(() => { confirmBtn.props.onClick(); });
  act(() => { inst.update(React.createElement(SecondInningsSetup, { match: updated, setMatch: m => { updated = m; } })); });
  const html = JSON.stringify(inst.toJSON());
  // The card itself is still there (so "Undo" has somewhere to live), but its substitution form
  // is gone -- no more picking a new player off/on for a team that's used its only swap.
  assert.match(html, /Impact Player — Riverside CC/);
  assert.match(html, /No substitutions left for this team/);
  assert.match(html, /Impact Player — Oakwood CC/);
  // Only one "Player going off" form -- Oakwood CC's own, untouched card.
  assert.equal((html.match(/Player going off/g) || []).length, 1);
});

test("SecondInningsSetup: Undo reverses the roster/bench/used-count/captain and drops the logged entry", () => {
  globalThis.saveTransition = () => {};
  const match = impactMatch({ teamACaptain: "Virat Kohli" });
  let updated = null;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match, setMatch: m => { updated = m; } }));
  const [outPicker, inPicker] = inst.root.findAllByType(PlayerPicker).slice(0, 2);
  act(() => { outPicker.props.onChange("Virat Kohli"); });
  act(() => { inPicker.props.onChange("Hardik Pandya"); });
  act(() => { inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm substitution" && !b.props.disabled).props.onClick(); });
  act(() => { inst.update(React.createElement(SecondInningsSetup, { match: updated, setMatch: m => { updated = m; } })); });

  const undoBtn = inst.root.findAllByType("button").find(b => b.props.children === "Undo");
  act(() => { undoBtn.props.onClick(); });

  assert.deepEqual(updated.teamARoster, ["Virat Kohli", "Rohit Sharma"]);
  assert.deepEqual(updated.teamABench, ["Hardik Pandya"]);
  assert.equal(updated.teamAImpactUsed, 0);
  assert.equal(updated.teamACaptain, "Virat Kohli");
  assert.deepEqual(updated.impactSubs, []);
});

// impactPlayerMaxSubs -- a tournament's own rule book (e.g. Billund's) can allow more than the
// standard 1 substitution per team.
test("SecondInningsSetup: impactPlayerMaxSubs lets a team substitute more than once before it's out of swaps", () => {
  globalThis.saveTransition = () => {};
  const match = impactMatch({
    rules: { impactPlayerEnabled: true, impactPlayerMaxSubs: 2 },
    teamABench: ["Hardik Pandya", "Suryakumar Yadav"]
  });
  let updated = match;
  const inst = renderer.create(React.createElement(SecondInningsSetup, { match: updated, setMatch: m => { updated = m; } }));
  assert.match(JSON.stringify(inst.toJSON()), /2 substitutions remaining/);

  const [outPicker1, inPicker1] = inst.root.findAllByType(PlayerPicker).slice(0, 2);
  act(() => { outPicker1.props.onChange("Virat Kohli"); });
  act(() => { inPicker1.props.onChange("Hardik Pandya"); });
  act(() => { inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm substitution" && !b.props.disabled).props.onClick(); });
  assert.equal(updated.teamAImpactUsed, 1);

  act(() => { inst.update(React.createElement(SecondInningsSetup, { match: updated, setMatch: m => { updated = m; } })); });
  const midHtml = JSON.stringify(inst.toJSON());
  assert.match(midHtml, /Impact Player — Riverside CC/); // still has one more
  assert.match(midHtml, /Last substitution remaining/);

  const [outPicker2, inPicker2] = inst.root.findAllByType(PlayerPicker).slice(0, 2);
  act(() => { outPicker2.props.onChange("Rohit Sharma"); });
  act(() => { inPicker2.props.onChange("Suryakumar Yadav"); });
  act(() => { inst.root.findAllByType(Btn).find(b => b.props.children === "Confirm substitution" && !b.props.disabled).props.onClick(); });
  assert.equal(updated.teamAImpactUsed, 2);
  assert.deepEqual(updated.teamARoster, ["Hardik Pandya", "Suryakumar Yadav"]);
  assert.equal(updated.impactSubs.length, 2);

  act(() => { inst.update(React.createElement(SecondInningsSetup, { match: updated, setMatch: m => { updated = m; } })); });
  const finalHtml = JSON.stringify(inst.toJSON());
  assert.match(finalHtml, /Impact Player — Riverside CC/); // still shown, for Undo
  assert.match(finalHtml, /No substitutions left for this team/);
  // Only one "Player going off" form left -- Oakwood CC's own, untouched card.
  assert.equal((finalHtml.match(/Player going off/g) || []).length, 1);
});
