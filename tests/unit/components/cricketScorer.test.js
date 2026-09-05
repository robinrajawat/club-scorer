// The root app-shell component (src/components/cricketScorer.js): screen routing, auth session
// state, and every Firestore/Auth handler the app has. This is the single most bare-global-heavy
// component in the app -- rather than stub each of the ~80 handlers individually, a shared render()
// helper stubs the handful that actually fire unconditionally at mount (loadIndex/loadTeams/
// loadProfile/loadRules/loadTournaments/loadBetaStatus, loadClubs via refreshClubs,
// flushPendingWrites, and the `auth` object itself), plus whatever a specific test's own scenario
// needs on top of that.
//
// Unlike every other DOM-touching test file in this suite (see modal.test.js), the jsdom window/
// document is installed ONCE for the whole file in `before` and deliberately never torn down --
// CricketScorer's mount effect kicks off a genuinely deep chain of un-awaited async work
// (refreshClubs alone is three levels of Promise.all, one an intentionally-unawaited inner IIFE for
// federations -- see its own comment), and some continuation is still reachable well after even the
// last test's own act()-wrapped waits return. That continuation is harmless on its own -- a stale
// setState on an already-unmounted tree -- but CricketScorer's very first line reads
// `window.location` on every render, so a per-test `delete globalThis.window` (the pattern every
// other DOM-touching file in this suite uses) turns that harmless straggler into a real crash that
// wedges Node's process exit. `node --test` runs each test file in its own subprocess, so leaving
// `window`/`document`/`navigator`/`localStorage` defined for the rest of this file's process is
// harmless -- same as a real browser tab never tearing its own window down mid-session. Bare-global
// function stubs (loadIndex, auth, etc.) and CricketScorer instances are still reset per test. Any
// test that reaches the "match" screen mounts MatchScreen, which (per its own test file) runs a
// live InningsTimer interval that keeps node --test alive indefinitely if left unmounted -- every
// render()ed instance is tracked and unmounted in afterEach.
//
// This is a deliberately practical slice, not exhaustive coverage of all ~80 Firestore handlers --
// most are simple, mechanically similar CRUD wrappers (call a bare global, update the matching
// piece of state) already exercised in spirit by every screen's own test suite for the props it
// receives; testing each one again here from the root would be low-value repetition. What's tested
// here is specific to CricketScorer itself: initial-screen routing from the URL, the auth-state
// lifecycle, browser-history navigation, and a couple of representative handlers.

