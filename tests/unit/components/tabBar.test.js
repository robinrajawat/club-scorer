// The persistent bottom tab bar (src/components/tabBar.js) shown on the five root screens (Home,
// Live, Cups, Teams, Clubs) -- see TAB_BAR_SCREENS in cricketScorer.js for which screens show it.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TabBar, TABS } from "../../../src/components/tabBar.js";

function render(props) {
  return renderer.create(React.createElement(TabBar, props));
}

test("TabBar: renders all five tabs with their labels", () => {
  const inst = render({ active: "home", onSelect: () => {} });
  const json = JSON.stringify(inst.toJSON());
  for (const { label } of TABS) {
    assert.match(json, new RegExp(label));
  }
});

test("TabBar: marks the active tab's button with aria-current, others without it", () => {
  const inst = render({ active: "tournaments", onSelect: () => {} });
  const buttons = inst.root.findAllByType("button");
  assert.equal(buttons.length, TABS.length);
  const activeButtons = buttons.filter(b => b.props["aria-current"] === "page");
  assert.equal(activeButtons.length, 1);
  assert.equal(activeButtons[0].props["aria-label"], "Cups");
});

test("TabBar: tapping a tab calls onSelect with that tab's screen key", () => {
  let selected = null;
  const inst = render({ active: "home", onSelect: s => { selected = s; } });
  const teamsButton = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Teams");
  act(() => { teamsButton.props.onClick(); });
  assert.equal(selected, "my-teams");
});

test("TabBar: 'Clubs' tab maps to the \"teams\" screen key (TeamsScreen, not MyTeamsScreen)", () => {
  let selected = null;
  const inst = render({ active: "home", onSelect: s => { selected = s; } });
  const clubsButton = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Clubs");
  act(() => { clubsButton.props.onClick(); });
  assert.equal(selected, "teams");
});
