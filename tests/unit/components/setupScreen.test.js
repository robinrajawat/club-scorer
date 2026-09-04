// The multi-page "New Match" setup flow (src/components/setupScreen.js). Every write is a prop
// (onStart/onCancel) -- no bare Firestore globals -- but a page-change effect calls
// window.scrollTo directly (to reset scroll position when swapping pages), so this stubs a
// minimal globalThis.window rather than pulling in jsdom just for that one call, same as
// TournamentShareModal's own minimal window stub. With no saved teams picked (typed names only),
// hasSquads is false and the "xi" page is skipped entirely, so these tests walk
// teams -> rules -> openers -> review, matching the common path most matches actually take.
// PlayerPicker falls back to a plain text field (placeholder "Batsman name"/"Bowler name") when
// there's no saved roster, found via the host <input>, same as TextField elsewhere in this suite.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach, beforeEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { SetupScreen } from "../../../src/components/setupScreen.js";
import { Btn, TeamChips, RuleChoice } from "../../../src/components/formUiAtoms.js";
import { PlayerPicker } from "../../../src/components/pickerAtoms.js";
import { Field } from "../../../src/components/screenAtoms.js";
import { VenueEditModal } from "../../../src/components/venueAndDateModals.js";

beforeEach(() => {
  globalThis.window = { scrollTo: () => {} };
  // VenueEditModal (the venue field's address-search picker) references Modal as a bare global,
  // same pattern as every other Modal-based component in this app -- see venueAndDateModals.js's
  // own comment and tournamentsScreen.test.js's identical stub.
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});
afterEach(() => {
  delete globalThis.window;
  delete globalThis.Modal;
});

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && "children" in node) return hasText(node.children, str);
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

function baseProps(overrides = {}) {
  return {
    onStart: () => {}, onCancel: () => {}, teams: [], rules: {}, presetTournament: null,
    clubUmpires: [],
    ...overrides
  };
}

function render(props) {
  let inst;
  act(() => { inst = renderer.create(React.createElement(SetupScreen, baseProps(props))); });
  return inst;
}

function input(inst, placeholder) {
  return inst.root.findAllByType("input").find(i => i.props.placeholder === placeholder);
}

function btn(inst, text) {
  return inst.root.findAllByType(Btn).find(b => b.props.children === text);
}

// Finds the wrapping <div style={{marginTop:14}}> a toggle/nullable-number rule block renders as
// in the match rules editor, scoped by its own label text -- lets tests disambiguate between the
// several "Off"-labeled toggle buttons the rules editor now has.
function ruleBlock(inst, labelText) {
  return inst.root.findAll(n => n.type === "div" && n.props.style && n.props.style.marginTop === 14 && hasText(n.props.children, labelText))[0];
}

test("SetupScreen: shows 'New Match' and starts on the Teams & Format page", () => {
  const inst = render();
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /New Match/);
  // "Step ", 1, " of ", 4 render as separate JSX children, not one concatenated string.
  assert.match(text, /"Step ","1"," of ","4"/);
  assert.match(text, /Teams & Format/);
});

test("SetupScreen: Cancel on the first page calls onCancel", () => {
  let cancelled = false;
  const inst = render({ onCancel: () => { cancelled = true; } });
  const cancelBtn = btn(inst, "Cancel");
  act(() => { cancelBtn.props.onClick(); });
  assert.equal(cancelled, true);
});

test("SetupScreen: Next stays disabled until team names, overs, and toss are all set", () => {
  const inst = render();
  assert.equal(btn(inst, "Next").props.disabled, true);

  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  assert.equal(btn(inst, "Next").props.disabled, true); // no toss recorded yet

  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  const batBtn = inst.root.findAllByType("button").find(b => b.props.children === "Bat");
  act(() => { batBtn.props.onClick(); });

  assert.equal(btn(inst, "Next").props.disabled, false);
});

test("SetupScreen: same team name on both sides shows a warning and blocks Next", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Riverside CC" } }); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Both sides have the same name/);
  assert.equal(btn(inst, "Next").props.disabled, true);
});

// Regression test: a stray closing paren once let the "rules" page's own div swallow one extra
// sibling (the "Retirement run cap" field, the last one in that page) into the OUTER page
// wrapper instead, making it render on every page regardless of which one was selected --
// reported live as "Retirement run cap" showing up on the very first "Teams & Format" page.
test("SetupScreen: 'Retirement run cap' (and the rest of the rules editor) never appears on the Teams & Format page", () => {
  const inst = render();
  const text = JSON.stringify(inst.toJSON());
  assert.doesNotMatch(text, /Retirement run cap/);
  assert.doesNotMatch(text, /Balls per over/);
  assert.doesNotMatch(text, /Impact Player substitution/);
});

