// The full-list "See all" destination for the Home screen's Live now / Live tournaments preview
// strips (src/components/liveScreen.js): the unbounded /liveMatches + /liveTournaments feeds,
// browsable as two independent axes -- Matches/Tournaments (a segmented control) and, within
// each, Live/Results or Live/Recently Finished (a pill row) -- plus the loading and empty states.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { LiveScreen } from "../../../src/components/liveScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

// Exact-match version of hasText -- used to check for the *absence* of a standalone "Live" text
// node (the page's own former title) without also tripping on "Live (5)"/"Live matches..." text
// that legitimately still exists elsewhere on the screen.
function hasExactText(node, str) {
  if (typeof node === "string") return node === str;
  if (Array.isArray(node)) return node.some(n => hasExactText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasExactText(node.children, str);
  return false;
}

function findButton(inst, text) {
  return inst.root.findAllByType("button").find(b => hasText(b.props.children, text));
}

function clickButton(inst, text) {
  act(() => { findButton(inst, text).props.onClick(); });
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

// Wrapped in act() so the mount-time smart-default effect (see liveScreen.js's own top comment)
// has already flushed by the time a test makes its first assertion, same as any other effect a
// test needs settled before reading rendered output.
function render(props) {
  let inst;
  act(() => { inst = renderer.create(React.createElement(LiveScreen, { ...props })); });
  return inst;
}

test("LiveScreen: shows an empty state and no tabs at all when both feeds are empty", () => {
  const inst = render();
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Nothing live right now/);
  assert.doesNotMatch(json, /Matches/);
  assert.doesNotMatch(json, /Tournaments/);
});

test("LiveScreen: shows a loading indicator instead of the empty state while loading and both feeds are still empty", () => {
  const inst = render({ loading: true });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Loading/);
  assert.doesNotMatch(json, /Nothing live right now/);
});

test("LiveScreen: shows real data instead of the loading indicator once at least one feed has something, even while still loading", () => {
  const inst = render({ loading: true, liveMatches: [liveMatch()] });
  const json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Loading…/);
  assert.match(json, /Riverside CC/);
});

test("LiveScreen: lands on Matches/Live by default, lists every live match (uncapped) with its score line and tournament badge, and opens it on tap", () => {
  let openedId = null;
  const matches = [1, 2, 3, 4, 5].map(n => liveMatch({ id: `live${n}`, teamA: `Team ${n}` }));
  matches[0].tournamentId = "t1";
  const inst = render({
    liveMatches: matches,
    onOpenLiveMatch: id => { openedId = id; },
    tournamentNameById: { t1: "Summer Cup" }
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live \(5\)/);
  assert.match(json, /Results \(0\)/);
  assert.match(json, /Team 1/);
  assert.match(json, /Team 5/);
  assert.match(json, /Summer Cup/);
  assert.match(json, /85-3/);
  const card = findButton(inst, "Team 5");
  act(() => { card.props.onClick(); });
  assert.equal(openedId, "live5");
});

// Requested live: "we need to reduce friction... as a user to find the completed tournaments/
// matches," then "finished living inside live is misleading" once that first fix just added a
// second scrollable section still headed by the word "Live." Live/Results (matches) and
// Live/Recently Finished (tournaments) are now real, switchable tabs: Live is always what you
// land on, and the other tab is a deliberate tap, never something you scroll past.
test("LiveScreen: Results is a separate tab from Live, switched by tapping, not scrolled to", () => {
  const inst = render({
    liveMatches: [
      liveMatch({ id: "live1", teamA: "Riverside CC" }),
      liveMatch({
        id: "done1", teamA: "Hawks CC", teamB: "Eagles CC", status: "complete",
        innings: [
          { battingTeam: "Hawks CC", bowlingTeam: "Eagles CC", runs: 150, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10, battingOrder: ["P1"], bowlingOrder: ["P2"] },
          { battingTeam: "Eagles CC", bowlingTeam: "Hawks CC", runs: 100, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10, battingOrder: ["P2"], bowlingOrder: ["P1"] }
        ]
      })
    ]
  });
  // Live tab (the default): only the live match shows.
  let json = JSON.stringify(inst.toJSON());
  assert.match(json, /Riverside CC/);
  assert.doesNotMatch(json, /Hawks CC/);

  clickButton(inst, "Results (1)");
  json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Riverside CC/, "switching to Results hides the live match");
  assert.match(json, /Hawks CC/);
  assert.match(json, /Hawks CC won by 50 runs/, "a finished match shows its result, not a live score line");

  clickButton(inst, "Live (1)");
  json = JSON.stringify(inst.toJSON());
  assert.match(json, /Riverside CC/, "switching back to Live shows it again");
  assert.doesNotMatch(json, /Hawks CC/);
});

