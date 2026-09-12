// Public "?tournament=CODE" standings view (src/components/followTournamentScreen.js). Reads its
// snapshot via `db.collection("tournamentViews").doc(code).get()` from a mount-time useEffect --
// `db` (the raw Firestore SDK instance, a bare global, not extracted) is stubbed here, same
// pattern as `auth` in authActionScreen.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FollowTournamentScreen } from "../../../src/components/followTournamentScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

afterEach(() => {
  delete globalThis.db;
});

function dbStub(doc) {
  return {
    collection: name => {
      assert.equal(name, "tournamentViews");
      return {
        doc: code => ({
          get: () => Promise.resolve(doc)
        })
      };
    }
  };
}

async function renderScreen(code, doc, extraProps = {}) {
  globalThis.db = dbStub(doc);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(FollowTournamentScreen, { code, onExit: () => {}, ...extraProps }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

function snapshotData(overrides = {}) {
  return {
    name: "Riverside Summer League",
    sharedAt: Date.now(),
    teams: ["Riverside 1st XI", "Riverside 2nd XI"],
    standings: [
      { team: "Riverside 1st XI", played: 3, won: 2, lost: 1, tied: 0, noResult: 0, points: 4, nrr: 0.512 },
      { team: "Riverside 2nd XI", played: 3, won: 3, lost: 0, tied: 0, noResult: 0, points: 6, nrr: 1.204 }
    ],
    fixtures: [],
    ...overrides
  };
}

test("FollowTournamentScreen: loads and shows the tournament name and standings, sorted by points/nrr", async () => {
  const data = snapshotData();
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside Summer League/);
  assert.match(text, /Riverside 2nd XI/);
  const rows = inst.root.findAllByType("tr").slice(1);
  const firstRowText = JSON.stringify(rows[0].props.children.map(td => td && td.props && td.props.children));
  assert.match(firstRowText, /Riverside 2nd XI/);
});

test("FollowTournamentScreen: doc.exists === false shows the invalid-link message and a Btn to onExit", async () => {
  let exited = false;
  const inst = await renderScreen("MISSING", { exists: false }, { onExit: () => { exited = true; } });
  assert.match(JSON.stringify(inst.toJSON()), /isn.t valid/);
  const btn = inst.root.findByType(Btn);
  btn.props.onClick();
  assert.equal(exited, true);
});

test("FollowTournamentScreen: a rejected get() shows a friendly error message", async () => {
  globalThis.db = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.reject({ code: "permission-denied", message: "nope" })
      })
    })
  };
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(FollowTournamentScreen, { code: "X", onExit: () => {} }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /isn't available right now/);
});

test("FollowTournamentScreen: with no code, shows not-found without ever calling db", async () => {
  let called = false;
  globalThis.db = { collection: () => { called = true; return { doc: () => ({ get: () => Promise.resolve({ exists: false }) }) }; } };
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(FollowTournamentScreen, { code: "", onExit: () => {} }));
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(called, false);
  assert.match(JSON.stringify(inst.toJSON()), /isn.t valid/);
});

// BUG FIX: the exit affordance always was a big standalone "Go to Club Scorer" CTA button, which
// made sense for someone who landed here cold via a "?tournament=" link but both misread as a
// mistake ("go to the app? I'm already in it") and looked like an oddly isolated floating button
// for someone who tapped here from the Live tab's own tournaments feed. reachedInApp (set from
// cricketScorer.js only when openLiveTournament, the Live tab's entry point, was what got here)
// swaps that CTA for a small chevron "Back" link in the header, matching every other in-app
// screen's back-navigation convention (see e.g. recordsScreen.js) instead of a lone floating pill.
test("FollowTournamentScreen: shows a 'Go to Club Scorer' Btn from a cold link, and a header 'Back' link (no CTA button) when reached in-app", async () => {
  const data = snapshotData();
  const viaLink = await renderScreen("ABCD12", { exists: true, data: () => data });
  assert.match(JSON.stringify(viaLink.toJSON()), /Go to Club Scorer/);
  assert.ok(viaLink.root.findByType(Btn));

  let exited = false;
  const inApp = await renderScreen("ABCD12", { exists: true, data: () => data }, { reachedInApp: true, onExit: () => { exited = true; } });
  const text = JSON.stringify(inApp.toJSON());
  assert.match(text, /Back/);
  assert.doesNotMatch(text, /Go to Club Scorer/);
  assert.throws(() => inApp.root.findByType(Btn));
  inApp.root.findByType("button").props.onClick();
  assert.equal(exited, true);
});

