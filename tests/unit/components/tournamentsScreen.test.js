// The "Cups" list screen (src/components/tournamentsScreen.js). Every write action is a prop
// (onCreateTournament/onCreateSeries) -- no bare globals except Modal (bare global, same as
// everywhere else in this suite), which backs the create-series dialog only.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TournamentsScreen } from "../../../src/components/tournamentsScreen.js";
import { Btn, PinnableChip, RuleChoice } from "../../../src/components/formUiAtoms.js";
import { VenueEditModal } from "../../../src/components/venueAndDateModals.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

// The create-tournament form is paginated like SetupScreen's own "New Match" flow (details ->
// rules -> review), so every test that used to fill in teams and hit "Create" in one step now
// walks the same Next/Review buttons a real user would.
function clickNav(inst, text) {
  const b = inst.root.findAllByType(Btn).find(x => x.props.children === text);
  act(() => { b.props.onClick(); });
}

afterEach(() => {
  delete globalThis.Modal;
});

// Finds the wrapping <div style={{marginTop:14}}> a ToggleRule/NullableNumberRule renders itself
// as, scoped by its own label text -- both are private to tournamentsScreen.js (not exported), so
// tests locate them by rendered structure/text the same way the rest of this suite already finds
// plain buttons/inputs, rather than importing the helper components directly.
function ruleBlock(inst, labelText) {
  return inst.root.findAll(n => n.type === "div" && n.props.style && n.props.style.marginTop === 14 && hasText(n.props.children, labelText))[0];
}

function tournament(overrides = {}) {
  return {
    id: "t1", name: "Summer Cup", teams: ["Riverside CC", "Oakwood CC"], fixtures: [], createdAt: Date.now(),
    ...overrides
  };
}

function baseProps(overrides = {}) {
  return {
    tournaments: [], clubs: [], activeClubId: null, onSelectSource: () => {},
    onSelectFederationSource: () => {}, teamOptions: ["Riverside CC", "Oakwood CC"],
    onCreateTournament: () => Promise.resolve({ ok: true }), onCreateSeries: () => Promise.resolve({ ok: true }),
    onOpenTournament: () => {}, onOpenRecords: () => {}, onBack: () => {}, currentUid: "owner1",
    ...overrides
  };
}

test("TournamentsScreen: lists tournaments, filtered by search", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    tournaments: [tournament(), tournament({ id: "t2", name: "Winter League" })]
  })));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Summer Cup/);
  assert.match(text, /Winter League/);

  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "Winter" } }); });
  const filteredText = JSON.stringify(inst.toJSON());
  assert.match(filteredText, /Winter League/);
  assert.doesNotMatch(filteredText, /Summer Cup/);
});

test("TournamentsScreen: shows an empty-state message when there are no tournaments", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  assert.match(JSON.stringify(inst.toJSON()), /No tournaments yet\./);
});

test("TournamentsScreen: clicking a tournament row calls onOpenTournament", () => {
  let opened = null;
  const t = tournament();
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    tournaments: [t], onOpenTournament: x => { opened = x; }
  })));
  const row = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Summer Cup"));
  row.props.onClick();
  assert.equal(opened.id, "t1");
});

test("TournamentsScreen: creating a tournament selects teams and calls onCreateTournament", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup) => {
      createdWith = { name, teams, groups, advancePerGroup };
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });

  const nameField = inst.root.findByType("input");
  act(() => { nameField.props.onChange({ target: { value: "Autumn Cup" } }); });

  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });

  clickNav(inst, "Next"); // details -> rules
  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith.name, "Autumn Cup");
  assert.deepEqual(createdWith.teams, ["Riverside CC", "Oakwood CC"]);
  assert.equal(createdWith.groups, null);
});

test("TournamentsScreen: with 4+ teams selected, turning on group split sends groups to onCreateTournament", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    teamOptions: ["Riverside CC", "Oakwood CC", "Hawks CC", "Eagles CC"],
    onCreateTournament: (name, teams, groups, advancePerGroup) => {
      createdWith = { name, teams, groups, advancePerGroup };
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });

  const nameField = inst.root.findByType("input");
  act(() => { nameField.props.onChange({ target: { value: "Group Cup" } }); });

  const teamNames = ["Riverside CC", "Oakwood CC", "Hawks CC", "Eagles CC"];
  for (const name of teamNames) {
    const btn = inst.root.findAllByType("button").find(b => b.props.children === name);
    act(() => { btn.props.onClick(); });
  }

  const groupToggle = inst.root.findAllByType("button").find(b => b.props.children === "Off");
  act(() => { groupToggle.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Split into groups/);

  clickNav(inst, "Next"); // details -> rules
  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(Array.isArray(createdWith.groups));
  assert.equal(createdWith.groups.length, 2);
  assert.equal(createdWith.advancePerGroup, 2);
});

