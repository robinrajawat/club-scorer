// The app's landing screen (src/components/homeScreen.js). `Modal` (bare global) backs the
// delete-match confirm dialog. Renders AuthBar/UpcomingFixtureCard/
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
import { TAB_BAR_HEIGHT } from "../../../src/components/tabBar.js";

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
// The FabButton HomeScreen renders (its "New Match" FAB) calls ReactDOM.createPortal(...,
// document.body) internally -- a bare global, same as Modal -- but react-test-renderer has no real
// DOM to portal into, so this stub just renders the portal's children in place instead. Fine here:
// these tests only check the button itself (by aria-label) exists and wires onClick, never its
// real position in the document -- that's covered on its own in screenAtoms.test.js.
beforeEach(() => {
  globalThis.loadFixturePollSummary = () => Promise.resolve([]);
  globalThis.fetchFixtureWeather = () => Promise.resolve(null);
  globalThis.ReactDOM = { createPortal: node => node };
  globalThis.document = { body: null }; // FabButton reads document.body as the portal target
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadFixturePollSummary;
  delete globalThis.fetchFixtureWeather;
  delete globalThis.ReactDOM;
  delete globalThis.document;
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
    user: null, profile: null,
    onOpenAccount: () => {}, onOpenInbox: () => {}, onOpenSharedLinks: () => {}, onOpenHelp: () => {},
    onOpenFeedback: () => {}, onOpenAbout: () => {}, onSignOut: () => Promise.resolve({ ok: true }),
    themePref: "system", onSetTheme: () => {}, onJoinCode: () => {}, onOpenTournaments: () => {},
    pendingCount: 0, onPendingSynced: () => {}, onOpenTournament: () => {},
    onScheduleFixture: () => {}, onStartFixture: () => {}, onEditVenue: () => {},
    onGetShareCode: () => {}, onGetViewCode: () => {},
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(HomeScreen, baseProps(props)));
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
  // Passes the full match object, not just its id -- opening a co-owner's shared-but-never-
  // locally-opened match needs its shareCode, which only this already-loaded object has (see
  // openMatch's own comment in cricketScorer.js for why a plain id alone isn't enough).
  let opened = null;
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
    onOpen: m => { opened = m; }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Continue scoring/);
  assert.match(json, /Riverside CC/);
  assert.match(json, /85-3/);
  assert.match(json, /Summer Cup/);
  const card = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { card.props.onClick(); });
  assert.equal(opened.id, "m1");
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
  assert.match(String(withBar.props.style.paddingBottom), new RegExp(`calc\\(${TAB_BAR_HEIGHT}px \\+ 40px \\+ max\\(env\\(safe-area-inset-bottom\\), 12px\\)\\)`));
});

test("HomeScreen: shows an empty state with no in-progress matches or upcoming fixtures", () => {
  const inst = render();
  assert.match(JSON.stringify(inst.toJSON()), /Nothing to score right now\./);
});

// "New Match" is a floating "+" (FabButton, bottom-right, thumb-reachable) rather than a top-of-
// screen labeled button now -- icon-only, so it's found by its aria-label, not its text.
test("HomeScreen: the floating 'New Match' button calls onNew", () => {
  let called = false;
  const inst = render({ onNew: () => { called = true; } });
  const newBtn = inst.root.findByProps({ "aria-label": "New Match" });
  newBtn.props.onClick();
  assert.equal(called, true);
});

test("HomeScreen: clicking a match card calls onOpen with the full match object, not just its id", () => {
  let opened = null;
  const inst = render({ matches: [match()], onOpen: m => { opened = m; } });
  const clickable = inst.root.findByProps({ role: "button" });
  clickable.props.onClick();
  assert.equal(opened.id, "m1");
});

