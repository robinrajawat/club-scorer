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
import { TournamentDetailScreen } from "../../../src/components/tournamentDetailScreen.js";
import { SetupScreen } from "../../../src/components/setupScreen.js";
import { AccountScreen } from "../../../src/components/accountScreen.js";
import { HelpScreen, AboutScreen } from "../../../src/components/infoScreens.js";
import { FollowScreen } from "../../../src/components/followScreen.js";
import { LiveScreen } from "../../../src/components/liveScreen.js";
import { MatchScreen } from "../../../src/components/matchScreen.js";
import { AlertModal } from "../../../src/components/formUiAtoms.js";
import { MyTeamsScreen } from "../../../src/components/myTeamsScreen.js";
import { TabBar } from "../../../src/components/tabBar.js";

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
  // HomeScreen/TournamentsScreen's FabButton calls ReactDOM.createPortal(..., document.body)
  // internally -- a bare global, same as everything else stubbed in this function. Even though a
  // real jsdom `document` is installed above, the tree here still mounts via react-test-renderer,
  // whose reconciler doesn't understand a real DOM node as a portal container -- so this stub just
  // renders the portal's children in place instead, same as homeScreen.test.js/
  // tournamentsScreen.test.js. FabButton's real portaling is covered on its own in
  // screenAtoms.test.js, which renders through actual react-dom.
  globalThis.ReactDOM = { createPortal: node => node };
  globalThis.loadIndex = () => Promise.resolve([]);
  globalThis.loadTeams = () => Promise.resolve([]);
  globalThis.loadProfile = () => Promise.resolve(null);
  globalThis.loadRules = () => Promise.resolve({});
  globalThis.loadTournaments = () => Promise.resolve([]);
  globalThis.loadBetaStatus = () => Promise.resolve(false);
  globalThis.loadClubs = () => Promise.resolve([]);
  // ClubPanel's/FederationsPanel's own self-heal effect (see their own comments) calls these for
  // any owned club/federation not already visibility:"public" -- most fixtures in this file don't
  // set that field, so without a stub this throws (bare global, not defined) the moment such a
  // club/federation actually renders.
  globalThis.setClubVisibility = () => Promise.resolve({ ok: true });
  globalThis.setFederationVisibility = () => Promise.resolve({ ok: true });
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
  globalThis.setMyProfileVisibility = () => Promise.resolve({ ok: true });
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
  globalThis.syncTournamentConfig = () => Promise.resolve();
  // FixtureRow's own mount-time effect, reached whenever TournamentDetailScreen renders a fixture
  // (see fixtureRow.test.js) -- stubbed here rather than per-test since any test that opens a
  // tournament with fixtures reaches it regardless of what that specific test is checking.
  globalThis.loadFixturePollSummary = () => Promise.resolve([]);
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

// Raw auth-callback fire, no follow-up navigation -- what the app itself does the moment a session
// resolves (silently restored, or freshly completed), before anyone taps anything. Most tests below
// want a signed-in Home screen as scaffolding for something else entirely and don't care which path
// got them there, so they use signIn() below instead; this one is for tests that specifically care
// what happens right at that moment (e.g. the watcher-default landing staying on Live).
function signInRaw(inst, user = { uid: "u1", email: "robin@x.com", displayName: "Robin", providerData: [] }) {
  return act(async () => {
    authCallback(user);
    await new Promise(r => setTimeout(r, 0));
  });
}

// Signs in and lands on Score, same as every test below expects -- every real sign-in path (a
// silent session restore, or an explicit WelcomeScreen sign-in) now lands on Live/Home instead
// (see the dedicated tests for that), so this always taps through the tab bar to Score afterward
// for tests that just want a signed-in Score screen to test something unrelated.
async function signIn(inst, user = { uid: "u1", email: "robin@x.com", displayName: "Robin", providerData: [] }) {
  await signInRaw(inst, user);
  if (inst.root.findAllByType(HomeScreen).length > 0) return;
  const tabBar = inst.root.findAllByType(TabBar);
  if (tabBar.length > 0) {
    act(() => { tabBar[0].props.onSelect("home"); });
  }
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
  delete globalThis.loadClubTeams;
  delete globalThis.loadClubTournaments;
  delete globalThis.loadTournamentMatches;
  delete globalThis.loadPendingPollItems;
  delete globalThis.saveClubTournament;
});

