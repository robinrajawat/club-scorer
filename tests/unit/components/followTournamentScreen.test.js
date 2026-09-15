// Public "?tournament=CODE" standings view (src/components/followTournamentScreen.js). Reads its
// snapshot via `db.collection("tournamentViews").doc(code).get()` from a mount-time useEffect --
// `db` (the raw Firestore SDK instance, a bare global, not extracted) is stubbed here, same
// pattern as `auth` in authActionScreen.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FollowTournamentScreen } from "../../../src/components/followTournamentScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { COLORS } from "../../../src/components/theme.js";

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.db;
  delete globalThis.Modal;
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

// Reported live: results showing in no discernible order -- Results is sorted most-recently-played
// first (the reverse of Fixtures' own soonest-first order above), regardless of storage order.
test("FollowTournamentScreen: Results are sorted by date/time, most recently played first, regardless of storage order", async () => {
  const data = snapshotData({
    fixtures: [
      { id: "f1", date: "2026-05-01T18:00", teamA: "Oldest", teamB: "Rival", result: "Oldest won by 1 run" },
      { id: "f3", date: "", teamA: "Undated", teamB: "Rival", result: "Undated won by 1 run" },
      { id: "f2", date: "2026-05-08T18:00", teamA: "Newest", teamB: "Rival", result: "Newest won by 1 run" }
    ]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  const posNewest = text.indexOf("Newest");
  const posOldest = text.indexOf("Oldest");
  const posUndated = text.indexOf("Undated");
  assert.ok(posNewest !== -1 && posOldest !== -1 && posUndated !== -1, "all three results render");
  assert.ok(posNewest < posOldest, "the more recent result (8 May) renders before the older one (1 May)");
  assert.ok(posOldest < posUndated, "every dated result renders before the undated one");
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

// Reported live as a genuine miss: a spectator had no way to see the tournament's house rules
// (Free Hit, a non-standard wide/no-ball run value, Super Over, ...) even though the in-app
// schedule always shows them. Reuses the exact same nonStandardRulesText summary the in-app rules
// editor's own review step already produces. Tucked behind an Info icon (tap to reveal in a Modal)
// rather than always shown inline -- same pattern followScreen.js's own "Match details" Info icon
// already uses for a single match's toss/house-rules/umpires info, so a long rules summary doesn't
// crowd the header by default.
test("FollowTournamentScreen: an Info icon reveals house rules in a modal when the tournament has non-standard rules; no icon at all when it doesn't", async () => {
  const withRules = snapshotData({ rules: { wideRuns: 2, freeHit: true } });
  const instWithRules = await renderScreen("ABCD12", { exists: true, data: () => withRules });
  assert.doesNotMatch(JSON.stringify(instWithRules.toJSON()), /2 runs on a wide/);
  const infoBtn = instWithRules.root.findByProps({ "aria-label": "House rules" });
  act(() => { infoBtn.props.onClick(); });
  const textAfterOpen = JSON.stringify(instWithRules.toJSON());
  assert.match(textAfterOpen, /House rules/);
  assert.match(textAfterOpen, /2 runs on a wide/);
  assert.match(textAfterOpen, /Free Hit enabled/);

  const withoutRules = snapshotData({ rules: null });
  const instWithoutRules = await renderScreen("ABCD12", { exists: true, data: () => withoutRules });
  assert.throws(() => instWithoutRules.root.findByProps({ "aria-label": "House rules" }));
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

// Reported live as a genuine miss: "match completed for the tournament, are not able to get into
// it to see the scorecard." A completed fixture's result is tappable into the full scorecard (via
// onOpenMatch) whenever that fixture has a matchId at all -- no bearer code needed (see
// followTournamentScreen.js's own comment on why); a fixture with no matchId (never linked to a
// match) stays a plain, non-clickable result line.
test("FollowTournamentScreen: a completed fixture's result is tappable into the scorecard when its fixture has a matchId, plain text when it doesn't", async () => {
  let openedId = null;
  let openedStage = null;
  const data = snapshotData({
    fixtures: [
      { id: "f1", date: "2026-05-01T18:00", teamA: "Riverside 1st XI", teamB: "Riverside 2nd XI", result: "Riverside 1st XI won by 20 runs", matchId: "M1", stage: "Semifinal" },
      { id: "f2", date: "2026-05-08T18:00", teamA: "Riverside 2nd XI", teamB: "Riverside 1st XI", result: "Riverside 2nd XI won by 5 wickets", matchId: null }
    ]
  });
  const inst = await renderScreen("XYZ999", { exists: true, data: () => data }, { onOpenMatch: (id, stage) => { openedId = id; openedStage = stage; } });

  const tappableResult = inst.root.findByProps({ "aria-label": "View scorecard: Riverside 1st XI won by 20 runs" });
  act(() => { tappableResult.props.onClick(); });
  assert.equal(openedId, "M1");
  // The fixture's own stage rides along too, so FollowScreen can show it instead of generic
  // wording once opened -- see followScreen.test.js's own coverage of that display.
  assert.equal(openedStage, "Semifinal");

  assert.throws(() => inst.root.findByProps({ "aria-label": "View scorecard: Riverside 2nd XI won by 5 wickets" }));
  assert.match(JSON.stringify(inst.toJSON()), /Riverside 2nd XI won by 5 wickets/);
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

// Requested live: "perhaps a highlight to top 3, something to enhance the readability" -- ten
// visually identical rows read as a wall of text. The top 3 in each list now get a filled rank
// badge and bolder name/value; the rest get a plain muted number, same row shape either way.
test("FollowTournamentScreen: Stats rows rank 1-3 with a highlighted badge, the rest with a plain muted number", async () => {
  const data = snapshotData({
    topBatters: [1, 2, 3, 4].map(n => ({ name: `Batter ${n}`, runs: 300 - n * 10, battingInnings: 4, battingAvg: 50, strikeRate: 110 }))
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const json = inst.toJSON();
  function findRankBadges(node) {
    if (Array.isArray(node)) return node.flatMap(findRankBadges);
    if (node && node.type === "span" && node.props["aria-hidden"] === "true" && /^\d+$/.test(node.children?.[0])) return [node];
    if (node && node.children) return findRankBadges(node.children);
    return [];
  }
  const badges = findRankBadges(json);
  assert.equal(badges.length, 4);
  assert.deepEqual(badges.map(b => b.children[0]), ["1", "2", "3", "4"]);
  // Top 3 get the gold-filled badge background; rank 4 doesn't.
  assert.equal(badges[0].props.style.background, COLORS.gold);
  assert.equal(badges[1].props.style.background, COLORS.gold);
  assert.equal(badges[2].props.style.background, COLORS.gold);
  assert.equal(badges[3].props.style.background, "transparent");
});

test("FollowTournamentScreen: no Orange/Purple Cap or Stats section when the snapshot has no player stats yet", async () => {
  const data = snapshotData(); // no topBatters/topBowlers at all -- an older snapshot, or nothing completed yet
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /Orange Cap/);
  assert.doesNotMatch(text, /Purple Cap/);
  assert.doesNotMatch(text, /Stats/);
});

// Requested live once the app saw its first real tournament through to the end: "when the
// tournament is over I think would be nice to see a card that shows who won... runner up... player
// of the tournament." champion/runnerUp/playerOfTournament all arrive from the snapshot already
// null before there's a decided result (formatTournamentViewSnapshot, src/core/appLogic.js), so the
// whole card is gated on data.champion alone -- no separate "is it complete" check needed here.
test("FollowTournamentScreen: shows a Tournament Champion card with the runner-up and Player of the Tournament once decided", async () => {
  const data = snapshotData({ champion: "Riverside 1st XI", runnerUp: "Riverside 2nd XI", playerOfTournament: "A. Sharma" });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Tournament Champion/);
  assert.match(text, /Runner-up: /);
  assert.match(text, /Player of the Tournament: /);
  assert.match(text, /A\. Sharma/);
});

test("FollowTournamentScreen: no Tournament Champion card before there's a decided result", async () => {
  const data = snapshotData(); // no champion at all -- tournament still in progress
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /Tournament Champion/);
});

// Requested live: "orange/purple cap card can also go after the champion card" -- both are
// end-of-tournament summary callouts, so they should read together at the top of the page rather
// than the cap card sitting all the way down past the whole standings table. Checked by ACTUAL
// render order (string index), not just presence -- a naive text-presence check wouldn't catch a
// regression back to the old position.
test("FollowTournamentScreen: the Orange/Purple Cap card renders right after the Tournament Champion card, ahead of standings", async () => {
  const data = snapshotData({
    champion: "Riverside 1st XI", runnerUp: "Riverside 2nd XI", playerOfTournament: "A. Sharma",
    topBatters: [{ name: "A. Sharma", runs: 210, battingInnings: 4, battingAvg: 70, strikeRate: 130 }],
    topBowlers: [{ name: "D. Singh", wickets: 9, runsConceded: 120, bowlingAvg: 13.3, economy: 5.2 }]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  const championIdx = text.indexOf("Tournament Champion");
  const capIdx = text.indexOf("Orange Cap");
  // A value unique to the standings table itself (its NRR column) -- team names alone would
  // collide with the champion/runner-up text already rendered earlier on the page.
  const standingsIdx = text.indexOf("0.512");
  assert.ok(championIdx >= 0 && capIdx >= 0 && standingsIdx >= 0, "sanity check -- all three sections actually rendered");
  assert.ok(championIdx < capIdx, "the cap card comes after the champion card");
  assert.ok(capIdx < standingsIdx, "the cap card comes before standings, not after");
});