test("LiveScreen: no standalone 'Live' page title above the segmented control -- a page branded 'Live' holding a Results tab was the more literal version of the same mislabeling complaint", () => {
  const inst = render({ liveMatches: [liveMatch()] });
  assert.equal(hasExactText(inst.toJSON(), "Live"), false);
});

// Reported live: "Live can not be the entry point for general results/fixtures... if the match/
// tournament is not ongoing or upcoming." Landing on an empty Live tab when a segment has data but
// none of it is currently live reads exactly like that -- the smart default below picks the tab
// that actually has something in it, once, the first time real data settles.
test("LiveScreen: Matches defaults to Results instead of an empty Live tab when nothing in it is currently live", () => {
  const finished = liveMatch({
    id: "done1", teamA: "Hawks CC", teamB: "Eagles CC", status: "complete",
    innings: [
      { battingTeam: "Hawks CC", bowlingTeam: "Eagles CC", runs: 150, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10, battingOrder: ["P1"], bowlingOrder: ["P2"] },
      { battingTeam: "Eagles CC", bowlingTeam: "Hawks CC", runs: 100, wickets: 10, legalBalls: 120, ballsPerOver: 6, maxWickets: 10, battingOrder: ["P2"], bowlingOrder: ["P1"] }
    ]
  });
  const inst = render({ liveMatches: [finished] });
  assert.equal(findButton(inst, "Results (1)").props["aria-pressed"], true);
  assert.equal(findButton(inst, "Live (0)").props["aria-pressed"], false);
  assert.match(JSON.stringify(inst.toJSON()), /Hawks CC/, "the finished match's own row shows without an extra tap");
});

// Requested live: "Watcher lands on a screen where he can see the live matches/tournaments as
// well as the completed ones... fixtures/standing/point tables/stats." Every publicly-live
// tournament's own upcoming fixtures (liveTournaments[].upcomingFixtures -- see
// pickUpcomingFixtures in appLogic.js) get flattened here into one app-wide, nearest-first list.
test("LiveScreen: Matches' Fixtures pill flattens every tournament's own upcoming fixtures, nearest first, and opens the tournament on tap", () => {
  let openedCode = null;
  const inst = render({
    liveMatches: [liveMatch()],
    liveTournaments: [
      { tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 4, upcomingFixtures: [
        { id: "f1", teamA: "Hawks CC", teamB: "Eagles CC", date: "2026-09-20T11:00" }
      ] },
      { tournamentId: "t2", name: "Winter League", shareCode: "CODE2", teamsCount: 6, upcomingFixtures: [
        { id: "f1", teamA: "Falcons CC", teamB: "Owls CC", date: "2026-09-12T15:00" }
      ] }
    ],
    onOpenLiveTournament: code => { openedCode = code; }
  });
  clickButton(inst, "Fixtures (2)");
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Falcons CC/);
  assert.match(json, /Hawks CC/);
  assert.match(json, /Winter League/);
  // Nearest-first across tournaments: Winter League's fixture (Sep 12) before Summer Cup's (Sep 20).
  assert.ok(json.indexOf("Falcons CC") < json.indexOf("Hawks CC"), "the sooner fixture, from a different tournament, sorts first");

  const card = findButton(inst, "Falcons CC");
  act(() => { card.props.onClick(); });
  assert.equal(openedCode, "CODE2", "tapping a fixture opens ITS tournament (no scorecard exists yet)");
});

