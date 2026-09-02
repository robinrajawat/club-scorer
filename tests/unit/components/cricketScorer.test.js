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
  // Unlike loadMyFederationRequests (only called once the signed-in user owns/co-owns a club or
  // federation, so most of these tests' plain signed-in user never reaches it), the co-owner
  // invites load also covers invites addressed to my own email regardless of ownership -- so it
  // runs on every signed-in mount here and needs a stub even for tests that own nothing.
  globalThis.loadMyCoOwnerInvites = () => Promise.resolve([]);
  globalThis.flushPendingWrites = () => Promise.resolve();
  globalThis.linkPlayerIfMatch = () => Promise.resolve();
  globalThis.loadMyPlayerProfile = () => Promise.resolve(null);
  globalThis.checkIsCollectionAdmin = () => Promise.resolve(false);
  globalThis.signInGoogle = () => Promise.resolve({ ok: true });
  // Referenced unconditionally as a bare prop value (`onSignOut: signOutUser`) on every render of
  // HomeScreen, not just when actually clicked -- needed even for tests that never sign out.
  globalThis.signOutUser = () => Promise.resolve({ ok: true });
  globalThis.loadPublicPlayers = () => Promise.resolve([]);

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
  delete globalThis.fetchSharedMatch;
  delete globalThis.saveMatch;
  delete globalThis.saveRules;
  delete globalThis.db;
  delete globalThis.Modal;
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
