// The full-list "See all" destination for the Home screen's Live now / Live tournaments preview
// strips (src/components/liveScreen.js): the unbounded /liveMatches + /liveTournaments feeds, each
// in its own section, plus the empty state and the back button.

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
