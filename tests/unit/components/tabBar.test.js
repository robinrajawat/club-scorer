// The persistent bottom tab bar (src/components/tabBar.js) shown on the four root screens (Home,
// Live, Cups, Teams) -- see TAB_BAR_SCREENS in cricketScorer.js for which screens show it.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TabBar, TABS, TAB_BAR_SAFE_BOTTOM } from "../../../src/components/tabBar.js";

function render(props) {
  return renderer.create(React.createElement(TabBar, props));
}

// Reported live: the pill "looks good when I am using PWA otherwise it touches the browser's
// search bar" -- a plain browser tab reports 0 for env(safe-area-inset-bottom), which used to put
// the pill flush against the real bottom edge. See TAB_BAR_SAFE_BOTTOM's own comment.
test("TabBar: floats at least 12px clear of the bottom edge even with no safe-area inset (plain browser tab, not installed PWA)", () => {
  const inst = render({ active: "home", onSelect: () => {} });
  const nav = inst.root.findByType("nav");
  assert.equal(nav.props.style.bottom, `calc(0px + ${TAB_BAR_SAFE_BOTTOM})`);
  assert.equal(TAB_BAR_SAFE_BOTTOM, "max(env(safe-area-inset-bottom), 12px)");
});

test("TabBar: renders all four tabs with their labels", () => {
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
  const cupsButton = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Cups");
  act(() => { cupsButton.props.onClick(); });
  assert.equal(selected, "tournaments");
});

test("TabBar: 'Teams' tab maps to the \"teams\" screen key (MyTeamsScreen)", () => {
  let selected = null;
  const inst = render({ active: "home", onSelect: s => { selected = s; } });
  const teamsButton = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Teams");
  act(() => { teamsButton.props.onClick(); });
  assert.equal(selected, "teams");
});

test("TabBar: no badge on the Home tab when homeBadgeCount is 0/omitted", () => {
  const inst = render({ active: "live", onSelect: () => {} });
  const homeButton = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Home");
  assert.equal(homeButton.props["aria-label"], "Home");
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /pending/);
});

test("TabBar: shows a badge on the Home tab (and only Home) when homeBadgeCount is set, capped at '9+'", () => {
  const inst = render({ active: "live", onSelect: () => {}, homeBadgeCount: 12 });
  const homeButton = inst.root.findAllByType("button").find(b => b.props["aria-label"].startsWith("Home"));
  assert.equal(homeButton.props["aria-label"], "Home, 12 pending");
  const json = JSON.stringify(inst.toJSON());
  // Exactly one "9+" in the whole tree -- confirms the badge only ever renders once, on Home.
  assert.equal((json.match(/9\+/g) || []).length, 1);
});