// Reported live: "Live can not be the entry point for general results/fixtures... if the match/
// tournament is not ongoing or upcoming in a few days" -- Fixtures reads as more "live-adjacent"
// than a stale old result, so it outranks Results in the smart default (but never outranks an
// actually-live match).
test("LiveScreen: Matches defaults to Fixtures (not Results) when nothing's live but something's upcoming", () => {
  const finished = liveMatch({ id: "done1", status: "complete" });
  const inst = render({
    liveMatches: [finished],
    liveTournaments: [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 4, upcomingFixtures: [
      { id: "f1", teamA: "Hawks CC", teamB: "Eagles CC", date: "2026-09-20T11:00" }
    ] }]
  });
  assert.equal(findButton(inst, "Fixtures (1)").props["aria-pressed"], true);
  assert.equal(findButton(inst, "Results (1)").props["aria-pressed"], false);
  assert.equal(findButton(inst, "Live (0)").props["aria-pressed"], false);
});

test("LiveScreen: a fixture also matches search by team or tournament name", () => {
  const inst = render({
    liveTournaments: [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 4, upcomingFixtures: [
      { id: "f1", teamA: "Hawks CC", teamB: "Eagles CC", date: "2026-09-20T11:00" }
    ] }]
  });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "hawks" } }); });
  assert.equal(findButton(inst, "Fixtures (1)").props["aria-pressed"], true);
  act(() => { search.props.onChange({ target: { value: "summer cup" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Fixtures \(1\)/);
});

// Reported live: "the landing page looks too simple, no branding, no greetings" once WelcomeScreen
// stopped being the default landing screen, plus "no way to reopen the landing page... click on
// the brand should bring it to landing page." The brand header shows unconditionally -- Live is a
// real landing page (see cricketScorer.js's own fix keeping a returning signed-in visitor here
// instead of bouncing to Home), not a separate stripped-down "watcher" shell -- and resets the
// screen's own state on tap, since there's nowhere else to navigate to.
test("LiveScreen: brand header with a greeting shows unconditionally; tapping it resets search and tab state", () => {
  const inst = render({
    liveMatches: [liveMatch({ id: "done1", status: "complete" })]
  });
  assert.match(JSON.stringify(inst.toJSON()), /Club Scorer/);
  assert.match(JSON.stringify(inst.toJSON()), /Good (morning|afternoon|evening)/);

  clickButton(inst, "Results (1)");
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "nonexistent" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Nothing matches/);

  const brandBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Club Scorer"));
  act(() => { brandBtn.props.onClick(); });
  const json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Nothing matches/, "search was cleared");
  assert.equal(findButton(inst, "Results (1)").props["aria-pressed"], true, "re-picks the same smart default, not hardcoded back to Live");
});

test("LiveScreen: Tournaments defaults to Recently Finished when nothing in it is currently live", () => {
  const inst = render({
    liveTournaments: [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 6, champion: "Riverside CC" }]
  });
  clickButton(inst, "Tournaments");
  assert.equal(findButton(inst, "Recently Finished (1)").props["aria-pressed"], true);
  assert.equal(findButton(inst, "Live (0)").props["aria-pressed"], false);
});

test("LiveScreen: the smart default waits for loading to settle, and never overrides a tab already chosen", () => {
  const finished = liveMatch({ id: "done1", status: "complete" });
  const inst = render({ liveMatches: [], loading: true });
  // Still loading, nothing to react to yet -- Live stays the (only) shown state.
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Results/);

  act(() => { inst.update(React.createElement(LiveScreen, { liveMatches: [finished], loading: false })); });
  assert.equal(findButton(inst, "Results (1)").props["aria-pressed"], true, "picks Results once loading settles with nothing live");

  act(() => { findButton(inst, "Live (0)").props.onClick(); });
  act(() => { inst.update(React.createElement(LiveScreen, { liveMatches: [finished, liveMatch({ id: "live1" })], loading: false })); });
  assert.equal(findButton(inst, "Live (1)").props["aria-pressed"], true, "a later live match doesn't yank someone back off a tab they already chose");
});

