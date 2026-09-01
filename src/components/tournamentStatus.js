import { COLORS } from "./theme.js";

// Display label/color lookup tables for a tournament's computed status (see tournamentStatus() in
// src/core/miscHelpers.js, which returns one of these keys). Covered by
// tests/unit/components/tournamentStatus.test.js.

export const TOURNAMENT_STATUS_LABELS = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed"
};
export const TOURNAMENT_STATUS_COLORS = {
  upcoming: COLORS.gold,
  ongoing: COLORS.turf,
  completed: COLORS.inkSoft
};
