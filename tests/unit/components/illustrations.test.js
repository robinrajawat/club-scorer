// Small decorative/status React components (src/components/illustrations.js), rendered with
// react-test-renderer -- the actual React version public/index.html loads (18.3.1), pinned in
// package.json to match.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { AppMark, LoadingBallIllustration, LoadingNote, EmptyStateBallIllustration, EmptyState, CoinFlipIllustration, CoinIcon } from "../../../src/components/illustrations.js";

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

function arcDiv(root) {
  // Carries the vertical arc (translateY), separate from the spin -- see CoinFlipIllustration's
  // own comment for why arc and spin run on separate transforms/elements.
  return root.find(n => n.props && n.props.style && typeof n.props.style.transform === "string" && n.props.style.transform.includes("translateY"));
}

function spinDiv(root) {
  // Carries the spin (scaleX squash), nested inside arcDiv.
  return root.find(n => n.props && n.props.style && typeof n.props.style.transform === "string" && n.props.style.transform.includes("scaleX"));
}

function coinGlyph(root) {
  return root.find(n => n.type === "span" && n.props.style && n.props.style.fontFamily === "'DM Serif Display', serif");
}

// The coin used to be a single 3D-rotated (rotateY) disc with both faces glued back-to-back,
// hidden/shown via backface-visibility. Dropped in favor of a 2D horizontal squash (scaleX)
// with only one face ever in the DOM, after backface-visibility + perspective + preserve-3d
// turned out unreliable on real iOS Safari/WKWebView even with -webkit- prefixes added -- both
// faces could render at once there, overlapping into a garbled letter. A 2D squash can't produce
// that failure mode on any engine, because there's structurally only ever one face rendered.
// The arc (translateY, "phase") and the spin (scaleX, "squashed") run on separate elements so the
// spin can pulse several times, fast, independently of the single slow arc motion.
test("CoinFlipIllustration: phase='rest' is static -- no lift, no transition on the arc", () => {
  const root = renderer.create(React.createElement(CoinFlipIllustration, { face: "Tails", phase: "rest" })).root;
  const arc = arcDiv(root);
  assert.equal(arc.props.style.transform, "translateY(0px)");
  assert.equal(arc.props.style.transition, "none");
});

test("CoinFlipIllustration: phase='up' lifts the coin on a short transition", () => {
  const root = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "up", size: 56 })).root;
  const arc = arcDiv(root);
  assert.equal(arc.props.style.transform, "translateY(-78px)");
  assert.match(arc.props.style.transition, /transform 0\.35s/);
});

test("CoinFlipIllustration: phase='down' brings the coin back to translateY(0) on a longer transition", () => {
  const root = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "down" })).root;
  const arc = arcDiv(root);
  assert.equal(arc.props.style.transform, "translateY(0px)");
  assert.match(arc.props.style.transition, /transform 0\.55s/);
});

test("CoinFlipIllustration: squashed=true flattens the coin (scaleX 0), squashed=false shows it full-width (scaleX 1)", () => {
  const squashedRoot = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "up", squashed: true })).root;
  assert.equal(spinDiv(squashedRoot).props.style.transform, "scaleX(0)");

  const unsquashedRoot = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "up", squashed: false })).root;
  assert.equal(spinDiv(unsquashedRoot).props.style.transform, "scaleX(1)");
});

test("CoinFlipIllustration: the spin transitions fast regardless of arc phase, but not at all when phase='rest'", () => {
  const upRoot = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "up", squashed: true })).root;
  assert.match(spinDiv(upRoot).props.style.transition, /transform 0\.1s/);

  const restRoot = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "rest", squashed: false })).root;
  assert.equal(spinDiv(restRoot).props.style.transition, "none");
});

test("CoinFlipIllustration: shows exactly one glyph at a time, matching the face prop, sized proportionally to the coin", () => {
  const headsRoot = renderer.create(React.createElement(CoinFlipIllustration, { face: "Heads", phase: "rest", size: 100 })).root;
  const headsGlyphs = headsRoot.findAll(n => n.type === "span" && n.props.style && n.props.style.fontFamily === "'DM Serif Display', serif");
  assert.deepEqual(headsGlyphs.map(g => g.children[0]), ["H"]);
  assert.equal(headsGlyphs[0].props.style.fontSize, 42, "42 = round(100 * 0.42)");

  const tailsRoot = renderer.create(React.createElement(CoinFlipIllustration, { face: "Tails", phase: "rest" })).root;
  assert.deepEqual(coinGlyph(tailsRoot).children, ["T"]);
});

test("CoinFlipIllustration: an empty face renders no glyph (pre-flip/never-flipped state)", () => {
  const root = renderer.create(React.createElement(CoinFlipIllustration, { face: "", phase: "rest" })).root;
  const glyphs = root.findAll(n => n.type === "span" && n.props.style && n.props.style.fontFamily === "'DM Serif Display', serif");
  assert.equal(glyphs.length, 1, "the glyph span itself still renders, just empty");
  assert.deepEqual(glyphs[0].children, []);
});

test("CoinIcon: a small round gradient swatch, sized to the given prop", () => {
  const tree = renderer.create(React.createElement(CoinIcon, { size: 20 })).toJSON();
  assert.equal(tree.type, "span");
  assert.equal(tree.props.style.width, 20);
  assert.equal(tree.props.style.height, 20);
  assert.equal(tree.props.style.borderRadius, "50%");
});