test("SetupScreen: Back on a later page goes back one page instead of cancelling", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","2"," of ","4"/);

  const backBtn = btn(inst, "Back");
  act(() => { backBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /"Step ","1"," of ","4"/);
});

test("SetupScreen: walking every page to Start Match calls onStart with the assembled match", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });

  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const addVenueBtn = inst.root.findAllByType("button").find(b => b.props.children === "Add a venue");
  act(() => { addVenueBtn.props.onClick(); });
  const venueModal = inst.root.findByType(VenueEditModal);
  act(() => { venueModal.props.onSave("Willow Park", 12.34, 56.78); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Oakwood CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bowl").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers (no squads, "xi" skipped)
  assert.match(JSON.stringify(inst.toJSON()), /Opening Line-up/);

  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A. Sharma" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B. Kumar" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C. Patel" } }); });
  act(() => { btn(inst, "Review").props.onClick(); }); // openers -> review
  assert.match(JSON.stringify(inst.toJSON()), /Review/);

  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.ok(started);
  assert.equal(started.teamA, "Riverside CC");
  assert.equal(started.teamB, "Oakwood CC");
  assert.equal(started.venue, "Willow Park");
  assert.equal(started.venueLat, 12.34);
  assert.equal(started.venueLng, 56.78);
  // Oakwood CC won the toss and chose to bowl -> Riverside CC bats first.
  assert.equal(started.battingFirstTeam, "Riverside CC");
  assert.equal(started.strikerA, "A. Sharma");
  assert.equal(started.nonStrikerA, "B. Kumar");
  assert.equal(started.bowlerB, "C. Patel");
  assert.deepEqual(started.toss, { wonBy: "Oakwood CC", decision: "Bowl" });
});

test("SetupScreen: Visibility defaults to public, and the review-page toggle flips onStart's private flag", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });

  const visibilityBtn = inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Make private");
  assert.ok(visibilityBtn, "expected a public-by-default Visibility toggle on the review page");
  act(() => { btn(inst, "Start Match").props.onClick(); });
  assert.equal(started.private, false);

  started = null;
  act(() => { visibilityBtn.props.onClick(); });
  act(() => { btn(inst, "Start Match").props.onClick(); });
  assert.equal(started.private, true);
});

test("SetupScreen: a private tournament's fixture defaults Visibility to private too", () => {
  let started = null;
  const inst = render({
    onStart: m => { started = m; },
    presetTournament: { id: "t1", name: "Winter Cup", private: true, fixtureTeamA: "Riverside CC", fixtureTeamB: "Oakwood CC" }
  });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  assert.ok(inst.root.findAllByType("button").find(b => b.props["aria-label"] === "Make public"), "expected the toggle to already read Private");
  act(() => { btn(inst, "Start Match").props.onClick(); });
  assert.equal(started.private, true);
});

test("SetupScreen: umpires are optional and pass through to onStart", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });
  act(() => { input(inst, "Umpire 1").props.onChange({ target: { value: "J. Rao" } }); });
  act(() => { input(inst, "Umpire 2").props.onChange({ target: { value: "" } }); });
  assert.match(JSON.stringify(inst.toJSON()), /Umpire 1/);
  // Not filling teams/toss keeps Next disabled -- just confirms the field itself renders and holds
  // its value without needing the full flow.
  assert.equal(input(inst, "Umpire 1").props.value, "J. Rao");
});

test("SetupScreen: 'Customize' reveals the rules editor, and a rule change is reflected on Review", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules

  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });
  // "Balls per over" options include "8" as a plain label -- pick the RuleChoice option button.
  const ballsPerOverBtn = inst.root.findAllByType("button").find(b => b.props.children === "8");
  act(() => { ballsPerOverBtn.props.onClick(); });

  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.equal(started.rules.ballsPerOver, 8);
});

// The rules editor used to be one flat, undifferentiated list of 16+ fields, all styled
// identically -- no visual signal for where one topic ended and the next began. Grouped into
// labeled sections now (mirroring the same grouping already shipped for the tournament rules
// editor), in a fixed order, so a scorer can jump straight to the topic they came in for.
test("SetupScreen: the rules editor is grouped into labeled sections, in order", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  const text = JSON.stringify(inst.toJSON());
  const sections = ["Format", "Extras", "Special rules", "Bowling limits", "Batting rules"];
  const positions = sections.map(s => text.indexOf(`"${s}"`));
  positions.forEach((pos, i) => assert.ok(pos !== -1, `section "${sections[i]}" is rendered`));
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i] > positions[i - 1], `"${sections[i]}" appears after "${sections[i - 1]}"`);
  }
});

