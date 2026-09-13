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

test("LiveScreen: shows an empty state and no sections at all when both feeds are empty", () => {
  const inst = render();
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Nothing live right now/);
  assert.doesNotMatch(json, /Live Matches/);
  assert.doesNotMatch(json, /Live Tournaments/);
  assert.doesNotMatch(json, /Recently Finished/);
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
  assert.match(json, /Live Matches \(5\)/);
  assert.match(json, /Team 1/);
  assert.match(json, /Team 5/);
  assert.match(json, /Summer Cup/);
  assert.match(json, /85-3/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Team 5"));
  act(() => { card.props.onClick(); });
  assert.equal(openedId, "live5");
});

// Requested live: "we need to reduce friction... as a user to find the completed tournaments/
// matches" -- a viewer looking for how a just-finished match ended used to have to scan the exact
// same recency-sorted list as someone checking what's live right now. /liveMatches retains a
// completed match for a few days after it ends (see loadLiveMatches's own comment), so this was
// always reachable data, just not split out from the live ones.
test("LiveScreen: splits matches into Live and Recently Finished, by each match's own status", () => {
  const inst = render({
    liveMatches: [
      liveMatch({ id: "live1", teamA: "Riverside CC" }),
      liveMatch({
        id: "done1", teamA: "Hawks CC", teamB: "Eagles CC", status: "complete",
        innings: [
          { battingTeam: "Hawks CC", bowlingTeam: "Eagles CC", runs: 150, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10, battingOrder: ["P1"], bowlingOrder: ["P2"] },
          { battingTeam: "Eagles CC", bowlingTeam: "Hawks CC", runs: 100, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10, battingOrder: ["P2"], bowlingOrder: ["P1"] }
        ]
      })
    ]
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live Matches \(1\)/);
  assert.match(json, /Recently Finished Matches \(1\)/);
  const liveIdx = json.indexOf("Live Matches");
  const riversideIdx = json.indexOf("Riverside CC");
  const finishedIdx = json.indexOf("Recently Finished Matches");
  const hawksIdx = json.indexOf("Hawks CC");
  assert.ok(liveIdx < riversideIdx && riversideIdx < finishedIdx, "the live match renders under the Live Matches section, not Recently Finished");
  assert.ok(finishedIdx < hawksIdx, "the finished match renders under Recently Finished, not Live");
  assert.match(json, /Hawks CC won by 50 runs/, "a finished match shows its result, not a live score line");
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
  assert.match(json, /Live Tournaments \(4\)/);
  assert.match(json, /Cup 1/);
  assert.match(json, /Cup 4/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Cup 4"));
  act(() => { card.props.onClick(); });
  assert.equal(openedCode, "CODE4");
});

// Same split as matches, keyed off `champion` (null until the tournament has a decided result --
// see formatTournamentViewSnapshot in appLogic.js, mirrored onto this same /liveTournaments doc by
// shareTournament/refreshTournamentStandingsLive) since a tournament has no single status field of
// its own the way a match does. A finished tournament shows who won right on the row instead of
// the team count, so a viewer gets that answer without tapping in.
test("LiveScreen: splits tournaments into Live and Recently Finished, by whether a champion is decided, showing the winner on a finished row", () => {
  const inst = render({
    liveTournaments: [
      { tournamentId: "t1", name: "Ongoing Cup", shareCode: "CODE1", teamsCount: 4, champion: null },
      { tournamentId: "t2", name: "Summer Cup", shareCode: "CODE2", teamsCount: 6, champion: "Riverside CC" }
    ]
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live Tournaments \(1\)/);
  assert.match(json, /Recently Finished Tournaments \(1\)/);
  assert.match(json, /4 teams/, "the ongoing tournament still shows its team count");
  // Rendered as separate text nodes ("Riverside CC", " won"), so checked separately rather than as
  // one contiguous string across a JSON.stringify array boundary.
  assert.match(json, /Riverside CC/, "the finished tournament shows who won instead");
  assert.match(json, / won/);
  assert.doesNotMatch(json, /6 teams/, "the finished tournament's row no longer shows a team count");
  const liveIdx = json.indexOf("Live Tournaments");
  const ongoingIdx = json.indexOf("Ongoing Cup");
  const finishedIdx = json.indexOf("Recently Finished Tournaments");
  const summerIdx = json.indexOf("Summer Cup");
  assert.ok(liveIdx < ongoingIdx && ongoingIdx < finishedIdx, "the ongoing tournament renders under Live Tournaments");
  assert.ok(finishedIdx < summerIdx, "the finished tournament renders under Recently Finished");
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
  assert.match(json, /Live Matches \(1\)/);
  assert.doesNotMatch(json, /Thunder XI/);
  assert.doesNotMatch(json, /Live Tournaments/);

  act(() => { search.props.onChange({ target: { value: "winter" } }); });
  json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Live Matches/);
  assert.match(json, /Live Tournaments \(1\)/);
  assert.match(json, /Winter League/);
});

test("LiveScreen: a match also matches by its tournament badge name", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    tournamentNameById: { t1: "Summer Cup" }
  });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "summer" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Live Matches \(1\)/);
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
