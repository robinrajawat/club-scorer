// Fixture date/time formatting, .ics/CSV export, and match/poll share-text & URL builders
// (src/core/shareAndFormat.js).

import test from "node:test";
import assert from "node:assert/strict";
import {
  pad2, parseFixtureDateTime, buildFixtureIso, formatFixtureDateTime,
  icsEscape, icsLocalDateTime, buildTournamentICS, buildFixtureICS,
  csvCell, toCSV, multiSectionCSV, safeFilenamePart,
  nonStandardRulesText, wideNoballLastOverExceptionLabel, impactSubsText, tossText, umpiresText, matchResultText, matchScoreLine, chasingInfo,
  buildShareText, buildFixtureShareText, pollExpiryDateLabel, buildMapsUrl, resolvePollTeams,
  buildPollUrl, buildPollShareText, buildFollowUrl, buildLiveShareText
} from "../../src/core/shareAndFormat.js";
import { DEFAULT_RULES } from "../../src/core/appLogic.js";

test("pad2: zero-pads single digits, leaves two-digit numbers alone", () => {
  assert.equal(pad2(5), "05");
  assert.equal(pad2(42), "42");
});

test("parseFixtureDateTime: splits a stored ISO-ish datetime into picker pieces, 24h -> 12h", () => {
  assert.deepEqual(parseFixtureDateTime("2026-06-14T15:30"), {
    year: 2026, month: 5, day: 14, hour12: 3, minute: "30", period: "PM"
  });
  // Midnight (00:00) is 12 AM, not 0.
  assert.equal(parseFixtureDateTime("2026-06-14T00:15").hour12, 12);
  assert.equal(parseFixtureDateTime("2026-06-14T00:15").period, "AM");
});

test("parseFixtureDateTime: a legacy free-text or missing date defaults to today at 11 AM", () => {
  const result = parseFixtureDateTime("Sat 14 Jun 3pm");
  assert.equal(result.day, null);
  assert.equal(result.hour12, 11);
  assert.equal(result.period, "AM");
});

test("buildFixtureIso: round-trips with parseFixtureDateTime, PM correctly adds 12 hours", () => {
  assert.equal(buildFixtureIso(2026, 5, 14, 3, "30", "PM"), "2026-06-14T15:30");
  assert.equal(buildFixtureIso(2026, 5, 14, 12, "00", "AM"), "2026-06-14T00:00");
  assert.equal(buildFixtureIso(2026, 5, 14, 12, "00", "PM"), "2026-06-14T12:00");
});

test("buildFixtureIso: returns empty string when no day is set", () => {
  assert.equal(buildFixtureIso(2026, 5, null, 11, "00", "AM"), "");
});

test("formatFixtureDateTime: returns null for anything not matching the stored ISO-ish shape", () => {
  assert.equal(formatFixtureDateTime("Sat 14 Jun 3pm"), null);
  assert.equal(formatFixtureDateTime(""), null);
});

test("formatFixtureDateTime: formats a valid datetime as a readable label", () => {
  const label = formatFixtureDateTime("2026-06-14T15:30");
  assert.match(label, /3:30 PM/);
});

test("icsEscape: escapes backslashes, commas, semicolons, and newlines per the ICS spec", () => {
  assert.equal(icsEscape("A, B; C\\D\nE"), "A\\, B\\; C\\\\D\\nE");
});

test("icsLocalDateTime: converts stored ISO-ish datetime to floating-local ICS format", () => {
  assert.equal(icsLocalDateTime("2026-06-14T15:30"), "20260614T153000");
});

test("buildTournamentICS: skips fixtures with no scheduled time, includes ones that do", () => {
  const tournament = {
    name: "Summer Cup",
    fixtures: [
      { id: "f1", teamA: "A", teamB: "B", date: "2026-06-14T15:30" },
      { id: "f2", teamA: "C", teamB: "D", date: "" }
    ]
  };
  const ics = buildTournamentICS(tournament);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /SUMMARY:A vs B/);
});

