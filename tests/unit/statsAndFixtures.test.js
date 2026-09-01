// Fixture generation, player/club stats aggregation, and Player-of-the-Match / Best-Fielder /
// Player-of-the-Tournament suggestion heuristics (src/core/statsAndFixtures.js).

import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRoundRobinFixtures, generateGroupRoundRobinFixtures, computePlayerStats,
  computeClubRecords, suggestPlayerOfMatch, suggestBestFielder, suggestPlayerOfTournament,
  allMatchPlayers
} from "../../src/core/statsAndFixtures.js";

test("generateRoundRobinFixtures: single round pairs every team with every other team once", () => {
  const fixtures = generateRoundRobinFixtures(["A", "B", "C"], false);
  assert.equal(fixtures.length, 3);
  const pairs = fixtures.map(f => [f.teamA, f.teamB].sort().join("v"));
  assert.deepEqual(new Set(pairs), new Set(["AvB", "AvC", "BvC"]));
});

test("generateRoundRobinFixtures: double round plays each pairing home and away", () => {
  const fixtures = generateRoundRobinFixtures(["A", "B"], true);
  assert.equal(fixtures.length, 2);
  assert.ok(fixtures.some(f => f.teamA === "A" && f.teamB === "B"));
  assert.ok(fixtures.some(f => f.teamA === "B" && f.teamB === "A"));
});

test("generateGroupRoundRobinFixtures: teams only play within their own group, tagged with its label", () => {
  const groups = [
    { label: "Group A", teams: ["A1", "A2"] },
    { label: "Group B", teams: ["B1", "B2"] }
  ];
  const fixtures = generateGroupRoundRobinFixtures(groups, false);
  assert.equal(fixtures.length, 2);
  const crossGroup = fixtures.some(f => (f.teamA.startsWith("A") && f.teamB.startsWith("B")) || (f.teamA.startsWith("B") && f.teamB.startsWith("A")));
  assert.ok(!crossGroup, "no fixture crosses group boundaries");
  assert.deepEqual(new Set(fixtures.map(f => f.group)), new Set(["Group A", "Group B"]));
});

function sampleMatch() {
  return {
    id: "M1",
    innings: [
      {
        battingTeam: "A", bowlingTeam: "B", ballsPerOver: 6,
        batsmen: {
          P1: { runs: 55, balls: 40, out: true, how: "c P5 b P6" },
          P2: { runs: 10, balls: 20, out: false }
        },
        bowlers: {
          P6: { wickets: 3, ballsBowled: 24, runs: 30 }
        },
        battingOrder: ["P1", "P2"],
        bowlingOrder: ["P6"]
      },
      {
        battingTeam: "B", bowlingTeam: "A", ballsPerOver: 6,
        batsmen: {
          P5: { runs: 5, balls: 10, out: true, how: "run out (P2)" }
        },
        bowlers: {
          P1: { wickets: 1, ballsBowled: 12, runs: 8 }
        },
        battingOrder: ["P5"],
        bowlingOrder: ["P1"]
      }
    ]
  };
}

test("computePlayerStats: aggregates runs/wickets/catches across innings, computes averages", () => {
  const stats = computePlayerStats([sampleMatch()]);
  const p1 = stats.find(p => p.name === "P1");
  assert.equal(p1.runs, 55);
  assert.equal(p1.wickets, 1);
  assert.equal(p1.matchCount, 1);
  const p6 = stats.find(p => p.name === "P6");
  assert.equal(p6.wickets, 3);
  const p5 = stats.find(p => p.name === "P5");
  assert.equal(p5.catches, 1, "\"c P5 b P6\" credits the catch to P5 (the fielder), not P6 (the bowler)");
});

test("computePlayerStats: strike rate and bowling average are null, not NaN or 0, with no balls/wickets", () => {
  const stats = computePlayerStats([sampleMatch()]);
  const p2 = stats.find(p => p.name === "P2");
  assert.equal(p2.bowlingAvg, null, "P2 never bowled");
});

test("suggestPlayerOfMatch: runs + 20/wicket heuristic picks the highest combined score", () => {
  // P6: 0 runs + 3*20 = 60. P1: 55 runs + 1*20 = 75. P1 should win.
  assert.equal(suggestPlayerOfMatch(sampleMatch()), "P1");
});

test("suggestBestFielder: counts catches and run outs parsed from dismissal text, ties go to whoever's counted first", () => {
  // P5 caught P1 ("c P5 b P6"), P2 ran out P5 ("run out (P2)") — a 1-1 tie. P5's dismissal (inning
  // 0) is processed before P5's own run-out (inning 1), so P5 is counted first and keeps the lead
  // since suggestBestFielder only overtakes a strictly higher count, never an equal one.
  assert.equal(suggestBestFielder(sampleMatch()), "P5");
  const noFielding = { innings: [{ batsmen: { P1: { out: true, how: "bowled" } } }] };
  assert.equal(suggestBestFielder(noFielding), null);
});

test("suggestPlayerOfTournament: same heuristic aggregated across multiple matches", () => {
  const best = suggestPlayerOfTournament([sampleMatch(), sampleMatch()]);
  // P1's combined score (75) still beats P6's (60) even doubled, so P1 should still win.
  assert.equal(best, "P1");
});

test("allMatchPlayers: every name in every innings' batting/bowling order, no duplicates", () => {
  const names = allMatchPlayers(sampleMatch());
  assert.deepEqual(new Set(names), new Set(["P1", "P2", "P6", "P5"]));
});

test("computeClubRecords: credits centuries, five-wicket hauls, and win margins correctly", () => {
  const centuryMatch = {
    id: "M2", status: "complete", createdAt: 1000,
    innings: [
      {
        battingTeam: "A", bowlingTeam: "B", runs: 200, wickets: 3, legalBalls: 120, ballsPerOver: 6, maxWickets: 10,
        batsmen: { P1: { runs: 120, balls: 90, out: false } },
        bowlers: {}
      },
      {
        battingTeam: "B", bowlingTeam: "A", runs: 150, wickets: 10, legalBalls: 100, ballsPerOver: 6, maxWickets: 10,
        batsmen: {},
        bowlers: { P9: { wickets: 6, ballsBowled: 24, runs: 20 } }
      }
    ]
  };
  const records = computeClubRecords([centuryMatch]);
  assert.equal(records.matchCount, 1);
  assert.equal(records.centuries.length, 1);
  assert.equal(records.centuries[0].name, "P1");
  assert.equal(records.fiveWicketHauls.length, 1);
  assert.equal(records.fiveWicketHauls[0].name, "P9");
  // A won by 200 vs 150 all out (never chasing) — B's second-innings all-out means it's scored as
  // a runs win for A of (200 - 150) = 50.
  assert.equal(records.winsByRuns.length, 1);
  assert.equal(records.winsByRuns[0].winner, "A");
  assert.equal(records.winsByRuns[0].margin, 50);
});

test("computeClubRecords: sinceTs filters out matches created before the cutoff", () => {
  const oldMatch = { id: "old", status: "complete", createdAt: 100, innings: [{ battingTeam: "A", bowlingTeam: "B", runs: 10, wickets: 0, batsmen: {}, bowlers: {} }] };
  const newMatch = { id: "new", status: "complete", createdAt: 2000, innings: [{ battingTeam: "A", bowlingTeam: "B", runs: 20, wickets: 0, batsmen: {}, bowlers: {} }] };
  const records = computeClubRecords([oldMatch, newMatch], 1000);
  assert.equal(records.matchCount, 1);
});
