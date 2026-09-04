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
import { VenueEditModal } from "../../../src/components/venueAndDateModals.js";

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
  delete globalThis.loadFixturePollSummary;
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

// fixtureRow.js already falls back to `fixture.venue || tournament.venue` for any fixture that
// hasn't set its own venue -- but until now there was no UI to actually set `tournament.venue` at
// all. Useful for a one-day/one-ground tournament where re-entering the venue per fixture is pure
// repetition.
test("TournamentDetailScreen: offers to add a default venue when unset, and edits it via VenueEditModal", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let updated = null;
  const inst = await renderScreen(tournamentFixture(), [completedMatch()], {
    onUpdateTournament: t => { updated = t; return Promise.resolve(); }
  });
  const addBtn = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Add tournament venue");
  assert.ok(addBtn, "an add-venue affordance is offered when none is set");
  act(() => { addBtn.props.onClick(); });

  const venueModal = inst.root.findByType(VenueEditModal);
  act(() => { venueModal.props.onSave("Riverside Oval", 12.34, 56.78); });
  assert.equal(updated.venue, "Riverside Oval");
  assert.equal(updated.venueLat, 12.34);
  assert.equal(updated.venueLng, 56.78);
});

test("TournamentDetailScreen: toggling Visibility calls onToggleVisibility with the tournament", async () => {
  let toggledWith = null;
  const inst = await renderScreen(tournamentFixture({ private: false }), [completedMatch()], {
    onToggleVisibility: t => { toggledWith = t; return Promise.resolve({ ok: true }); }
  });
  const visibilityToggle = inst.root.findAllByProps({ "aria-label": "Make private" })[0];
  assert.ok(visibilityToggle, "starts public, so the switch offers to make it private");
  act(() => { visibilityToggle.props.onClick(); });
  assert.equal(toggledWith.id, "t1");
});

test("TournamentDetailScreen: no Visibility toggle when canManage is false", async () => {
  const inst = await renderScreen(tournamentFixture({ private: false }), [completedMatch()], {
    canManage: false, onToggleVisibility: () => Promise.resolve({ ok: true })
  });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Visibility/);
});

test("TournamentDetailScreen: shows the venue as a Maps link with an edit affordance once set", async () => {
  const inst = await renderScreen(tournamentFixture({ venue: "Riverside Oval", venueLat: 12.34, venueLng: 56.78 }), [completedMatch()]);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside Oval/);
  const editBtn = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Edit tournament venue");
  assert.ok(editBtn, "an edit affordance replaces the add-venue one once a venue is set");
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

test("TournamentDetailScreen: clicking a match on the Matches tab calls onOpenMatch with the full match object", async () => {
  // The full object, not just its id -- opening a co-owner's shared-but-never-locally-opened
  // match needs its shareCode, which only this already-loaded object has (see openMatch's own
  // comment in cricketScorer.js for why a plain id alone isn't enough).
  let opened = null;
  const inst = await renderScreen(tournamentFixture(), [completedMatch()], { onOpenMatch: m => { opened = m; } });
  const matchesTab = inst.root.findAllByType("button").find(b => b.props.children === "Matches");
  act(() => { matchesTab.props.onClick(); });
  const matchBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  matchBtn.props.onClick();
  assert.equal(opened.id, "m1");
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

// An in-progress tournament still has live state at risk (a scheduled fixture not yet played, or
// a match still being scored) -- not just a finished record like a fully-completed one -- so it
// deserves a distinct, stronger delete warning instead of the same wording used for both.
test("TournamentDetailScreen: the delete confirmation warns more strongly while a fixture is still unplayed", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  globalThis.loadFixturePollSummary = () => Promise.resolve([]);
  const withUnplayedFixture = tournamentFixture({
    fixtures: [
      { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: "m1" },
      { id: "f2", teamA: "Oakwood CC", teamB: "Riverside CC", date: "", matchId: null }
    ]
  });
  const inst = await renderScreen(withUnplayedFixture, [completedMatch()]);
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Delete").props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  assert.equal(modal.props.title, "Delete this in-progress tournament?");
  assert.match(modal.props.message, /is still in progress — deleting it loses its schedule, groups, and standings/);
});

test("TournamentDetailScreen: the delete confirmation stays the plain wording once every fixture is complete", async () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await renderScreen(tournamentFixture(), [completedMatch()]);
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Delete").props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  assert.equal(modal.props.title, "Delete this tournament?");
  assert.match(modal.props.message, /Matches already scored in it are untouched/);
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
