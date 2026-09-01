// The "Clubs" screen (src/components/teamsScreen.js). Every write action is a prop -- no bare
// globals, no mount effect. Renders ClubPanel/FederationsPanel as tabs (both already tested on
// their own); these tests focus on TeamsScreen's own logic: the tab switch, the player pool, and
// the federation co-owner invite-code redemption box.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TeamsScreen } from "../../../src/components/teamsScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { ClubPanel } from "../../../src/components/clubPanel.js";
import { FederationsPanel } from "../../../src/components/federationsPanel.js";

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
    onRemoveFederationCoOwner: () => Promise.resolve({ ok: true }), onRedeemFederationCoOwnerInvite: () => Promise.resolve({ ok: true }),
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

test("TeamsScreen: redeeming a federation co-owner invite calls onRedeemFederationCoOwnerInvite and shows the federation name", async () => {
  let redeemedWith = null;
  const inst = render({
    tab: "federations",
    onRedeemFederationCoOwnerInvite: code => {
      redeemedWith = code;
      return Promise.resolve({ ok: true, federation: { name: "County League" } });
    }
  });
  const codeField = inst.root.findByType("input");
  act(() => { codeField.props.onChange({ target: { value: "abc-123" } }); });

  const redeemBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Redeem"));
  await act(async () => {
    redeemBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(redeemedWith, "ABC123");
  assert.match(JSON.stringify(inst.toJSON()), /County League/);
});