// Reported live: a tournament that finished YESTERDAY sat one tap away under Tournaments while an
// entirely empty Matches segment greeted a first-time visitor instead. The segment-level smart
// default (pickDefaultView) fixes the WHICH-segment question the within-segment default never
// asked.
test("LiveScreen: lands on Tournaments (not empty Matches) when a tournament just finished and Matches has nothing at all", () => {
  const inst = render({
    liveTournaments: [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 6, champion: "Riverside CC" }]
  });
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Tournaments/);
  assert.match(json, /Recently Finished \(1\)/);
  assert.equal(findButton(inst, "Recently Finished (1)").props["aria-pressed"], true);
  assert.match(json, /Summer Cup/, "the finished tournament's own row shows without an extra tap");
});

test("LiveScreen: an upcoming fixture outranks a merely-undecided (not yet started) tournament for the segment default", () => {
  const inst = render({
    liveTournaments: [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 4, upcomingFixtures: [
      { id: "f1", teamA: "Hawks CC", teamB: "Eagles CC", date: "2026-09-20T11:00" }
    ] }]
  });
  // Lands on Matches/Fixtures, not Tournaments/Live -- a concrete fixture (which still shows its
  // own tournament badge, "Summer Cup") beats a bare, not-yet-decided tournament card with only a
  // team count.
  assert.equal(findButton(inst, "Matches").props["aria-pressed"], true);
  assert.equal(findButton(inst, "Fixtures (1)").props["aria-pressed"], true);
  assert.match(JSON.stringify(inst.toJSON()), /Hawks CC/);
});

// Reported live: "if we don't show account icon/menu then you don't present any app level
// information? like about, support, help." Live carries the same AuthBar HomeScreen's own header
// uses, unconditionally -- AuthBar itself already handles a signed-out `user` (a "Sign in" pill
// instead of an avatar), so no LiveScreen-specific sign-in affordance is needed here beyond wiring
// it through.
test("LiveScreen: shows the account menu (AuthBar), offering sign-in since there's no user", () => {
  const inst = render({ liveMatches: [liveMatch()] });
  const menuBtn = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Account menu");
  assert.ok(menuBtn, "AuthBar's own trigger button is present");
  assert.match(JSON.stringify(inst.toJSON()), /Sign in/);
});

test("LiveScreen: a match's tournament badge falls back to liveTournaments' name when it's not this account's own", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    liveTournaments: [{ tournamentId: "t1", name: "Someone Else's Cup", shareCode: "ABC123", teamsCount: 4 }]
  });
  assert.match(JSON.stringify(inst.toJSON()), /Someone Else's Cup/);
});

test("LiveScreen: switching to the Tournaments segment lists every live tournament (uncapped) with its team count, and opens it on tap", () => {
  let openedCode = null;
  const tournaments = [1, 2, 3, 4].map(n => ({ tournamentId: `t${n}`, name: `Cup ${n}`, shareCode: `CODE${n}`, teamsCount: n }));
  // A live match keeps Matches the smart-picked default segment here -- this test is about manual
  // switching, not the segment-level smart default (covered on its own elsewhere).
  const inst = render({
    liveMatches: [liveMatch()],
    liveTournaments: tournaments,
    onOpenLiveTournament: code => { openedCode = code; }
  });
  // Matches is the default segment -- Tournaments' own rows aren't shown until it's selected.
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Cup 1/);

  clickButton(inst, "Tournaments");
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live \(4\)/);
  assert.match(json, /Cup 1/);
  assert.match(json, /Cup 4/);
  const card = findButton(inst, "Cup 4");
  act(() => { card.props.onClick(); });
  assert.equal(openedCode, "CODE4");
});