test("buildFixtureICS: produces exactly one VEVENT for a single fixture, with venue/GEO when given", () => {
  const ics = buildFixtureICS({ id: "f1", teamA: "A", teamB: "B", date: "2026-06-14T15:30" }, "Summer Cup", "The Green", 51.5, -0.1);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /LOCATION:The Green/);
  assert.match(ics, /GEO:51.5;-0.1/);
});

test("csvCell: quotes only when the value actually needs it, doubles internal quotes", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("has,comma"), '"has,comma"');
  assert.equal(csvCell('has"quote'), '"has""quote"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(42), "42");
});

test("toCSV: leads with a UTF-8 BOM, joins headers and rows with CRLF", () => {
  const csv = toCSV(["Name", "Runs"], [["P1", 55], ["P, 2", 10]]);
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /Name,Runs\r\n/);
  assert.match(csv, /"P, 2",10/);
});

test("multiSectionCSV: separates sections with a blank line, each with its own title and headers", () => {
  const csv = multiSectionCSV([
    { title: "Batting", headers: ["Name"], rows: [["P1"]] },
    { title: "Bowling", headers: ["Name"], rows: [["P2"]] }
  ]);
  const lines = csv.replace("﻿", "").split("\r\n");
  assert.deepEqual(lines, ["Batting", "Name", "P1", "", "Bowling", "Name", "P2"]);
});

test("safeFilenamePart: strips non-alphanumerics (case preserved), trims leading/trailing dashes, falls back on empty", () => {
  assert.equal(safeFilenamePart("St. Mary's XI!"), "St-Mary-s-XI");
  assert.equal(safeFilenamePart(""), "export");
  assert.equal(safeFilenamePart(null), "export");
});

test("nonStandardRulesText: null when every rule matches the default, lists only what differs", () => {
  assert.equal(nonStandardRulesText(DEFAULT_RULES), null);
  const text = nonStandardRulesText({ ...DEFAULT_RULES, freeHit: true, powerplayOvers: 6 });
  assert.match(text, /Free Hit enabled/);
  assert.match(text, /6-over powerplay/);
  assert.doesNotMatch(text, /ball overs/);
});

test("nonStandardRulesText: notes wideNoballCountsAsBall and impactPlayerEnabled when on", () => {
  const text = nonStandardRulesText({ ...DEFAULT_RULES, wideNoballCountsAsBall: true, impactPlayerEnabled: true });
  assert.match(text, /wide\/no-ball counts as a ball/);
  assert.match(text, /Impact Player substitution/);
  assert.doesNotMatch(text, /up to/); // standard 1-per-team default doesn't need calling out
  assert.doesNotMatch(text, /except/); // lastOverRules isn't on, so no exception to call out
});

test("nonStandardRulesText: calls out the last-over exception only when lastOverRules.wideNoballIllegalAgain is actually on", () => {
  const text = nonStandardRulesText({
    ...DEFAULT_RULES,
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: true }
  });
  assert.match(text, /wide\/no-ball counts as a ball \(except the last over\)/);

  const twoOvers = nonStandardRulesText({
    ...DEFAULT_RULES,
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 2, wideNoballIllegalAgain: true }
  });
  assert.match(twoOvers, /except the last 2 overs/);

  // lastOverRules enabled but the wide/no-ball-specific flag off -- no exception to mention.
  const noException = nonStandardRulesText({
    ...DEFAULT_RULES,
    wideNoballCountsAsBall: true,
    lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: false }
  });
  assert.doesNotMatch(noException, /except/);
});

// wideNoballLastOverExceptionLabel is the shared building block behind the "(except the last
// over)" wording above -- also consumed directly by SetupScreen's own collapsed rules summary
// (see tests/unit/components/setupScreen.test.js), so it's tested on its own here too.
test("wideNoballLastOverExceptionLabel: null unless lastOverRules.wideNoballIllegalAgain is on, else a pluralized label", () => {
  assert.equal(wideNoballLastOverExceptionLabel(DEFAULT_RULES), null);
  assert.equal(wideNoballLastOverExceptionLabel({ lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: false } }), null);
  assert.equal(wideNoballLastOverExceptionLabel({ lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: true } }), "last over");
  assert.equal(wideNoballLastOverExceptionLabel({ lastOverRules: { enabled: true, overCount: 3, wideNoballIllegalAgain: true } }), "last 3 overs");
});

