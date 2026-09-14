// Small presentational table components (src/components/tableAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { StandingsTable } from "../../../src/components/tableAtoms.js";

test("StandingsTable: one row per team, formats NRR with a sign, dashes for a team that hasn't played", () => {
  const standings = [
    { team: "A", played: 2, won: 2, lost: 0, tied: 0, noResult: 0, points: 4, nrr: 0.845 },
    { team: "B", played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, nrr: 0 }
  ];
  const inst = renderer.create(React.createElement(StandingsTable, { standings }));
  const rows = inst.root.findAllByType("tr").slice(1); // skip header row
  assert.equal(rows.length, 2);
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /\+0\.845/);
  assert.match(text, /—/); // team B, played 0
});