// Same Live/[other tab] split as matches, keyed off `champion` (null until the tournament has a
// decided result -- see formatTournamentViewSnapshot in appLogic.js, mirrored onto this same
// /liveTournaments doc by shareTournament/refreshTournamentStandingsLive) since a tournament has
// no single status field of its own the way a match does. A finished tournament shows who won
// right on the row instead of the team count, so a viewer gets that answer without tapping in.
test("LiveScreen: Recently Finished is a separate tournaments tab, showing the winner on a finished row instead of the team count", () => {
  const inst = render({
    liveTournaments: [
      { tournamentId: "t1", name: "Ongoing Cup", shareCode: "CODE1", teamsCount: 4, champion: null },
      { tournamentId: "t2", name: "Summer Cup", shareCode: "CODE2", teamsCount: 6, champion: "Riverside CC" }
    ]
  });
  clickButton(inst, "Tournaments");
  let json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live \(1\)/);
  assert.match(json, /Recently Finished \(1\)/);
  assert.match(json, /Ongoing Cup/);
  assert.match(json, /4 teams/, "the ongoing tournament still shows its team count");
  assert.doesNotMatch(json, /Summer Cup/, "the finished one isn't shown on the Live tab");

  clickButton(inst, "Recently Finished (1)");
  json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Ongoing Cup/, "switching to Recently Finished hides the live one");
  assert.match(json, /Summer Cup/);
  // Rendered as separate text nodes ("Riverside CC", " won"), so checked separately rather than
  // as one contiguous string across a JSON.stringify array boundary.
  assert.match(json, /Riverside CC/, "the finished tournament shows who won instead");
  assert.match(json, / won/);
  assert.doesNotMatch(json, /6 teams/, "the finished tournament's row no longer shows a team count");
});

test("LiveScreen: no search box when there's genuinely nothing live, even once loading finishes", () => {
  const inst = render();
  assert.throws(() => inst.root.findByType("input"));
});

test("LiveScreen: search narrows whichever tab is currently open, and a tab with nothing left gets its own empty message", () => {
  const matches = [liveMatch({ id: "live1", teamA: "Riverside CC", teamB: "Oakwood CC" }), liveMatch({ id: "live2", teamA: "Thunder XI", teamB: "Lions CC" })];
  const tournaments = [{ tournamentId: "t1", name: "Summer Cup", shareCode: "CODE1", teamsCount: 4 }, { tournamentId: "t2", name: "Winter League", shareCode: "CODE2", teamsCount: 6 }];
  const inst = render({ liveMatches: matches, liveTournaments: tournaments });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "riverside" } }); });
  let json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live \(1\)/);
  assert.match(json, /Riverside CC/);
  assert.doesNotMatch(json, /Thunder XI/);

  // Switching to Tournaments while "riverside" is still the query -- no tournament matches it, so
  // this tab gets its own empty message rather than the app-wide "nothing matches" state (there
  // IS a match elsewhere, just not on this tab).
  clickButton(inst, "Tournaments");
  json = JSON.stringify(inst.toJSON());
  assert.match(json, /No live tournaments right now\./);
  assert.doesNotMatch(json, /Nothing matches/);

  act(() => { search.props.onChange({ target: { value: "winter" } }); });
  json = JSON.stringify(inst.toJSON());
  assert.match(json, /Live \(1\)/);
  assert.match(json, /Winter League/);
});

test("LiveScreen: a match also matches by its tournament badge name", () => {
  const inst = render({
    liveMatches: [liveMatch({ tournamentId: "t1" })],
    tournamentNameById: { t1: "Summer Cup" }
  });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "summer" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Live \(1\)/);
});

// Reported live: "instead sign in on top can lead to old signin landing page" -- a separate
// "Sign in to score a match" link used to sit at the bottom of the screen too, redundant once
// AuthBar's own "Sign in" (see the account-menu tests above) does the exact same thing. One way
// back to sign-in now, not two.
test("LiveScreen: no separate 'sign in to score a match' link -- AuthBar is the only way back", () => {
  const inst = render({ liveMatches: [liveMatch()] });
  assert.equal(findButton(inst, "Sign in to score a match"), undefined);
});

