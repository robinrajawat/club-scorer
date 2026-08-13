#!/usr/bin/env node
// Regression suite for the scoring engine (index.html's newInning/applyBall/ensureBatsman/
// ensureBowler/packMatchForFirestore/findEmptyKeyPath).
//
// This does NOT test a copy of that logic — it extracts the functions straight out of the current
// index.html at run time (see extractBlock below), so a change to the real file is what gets
// tested, and a stale duplicate can never quietly drift out of sync with what's actually shipped.
// Run with: node tests/run.js
//
// Every test here exists because of a real bug that reached production and was hard to trace once
// it did:
//   - "golden duck reappears as pickable" — a dismissed batsman's own replacement, if dismissed
//     before ever facing a run ball, had no record yet and could be picked again on the very
//     wicket that got them out.
//   - "empty bowler key corrupts sync" — a ball scored with no bowler assigned silently created a
//     literal empty-string key in inning.bowlers, which Firestore then rejected wholesale on the
//     next sync with an error that gave no indication of where the problem was.
// Both were only found after real (production) reports. This suite exists so the NEXT bug in this
// family fails a `node tests/run.js` run instead of a phone screen days or weeks later.

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
    module.exports = { newInning, applyBall, ensureBatsman, ensureBowler, packMatchForFirestore, findEmptyKeyPath };
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
  const { newInning, applyBall, ensureBatsman, ensureBowler, packMatchForFirestore, findEmptyKeyPath } = loadEngine();
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

  console.log(`\n${passed} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

run();
