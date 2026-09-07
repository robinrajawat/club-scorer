// The full-list "See all" destination for the Home screen's Live now / Live tournaments preview
// strips (src/components/liveScreen.js): the unbounded /liveMatches + /liveTournaments feeds, each
// in its own section, plus the loading and empty states.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { LiveScreen } from "../../../src/components/liveScreen.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function liveMatch(overrides = {}) {
  return {
    id: "live1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "in-progress",
    oversLimit: 20, currentInningIndex: 0,
    innings: [{
      battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
      runs: 85, wickets: 3, legalBalls: 72, ballsPerOver: 6,
      battingOrder: ["Virat Kohli"], bowlingOrder: ["Jasprit Bumrah"]
    }],
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(LiveScreen, { ...props }));
}

test("LiveScreen: shows an empty state and neither section when both feeds are empty", () => {
  const inst = render();
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Nothing live right now/);
  assert.doesNotMatch(json, /Matches \(/);
  assert.doesNotMatch(json, /Tournaments \(/);
});

test("LiveScreen: shows a loading indicator instead of the empty state while loading and both feeds are still empty", () => {
  const inst = render({ loading: true });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Loading/);
  assert.doesNotMatch(json, /Nothing live right now/);
});

test("LiveScreen: shows real data instead of the loading indicator once at least one feed has something, even while still loading", () => {
  const inst = render({ loading: true, liveMatches: [liveMatch()] });
  const json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Loading…/);
  assert.match(json, /Riverside CC/);
});

test("LiveScreen: lists every live match (uncapped), with its score line and tournament badge, and opens it on tap", () => {
  let openedId = null;
  const matches = [1, 2, 3, 4, 5].map(n => liveMatch({ id: `live${n}`, teamA: `Team ${n}` }));
  matches[0].tournamentId = "t1";
  const inst = render({
    liveMatches: matches,
    onOpenLiveMatch: id => { openedId = id; },
    tournamentNameById: { t1: "Summer Cup" }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Matches \(5\)/);
  assert.match(json, /Team 1/);
  assert.match(json, /Team 5/);
  assert.match(json, /Summer Cup/);
  assert.match(json, /85-3/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Team 5"));
  act(() => { card.props.onClick(); });
  assert.equal(openedId, "live5");
});

test("LiveScreen: a match's tournament badge falls back to liveTournaments' name when it's not this account's own", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    liveTournaments: [{ tournamentId: "t1", name: "Someone Else's Cup", shareCode: "ABC123", teamsCount: 4 }]
  });
  assert.match(JSON.stringify(inst.toJSON()), /Someone Else's Cup/);
});

test("LiveScreen: lists every live tournament (uncapped), with its team count, and opens it on tap", () => {
  let openedCode = null;
  const tournaments = [1, 2, 3, 4].map(n => ({ tournamentId: `t${n}`, name: `Cup ${n}`, shareCode: `CODE${n}`, teamsCount: n }));
  const inst = render({
    liveTournaments: tournaments,
    onOpenLiveTournament: code => { openedCode = code; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Tournaments \(4\)/);
  assert.match(json, /Cup 1/);
  assert.match(json, /Cup 4/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Cup 4"));
  act(() => { card.props.onClick(); });
  assert.equal(openedCode, "CODE4");
});

test("LiveScreen: no search box when there's genuinely nothing live, even once loading finishes", () => {
  const inst = render();
  assert.throws(() => inst.root.findByType("input"));
});

test("LiveScreen: search filters matches by team name and tournaments by name, case-insensitively", () => {
  const matches = [liveMatch({ id: "live1", teamA: "Riverside CC", teamB: "Oakwood CC" }), liveMatch({ id: "live2", teamA: "Thunder XI", teamB: "Lions CC" })];
  const tournaments = [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 4 }, { tournamentId: "t2", name: "Winter League", shareCode: "CODE2", teamsCount: 6 }];
  const inst = render({ liveMatches: matches, liveTournaments: tournaments });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "riverside" } }); });
  let json = JSON.stringify(inst.toJSON());
  assert.match(json, /Matches \(1\)/);
  assert.doesNotMatch(json, /Thunder XI/);
  assert.doesNotMatch(json, /Tournaments \(/);

  act(() => { search.props.onChange({ target: { value: "winter" } }); });
  json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Matches \(/);
  assert.match(json, /Tournaments \(1\)/);
  assert.match(json, /Winter League/);
});

test("LiveScreen: a match also matches by its tournament badge name", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    tournamentNameById: { t1: "Summer Cup" }
  });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "summer" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Matches \(1\)/);
});

test("LiveScreen: shows a 'nothing matches' state (distinct from 'Nothing live right now') when a search has no results, and Clear resets it", () => {
  const inst = render({ liveMatches: [liveMatch()] });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "nonexistent team" } }); });
  let json = JSON.stringify(inst.toJSON());
  assert.match(json, /Nothing matches/);
  assert.doesNotMatch(json, /Nothing live right now/);

  const clearBtn = inst.root.findByProps({ "aria-label": "Clear search" });
  act(() => { clearBtn.props.onClick(); });
  json = JSON.stringify(inst.toJSON());
  assert.match(json, /Riverside CC/);
  assert.doesNotMatch(json, /Nothing matches/);
});
