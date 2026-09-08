// The "Clubs" screen (src/components/teamsScreen.js). Every write action is a prop -- no bare
// globals, no mount effect. Renders ClubPanel/FederationsPanel as tabs (both already tested on
// their own); these tests focus on TeamsScreen's own logic: the tab switch, the player pool, and
// the "New Club"/"New Federation" FAB. That FAB calls ReactDOM.createPortal(..., document.body)
// internally (see FabButton's own comment) -- a bare global, same as everywhere else in this
// suite -- but react-test-renderer has no real DOM to portal into, so it's stubbed to just render
// the portal's children in place; FabButton's real portaling is covered on its own in
// screenAtoms.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TeamsScreen } from "../../../src/components/teamsScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { ClubPanel } from "../../../src/components/clubPanel.js";
import { FederationsPanel } from "../../../src/components/federationsPanel.js";

beforeEach(() => {
  globalThis.ReactDOM = { createPortal: node => node };
  globalThis.document = { body: null };
});

afterEach(() => {
  delete globalThis.ReactDOM;
  delete globalThis.document;
});

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function club(overrides = {}) {
  return {
    id: "c1", name: "Riverside CC", ownerUid: "owner1", memberUids: ["owner1"],
    playerPool: [], ...overrides
  };
}

function baseProps(overrides = {}) {
  return {
    onManageTeams: () => {}, onBack: () => {}, clubs: [], activeClubId: null, currentUid: "owner1",
    tab: "clubs", onTabChange: () => {},
    activeClubAdminId: null, onSelectClubAdmin: () => {}, onCreateClub: () => Promise.resolve({ ok: true }),
    onJoinClub: () => Promise.resolve({ ok: true }), onInviteClubMember: () => Promise.resolve({ ok: true }),
    onInviteClubCoOwner: () => Promise.resolve({ ok: true }), onRevokeClubInvite: () => Promise.resolve({ ok: true }),
    onLeaveClub: () => {}, onDeleteClub: () => {}, onRenameClub: () => Promise.resolve({ ok: true }),
    onUpdateClubDescription: () => Promise.resolve({ ok: true }), onUpdateClubAddress: () => Promise.resolve({ ok: true }),
    onUploadClubLogo: () => Promise.resolve({ ok: true }), onRemoveClubLogo: () => Promise.resolve({ ok: true }),
    onSetClubVisibility: () => Promise.resolve({ ok: true }), onRemoveClubMember: () => Promise.resolve({ ok: true }),
    onRemoveClubCoOwner: () => Promise.resolve({ ok: true }), onRefreshMyMemberName: () => {},
    federationsById: {}, onCreateFederation: () => Promise.resolve({ ok: true }),
    onSearchPublicFederations: () => Promise.resolve([]), onSearchPublicClubs: () => Promise.resolve([]),
    onRequestFederationAffiliation: () => Promise.resolve({ ok: true }), onSetFederationVisibility: () => Promise.resolve({ ok: true }),
    onLeaveFederation: () => {}, onRenameFederation: () => Promise.resolve({ ok: true }),
    onUpdateFederationDescription: () => Promise.resolve({ ok: true }), onKickClubFromFederation: () => Promise.resolve({ ok: true }),
    onDeleteFederation: () => Promise.resolve({ ok: true }), onLoadFederationTeams: () => Promise.resolve([]),
    onLoadFederationMembers: () => Promise.resolve([]), federationRequests: [],
    onCancelFederationRequest: () => Promise.resolve({ ok: true }), onInviteFederationCoOwnerByEmail: () => Promise.resolve({ ok: true }),
    onRemoveFederationCoOwner: () => Promise.resolve({ ok: true }),
    onOpenRecords: () => {}, onAddUmpire: () => Promise.resolve({ ok: true }), onRemoveUmpire: () => Promise.resolve({ ok: true }),
    onAddPoolPlayers: () => Promise.resolve({ ok: true }), onUpdatePoolPlayer: () => Promise.resolve({ ok: true }),
    onRemovePoolPlayer: () => Promise.resolve({ ok: true }), onCreateTeamFromPool: () => {},
    ...overrides
  };
}

