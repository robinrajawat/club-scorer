// iOS-style scrollable wheel picker (src/components/wheelPicker.js). Real scrollTop/scrollTo
// physics need a real DOM (see tests/unit/components/modal.test.js's own jsdom pattern) and aren't
// exercised here -- these tests cover the click-to-select path, which react-test-renderer's fake
// nodes handle fine since WheelPicker guards every DOM call with `el && el.scrollTo`.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { WheelPicker } from "../../../src/components/wheelPicker.js";

function options(values) {
  return values.map(v => ({ value: v, label: String(v) }));
}

test("WheelPicker: renders every option, marking the current value aria-selected", () => {
  const inst = renderer.create(React.createElement(WheelPicker, {
    options: options([1, 2, 3]), value: 2, onChange: () => {}, ariaLabel: "Hour"
  }));
  const buttons = inst.root.findAllByProps({ role: "option" });
  assert.equal(buttons.length, 3);
  assert.deepEqual(buttons.map(b => b.props["aria-selected"]), [false, true, false]);
  assert.equal(inst.root.findByProps({ role: "listbox" }).props["aria-label"], "Hour");
});

test("WheelPicker: clicking an option calls onChange with that option's value", () => {
  let changedTo = null;
  const inst = renderer.create(React.createElement(WheelPicker, {
    options: options(["00", "05", "10"]), value: "00", onChange: v => { changedTo = v; }, ariaLabel: "Minute"
  }));
  const buttons = inst.root.findAllByProps({ role: "option" });
  buttons[2].props.onClick();
  assert.equal(changedTo, "10");
});

test("WheelPicker: clicking the already-selected option does not call onChange again", () => {
  let calls = 0;
  const inst = renderer.create(React.createElement(WheelPicker, {
    options: options(["AM", "PM"]), value: "AM", onChange: () => { calls++; }, ariaLabel: "AM/PM"
  }));
  const buttons = inst.root.findAllByProps({ role: "option" });
  buttons[0].props.onClick();
  assert.equal(calls, 0);
});

// react-test-renderer has no real DOM, so containerRef.current is null and every scrollTo call
// inside WheelPicker's mount effect must no-op rather than throw -- this is what keeps the
// click-to-select path testable at all without a jsdom setup.
test("WheelPicker: mounts and unmounts cleanly with no real DOM (ref-guarded scroll calls don't throw)", () => {
  const inst = renderer.create(React.createElement(WheelPicker, {
    options: options([1, 2, 3]), value: 1, onChange: () => {}, ariaLabel: "Hour"
  }));
  assert.doesNotThrow(() => { inst.unmount(); });
});
