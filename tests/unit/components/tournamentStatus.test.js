// Tournament status label/color lookup tables (src/components/tournamentStatus.js).

import test from "node:test";
import assert from "node:assert/strict";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_STATUS_COLORS } from "../../../src/components/tournamentStatus.js";
import { tournamentStatus } from "../../../src/core/miscHelpers.js";

test("TOURNAMENT_STATUS_LABELS/COLORS: cover every status tournamentStatus() can return", () => {
  const possibleStatuses = [
    tournamentStatus({ fixtures: [] }),
    tournamentStatus({ fixtures: [{ matchId: null }] }),
    tournamentStatus({ fixtures: [{ matchId: "m1" }] })
  ];
  for (const status of possibleStatuses) {
    assert.equal(typeof TOURNAMENT_STATUS_LABELS[status], "string");
    assert.equal(typeof TOURNAMENT_STATUS_COLORS[status], "string");
  }
});
