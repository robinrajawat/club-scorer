// "Teams" screen (src/components/myTeamsScreen.js). Every write action is a prop, not a bare
// global, so this needs no Firestore stubbing. Every team is just the account's own now -- no club
// wrapper, no per-team "poll availability" action, no owner/member permission split (see
// docs/simplification-plan.md).

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { MyTeamsScreen } from "../../../src/components/myTeamsScreen.js";
import { SwipeableRow } from "../../../src/components/scoringUiAtoms.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { Shield } from "../../../src/components/icons.js";

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

// FabButton (rendered only when showTabBar is true -- see myTeamsScreen.js's own comment) calls
// ReactDOM.createPortal(..., document.body) as a bare global, same as Modal elsewhere in this
// suite -- react-test-renderer has no real DOM to portal into, so this stub renders the portal's
// children in place instead. Harmless for every other test here, which doesn't pass showTabBar
// and so never mounts FabButton at all.
// Modal (bare global, same pattern as everywhere else) backs ConfirmModal's own delete dialog --
// stub it here too, alongside the FabButton portal stubs, rather than per-test.
beforeEach(() => {
  globalThis.ReactDOM = { createPortal: node => node };
  globalThis.document = { body: null };
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.ReactDOM;
  delete globalThis.document;
  delete globalThis.Modal;
});

function team(overrides = {}) {
  return { id: "t1", name: "Riverside 1st XI", players: [], ...overrides };
}

test("MyTeamsScreen: lists teams, wires onEditTeam", () => {
  let edited = null;
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {},
    onEditTeam: t => { edited = t; }, onDeleteTeam: () => {}
  }));
  assert.match(JSON.stringify(inst.toJSON()), /Riverside 1st XI/);
  const editBtn = inst.root.findByProps({ "aria-label": `Edit ${teams[0].name}` });
  editBtn.props.onClick();
  assert.equal(edited.id, "t1");
});

// The FAB (see screenAtoms.js) is the "add a team" entry point on the Teams tab itself, same as
// every other tab-bar screen's own create flow -- the inline "+ New" link only still renders for
// the no-tab-bar drill-in (onBack set, reached from elsewhere in the app), which has no FAB.
test("MyTeamsScreen: the Teams tab (showTabBar) shows a floating 'New team' button, wired to onNewTeam, instead of the inline link", () => {
  let newCalled = false;
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], showTabBar: true, onNewTeam: () => { newCalled = true; }
  }));
  const fab = inst.root.findByProps({ "aria-label": "New team" });
  fab.props.onClick();
  assert.equal(newCalled, true);
  assert.equal(inst.root.findAllByProps({ "aria-label": "New team" }).length, 1, "only the FAB, not also the inline link");
});

test("MyTeamsScreen: the no-tab-bar drill-in (onBack) shows the inline 'New team' link, not a FAB, wired to onNewTeam", () => {
  let newCalled = false;
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onBack: () => {}, onNewTeam: () => { newCalled = true; }
  }));
  const link = inst.root.findByProps({ "aria-label": "New team" });
  link.props.onClick();
  assert.equal(newCalled, true);
  assert.equal(inst.root.findAllByProps({ "aria-label": "New team" }).length, 1, "only the inline link, not also a FAB");
});

// SwipeableRow's Delete used to call onDeleteTeam the instant it was tapped -- no confirmation,
// unlike TeamEditScreen's own "Delete team" button, which has always confirmed first for the same
// destructive, unrecoverable action. Now both entry points go through the same ConfirmModal step.
test("MyTeamsScreen: deleting a team via swipe opens a confirm dialog first, not an immediate delete", () => {
  let deletedId = "unset";
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {},
    onDeleteTeam: id => { deletedId = id; }
  }));
  const row = inst.root.findByType(SwipeableRow);
  act(() => { row.props.onDelete(); });
  assert.equal(deletedId, "unset", "not deleted yet -- confirmation still pending");
  assert.match(JSON.stringify(inst.toJSON()), /Delete Riverside 1st XI\?/);
});

test("MyTeamsScreen: confirming the swipe-delete dialog calls onDeleteTeam, cancelling doesn't", () => {
  let deletedId = null, deletedClubId = "unset";
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {},
    onDeleteTeam: (id, clubId) => { deletedId = id; deletedClubId = clubId; }
  }));
  const row = inst.root.findByType(SwipeableRow);
  act(() => { row.props.onDelete(); });

  const cancelBtn = inst.root.findAllByType(Btn).find(b => hasText(b.props.children, "Cancel"));
  act(() => { cancelBtn.props.onClick(); });
  assert.equal(deletedId, null, "cancel doesn't delete");
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Delete Riverside 1st XI\?/, "dialog closes on cancel");

  act(() => { inst.root.findByType(SwipeableRow).props.onDelete(); });
  const confirmBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Delete");
  act(() => { confirmBtn.props.onClick(); });
  assert.equal(deletedId, "t1");
  assert.equal(deletedClubId, null);
});