// Reported live, three times over: first as "most spectators who opened the app just to follow a
// tournament never realized they needed to find the Live tab, having landed on what read as a
// sign-in wall first" (when WelcomeScreen's sign-in content was the default landing), then again
// once a fix for that shipped an "I'm watching"/"I'm scoring" choice screen in front of it --
// "Scorer and watcher views has to be blended in a sense," since an upfront "who are you" question
// was still friction nobody watching a match actually wanted -- and again once the fix for THAT
// still hid the tab bar for a cold, signed-out visit, which read as its own separate "watcher page"
// rather than the same app shell: "why landing page still feel disconnected... seems like we are
// still having a separate watcher page." A cold, signed-out visit now skips all three: straight to
// Live, full tab bar and header chrome exactly like a signed-in visitor gets, no WelcomeScreen at
// all until they ask for it (via Live's own AuthBar).
test("CricketScorer: a signed-out cold visit lands straight on Live, with the full tab bar, no sign-in wall", async () => {
  const inst = await render();
  await flush();
  assert.ok(inst.root.findByType(LiveScreen));
  assert.equal(inst.root.findAllByType(TabBar).length, 1);
  assert.throws(() => inst.root.findByType(WelcomeScreen));
});

test("CricketScorer: a ?follow=CODE URL routes straight to FollowScreen with that code", async () => {
  globalThis.db = { collection: () => ({ doc: () => ({ onSnapshot: () => () => {} }) }) };
  const inst = await render("https://example.test/?follow=abc123");
  await flush();
  const follow = inst.root.findByType(FollowScreen);
  assert.equal(follow.props.code, "ABC123");
});

// WelcomeScreen is reached only via AuthBar's "Sign in" now (openAccount, same handler wired to
// LiveScreen's onOpenAccount and HomeScreen's own) -- not landed on directly, see the cold-landing
// test above, and no longer via a separate standalone link either (that was dropped: "instead sign
// in on top can lead to old signin landing page" -- one canonical way in). WelcomeScreen's own Back
// arrow is the round trip back to Live, via settingsReturnScreen.
test("CricketScorer: Live's AuthBar 'Sign in' opens WelcomeScreen; its Back arrow returns to Live", async () => {
  const inst = await render();
  await flush();
  const live = inst.root.findByType(LiveScreen);
  act(() => { live.props.onOpenAccount(); });
  const welcome = inst.root.findByType(WelcomeScreen);
  assert.throws(() => inst.root.findByType(LiveScreen));

  act(() => { welcome.props.onBack(); });
  assert.ok(inst.root.findByType(LiveScreen));
  assert.throws(() => inst.root.findByType(WelcomeScreen));
});

test("CricketScorer: signing in from WelcomeScreen lands on Home", async () => {
  const inst = await render();
  await flush();
  const live = inst.root.findByType(LiveScreen);
  act(() => { live.props.onOpenAccount(); });
  const welcome = inst.root.findByType(WelcomeScreen);
  await act(async () => {
    welcome.props.onSignIn();
    await new Promise(r => setTimeout(r, 0));
  });
  // signInRaw, not the signIn() helper -- that helper taps through to Score afterward for tests
  // that just want a signed-in Score screen to test something unrelated, which would mask the
  // actual redirect target this test exists to pin down.
  await signInRaw(inst);
  assert.ok(inst.root.findByType(LiveScreen));
});

// Reported live: "if we don't show account icon/menu then you don't present any app level
// information? like about, support, help." Live's own header carries the same AuthBar
// (Account/Help/Feedback/About) HomeScreen's own header uses. Each one's own Back used to be
// hardcoded to "home" -- fine when AuthBar only ever lived on Home, wrong for someone who reached
// it from Live instead. settingsReturnScreen fixes that: Back returns to wherever it was actually
// opened from.
test("CricketScorer: opening Help from Live returns to Live, not Home", async () => {
  const inst = await render();
  await flush();
  const live = inst.root.findByType(LiveScreen);
  act(() => { live.props.onOpenHelp(); });
  const help = inst.root.findByType(HelpScreen);
  act(() => { help.props.onBack(); });
  assert.ok(inst.root.findByType(LiveScreen));
  assert.equal(inst.root.findAllByType(TabBar).length, 1);
  assert.throws(() => inst.root.findByType(HelpScreen));
});

