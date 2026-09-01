// "My Teams" screen (src/components/myTeamsScreen.js). Every write action is a prop, not a bare
// global, so this needs no Firestore stubbing. AvailabilityPollModal (used for "send poll") still
// references Modal as a bare global internally -- stubbed here only in the test that opens it.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { MyTeamsScreen } from "../../../src/components/myTeamsScreen.js";
import { SwipeableRow } from "../../../src/components/scoringUiAtoms.js";

function team(overrides = {}) {
  return { id: "t1", name: "Riverside 1st XI", players: [], ...overrides };
}

test("MyTeamsScreen: lists teams, wires onEditTeam/onDeleteTeam/onNewTeam", () => {
  let edited = null;
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {},
    onEditTeam: t => { edited = t; }, onDeleteTeam: () => {}, onMoveTeam: () => {}
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
    onDeleteTeam: (id, clubId) => { deletedId = id; deletedClubId = clubId; }, onMoveTeam: () => {}
  }));
  const row = inst.root.findByType(SwipeableRow);
  row.props.onDelete();
  assert.equal(deletedId, "t1");
  assert.equal(deletedClubId, null);
});

test("MyTeamsScreen: shows a loading state while teamsLoading is true, without crashing", () => {
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [], teamsLoading: true, matches: [], onBack: () => {}, onNewTeam: () => {}
  }));
  assert.doesNotThrow(() => inst.toJSON());
});

test("MyTeamsScreen: tags each team with its source once more than one club/personal source is present", () => {
  const clubs = [{ id: "c1", name: "Riverside CC" }];
  const teams = [
    team({ id: "t1", name: "Firsts" }),
    team({ id: "t2", name: "Seconds", _clubId: "c1" })
  ];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, clubs, matches: [], onBack: () => {}, onNewTeam: () => {}
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Personal/);
  assert.match(text, /Riverside CC/);
});

test("MyTeamsScreen: a club team is only editable by that club's owner", () => {
  const clubs = [{ id: "c1", name: "Riverside CC", ownerUid: "owner1" }];
  const teams = [team({ id: "t2", name: "Seconds", _clubId: "c1" })];
  const asOwner = renderer.create(React.createElement(MyTeamsScreen, {
    teams, clubs, matches: [], currentUid: "owner1", onBack: () => {}, onNewTeam: () => {}, onEditTeam: () => {}
  }));
  assert.ok(asOwner.root.findByProps({ "aria-label": `Edit ${teams[0].name}` }));

  const asMember = renderer.create(React.createElement(MyTeamsScreen, {
    teams, clubs, matches: [], currentUid: "someoneElse", onBack: () => {}, onNewTeam: () => {}, onEditTeam: () => {}
  }));
  assert.throws(() => asMember.root.findByProps({ "aria-label": `Edit ${teams[0].name}` }));
});

test("MyTeamsScreen: 'poll availability' opens AvailabilityPollModal for a club team", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  globalThis.loadTeamPolls = () => Promise.resolve([]);
  try {
    const clubs = [{ id: "c1", name: "Riverside CC", ownerUid: "owner1" }];
    const teams = [team({ id: "t2", name: "Seconds", _clubId: "c1" })];
    const inst = renderer.create(React.createElement(MyTeamsScreen, {
      teams, clubs, matches: [], currentUid: "owner1", onBack: () => {}, onNewTeam: () => {}
    }));
    const pollBtn = inst.root.findByProps({ "aria-label": `Poll availability for ${teams[0].name}` });
    await act(async () => {
      pollBtn.props.onClick();
      await new Promise(r => setTimeout(r, 0));
    });
    assert.match(JSON.stringify(inst.toJSON()), /Availability/);
  } finally {
    delete globalThis.Modal;
    delete globalThis.loadTeamPolls;
  }
});
