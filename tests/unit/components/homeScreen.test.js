// The app's landing screen (src/components/homeScreen.js). `onLoadPublicPlayers` runs lazily from
// a useEffect only once the "Players" search chip is picked -- a prop, not a bare global. `Modal`
// (bare global) backs the delete-match confirm dialog. Renders AuthBar/UpcomingFixtureCard/
// InstallHintBanner/JoinCodeBar/SyncStatusBanner, all already tested on their own -- these tests
// focus on HomeScreen's own logic (match list, search, delete confirm) and default props avoid
// triggering UpcomingFixtureCard's own mount-effect stubs (no tournaments/fixtures passed).

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { HomeScreen } from "../../../src/components/homeScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { JoinCodeBar } from "../../../src/components/pickerAtoms.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

afterEach(() => {
  delete globalThis.Modal;
});

function match(overrides = {}) {
  return {
    id: "m1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "in-progress",
    oversLimit: 20, createdAt: Date.now(),
    ...overrides
  };
}

function baseProps(overrides = {}) {
  return {
    matches: [], onNew: () => {}, onOpen: () => {}, onDelete: () => {}, onManageTeams: () => {},
    onOpenClubs: () => {}, onOpenClub: () => {}, onOpenFederation: () => {}, user: null, profile: null,
    onOpenAccount: () => {}, onOpenInbox: () => {}, onOpenSharedLinks: () => {}, onOpenHelp: () => {},
    onOpenFeedback: () => {}, onOpenAbout: () => {}, onSignOut: () => Promise.resolve({ ok: true }),
    themePref: "system", onSetTheme: () => {}, onJoinCode: () => {}, onOpenTournaments: () => {},
    onOpenPlayer: () => {}, pendingCount: 0, onPendingSynced: () => {}, onOpenTournament: () => {},
    onScheduleFixture: () => {}, onStartFixture: () => {}, onEditVenue: () => {},
    teams: [], onOpenTeam: () => {}, onGetShareCode: () => {}, onGetViewCode: () => {},
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(HomeScreen, baseProps(props)));
}

test("HomeScreen: shows an empty state with no matches", () => {
  const inst = render();
  assert.match(JSON.stringify(inst.toJSON()), /No matches yet\./);
});

test("HomeScreen: 'New Match' calls onNew", () => {
  let called = false;
  const inst = render({ onNew: () => { called = true; } });
  const newBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "New Match"));
  newBtn.props.onClick();
  assert.equal(called, true);
});

test("HomeScreen: clicking a match card calls onOpen with its id", () => {
  let opened = null;
  const inst = render({ matches: [match()], onOpen: id => { opened = id; } });
  const clickable = inst.root.findByProps({ role: "button" });
  clickable.props.onClick();
  assert.equal(opened, "m1");
});

test("HomeScreen: utility buttons call onManageTeams/onOpenTournaments/onOpenClubs", () => {
  let managedTeams = false, openedTournaments = false, openedClubs = false;
  const inst = render({
    onManageTeams: () => { managedTeams = true; },
    onOpenTournaments: () => { openedTournaments = true; },
    onOpenClubs: () => { openedClubs = true; }
  });
  const teamsBtn = inst.root.findAllByProps({ label: "Teams" })[0];
  teamsBtn.props.onClick();
  const cupsBtn = inst.root.findAllByProps({ label: "Cups" })[0];
  cupsBtn.props.onClick();
  const clubsBtn = inst.root.findAllByProps({ label: "Clubs" })[0];
  clubsBtn.props.onClick();
  assert.equal(managedTeams, true);
  assert.equal(openedTournaments, true);
  assert.equal(openedClubs, true);
});

test("HomeScreen: JoinCodeBar's onJoin prop is wired to onJoinCode", () => {
  let joinedWith = null;
  const inst = render({ onJoinCode: code => { joinedWith = code; } });
  const joinBar = inst.root.findByType(JoinCodeBar);
  joinBar.props.onJoin("ABC123");
  assert.equal(joinedWith, "ABC123");
});

test("HomeScreen: deleting a match opens a confirm dialog, and confirming calls onDelete", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deletedId = null;
  const inst = render({ matches: [match()], onDelete: id => { deletedId = id; } });
  const row = inst.root.findByProps({ deleteLabel: "Delete" });
  act(() => { row.props.onDelete(); });

  const deleteBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Delete");
  act(() => { deleteBtn.props.onClick(); });
  assert.equal(deletedId, "m1");
});

