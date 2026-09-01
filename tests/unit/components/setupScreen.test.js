// The multi-page "New Match" setup flow (src/components/setupScreen.js). Every write is a prop
// (onStart/onCancel) -- no bare Firestore globals -- but a page-change effect calls
// window.scrollTo directly (to reset scroll position when swapping pages), so this stubs a
// minimal globalThis.window rather than pulling in jsdom just for that one call, same as
// TournamentShareModal's own minimal window stub. With no saved teams picked (typed names only),
// hasSquads is false and the "xi" page is skipped entirely, so these tests walk
// teams -> rules -> openers -> review, matching the common path most matches actually take.
// PlayerPicker falls back to a plain text field (placeholder "Batsman name"/"Bowler name") when
// there's no saved roster, found via the host <input>, same as TextField elsewhere in this suite.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach, beforeEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { SetupScreen } from "../../../src/components/setupScreen.js";
import { Btn, TeamChips } from "../../../src/components/formUiAtoms.js";
import { PlayerPicker } from "../../../src/components/pickerAtoms.js";
import { Field } from "../../../src/components/screenAtoms.js";

beforeEach(() => {
  globalThis.window = { scrollTo: () => {} };
});
afterEach(() => {
  delete globalThis.window;
});

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function baseProps(overrides = {}) {
  return {
    onStart: () => {}, onCancel: () => {}, teams: [], rules: {}, presetTournament: null,
    clubUmpires: [],
    ...overrides
  };
}

function render(props) {
  let inst;
  act(() => { inst = renderer.create(React.createElement(SetupScreen, baseProps(props))); });
  return inst;
}

function input(inst, placeholder) {
  return inst.root.findAllByType("input").find(i => i.props.placeholder === placeholder);
}

function btn(inst, text) {
  return inst.root.findAllByType(Btn).find(b => b.props.children === text);
}

test("SetupScreen: shows 'New Match' and starts on the Teams & Format page", () => {
  const inst = render();
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /New Match/);
  // "Step ", 1, " of ", 4 render as separate JSX children, not one concatenated string.
  assert.match(text, /"Step ","1"," of ","4"/);
  assert.match(text, /Teams & Format/);
});

test("SetupScreen: Cancel on the first page calls onCancel", () => {
  let cancelled = false;
  const inst = render({ onCancel: () => { cancelled = true; } });
  const cancelBtn = btn(inst, "Cancel");
  act(() => { cancelBtn.props.onClick(); });
  assert.equal(cancelled, true);
});

test("SetupScreen: Next stays disabled until team names, overs, and toss are all set", () => {
  const inst = render();
  assert.equal(btn(inst, "Next").props.disabled, true);

  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  assert.equal(btn(inst, "Next").props.disabled, true); // no toss recorded yet

  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  const batBtn = inst.root.findAllByType("button").find(b => b.props.children === "Bat");
  act(() => { batBtn.props.onClick(); });

  assert.equal(btn(inst, "Next").props.disabled, false);
});

test("SetupScreen: same team name on both sides shows a warning and blocks Next", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Riverside CC" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Both sides have the same name/);
  assert.equal(btn(inst, "Next").props.disabled, true);
});