test("nonStandardRulesText: notes bigHitRuns/maxHitRuns independently when set, silent when off", () => {
  assert.doesNotMatch(nonStandardRulesText({ ...DEFAULT_RULES, bigHitRuns: null, maxHitRuns: null }) || "", /Hit bonus/i);
  const bigOnly = nonStandardRulesText({ ...DEFAULT_RULES, bigHitRuns: 10 });
  assert.match(bigOnly, /Big Hit bonus \(10 runs\)/);
  assert.doesNotMatch(bigOnly, /Maximum Hit/);
  const both = nonStandardRulesText({ ...DEFAULT_RULES, bigHitRuns: 10, maxHitRuns: 15 });
  assert.match(both, /Big Hit bonus \(10 runs\)/);
  assert.match(both, /Maximum Hit bonus \(15 runs\)/);
});

test("nonStandardRulesText: calls out impactPlayerMaxSubs when it's above the standard 1", () => {
  const text = nonStandardRulesText({ ...DEFAULT_RULES, impactPlayerEnabled: true, impactPlayerMaxSubs: 2 });
  assert.match(text, /Impact Player substitution \(up to 2 per team\)/);
});

test("nonStandardRulesText: stays silent on maxOversPerBowler -- SetupScreen defaults it to a computed non-null value on every match, so it isn't a real deviation signal", () => {
  const text = nonStandardRulesText({ ...DEFAULT_RULES, maxOversPerBowler: 4 });
  assert.equal(text, null);
});

test("impactSubsText: null with no substitutions, one line per sub joined with a dot", () => {
  assert.equal(impactSubsText(null), null);
  assert.equal(impactSubsText([]), null);
  assert.equal(
    impactSubsText([{ team: "Riverside CC", outName: "Virat Kohli", inName: "Hardik Pandya" }]),
    "Hardik Pandya on for Virat Kohli (Riverside CC)"
  );
  assert.equal(
    impactSubsText([
      { team: "Riverside CC", outName: "Virat Kohli", inName: "Hardik Pandya" },
      { team: "Oakwood CC", outName: "Ben Stokes", inName: "Jofra Archer" }
    ]),
    "Hardik Pandya on for Virat Kohli (Riverside CC) · Jofra Archer on for Ben Stokes (Oakwood CC)"
  );
});

test("tossText: describes the toss decision, or just who won it if none was recorded", () => {
  assert.equal(tossText(null), null);
  assert.equal(tossText({ wonBy: "A", decision: "Bat" }), "A won the toss, chose to bat");
  assert.equal(tossText({ wonBy: "A" }), "A won the toss");
});

test("umpiresText: pluralizes correctly, null when neither umpire is set", () => {
  assert.equal(umpiresText({}), null);
  assert.equal(umpiresText({ umpire1: "U1" }), "Umpire: U1");
  assert.equal(umpiresText({ umpire1: "U1", umpire2: "U2" }), "Umpires: U1, U2");
});

test("matchResultText: No result takes priority even with only one innings, then win/tie by runs or wickets", () => {
  assert.equal(matchResultText({ status: "complete", noResult: true, innings: [{ runs: 10 }] }), "No result");
  assert.equal(matchResultText({ status: "live", innings: [{}, {}] }), null);
  const chase = {
    status: "complete",
    innings: [
      { runs: 150, wickets: 10, maxWickets: 10 },
      { battingTeam: "B", runs: 151, wickets: 4, maxWickets: 10 }
    ]
  };
  assert.equal(matchResultText(chase), "B won by 6 wickets");
  const tied = {
    status: "complete",
    innings: [{ battingTeam: "A", runs: 150 }, { battingTeam: "B", runs: 150, maxWickets: 10 }]
  };
  assert.equal(matchResultText(tied), "Match tied");
  const defended = {
    status: "complete",
    innings: [{ battingTeam: "A", runs: 150 }, { battingTeam: "B", runs: 120, maxWickets: 10 }]
  };
  assert.equal(matchResultText(defended), "A won by 30 runs");
});

