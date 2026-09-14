// "Teams" screen (src/components/myTeamsScreen.js). Every write action is a prop, not a bare
// global, so this needs no Firestore stubbing. Every team is just the account's own now -- no club
// wrapper, no per-team "poll availability" action, no owner/member permission split (see
// docs/simplification-plan.md).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { MyTeamsScreen } from "../../../src/components/myTeamsScreen.js";
import { SwipeableRow } from "../../../src/components/scoringUiAtoms.js";
import { Shield } from "../../../src/components/icons.js";

function team(overrides = {}) {
  return { id: "t1", name: "Riverside 1st XI", players: [], ...overrides };
}

test("MyTeamsScreen: lists teams, wires onEditTeam/onDeleteTeam/onNewTeam", () => {
  let edited = null;
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {},
    onEditTeam: t => { edited = t; }, onDeleteTeam: () => {}
  }));
  assert.match(JSON.stringify(inst.toJSON()), /Riverside 1st XI/);
  const editBtn = inst.root.findByProps({ "aria-label": `Edit ${teams[0].name}` });
  editBtn.props.onClick();
  assert.equal(edited.id, "t1");
});

test("MyTeamsScreen: deleting goes through SwipeableRow's onDelete, calling onDeleteTeam", () => {
  let deletedId = null, deletedClubId = "unset";
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {},
    onDeleteTeam: (id, clubId) => { deletedId = id; deletedClubId = clubId; }
  }));
  const row = inst.root.findByType(SwipeableRow);
  row.props.onDelete();
  assert.equal(deletedId, "t1");
  assert.equal(deletedClubId, null);
});

test("MyTeamsScreen: a team row shows captain/vice-captain/keeper pills when set, nothing extra when not", () => {
  // Same live-tree read as TeamEditScreen's own summary-card test: a span's text can be split
  // across several children (e.g. "C", " · ", name), which .join("") reassembles faithfully,
  // unlike JSON.stringify(toJSON()) which comma-separates them into unmatchable fragments.
  function pillText(inst) {
    return inst.root.findAllByType("span")
      .filter(s => s.props.style && s.props.style.borderRadius === 10 && s.props.style.padding === "2px 7px")
      .map(s => [].concat(s.props.children).join(""));
  }
  const plain = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  assert.equal(pillText(plain).length, 0);

  const tagged = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team({ captain: "A. Sharma", viceCaptain: "B. Kumar", keeper: "C. Patel" })],
    matches: [], onNewTeam: () => {}
  }));
  const text = pillText(tagged);
  assert.ok(text.includes("C · A. Sharma"));
  assert.ok(text.includes("VC · B. Kumar"));
  assert.ok(text.includes("WK · C. Patel"));
});

test("MyTeamsScreen: a team's jersey color shows as a shield crest next to its name; no shield when unset", () => {
  const withColor = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team({ color: "#1b3a6b" })], matches: [], onNewTeam: () => {}
  }));
  const shield = withColor.root.findByType(Shield);
  assert.equal(shield.props.style.fill, "#1b3a6b");

  const noColor = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  assert.throws(() => noColor.root.findByType(Shield));
});

test("MyTeamsScreen: shows a loading state while teamsLoading is true, without crashing", () => {
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [], teamsLoading: true, matches: [], onBack: () => {}, onNewTeam: () => {}
  }));
  assert.doesNotThrow(() => inst.toJSON());
});

test("MyTeamsScreen: shows a Back button only when onBack is given (a drill-in from Home), none when it's the Teams tab itself", () => {
  let backCalled = false;
  const withBack = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onBack: () => { backCalled = true; }, onNewTeam: () => {}
  }));
  const backBtn = withBack.root.findByProps({ "aria-label": "Back" });
  backBtn.props.onClick();
  assert.equal(backCalled, true);

  const asTab = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  assert.throws(() => asTab.root.findByProps({ "aria-label": "Back" }));
});

test("MyTeamsScreen: every team is editable -- no owner/member permission split any more", () => {
  const teams = [team({ id: "t2", name: "Seconds" })];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {}, onEditTeam: () => {}
  }));
  assert.ok(inst.root.findByProps({ "aria-label": `Edit ${teams[0].name}` }));
});
