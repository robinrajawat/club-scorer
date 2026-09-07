// Small presentational components used across setup/list screens (src/components/screenAtoms.js).

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { Field, InstallHintBanner, NavWrap } from "../../../src/components/screenAtoms.js";

test("Field: renders the label above its children", () => {
  const tree = renderer.create(React.createElement(Field, { label: "Team name" }, "content")).toJSON();
  assert.equal(tree.children[0].children[0], "Team name");
  assert.equal(tree.children[1], "content");
});

test("InstallHintBanner: calls onDismiss when the close button is clicked", () => {
  let dismissed = false;
  const root = renderer.create(React.createElement(InstallHintBanner, { onDismiss: () => { dismissed = true; } })).root;
  root.findByProps({ "aria-label": "Dismiss" }).props.onClick();
  assert.equal(dismissed, true);
});

test("NavWrap: renders its children, keyed by navKey, using the 'back' animation only when direction is 'back'", () => {
  const forward = renderer.create(React.createElement(NavWrap, { navKey: "a", direction: "forward" }, "content")).toJSON();
  assert.equal(forward.children[0], "content");
  assert.match(forward.props.style.animation, /cs-navInRight/);

  const back = renderer.create(React.createElement(NavWrap, { navKey: "b", direction: "back" }, "content")).toJSON();
  assert.match(back.props.style.animation, /cs-navInLeft/);
});