test("matchScoreLine: live score line while in progress, falls back to matchResultText once complete", () => {
  const live = {
    status: "live", currentInningIndex: 0,
    innings: [{ battingTeam: "A", runs: 86, wickets: 3, legalBalls: 62, ballsPerOver: 6, battingOrder: ["P1"] }]
  };
  assert.equal(matchScoreLine(live), "A 86-3 (10.2 ov)");
  assert.equal(matchScoreLine({ status: "complete", innings: [] }), null);
});

test("chasingInfo: null once the second innings is complete or doesn't exist yet", () => {
  assert.equal(chasingInfo({ innings: [{}] }), null);
  assert.equal(chasingInfo({ innings: [{}, { complete: true }] }), null);
});

test("chasingInfo: computes target, balls left, runs needed, and required rate", () => {
  const match = { innings: [{ runs: 150 }, { runs: 80, legalBalls: 60, ballsPerOver: 6 }], oversLimit: 20 };
  const info = chasingInfo(match);
  assert.equal(info.target, 151);
  assert.equal(info.ballsLeft, 60);
  assert.equal(info.runsNeeded, 71);
  assert.equal(info.reqRate, "7.10");
});

test("buildShareText: includes toss, per-innings score lines, and result once complete", () => {
  const match = {
    teamA: "A", teamB: "B", status: "complete",
    toss: { wonBy: "A", decision: "Bat" },
    innings: [{ battingTeam: "A", runs: 150, wickets: 10, legalBalls: 120, ballsPerOver: 6, battingOrder: ["P1"], maxWickets: 10 }],
    playerOfMatch: "P1"
  };
  const text = buildShareText(match);
  assert.match(text, /A vs B/);
  assert.match(text, /A won the toss, chose to bat/);
  assert.match(text, /A: 150-10/);
  assert.match(text, /Player of the Match: P1/);
});

test("buildFixtureShareText: includes tournament name, formatted date, and venue when given", () => {
  const text = buildFixtureShareText("Summer Cup", { teamA: "A", teamB: "B", date: "2026-06-14T15:30" }, "The Green");
  assert.match(text, /A vs B/);
  assert.match(text, /Summer Cup/);
  assert.match(text, /The Green/);
});

test("pollExpiryDateLabel: null with no createdAt, otherwise a date label 120 days out", () => {
  assert.equal(pollExpiryDateLabel(null), null);
  assert.equal(typeof pollExpiryDateLabel(Date.now()), "string");
});

test("buildMapsUrl: prefers venue text, falls back to lat/lng, then an empty query", () => {
  assert.match(buildMapsUrl("The Green", 51.5, -0.1), /query=The%20Green/);
  assert.match(buildMapsUrl(null, 51.5, -0.1), /query=51.5,-0.1/);
  assert.match(buildMapsUrl(null, null, null), /query=$/);
});

test("resolvePollTeams: matches a fixture's two team names against every club's rosters, case-insensitively", () => {
  const clubs = [{ id: "c1" }, { id: "c2" }];
  const clubTeamsById = {
    c1: [{ id: "t1", name: "Eagles" }],
    c2: [{ id: "t2", name: "hawks" }]
  };
  const matches = resolvePollTeams("EAGLES", "Falcons", clubs, clubTeamsById);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].team.name, "Eagles");
});

test("buildPollUrl/buildFollowUrl: fall back to a relative link when window isn't available (as in Node)", () => {
  assert.equal(buildPollUrl("ABC123"), "?poll=ABC123");
  assert.equal(buildFollowUrl("XYZ789"), "?follow=XYZ789");
});

test("buildPollShareText: question, optional fixture date, then the poll link", () => {
  assert.equal(buildPollShareText("Who's in?", null, "CODE"), "Who's in?\n?poll=CODE");
  assert.equal(buildPollShareText("Who's in?", "Sat 14 Jun", "CODE"), "Who's in?\nSat 14 Jun\n?poll=CODE");
});

test("buildLiveShareText: shows a live prompt while in progress, the result once complete, always the link", () => {
  const live = { teamA: "A", teamB: "B", status: "live", innings: [] };
  assert.match(buildLiveShareText(live, "CODE"), /Follow live/);
  assert.match(buildLiveShareText(live, "CODE"), /\?follow=CODE/);
});