// An in-progress match still has live scoring state at risk -- not just a finished record like a
// completed match -- so an accidental swipe-and-confirm there deserves a distinct, stronger
// warning instead of the same wording used for both.
test("HomeScreen: the delete confirmation warns more strongly for an in-progress match than a completed one", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inProgress = render({ matches: [match({ status: "in-progress" })] });
  act(() => { inProgress.root.findByProps({ deleteLabel: "Delete" }).props.onDelete(); });
  const inProgressText = JSON.stringify(inProgress.toJSON());
  assert.match(inProgressText, /Delete this in-progress match\?/);
  assert.match(inProgressText, /is still in progress — deleting it throws away everything scored so far/);

  const completed = render({ matches: [match({ status: "complete" })] });
  act(() => { completed.root.findByProps({ deleteLabel: "Delete" }).props.onDelete(); });
  const completedText = JSON.stringify(completed.toJSON());
  assert.match(completedText, /Delete this match\?/);
  assert.doesNotMatch(completedText, /Delete this in-progress match\?/);
  assert.match(completedText, /will be permanently removed from your saved matches/);
});

test("HomeScreen: 'In Progress'/'Completed' sections both render and collapse independently", () => {
  const inst = render({
    matches: [match({ id: "live1", status: "in-progress" }), match({ id: "done1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })]
  });
  let text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  // Completed starts collapsed since In Progress has content to separate it from.
  assert.doesNotMatch(text, /Hawks CC/);

  const completedToggle = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Completed ("));
  act(() => { completedToggle.props.onClick(); });
  text = JSON.stringify(inst.toJSON());
  assert.match(text, /Hawks CC/);
});

test("HomeScreen: searching narrows the matches shown", () => {
  const inst = render({
    matches: [match({ id: "m1", teamA: "Riverside CC" }), match({ id: "m2", teamA: "Hawks CC", teamB: "Eagles CC" })]
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  act(() => { search.props.onChange({ target: { value: "Riverside" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.doesNotMatch(text, /Hawks CC/);
});

test("HomeScreen: the 'Teams' search chip lists matching teams and opens one via onOpenTeam", () => {
  let opened = null;
  const inst = render({
    teams: [{ id: "t1", name: "Riverside 1st XI" }],
    onOpenTeam: t => { opened = t; }
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  act(() => { search.props.onChange({ target: { value: "Riverside" } }); });
  const teamsChip = inst.root.findAllByType("button").find(b => b.props.children === "Teams");
  act(() => { teamsChip.props.onClick(); });
  const resultRow = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside 1st XI"));
  resultRow.props.onClick();
  assert.equal(opened.id, "t1");
});

test("HomeScreen: the 'Cups' search chip lists matching tournaments and opens one via onOpenTournament", () => {
  let opened = null;
  const inst = render({
    tournaments: [{ id: "t1", name: "Summer Cup", teams: [] }],
    onOpenTournament: t => { opened = t; }
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  act(() => { search.props.onChange({ target: { value: "Summer" } }); });
  const cupsChip = inst.root.findAllByType("button").find(b => b.props.children === "Cups");
  act(() => { cupsChip.props.onClick(); });
  const resultRow = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Summer Cup"));
  resultRow.props.onClick();
  assert.equal(opened.id, "t1");
});

test("HomeScreen: the 'Clubs' search chip lists matching clubs and opens one via onOpenClub", () => {
  let openedId = null;
  const inst = render({
    clubs: [{ id: "c1", name: "Riverside CC" }],
    onOpenClub: id => { openedId = id; }
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  act(() => { search.props.onChange({ target: { value: "Riverside" } }); });
  const clubsChip = inst.root.findAllByType("button").find(b => b.props.children === "Clubs");
  act(() => { clubsChip.props.onClick(); });
  const resultRow = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  resultRow.props.onClick();
  assert.equal(openedId, "c1");
});

test("HomeScreen: picking the 'Players' search chip lazily loads the public player directory once", async () => {
  let loadCalls = 0;
  const inst = render({
    onLoadPublicPlayers: () => { loadCalls++; return Promise.resolve([]); }
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  act(() => { search.props.onChange({ target: { value: "x" } }); });
  const playersChip = inst.root.findAllByType("button").find(b => b.props.children === "Players");
  await act(async () => {
    playersChip.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(loadCalls, 1);
  // Switching away and back doesn't reload -- publicPlayers is cached once loaded.
  const matchesChip = inst.root.findAllByType("button").find(b => b.props.children === "Matches");
  act(() => { matchesChip.props.onClick(); });
  await act(async () => {
    playersChip.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(loadCalls, 1);
});

test("HomeScreen: showInstallHint renders InstallHintBanner wired to onDismissInstallHint", () => {
  let dismissed = false;
  const inst = render({ showInstallHint: true, onDismissInstallHint: () => { dismissed = true; } });
  const dismissBtn = inst.root.findByProps({ "aria-label": "Dismiss" });
  dismissBtn.props.onClick();
  assert.equal(dismissed, true);
});
