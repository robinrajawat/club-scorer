// Tournament standings and DLS calculations (src/core/appLogic.js).
//
// computeStandings and the DLS calculation are the two highest-stakes, most-branching pieces of
// logic in the app (knockout exclusion, tie vs. no-result vs. Super-Over chains, revised-overs NRR
// crediting, the three-branch DLS formula). These were added proactively, ahead of a production
// incident rather than after one — ordinary regression insurance, not a postmortem.

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStandings, formatTournamentViewSnapshot, dlsTarget, dlsResourcePercent, oversLeftTrueDecimal,
  computeQualificationTarget, decimalOversToLabel
} from "../../src/core/appLogic.js";

test("normal result: winner gets 2pts and positive NRR, loser gets 0pts and negative NRR", () => {
  const tournament = { id: "T1", teams: ["A", "B"] };
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20,
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 150, wickets: 10, legalBalls: 110, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 140, wickets: 8, legalBalls: 120, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const rows = computeStandings(tournament, [match]);
  const a = rows.find(r => r.team === "A");
  const b = rows.find(r => r.team === "B");
  assert.equal(a.points, 2);
  assert.equal(a.won, 1);
  assert.equal(b.points, 0);
  assert.equal(b.lost, 1);
  assert.ok(a.nrr > 0);
  assert.ok(b.nrr < 0);
});

test("all-out team is credited the full overs limit, not balls actually faced", () => {
  const tournament = { id: "T1", teams: ["A", "B"] };
  // A bowled out in just 10 overs (60 balls) of a 20-over match — must still be credited the full
  // 20 for run-rate purposes, or being bowled out cheaply would perversely inflate NRR.
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20,
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 60, wickets: 10, legalBalls: 60, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 61, wickets: 2, legalBalls: 90, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const rows = computeStandings(tournament, [match]);
  const a = rows.find(r => r.team === "A");
  assert.equal(a.oversFor, 20);
});

test("no-result excludes runs/overs from NRR but still awards 1pt each, tracked in its own column", () => {
  const tournament = { id: "T1", teams: ["A", "B"] };
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20, noResult: true,
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 80, wickets: 3, legalBalls: 90, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 10, wickets: 0, legalBalls: 12, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const rows = computeStandings(tournament, [match]);
  const a = rows.find(r => r.team === "A");
  const b = rows.find(r => r.team === "B");
  assert.equal(a.points, 1);
  assert.equal(b.points, 1);
  assert.equal(a.won, 0);
  assert.equal(a.lost, 0);
  assert.equal(a.tied, 0);
  assert.equal(a.runsFor, 0);
  assert.equal(a.oversFor, 0);
  assert.equal(a.noResult, 1);
});

test("a level match decided by Super Over awards 2/0, not a tie", () => {
  const tournament = { id: "T1", teams: ["A", "B"] };
  const superOver = {
    id: "SO1", status: "complete",
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 8 },
      { battingTeam: "B", bowlingTeam: "A", runs: 10 }
    ]
  };
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20, superOverMatchId: "SO1",
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 150, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 150, wickets: 6, legalBalls: 120, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const rows = computeStandings(tournament, [match, superOver]);
  const a = rows.find(r => r.team === "A");
  const b = rows.find(r => r.team === "B");
  assert.equal(b.points, 2);
  assert.equal(b.won, 1);
  assert.equal(a.points, 0);
  assert.equal(a.lost, 1);
  assert.equal(a.tied, 0);
  assert.equal(b.tied, 0);
});

test("a staged knockout fixture (e.g. a Final) never counts toward the league table", () => {
  const tournament = {
    id: "T1", teams: ["A", "B"],
    fixtures: [{ matchId: "M1", stage: "Final" }]
  };
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20,
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 150, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 100, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const rows = computeStandings(tournament, [match]);
  const a = rows.find(r => r.team === "A");
  assert.equal(a.played, 0);
  assert.equal(a.points, 0);
});

test("formatTournamentViewSnapshot: carries noResult through to the written snapshot", () => {
  // Regression guard: the original hand-written /tournamentViews writer in index.html dropped
  // `noResult` from the standings rows it wrote, even though FollowTournamentScreen renders it as
  // the "NR" column — every previously-shared tournament's NR column silently showed nothing.
  const tournament = { id: "T1", name: "Summer Cup", teams: ["A", "B"], fixtures: [] };
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20, noResult: true,
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 80, wickets: 3, legalBalls: 90, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 10, wickets: 0, legalBalls: 12, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const standings = computeStandings(tournament, [match]);
  const snapshot = formatTournamentViewSnapshot(tournament, standings);
  assert.equal(snapshot.name, "Summer Cup");
  assert.deepEqual(snapshot.teams, ["A", "B"]);
  const a = snapshot.standings.find(r => r.team === "A");
  assert.equal(a.noResult, 1);
  assert.equal(a.points, 1);
});

