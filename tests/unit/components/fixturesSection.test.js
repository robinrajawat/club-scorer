// A tournament's schedule tab (src/components/fixturesSection.js). Every write action is a prop
// (onUpdateTournament) -- no bare globals, no mount effect of its own. Each rendered fixture goes
// through FixtureRow, which has its own mount-time loadFixturePollSummary effect and Modal
// bare-global reference, so those are stubbed here too (same pattern as fixtureRow.test.js).

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FixturesSection } from "../../../src/components/fixturesSection.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";
import { FixtureRow } from "../../../src/components/fixtureRow.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  globalThis.loadFixturePollSummary = () => Promise.resolve([]);
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadFixturePollSummary;
});

function tournament(overrides = {}) {
  return {
    id: "t1", name: "Summer Cup", teams: ["Riverside CC", "Oakwood CC"], fixtures: [],
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(FixturesSection, {
    matches: [], onStartFixtureMatch: () => {}, onUpdateTournament: () => Promise.resolve(),
    onOpenMatch: () => {}, onOpenRecords: () => {}, ...props
  }));
}

test("FixturesSection: with no fixtures, 'Generate Round-Robin' calls onUpdateTournament with generated fixtures", async () => {
  let updatedWith = null;
  const inst = render({
    tournament: tournament(),
    onUpdateTournament: t => { updatedWith = t; return Promise.resolve(); }
  });
  const genBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Generate Round-Robin"));
  await act(async () => {
    genBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedWith.fixtures.length, 1);
  assert.equal(updatedWith.fixtures[0].teamA, "Riverside CC");
  assert.equal(updatedWith.fixtures[0].teamB, "Oakwood CC");
});

test("FixturesSection: 'Home & Away' generates a double round-robin (two fixtures for two teams)", async () => {
  let updatedWith = null;
  const inst = render({
    tournament: tournament(),
    onUpdateTournament: t => { updatedWith = t; return Promise.resolve(); }
  });
  const homeAwayBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Home & Away"));
  await act(async () => {
    homeAwayBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedWith.fixtures.length, 2);
});

test("FixturesSection: canManage=false hides generate/add/clear controls and shows an owner-only note", () => {
  const inst = render({ tournament: tournament(), canManage: false });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /only the club owner can add them/);
  assert.doesNotMatch(text, /Generate Round-Robin/);
});

test("FixturesSection: 'Add a fixture' lets you pick two teams and calls onUpdateTournament with the new fixture appended", async () => {
  let updatedWith = null;
  const existing = { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: null };
  const inst = render({
    tournament: tournament({ fixtures: [existing] }),
    onUpdateTournament: t => { updatedWith = t; return Promise.resolve(); }
  });
  const addBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Add a fixture"));
  act(() => { addBtn.props.onClick(); });

  const selects = inst.root.findAllByType("select");
  act(() => { selects[0].props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { selects[1].props.onChange({ target: { value: "Oakwood CC" } }); });

  const addFixtureBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Add Fixture");
  await act(async () => {
    addFixtureBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedWith.fixtures.length, 2);
  assert.equal(updatedWith.fixtures[1].teamA, "Riverside CC");
  assert.equal(updatedWith.fixtures[1].teamB, "Oakwood CC");
});

test("FixturesSection: scoring an already-started fixture calls onOpenMatch with the full match object, not just its id", () => {
  // BUG FIX: passing just f.matchId left openMatch with no way to find a co-owner's shared match
  // that this device had never independently opened before -- see cricketScorer.js's openMatch
  // comment. The already-resolved match object (matchById.get(f.matchId), which is how this
  // section already renders the fixture's live score) carries the shareCode that fixes it.
  const existing = { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: "m1" };
  const inProgressMatch = { id: "m1", tournamentId: "t1", status: "in-progress", teamA: "Riverside CC", teamB: "Oakwood CC", shareCode: "ABC123" };
  let opened = null;
  const inst = render({
    tournament: tournament({ fixtures: [existing] }),
    matches: [inProgressMatch],
    onOpenMatch: m => { opened = m; }
  });
  inst.root.findByType(FixtureRow).props.onScore();
  assert.equal(opened.id, "m1");
  assert.equal(opened.shareCode, "ABC123");
});

test("FixturesSection: deleting a fixture opens a ConfirmModal, and confirming removes it via onUpdateTournament", async () => {
  let updatedWith = null;
  const existing = { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: null };
  const inst = render({
    tournament: tournament({ fixtures: [existing] }),
    onUpdateTournament: t => { updatedWith = t; return Promise.resolve(); }
  });
  await act(async () => {
    const row = inst.root.findByType(FixtureRow);
    row.props.onDelete();
    await new Promise(r => setTimeout(r, 0));
  });
  const modal = inst.root.findByType(ConfirmModal);
  act(() => { modal.props.onConfirm(); });
  assert.equal(updatedWith.fixtures.length, 0);
});

test("FixturesSection: 'Clear all' opens a ConfirmModal, and confirming clears every fixture via onUpdateTournament", async () => {
  let updatedWith = null;
  const existing = { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: null };
  const inst = render({
    tournament: tournament({ fixtures: [existing] }),
    onUpdateTournament: t => { updatedWith = t; return Promise.resolve(); }
  });
  const clearBtn = inst.root.findAllByType("button").find(b => b.props.children === "Clear all");
  act(() => { clearBtn.props.onClick(); });
  const modal = inst.root.findByType(ConfirmModal);
  await act(async () => {
    modal.props.onConfirm();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(updatedWith.fixtures, []);
});

test("FixturesSection: once the group stage is complete, proposing the Final creates a seeded knockout fixture, and a decided Final shows the champion banner", async () => {
  const completedMatch = {
    id: "m1", tournamentId: "t1", status: "complete", teamA: "Riverside CC", teamB: "Oakwood CC",
    innings: [
      { battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 180, wickets: 4, legalBalls: 120, ballsPerOver: 6, maxWickets: 10 },
      { battingTeam: "Oakwood CC", bowlingTeam: "Riverside CC", runs: 150, wickets: 10, legalBalls: 110, ballsPerOver: 6, maxWickets: 10 }
    ]
  };
  const groupFixture = { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "", matchId: "m1" };
  let currentTournament = tournament({ fixtures: [groupFixture] });
  const inst = render({
    tournament: currentTournament, matches: [completedMatch],
    onUpdateTournament: t => { currentTournament = t; return Promise.resolve(); }
  });
  const proposeBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Propose Final"));
  assert.ok(proposeBtn, "Final should be proposable once the only group fixture is complete");
  await act(async () => {
    proposeBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(currentTournament.fixtures.length, 2);
  const finalFixture = currentTournament.fixtures[1];
  assert.equal(finalFixture.stage, "Final");
  assert.equal(finalFixture.teamA, "Riverside CC");
  assert.equal(finalFixture.teamB, "Oakwood CC");

  // Now the Final itself is decided (same completedMatch stands in for its result too) -- champion banner shows.
  const decidedFinalFixture = { ...finalFixture, matchId: "m1" };
  const inst2 = render({
    tournament: tournament({ fixtures: [groupFixture, decidedFinalFixture] }),
    matches: [completedMatch]
  });
  assert.match(JSON.stringify(inst2.toJSON()), /"Riverside CC"," won the tournament"/);
});
