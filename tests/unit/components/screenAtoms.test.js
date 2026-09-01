// Small presentational components used across setup/list screens (src/components/screenAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { Field, InstallHintBanner, ClubSourceSelector } from "../../../src/components/screenAtoms.js";

test("Field: renders the label above its children", () => {
  const tree = renderer.create(React.createElement(Field, { label: "Team name" }, "content")).toJSON();
  assert.equal(tree.children[0].children[0], "Team name");
  assert.equal(tree.children[1], "content");
});

test("InstallHintBanner: calls onDismiss when the close button is clicked", () => {
  let dismissed = false;
  const root = renderer.create(React.createElement(InstallHintBanner, { onDismiss: () => { dismissed = true; } })).root;
  root.findByProps({ "aria-label": "Dismiss" }).props.onClick();
  assert.equal(dismissed, true);
});

test("ClubSourceSelector: 'My Teams' plus one chip per club, selects null for My Teams", () => {
  let selected = "not called";
  const clubs = [{ id: "c1", name: "Eagles CC" }, { id: "c2", name: "Hawks CC" }];
  const root = renderer.create(React.createElement(ClubSourceSelector, {
    clubs, activeClubId: "c1", onSelect: id => { selected = id; }, onTogglePinClub: () => {}
  })).root;
  const buttons = root.findAllByType("button");
  assert.equal(buttons.length, 3); // My Teams + 2 club chips
  buttons[0].props.onClick();
  assert.equal(selected, null);
});

test("ClubSourceSelector: pinned clubs sort first (via withPinnedFirst)", () => {
  const clubs = [{ id: "c1", name: "Eagles CC" }, { id: "c2", name: "Hawks CC" }];
  const inst = renderer.create(React.createElement(ClubSourceSelector, {
    clubs, activeClubId: null, pinnedClubIds: ["c2"], onSelect: () => {}, onTogglePinClub: () => {}
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.ok(text.indexOf("Hawks CC") < text.indexOf("Eagles CC"), "pinned Hawks CC should render before Eagles CC");
});
