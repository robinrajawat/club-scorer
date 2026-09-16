// Small decorative/status React components (src/components/illustrations.js), rendered with
// react-test-renderer -- the actual React version public/index.html loads (18.3.1), pinned in
// package.json to match.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { AppMark, LoadingBallIllustration, LoadingNote, EmptyStateBallIllustration, EmptyState, CoinFlipIllustration } from "../../../src/components/illustrations.js";

test("AppMark: renders the app icon image sized to the given size prop", () => {
  const tree = renderer.create(React.createElement(AppMark, { size: 32 })).toJSON();
  assert.equal(tree.type, "img");
  assert.equal(tree.props.style.width, 32);
  assert.equal(tree.props.style.height, 32);
  assert.equal(tree.props.src, "./icons/icon-512.png");
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

test("EmptyState: a flex:1 div with no border/background, centering the ball icon and text directly (no card)", () => {
  const tree = renderer.create(React.createElement(EmptyState, {}, "Nothing here yet.")).toJSON();
  assert.equal(tree.props.style.flex, 1);
  assert.equal(tree.props.style.border, undefined, "no dashed-card border any more");
  assert.equal(tree.props.style.background, undefined, "no tinted-card background any more");

  const text = tree.children[1];
  assert.ok(text.children.includes("Nothing here yet."));

  const root = renderer.create(React.createElement(EmptyState, {}, "Nothing here yet.")).root;
  assert.equal(root.findAllByType(EmptyStateBallIllustration).length, 1);
});

test("EmptyState: an explicit minHeight is passed through, for a screen whose root isn't a flex column", () => {
  const tree = renderer.create(React.createElement(EmptyState, { minHeight: "50vh" }, "No matches yet.")).toJSON();
  assert.equal(tree.props.style.minHeight, "50vh");
});

test("CoinFlipIllustration: rotates the coin to the given angle, transitioning only while spinning, showing both an H and a T face", () => {
  const staticTree = renderer.create(React.createElement(CoinFlipIllustration, { rotationDeg: 180, spinning: false })).toJSON();
  const coinDiv = staticTree.children[0];
  assert.equal(coinDiv.props.style.transform, "rotateY(180deg)");
  assert.equal(coinDiv.props.style.transition, "none");

  const spinningTree = renderer.create(React.createElement(CoinFlipIllustration, { rotationDeg: 1620, spinning: true })).toJSON();
  const spinningCoinDiv = spinningTree.children[0];
  assert.equal(spinningCoinDiv.props.style.transform, "rotateY(1620deg)");
  assert.match(spinningCoinDiv.props.style.transition, /transform/);

  const root = renderer.create(React.createElement(CoinFlipIllustration, { rotationDeg: 0, spinning: false })).root;
  const faces = root.findAll(n => n.props && n.props.style && n.props.style.borderRadius === "50%");
  assert.deepEqual(faces.map(f => f.children[0]), ["H", "T"]);
});
