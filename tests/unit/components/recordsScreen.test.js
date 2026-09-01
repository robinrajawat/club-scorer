// A club's/federation's Record Book (src/components/recordsScreen.js).
// `loadFederationTournaments`/`loadClubTournaments`/`loadTournamentMatches` all run together from a
// single mount-time useEffect -- bare-global Firestore calls, stubbed per test.
// `downloadMultiSectionCSV` (also a bare global) is only called from the export button's handler.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { RecordsScreen } from "../../../src/components/recordsScreen.js";
import { ISO_DATETIME_RE } from "../../../src/core/shareAndFormat.js";

// computeTournamentPlacement (src/core/appLogic.js, spliced as part of the app-logic module)
// references ISO_DATETIME_RE as a bare global -- real in public/index.html's single script scope,
// where shareAndFormat.js's own module is already loaded earlier in the file, but undefined here
// under Node without this stub.
globalThis.ISO_DATETIME_RE = ISO_DATETIME_RE;

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.loadFederationTournaments;
  delete globalThis.loadClubTournaments;
  delete globalThis.loadTournamentMatches;
  delete globalThis.downloadMultiSectionCSV;
});

function tournament(overrides = {}) {
  return {
    id: "t1", name: "Summer Cup", teams: ["Riverside CC", "Oakwood CC"],
    fixtures: [{ id: "f1", stage: "Final", matchId: "m1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "2026-05-01T14:00" }],
    createdAt: Date.now(),
    ...overrides
  };
}

function finalMatch(overrides = {}) {
  return {
    id: "m1", tournamentId: "t1", status: "complete", createdAt: Date.now(),
    teamA: "Riverside CC", teamB: "Oakwood CC",
    innings: [
      {
        battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 200, wickets: 3, legalBalls: 120, ballsPerOver: 6, maxWickets: 10,
        batsmen: { "Virat Kohli": { runs: 120, balls: 90, out: false } }, bowlers: {}
      },
      {
        battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 150, wickets: 10, legalBalls: 100, ballsPerOver: 6, maxWickets: 10,
        batsmen: {}, bowlers: { "Jasprit Bumrah": { wickets: 6, ballsBowled: 24, runs: 20 } }
      }
    ],
    ...overrides
  };
}

async function renderScreen(sourceType, tournaments, matches, extraProps = {}) {
  globalThis.loadClubTournaments = () => Promise.resolve(sourceType === "club" ? tournaments : []);
  globalThis.loadFederationTournaments = () => Promise.resolve(sourceType === "federation" ? tournaments : []);
  globalThis.loadTournamentMatches = () => Promise.resolve(matches);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(RecordsScreen, {
      sourceType, sourceId: "src1", sourceName: "Riverside CC", onBack: () => {}, ...extraProps
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("RecordsScreen: club sourceType loads via loadClubTournaments and shows centuries/five-wicket hauls", async () => {
  const inst = await renderScreen("club", [tournament()], [finalMatch()]);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Virat Kohli/);
  assert.match(text, /Jasprit Bumrah/);
});

test("RecordsScreen: federation sourceType loads via loadFederationTournaments, not loadClubTournaments", async () => {
  let clubCalled = false;
  globalThis.loadClubTournaments = () => { clubCalled = true; return Promise.resolve([]); };
  globalThis.loadFederationTournaments = () => Promise.resolve([tournament()]);
  globalThis.loadTournamentMatches = () => Promise.resolve([finalMatch()]);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(RecordsScreen, {
      sourceType: "federation", sourceId: "fed1", sourceName: "County League", onBack: () => {}
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(clubCalled, false);
  assert.match(JSON.stringify(inst.toJSON()), /Virat Kohli/);
});

test("RecordsScreen: shows the champion's placement and a 'most decorated' banner for a single title leader", async () => {
  const inst = await renderScreen("club", [tournament()], [finalMatch()]);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Summer Cup/);
  assert.match(text, /Riverside CC.*most decorated, 1 title/);
});

test("RecordsScreen: team filter narrows records to matches that team actually played in", async () => {
  const otherMatch = finalMatch({
    id: "m2", tournamentId: "t1", teamA: "Hawks CC", teamB: "Eagles CC",
    innings: [
      { battingTeam: "Hawks CC", bowlingTeam: "Eagles CC", runs: 90, wickets: 10, legalBalls: 100, ballsPerOver: 6, maxWickets: 10, batsmen: { "Someone Else": { runs: 105, balls: 80, out: false } }, bowlers: {} },
      { battingTeam: "Eagles CC", bowlingTeam: "Hawks CC", runs: 91, wickets: 2, legalBalls: 60, ballsPerOver: 6, maxWickets: 10, batsmen: {}, bowlers: {} }
    ]
  });
  const inst = await renderScreen("club", [tournament()], [finalMatch(), otherMatch]);
  assert.match(JSON.stringify(inst.toJSON()), /Someone Else/);

  const teamSelect = inst.root.findByType("select");
  act(() => { teamSelect.props.onChange({ target: { value: "Riverside CC" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Virat Kohli/);
  assert.doesNotMatch(text, /Someone Else/);
});

test("RecordsScreen: current-year tab excludes matches created before this calendar year", async () => {
  const lastYear = new Date(new Date().getFullYear() - 1, 5, 1).getTime();
  const oldMatch = finalMatch({ id: "m2", createdAt: lastYear, innings: [
    { battingTeam: "Hawks CC", bowlingTeam: "Eagles CC", runs: 90, wickets: 10, legalBalls: 100, ballsPerOver: 6, maxWickets: 10, batsmen: { "Old Timer": { runs: 110, balls: 80, out: false } }, bowlers: {} },
    { battingTeam: "Eagles CC", bowlingTeam: "Hawks CC", runs: 40, wickets: 10, legalBalls: 60, ballsPerOver: 6, maxWickets: 10, batsmen: {}, bowlers: {} }
  ] });
  const inst = await renderScreen("club", [tournament()], [oldMatch]);
  assert.match(JSON.stringify(inst.toJSON()), /Old Timer/);

  const currentYearTab = inst.root.findAllByType("button").find(b => b.props.children === String(new Date().getFullYear()));
  act(() => { currentYearTab.props.onClick(); });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Old Timer/);
});

test("RecordsScreen: player search narrows the leaderboard tables to matching names", async () => {
  const inst = await renderScreen("club", [tournament()], [finalMatch()]);
  const searchField = inst.root.findByType("input");
  act(() => { searchField.props.onChange({ target: { value: "Bumrah" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Jasprit Bumrah/);
  assert.doesNotMatch(text, /Virat Kohli/);
});

test("RecordsScreen: 'Export all as CSV' calls downloadMultiSectionCSV with a filename derived from sourceName", async () => {
  let downloadedWith = null;
  globalThis.downloadMultiSectionCSV = (filename, sections) => { downloadedWith = { filename, sections }; };
  const inst = await renderScreen("club", [tournament()], [finalMatch()]);
  const exportBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Export all as CSV"));
  act(() => { exportBtn.props.onClick(); });
  assert.match(downloadedWith.filename, /^Riverside-CC-record-book-all-time$/);
  assert.ok(Array.isArray(downloadedWith.sections));
});