test("MyTeamsScreen: a team row shows captain/vice-captain/keeper pills when set, nothing extra when not", () => {
  // Same live-tree read as TeamEditScreen's own summary-card test: a span's text can be split
  // across several children (e.g. "C", " · ", name), which .join("") reassembles faithfully,
  // unlike JSON.stringify(toJSON()) which comma-separates them into unmatchable fragments.
  function pillText(inst) {
    return inst.root.findAllByType("span")
      .filter(s => s.props.style && s.props.style.borderRadius === 10 && s.props.style.padding === "2px 7px")
      .map(s => [].concat(s.props.children).join(""));
  }
  const plain = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  assert.equal(pillText(plain).length, 0);

  const tagged = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team({ captain: "A. Sharma", viceCaptain: "B. Kumar", keeper: "C. Patel" })],
    matches: [], onNewTeam: () => {}
  }));
  const text = pillText(tagged);
  assert.ok(text.includes("C · A. Sharma"));
  assert.ok(text.includes("VC · B. Kumar"));
  assert.ok(text.includes("WK · C. Patel"));
});

test("MyTeamsScreen: a team's jersey color shows as a shield crest next to its name; no shield when unset", () => {
  const withColor = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team({ color: "#1b3a6b" })], matches: [], onNewTeam: () => {}
  }));
  const shield = withColor.root.findByType(Shield);
  assert.equal(shield.props.style.fill, "#1b3a6b");

  const noColor = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  assert.throws(() => noColor.root.findByType(Shield));
});

test("MyTeamsScreen: shows a loading state while teamsLoading is true, without crashing", () => {
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [], teamsLoading: true, matches: [], onBack: () => {}, onNewTeam: () => {}
  }));
  assert.doesNotThrow(() => inst.toJSON());
});

test("MyTeamsScreen: shows a Back button only when onBack is given (a drill-in from Home), none when it's the Teams tab itself", () => {
  let backCalled = false;
  const withBack = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onBack: () => { backCalled = true; }, onNewTeam: () => {}
  }));
  const backBtn = withBack.root.findByProps({ "aria-label": "Back" });
  backBtn.props.onClick();
  assert.equal(backCalled, true);

  const asTab = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  assert.throws(() => asTab.root.findByProps({ "aria-label": "Back" }));
});

test("MyTeamsScreen: every team is editable -- no owner/member permission split any more", () => {
  const teams = [team({ id: "t2", name: "Seconds" })];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onBack: () => {}, onNewTeam: () => {}, onEditTeam: () => {}
  }));
  assert.ok(inst.root.findByProps({ "aria-label": `Edit ${teams[0].name}` }));
});

test("MyTeamsScreen: the swipe row's extra (pin) action isn't wired at all when onTogglePin isn't given", () => {
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team()], matches: [], onNewTeam: () => {}
  }));
  const row = inst.root.findByType(SwipeableRow);
  assert.equal(row.props.onExtra, undefined);
  assert.equal(row.props.extraIcon, undefined);
});

test("MyTeamsScreen: swiping to the extra action calls onTogglePin with that team; extraActive flips once pinned", () => {
  let pinned = null;
  const teams = [team()];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onNewTeam: () => {}, onTogglePin: t => { pinned = t; }
  }));
  const row = inst.root.findByType(SwipeableRow);
  assert.equal(row.props.extraActive, false);
  assert.equal(row.props.extraLabel, "Pin");
  assert.equal(row.props.extraActiveLabel, "Unpin");
  row.props.onExtra();
  assert.equal(pinned.id, "t1");

  const alreadyPinned = renderer.create(React.createElement(MyTeamsScreen, {
    teams: [team({ pinned: true })], matches: [], onNewTeam: () => {}, onTogglePin: () => {}
  }));
  assert.equal(alreadyPinned.root.findByType(SwipeableRow).props.extraActive, true);
});

test("MyTeamsScreen: pinned teams sort to the top, preserving the given order within each group", () => {
  const teams = [
    team({ id: "a", name: "Alpha CC" }),
    team({ id: "b", name: "Bravo CC", pinned: true }),
    team({ id: "c", name: "Charlie CC" }),
    team({ id: "d", name: "Delta CC", pinned: true })
  ];
  const inst = renderer.create(React.createElement(MyTeamsScreen, {
    teams, matches: [], onNewTeam: () => {}, onTogglePin: () => {}
  }));
  const text = JSON.stringify(inst.toJSON());
  const order = ["Bravo CC", "Delta CC", "Alpha CC", "Charlie CC"].map(n => text.indexOf(n));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "pinned teams (Bravo, Delta) appear before unpinned ones (Alpha, Charlie), each group in its original order");
});
