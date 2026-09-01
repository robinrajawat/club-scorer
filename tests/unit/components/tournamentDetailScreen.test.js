// A single tournament's own screen (src/components/tournamentDetailScreen.js).
// `loadTournamentMatches` runs from a mount-time useEffect -- a bare-global Firestore call, stubbed
// per test. `downloadCSV` (also a bare global) is stubbed only in the export test.
// `TournamentShareModal`/`QualificationCalculatorModal` reference Modal as a bare global.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TournamentDetailScreen } from "../../../src/components/tournamentDetailScreen.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.loadTournamentMatches;
  delete globalThis.downloadCSV;
  delete globalThis.Modal;
});

function tournamentFixture(overrides = {}) {
  return {
    id: "t1", name: "Summer Cup", teams: ["Riverside CC", "Oakwood CC"],
    fixtures: [{ id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: "m1" }],
    ...overrides
  };
}

function completedMatch(overrides = {}) {
  return {
    id: "m1", tournamentId: "t1", status: "complete", teamA: "Riverside CC", teamB: "Oakwood CC",
    innings: [
      {
        battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 200, wickets: 3, legalBalls: 120, ballsPerOver: 6, maxWickets: 10,
        batsmen: { "Virat Kohli": { runs: 120, balls: 90, out: false } }, bowlers: {},
        battingOrder: ["Virat Kohli"], bowlingOrder: []
      },
      {
        battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 150, wickets: 10, legalBalls: 100, ballsPerOver: 6, maxWickets: 10,
        batsmen: {}, bowlers: { "Jasprit Bumrah": { wickets: 6, ballsBowled: 24, runs: 20 } },
        battingOrder: [], bowlingOrder: ["Jasprit Bumrah"]
      }
    ],
    ...overrides
  };
}

async function renderScreen(tournament, matches, extraProps = {}) {
  globalThis.loadTournamentMatches = () => Promise.resolve(matches);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(TournamentDetailScreen, {
      tournament, onBack: () => {}, onStartMatch: () => {}, onStartFixtureMatch: () => {},
      onUpdateTournament: () => Promise.resolve(), onOpenMatch: () => {}, onDeleteTournament: () => {},
      onOpenRecords: () => {}, ...extraProps
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("TournamentDetailScreen: shows a loading state before matches resolve, without crashing", () => {
  globalThis.loadTournamentMatches = () => new Promise(() => {});
  const inst = renderer.create(React.createElement(TournamentDetailScreen, {
    tournament: tournamentFixture(), onBack: () => {}, onStartMatch: () => {}, onStartFixtureMatch: () => {},
    onUpdateTournament: () => {}, onOpenMatch: () => {}, onDeleteTournament: () => {}, onOpenRecords: () => {}
  }));
  assert.doesNotThrow(() => inst.toJSON());
  assert.equal(hasText(inst.toJSON(), "Loading standings"), true);
});

test("TournamentDetailScreen: shows the tournament name and Orange/Purple Cap once loaded", async () => {
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Summer Cup/);
  assert.match(text, /Orange Cap/);
  assert.match(text, /Virat Kohli/);
  assert.match(text, /Purple Cap/);
  assert.match(text, /Jasprit Bumrah/);
});

test("TournamentDetailScreen: switching to the Standings tab shows the standings table", async () => {
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  const standingsTab = inst.root.findAllByType("button").find(b => b.props.children === "Standings");
  act(() => { standingsTab.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Riverside CC/);
});

test("TournamentDetailScreen: switching to the Matches tab shows the completed match with its result text", async () => {
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  const matchesTab = inst.root.findAllByType("button").find(b => b.props.children === "Matches");
  act(() => { matchesTab.props.onClick(); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC won by 50 runs/);
});

test("TournamentDetailScreen: clicking a match on the Matches tab calls onOpenMatch", async () => {
  let opened = null;
  const inst = await renderScreen(tournamentFixture(), [completedMatch()], { onOpenMatch: id => { opened = id; } });
  const matchesTab = inst.root.findAllByType("button").find(b => b.props.children === "Matches");
  act(() => { matchesTab.props.onClick(); });
  const matchBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  matchBtn.props.onClick();
  assert.equal(opened, "m1");
});

test("TournamentDetailScreen: editing Player of the Tournament saves via onUpdateTournament", async () => {
  let updatedWith = null;
  const inst = await renderScreen(tournamentFixture(), [completedMatch()], {
    onUpdateTournament: t => { updatedWith = t; return Promise.resolve(); }
  });
  const changeBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Edit"));
  act(() => { changeBtn.props.onClick(); });

  const select = inst.root.findByType("select");
  act(() => { select.props.onChange({ target: { value: "Virat Kohli" } }); });

  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedWith.playerOfTournament, "Virat Kohli");
});

test("TournamentDetailScreen: 'Delete' opens a ConfirmModal, and confirming calls onDeleteTournament", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deleted = null;
  const inst = await renderScreen(tournamentFixture(), [completedMatch()], { onDeleteTournament: t => { deleted = t; } });
  const deleteBtn = inst.root.findAllByType("button").find(b => b.props.children === "Delete");
  act(() => { deleteBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  act(() => { modal.props.onConfirm(); });
  assert.equal(deleted.id, "t1");
});

test("TournamentDetailScreen: the share button opens TournamentShareModal", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  const shareBtn = inst.root.findByProps({ "aria-label": "Share tournament" });
  act(() => { shareBtn.props.onClick(); });
  assert.ok(inst.root.findByProps({ "data-stub-modal": true }));
});

test("TournamentDetailScreen: the qualification calculator button opens QualificationCalculatorModal", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  const standingsTab = inst.root.findAllByType("button").find(b => b.props.children === "Standings");
  act(() => { standingsTab.props.onClick(); });
  const qualBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Qualification calculator"));
  act(() => { qualBtn.props.onClick(); });
  assert.ok(inst.root.findByProps({ "data-stub-modal": true }));
});

test("TournamentDetailScreen: on the Stats tab, 'Export CSV' calls downloadCSV with the batting leaderboard", async () => {
  let downloadedWith = null;
  globalThis.downloadCSV = (filename, headers, rows) => { downloadedWith = { filename, headers, rows }; };
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  const statsTab = inst.root.findAllByType("button").find(b => b.props.children === "Stats");
  act(() => { statsTab.props.onClick(); });
  const exportBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Export CSV"));
  act(() => { exportBtn.props.onClick(); });
  assert.match(downloadedWith.filename, /Summer-Cup-batting/);
  assert.ok(downloadedWith.rows.some(r => r[0] === "Virat Kohli"));
});