test("TournamentsScreen: creating a tournament with no rules customization sends null defaults", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules) => {
      createdWith = { defaultOvers, defaultRules };
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Autumn Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });

  clickNav(inst, "Next"); // details -> rules
  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith.defaultOvers, null);
  assert.equal(createdWith.defaultRules, null);
});

// fixtureRow.js already falls back to `fixture.venue || tournament.venue` for any fixture that
// hasn't set its own -- but until now there was no UI to actually set it at creation time.
test("TournamentsScreen: setting a venue on the details page passes it through to onCreateTournament", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules, venueInfo) => {
      createdWith = venueInfo;
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });

  const addVenueBtn = inst.root.findAllByType("button").find(b => b.props.children === "Add a venue");
  act(() => { addVenueBtn.props.onClick(); });
  const venueModal = inst.root.findByType(VenueEditModal);
  act(() => { venueModal.props.onSave("Riverside Oval", 12.34, 56.78); });
  assert.match(JSON.stringify(inst.toJSON()), /Riverside Oval/);

  clickNav(inst, "Next"); // details -> rules
  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(createdWith, { venue: "Riverside Oval", venueLat: 12.34, venueLng: 56.78 });
});

test("TournamentsScreen: no venue set sends null, not an empty object, to onCreateTournament", async () => {
  let createdWith = "unset";
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules, venueInfo) => {
      createdWith = venueInfo;
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith, null);
});

test("TournamentsScreen: customizing tournament rules copies overs/wide/no-ball/free-hit/squad-size into onCreateTournament", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules) => {
      createdWith = { defaultOvers, defaultRules };
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules

  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  const oversField = inst.root.findAllByType("input").find(i => i.props.placeholder === "20");
  act(() => { oversField.props.onChange({ target: { value: "8" } }); });

  const ruleChoices = inst.root.findAllByType(RuleChoice);
  act(() => { ruleChoices.find(r => r.props.label === "Players per side").props.onChange(8); });
  act(() => { ruleChoices.find(r => r.props.label === "Runs on a wide").props.onChange(2); });
  act(() => { ruleChoices.find(r => r.props.label === "Runs on a no-ball").props.onChange(2); });
  act(() => { ruleBlock(inst, "Free hit after a no-ball").findByType("button").props.onClick(); });

  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith.defaultOvers, 8);
  assert.equal(createdWith.defaultRules.playersPerSide, 8);
  assert.equal(createdWith.defaultRules.wideRuns, 2);
  assert.equal(createdWith.defaultRules.noballRuns, 2);
  assert.equal(createdWith.defaultRules.freeHit, true);
});

test("TournamentsScreen: 'Players per side' offers 10, not just 6/7/8/9/11", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });
  const playersPerSide = inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Players per side");
  assert.deepEqual(playersPerSide.props.options.map(o => o.value), [6, 7, 8, 9, 10, 11]);
});

test("TournamentsScreen: full match-rules parity (balls/over, powerplay, time cap, bowler limit, retirement, Super Over, final-over wide/no-ball, Impact Player) flows into onCreateTournament", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules) => {
      createdWith = defaultRules;
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  act(() => { inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Balls per over").props.onChange(8); });
  act(() => { ruleBlock(inst, "Max overs per bowler").findByType("button").props.onClick(); }); // seed it
  act(() => { ruleBlock(inst, "Powerplay").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Time cap per innings").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Retirement run cap").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Super Over if the match ties").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Wide/no-ball counts as a ball").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Last over rules").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Wide/no-ball illegal again in the last over(s)").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Impact Player substitution").findByType("button").props.onClick(); });

  clickNav(inst, "Review"); // rules -> review
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith.ballsPerOver, 8);
  assert.equal(createdWith.maxOversPerBowler, 4); // seeded from the default 20 overs: ceil(20/5)
  assert.equal(createdWith.powerplayOvers, 6);
  assert.equal(createdWith.timeCapMinutes, 90); // round(20 * 4.5)
  assert.equal(createdWith.retirementRuns, 25);
  assert.equal(createdWith.superOver, true);
  assert.equal(createdWith.wideNoballCountsAsBall, true);
  assert.equal(createdWith.lastOverRules.enabled, true);
  assert.equal(createdWith.lastOverRules.wideNoballIllegalAgain, true);
  assert.equal(createdWith.impactPlayerEnabled, true);
});

