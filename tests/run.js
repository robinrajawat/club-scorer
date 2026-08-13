#!/usr/bin/env node
// Regression suite for the scoring engine (index.html's newInning/applyBall/ensureBatsman/
// ensureBowler/packMatchForFirestore/findEmptyKeyPath) plus tournament standings and DLS
// (computeStandings/dlsTarget/dlsResourcePercent/oversLeftTrueDecimal).
//
// This does NOT test a copy of that logic — it extracts the functions straight out of the current
// index.html at run time (see extractBlock below), so a change to the real file is what gets
// tested, and a stale duplicate can never quietly drift out of sync with what's actually shipped.
// Run with: node tests/run.js
//
// The scoring-engine cases below each exist because of a real bug that reached production and was
// hard to trace once it did:
//   - "golden duck reappears as pickable" — a dismissed batsman's own replacement, if dismissed
//     before ever facing a run ball, had no record yet and could be picked again on the very
//     wicket that got them out.
//   - "empty bowler key corrupts sync" — a ball scored with no bowler assigned silently created a
//     literal empty-string key in inning.bowlers, which Firestore then rejected wholesale on the
//     next sync with an error that gave no indication of where the problem was.
// Both were only found after real (production) reports. This suite exists so the NEXT bug in this
// family fails a `node tests/run.js` run instead of a phone screen days or weeks later.
//
// The standings/DLS cases are the opposite origin: computeStandings and the DLS calculation are
// the two highest-stakes, most-branching pieces of logic in the app (knockout exclusion, tie vs.
// no-result vs. Super-Over chains, revised-overs NRR crediting, the three-branch DLS formula) and
// had zero coverage despite that. These were added proactively, ahead of a production incident
// rather than after one — ordinary regression insurance, not a postmortem.

const fs = require("fs");
const path = require("path");

const INDEX_HTML = path.join(__dirname, "..", "index.html");

function extractBlock(source, name) {
  const startMarker = `// TEST-EXTRACT-START: ${name}`;
  const endMarker = `// TEST-EXTRACT-END: ${name}`;
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Could not find extraction markers for "${name}" in index.html \u2014 ` +
      `expected "${startMarker}" ... "${endMarker}". ` +
      `If the scoring engine was restructured, move these markers to match, don't delete them.`
    );
  }
  // Skip past the rest of the marker's own comment line (it may have trailing text after the
  // marker itself, e.g. "// TEST-EXTRACT-START: name \u2014 some explanation") — slicing from midway
  // through that line would leave un-commented text in the extracted source.
  const sliceStart = source.indexOf("\n", startIdx) + 1;
  const sliceEnd = source.lastIndexOf("\n", endIdx) + 1;
  return source.slice(sliceStart, sliceEnd);
}

function loadEngine() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const scriptMatch = html.match(/<script(?![^>]*type="module")[^>]*>([\s\S]*?)<\/script>/g);
  if (!scriptMatch || scriptMatch.length === 0) {
    throw new Error("Could not find the main inline <script> block in index.html");
  }
  // The main app script is the largest inline script in the file.
  const scripts = scriptMatch.map(s => s.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
  const source = scripts.reduce((a, b) => (b.length > a.length ? b : a), "");

  const packUtils = extractBlock(source, "pack-utils");
  const scoringEngine = extractBlock(source, "scoring-engine");
  // This block re-declares DEFAULT_RULES itself (needed by battingTeamXISize's fallback path,
  // which none of these tests exercise since every fixture sets inning.maxWickets explicitly) —
  // strip that one declaration so it doesn't collide with the mock injected below, which
  // scoring-engine already depends on.
  const standingsAndDls = extractBlock(source, "standings-and-dls").replace(
    /const DEFAULT_RULES = \{[^}]*\};/,
    ""
  );

  const DEFAULT_RULES = {
    ballsPerOver: 6,
    wideRuns: 1,
    noballRuns: 1,
    freeHit: false,
    maxOversPerBowler: null,
    powerplayOvers: null,
    timeCapMinutes: null
  };

  const moduleSource = `
    const DEFAULT_RULES = ${JSON.stringify(DEFAULT_RULES)};
    ${packUtils}
    ${scoringEngine}
    ${standingsAndDls}
    module.exports = {
      newInning, applyBall, ensureBatsman, ensureBowler, packMatchForFirestore, findEmptyKeyPath,
      computeStandings, dlsTarget, dlsResourcePercent, oversLeftTrueDecimal
    };
  `;
  const Module = require("module");
  const m = new Module(INDEX_HTML, null);
  m._compile(moduleSource, INDEX_HTML);
  return m.exports;
}

