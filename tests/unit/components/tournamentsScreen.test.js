// The "Cups" list screen (src/components/tournamentsScreen.js). Every write action is a prop
// (onCreateTournament/onCreateSeries) -- no bare globals except Modal (bare global, same as
// everywhere else in this suite), which backs the create-series dialog only.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TournamentsScreen } from "../../../src/components/tournamentsScreen.js";
import { Btn, RuleChoice } from "../../../src/components/formUiAtoms.js";
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

// The FabButton this screen renders (its "New" FAB) calls ReactDOM.createPortal(..., document.body)
// internally -- a bare global, same as Modal -- but react-test-renderer has no real DOM to portal
// into, so this stub just renders the portal's children in place instead. Fine here: these tests
// only check the button itself (by aria-label) exists and wires onClick, never its real position
// in the document -- that's covered on its own in screenAtoms.test.js.
// Modal (also a bare global) backs the FAB's own Tournament/series choice menu now, not just the
// create-series dialog -- stubbed here for every test rather than per-test, since almost every
// test in this file has to get past that choice menu to reach either create flow.
beforeEach(() => {
  globalThis.ReactDOM = { createPortal: node => node };
  globalThis.document = { body: null }; // FabButton reads document.body as the portal target
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.ReactDOM;
  delete globalThis.document;
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });

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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });

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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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

test("TournamentsScreen: a personal tournament (the default Organizer) is created private -- no manual Visibility choice any more", async () => {
  let isPrivateArg = "unset";
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules, venueInfo, isPrivate) => {
      isPrivateArg = isPrivate;
      return Promise.resolve({ ok: true });
    }
  })));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  assert.equal(isPrivateArg, true);
});

test("TournamentsScreen: no Visibility toggle on the review page when the Organizer is a club or federation -- those are always public", () => {
  // Deliberately a different name than either team option, so its own Organizer-picker button
  // (also labeled with the club's name) can't be confused with a team-selection chip below it.
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    clubs: [{ id: "c1", name: "Thunder CC", ownerUid: "owner1" }], activeClubId: "c1"
  })));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Riverside Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  clickNav(inst, "Review"); // rules -> review
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Visibility/);
});

test("TournamentsScreen: customizing tournament rules copies overs/wide/no-ball/free-hit/squad-size into onCreateTournament", async () => {
  let createdWith = null;
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    onCreateTournament: (name, teams, groups, advancePerGroup, defaultOvers, defaultRules) => {
      createdWith = { defaultOvers, defaultRules };
      return Promise.resolve({ ok: true });
    }
  })));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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

// The rules editor used to be one flat, undifferentiated list of 16+ fields, all styled
// identically -- no visual signal for where one topic ended and the next began. Grouped into
// labeled sections now, in a fixed order, so a scorer can jump straight to the topic they came in
// for instead of scanning the whole list top to bottom every time.
test("TournamentsScreen: the rules editor is grouped into labeled sections, in order", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
  act(() => { inst.root.findByType("input").props.onChange({ target: { value: "Billund Cup" } }); });
  const teamButtons = inst.root.findAllByType("button").filter(b => b.props.children === "Riverside CC" || b.props.children === "Oakwood CC");
  act(() => { teamButtons.find(b => b.props.children === "Riverside CC").props.onClick(); });
  act(() => { teamButtons.find(b => b.props.children === "Oakwood CC").props.onClick(); });
  clickNav(inst, "Next"); // details -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  const text = JSON.stringify(inst.toJSON());
  const sections = ["Format", "Extras", "Bowling limits", "Batting rules", "Special rules"];
  const positions = sections.map(s => text.indexOf(`"${s}"`));
  positions.forEach((pos, i) => assert.ok(pos !== -1, `section "${sections[i]}" is rendered`));
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1], `"${sections[i]}" appears after "${sections[i - 1]}"`);
  }
});

test("TournamentsScreen: create form is paginated -- starts on 'Teams & Format', Next is blocked until name/2 teams are set", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
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

// "New Tournament" used to be hidden behind canManage, gated on whichever club/federation chip
// happened to be pre-selected -- there's no such pre-selection any more (see organizerKey's own
// comment), so the button is always available; the Organizer picker inside the form is what
// actually restricts which clubs/federations can be picked, to ones this account owns/co-owns.
test("TournamentsScreen: the floating '+' (and 'New Tournament' behind it) is always available, even for a plain club member with no owned clubs", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    clubs: [{ id: "c1", name: "Riverside CC", ownerUid: "someoneElse" }], currentUid: "notTheOwner"
  })));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  assert.ok(inst.root.findByProps({ "aria-label": "New Tournament" }));
});

// The floating "+" (FabButton) opens a choice of Tournament/head-to-head series rather than
// jumping straight into one -- floating it above the create form (or the choice menu) itself once
// open would be confusing (a second, redundant "add" affordance on top of the very thing it
// opens), so it hides for as long as the choice menu or either create flow is in progress.
test("TournamentsScreen: the floating '+' hides once its choice menu opens, and stays hidden once a create form opens from it", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
  assert.ok(inst.root.findByProps({ "aria-label": "New" }));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  assert.throws(() => inst.root.findByProps({ "aria-label": "New" }));
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
  assert.throws(() => inst.root.findByProps({ "aria-label": "New" }));
});

test("TournamentsScreen: the choice menu offers a head-to-head series too, and opens the series form", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  try {
    const inst = renderer.create(React.createElement(TournamentsScreen, baseProps()));
    act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
    act(() => { inst.root.findByProps({ "aria-label": "New head-to-head series" }).props.onClick(); });
    assert.match(JSON.stringify(inst.toJSON()), /New series/);
  } finally {
    delete globalThis.Modal;
  }
});

test("TournamentsScreen: the create form's Organizer picker only offers clubs/federations this account owns, not ones it's merely a member of", () => {
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    clubs: [
      { id: "c1", name: "Riverside CC", ownerUid: "owner1" },
      { id: "c2", name: "Oakwood CC", ownerUid: "someoneElse" }
    ],
    myFederations: [{ id: "f1", name: "DCF" }],
    currentUid: "owner1"
  })));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
  const organizerChoice = inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Organizer");
  const labels = organizerChoice.props.options.map(o => o.label);
  assert.ok(labels.includes("Riverside CC"), "an owned club is offered");
  assert.ok(labels.includes("DCF"), "an owned federation is offered");
  assert.ok(!labels.includes("Oakwood CC"), "a club this account is only a plain member of is not offered");
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
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New head-to-head series" }).props.onClick(); });

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

test("TournamentsScreen: picking a club as Organizer in the create form calls onSelectSource with that club's id", () => {
  let selected = "not called";
  const inst = renderer.create(React.createElement(TournamentsScreen, baseProps({
    clubs: [{ id: "c1", name: "Riverside CC", ownerUid: "owner1" }], onSelectSource: id => { selected = id; }
  })));
  act(() => { inst.root.findByProps({ "aria-label": "New" }).props.onClick(); });
  act(() => { inst.root.findByProps({ "aria-label": "New Tournament" }).props.onClick(); });
  const organizerChoice = inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Organizer");
  act(() => { organizerChoice.props.onChange("club:c1"); });
  assert.equal(selected, "c1");
});
