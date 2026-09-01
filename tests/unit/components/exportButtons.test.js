// Print-to-PDF buttons (src/components/exportButtons.js). Only the button's own rendering and
// state (not window.print()'s actual browser-print behavior, which handleExport only calls from
// inside its onClick handler) is exercised here -- see the module's own header comment.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { ExportPdfButton, ExportTournamentPdfButton } from "../../../src/components/exportButtons.js";

test("ExportPdfButton: renders a Printer icon button, not disabled by default", () => {
  const tree = renderer.create(React.createElement(ExportPdfButton, { match: { teamA: "A", teamB: "B" } })).toJSON();
  assert.equal(tree.type, "button");
  assert.equal(tree.props.disabled, false);
  assert.equal(tree.props["aria-label"], "Export PDF");
});

test("ExportTournamentPdfButton: shows 'Export PDF' by default, not disabled", () => {
  const tree = renderer.create(React.createElement(ExportTournamentPdfButton, { tournament: { name: "Summer Cup" } })).toJSON();
  assert.equal(tree.type, "button");
  assert.equal(tree.props.disabled, false);
  assert.ok(tree.children.includes("Export PDF"));
});
