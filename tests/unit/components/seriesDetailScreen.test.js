// "Series" (teamA vs teamB over N fixtures) detail screen (src/components/seriesDetailScreen.js).
// `loadTournamentMatches` runs from a mount-time useEffect -- a bare-global Firestore call, not
// extracted -- so every test stubs it and wraps the initial render in act(). Each fixture renders
// through FixtureRow, which has its own mount-time loadFixturePollSummary effect and Modal
// bare-global reference, so those are stubbed here too (same pattern as fixtureRow.test.js).

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { SeriesDetailScreen } from "../../../src/components/seriesDetailScreen.js";
import { Btn, ConfirmModal } from "../../../src/components/formUiAtoms.js";
import { PlayerPicker } from "../../../src/components/pickerAtoms.js";
import { FixtureRow } from "../../../src/components/fixtureRow.js";

// Walks either a react-test-renderer toJSON() tree (children live at `.children`) or a live
// React element / `.props.children` value (children live at `.props.children`).
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
  delete globalThis.loadTournamentMatches;
});

function series(overrides = {}) {
  return {
    id: "s1",
    name: "Summer 3-Match Series",
    teamA: "Riverside 1st XI",
    teamB: "Oakwood CC",
    fixtures: [
      { id: "f1", teamA: "Riverside 1st XI", teamB: "Oakwood CC", date: "", matchId: "m1" },
      { id: "f2", teamA: "Riverside 1st XI", teamB: "Oakwood CC", date: "", matchId: null }
    ],
    ...overrides
  };
}

function completedMatch(overrides = {}) {
  return {
    id: "m1",
    tournamentId: "s1",
    status: "complete",
    innings: [
      { battingTeam: "Riverside 1st XI", runs: 150, battingOrder: ["Alex"], bowlingOrder: ["Sam"] },
      { battingTeam: "Oakwood CC", runs: 120, battingOrder: ["Sam"], bowlingOrder: ["Alex"] }
    ],
    ...overrides
  };
}

async function renderScreen(seriesObj, matches, extraProps = {}) {
  globalThis.loadTournamentMatches = () => Promise.resolve(matches);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(SeriesDetailScreen, {
      series: seriesObj, onBack: () => {}, onStartFixtureMatch: () => {}, onUpdateSeries: () => Promise.resolve(),
      onOpenMatch: () => {}, onDeleteSeries: () => {}, ...extraProps
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("SeriesDetailScreen: shows a loading state before matches resolve, without crashing", () => {
  globalThis.loadTournamentMatches = () => new Promise(() => {});
  const inst = renderer.create(React.createElement(SeriesDetailScreen, {
    series: series(), onBack: () => {}, onStartFixtureMatch: () => {}, onUpdateSeries: () => {}, onOpenMatch: () => {}, onDeleteSeries: () => {}
  }));
  assert.doesNotThrow(() => inst.toJSON());
  assert.equal(hasText(inst.toJSON(), "Loading"), true);
});

test("SeriesDetailScreen: shows the series name and one FixtureRow per fixture once loaded", async () => {
  const inst = await renderScreen(series(), [completedMatch()]);
  const tree = inst.toJSON();
  assert.equal(hasText(tree, "Summer 3-Match Series"), true);
  assert.equal(inst.root.findAllByType(FixtureRow).length, 2);
});

test("SeriesDetailScreen: computes and shows the running series score once a fixture is won", async () => {
  const inst = await renderScreen(series(), [completedMatch()]);
  assert.equal(hasText(inst.toJSON(), "Riverside 1st XI leads the series 1–0"), true);
});

test("SeriesDetailScreen: 'Add another match' calls onUpdateSeries with a new fixture appended", async () => {
  let updatedWith = null;
  const inst = await renderScreen(series(), [completedMatch()], {
    onUpdateSeries: s => { updatedWith = s; return Promise.resolve(); }
  });
  const addBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Add another match"));
  await act(async () => {
    addBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedWith.fixtures.length, 3);
  assert.equal(updatedWith.fixtures[2].teamA, "Riverside 1st XI");
});

test("SeriesDetailScreen: Player of the Series can be set manually via PlayerPicker, then saved", async () => {
  let updatedWith = null;
  const inst = await renderScreen(series(), [completedMatch()], {
    onUpdateSeries: s => { updatedWith = s; return Promise.resolve(); }
  });
  const setBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Set manually") || hasText(b.props.children, "Change"));
  act(() => { setBtn.props.onClick(); });

  const picker = inst.root.findByType(PlayerPicker);
  act(() => { picker.props.onChange("Alex"); });

  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(updatedWith.playerOfSeries, "Alex");
});

test("SeriesDetailScreen: 'Delete series' opens a ConfirmModal, and confirming calls onDeleteSeries", async () => {
  let deletedSeries = null;
  const inst = await renderScreen(series(), [completedMatch()], {
    onDeleteSeries: s => { deletedSeries = s; }
  });
  const deleteBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Delete series"));
  act(() => { deleteBtn.props.onClick(); });
  assert.ok(inst.root.findByType(ConfirmModal));

  const confirm = inst.root.findByType(ConfirmModal);
  act(() => { confirm.props.onConfirm(); });
  assert.equal(deletedSeries.id, "s1");
});

test("SeriesDetailScreen: canManage=false hides delete/add/edit-POS controls", async () => {
  const inst = await renderScreen(series(), [completedMatch()], { canManage: false });
  const tree = inst.toJSON();
  assert.equal(hasText(tree, "Delete series"), false);
  assert.equal(hasText(tree, "Add another match"), false);
  assert.equal(hasText(tree, "Set manually"), false);
});
