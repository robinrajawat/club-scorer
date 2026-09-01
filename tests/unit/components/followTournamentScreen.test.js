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

test("FollowTournamentScreen: shows scheduled fixtures when present", async () => {
  const data = snapshotData({
    fixtures: [{ id: "f1", date: "2026-05-01T18:00", teamA: "Riverside 1st XI", teamB: "Riverside 2nd XI" }]
  });
  const inst = await renderScreen("ABCD12", { exists: true, data: () => data });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Fixtures/);
});