test("FollowTournamentScreen: the invalid-link error state also shows a header 'Back' link (no CTA button) when reached in-app", async () => {
  let exited = false;
  const inst = await renderScreen("MISSING", { exists: false }, { reachedInApp: true, onExit: () => { exited = true; } });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Back/);
  assert.doesNotMatch(text, /Go to Club Scorer/);
  assert.throws(() => inst.root.findByType(Btn));
  inst.root.findByType("button").props.onClick();
  assert.equal(exited, true);
});

test("FollowTournamentScreen: shows scheduled fixtures when present", async () => {
  const data = snapshotData({
    fixtures: [{ id: "f1", date: "2026-05-01T18:00", teamA: "Riverside 1st XI", teamB: "Riverside 2nd XI" }]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Fixtures/);
});

// BUG FIX: an unscheduled fixture (no date set yet, e.g. early in a tournament or an informal one
// that never sets dates at all) used to fall through both the Results filter (no result) AND the
// Fixtures filter (no date), so it was present in the snapshot but never shown anywhere on screen.
test("FollowTournamentScreen: a fixture with no result and no date still shows under Fixtures, just without a date/time", async () => {
  const data = snapshotData({
    fixtures: [{ id: "f1", date: "", teamA: "Riverside 1st XI", teamB: "Riverside 2nd XI", result: null }]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Fixtures/);
  assert.match(text, /Riverside 1st XI/);
  assert.match(text, /Riverside 2nd XI/);
});

// Reported live: a knockout fixture proposed ahead of its round (see fixturesSection.js) showed as
// a bare "vs" with no indication it was even the Final, and no venue ever showed for any fixture
// here even when one was set. Each fixture now shows "TBD" for a team not yet known, its stage
// label when it has one, and a venue link when it has one.
test("FollowTournamentScreen: a TBD knockout fixture shows 'TBD' team names and its stage label; a fixture with a venue shows a maps link", async () => {
  const data = snapshotData({
    fixtures: [
      { id: "f1", date: "2026-09-20T15:00", teamA: null, teamB: null, stage: "Final", venue: null, venueLat: null, venueLng: null },
      { id: "f2", date: "2026-09-13T09:30", teamA: "Billund", teamB: "Bengal Tigers", stage: null, venue: "Riverside Oval", venueLat: 1, venueLng: 2 }
    ]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /"TBD"," vs ","TBD"/);
  assert.match(text, /"Final"/);
  assert.match(text, /Riverside Oval/);
  const mapsLink = inst.root.findAllByType("a").find(a => a.props.href && a.props.href.includes("Riverside"));
  assert.ok(mapsLink, "the venue renders as a maps link");
});

// Fixtures used to render in whatever order they're stored in (typically all of one group's
// matches, then the next group's -- see generateGroupRoundRobinFixtures), not chronological order,
// so a viewer checking what's on today had to scan the whole list rather than read top to bottom.
test("FollowTournamentScreen: scheduled fixtures are sorted by date/time, earliest first, regardless of storage order", async () => {
  const data = snapshotData({
    fixtures: [
      { id: "f3", date: "2026-09-13T12:45", teamA: "IBCC", teamB: "Horsens" },
      { id: "f1", date: "2026-09-13T09:30", teamA: "Billund", teamB: "Bengal Tigers" },
      { id: "f5", date: "", teamA: "Kolding", teamB: "Viborg" },
      { id: "f2", date: "2026-09-13T10:35", teamA: "Kolding", teamB: "IBCC" }
    ]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  const posA = text.indexOf("Billund");
  const posB = text.indexOf("IBCC\",\" vs \",\"Horsens");
  const posC = text.indexOf("Kolding\",\" vs \",\"IBCC");
  const posUndated = text.indexOf("Kolding\",\" vs \",\"Viborg");
  assert.ok(posA !== -1 && posC !== -1 && posB !== -1 && posUndated !== -1, "all four fixtures render");
  assert.ok(posA < posC, "09:30 fixture (Billund) renders before the 10:35 one (Kolding vs IBCC)");
  assert.ok(posC < posB, "10:35 fixture (Kolding vs IBCC) renders before the 12:45 one (IBCC vs Horsens)");
  assert.ok(posB < posUndated, "every dated fixture renders before the undated one");
});

test("FollowTournamentScreen: shows venue and a format summary line when the snapshot carries them", async () => {
  const data = snapshotData({
    venue: "Green Park", venueLat: 26.45, venueLng: 80.33,
    format: { oversLimit: 20, groupsCount: null, advancePerGroup: null, knockoutStages: null }
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Green Park/);
  assert.match(text, /20 overs/);
});

test("FollowTournamentScreen: a completed fixture's result shows under a Results section, separate from upcoming Fixtures", async () => {
  const data = snapshotData({
    fixtures: [
      { id: "f1", date: "2026-05-01T18:00", teamA: "Riverside 1st XI", teamB: "Riverside 2nd XI", result: "Riverside 1st XI won by 20 runs" },
      { id: "f2", date: "2026-05-08T18:00", teamA: "Riverside 2nd XI", teamB: "Riverside 1st XI", result: null }
    ]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Results/);
  assert.match(text, /won by 20 runs/);
  assert.match(text, /Fixtures/);
});

test("FollowTournamentScreen: a grouped tournament shows one standings table per group instead of one flat table", async () => {
  const data = snapshotData({
    groups: [
      { label: "Group A", standings: [{ team: "Riverside 1st XI", played: 2, won: 2, lost: 0, tied: 0, noResult: 0, points: 4, nrr: 1.1 }] },
      { label: "Group B", standings: [{ team: "Riverside 2nd XI", played: 2, won: 1, lost: 1, tied: 0, noResult: 0, points: 2, nrr: 0.2 }] }
    ]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Group A/);
  assert.match(text, /Group B/);
});

test("FollowTournamentScreen: shows Orange/Purple Cap and a Stats section when the snapshot carries player stats", async () => {
  const data = snapshotData({
    topBatters: [
      { name: "A. Sharma", runs: 210, battingInnings: 4, battingAvg: 70, strikeRate: 130 },
      { name: "B. Kumar", runs: 150, battingInnings: 4, battingAvg: 50, strikeRate: 110 }
    ],
    topBowlers: [
      { name: "D. Singh", wickets: 9, runsConceded: 120, bowlingAvg: 13.3, economy: 5.2 }
    ]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Orange Cap/);
  assert.match(text, /A\. Sharma/);
  assert.match(text, /210/);
  assert.match(text, /Purple Cap/);
  assert.match(text, /D\. Singh/);
  assert.match(text, /Stats/);
  assert.match(text, /Most runs/);
  assert.match(text, /B\. Kumar/);
  assert.match(text, /Most wickets/);
});

test("FollowTournamentScreen: no Orange/Purple Cap or Stats section when the snapshot has no player stats yet", async () => {
  const data = snapshotData(); // no topBatters/topBowlers at all -- an older snapshot, or nothing completed yet
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /Orange Cap/);
  assert.doesNotMatch(text, /Purple Cap/);
  assert.doesNotMatch(text, /Stats/);
});