function render(props) {
  return renderer.create(React.createElement(TeamsScreen, baseProps(props)));
}

test("TeamsScreen: tab='clubs' renders ClubPanel with the club-management props", () => {
  const inst = render({ tab: "clubs", clubs: [club()], activeClubAdminId: "c1" });
  const panel = inst.root.findByType(ClubPanel);
  assert.equal(panel.props.activeClubId, "c1");
  assert.equal(panel.props.clubs.length, 1);
  assert.throws(() => inst.root.findByType(FederationsPanel));
});

test("TeamsScreen: tab='federations' renders FederationsPanel", () => {
  const inst = render({ tab: "federations" });
  assert.ok(inst.root.findByType(FederationsPanel));
  assert.throws(() => inst.root.findByType(ClubPanel));
});

test("TeamsScreen: shows a 'New Club' FAB on the clubs tab (hidden once a club is active), a 'New Federation' FAB on the federations tab", () => {
  const clubsInst = render({ tab: "clubs" });
  assert.ok(clubsInst.root.findByProps({ "aria-label": "New Club" }));
  assert.throws(() => clubsInst.root.findByProps({ "aria-label": "New Federation" }));

  // CricketScorer always feeds the same activeClubAdminId state into both of these props (see its
  // own wiring) -- set together here to match.
  const activeClubInst = render({ tab: "clubs", clubs: [club()], activeClubId: "c1", activeClubAdminId: "c1" });
  assert.throws(() => activeClubInst.root.findByProps({ "aria-label": "New Club" }));

  const fedInst = render({ tab: "federations" });
  assert.ok(fedInst.root.findByProps({ "aria-label": "New Federation" }));
  assert.throws(() => fedInst.root.findByProps({ "aria-label": "New Club" }));
});

test("TeamsScreen: tapping the 'New Club' FAB bumps ClubPanel's createSignal prop", () => {
  const inst = render({ tab: "clubs" });
  const before = inst.root.findByType(ClubPanel).props.createSignal;
  act(() => { inst.root.findByProps({ "aria-label": "New Club" }).props.onClick(); });
  assert.notEqual(inst.root.findByType(ClubPanel).props.createSignal, before);
});

test("TeamsScreen: tapping the 'New Federation' FAB bumps FederationsPanel's createSignal prop", () => {
  const inst = render({ tab: "federations" });
  const before = inst.root.findByType(FederationsPanel).props.createSignal;
  act(() => { inst.root.findByProps({ "aria-label": "New Federation" }).props.onClick(); });
  assert.notEqual(inst.root.findByType(FederationsPanel).props.createSignal, before);
});

test("TeamsScreen: switching tabs calls onTabChange", () => {
  let changedTo = null;
  const inst = render({ tab: "clubs", onTabChange: t => { changedTo = t; } });
  const fedTabBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Federations"));
  fedTabBtn.props.onClick();
  assert.equal(changedTo, "federations");
});

test("TeamsScreen: 'Manage teams' calls onManageTeams", () => {
  let managed = false;
  const inst = render({
    tab: "clubs", clubs: [club()], activeClubId: "c1",
    onManageTeams: () => { managed = true; }
  });
  const manageBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Manage teams"));
  manageBtn.props.onClick();
  assert.equal(managed, true);
});

test("TeamsScreen: 'Manage teams' shows the active club's team count as a badge, hidden when it has none", () => {
  const withTeams = render({
    tab: "clubs", clubs: [club()], activeClubId: "c1",
    clubTeamsById: { c1: [{ id: "t1", name: "1st XI" }, { id: "t2", name: "2nd XI" }] }
  });
  const manageBtn = withTeams.root.findAllByType(Btn).find(b => hasText(b.props.children, "Manage teams"));
  const badge = manageBtn.props.children.flat(Infinity).find(c => c && c.type === "span");
  assert.ok(badge, "expected a count badge span inside the button");
  assert.equal(badge.props.children, 2);

  const noTeams = render({ tab: "clubs", clubs: [club()], activeClubId: "c1" });
  const noTeamsBtn = noTeams.root.findAllByType(Btn).find(b => hasText(b.props.children, "Manage teams"));
  const noBadge = noTeamsBtn.props.children.flat(Infinity).find(c => c && c.type === "span");
  assert.equal(noBadge, undefined);
});

