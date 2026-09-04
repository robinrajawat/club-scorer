// The app's landing screen (src/components/homeScreen.js). `onLoadPublicPlayers` runs lazily from
// a useEffect only once the "Players" search chip is picked -- a prop, not a bare global. `Modal`
// (bare global) backs the delete-match confirm dialog. Renders AuthBar/UpcomingFixtureCard/
// InstallHintBanner/JoinCodeBar/SyncStatusBanner, all already tested on their own -- these tests
// focus on HomeScreen's own logic (match list, search, delete confirm) and default props avoid
// triggering UpcomingFixtureCard's own mount-effect stubs (no tournaments/fixtures passed).

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
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

// UpcomingFixtureCard (rendered by the "Next up" section once `tournaments` carries an unstarted
// fixture) fires mount-time useEffects that call these as bare globals -- same stubs as
// upcomingFixtureCard.test.js itself. Harmless for every other test here, which passes no
// tournaments/fixtures at all so UpcomingFixtureCard never mounts.
beforeEach(() => {
  globalThis.loadFixturePollSummary = () => Promise.resolve([]);
  globalThis.fetchFixtureWeather = () => Promise.resolve(null);
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadFixturePollSummary;
  delete globalThis.fetchFixtureWeather;
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
    matches: [], onNew: () => {}, onOpen: () => {}, onDelete: () => {},
    onOpenClub: () => {}, onOpenFederation: () => {}, user: null, profile: null,
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

function liveMatch(overrides = {}) {
  return {
    id: "live1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "in-progress",
    oversLimit: 20, currentInningIndex: 0,
    innings: [{
      battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
      runs: 85, wickets: 3, legalBalls: 72, ballsPerOver: 6,
      battingOrder: ["Virat Kohli"], bowlingOrder: ["Jasprit Bumrah"]
    }],
    ...overrides
  };
}

test("HomeScreen: no 'Next up' section when there are no unstarted fixtures", async () => {
  let inst;
  await act(async () => {
    inst = render();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Next up/);
});

test("HomeScreen: 'Next up' shows the nearest unstarted fixture (by date) across every tournament, and calls onStartFixture from it", async () => {
  const tournaments = [
    {
      id: "t1", name: "Summer Cup", venue: null,
      fixtures: [
        { id: "f-later", teamA: "Later CC", teamB: "Oakwood CC", date: "2026-09-20T10:00" },
        { id: "f-soonest", teamA: "Soonest CC", teamB: "Oakwood CC", date: "2026-09-05T10:00" },
        { id: "f-started", teamA: "Started CC", teamB: "Oakwood CC", date: "2026-09-01T10:00", matchId: "m-already" }
      ]
    }
  ];
  let startedFixtureId = null;
  let inst;
  await act(async () => {
    inst = render({
      // A filler in-progress match so the separate, further-down "Upcoming" section (which lists
      // every unstarted fixture, not just the nearest one) stays collapsed by default rather than
      // auto-expanding -- it only auto-expands when there's nothing else on the page, which would
      // otherwise also render "Later CC" down there and make the doesNotMatch assertions below
      // fail for a reason unrelated to what this test is actually checking.
      matches: [match()],
      tournaments,
      onStartFixture: (t, f) => { startedFixtureId = f.id; }
    });
    await new Promise(r => setTimeout(r, 0));
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Next up/);
  assert.match(json, /Soonest CC/);
  assert.doesNotMatch(json, /Later CC/);
  assert.doesNotMatch(json, /Started CC/);
  const startBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Start match"));
  await act(async () => { startBtn.props.onClick(); });
  assert.equal(startedFixtureId, "f-soonest");
});

test("HomeScreen: no 'Continue scoring' hero when there's no in-progress match", () => {
  const inst = render({ matches: [match({ status: "complete" })] });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Continue scoring/);
});

test("HomeScreen: 'Continue scoring' hero shows an in-progress match's teams/score/tournament badge, and tapping the card calls onOpen", () => {
  let openedId = null;
  const inst = render({
    matches: [match({
      id: "m1", status: "in-progress", tournamentId: "t1",
      innings: [{
        battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC",
        runs: 85, wickets: 3, legalBalls: 72, ballsPerOver: 6,
        battingOrder: ["Virat Kohli"], bowlingOrder: ["Jasprit Bumrah"]
      }]
    })],
    tournamentNameById: { t1: "Summer Cup" },
    onOpen: id => { openedId = id; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Continue scoring/);
  assert.match(json, /Riverside CC/);
  assert.match(json, /85-3/);
  assert.match(json, /Summer Cup/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { card.props.onClick(); });
  assert.equal(openedId, "m1");
});

test("HomeScreen: 'Continue scoring' hero shows every in-progress match, not just one", () => {
  const inst = render({
    matches: [
      match({ id: "m1", teamA: "Riverside CC", teamB: "Oakwood CC" }),
      match({ id: "m2", teamA: "Hawks CC", teamB: "Eagles CC" })
    ]
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Riverside CC/);
  assert.match(json, /Hawks CC/);
});

test("HomeScreen: reserves extra bottom padding for the fixed TabBar when showTabBar is set", () => {
  const withoutBar = render().toJSON();
  const withBar = render({ showTabBar: true }).toJSON();
  assert.equal(withoutBar.props.style.paddingBottom, 40);
  assert.match(String(withBar.props.style.paddingBottom), /calc\(58px \+ 40px \+ env\(safe-area-inset-bottom\)\)/);
});

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
    // Both completed (not in-progress) so neither shows up a second time in the "Continue
    // scoring" hero, which isn't filtered by the search query -- that would make "Hawks CC"
    // legitimately present on the page for a reason unrelated to what this test checks.
    matches: [match({ id: "m1", teamA: "Riverside CC", status: "complete" }), match({ id: "m2", teamA: "Hawks CC", teamB: "Eagles CC", status: "complete" })]
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  act(() => { search.props.onChange({ target: { value: "Riverside" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.doesNotMatch(text, /Hawks CC/);
});

test("HomeScreen: typing a search query lazily fetches app-wide live/recent matches once and shows a matching one under 'Across Club Scorer'", async () => {
  let loadCalls = 0;
  const inst = render({
    onLoadRecentMatches: () => { loadCalls++; return Promise.resolve([liveMatch({ id: "other1", teamA: "Hawks CC", teamB: "Eagles CC" })]); }
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  await act(async () => {
    search.props.onChange({ target: { value: "Hawks" } });
    await new Promise(r => setTimeout(r, 0));
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Across Club Scorer/);
  assert.match(text, /Hawks CC/);
  assert.equal(loadCalls, 1);
  // A second keystroke re-filters the already-fetched list in memory, no second fetch.
  await act(async () => {
    search.props.onChange({ target: { value: "Hawks C" } });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(loadCalls, 1);
});

test("HomeScreen: a recent-match search result already in this account's own Saved Matches is not shown twice", async () => {
  const inst = render({
    matches: [match({ id: "own1", teamA: "Hawks CC", teamB: "Eagles CC" })],
    onLoadRecentMatches: () => Promise.resolve([liveMatch({ id: "own1", teamA: "Hawks CC", teamB: "Eagles CC" })])
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  await act(async () => {
    search.props.onChange({ target: { value: "Hawks" } });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Across Club Scorer/);
});

test("HomeScreen: tapping an 'Across Club Scorer' result calls onOpenLiveMatch with its id", async () => {
  let openedId = null;
  const inst = render({
    onOpenLiveMatch: id => { openedId = id; },
    onLoadRecentMatches: () => Promise.resolve([liveMatch({ id: "other1", teamA: "Hawks CC", teamB: "Eagles CC" })])
  });
  const search = inst.root.findAllByType("input").find(i => i.props.placeholder === "Search everything…");
  await act(async () => {
    search.props.onChange({ target: { value: "Hawks" } });
    await new Promise(r => setTimeout(r, 0));
  });
  const row = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Hawks CC"));
  act(() => { row.props.onClick(); });
  assert.equal(openedId, "other1");
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
