// End-to-end regression test for a full grouped tournament, modeled directly on the Billund Cricket
// Tournament flyer: 6 teams split into 2 groups of 3, a group-stage round robin (8 overs/innings,
// 8 players/side, so all out on the 7th wicket), top team from each group going straight to a
// Final with NO Semifinal. This exercises the real pipeline top to bottom — fixture generation
// (statsAndFixtures.js) -> ball-by-ball scoring (scoringEngine.js) -> group standings, knockout
// bracket shape, and champion resolution (appLogic.js) — rather than any one module in isolation,
// since a bug in how those pieces hand off to each other (e.g. a knockout match leaking into group
// standings, or the wrong pair reaching the Final) wouldn't show up in any single module's own
// unit tests.

import test from "node:test";
import assert from "node:assert/strict";
import { generateGroupRoundRobinFixtures } from "../../src/core/statsAndFixtures.js";
import { newInning, applyBall } from "../../src/core/scoringEngine.js";
import {
  computeStandings, computeGroupStandings, applicableKnockoutStages, crossGroupKnockoutPairs, matchWinner
} from "../../src/core/appLogic.js";

const RULES = { ballsPerOver: 6, wideRuns: 1, noballRuns: 1, freeHit: true, playersPerSide: 8 };
const OVERS_LIMIT = 8;
const MAX_WICKETS = 7; // 8 players/side -> all out on the 7th wicket, per DEFAULT_RULES.playersPerSide convention

// Plays out a full, wicketless innings of OVERS_LIMIT overs, scoring exactly `runsPerOver` runs
// each over (one over = six 1-run-or-0-run balls totalling that over's figure) via the real
// applyBall pipeline, so legalBalls/overs/runs all come out of the actual engine, not hand-set.
function simulateInnings(battingTeam, bowlingTeam, runsPerOver) {
  let inn = newInning(battingTeam, bowlingTeam, RULES, MAX_WICKETS, OVERS_LIMIT);
  inn.strikerName = `${battingTeam} #1`;
  inn.nonStrikerName = `${battingTeam} #2`;
  inn.bowlerName = `${bowlingTeam} #1`;
  for (const overRuns of runsPerOver) {
    let remaining = overRuns;
    for (let ball = 0; ball < RULES.ballsPerOver; ball++) {
      const ballsLeftThisOver = RULES.ballsPerOver - ball;
      const runs = ball === RULES.ballsPerOver - 1 ? remaining : Math.min(remaining, 1);
      remaining -= runs;
      inn = applyBall(inn, { kind: "run", legal: true, runs });
    }
    inn.bowlerName = `${bowlingTeam} #1`; // keep a bowler assigned across the over boundary
  }
  return inn;
}

// Builds and immediately completes a group-stage match between two teams, given each side's
// runs-per-over ledger (8 entries, one per over) — deterministic, so which team wins is fully
// under this test's control and traceable back to the flyer's own match schedule.
function playMatch(id, tournamentId, teamA, teamB, aOvers, bOvers, stage) {
  const i1 = simulateInnings(teamA, teamB, aOvers);
  const i2 = simulateInnings(teamB, teamA, bOvers);
  return { id, tournamentId, status: "complete", oversLimit: OVERS_LIMIT, stage, innings: [i1, i2] };
}