// ---------------------------------------------------------------------------------------------

let failures = 0;
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed++;
  } else {
    failures++;
    console.error(`FAIL: ${label}${detail ? " \u2014 " + detail : ""}`);
  }
}

function run() {
  const {
    newInning, applyBall, ensureBatsman, ensureBowler, packMatchForFirestore, findEmptyKeyPath,
    computeStandings, dlsTarget, dlsResourcePercent, oversLeftTrueDecimal
  } = loadEngine();
  const rules = { ballsPerOver: 6, wideRuns: 1, noballRuns: 1, freeHit: true };

  function freshInning(maxWickets, roster) {
    let inn = newInning("TeamA", "TeamB", rules, maxWickets != null ? maxWickets : 10);
    inn.strikerName = roster[0];
    inn.nonStrikerName = roster[1];
    ensureBatsman(inn, roster[0]);
    ensureBatsman(inn, roster[1]);
    inn.bowlerName = "B1";
    ensureBowler(inn, "B1");
    return inn;
  }

  function excludeListFor(inn, justRetiredName) {
    return Object.keys(inn.batsmen).filter(
      n => n === justRetiredName || !(inn.batsmen[n].retiredHurt && !inn.batsmen[n].out)
    );
  }
  function poolFor(roster, inn, justRetiredName) {
    const excluded = new Set(excludeListFor(inn, justRetiredName));
    return roster.filter(n => !excluded.has(n));
  }
  function bowl(inn, opts) {
    return applyBall(inn, {
      kind: "wicket",
      wicketType: "Bowled",
      legal: true,
      runsBeforeWicket: 0,
      runsCreditTo: inn.strikerName,
      ...opts
    });
  }

  // ---- 1. Golden-duck-reappears regression -----------------------------------------------
  {
    const roster = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11"];
    let inn = freshInning(10, roster);
    inn = bowl(inn, { newBatsman: "P3" }); // wicket 1: P1 out, P3 comes in
    const pool = poolFor(roster, inn, null);
    check(
      "golden duck: replacement batsman not selectable on the wicket that just dismissed them",
      !pool.includes("P3"),
      `pool was [${pool.join(", ")}]`
    );
  }

  // ---- 2. Full 10-wicket collapse, every dismissal a golden duck ------------------------
  {
    const roster = Array.from({ length: 11 }, (_, i) => "P" + (i + 1));
    const maxWickets = 10;
    let inn = freshInning(maxWickets, roster);
    let clean = true;
    let ended = false;
    for (let i = 1; i <= maxWickets; i++) {
      if (!inn.bowlerName) {
        inn.bowlerName = "B1"; // rotate back to the same bowler between overs \u2014 irrelevant to this test
        ensureBowler(inn, "B1");
      }
      const isLast = inn.wickets + 1 >= maxWickets;
      if (isLast) {
        inn = bowl(inn, { newBatsman: "" });
        ended = true;
        break;
      }
      const pool = poolFor(roster, inn, null);
      const bad = pool.filter(n => (inn.batsmen[n] && inn.batsmen[n].out) || n === inn.strikerName || n === inn.nonStrikerName);
      if (bad.length) clean = false;
      inn = bowl(inn, { newBatsman: pool[0] });
    }
    check("full collapse: innings ends cleanly on the last wicket", ended);
    check("full collapse: no already-out or currently-batting name ever reappears in the pool", clean);
  }

  // ---- 3. Retire hurt \u2192 wicket \u2192 return -------------------------------------------------
  {
    const roster = ["P1", "P2", "P3", "P4", "P5"];
    let inn = freshInning(10, roster);
    inn = { ...inn, batsmen: { ...inn.batsmen, P1: { ...inn.batsmen.P1, retiredHurt: true } }, strikerName: "" };
    let pool = poolFor(roster, inn, "P1");
    check("retire hurt: retiring batsman excluded immediately (justRetiredName)", !pool.includes("P1"));
    inn = { ...inn, strikerName: "P3" };
    ensureBatsman(inn, "P3");
    inn = bowl(inn, { runsCreditTo: "P3", newBatsman: "P1" }); // P3 out, P1 returns
    check("retire hurt: retiredHurt cleared once the batsman returns", !inn.batsmen.P1.retiredHurt);
    check("retire hurt: P1 correctly recorded as active striker again", inn.strikerName === "P1");
  }

  // ---- 4. Non-striker run-out via Swap Strike -------------------------------------------
  {
    const roster = ["P1", "P2", "P3"];
    let inn = freshInning(10, roster);
    inn = { ...inn, strikerName: "P2", nonStrikerName: "P1" }; // simulates Swap Strike in the wicket popup
    inn = applyBall(inn, {
      kind: "wicket",
      wicketType: "Run out",
      legal: true,
      runsBeforeWicket: 1,
      runsCreditTo: "P1",
      newBatsman: "P3"
    });
    check("swap-strike run out: correct batsman (P2) marked out", inn.batsmen.P2.out === true);
    check("swap-strike run out: the other batsman (P1) not out, credited the run", inn.batsmen.P1.out !== true && inn.batsmen.P1.runs === 1);
  }

  // ---- 5. Hat-trick spanning an over boundary, same bowler back-to-back ------------------
  {
    let inn = freshInning(10, ["B1", "B2", "B3", "B4", "B5"]);
    inn.bowlerName = "A";
    ensureBowler(inn, "A");
    for (let i = 0; i < 5; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
    inn = bowl(inn, { newBatsman: "B3" }); // over 1 ball 6 \u2014 wicket 1
    inn.bowlerName = "A";
    ensureBowler(inn, "A");
    inn = bowl(inn, { runsCreditTo: "B3", newBatsman: "B4" }); // over 2 ball 1 \u2014 wicket 2
    inn = bowl(inn, { runsCreditTo: "B4", newBatsman: "B5" }); // over 2 ball 2 \u2014 wicket 3
    check(
      "hat-trick spans an over boundary for the same bowler",
      inn.milestones.some(m => m.type === "hatTrick")
    );
  }

  // ---- 6. "Over hat-trick" \u2014 an intervening over bowled by someone else ------------------
  {
    let inn = freshInning(10, ["B1", "B2", "B3", "B4", "B5"]);
    inn.bowlerName = "A";
    ensureBowler(inn, "A");
    for (let i = 0; i < 5; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
    inn = bowl(inn, { newBatsman: "B3" }); // over 1 ball 6 \u2014 wicket 1 by A
    inn.bowlerName = "C";
    ensureBowler(inn, "C");
    for (let i = 0; i < 6; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 }); // full wicketless over by C
    inn.bowlerName = "A";
    ensureBowler(inn, "A");
    inn = bowl(inn, { runsCreditTo: "B3", newBatsman: "B4" }); // over 3 ball 1 \u2014 wicket 2 by A
    inn = bowl(inn, { runsCreditTo: "B4", newBatsman: "B5" }); // over 3 ball 2 \u2014 wicket 3 by A
    check(
      "hat-trick survives an intervening over bowled by someone else",
      inn.milestones.some(m => m.type === "hatTrick")
    );
  }

  // ---- 7. Wide/no-ball neither extends nor breaks a hat-trick streak --------------------
  {
    let inn = freshInning(10, ["B1", "B2", "B3", "B4", "B5"]);
    inn.bowlerName = "A";
    ensureBowler(inn, "A");
    for (let i = 0; i < 5; i++) inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
    inn = bowl(inn, { newBatsman: "B3" });
    inn.bowlerName = "A";
    ensureBowler(inn, "A");
    inn = bowl(inn, { runsCreditTo: "B3", newBatsman: "B4" });
    inn = applyBall(inn, { kind: "wide", runs: 1 });
    inn = bowl(inn, { runsCreditTo: "B4", newBatsman: "B5" });
    check("a wide between two wickets does not break the hat-trick streak", inn.milestones.some(m => m.type === "hatTrick"));
  }

  // ---- 8. A ball scored with no bowler assigned is refused, not silently corrupted ------
  {
    let inn = freshInning(10, ["P1", "P2"]);
    const corrupted = { ...inn, bowlerName: "" };
    const before = JSON.stringify(corrupted);
    const after = applyBall(corrupted, { kind: "run", legal: true, runs: 1 });
    check("ball with no bowler assigned: inning left unchanged", JSON.stringify(after) === before);
    check("ball with no bowler assigned: no empty-string key created in bowlers", !Object.prototype.hasOwnProperty.call(after.bowlers, ""));
  }

  // ---- 9. A ball scored with no striker assigned is refused, not silently corrupted -----
  {
    let inn = freshInning(10, ["P1", "P2"]);
    const corrupted = { ...inn, strikerName: "" };
    const before = JSON.stringify(corrupted);
    const after = applyBall(corrupted, { kind: "wicket", wicketType: "Bowled", legal: true, runsBeforeWicket: 0, runsCreditTo: "P2", newBatsman: "P3" });
    check("ball with no striker assigned: inning left unchanged", JSON.stringify(after) === before);
  }

  // ---- 10. Penalties still apply even with no striker/bowler (they don't need one) ------
  {
    let inn = freshInning(10, ["P1", "P2"]);
    const corrupted = { ...inn, strikerName: "", bowlerName: "" };
    const before = corrupted.runs || 0;
    const after = applyBall(corrupted, { kind: "penalty", runs: 5 });
    check("penalty still applies despite no striker/bowler", after.runs === before + 5);
  }

  // ---- 11. findEmptyKeyPath: detects an injected empty key, ignores empty values --------
  {
    const bad = { innings: [{ batsmen: { P1: {}, "": {} } }] };
    check("findEmptyKeyPath finds an injected empty batsmen key", findEmptyKeyPath(bad, "") === "innings[0].batsmen");
    const ok = { strikerName: "", innings: [{ batsmen: { P1: {} } }] };
    check("findEmptyKeyPath ignores an empty STRING VALUE (not a key)", findEmptyKeyPath(ok, "") === null);
  }

  // ---- 12. A normal full over of real scoring produces no empty keys anywhere -----------
  {
    const roster = ["P1", "P2", "P3", "P4", "P5"];
    let inn = freshInning(10, roster);
    inn = applyBall(inn, { kind: "run", legal: true, runs: 1 });
    inn = applyBall(inn, { kind: "run", legal: true, runs: 4 });
    inn = applyBall(inn, { kind: "wide", runs: 1 });
    inn = bowl(inn, { newBatsman: "P3" });
    inn = applyBall(inn, { kind: "run", legal: true, runs: 0 });
    inn = applyBall(inn, { kind: "run", legal: true, runs: 6 });
    const packed = packMatchForFirestore({ id: "test", innings: [inn] });
    check("a normal over of scoring never produces an empty-string key anywhere", findEmptyKeyPath(packed, "") === null);
  }

  // ---- 13. computeStandings: normal result — winner gets 2pts, NRR sign is correct --------
  {
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
    check("normal result: winning team gets 2 points", a.points === 2 && a.won === 1);
    check("normal result: losing team gets 0 points", b.points === 0 && b.lost === 1);
    check("normal result: winning team's NRR is positive", a.nrr > 0);
    check("normal result: losing team's NRR is negative", b.nrr < 0);
  }

  // ---- 14. computeStandings: all-out team credited full overs (not just balls faced) -----
  {
    const tournament = { id: "T1", teams: ["A", "B"] };
    // A bowled out in just 10 overs (60 balls) of a 20-over match — must still be credited the
    // full 20 for run-rate purposes, or being bowled out cheaply would perversely inflate NRR.
    const match = {
      id: "M1", tournamentId: "T1", status: "complete", oversLimit: 20,
      innings: [
        { battingTeam: "A", bowlingTeam: "B", runs: 60, wickets: 10, legalBalls: 60, ballsPerOver: 6, maxWickets: 10 },
        { battingTeam: "B", bowlingTeam: "A", runs: 61, wickets: 2, legalBalls: 90, ballsPerOver: 6, maxWickets: 10 }
      ]
    };
    const rows = computeStandings(tournament, [match]);
    const a = rows.find(r => r.team === "A");
    check("all-out team is credited the full overs limit, not balls actually faced", a.oversFor === 20);
  }

  // ---- 15. computeStandings: no-result excludes runs/overs but still awards 1pt each ------
  {
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
    check("no-result: 1 point each", a.points === 1 && b.points === 1);
    check("no-result: neither win/loss/tie recorded", a.won === 0 && a.lost === 0 && a.tied === 0);
    check("no-result: runs/overs excluded from NRR entirely", a.runsFor === 0 && a.oversFor === 0);
    check("no-result: tracked in its own noResult column, not conflated with tied", a.noResult === 1 && a.tied === 0);
  }

  // ---- 16. computeStandings: a level match with a decided Super Over awards 2/0, not a tie -
  {
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
    check("super-over-decided match: winner gets 2 points, not 1", b.points === 2 && b.won === 1);
    check("super-over-decided match: loser gets 0 points, not 1", a.points === 0 && a.lost === 1);
    check("super-over-decided match: not counted as tied for either side", a.tied === 0 && b.tied === 0);
  }

  // ---- 17. computeStandings: knockout-stage fixture excluded even within a single group ----
  {
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
    check("a Final (or any staged knockout fixture) never counts toward the league table", a.played === 0 && a.points === 0);
  }

  // ---- 18. computeStandings: DLS-revised overs credit the chasing side correctly on NRR ----
  {
    const tournament = { id: "T1", teams: ["A", "B"] };
    // Second innings revised down to 30 overs by a rain interruption; team B is all out inside
    // that revised limit — NRR must credit them with the revised 30, not the original 50.
    const match = {
      id: "M1", tournamentId: "T1", status: "complete", oversLimit: 50, revisedOvers: 30,
      innings: [
        { battingTeam: "A", bowlingTeam: "B", runs: 200, wickets: 10, legalBalls: 300, ballsPerOver: 6, maxWickets: 10 },
        { battingTeam: "B", bowlingTeam: "A", runs: 150, wickets: 10, legalBalls: 150, ballsPerOver: 6, maxWickets: 10 }
      ]
    };
    const rows = computeStandings(tournament, [match]);
    const b = rows.find(r => r.team === "B");
    check("DLS-revised overs: all-out chasing side credited the REVISED limit, not the original", b.oversFor === 30);
  }

  // ---- 19. dlsTarget: three-branch formula (R2<R1, R2===R1, R2>R1) matches ICC §5.6 --------
  {
    // R2 < R1: target scales DOWN proportionally to the resource lost.
    const lower = dlsTarget(250, 90, 60, 200);
    check("dlsTarget R2<R1: target scales down with resource lost", lower.target === Math.floor(250 * 60 / 90) + 1);
    // R2 === R1: no resource difference, target is simply S+1 (par is the original score).
    const equal = dlsTarget(180, 75, 75, 200);
    check("dlsTarget R2===R1: target is just S+1 with equal resources", equal.target === 181 && equal.par === 180);
    // R2 > R1: target scales UP using G50.
    const higher = dlsTarget(180, 60, 90, 200);
    check("dlsTarget R2>R1: target scales up using G50", higher.target === Math.floor(180 + 200 * (90 - 60) / 100) + 1);
    check("dlsTarget: par is always target minus 1", higher.par === higher.target - 1);
  }

  // ---- 20. dlsResourcePercent: exact table values and mid-over interpolation ---------------
  {
    check("dlsResourcePercent: 50 overs, 0 wickets = 100.0% exactly", dlsResourcePercent(50, 0) === 100.0);
    check("dlsResourcePercent: 0 overs left = 0% regardless of wickets", dlsResourcePercent(0, 3) === 0);
    check("dlsResourcePercent: 10+ wickets lost is always 0%, no table lookup needed", dlsResourcePercent(25, 10) === 0);
    // 25.5 overs left, 2 wickets down should sit strictly between the 25-over and 26-over rows.
    const interpolated = dlsResourcePercent(25.5, 2);
    check(
      "dlsResourcePercent: interpolates strictly between the two nearest whole-over rows",
      interpolated > 60.5 && interpolated < 62.0,
      `got ${interpolated}`
    );
  }

  // ---- 21. oversLeftTrueDecimal: true decimal overs, distinct from cricket's X.Y notation --
  {
    // 4 overs + 3 balls bowled of a 50-over (300-ball) match = 46 overs' worth of balls left,
    // i.e. exactly 46.0 true decimal overs remaining — not cricket notation.
    check("oversLeftTrueDecimal: whole-over case", oversLeftTrueDecimal(50, 27) === 45.5);
    // 4 balls into an over is 4/6 = 0.6667 true decimal, NOT ".4" as cricket notation would show.
    const withPartial = oversLeftTrueDecimal(50, 4);
    check(
      "oversLeftTrueDecimal: a partial over is true decimal (balls/6), not cricket's X.Y notation",
      Math.abs(withPartial - (49 + 2 / 6)) < 1e-9,
      `got ${withPartial}`
    );
  }

  console.log(`\n${passed} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

run();