test("CricketScorer: opening About from Live returns to Live too", async () => {
  const inst = await render();
  await flush();
  const live = inst.root.findByType(LiveScreen);
  act(() => { live.props.onOpenAbout(); });
  const about = inst.root.findByType(AboutScreen);
  act(() => { about.props.onBack(); });
  assert.ok(inst.root.findByType(LiveScreen));
  assert.throws(() => inst.root.findByType(AboutScreen));
});

// BUG FIX: a returning session whose sign-in resolves asynchronously (the render() harness's own
// onAuthStateChanged stub fires null first, same as a real cold load before Firebase's local
// session restore settles) used to get yanked off Live and onto Home the moment that silent
// restore resolved -- undermining the whole point of Live being the default landing page (see the
// cold-visit test above) for anyone who was already signed in. Only an EXPLICIT sign-in via the
// "login" screen (openAccount, WelcomeScreen) should land on Home now; a session that resolves
// signed-in while still on the untouched cold-landing default should just stay right there on Live.
test("CricketScorer: a session that resolves signed-in while still on the cold-landing default stays on Live", async () => {
  const inst = await render();
  await flush();
  assert.ok(inst.root.findByType(LiveScreen));
  await signInRaw(inst);
  assert.ok(inst.root.findByType(LiveScreen));
  assert.equal(inst.root.findAllByType(HomeScreen).length, 0);
});

// A signed-out visitor who opens sign-in (AuthBar) from Live, then backs out with "Continue
// without an account" instead of actually signing in, lands on Home with the same full tab bar
// Live itself already had.
test("CricketScorer: 'Continue without an account' out of sign-in lands on Home with the full tab bar", async () => {
  const inst = await render();
  await flush();
  const live = inst.root.findByType(LiveScreen);
  act(() => { live.props.onOpenAccount(); });
  const welcome = inst.root.findByType(WelcomeScreen);
  act(() => { welcome.props.onSkip(); });
  assert.ok(inst.root.findByType(LiveScreen));
  assert.equal(inst.root.findAllByType(TabBar).length, 1);
});

