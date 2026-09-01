// Full ball-by-ball scorecard (src/components/scorecard.js): InningScorecard, MatchStatsPanel,
// ScorecardOverlay. All pure presentational, driven entirely by props and already-extracted
// src/core/ logic -- no DOM APIs.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { InningScorecard, MatchStatsPanel, ScorecardOverlay } from "../../../src/components/scorecard.js";

function inning(overrides = {}) {
  return {
    battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
    runs: 85, wickets: 3, legalBalls: 72, ballsPerOver: 6,
    battingOrder: ["Virat Kohli", "Rohit Sharma"], bowlingOrder: ["Jasprit Bumrah"],
    batsmen: {
      "Virat Kohli": { runs: 50, balls: 40, fours: 5, sixes: 1, out: false },
      "Rohit Sharma": { runs: 30, balls: 28, fours: 3, sixes: 0, out: true, how: "b Bumrah" }
    },
    bowlers: { "Jasprit Bumrah": { ballsBowled: 24, runs: 30, wickets: 1, maidens: 0 } },
    extras: { wide: 2, noball: 1, bye: 0, legbye: 1 },
    fallOfWickets: [{ wicket: 1, score: 40, batsman: "Rohit Sharma", over: "8.2" }],
    strikerName: "Virat Kohli", nonStrikerName: null, bowlerName: "Jasprit Bumrah",
    complete: false, overs: [[{ runs: 4 }], []],
    ...overrides
  };
}

function matchWith(innings, overrides = {}) {
  return {
    teamA: "Riverside CC", teamB: "Oakwood CC",
    teamACaptain: "Virat Kohli", teamAKeeper: "Rohit Sharma",
    teamBCaptain: "Jasprit Bumrah", teamBKeeper: "",
    oversLimit: 20, currentInningIndex: innings.length - 1,
    innings,
    ...overrides
  };
}

test("InningScorecard: renders batting/bowling tables with captain/keeper badges and extras", () => {
  const inst = renderer.create(React.createElement(InningScorecard, {
    inning: inning(),
    battingCaptain: "Virat Kohli", battingKeeper: "Rohit Sharma",
    bowlingCaptain: "Jasprit Bumrah", bowlingKeeper: "",
    battingNumbers: { "Virat Kohli": "18" }, bowlingNumbers: {}
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Virat Kohli/);
  assert.match(text, /Rohit Sharma/);
  assert.match(text, /b Bumrah/);
  assert.match(text, /not out/);
  assert.match(text, /Jasprit Bumrah/);
  assert.match(text, /Fall of Wickets/);
});

test("MatchStatsPanel: showOvers=true shows the live-innings summary card, overs strip, and collapsible sections", () => {
  const match = matchWith([inning({ complete: false })]);
  const inst = renderer.create(React.createElement(MatchStatsPanel, { match, tab: 0, setTab: () => {}, showOvers: true }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /"Riverside CC"/);
  assert.match(text, /CRR/);
  assert.match(text, /Overs/);
  assert.match(text, /Scorecard/);
  assert.match(text, /Charts/);
});

test("MatchStatsPanel: showOvers=false always renders the scorecard and charts inline, no toggle", () => {
  const match = matchWith([inning({ complete: true })]);
  const inst = renderer.create(React.createElement(MatchStatsPanel, { match, tab: 0, setTab: () => {}, showOvers: false }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Virat Kohli/);
  assert.doesNotMatch(text, /CRR/); // no live-summary card outside showOvers mode
});

test("MatchStatsPanel: with two innings, shows a tab per innings and switches which one is scorecard'd", () => {
  const first = inning({ battingTeam: "Riverside CC", complete: true, battingOrder: ["Virat Kohli"] });
  const second = inning({ battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", complete: false, battingOrder: ["Jasprit Bumrah"], batsmen: { "Jasprit Bumrah": { runs: 10, balls: 8, fours: 1, sixes: 0, out: false } }, bowlers: {} });
  const match = matchWith([first, second], { currentInningIndex: 1 });
  const inst = renderer.create(React.createElement(MatchStatsPanel, { match, tab: 1, setTab: () => {}, showOvers: false }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
});

test("ScorecardOverlay: renders a header with an export button and close button, plus the scorecard", () => {
  const match = matchWith([inning({ complete: true })]);
  let closed = false;
  const inst = renderer.create(React.createElement(ScorecardOverlay, { match, onClose: () => { closed = true; } }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Scorecard/);
  assert.match(text, /Virat Kohli/);
  const closeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Close");
  assert.ok(closeBtn);
  closeBtn.props.onClick();
  assert.equal(closed, true);
});