// Regression: the collapsed "MATCH RULES" card (Step 2, shown before "Customize" is tapped) used
// to say "Wd/Nb counts as ball" with no mention of the final-over house rule flipping that back
// off -- exactly what a tournament like the one in this test configures. A scorer glancing at this
// card before the final over had no way to know it was coming.
test("SetupScreen: the collapsed rules summary names the last-over wide/no-ball exception when the tournament sets one", () => {
  const inst = render({
    presetTournament: {
      name: "Summer Cup",
      defaultRules: {
        wideNoballCountsAsBall: true,
        lastOverRules: { enabled: true, overCount: 1, wideNoballIllegalAgain: true }
      }
    }
  });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules

  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Wd\/Nb counts as ball \(except last over\)/);
});

// Regression: Review used to reuse the collapsed rules card's own terse, abbreviated summary
// (e.g. "Wd/Nb counts as ball", ambiguous about whether that also applies in the final over) --
// the same text meant for a quick glance while still editing rules, not the last screen before a
// scorer locks the match in. Review now shows two things instead: coreFormatText (balls/over and
// the bowler cap, unconditional -- worth confirming even at their computed defaults) and a
// "House rules:" line built from nonStandardRulesText (the same wording already used on the match
// result screen/PDF/scorecard and the tournament create Review page) for actual deviations from
// standard Laws, silent when there aren't any.
test("SetupScreen: Review always shows the core over/bowler-cap facts, and a 'House rules' line only once something's actually non-standard", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers, left standard
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  const standardText = JSON.stringify(inst.toJSON());
  assert.match(standardText, /6-ball overs.*max 4 overs per bowler/); // 20 overs ÷ 5, the computed default
  assert.doesNotMatch(standardText, /House rules/);

  act(() => { btn(inst, "Back").props.onClick(); }); // review -> openers
  act(() => { btn(inst, "Back").props.onClick(); }); // openers -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });
  const wideNbBlock = ruleBlock(inst, "Wide/no-ball counts as a ball");
  act(() => { wideNbBlock.findAllByType("button").find(b => b.props.children === "Off").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { btn(inst, "Review").props.onClick(); });
  const reviewText = JSON.stringify(inst.toJSON());
  assert.match(reviewText, /House rules:.*wide\/no-ball counts as a ball/);
  assert.doesNotMatch(reviewText, /Wd\/Nb/);
});

// Review's toss/format/squad lines used to be the only ones with no label at all, inconsistent
// with "House rules:" and umpiresText's own "Umpire(s):" prefix right next to them -- five-ish
// unlabeled lines stacked together read as more to scan than they needed to. Toss/Format/Squad
// now carry the same short-label treatment.
test("SetupScreen: Review labels the toss and format lines for consistency with House rules/Umpires", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Toss: ".*Riverside CC won the toss, chose to bat/);
  assert.match(text, /Format: ".*6-ball overs/);
});

test("SetupScreen: Last over rules -- enabling it reveals the overs-count picker, and (with wide/no-ball on) the illegal-again toggle", () => {
  const inst = render();
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  const customizeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Customize");
  act(() => { customizeBtn.props.onClick(); });

  // Off by default -- neither the overs picker nor the wide/no-ball sub-toggle should show.
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Applies to the last/);
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /illegal again/);

  const lastOverBlock = ruleBlock(inst, "Last over rules");
  act(() => { lastOverBlock.findAllByType("button").find(b => b.props.children === "Off").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /Applies to the last/);
  // Wide/no-ball counts as a ball is still off, so its own sub-toggle stays hidden.
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /illegal again/);

  const wideNbBlock = ruleBlock(inst, "Wide/no-ball counts as a ball");
  act(() => { wideNbBlock.findAllByType("button").find(b => b.props.children === "Off").props.onClick(); });
  const illegalAgainBlock = ruleBlock(inst, "Wide/no-ball illegal again in the last over(s)");
  act(() => { illegalAgainBlock.findAllByType("button").find(b => b.props.children === "Off").props.onClick(); });

  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /wide\/no-ball counts as a ball \(except the last over\)/);
});

