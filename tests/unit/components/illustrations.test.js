// Small decorative/status React components (src/components/illustrations.js), rendered with
// react-test-renderer -- the actual React version public/index.html loads (18.3.1), pinned in
// package.json to match.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { AppMark, LoadingBallIllustration, LoadingNote, EmptyStateBallIllustration, EmptyState } from "../../../src/components/illustrations.js";

test("AppMark: renders the app icon image sized to the given size prop", () => {
  const tree = renderer.create(React.createElement(AppMark, { size: 32 })).toJSON();
  assert.equal(tree.type, "div");
  assert.equal(tree.props.style.width, 32);
  const img = tree.children[0];
  assert.equal(img.type, "img");
  assert.equal(img.props.src, "./icons/icon-512.png");
});

test("LoadingBallIllustration: renders an svg sized to the given size, defaults to 44", () => {
  const defaultTree = renderer.create(React.createElement(LoadingBallIllustration, {})).toJSON();
  assert.equal(defaultTree.type, "svg");
  assert.equal(defaultTree.props.width, 44);

  const sizedTree = renderer.create(React.createElement(LoadingBallIllustration, { size: 20 })).toJSON();
  assert.equal(sizedTree.props.width, 20);
});

test("LoadingNote: shows the given label next to a spinner, defaults to 'Loading…'", () => {
  const tree = renderer.create(React.createElement(LoadingNote, {})).toJSON();
  assert.ok(tree.children.includes("Loading…"));
  const root = renderer.create(React.createElement(LoadingNote, {})).root;
  assert.equal(root.findAllByType(LoadingBallIllustration).length, 1);

  const customTree = renderer.create(React.createElement(LoadingNote, { label: "Saving…" })).toJSON();
  assert.ok(customTree.children.includes("Saving…"));
});

test("EmptyStateBallIllustration: renders a self-contained svg with no props needed", () => {
  const tree = renderer.create(React.createElement(EmptyStateBallIllustration, {})).toJSON();
  assert.equal(tree.type, "svg");
  assert.equal(tree.props.width, "52");
});

test("EmptyState: is flex:1 by default (fills whatever space a flex-column parent leaves it), shows the illustration and message, and dashed-card styling unless card is false", () => {
  const card = renderer.create(React.createElement(EmptyState, {}, "Nothing here yet.")).toJSON();
  assert.equal(card.props.style.flex, 1);
  assert.ok(card.props.style.border, "card styling is on by default");
  assert.ok(card.children.some(c => c === "Nothing here yet." || (c && c.children && c.children.includes("Nothing here yet."))));
  const root = renderer.create(React.createElement(EmptyState, {}, "Nothing here yet.")).root;
  assert.equal(root.findAllByType(EmptyStateBallIllustration).length, 1);

  const plain = renderer.create(React.createElement(EmptyState, { card: false }, "Nothing live right now.")).toJSON();
  assert.equal(plain.props.style.border, undefined);
});

test("EmptyState: an explicit minHeight is passed through, for a screen whose root isn't a flex column", () => {
  const tree = renderer.create(React.createElement(EmptyState, { minHeight: "50vh" }, "No matches yet.")).toJSON();
  assert.equal(tree.props.style.minHeight, "50vh");
});