import test from "node:test";
import assert from "node:assert/strict";
import { before, beforeEach, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { CricketScorer } from "../../../src/components/cricketScorer.js";
import { WelcomeScreen } from "../../../src/components/welcomeScreen.js";
import { HomeScreen } from "../../../src/components/homeScreen.js";
import { TournamentsScreen } from "../../../src/components/tournamentsScreen.js";
import { SetupScreen } from "../../../src/components/setupScreen.js";
import { AccountScreen } from "../../../src/components/accountScreen.js";
import { FollowScreen } from "../../../src/components/followScreen.js";
import { MatchScreen } from "../../../src/components/matchScreen.js";

let dom;
let authCallback;
let mountedInstances = [];

before(() => {
  dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // Node 21+ ships a built-in read-only `navigator` global -- a plain assignment throws.
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.localStorage = dom.window.localStorage;
  dom.window.scrollTo = () => {}; // jsdom doesn't implement this; the app calls it on every screen change
});

// Deliberately no `after()` deleting these globals. CricketScorer's mount effect kicks off a
// genuinely deep chain of un-awaited async work (refreshClubs alone is three levels of Promise.all,
// one an intentionally-unawaited inner IIFE -- see its own comment), and some continuation is still
// reachable well after the last test's own act()-wrapped waits return -- harmless on its own (it's
// just a stale setState on an already-unmounted tree). The bug isn't that continuation; it's
// deleting `window`/`document` while it's still outstanding, which turns that harmless late
// continuation into a real crash (CricketScorer's very first line reads `window.location` on every
// render) that additionally seems to wedge Node's process exit. `node --test` runs each test file
// in its own subprocess, so leaving these defined for the rest of this file's process is harmless.

async function render(url) {
  dom.reconfigure({ url: url || "https://example.test/" });

  authCallback = null;
  globalThis.auth = {
    onAuthStateChanged: cb => { authCallback = cb; cb(null); return () => {}; },
    getRedirectResult: () => Promise.resolve(),
    currentUser: null
  };
  globalThis.loadIndex = () => Promise.resolve([]);
  globalThis.loadTeams = () => Promise.resolve([]);
  globalThis.loadProfile = () => Promise.resolve(null);
  globalThis.loadRules = () => Promise.resolve({});
  globalThis.loadTournaments = () => Promise.resolve([]);
  globalThis.loadBetaStatus = () => Promise.resolve(false);
  globalThis.loadClubs = () => Promise.resolve([]);
  // All four run on every signed-in mount regardless of what the user owns -- co-owner invites
  // cover ones addressed to my own email, federationRequests cover ones I sent (fromUid) or that
  // were addressed to something I owned as of send time (toOwnerUids), activity covers
  // notifications addressed to my own uid, profile visibility is just "do I have a
  // userDirectory doc" -- see each function's own comment in index.html -- so all four need a
  // stub even for a test whose signed-in user owns nothing.
  globalThis.loadMyCoOwnerInvites = () => Promise.resolve([]);
  globalThis.loadMyFederationRequests = () => Promise.resolve([]);
  globalThis.loadMyActivity = () => Promise.resolve([]);
  globalThis.loadMyProfileVisibility = () => Promise.resolve(false);
  // Unconditional-on-mount, signed-in-or-not, same reason each of the stubs above exists -- see
  // its own comment in cricketScorer.js. A listener, not a promise: returns an unsubscribe function
  // rather than resolving, same shape followScreen.test.js's onSnapshot stub captures for real.
  globalThis.loadLiveMatches = () => () => {};
  // Same reasoning as loadLiveMatches just above, for the "Live tournaments" feed subscription.
  globalThis.loadLiveTournaments = () => () => {};
  // Fire-and-forget auto-publish (maybeAutoPublishTournament) reaches these on every non-private
  // tournament creation/edit now, not just an explicit "Share" tap -- stubbed here so a test that
  // creates or edits a tournament doesn't hit an unstubbed bare global and produce an unhandled
  // rejection completely unrelated to what that test is actually checking.
  globalThis.shareTournament = () => Promise.resolve({ ok: true, code: "TESTCODE" });
  globalThis.refreshTournamentStandingsLive = () => Promise.resolve();
  globalThis.removeTournamentFromLiveFeed = () => Promise.resolve();
  globalThis.flushPendingWrites = () => Promise.resolve();
  globalThis.linkPlayerIfMatch = () => Promise.resolve();
  globalThis.loadMyPlayerProfile = () => Promise.resolve(null);
  globalThis.checkIsCollectionAdmin = () => Promise.resolve(false);
  globalThis.signInGoogle = () => Promise.resolve({ ok: true });
  // Referenced unconditionally as a bare prop value (`onSignOut: signOutUser`) on every render of
  // HomeScreen, not just when actually clicked -- needed even for tests that never sign out.
  globalThis.signOutUser = () => Promise.resolve({ ok: true });
  globalThis.loadPublicPlayers = () => Promise.resolve([]);
  // Referenced unconditionally as a bare prop value (`onLoadRecentMatches: fetchLiveAndRecentMatches`)
  // on every render of HomeScreen, same reason loadPublicPlayers above needs a stub -- never actually
  // called unless a test types into the search box, but the bare reference itself throws otherwise.
  globalThis.fetchLiveAndRecentMatches = () => Promise.resolve([]);

  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(CricketScorer, null));
    await new Promise(r => setTimeout(r, 0));
  });
  mountedInstances.push(inst);
  return inst;
}

async function flush() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

function signIn(inst, user = { uid: "u1", email: "robin@x.com", displayName: "Robin", providerData: [] }) {
  return act(async () => {
    authCallback(user);
    await new Promise(r => setTimeout(r, 0));
  });
}

beforeEach(() => {
  mountedInstances = [];
});

afterEach(() => {
  mountedInstances.forEach(inst => inst.unmount());
  mountedInstances = [];
  delete globalThis.auth;
  delete globalThis.loadIndex;
  delete globalThis.loadTeams;
  delete globalThis.loadProfile;
  delete globalThis.loadRules;
  delete globalThis.loadTournaments;
  delete globalThis.loadBetaStatus;
  delete globalThis.loadClubs;
  delete globalThis.flushPendingWrites;
  delete globalThis.linkPlayerIfMatch;
  delete globalThis.loadMyPlayerProfile;
  delete globalThis.checkIsCollectionAdmin;
  delete globalThis.signInGoogle;
  delete globalThis.signOutUser;
  delete globalThis.loadPublicPlayers;
  delete globalThis.fetchLiveAndRecentMatches;
  delete globalThis.fetchSharedMatch;
  delete globalThis.saveMatch;
  delete globalThis.saveRules;
  delete globalThis.saveTournaments;
  delete globalThis.db;
  delete globalThis.Modal;
  delete globalThis.loadMatch;
  delete globalThis.loadPublicTournamentName;
  delete globalThis.checkTournamentMatchShareStatus;
  delete globalThis.alert;
});

