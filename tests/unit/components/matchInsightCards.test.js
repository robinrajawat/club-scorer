// Post-match insight cards/charts (src/components/matchInsightCards.js). All pure presentational
// components driven entirely by their props -- no ambient globals or DOM APIs needed, except
// PlayerOfMatchCard/BestFielderCard's pick() handler, which calls the not-yet-extracted `saveMatch`
// (a Firestore write) -- stubbed on globalThis only in the tests that actually click "Confirm".

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import {
  RunRateChart, RunsPerOverChart, SyncConflictModal, PlayerOfMatchCard, BestFielderCard
} from "../../../src/components/matchInsightCards.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

function inningsWith(overs, battingTeam, ballsPerOver = 6, fallOfWickets = []) {
  return { battingTeam, ballsPerOver, fallOfWickets, overs };
}

test("RunRateChart: renders nothing when no balls have been bowled in any innings", () => {
  const match = { oversLimit: 20, innings: [inningsWith([[], []], "A")] };
  const tree = renderer.create(React.createElement(RunRateChart, { match })).toJSON();
  assert.equal(tree, null);
});

test("RunRateChart: renders an SVG line chart once an innings has runs on the board", () => {
  const match = {
    oversLimit: 20,
    innings: [inningsWith([[{ runs: 4 }, { runs: 1 }], [{ runs: 6 }]], "A")]
  };
  const inst = renderer.create(React.createElement(RunRateChart, { match }));
  const svg = inst.root.findByProps({ viewBox: "0 0 300 130" });
  assert.ok(svg);
  const polylines = inst.root.findAllByType("polyline");
  assert.equal(polylines.length, 1);
});

test("RunsPerOverChart: renders nothing with no balls bowled, an SVG once there are", () => {
  const emptyMatch = { oversLimit: 20, innings: [inningsWith([[]], "A")] };
  assert.equal(renderer.create(React.createElement(RunsPerOverChart, { match: emptyMatch })).toJSON(), null);

  const match = { oversLimit: 20, innings: [inningsWith([[{ runs: 4 }]], "A")] };
  const inst = renderer.create(React.createElement(RunsPerOverChart, { match }));
  assert.ok(inst.root.findAllByType("svg").length >= 1);
});

test("SyncConflictModal: shows both devices' scores and wires Keep/Use buttons to their callbacks", () => {
  const local = { currentInningIndex: 0, innings: [{ runs: 120, wickets: 3, legalBalls: 90, ballsPerOver: 6 }] };
  const remote = { currentInningIndex: 0, innings: [{ runs: 125, wickets: 4, legalBalls: 92, ballsPerOver: 6 }] };
  let kept = false, used = false;
  const inst = renderer.create(React.createElement(SyncConflictModal, {
    local, remote,
    onKeepMine: () => { kept = true; },
    onUseTheirs: () => { used = true; }
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /120/);
  assert.match(text, /125/);
  const buttons = inst.root.findAllByType(Btn);
  assert.equal(buttons.length, 2);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.equal(kept, true);
  assert.equal(used, true);
});

test("PlayerOfMatchCard: shows the current pick, or a suggestion with Confirm/Pick-someone-else", () => {
  const withPick = { playerOfMatch: "MS Dhoni", innings: [] };
  const treeWithPick = JSON.stringify(renderer.create(React.createElement(PlayerOfMatchCard, { match: withPick, setMatch: () => {} })).toJSON());
  assert.match(treeWithPick, /MS Dhoni/);

  const match = {
    playerOfMatch: null,
    innings: [{
      battingTeam: "A", ballsPerOver: 6,
      battingOrder: ["Virat Kohli"], bowlingOrder: [],
      batsmen: { "Virat Kohli": { runs: 80 } }, bowlers: {}
    }]
  };
  const inst = renderer.create(React.createElement(PlayerOfMatchCard, { match, setMatch: () => {} }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Suggested, by runs \+ wickets/);
  assert.match(text, /Virat Kohli/);
});

test("PlayerOfMatchCard: clicking Confirm calls the (stubbed) saveMatch and setMatch", () => {
  const match = {
    playerOfMatch: null,
    innings: [{
      battingTeam: "A", ballsPerOver: 6,
      battingOrder: ["Virat Kohli"], bowlingOrder: [],
      batsmen: { "Virat Kohli": { runs: 80 } }, bowlers: {}
    }]
  };
  let savedWith = null;
  globalThis.saveMatch = m => { savedWith = m; return Promise.resolve({ ok: true, writeSeq: null }); };
  try {
    let setTo = null;
    const inst = renderer.create(React.createElement(PlayerOfMatchCard, { match, setMatch: m => { setTo = m; } }));
    // Confirm is the first Btn whenever a suggestion exists (see the component's own JSX order).
    const [confirmBtn] = inst.root.findAllByType(Btn);
    confirmBtn.props.onClick();
    assert.equal(setTo.playerOfMatch, "Virat Kohli");
    assert.equal(savedWith.playerOfMatch, "Virat Kohli");
  } finally {
    delete globalThis.saveMatch;
  }
});

test("BestFielderCard: shows the current pick, or a suggestion with Confirm/Pick-someone-else", () => {
  const withPick = { bestFielder: "Jonty Rhodes", innings: [] };
  const treeWithPick = JSON.stringify(renderer.create(React.createElement(BestFielderCard, { match: withPick, setMatch: () => {} })).toJSON());
  assert.match(treeWithPick, /Jonty Rhodes/);

  const match = {
    bestFielder: null,
    innings: [{
      battingTeam: "A", ballsPerOver: 6,
      battingOrder: ["Virat Kohli"], bowlingOrder: [],
      batsmen: { "Virat Kohli": { out: true, how: "c Ravindra Jadeja b Bumrah" } }
    }]
  };
  const inst = renderer.create(React.createElement(BestFielderCard, { match, setMatch: () => {} }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Suggested, by catches \+ run outs/);
});
