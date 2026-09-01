// Single tournament fixture row (src/components/fixtureRow.js). References Modal as a bare,
// unimported global for its own "which team?" picker, so tests stub globalThis.Modal without
// pulling in jsdom. loadFixturePollSummary is a bare-global Firestore call that runs from a
// mount-time useEffect, so every test stubs it and wraps the initial render in act() -- same
// pattern as UpcomingFixtureCard/AvailabilityPollModal/BetaTestersScreen.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { FixtureRow } from "../../../src/components/fixtureRow.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
  globalThis.loadFixturePollSummary = () => Promise.resolve([]);
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadFixturePollSummary;
  delete globalThis.loadTeamPolls;
});

const tournament = { id: "tour1", name: "Summer Cup", venue: null };

async function renderRow(fixture, extraProps = {}) {
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(FixtureRow, {
      fixture, tournament, match: null, onScore: () => {}, onUpdateDate: () => {},
      onDelete: () => {}, ...extraProps
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("FixtureRow: shows the two team names and a 'Score' button when no match has started yet", async () => {
  const inst = await renderRow({ id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
  assert.ok(inst.root.findAllByType(Btn).find(b => b.props.children === "Score"));
});

test("FixtureRow: with an in-progress or complete match, shows the score/result line instead of 'Score'", async () => {
  const inProgress = await renderRow(
    { id: "f1", teamA: "A", teamB: "B" },
    { match: { status: "live", innings: [{ battingTeam: "A", runs: 85, wickets: 3, legalBalls: 72, ballsPerOver: 6, battingOrder: ["x"] }] } }
  );
  assert.match(JSON.stringify(inProgress.toJSON()), /85-3/);

  const complete = await renderRow(
    { id: "f1", teamA: "A", teamB: "B" },
    {
      match: {
        status: "complete",
        innings: [
          { battingTeam: "A", runs: 150, wickets: 8 },
          { battingTeam: "B", runs: 120, wickets: 10 }
        ]
      }
    }
  );
  assert.match(JSON.stringify(complete.toJSON()), /won by 30 runs/);
});

test("FixtureRow: onDelete/onScore wire straight to the buttons", async () => {
  let deleted = false, scored = false;
  const inst = await renderRow(
    { id: "f1", teamA: "A", teamB: "B" },
    { onDelete: () => { deleted = true; }, onScore: () => { scored = true; } }
  );
  inst.root.findByProps({ "aria-label": "Remove fixture" }).props.onClick();
  assert.equal(deleted, true);
  inst.root.findAllByType(Btn).find(b => b.props.children === "Score").props.onClick();
  assert.equal(scored, true);
});

test("FixtureRow: scheduling via the date picker calls onUpdateDate with a built ISO string", async () => {
  let updatedIso;
  const inst = await renderRow(
    { id: "f1", teamA: "A", teamB: "B" },
    { onUpdateDate: iso => { updatedIso = iso; } }
  );
  const pickerBtn = inst.root.findByProps({ "aria-label": "Fixture date and time" });
  act(() => { pickerBtn.props.onClick(); });
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  const dayButtons = inst.root.findAllByType("button").filter(b => typeof b.props.children === "number");
  act(() => { dayButtons[0].props.onClick(); });
  act(() => { saveBtn.props.onClick(); });
  assert.ok(updatedIso);
});

test("FixtureRow: 'Send availability poll' only appears when a team resolves to one this person manages", async () => {
  const clubs = [{ id: "c1", name: "Riverside CC" }];
  const clubTeamsById = { c1: [{ id: "team1", name: "Riverside CC" }] };
  const withMatch = await renderRow({ id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" }, { clubs, clubTeamsById });
  assert.ok(withMatch.root.findByProps({ "aria-label": "Send availability poll" }));

  const withoutMatch = await renderRow({ id: "f1", teamA: "Nobody CC", teamB: "Nobody Else CC" }, { clubs, clubTeamsById });
  assert.throws(() => withoutMatch.root.findByProps({ "aria-label": "Send availability poll" }));
});

test("FixtureRow: shows the venue as a Maps link, or an 'Add venue' button when onEditVenue is given and there's none", async () => {
  const withVenue = await renderRow({ id: "f1", teamA: "A", teamB: "B", venue: "Riverside Ground" });
  const link = withVenue.root.findAllByType("a").find(a => hasText(a.props.children, "Riverside Ground"));
  assert.ok(link);

  const withoutVenue = await renderRow({ id: "f1", teamA: "A", teamB: "B" }, { onEditVenue: () => {} });
  assert.match(JSON.stringify(withoutVenue.toJSON()), /Add venue/);
});