test("CricketScorer: signed out, mounts straight to WelcomeScreen once the initial load settles", async () => {
  const inst = await render();
  await flush();
  assert.ok(inst.root.findByType(WelcomeScreen));
});

test("CricketScorer: a ?follow=CODE URL routes straight to FollowScreen with that code", async () => {
  globalThis.db = { collection: () => ({ doc: () => ({ onSnapshot: () => () => {} }) }) };
  const inst = await render("https://example.test/?follow=abc123");
  await flush();
  const follow = inst.root.findByType(FollowScreen);
  assert.equal(follow.props.code, "ABC123");
});

test("CricketScorer: signing in from WelcomeScreen lands on Home", async () => {
  const inst = await render();
  await flush();
  const welcome = inst.root.findByType(WelcomeScreen);
  await act(async () => {
    welcome.props.onSignIn();
    await new Promise(r => setTimeout(r, 0));
  });
  await signIn(inst);
  assert.ok(inst.root.findByType(HomeScreen));
});

test("CricketScorer: Home's 'New Match' navigates to SetupScreen", async () => {
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onNew(); });
  assert.ok(inst.root.findByType(SetupScreen));
});

test("CricketScorer: the browser back button (popstate) navigates the app's own screen back", async () => {
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onOpenAccount(); });
  assert.ok(inst.root.findByType(AccountScreen));

  act(() => {
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate", { state: { screen: "home" } }));
  });
  assert.ok(inst.root.findByType(HomeScreen));
});