// Reported live: "date/time is missing, also missing if the match was group stage, qualifier,
// semi or final". A tournament match's card shows its stage next to the tournament name (falling
// back to "Group Stage" when the match has none of its own -- see startNewMatch's own comment on
// when that's set), and its played date/time under the score line.
test("HomeScreen: a match card shows its tournament stage and played date/time", () => {
  const known = new Date();
  known.setHours(15, 5, 0, 0);
  const withStage = render({
    matches: [match({ tournamentId: "t1", stage: "Semifinal", createdAt: known.getTime() })],
    tournamentNameById: { t1: "Summer Cup" }
  });
  let json = JSON.stringify(withStage.toJSON());
  assert.match(json, /Summer Cup/);
  assert.match(json, /Semifinal/);
  assert.match(json, /3:05 PM/);

  const groupMatch = render({
    matches: [match({ tournamentId: "t1", stage: null })],
    tournamentNameById: { t1: "Summer Cup" }
  });
  json = JSON.stringify(groupMatch.toJSON());
  assert.match(json, /Group Stage/, "falls back to Group Stage when the match has no stage of its own");
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
test("HomeScreen: the delete confirmation warns strongly for an in-progress match, and more mildly for a completed one", () => {
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
  assert.match(completedText, /will be permanently removed from your saved matches/);
});

// Score is the admin home for standalone matches now (mirrors Cups for tournaments/series) --
// reported live, "within score we can have a control on the matches". A completed match with
// nothing else on the page (no in-progress match, no upcoming fixture) forces its Completed fold
// open by the same "don't fold the only content" rule Upcoming already uses, so the screen never
// looks empty at a glance just because history is collapsed-by-default.
test("HomeScreen: a completed match, alone on the page, shows in an auto-expanded Completed section", () => {
  const inst = render({
    matches: [match({ id: "done1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })]
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Hawks CC/);
  assert.doesNotMatch(text, /Nothing to score right now\./);
});

// Completed folds independently of In Progress -- collapsed by default once there's other content
// on the page (an in-progress match to actually act on), same as Upcoming already behaves relative
// to In Progress.
test("HomeScreen: Completed is collapsed by default alongside an in-progress match, and expands on tap", () => {
  const inst = render({
    matches: [match({ id: "live1", status: "in-progress" }), match({ id: "done1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })]
  });
  let text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.doesNotMatch(text, /Hawks CC/, "collapsed by default once there's an in-progress match on the page too");

  const completedToggle = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Completed ("));
  assert.ok(completedToggle, "the Completed fold toggle renders");
  act(() => { completedToggle.props.onClick(); });
  text = JSON.stringify(inst.toJSON());
  assert.match(text, /Hawks CC/);
});

test("HomeScreen: 'In Progress' has no fold toggle when nothing else is on the page -- the matches just show", () => {
  const inst = render({ matches: [match({ id: "live1", status: "in-progress" })] });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.doesNotMatch(text, /In Progress \(/, "no toggle needed when there's nothing below to fold away from");
});

// BUG FIX: the same "collapsed-by-default section re-forces itself open" bug this app already hit
// once on the old Completed fold (reported live as "Home page completed doesn't collapse when all
// matches are completed") applies just as much to Upcoming now that it's the one section left with
// a "nothing else on the page" auto-expand default. Two fixtures here, not one -- the nearest one
// also shows in the separate, always-visible "Next up" teaser regardless of this fold's state (by
// design, same as before this change), so only the second fixture's name is a reliable signal of
// whether the Upcoming list itself is actually showing.
test("HomeScreen: 'Upcoming' can actually be collapsed even when it's the only section on the page", () => {
  const tournaments = [{
    id: "t1", name: "Summer Cup",
    fixtures: [
      { id: "f-soonest", teamA: "Soonest CC", teamB: "Oakwood CC", date: "2026-09-05T10:00" },
      { id: "f-later", teamA: "Hawks CC", teamB: "Eagles CC", date: "2026-09-20T10:00" }
    ]
  }];
  const inst = render({ tournaments });
  // Forced open by default -- nothing else (no in-progress match) to separate it from.
  let upcomingToggle = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Upcoming ("));
  assert.ok(upcomingToggle, "the Upcoming fold toggle renders");
  let text = JSON.stringify(inst.toJSON());
  assert.match(text, /Hawks CC/);

  act(() => { upcomingToggle.props.onClick(); });
  text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /Hawks CC/, "the explicit tap to collapse must actually stick, not get silently re-forced open");

  // And tapping again reopens it, same as any other fold.
  upcomingToggle = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Upcoming ("));
  act(() => { upcomingToggle.props.onClick(); });
  text = JSON.stringify(inst.toJSON());
  assert.match(text, /Hawks CC/);
});

test("HomeScreen: showInstallHint renders InstallHintBanner wired to onDismissInstallHint", () => {
  let dismissed = false;
  const inst = render({ showInstallHint: true, onDismissInstallHint: () => { dismissed = true; } });
  const dismissBtn = inst.root.findByProps({ "aria-label": "Dismiss" });
  dismissBtn.props.onClick();
  assert.equal(dismissed, true);
});