test("formatTournamentViewSnapshot: fixtures are reduced to the display-only fields", () => {
  const tournament = {
    id: "T1", name: "Summer Cup", teams: ["A", "B"],
    fixtures: [{ id: "F1", teamA: "A", teamB: "B", date: "2026-09-10T11:00", stage: "Final", matchId: "M1", extraInternalField: "drop me" }]
  };
  const snapshot = formatTournamentViewSnapshot(tournament, []);
  assert.deepEqual(snapshot.fixtures, [{ id: "F1", teamA: "A", teamB: "B", date: "2026-09-10T11:00" }]);
});

test("DLS-revised overs credit the all-out chasing side with the revised limit, not the original", () => {
  const tournament = { id: "T1", teams: ["A", "B"] };
  // Second innings revised down to 30 overs by a rain interruption; team B is all out inside that
  // revised limit — NRR must credit them with the revised 30, not the original 50.
  const match = {
    id: "M1", tournamentId: "T1", status: "complete", oversLimit: 50, revisedOvers: 30,
    innings: [
      { battingTeam: "A", bowlingTeam: "B", runs: 200, wickets: 10, legalBalls: 300, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "B", bowlingTeam: "A", runs: 150, wickets: 10, legalBalls: 150, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const rows = computeStandings(tournament, [match]);
  const b = rows.find(r => r.team === "B");
  assert.equal(b.oversFor, 30);
});

test("dlsTarget: three-branch formula (R2<R1, R2===R1, R2>R1) matches ICC §5.6", () => {
  // R2 < R1: target scales DOWN proportionally to the resource lost.
  const lower = dlsTarget(250, 90, 60, 200);
  assert.equal(lower.target, Math.floor(250 * 60 / 90) + 1);
  // R2 === R1: no resource difference, target is simply S+1 (par is the original score).
  const equal = dlsTarget(180, 75, 75, 200);
  assert.equal(equal.target, 181);
  assert.equal(equal.par, 180);
  // R2 > R1: target scales UP using G50.
  const higher = dlsTarget(180, 60, 90, 200);
  assert.equal(higher.target, Math.floor(180 + 200 * (90 - 60) / 100) + 1);
  assert.equal(higher.par, higher.target - 1);
});

test("dlsResourcePercent: exact table values and mid-over interpolation", () => {
  assert.equal(dlsResourcePercent(50, 0), 100.0);
  assert.equal(dlsResourcePercent(0, 3), 0);
  assert.equal(dlsResourcePercent(25, 10), 0, "10+ wickets lost is always 0%, no table lookup needed");
  // 25.5 overs left, 2 wickets down should sit strictly between the 25-over and 26-over rows.
  const interpolated = dlsResourcePercent(25.5, 2);
  assert.ok(interpolated > 60.5 && interpolated < 62.0, `got ${interpolated}`);
});

test("oversLeftTrueDecimal: true decimal overs, distinct from cricket's X.Y notation", () => {
  assert.equal(oversLeftTrueDecimal(50, 27), 45.5);
  // 4 balls into an over is 4/6 = 0.6667 true decimal, NOT ".4" as cricket notation would show.
  const withPartial = oversLeftTrueDecimal(50, 4);
  assert.ok(Math.abs(withPartial - (49 + 2 / 6)) < 1e-9, `got ${withPartial}`);
});

// BUG FIX: chasing down to EXACTLY the raw maxOversExact threshold only ties the rival's NRR,
// the same "landing exactly on the boundary doesn't actually beat it" concern the "restrict"
// branch already guards against for runs (maxConcede = ceil(maxConcedeExact) - 1), just in
// balls instead. maxOversForDisplay is the corrected, actually-achievable figure the UI should
// show instead of the raw threshold.
test("computeQualificationTarget: chasing scenario corrects the overs figure so it lands strictly inside the qualifying range, not exactly on the tie boundary", () => {
  const stats = { runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0 };
  const result = computeQualificationTarget({
    stats, rivalNRR: 0, battingFirst: false, oversLimit: 20, knownRuns: 120
  });
  assert.equal(result.kind, "chaseWithin");
  // Raw threshold: 121 runs (target+1) / 6 overs = 20.16667 overs -- an exact 121-ball boundary.
  assert.ok(Math.abs(result.maxOversExact - 121 / 6) < 1e-9, `got ${result.maxOversExact}`);
  // Finishing at the raw threshold only TIES the rival's NRR...
  const nrrAtRawThreshold = (0 + 121) / (0 + result.maxOversExact) - (0 + 120) / (0 + 20);
  assert.ok(Math.abs(nrrAtRawThreshold) < 1e-9, `expected a tie, got NRR delta ${nrrAtRawThreshold}`);
  // ...so the corrected display figure must be one ball earlier (20.0 overs, not 20.1), which
  // genuinely beats the rival's NRR.
  assert.equal(result.maxOversForDisplay, 20);
  assert.equal(decimalOversToLabel(result.maxOversForDisplay, 6), "20.0");
  const nrrAtDisplayed = (0 + 121) / (0 + result.maxOversForDisplay) - (0 + 120) / (0 + 20);
  assert.ok(nrrAtDisplayed > 0, `expected this to beat the rival, got NRR delta ${nrrAtDisplayed}`);
});