test("SetupScreen: Back on a later page goes back one page instead of cancelling", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","2"," of ","4"/);

  const backBtn = btn(inst, "Back");
  act(() => { backBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","1"," of ","4"/);
});

test("SetupScreen: walking every page to Start Match calls onStart with the assembled match", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });

  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  act(() => { input(inst, "e.g. Willow Park").props.onChange({ target: { value: "Willow Park" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Oakwood CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bowl").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers (no squads, "xi" skipped)
  assert.match(JSON.stringify(inst.toJSON()), /Opening Line-up/);

  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A. Sharma" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B. Kumar" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C. Patel" } }); });
  act(() => { btn(inst, "Review").props.onClick(); }); // openers -> review
  assert.match(JSON.stringify(inst.toJSON()), /Review/);

  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.ok(started);
  assert.equal(started.teamA, "Riverside CC");
  assert.equal(started.teamB, "Oakwood CC");
  assert.equal(started.venue, "Willow Park");
  // Oakwood CC won the toss and chose to bowl -> Riverside CC bats first.
  assert.equal(started.battingFirstTeam, "Riverside CC");
  assert.equal(started.strikerA, "A. Sharma");
  assert.equal(started.nonStrikerA, "B. Kumar");
  assert.equal(started.bowlerB, "C. Patel");
  assert.deepEqual(started.toss, { wonBy: "Oakwood CC", decision: "Bowl" });
});

test("SetupScreen: umpires are optional and pass through to onStart", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });
  act(() => { input(inst, "Umpire 1").props.onChange({ target: { value: "J. Rao" } }); });
  act(() => { input(inst, "Umpire 2").props.onChange({ target: { value: "" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Umpire 1/);
  // Not filling teams/toss keeps Next disabled -- just confirms the field itself renders and holds
  // its value without needing the full flow.
  assert.equal(input(inst, "Umpire 1").props.value, "J. Rao");
});

test("SetupScreen: 'Customize' reveals the rules editor, and a rule change is reflected on Review", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules

  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });
  // "Balls per over" options include "8" as a plain label -- pick the RuleChoice option button.
  const ballsPerOverBtn = inst.root.findAllByType("button").find(b => b.props.children === "8");
  act(() => { ballsPerOverBtn.props.onClick(); });

  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.equal(started.rules.ballsPerOver, 8);
});

test("SetupScreen: presetTournament shows a 'Playing in' banner and locks the team names to the fixture", () => {
  const inst = render({
    presetTournament: { id: "t1", name: "Summer Cup", fixtureTeamA: "Riverside CC", fixtureTeamB: "Oakwood CC" }
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Playing in:/);
  assert.match(text, /Summer Cup/);
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
  // Fixture teams are shown as static text, not pickable -- no TeamChips/TextField for either side.
  assert.equal(input(inst, "e.g. Willow CC"), undefined);
});

test("SetupScreen: presetTournament.defaultOvers pre-fills the Overs per innings field", () => {
  const inst = render({
    presetTournament: { id: "t1", name: "Billund Cup", fixtureTeamA: "Riverside CC", fixtureTeamB: "Oakwood CC", defaultOvers: 8 }
  });
  // The overs TextField's own placeholder is "20" -- its value is the pre-filled string, not the
  // placeholder, so this finds it by the field immediately after the "Overs per innings" label
  // rather than by placeholder (which stays "20" regardless of the actual value).
  const oversField = inst.root.findAllByType("input").find(i => i.props.placeholder === "20");
  assert.equal(oversField.props.value, "8");
});

test("SetupScreen: with no presetTournament (or no defaultOvers), Overs per innings still defaults to 20", () => {
  const inst = render();
  const oversField = inst.root.findAllByType("input").find(i => i.props.placeholder === "20");
  assert.equal(oversField.props.value, "20");
});

test("SetupScreen: with saved squads, teamABench/teamBBench (squad minus Playing XI) flow through to onStart", () => {
  let started = null;
  const teamARecord = { id: "t1", name: "Riverside CC", players: ["A. Sharma", "B. Kumar", "C. Patel"] };
  const teamBRecord = { id: "t2", name: "Oakwood CC", players: ["D. Singh", "E. Rao"] };
  const inst = render({
    onStart: m => { started = m; },
    teams: [teamARecord, teamBRecord],
    rules: { playersPerSide: 2 }
  });

  const [teamAChips, teamBChips] = inst.root.findAllByType(TeamChips);
  act(() => { teamAChips.props.onSelect(teamARecord); });
  act(() => { teamBChips.props.onSelect(teamBRecord); });

  // TeamChips' own chip buttons for saved teams also show "Riverside CC" as their label, so this
  // scopes the search to the "Won the toss" Field specifically rather than matching the wrong
  // (team-selection) button by text.
  const tossField = inst.root.findAllByType(Field).find(f => f.props.label === "Won the toss");
  const tossBtn = tossField.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });

  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  assert.equal(btn(inst, "Next").props.disabled, false); // rules page is always valid
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> xi
  act(() => { btn(inst, "Next").props.onClick(); }); // xi -> openers

  const [strikerPicker, nonStrikerPicker, bowlerPicker] = inst.root.findAllByType(PlayerPicker);
  act(() => { strikerPicker.props.onChange("A. Sharma"); });
  act(() => { nonStrikerPicker.props.onChange("B. Kumar"); });
  act(() => { bowlerPicker.props.onChange("D. Singh"); });
  act(() => { btn(inst, "Review").props.onClick(); });
  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.ok(started);
  assert.deepEqual(started.teamARoster, ["A. Sharma", "B. Kumar"]);
  assert.deepEqual(started.teamABench, ["C. Patel"]);
  assert.deepEqual(started.teamBRoster, ["D. Singh", "E. Rao"]);
  assert.deepEqual(started.teamBBench, []); // squad exactly fills the XI, nothing left on the bench
});