test("CricketScorer: joining a match by code opens it on the match screen", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const sharedMatch = {
    id: "shared1", teamA: "Riverside CC", teamB: "Oakwood CC", teamARoster: [], teamBRoster: [],
    oversLimit: 20, status: "in-progress", currentInningIndex: 0,
    innings: [{
      battingTeam: "Riverside CC", bowlingTeam: "Oakwood CC", runs: 0, wickets: 0, legalBalls: 0,
      overs: [[]], batsmen: {}, bowlers: {}, extras: {}, strikerName: "A", nonStrikerName: "B",
      bowlerName: "X", fallOfWickets: [], partnerships: [], complete: false, ballsPerOver: 6,
      maxWickets: 10
    }]
  };
  globalThis.fetchSharedMatch = () => Promise.resolve({ found: true, match: sharedMatch });
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  await act(async () => {
    home.props.onJoinCode("SHARE1");
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(inst.root.findByType(MatchScreen));
});

// BUG FIX: openMatch's own last-resort fallback (its "known match" argument, used when loadMatch
// itself fails) assumed that object was always a full match -- but the exact same shape gets
// handed back here from Home's own match list once a shared match has been opened even once
// (upsertLocalPointer's index entry deliberately has no innings -- see loadIndex/
// upsertLocalPointer in index.html). Falling back to that put a match with no innings into
// `match` state, which MatchScreen/PrintReport both assumed had real innings data unconditionally
// and crashed on. Reported live as a tournament match created by a club co-owner appearing on
// Home's "Continue scoring" but still refusing to actually open.
test("CricketScorer: opening a match whose only known copy has no innings data shows an error instead of crashing when loadMatch fails", async () => {
  globalThis.loadMatch = () => Promise.resolve(null); // simulates a network blip / revoked share code
  let alertMessage = null;
  globalThis.alert = msg => { alertMessage = msg; };
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  // The lightweight shape Home's own match list holds for a shared match once this device has
  // ever seen it -- no innings, since the local index is deliberately never a full match cache.
  const pointerOnlyMatch = {
    id: "co1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "in-progress", shareCode: "SHARE1"
  };
  await act(async () => {
    home.props.onOpen(pointerOnlyMatch);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(inst.root.findAllByType(MatchScreen).length, 0, "must not navigate into MatchScreen with unusable match data");
  assert.match(alertMessage || "", /couldn't open that match/i);
});

// BUG FIX: the generic "check your connection" message was actively misleading for the actual
// common case -- there is no automatic cross-account access to a match just from being a fellow
// club owner/co-owner; whoever's scoring it has to have explicitly tapped Share at least once.
// Reported live as "does it need an invite from the owner? if so why is it in Continue scoring?"
// -- the answer is yes, in effect, so the message now says that instead of implying a network
// problem the person has no way to actually fix.
test("CricketScorer: opening a tournament match that was never shared explains that, not a generic connection error", async () => {
  globalThis.loadMatch = () => Promise.resolve(null);
  globalThis.checkTournamentMatchShareStatus = () => Promise.resolve("never-shared");
  let alertMessage = null;
  globalThis.alert = msg => { alertMessage = msg; };
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  const pointerOnlyMatch = {
    id: "co1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "in-progress", tournamentId: "t1"
  };
  await act(async () => {
    home.props.onOpen(pointerOnlyMatch);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(alertMessage || "", /hasn't been shared yet/i);
});

test("CricketScorer: opening a tournament match whose share link expired says so, not a generic connection error", async () => {
  globalThis.loadMatch = () => Promise.resolve(null);
  globalThis.checkTournamentMatchShareStatus = () => Promise.resolve("expired");
  let alertMessage = null;
  globalThis.alert = msg => { alertMessage = msg; };
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  const pointerOnlyMatch = {
    id: "co1", teamA: "Riverside CC", teamB: "Oakwood CC", status: "in-progress", tournamentId: "t1", shareCode: "STALE1"
  };
  await act(async () => {
    home.props.onOpen(pointerOnlyMatch);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(alertMessage || "", /share link has expired/i);
});

// BUG FIX: a match tagged with a tournament this account has no other way to see at all (a club
// co-owner's own tournament, discovered only because the match itself got shared) always fell
// back to the bare "Tournament" placeholder every card/badge already shows for an unresolved id --
// even though that tournament auto-published its name publicly the moment it was created (see
// maybeAutoPublishTournament/loadPublicTournamentName). Reported live as a co-owner's tournament
// match showing plain "Tournament" instead of its real name on Home's "Continue scoring".
test("CricketScorer: a match's tournament name resolves from the public config doc when this account can't otherwise see that tournament", async () => {
  const inst = await render();
  await flush();
  globalThis.loadIndex = () => Promise.resolve([{
    id: "co1", teamA: "Kolding 2", teamB: "Billund 1", status: "in-progress", oversLimit: 20,
    tournamentId: "foreign-t1", shareCode: "SHARE1", scoreLine: "Kolding 2 1-0 (0.2 ov)"
  }]);
  globalThis.loadPublicTournamentName = id => Promise.resolve(id === "foreign-t1" ? "Kolding Summer Cup" : null);
  await signIn(inst);
  await flush();
  await flush();
  const home = inst.root.findByType(HomeScreen);
  assert.equal(home.props.tournamentNameById["foreign-t1"], "Kolding Summer Cup");
});

// BUG FIX: starting a match remembered its rules as this device's own default (handleSaveRules,
// via startNewMatch) unconditionally -- including a tournament match's rules (Free Hit, custom
// wide/no-ball runs, whatever house rules that competition set). That meant scoring one tournament
// fixture silently changed what the very next standalone "New Match" from Home defaulted to,
// reported live as "new match from home tends to remember the match settings from tournament".
// A tournament's own defaultRules are allowed to flow INTO its own matches (see SetupScreen's own
// matchRules comment) -- they must never flow back OUT into becoming everyone's new device default.
test("CricketScorer: starting a match tagged to a tournament does not overwrite this device's own default rules", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let savedRules = null;
  globalThis.saveRules = r => { savedRules = r; return Promise.resolve(); };
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onNew(); });
  const setup = inst.root.findByType(SetupScreen);
  await act(async () => {
    setup.props.onStart({
      teamA: "Riverside CC", teamB: "Oakwood CC", oversLimit: 20,
      rules: { ballsPerOver: 6, freeHit: true }, tournamentId: "t1"
    });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(savedRules, null, "a tournament match's rules must not become this device's own default");
});

test("CricketScorer: starting a standalone match (no tournament) does remember its rules as this device's own default", async () => {
  globalThis.saveMatch = () => Promise.resolve({ ok: true, writeSeq: 1 });
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  let savedRules = null;
  globalThis.saveRules = r => { savedRules = r; return Promise.resolve(); };
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onNew(); });
  const setup = inst.root.findByType(SetupScreen);
  await act(async () => {
    setup.props.onStart({
      teamA: "Riverside CC", teamB: "Oakwood CC", oversLimit: 20,
      rules: { ballsPerOver: 6, freeHit: true }, tournamentId: null
    });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(savedRules, { ballsPerOver: 6, freeHit: true });
});

// BUG FIX: TournamentsScreen's create form has always collected an optional default venue and
// passed it as onCreateTournament's 7th argument (see tournamentsScreen.test.js's own coverage of
// that), but handleCreateTournament here only ever declared six parameters -- the venue was
// silently dropped on every tournament creation, with no error and nothing visibly missing on
// screen (the create flow just closes normally). Only reachable/catchable at this integration
// point: both sides individually looked correct in isolation (the screen sent the right payload;
// the handler just never had a parameter to receive it).
test("CricketScorer: a venue set while creating a tournament is actually saved on it, not silently dropped", async () => {
  let saved = null;
  globalThis.saveTournaments = list => { saved = list; return Promise.resolve(); };
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onOpenTournaments(); });
  const tournamentsScreen = inst.root.findByType(TournamentsScreen);
  await act(async () => {
    await tournamentsScreen.props.onCreateTournament(
      "Summer Cup", ["Riverside CC", "Oakwood CC"], null, null, null, null,
      { venue: "Riverside Oval", venueLat: 12.34, venueLng: 56.78 }
    );
  });
  assert.ok(saved, "saveTournaments should have been called");
  const created = saved.find(t => t.name === "Summer Cup");
  assert.ok(created, "the new tournament should be in the saved list");
  assert.equal(created.venue, "Riverside Oval");
  assert.equal(created.venueLat, 12.34);
  assert.equal(created.venueLng, 56.78);
});

// A non-private match is discoverable in Live now the instant it's saved -- a tournament used to
// stay invisible until its owner explicitly tapped "Share" once. maybeAutoPublishTournament closes
// that gap: creating a non-private tournament auto-mints a share code and publishes it, the same
// work "Share" always did, without waiting for that tap.
test("CricketScorer: creating a non-private tournament auto-publishes it (mints a share code)", async () => {
  let shared = null;
  let saved = null;
  const inst = await render();
  // Set after render(), which stubs shareTournament to its own default -- this override wouldn't
  // stick if set before, since render() re-stubs it on every call (see its own comment).
  globalThis.saveTournaments = list => { saved = list; return Promise.resolve(); };
  globalThis.shareTournament = (tournament, standings) => {
    shared = { tournament, standings };
    return Promise.resolve({ ok: true, code: "AUTOCODE" });
  };
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onOpenTournaments(); });
  const tournamentsScreen = inst.root.findByType(TournamentsScreen);
  await act(async () => {
    await tournamentsScreen.props.onCreateTournament(
      "Summer Cup", ["Riverside CC", "Oakwood CC"], null, null, null, null, null, false
    );
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(shared, "shareTournament should have been called automatically");
  assert.equal(shared.tournament.name, "Summer Cup");
  assert.equal(shared.standings.length, 2, "standings computed for both teams, even with zero matches yet");
  const created = saved.find(t => t.name === "Summer Cup");
  assert.equal(created.shareCode, "AUTOCODE", "the minted code is persisted back onto the tournament");
});

test("CricketScorer: creating a PRIVATE tournament does not auto-publish it", async () => {
  let shared = null;
  const inst = await render();
  globalThis.saveTournaments = () => Promise.resolve();
  globalThis.shareTournament = (tournament, standings) => {
    shared = { tournament, standings };
    return Promise.resolve({ ok: true, code: "AUTOCODE" });
  };
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onOpenTournaments(); });
  const tournamentsScreen = inst.root.findByType(TournamentsScreen);
  await act(async () => {
    await tournamentsScreen.props.onCreateTournament(
      "Private Cup", ["Riverside CC", "Oakwood CC"], null, null, null, null, null, true
    );
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(shared, null, "a private tournament is never auto-published");
});

test("CricketScorer: opening Feedback Inbox without admin access bounces back to Home", async () => {
  const inst = await render();
  await flush();
  await signIn(inst);
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onOpenAccount(); });
  const account = inst.root.findByType(AccountScreen);
  act(() => { account.props.onOpenFeedbackInbox(); });
  // Not an admin (isFeedbackAdmin false, checkIsCollectionAdmin stubbed false) -- the admin-gate
  // effect immediately bounces this back to Home rather than showing a blank/inaccessible screen.
  assert.ok(inst.root.findByType(HomeScreen));
});