test("LiveScreen: shows a 'nothing matches' state (distinct from 'Nothing live right now') when a search has no results anywhere, and Clear resets it", () => {
  const inst = render({ liveMatches: [liveMatch()] });
  const search = inst.root.findByType("input");
  act(() => { search.props.onChange({ target: { value: "nonexistent team" } }); });
  let json = JSON.stringify(inst.toJSON());
  assert.match(json, /Nothing matches/);
  assert.doesNotMatch(json, /Nothing live right now/);

  const clearBtn = inst.root.findByProps({ "aria-label": "Clear search" });
  act(() => { clearBtn.props.onClick(); });
  json = JSON.stringify(inst.toJSON());
  assert.match(json, /Riverside CC/);
  assert.doesNotMatch(json, /Nothing matches/);
});

// Reported live: "user should be able to control their matches" -- an owned completed match keeps
// full owner actions (swipe-to-delete, Share, opens the real scoring/scorecard screen) instead of
// becoming a plain read-only public row just by sitting in the same Results list as everyone
// else's. Reuses homeScreen.js's own renderMatchCard (exported from there for exactly this) --
// same SwipeableRow/ShareMenu, not a second, duplicated card.
test("LiveScreen: an owned completed match in Results gets the full owner card (swipe-to-delete, opens via onOpen not onOpenLiveMatch)", () => {
  let opened = null;
  let openedLiveId = null;
  const inst = render({
    matches: [liveMatch({ id: "own1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })],
    onOpen: m => { opened = m; },
    onOpenLiveMatch: id => { openedLiveId = id; }
  });
  clickButton(inst, "Results (1)");
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Hawks CC/);
  assert.ok(inst.root.findByProps({ deleteLabel: "Delete" }), "owned match is swipeable, unlike a plain public row");

  const card = inst.root.findAllByProps({ role: "button" }).find(b => hasText(b.props.children, "Hawks CC"));
  act(() => { card.props.onClick(); });
  assert.equal(opened.id, "own1", "opens via onOpen (the real scoring/scorecard screen), not the read-only follow view");
  assert.equal(openedLiveId, null);
});

// De-duplicated against the public feed by id -- a match this account owns and has also shared
// publicly shows once, with owner actions, not a second time as a plain read-only public row too.
test("LiveScreen: a match that's both owned and in the public feed shows once, with owner actions", () => {
  const inst = render({
    matches: [liveMatch({ id: "shared1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })],
    liveMatches: [liveMatch({ id: "shared1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })]
  });
  clickButton(inst, "Results (1)");
  const json = JSON.stringify(inst.toJSON());
  assert.match(json, /Results \(1\)/, "counted once, not twice");
  assert.equal(inst.root.findAllByProps({ deleteLabel: "Delete" }).length, 1);
});

test("LiveScreen: deleting an owned match from Results opens a confirm dialog, and confirming calls onDelete", () => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let deletedId = null;
  const inst = render({
    matches: [liveMatch({ id: "own1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })],
    onDelete: id => { deletedId = id; }
  });
  clickButton(inst, "Results (1)");
  const row = inst.root.findByProps({ deleteLabel: "Delete" });
  act(() => { row.props.onDelete(); });
  const deleteBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Delete");
  act(() => { deleteBtn.props.onClick(); });
  assert.equal(deletedId, "own1");
  delete globalThis.Modal;
});

// BUG FIX: rawEmpty (the big "Nothing live right now" state, hiding the search/tabs UI entirely)
// used to only check the public feeds -- an account with only its own completed matches and no
// public live/results data at all would hit this branch and never be able to reach its own
// Results tab.
test("LiveScreen: an account with only its own completed matches (no public live data) still reaches Results, not the raw empty state", () => {
  const inst = render({
    matches: [liveMatch({ id: "own1", status: "complete", teamA: "Hawks CC", teamB: "Eagles CC" })]
  });
  const json = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(json, /Nothing live right now/);
  assert.match(json, /Hawks CC/);
});