test("TournamentsScreen: Last over rules -- the overs picker and wide/no-ball sub-toggle only show once relevant, and both flow into onCreateTournament", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules) => {
      createdWith = defaultRules;
      return Promise.resolve({ ok: true });
    }
  })));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Applies to the last/);
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /illegal again/);

  act(() => { ruleBlock(inst, "Last over rules").findByType("button").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Applies to the last/);
  // wideNoballCountsAsBall is still off -- its sub-toggle stays hidden even with lastOverRules on.
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /illegal again/);

  act(() => { inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Applies to the last").props.onChange(2); });
  act(() => { ruleBlock(inst, "Wide/no-ball counts as a ball").findByType("button").props.onClick(); });
  act(() => { ruleBlock(inst, "Wide/no-ball illegal again in the last over(s)").findByType("button").props.onClick(); });

  clickNav(inst, "Review");
  const createBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Create");
  await act(async () => {
    createBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(createdWith.lastOverRules.enabled, true);
  assert.equal(createdWith.lastOverRules.overCount, 2);
  assert.equal(createdWith.lastOverRules.wideNoballIllegalAgain, true);
});

test("TournamentsScreen: a nullable rule can be seeded then cleared back to null", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  act(() => { ruleBlock(inst, "Retirement run cap").findByType("button").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /25/);

  const clearBtn = ruleBlock(inst, "Retirement run cap").findAllByType("button").find(b => b.props.children === "None");
  act(() => { clearBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /None — tap to set one/);
});

test("TournamentsScreen: create form is paginated -- starts on 'Teams & Format', Next is blocked until name/2 teams are set", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","1"," of ","3"," · ","Teams & Format"/);
  const nextBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Next");
  assert.equal(nextBtn.props.disabled, true);

  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  assert.equal(inst.root.findAllByType(Btn).find(b => b.props.children === "Next").props.disabled, false);
});

test("TournamentsScreen: Back goes to the previous page; Back on the first page cancels", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  assert.equal(inst.root.findAllByType(Btn).find(b => b.props.children === "Back" || b.props.children === "Cancel").props.children, "Cancel");

  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","2"," of ","3"," · ","Match Rules"/);

  clickNav(inst, "Back"); // rules -> details, name/teams preserved
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","1"," of ","3"," · ","Teams & Format"/);
  assert.equal(inst.root.findByType("input").props.value, "Billund Cup");

  const cancelBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Cancel");
  act(() => { cancelBtn.props.onClick(); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Tournament name/);
});

test("TournamentsScreen: review page summarizes the tournament before creating", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  const newBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "New Tournament"));
  act(() => { newBtn.props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });
  act(() => { ruleBlock(inst, "Super Over if the match ties").findByType("button").props.onClick(); });
  clickNav(inst, "Review"); // rules -> review

  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /"Step ","3"," of ","3"," · ","Review"/);
  assert.match(text, /Billund Cup/);
  assert.match(text, /Riverside CC, Oakwood CC/);
  assert.match(text, /Super Over on a tie/);
  assert.ok(inst.root.findAllByType(Btn).find(b => b.props.children === "Creating…" || b.props.children === "Create"));
});

test("TournamentsScreen: canManage=false hides 'New Tournament' and shows an owner-only note", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    activeClubId: "c1", clubs: [{ id: "c1", name: "Riverside CC", ownerUid: "someoneElse" }], currentUid: "notTheOwner"
  })));
  const text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /New Tournament/);
  assert.match(text, /Only the owner of/);
});

test("TournamentsScreen: creating a series opens a Modal and calls onCreateSeries", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateSeries: (label, teamA, teamB, count) => {
      createdWith = { label, teamA, teamB, count };
      return Promise.resolve({ ok: true });
    }
  })));
  const seriesLink = inst.root.findAllByType("button").find(b => hasText(b.props.children, "head-to-head series"));
  act(() => { seriesLink.props.onClick(); });

  const selects = inst.root.findAllByType("select");
  act(() => { selects[0].props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { selects[1].props.onChange({ target: { value: "Oakwood CC" } }); });

  const createSeriesBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Create series"));
  await act(async () => {
    createSeriesBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(createdWith, { label: "Riverside CC vs Oakwood CC", teamA: "Riverside CC", teamB: "Oakwood CC", count: 3 });
});

test("TournamentsScreen: clicking a club chip calls onSelectSource with that club's id", () => {
  let selected = "not called";
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    clubs: [{ id: "c1", name: "Riverside CC" }], onSelectSource: id => { selected = id; }
  })));
  const chip = inst.root.findByType(PinnableChip);
  chip.props.onSelect();
  assert.equal(selected, "c1");
});
