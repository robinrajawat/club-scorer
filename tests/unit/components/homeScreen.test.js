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
import { Trophy } from "../../../src/components/icons.js";

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

test("HomeScreen: no 'Live now' section when liveMatches is empty", () => {
  const inst = render();
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Live now/);
});

test("HomeScreen: 'Live now' shows each live match's teams and score, and tapping one calls onOpenLiveMatch with its id", () => {
  let openedId = null;
  const inst = render({
    liveMatches: [liveMatch()],
    onOpenLiveMatch: id => { openedId = id; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live now/);
  assert.match(json, /Riverside CC/);
  assert.match(json, /85-3/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { card.props.onClick(); });
  assert.equal(openedId, "live1");
});

test("HomeScreen: 'Live now' cards show a Trophy badge only for matches that belong to a tournament", () => {
  const inst = render({
    liveMatches: [
      liveMatch({ id: "live1", tournamentId: "t1" }),
      liveMatch({ id: "live2", teamA: "Downtown CC", teamB: "Hillside CC" })
    ]
  });
  const cards = inst.root.findAllByType("button").filter(b => b.props.style && b.props.style.width === 190);
  const tournamentCard = cards.find(b => hasText(b.props.children, "Riverside CC"));
  const plainCard = cards.find(b => hasText(b.props.children, "Downtown CC"));
  assert.equal(tournamentCard.findAllByType(Trophy).length, 1);
  assert.equal(plainCard.findAllByType(Trophy).length, 0);
});

test("HomeScreen: 'Live now' Trophy badge shows the tournament's name, resolved from liveTournaments for a tournament this account doesn't own", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    liveTournaments: [{ tournamentId: "t1", name: "Someone Else's Cup", shareCode: "ABC123", teamsCount: 4 }]
  });
  assert.match(JSON.stringify(inst.toJSON()), /Someone Else's Cup/);
});

test("HomeScreen: 'Live now' Trophy badge prefers tournamentNameById (this account's own) over liveTournaments when both have an entry", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    tournamentNameById: { t1: "My Own Cup" },
    // "Stale Public Name" also legitimately appears elsewhere on the page (the separate "Live
    // tournaments" strip, fed by this same liveTournaments prop, always shows a tournament's own
    // liveTournaments name regardless of tournamentNameById) -- so the assertion below is scoped
    // to just the "Live now" card itself, not the whole page's JSON.
    liveTournaments: [{ tournamentId: "t1", name: "Stale Public Name", shareCode: "ABC123", teamsCount: 4 }]
  });
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  assert.equal(hasText(card.props.children, "My Own Cup"), true);
  assert.equal(hasText(card.props.children, "Stale Public Name"), false);
});

test("HomeScreen: 'Live now' Trophy badge falls back to icon-only when the tournament's name can't be resolved", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })]
  });
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  assert.equal(card.findAllByType(Trophy).length, 1);
});

test("HomeScreen: no 'Live tournaments' section when liveTournaments is empty", () => {
  const inst = render();
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Live tournaments/);
});

test("HomeScreen: 'Live tournaments' shows each tournament's name and team count, and tapping one calls onOpenLiveTournament with its shareCode", () => {
  let openedCode = null;
  const inst = render({
    liveTournaments: [{ tournamentId: "t1", name: "Summer Cup", shareCode: "ABC123", teamsCount: 6 }],
    onOpenLiveTournament: code => { openedCode = code; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live tournaments/);
  assert.match(json, /Summer Cup/);
  // t.teamsCount is a raw number in the createElement call, converted to text by React only at
  // render time -- checked against the rendered JSON tree (where it's already a string), not
  // card.props.children (the pre-render prop, where it's still the number 6 and hasText's
  // string-only .includes check would never match it).
  assert.match(json, /"6"/);
  assert.match(json, /team/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Summer Cup"));
  act(() => { card.props.onClick(); });
  assert.equal(openedCode, "ABC123");
});

test("HomeScreen: 'Live now' caps its preview to 3 cards and a 'See all' card opens the full Live screen", () => {
  const matches = [1, 2, 3, 4, 5].map(n => liveMatch({ id: `live${n}`, teamA: `Team ${n}`, teamB: "Oakwood CC" }));
  let openedLive = false;
  const inst = render({
    liveMatches: matches,
    onOpenLive: () => { openedLive = true; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Team 1/);
  assert.match(json, /Team 3/);
  assert.doesNotMatch(json, /Team 4/);
  assert.doesNotMatch(json, /Team 5/);
  assert.match(json, /See all/);
  assert.match(json, /"\+","2"/);
  const seeAll = inst.root.findAllByType("button").find(b => hasText(b.props.children, "See all"));
  act(() => { seeAll.props.onClick(); });
  assert.equal(openedLive, true);
});

test("HomeScreen: 'Live now' shows no 'See all' card when there are 3 or fewer live matches", () => {
  const matches = [1, 2, 3].map(n => liveMatch({ id: `live${n}`, teamA: `Team ${n}`, teamB: "Oakwood CC" }));
  const inst = render({ liveMatches: matches });
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /See all/);
});

test("HomeScreen: 'Live tournaments' caps its preview to 3 cards and a 'See all' card opens the full Live screen", () => {
  const tournaments = [1, 2, 3, 4].map(n => ({ tournamentId: `t${n}`, name: `Cup ${n}`, shareCode: `CODE${n}`, teamsCount: 4 }));
  let openedLive = false;
  const inst = render({
    liveTournaments: tournaments,
    onOpenLive: () => { openedLive = true; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Cup 1/);
  assert.match(json, /Cup 3/);
  assert.doesNotMatch(json, /Cup 4/);
  assert.match(json, /See all/);
  assert.match(json, /"\+","1"/);
  const seeAll = inst.root.findAllByType("button").find(b => hasText(b.props.children, "See all"));
  act(() => { seeAll.props.onClick(); });
  assert.equal(openedLive, true);
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
