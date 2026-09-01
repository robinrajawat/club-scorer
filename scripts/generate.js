#!/usr/bin/env node
// Splices the tested src/core/*.js modules into index.html, replacing the content between each
// pair of `// GENERATED-START: <name>` / `// GENERATED-END: <name>` marker comments.
//
// index.html is production — there is no separate build output — so this script edits it in
// place. The modules in src/core/ are the source of truth for the logic they cover; index.html's
// copy is regenerated from them, never hand-edited within a marker span.
//
// Usage:
//   node scripts/generate.js            # regenerate index.html in place
//   node scripts/generate.js --verify   # exit 1 if index.html would change (CI/pre-push check)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_HTML = path.join(ROOT, "index.html");

const MODULES = [
  { name: "pack-utils", file: "src/core/packUtils.js" },
  { name: "scoring-engine", file: "src/core/scoringEngine.js" },
  { name: "app-logic", file: "src/core/appLogic.js" }
];

// Strips the ES module syntax needed for the file to be importable/testable under Node, so what's
// left is plain global-scope script — exactly what index.html's inline (non-module) <script> can
// run. Local imports (`import { X } from "./other.js"`) are dropped entirely: by the time a
// spliced block runs in index.html, everything from every other module is already declared in the
// same global scope, at whatever earlier point in the file that module was spliced in.
function toGlobalScript(source) {
  return source
    .replace(/^import .*\n/gm, "")
    .replace(/^export (function|const|class)/gm, "$1")
    .replace(/^\n+/, "");
}

function spliceModule(html, name, moduleSource) {
  const startMarker = `// GENERATED-START: ${name}`;
  const endMarker = `// GENERATED-END: ${name}`;
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Could not find generated-block markers for "${name}" in index.html — expected ` +
      `"${startMarker}" ... "${endMarker}". If the module was renamed or the markers were moved, ` +
      `update MODULES in scripts/generate.js to match.`
    );
  }
  const sliceStart = html.indexOf("\n", startIdx) + 1;
  const sliceEnd = endIdx;
  return html.slice(0, sliceStart) + moduleSource + html.slice(sliceEnd);
}

function run() {
  const verify = process.argv.includes("--verify");
  const original = fs.readFileSync(INDEX_HTML, "utf8");
  let html = original;

  for (const mod of MODULES) {
    const src = fs.readFileSync(path.join(ROOT, mod.file), "utf8");
    html = spliceModule(html, mod.name, toGlobalScript(src));
  }

  if (verify) {
    if (original !== html) {
      console.error(
        "index.html is out of sync with src/core/*.js — run `npm run generate` and commit the result."
      );
      process.exit(1);
    }
    console.log("index.html matches src/core/*.js — up to date.");
    return;
  }

  fs.writeFileSync(INDEX_HTML, html);
  console.log("Regenerated index.html from src/core/*.js.");
}

run();