test("Billund Cricket Tournament: 2 groups of 3, group stage -> Final (no Semifinal), correct champion", () => {
  const group1 = { label: "Group 1", teams: ["Billund", "Bengal Tigers", "Viborg"] };
  const group2 = { label: "Group 2", teams: ["Kolding", "IBCC", "Horsens"] };
  const tournament = {
    id: "T1",
    teams: [...group1.teams, ...group2.teams],
    groups: [group1, group2],
    advancePerGroup: 1, // "top team from each group qualifies for the final (no semi final)"
    fixtures: []
  };

  // --- Fixture generation: exactly the group-stage matches the flyer schedules (6 matches, 3 per
  // group, no cross-group pairing yet) ---
  const fixtures = generateGroupRoundRobinFixtures(tournament.groups, false);
  assert.equal(fixtures.length, 6);
  assert.equal(fixtures.filter(f => f.group === "Group 1").length, 3);
  assert.equal(fixtures.filter(f => f.group === "Group 2").length, 3);
  tournament.fixtures = fixtures;

  const pair = (a, b) => fixtures.find(f => f.teamA === a && f.teamB === b || f.teamA === b && f.teamB === a);
  assert.ok(pair("Billund", "Bengal Tigers"));
  assert.ok(pair("Billund", "Viborg"));
  assert.ok(pair("Bengal Tigers", "Viborg"));
  assert.ok(pair("Kolding", "IBCC"));
  assert.ok(pair("Kolding", "Horsens"));
  assert.ok(pair("IBCC", "Horsens"));

  // --- Group stage: Billund and Kolding are undefeated, so each tops its own group ---
  const matches = [
    playMatch("M1", "T1", "Billund", "Bengal Tigers", [10, 10, 10, 10, 10, 10, 10, 10], [8, 8, 8, 8, 8, 8, 8, 8]),
    playMatch("M2", "T1", "Billund", "Viborg", [12, 10, 10, 10, 10, 10, 10, 10], [9, 9, 9, 9, 9, 9, 9, 9]),
    playMatch("M3", "T1", "Bengal Tigers", "Viborg", [11, 11, 11, 11, 11, 11, 11, 11], [10, 10, 10, 10, 10, 10, 10, 10]),
    playMatch("M4", "T1", "Kolding", "IBCC", [13, 13, 13, 13, 13, 13, 13, 13], [12, 12, 12, 12, 12, 12, 12, 12]),
    playMatch("M5", "T1", "Kolding", "Horsens", [10, 10, 10, 10, 10, 10, 10, 12], [9, 9, 9, 9, 9, 9, 9, 9]),
    playMatch("M6", "T1", "IBCC", "Horsens", [11, 11, 11, 11, 11, 11, 11, 11], [10, 10, 10, 10, 10, 10, 10, 10])
  ];
  for (const m of matches) {
    const f = pair(m.innings[0].battingTeam, m.innings[0].bowlingTeam);
    f.matchId = m.id;
  }

  const groupStandings = computeGroupStandings(tournament, matches);
  const g1 = groupStandings.find(g => g.label === "Group 1").standings;
  const g2 = groupStandings.find(g => g.label === "Group 2").standings;
  assert.equal(g1[0].team, "Billund");
  assert.equal(g1[0].played, 2);
  assert.equal(g1[0].won, 2);
  assert.equal(g1[0].points, 4);
  assert.equal(g2[0].team, "Kolding");
  assert.equal(g2[0].won, 2);
  assert.equal(g2[0].points, 4);

  // --- Knockout shape: bracket size is groups x advancePerGroup (2x1=2), so this resolves to a
  // Final only, matching the flyer's explicit "no semi final" call-out ---
  const bracketSize = tournament.groups.length * tournament.advancePerGroup;
  const stages = applicableKnockoutStages(bracketSize);
  assert.deepEqual(stages.map(s => s.label), ["Final"]);

  const finalPairs = crossGroupKnockoutPairs(groupStandings, tournament.advancePerGroup);
  assert.deepEqual(finalPairs, [["Billund", "Kolding"]]);

  // --- Final: Billund wins it ---
  const [teamA, teamB] = finalPairs[0];
  const finalMatch = playMatch(
    "MFinal", "T1", teamA, teamB,
    [15, 15, 15, 15, 15, 15, 15, 15],
    [10, 10, 10, 10, 10, 10, 10, 10],
    "Final"
  );
  tournament.fixtures.push({ id: "final-fixture", teamA, teamB, group: null, stage: "Final", matchId: "MFinal" });
  const allMatches = [...matches, finalMatch];

  const champion = matchWinner(finalMatch, new Map(allMatches.map(m => [m.id, m])));
  assert.equal(champion, "Billund");

  // The Final must never leak into the group-stage points table (see computeStandings' own
  // knockout-exclusion comment) — Billund's overall standings row should still show exactly its
  // 2 group-stage matches, not 3.
  const overallStandings = computeStandings(tournament, allMatches);
  const billundRow = overallStandings.find(r => r.team === "Billund");
  assert.equal(billundRow.played, 2);
  assert.equal(billundRow.won, 2);
});
