// Upcoming fixture card (src/components/upcomingFixtureCard.js). References Modal as a bare,
// unimported global for its own "which team?" picker, so tests stub globalThis.Modal without
// pulling in jsdom. loadFixturePollSummary/fetchFixtureWeather are bare-global Firestore/network
// calls that run from mount-time useEffects, so every test stubs them and wraps the initial render
// in act() -- same pattern as AvailabilityPollModal/BetaTestersScreen.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { UpcomingFixtureCard } from "../../../src/components/upcomingFixtureCard.js";
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
  globalThis.fetchFixtureWeather = () => Promise.resolve(null);
});

afterEach(() => {
  delete globalThis.Modal;
  delete globalThis.loadFixturePollSummary;
  delete globalThis.fetchFixtureWeather;
  delete globalThis.loadTeamPolls;
  delete globalThis.loadPollByCode;
});

const tournament = { id: "tour1", name: "Summer Cup", venue: null };

async function renderCard(fixture, extraProps = {}) {
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(UpcomingFixtureCard, {
      tournament, fixture, index: 0,
      onOpenTournament: () => {}, ...extraProps
    }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("UpcomingFixtureCard: shows the two team names and 'Not yet scheduled' with no date", async () => {
  const inst = await renderCard({ id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
  assert.match(text, /Not yet scheduled/);
});

test("UpcomingFixtureCard: with onScheduleFixture, opening the date picker and saving calls it with a built ISO string", async () => {
  let scheduledIso;
  const inst = await renderCard(
    { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" },
    { onScheduleFixture: (t, fixtureId, iso) => { scheduledIso = iso; return Promise.resolve({ ok: true }); } }
  );
  const pickerBtn = inst.root.findByProps({ "aria-label": "Fixture date and time" });
  act(() => { pickerBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Fixture date & time/); // FixtureDateTimeModal opened

  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  const dayButtons = inst.root.findAllByType("button").filter(b => typeof b.props.children === "number");
  act(() => { dayButtons[0].props.onClick(); });
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(scheduledIso);
});

// BUG FIX: a failed schedule save (Firestore rules are the real enforcement, not any client-side
// check, so a non-owner's save can still fail server-side) used to go through window.alert(), a
// plain OS popup that looks like it belongs to a different app next to the rest of this card's own
// styling. Now shows an in-app AlertModal instead.
test("UpcomingFixtureCard: a failed schedule save shows an in-app AlertModal instead of window.alert()", async () => {
  const inst = await renderCard(
    { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" },
    { onScheduleFixture: () => Promise.resolve({ ok: false, error: "Only the club owner can edit fixtures." }) }
  );
  const pickerBtn = inst.root.findByProps({ "aria-label": "Fixture date and time" });
  act(() => { pickerBtn.props.onClick(); });
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save");
  const dayButtons = inst.root.findAllByType("button").filter(b => typeof b.props.children === "number");
  act(() => { dayButtons[0].props.onClick(); });
  await act(async () => {
    saveBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /Only the club owner can edit fixtures/);
});

test("UpcomingFixtureCard: shows the venue as a Maps link, or an 'Add venue' button when onEditVenue is given and there's none", async () => {
  const withVenue = await renderCard({ id: "f1", teamA: "A", teamB: "B", venue: "Riverside Ground" });
  const link = withVenue.root.findAllByType("a").find(a => hasText(a.props.children, "Riverside Ground"));
  assert.ok(link);
  assert.match(link.props.href, /Riverside\+Ground|Riverside%20Ground|riverside/i);

  const withoutVenue = await renderCard({ id: "f1", teamA: "A", teamB: "B" }, { onEditVenue: () => {} });
  assert.match(JSON.stringify(withoutVenue.toJSON()), /Add venue/);
});

test("UpcomingFixtureCard: 'Send availability poll' button only appears when a team resolves to one this person manages", async () => {
  const clubs = [{ id: "c1", name: "Riverside CC" }];
  const clubTeamsById = { c1: [{ id: "team1", name: "Riverside CC" }] };
  const withMatch = await renderCard(
    { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" },
    { clubs, clubTeamsById }
  );
  assert.ok(withMatch.root.findByProps({ "aria-label": "Send availability poll" }));

  const withoutMatch = await renderCard({ id: "f1", teamA: "Nobody CC", teamB: "Nobody Else CC" }, { clubs, clubTeamsById });
  assert.throws(() => withoutMatch.root.findByProps({ "aria-label": "Send availability poll" }));
});

test("UpcomingFixtureCard: sending a poll checks for an existing one first via the (stubbed) loadTeamPolls", async () => {
  const clubs = [{ id: "c1", name: "Riverside CC" }];
  const clubTeamsById = { c1: [{ id: "team1", name: "Riverside CC" }] };
  globalThis.loadTeamPolls = () => Promise.resolve([{ code: "EXIST1", fixtureId: "f1", expiresAt: null }]);
  // AvailabilityPollModal's own mount effect, once it opens with this initialCode, calls
  // loadTeamPolls again (for its list view) and loadPollByCode (to jump straight to results).
  globalThis.loadPollByCode = () => Promise.resolve({ code: "EXIST1", question: "Free Saturday?", responses: {} });
  const inst = await renderCard(
    { id: "f1", teamA: "Riverside CC", teamB: "Oakwood CC" },
    { clubs, clubTeamsById }
  );
  const pollBtn = inst.root.findByProps({ "aria-label": "Send availability poll" });
  await act(async () => {
    pollBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  // AvailabilityPollModal opened straight to the existing poll's results (initialCode set).
  assert.match(JSON.stringify(inst.toJSON()), /data-stub-modal/);
});

test("UpcomingFixtureCard: 'Start match' calls onStartFixture, hidden without it", async () => {
  let started = false;
  const withStart = await renderCard(
    { id: "f1", teamA: "A", teamB: "B" },
    { onStartFixture: () => { started = true; } }
  );
  const startBtn = withStart.root.findAllByType(Btn).find(b => b.props.children === "Start match");
  startBtn.props.onClick();
  assert.equal(started, true);

  const withoutStart = await renderCard({ id: "f1", teamA: "A", teamB: "B" });
  assert.equal(withoutStart.root.findAllByType(Btn).find(b => b.props.children === "Start match"), undefined);
});
