// Deterministic match-recap builder (src/core/matchRecap.js). Covers: the normal two-innings case
// with a top scorer and a standout bowling figure, a bowling milestone (five-for) getting folded
// in, and the "not actually finished" cases (matchResultText's own null contract) not producing a
// half-built recap.

import test from "node:test";
import assert from "node:assert/strict";
import { buildMatchRecapDraft } from "../../src/core/matchRecap.js";

function inning(overrides) {
  return {
    battingTeam: "A", bowlingTeam: "B", runs: 0, wickets: 0, legalBalls: 0, ballsPerOver: 6, maxWickets: 10,
    batsmen: {}, bowlers: {}, milestones: [],
    ...overrides
  };
}

test("buildMatchRecapDraft: two-innings win, names the top scorer, best bowler, and Player of the Match", () => {
  const match = {
    id: "M1", status: "complete", oversLimit: 20,
    innings: [
      inning({
        battingTeam: "Billund", bowlingTeam: "Kolding", runs: 150, wickets: 6, legalBalls: 120,
        batsmen: { "R. Singh": { runs: 87, balls: 42, out: false }, "P. Sharma": { runs: 20, balls: 15, out: true } },
        bowlers: { "K. Bowler": { wickets: 3, runs: 28, ballsBowled: 24 } }
      }),
      inning({
        battingTeam: "Kolding", bowlingTeam: "Billund", runs: 130, wickets: 10, legalBalls: 114,
        batsmen: { "M. Jensen": { runs: 45, balls: 30, out: true } },
        bowlers: { "A. Bowler": { wickets: 4, runs: 22, ballsBowled: 24 } }
      })
    ]
  };
  const recap = buildMatchRecapDraft(match);
  assert.ok(recap.includes("Billund made 150/6"));
  assert.ok(recap.includes("R. Singh's 87 (42)"));
  assert.ok(recap.includes("Kolding made 130/10"));
  assert.ok(recap.includes("A. Bowler took 4/22 for Billund"));
  assert.ok(recap.includes("Billund won by 20 runs"));
  assert.ok(recap.includes("R. Singh was named Player of the Match"));
});

test("buildMatchRecapDraft: folds a five-wicket-haul milestone into the recap", () => {
  const match = {
    id: "M2", status: "complete", oversLimit: 20,
    innings: [
      inning({ battingTeam: "A", bowlingTeam: "B", runs: 90, wickets: 10, legalBalls: 100 }),
      inning({
        battingTeam: "B", bowlingTeam: "A", runs: 91, wickets: 3, legalBalls: 80,
        milestones: [{ type: "fiveFor", text: "S. Khan takes a 5-wicket haul", over: "13.2", score: "70-3" }]
      })
    ]
  };
  const recap = buildMatchRecapDraft(match);
  assert.ok(recap.includes("S. Khan takes a 5-wicket haul."));
});

test("buildMatchRecapDraft: returns null for a match that isn't actually finished", () => {
  assert.equal(buildMatchRecapDraft({ status: "live", innings: [] }), null);
  assert.equal(buildMatchRecapDraft({ status: "complete", innings: [inning({})] }), null); // no second innings yet
});