test("TeamsScreen: opening the player pool and adding a player calls onAddPoolPlayers", async () => {
  let addedWith = null;
  const inst = render({
    tab: "clubs", clubs: [club()], activeClubId: "c1",
    onAddPoolPlayers: (clubId, players) => { addedWith = { clubId, players }; return Promise.resolve({ ok: true }); }
  });
  const showPoolBtn = inst.root.findByProps({ "aria-label": "Show player pool" });
  act(() => { showPoolBtn.props.onClick(); });

  const nameField = inst.root.findByType("input");
  act(() => { nameField.props.onChange({ target: { value: "Virat Kohli" } }); });

  const addBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Add");
  await act(async () => {
    addBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(addedWith.clubId, "c1");
  assert.deepEqual(addedWith.players, [{ name: "Virat Kohli", role: "" }]);
});

test("TeamsScreen: toggling a pool player's active status calls onUpdatePoolPlayer", async () => {
  let updatedWith = null;
  const inst = render({
    tab: "clubs",
    clubs: [club({ playerPool: [{ id: "p1", name: "Virat Kohli", status: "active" }] })],
    activeClubId: "c1",
    onUpdatePoolPlayer: (clubId, id, updates) => { updatedWith = { clubId, id, updates }; return Promise.resolve({ ok: true }); }
  });
  const showPoolBtn = inst.root.findByProps({ "aria-label": "Show player pool" });
  act(() => { showPoolBtn.props.onClick(); });

  const toggleBtn = inst.root.findByProps({ "aria-label": "Mark Virat Kohli inactive" });
  await act(async () => {
    toggleBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(updatedWith, { clubId: "c1", id: "p1", updates: { status: "inactive" } });
});

test("TeamsScreen: removing a pool player calls onRemovePoolPlayer", async () => {
  let removedWith = null;
  const inst = render({
    tab: "clubs",
    clubs: [club({ playerPool: [{ id: "p1", name: "Virat Kohli", status: "active" }] })],
    activeClubId: "c1",
    onRemovePoolPlayer: (clubId, id) => { removedWith = { clubId, id }; return Promise.resolve({ ok: true }); }
  });
  const showPoolBtn = inst.root.findByProps({ "aria-label": "Show player pool" });
  act(() => { showPoolBtn.props.onClick(); });

  const removeBtn = inst.root.findByProps({ "aria-label": "Remove Virat Kohli from the pool" });
  await act(async () => {
    removeBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(removedWith, { clubId: "c1", id: "p1" });
});

test("TeamsScreen: 'Create team from' a pool tag group calls onCreateTeamFromPool with that group's players", () => {
  let createdWith = null;
  const inst = render({
    tab: "clubs",
    clubs: [club({ playerPool: [
      { id: "p1", name: "Virat Kohli", status: "active", team: "2nd XI" },
      { id: "p2", name: "Rohit Sharma", status: "active", team: "2nd XI" }
    ] })],
    activeClubId: "c1",
    onCreateTeamFromPool: (clubId, tag, players) => { createdWith = { clubId, tag, players }; }
  });
  const showPoolBtn = inst.root.findByProps({ "aria-label": "Show player pool" });
  act(() => { showPoolBtn.props.onClick(); });

  const createTeamBtn = inst.root.findByProps({ "aria-label": "Create team from 2nd XI" });
  act(() => { createTeamBtn.props.onClick(); });
  assert.equal(createdWith.clubId, "c1");
  assert.equal(createdWith.tag, "2nd XI");
  assert.equal(createdWith.players.length, 2);
});
