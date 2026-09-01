// Small decorative/status React components (src/components/illustrations.js), rendered with
// react-test-renderer -- the actual React version public/index.html loads (18.3.1), pinned in
// package.json to match.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { AppMark, LoadingBallIllustration, LoadingNote, EmptyStateBallIllustration } from "../../../src/components/illustrations.js";

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