test("SetupScreen: presetTournament shows a 'Playing in' banner and locks the team names to the fixture", () => {
  const inst = render({
    presetTournament: { id: "t1", name: "Summer Cup", fixtureTeamA: "Riverside CC", fixtureTeamB: "Oakwood CC" }
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Playing in:/);
  assert.match(text, /Summer Cup/);
  assert.match(text, /Riverside CC/);
  assert.match(text, /Oakwood CC/);
  // Fixture teams are shown as static text, not pickable -- no TeamChips/TextField for either side.
  assert.equal(input(inst, "e.g. Willow CC"), undefined);
});

test("SetupScreen: presetTournament.defaultOvers pre-fills the Overs per innings field", () => {
  const inst = render({
    presetTournament: { id: "t1", name: "Billund Cup", fixtureTeamA: "Riverside CC", fixtureTeamB: "Oakwood CC", defaultOvers: 8 }
  });
  // The overs TextField's own placeholder is "20" -- its value is the pre-filled string, not the
  // placeholder, so this finds it by the field immediately after the "Overs per innings" label
  // rather than by placeholder (which stays "20" regardless of the actual value).
  const oversField = inst.root.findAllByType("input").find(i => i.props.placeholder === "20");
  assert.equal(oversField.props.value, "8");
});

test("SetupScreen: with no presetTournament (or no defaultOvers), Overs per innings still defaults to 20", () => {
  const inst = render();
  const oversField = inst.root.findAllByType("input").find(i => i.props.placeholder === "20");
  assert.equal(oversField.props.value, "20");
});

test("SetupScreen: with saved squads, teamABench/teamBBench (squad minus Playing XI) flow through to onStart", () => {
  let started = null;
  const teamARecord = { id: "t1", name: "Riverside CC", players: ["A. Sharma", "B. Kumar", "C. Patel"] };
  const teamBRecord = { id: "t2", name: "Oakwood CC", players: ["D. Singh", "E. Rao"] };
  const inst = render({
    onStart: m => { started = m; },
    teams: [teamARecord, teamBRecord],
    rules: { playersPerSide: 2 }
  });

  const [teamAChips, teamBChips] = inst.root.findAllByType(TeamChips);
  act(() => { teamAChips.props.onSelect(teamARecord); });
  act(() => { teamBChips.props.onSelect(teamBRecord); });

  // TeamChips' own chip buttons for saved teams also show "Riverside CC" as their label, so this
  // scopes the search to the "Won the toss" Field specifically rather than matching the wrong
  // (team-selection) button by text.
  const tossField = inst.root.findAllByType(Field).find(f => f.props.label === "Won the toss");
  const tossBtn = tossField.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });

  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  assert.equal(btn(inst, "Next").props.disabled, false); // rules page is always valid
  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> xi
  act(() => { btn(inst, "Next").props.onClick(); }); // xi -> openers

  const [strikerPicker, nonStrikerPicker, bowlerPicker] = inst.root.findAllByType(PlayerPicker);
  act(() => { strikerPicker.props.onChange("A. Sharma"); });
  act(() => { nonStrikerPicker.props.onChange("B. Kumar"); });
  act(() => { bowlerPicker.props.onChange("D. Singh"); });
  act(() => { btn(inst, "Review").props.onClick(); });
  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.ok(started);
  assert.deepEqual(started.teamARoster, ["A. Sharma", "B. Kumar"]);
  assert.deepEqual(started.teamABench, ["C. Patel"]);
  assert.deepEqual(started.teamBRoster, ["D. Singh", "E. Rao"]);
  assert.deepEqual(started.teamBBench, []); // squad exactly fills the XI, nothing left on the bench
});

test("SetupScreen: 'Substitutions allowed per team' only appears once Impact Player is turned on, and flows through to onStart", () => {
  let started = null;
  const inst = render({ onStart: m => { started = m; } });
  act(() => { input(inst, "e.g. Willow CC").props.onChange({ target: { value: "Riverside CC" } }); });
  act(() => { input(inst, "e.g. Riverside XI").props.onChange({ target: { value: "Oakwood CC" } }); });
  const tossBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Riverside CC"));
  act(() => { tossBtn.props.onClick(); });
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Bat").props.onClick(); });
  act(() => { btn(inst, "Next").props.onClick(); }); // teams -> rules
  act(() => { inst.root.findAllByType("button").find(b => b.props.children === "Customize").props.onClick(); });

  assert.equal(inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Substitutions allowed per team"), undefined);

  act(() => { ruleBlock(inst, "Impact Player substitution").findByType("button").props.onClick(); });
  const maxSubsChoice = inst.root.findAllByType(RuleChoice).find(r => r.props.label === "Substitutions allowed per team");
  assert.ok(maxSubsChoice);
  assert.deepEqual(maxSubsChoice.props.options.map(o => o.value), [1, 2]);
  act(() => { maxSubsChoice.props.onChange(2); });

  act(() => { btn(inst, "Next").props.onClick(); }); // rules -> openers
  act(() => { input(inst, "Batsman name").props.onChange({ target: { value: "A" } }); });
  act(() => {
    inst.root.findAllByType("input").filter(i => i.props.placeholder === "Batsman name")[1]
      .props.onChange({ target: { value: "B" } });
  });
  act(() => { input(inst, "Bowler name").props.onChange({ target: { value: "C" } }); });
  act(() => { btn(inst, "Review").props.onClick(); });
  act(() => { btn(inst, "Start Match").props.onClick(); });

  assert.equal(started.rules.impactPlayerEnabled, true);
  assert.equal(started.rules.impactPlayerMaxSubs, 2);
});