// The same AuthBar (and the same WelcomeScreen it opens) also has to work for a signed-out guest
// already on Home -- not just a watcher -- since "Sign in" now goes to the one canonical
// WelcomeScreen from wherever it's tapped (see openAccount's own comment). Its Back arrow needs to
// return to Home here, not to Live, which settingsReturnScreen (captured as whatever `screen` was
// at the moment "Sign in" was tapped) is what makes correct.
test("CricketScorer: a signed-out guest already on Home can also reach sign-in via AuthBar, with Back returning to Home", async () => {
  const inst = await render();
  await flush();
  const live = inst.root.findByType(LiveScreen);
  act(() => { live.props.onOpenAccount(); });
  let welcome = inst.root.findByType(WelcomeScreen);
  act(() => { welcome.props.onSkip(); }); // becomes a guest on Home, watcherMode cleared
  assert.ok(inst.root.findByType(LiveScreen));

  const homeAfterSkip = inst.root.findByType(LiveScreen);
  act(() => { homeAfterSkip.props.onOpenAccount(); });
  welcome = inst.root.findByType(WelcomeScreen);
  assert.throws(() => inst.root.findByType(LiveScreen));

  act(() => { welcome.props.onBack(); });
  assert.ok(inst.root.findByType(LiveScreen));
  assert.equal(inst.root.findAllByType(TabBar).length, 1);
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
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
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
  assert.match(inst.root.findByType(AlertModal).props.message, /couldn't open that match/i);
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
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
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
  assert.match(inst.root.findByType(AlertModal).props.message, /hasn't been shared yet/i);
});

test("CricketScorer: opening a tournament match whose share link expired says so, not a generic connection error", async () => {
  globalThis.loadMatch = () => Promise.resolve(null);
  globalThis.checkTournamentMatchShareStatus = () => Promise.resolve("expired");
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
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
  assert.match(inst.root.findByType(AlertModal).props.message, /share link has expired/i);
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

// IMPROVEMENT: every "co-owner can't continue scoring a teammate's tournament match" bug fixed
// earlier this session traced back to the same root gap -- a club tournament match stayed locked
// to just its creator's own account (no shareCode at all) until they remembered to explicitly tap
// Share, so a teammate who saw it in "Continue Scoring" (via the world-readable
// tournamentMatches/entries pointer) hit a dead end. Rather than only wording that dead end's
// error message better (checkTournamentMatchShareStatus), starting a match tagged to a tournament
// whose club has more than one member now mints the share code up front, the same genMatchCode()
// the manual Share button uses -- see startNewMatch.
test("CricketScorer: starting a match in a club tournament with other members auto-mints a share code", async () => {
  let savedMatch = null;
  globalThis.saveMatch = m => { savedMatch = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await render();
  // render() itself resets loadClubs/loadClubTeams/loadClubTournaments to their empty-state
  // defaults on every call -- these need to be set AFTER render(), not before, so they aren't
  // immediately clobbered, then picked up by refreshClubs when signIn below fires the auth
  // callback it runs from.
  globalThis.loadClubs = () => Promise.resolve([
    { id: "club1", name: "Riverside CC", ownerUid: "u1", coOwnerUids: [], memberUids: ["u1", "u2"] }
  ]);
  globalThis.loadClubTeams = () => Promise.resolve([]);
  globalThis.loadClubTournaments = () => Promise.resolve([]);
  globalThis.loadTournamentMatches = () => Promise.resolve([]);
  globalThis.loadPendingPollItems = () => Promise.resolve([]);
  globalThis.saveClubTournament = () => Promise.resolve({ ok: true });
  await flush();
  await signIn(inst);
  await flush();
  await flush();
  await flush();
  const home = inst.root.findByType(HomeScreen);
  const tournament = { id: "t1", name: "Summer Cup", _clubId: "club1", _federationId: null, teams: ["Riverside CC", "Oakwood CC"], fixtures: [] };
  act(() => { home.props.onOpenTournament(tournament); });
  const detail = inst.root.findByType(TournamentDetailScreen);
  act(() => { detail.props.onStartMatch(tournament); });
  const setup = inst.root.findByType(SetupScreen);
  await act(async () => {
    setup.props.onStart({ teamA: "Riverside CC", teamB: "Oakwood CC", oversLimit: 20, tournamentId: "t1", clubId: "club1" });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(savedMatch, "saveMatch should have been called");
  assert.ok(savedMatch.shareCode, "a club tournament match with other members should be auto-shared");
});

test("CricketScorer: starting a match in a solo club tournament (no other members) does not auto-mint a share code", async () => {
  let savedMatch = null;
  globalThis.saveMatch = m => { savedMatch = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await render();
  globalThis.loadClubs = () => Promise.resolve([
    { id: "club1", name: "Riverside CC", ownerUid: "u1", coOwnerUids: [], memberUids: ["u1"] }
  ]);
  globalThis.loadClubTeams = () => Promise.resolve([]);
  globalThis.loadClubTournaments = () => Promise.resolve([]);
  globalThis.loadTournamentMatches = () => Promise.resolve([]);
  globalThis.loadPendingPollItems = () => Promise.resolve([]);
  globalThis.saveClubTournament = () => Promise.resolve({ ok: true });
  await flush();
  await signIn(inst);
  await flush();
  await flush();
  await flush();
  const home = inst.root.findByType(HomeScreen);
  const tournament = { id: "t1", name: "Summer Cup", _clubId: "club1", _federationId: null, teams: ["Riverside CC", "Oakwood CC"], fixtures: [] };
  act(() => { home.props.onOpenTournament(tournament); });
  const detail = inst.root.findByType(TournamentDetailScreen);
  act(() => { detail.props.onStartMatch(tournament); });
  const setup = inst.root.findByType(SetupScreen);
  await act(async () => {
    setup.props.onStart({ teamA: "Riverside CC", teamB: "Oakwood CC", oversLimit: 20, tournamentId: "t1", clubId: "club1" });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(savedMatch, "saveMatch should have been called");
  assert.ok(!savedMatch.shareCode, "a solo club tournament has no one else who'd need this, so no share code should be minted");
});

// BUG FIX: a fixture's matchId only ever got written by handleStartFixtureMatch's own "Start
// Fixture" path. Starting the exact same pairing via the tournament's plain "Start Match" button
// instead (handleStartMatchInTournament -- no specific fixture card involved) created a match that
// counted correctly in standings (computeStandings matches by team name + tournamentId alone) but
// left the fixture stuck looking "upcoming" forever in both the Fixtures tab and the public share
// snapshot, since both read a completed result purely off fixture.matchId. startNewMatch now
// back-fills that link via findFixtureToAutoLink whenever there's exactly one unplayed fixture
// between these two teams.
test("CricketScorer: starting a match via 'Start Match' (not a specific fixture card) still back-fills the fixture's matchId when the pairing is unambiguous", async () => {
  let savedMatch = null;
  let savedTournament = null;
  globalThis.saveMatch = m => { savedMatch = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await render();
  globalThis.loadClubs = () => Promise.resolve([
    { id: "club1", name: "Riverside CC", ownerUid: "u1", coOwnerUids: [], memberUids: ["u1"] }
  ]);
  globalThis.loadClubTeams = () => Promise.resolve([]);
  const tournament = {
    id: "t1", name: "Summer Cup", _clubId: "club1", _federationId: null,
    teams: ["Riverside CC", "Oakwood CC"],
    fixtures: [{ id: "fx1", teamA: "Riverside CC", teamB: "Oakwood CC" }],
    // Already published (shareCode set) -- keeps this test isolated to the fixture-linking
    // behavior under test. A never-shared tournament would also fire openTournamentDetail's own
    // auto-publish-on-open flow (maybeAutoPublishTournament), an unrelated saveClubTournament
    // write (minting a share code from the ORIGINAL, unlinked fixtures) racing this test's own on
    // the same stubbed saveClubTournament; an already-shared one only re-syncs the public config
    // doc/standings instead (syncTournamentConfig/refreshTournamentStandingsLive, already
    // no-op-stubbed by render() below), never touching saveClubTournament at all.
    shareCode: "EXISTING"
  };
  // linkFixtureToMatch (the write side of this fix) resolves which store a tournament lives in by
  // searching clubTournamentsById itself -- same as the real app, this needs to already be loaded
  // (as it would be from visiting the Tournaments tab) before startNewMatch can find it to write to.
  globalThis.loadClubTournaments = () => Promise.resolve([tournament]);
  globalThis.loadTournamentMatches = () => Promise.resolve([]);
  globalThis.loadPendingPollItems = () => Promise.resolve([]);
  globalThis.saveClubTournament = (clubId, updated) => { savedTournament = updated; return Promise.resolve({ ok: true }); };
  await flush();
  await signIn(inst);
  await flush();
  await flush();
  await flush();
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onOpenTournament(tournament); });
  const detail = inst.root.findByType(TournamentDetailScreen);
  act(() => { detail.props.onStartMatch(tournament); });
  const setup = inst.root.findByType(SetupScreen);
  await act(async () => {
    setup.props.onStart({ teamA: "Riverside CC", teamB: "Oakwood CC", oversLimit: 20, tournamentId: "t1", clubId: "club1" });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(savedMatch, "saveMatch should have been called");
  assert.ok(savedTournament, "saveClubTournament should have been called to back-fill the fixture's matchId");
  assert.equal(savedTournament.fixtures[0].matchId, savedMatch.id);
});

// IMPROVEMENT: the auto-share fix above used to be keyed off presetTournament._clubId, so it only
// ever applied to a match started FROM a tournament -- a standalone match tagged to the same club
// via SetupScreen's own Organizer picker (no tournamentId at all) fell through this exact gap
// silently, re-introducing the "co-owner can't continue scoring" bug the tournament case was
// already fixed for. Re-keyed onto m.clubId/m.federationId directly so both paths share the fix.
test("CricketScorer: starting a standalone match (no tournament) under a multi-member club as Organizer also auto-mints a share code", async () => {
  let savedMatch = null;
  globalThis.saveMatch = m => { savedMatch = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await render();
  globalThis.loadClubs = () => Promise.resolve([
    { id: "club1", name: "Riverside CC", ownerUid: "u1", coOwnerUids: [], memberUids: ["u1", "u2"] }
  ]);
  globalThis.loadClubTeams = () => Promise.resolve([]);
  globalThis.loadClubTournaments = () => Promise.resolve([]);
  globalThis.loadPendingPollItems = () => Promise.resolve([]);
  await flush();
  await signIn(inst);
  await flush();
  await flush();
  await flush();
  const home = inst.root.findByType(HomeScreen);
  act(() => { home.props.onNew(); });
  const setup = inst.root.findByType(SetupScreen);
  await act(async () => {
    setup.props.onStart({ teamA: "Riverside CC", teamB: "Oakwood CC", oversLimit: 20, clubId: "club1" });
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(savedMatch, "saveMatch should have been called");
  assert.ok(savedMatch.shareCode, "a standalone match organized under a multi-member club should be auto-shared, same as a tournament one");
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

// BUG FIX: editing an already-shared tournament (e.g. generating/adding fixtures, which normally
// happens right after creation) used to call ONLY refreshTournamentStandingsLive, which recomputes
// standings against whatever fixtures/venue/etc. already happen to be sitting in the public
// /tournamentMatches/{tournamentId} config doc -- never refreshes that doc itself, since it's only
// ever written by shareTournament. Every fixture added after the tournament's first auto-publish
// silently never reached the public/Live tournament view until the owner happened to open the
// Share panel and tap "Refresh now" by hand. maybeAutoPublishTournament now calls
// syncTournamentConfig first to re-sync the config doc from the current (owner-side) tournament
// object before refreshing standings.
test("CricketScorer: editing an already-shared tournament re-syncs the public config doc (not just standings)", async () => {
  let synced = null;
  let refreshedId = null;
  const inst = await render();
  globalThis.loadTournaments = () => Promise.resolve([
    { id: "t1", name: "Summer Cup", teams: ["Riverside CC", "Oakwood CC"], fixtures: [], private: false, shareCode: "EXISTING" }
  ]);
  globalThis.saveTournaments = () => Promise.resolve();
  globalThis.loadTournamentMatches = () => Promise.resolve([]);
  globalThis.syncTournamentConfig = tournament => { synced = tournament; return Promise.resolve(); };
  globalThis.refreshTournamentStandingsLive = id => { refreshedId = id; return Promise.resolve(); };
  await flush();
  await signIn(inst);
  await flush();
  const home = inst.root.findByType(HomeScreen);
  const tournament = home.props.tournaments.find(t => t.id === "t1");
  await act(async () => {
    home.props.onOpenTournament(tournament);
    await new Promise(r => setTimeout(r, 0));
  });
  const detail = inst.root.findByType(TournamentDetailScreen);
  const withFixture = {
    ...tournament,
    fixtures: [{ id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC", date: "" }]
  };
  await act(async () => {
    await detail.props.onUpdateTournament(withFixture);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(synced, "syncTournamentConfig should have been called to re-sync the public config doc");
  assert.equal(synced.fixtures.length, 1, "the newly-added fixture should be part of what gets re-synced");
  assert.equal(refreshedId, "t1", "standings should still be refreshed right after the config re-sync");
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

// IMPROVEMENT: maybeAutoPublishTournament only ever ran on creation and on every edit -- an
// existing tournament created before that feature shipped, and never edited since, has no public
// tournamentMatches/{tournamentId} doc, so its name can never resolve for anyone outside its own
// club/federation (see foreignTournamentNames) even after one of its matches gets shared. Simply
// OPENING it (openTournamentDetail) now self-heals this the same way an edit already did, since
// maybeAutoPublishTournament itself already no-ops for anything private or already-published --
// see its own comment.
test("CricketScorer: opening an existing tournament with no share code (predates auto-publish) publishes it", async () => {
  let shared = null;
  let saved = null;
  const inst = await render();
  globalThis.loadTournaments = () => Promise.resolve([
    { id: "old1", name: "Legacy Cup", teams: ["Riverside CC", "Oakwood CC"], fixtures: [], private: false }
  ]);
  globalThis.saveTournaments = list => { saved = list; return Promise.resolve(); };
  globalThis.shareTournament = (tournament, standings) => {
    shared = { tournament, standings };
    return Promise.resolve({ ok: true, code: "BACKFILLCODE" });
  };
  globalThis.loadTournamentMatches = () => Promise.resolve([]);
  await flush();
  await signIn(inst);
  await flush();
  const home = inst.root.findByType(HomeScreen);
  const tournament = home.props.tournaments.find(t => t.id === "old1");
  await act(async () => {
    home.props.onOpenTournament(tournament);
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(shared, "shareTournament should have been called automatically on open, not just on create/edit");
  assert.equal(shared.tournament.name, "Legacy Cup");
  const republished = saved.find(t => t.id === "old1");
  assert.equal(republished.shareCode, "BACKFILLCODE", "the minted code is persisted back onto the tournament");
});

// IMPROVEMENT: startNewMatch's auto-share only ever applied at creation -- an existing in-progress
// tournament match created before that change, still missing a shareCode, stayed exactly as
// invisible to co-owners as auto-share was built to prevent for new ones, since nothing about
// scoring it ever revisited that decision afterward. openMatch now self-heals this the moment the
// match's own real owner opens it (loadMatch succeeding via their own /users/{uid}/matches copy is
// what makes this safe -- see its own comment).
test("CricketScorer: opening an existing tournament match with no share code (predates auto-share) mints one, in a multi-member club", async () => {
  const fullMatch = {
    id: "co1", teamA: "Kolding 2", teamB: "Billund 1", oversLimit: 20, status: "in-progress",
    tournamentId: "t1", teamARoster: [], teamBRoster: [], currentInningIndex: 0,
    innings: [{
      battingTeam: "Kolding 2", bowlingTeam: "Billund 1", runs: 0, wickets: 0, legalBalls: 0,
      overs: [[]], batsmen: {}, bowlers: {}, extras: {}, strikerName: "A", nonStrikerName: "B",
      bowlerName: "X", fallOfWickets: [], partnerships: [], complete: false, ballsPerOver: 6,
      maxWickets: 10
    }]
  };
  let savedMatch = null;
  globalThis.loadMatch = () => Promise.resolve(fullMatch);
  globalThis.saveMatch = m => { savedMatch = m; return Promise.resolve({ ok: true, writeSeq: 1 }); };
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  const inst = await render();
  globalThis.loadClubs = () => Promise.resolve([
    { id: "club1", name: "Riverside CC", ownerUid: "u1", coOwnerUids: [], memberUids: ["u1", "u2"] }
  ]);
  globalThis.loadClubTeams = () => Promise.resolve([]);
  globalThis.loadClubTournaments = () => Promise.resolve([{ id: "t1", name: "Summer Cup", teams: [], fixtures: [] }]);
  globalThis.loadTournamentMatches = () => Promise.resolve([]);
  globalThis.loadPendingPollItems = () => Promise.resolve([]);
  await flush();
  await signIn(inst);
  await flush();
  await flush();
  await flush();
  const home = inst.root.findByType(HomeScreen);
  await act(async () => {
    home.props.onOpen("co1");
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(inst.root.findByType(MatchScreen), "should still open normally");
  assert.ok(savedMatch, "saveMatch should have been called to mint the code");
  assert.ok(savedMatch.shareCode, "an old match with no share code should be self-healed on open, in a multi-member club");
});

// The Teams tab (screen "teams") used to route through TeamsScreen -- a Clubs/Federations browser
// -- with a club's own roster nested inside it (manageClubTeamsOpen). Club/federation management
// was removed (see docs/simplification-plan.md): the Teams tab now renders MyTeamsScreen directly,
// with the bottom tab bar showing, and no club-scoping of any kind.
test("CricketScorer: the Teams tab renders MyTeamsScreen directly, with the tab bar showing", async () => {
  const inst = await render();
  await flush();
  await signIn(inst);
  await flush();
  await flush();

  const tabBar = inst.root.findByType(TabBar);
  act(() => { tabBar.props.onSelect("teams"); });
  assert.equal(inst.root.findByType(TabBar).props.active, "teams");
  const myTeams = inst.root.findByType(MyTeamsScreen);
  assert.equal(myTeams.props.showTabBar, true);
  assert.equal(myTeams.props.onBack, undefined, "no Back button -- it's a tab, not a drill-in");
  assert.equal(typeof myTeams.props.onTogglePin, "function");
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
