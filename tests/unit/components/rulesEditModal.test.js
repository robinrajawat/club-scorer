// Confirm-gated rules editor (src/components/rulesEditModal.js), wrapping the shared
// RulesEditorFields form. `Modal` is a bare, unimported global -- same pattern as every other
// Modal-wrapped screen in this suite (see venueAndDateModals.test.js).

import test from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { RulesEditModal } from "../../../src/components/rulesEditModal.js";
import { Btn, ConfirmModal, RuleChoice, TextField } from "../../../src/components/formUiAtoms.js";
import { DEFAULT_RULES } from "../../../src/core/appLogic.js";

beforeEach(() => {
  globalThis.Modal = ({ children }) => React.createElement("div", { "data-stub-modal": true }, children);
});

afterEach(() => {
  delete globalThis.Modal;
});

test("RulesEditModal: shows the overs field seeded from initialOversLimit, and an optional warning", () => {
  const inst = renderer.create(React.createElement(RulesEditModal, {
    initialOversLimit: 20,
    initialRules: DEFAULT_RULES,
    warningText: "Only future fixtures are affected.",
    onSave: () => {},
    onClose: () => {}
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Only future fixtures are affected\./);
  const oversField = inst.root.findAllByType(TextField)[0];
  assert.equal(oversField.props.value, "20");
});

test("RulesEditModal: saving asks for confirmation first, and cancelling does not call onSave", () => {
  let saved = null;
  const inst = renderer.create(React.createElement(RulesEditModal, {
    initialOversLimit: 20,
    initialRules: DEFAULT_RULES,
    onSave: (oversLimit, rules) => { saved = { oversLimit, rules }; },
    onClose: () => {}
  }));
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save rules");
  act(() => { saveBtn.props.onClick(); });
  const confirm = inst.root.findByType(ConfirmModal);
  assert.equal(confirm.props.title, "Save these rules?");
  act(() => { confirm.props.onCancel(); });
  assert.equal(saved, null, "cancelling the confirm step must not save anything");
  assert.throws(() => inst.root.findByType(ConfirmModal), "confirm step closes on cancel");
});

test("RulesEditModal: confirming saves the edited overs/rules and closes", async () => {
  let saved = null;
  let closed = false;
  const inst = renderer.create(React.createElement(RulesEditModal, {
    initialOversLimit: 20,
    initialRules: DEFAULT_RULES,
    onSave: (oversLimit, rules) => { saved = { oversLimit, rules }; },
    onClose: () => { closed = true; }
  }));
  // Edit the overs field and a rule field before saving.
  const oversField = inst.root.findAllByType(TextField)[0];
  act(() => { oversField.props.onChange("15"); });
  const ballsPerOverChoice = inst.root.findAllByType(RuleChoice).find(rc => rc.props.label === "Balls per over");
  act(() => { ballsPerOverChoice.props.onChange(8); });

  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save rules");
  act(() => { saveBtn.props.onClick(); });
  const confirm = inst.root.findByType(ConfirmModal);
  await act(async () => {
    confirm.props.onConfirm();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.ok(saved, "onSave should have been called");
  assert.equal(saved.oversLimit, 15);
  assert.equal(saved.rules.ballsPerOver, 8);
  assert.equal(closed, true);
});

test("RulesEditModal: a blank/invalid overs field saves null rather than NaN", async () => {
  let saved = null;
  const inst = renderer.create(React.createElement(RulesEditModal, {
    initialOversLimit: 20,
    initialRules: DEFAULT_RULES,
    onSave: (oversLimit, rules) => { saved = { oversLimit, rules }; },
    onClose: () => {}
  }));
  const oversField = inst.root.findAllByType(TextField)[0];
  act(() => { oversField.props.onChange(""); });
  const saveBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Save rules");
  act(() => { saveBtn.props.onClick(); });
  const confirm = inst.root.findByType(ConfirmModal);
  await act(async () => {
    confirm.props.onConfirm();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(saved.oversLimit, null);
});
