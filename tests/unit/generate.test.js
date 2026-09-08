// scripts/generate.js's marker-splice mechanism. `splice` is what places a src/core/*.js function
// or module back into its `// GENERATED-FN-START/END` (or `GENERATED-START/END`) marker pair in
// public/index.html -- these tests exercise it directly against small in-memory strings, not the
// real (huge) public/index.html, so they run fast and don't depend on the current app's content.

import test from "node:test";
import assert from "node:assert/strict";
import { splice } from "../../scripts/generate.js";

test("splice: replaces the content between a marker pair with the given replacement", () => {
  const html = [
    "before",
    "// GENERATED-FN-START: Foo",
    "old foo body",
    "// GENERATED-FN-END: Foo",
    "after"
  ].join("\n");
  const result = splice(html, "// GENERATED-FN-START: Foo", "// GENERATED-FN-END: Foo", "new foo body\n", "Foo");
  assert.equal(result, [
    "before",
    "// GENERATED-FN-START: Foo",
    "new foo body",
    "// GENERATED-FN-END: Foo",
    "after"
  ].join("\n"));
});

// Regression test for a real production bug: EmptyState's own splice used to land inside
// EmptyStateBallIllustration's marker pair instead (a live ReferenceError crash on clubscorer.com,
// "unable to get to home") because splice() searched for a marker with a bare, un-anchored
// `indexOf` -- since "EmptyState" is a literal prefix of "EmptyStateBallIllustration", and that
// longer name's marker sorts first in the file, the shorter name's marker search matched inside
// the longer name's marker line instead of finding its own, real one further down.
test("splice: a marker name that is a strict prefix of another, earlier marker's name still finds its OWN marker, not the earlier one's", () => {
  const html = [
    "// GENERATED-FN-START: EmptyStateBallIllustration",
    "function EmptyStateBallIllustration() { return null; }",
    "// GENERATED-FN-END: EmptyStateBallIllustration",
    "// GENERATED-FN-START: EmptyState",
    "// GENERATED-FN-END: EmptyState",
    "// more content follows, same as every real marker in public/index.html"
  ].join("\n");
  const result = splice(
    html,
    "// GENERATED-FN-START: EmptyState",
    "// GENERATED-FN-END: EmptyState",
    "function EmptyState() { return null; }\n",
    "EmptyState"
  );
  // The longer name's own function body must be untouched...
  assert.match(result, /function EmptyStateBallIllustration\(\) \{ return null; \}/);
  // ...and the shorter name's replacement must land in ITS OWN (previously empty) marker pair,
  // not overwrite the longer name's.
  const emptyStateSection = result.slice(result.indexOf("// GENERATED-FN-START: EmptyState\n"));
  assert.match(emptyStateSection, /function EmptyState\(\) \{ return null; \}/);
});

test("splice: throws a clear error when the marker pair genuinely doesn't exist", () => {
  const html = "no markers here at all";
  assert.throws(
    () => splice(html, "// GENERATED-FN-START: Missing", "// GENERATED-FN-END: Missing", "x\n", "generated-fn \"Missing\""),
    /Could not find generated-fn "Missing" markers/
  );
});
