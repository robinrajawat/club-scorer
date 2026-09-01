#!/usr/bin/env node
// Splices the tested src/core/*.js modules into docs/index.html.
//
// Two marker shapes, both replaced from src/core/ on every run:
//  - `// GENERATED-START: <name>` / `// GENERATED-END: <name>` — a whole module (MODULES below)
//    spliced in as one contiguous block.
//  - `// GENERATED-FN-START: <name>` / `// GENERATED-FN-END: <name>` — a single function, wrapped
//    in place around its existing declaration (FUNCTIONS below). Used for logic that's pure and
//    worth testing but lives scattered among docs/index.html's React components rather than in one
//    contiguous span — this splices just that one function back in without relocating anything
//    else in the file.
//
// docs/index.html is production (served by GitHub Pages from the docs/ folder) — there is no
// separate build output — so this script edits it in place. The modules in src/core/ are the
// source of truth for the logic they cover; docs/index.html's copy is regenerated from them,
// never hand-edited within a marker span.
//
// Usage:
//   node scripts/generate.js            # regenerate docs/index.html in place
//   node scripts/generate.js --verify   # exit 1 if docs/index.html would change (CI/pre-push check)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_HTML = path.join(ROOT, "docs", "index.html");

const MODULES = [
  { name: "pack-utils", file: "src/core/packUtils.js" },
  { name: "scoring-engine", file: "src/core/scoringEngine.js" },
  { name: "app-logic", file: "src/core/appLogic.js" }
];

// Each of these names must be an `export function <name>` or `export const <name> =` at column 0
// in the given file. Add a name here after wrapping its existing docs/index.html declaration in
// `// GENERATED-FN-START: <name>` / `// GENERATED-FN-END: <name>` and moving its body into the
// src/core/ file (see src/core/statsAndFixtures.js for the pattern).
const FUNCTIONS = [
  { name: "uid", file: "src/core/statsAndFixtures.js" },
  { name: "generateRoundRobinFixtures", file: "src/core/statsAndFixtures.js" },
  { name: "generateGroupRoundRobinFixtures", file: "src/core/statsAndFixtures.js" },
  { name: "computePlayerStats", file: "src/core/statsAndFixtures.js" },
  { name: "computeClubRecords", file: "src/core/statsAndFixtures.js" },
  { name: "suggestPlayerOfMatch", file: "src/core/statsAndFixtures.js" },
  { name: "suggestBestFielder", file: "src/core/statsAndFixtures.js" },
  { name: "suggestPlayerOfTournament", file: "src/core/statsAndFixtures.js" },
  { name: "allMatchPlayers", file: "src/core/statsAndFixtures.js" },
  { name: "ISO_DATETIME_RE", file: "src/core/shareAndFormat.js" },
  { name: "FIXTURE_DEFAULT_HOUR", file: "src/core/shareAndFormat.js" },
  { name: "pad2", file: "src/core/shareAndFormat.js" },
  { name: "parseFixtureDateTime", file: "src/core/shareAndFormat.js" },
  { name: "buildFixtureIso", file: "src/core/shareAndFormat.js" },
  { name: "formatFixtureDateTime", file: "src/core/shareAndFormat.js" },
  { name: "icsEscape", file: "src/core/shareAndFormat.js" },
  { name: "icsLocalDateTime", file: "src/core/shareAndFormat.js" },
  { name: "fixtureIcsEvent", file: "src/core/shareAndFormat.js" },
  { name: "buildTournamentICS", file: "src/core/shareAndFormat.js" },
  { name: "buildFixtureICS", file: "src/core/shareAndFormat.js" },
  { name: "csvCell", file: "src/core/shareAndFormat.js" },
  { name: "toCSV", file: "src/core/shareAndFormat.js" },
  { name: "multiSectionCSV", file: "src/core/shareAndFormat.js" },
  { name: "safeFilenamePart", file: "src/core/shareAndFormat.js" },
  { name: "POLL_TTL_DAYS", file: "src/core/shareAndFormat.js" },
  { name: "nonStandardRulesText", file: "src/core/shareAndFormat.js" },
  { name: "tossText", file: "src/core/shareAndFormat.js" },
  { name: "umpiresText", file: "src/core/shareAndFormat.js" },
  { name: "matchResultText", file: "src/core/shareAndFormat.js" },
  { name: "matchScoreLine", file: "src/core/shareAndFormat.js" },
  { name: "chasingInfo", file: "src/core/shareAndFormat.js" },
  { name: "buildShareText", file: "src/core/shareAndFormat.js" },
  { name: "buildFixtureShareText", file: "src/core/shareAndFormat.js" },
  { name: "pollExpiryDateLabel", file: "src/core/shareAndFormat.js" },
  { name: "buildMapsUrl", file: "src/core/shareAndFormat.js" },
  { name: "resolvePollTeams", file: "src/core/shareAndFormat.js" },
  { name: "buildPollUrl", file: "src/core/shareAndFormat.js" },
  { name: "buildPollShareText", file: "src/core/shareAndFormat.js" },
  { name: "buildFollowUrl", file: "src/core/shareAndFormat.js" },
  { name: "buildLiveShareText", file: "src/core/shareAndFormat.js" },
  { name: "unpackMatchFromFirestore", file: "src/core/packUtils.js" },
  { name: "FEEDBACK_ADMIN_EMAIL", file: "src/core/miscHelpers.js" },
  { name: "isFeedbackAdmin", file: "src/core/miscHelpers.js" },
  { name: "genMatchCode", file: "src/core/miscHelpers.js" },
  { name: "expiresAtMillis", file: "src/core/miscHelpers.js" },
  { name: "inviteExpiryLabel", file: "src/core/miscHelpers.js" },
  { name: "formatAddressLabel", file: "src/core/miscHelpers.js" },
  { name: "WMO_WEATHER_CODES", file: "src/core/miscHelpers.js" },
  { name: "weatherCodeInfo", file: "src/core/miscHelpers.js" },
  { name: "parseCsvLine", file: "src/core/miscHelpers.js" },
  { name: "parseBulkPlayers", file: "src/core/miscHelpers.js" },
  { name: "normalizeEmail", file: "src/core/miscHelpers.js" },
  { name: "isClubOwner", file: "src/core/miscHelpers.js" },
  { name: "isFederationOwner", file: "src/core/miscHelpers.js" },
  { name: "SHORT_WEEKDAYS", file: "src/core/miscHelpers.js" },
  { name: "SHORT_MONTHS", file: "src/core/miscHelpers.js" },
  { name: "relativeDayLabel", file: "src/core/miscHelpers.js" },
  { name: "greetingPrefix", file: "src/core/miscHelpers.js" },
  { name: "tournamentStatus", file: "src/core/miscHelpers.js" },
  { name: "tournamentDateRangeLabel", file: "src/core/miscHelpers.js" },
  { name: "TEAM_COLOR_PRESETS", file: "src/core/miscHelpers.js" },
  { name: "playerInitials", file: "src/core/miscHelpers.js" },
  { name: "playerAvatarColor", file: "src/core/miscHelpers.js" },
  { name: "parseOverLabel", file: "src/core/miscHelpers.js" },
  { name: "ballLabelsForOver", file: "src/core/miscHelpers.js" }
];

// Strips the ES module syntax needed for the file to be importable/testable under Node, so what's
// left is plain global-scope script — exactly what docs/index.html's inline (non-module) <script> can
// run. Local imports (`import { X } from "./other.js"`) are dropped entirely: by the time a
// spliced block runs in docs/index.html, everything from every other module is already declared in the
// same global scope, at whatever earlier point in the file that module was spliced in.
function toGlobalScript(source) {
  return source
    .replace(/^import .*\n/gm, "")
    .replace(/^export (function|const|class)/gm, "$1")
    .replace(/^\n+/, "");
}

function splice(html, startMarker, endMarker, replacement, label) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Could not find ${label} markers in docs/index.html — expected ` +
      `"${startMarker}" ... "${endMarker}". If it was renamed or the markers were moved, update ` +
      `scripts/generate.js to match.`
    );
  }
  const sliceStart = html.indexOf("\n", startIdx) + 1;
  const sliceEnd = endIdx;
  return html.slice(0, sliceStart) + replacement + html.slice(sliceEnd);
}

function spliceModule(html, name, moduleSource) {
  return splice(
    html,
    `// GENERATED-START: ${name}`,
    `// GENERATED-END: ${name}`,
    moduleSource,
    `generated-block "${name}"`
  );
}

// Finds a single `export function <name>` or `export const <name> =` declaration at column 0 in a
// src/core/ file (declarations are assumed non-overlapping and not nested) and returns its text
// with `export ` stripped, ready to splice back into a `GENERATED-FN` marker pair.
const namedExportCache = new Map();
function findNamedExport(file, name) {
  let exports = namedExportCache.get(file);
  if (!exports) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    exports = new Map();
    const re = /^export (?:function (\w+)|const (\w+) =)/gm;
    const matches = [...source.matchAll(re)];
    matches.forEach((m, i) => {
      const declName = m[1] || m[2];
      const start = m.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
      exports.set(declName, source.slice(start, end).replace(/^export /, "").replace(/\s+$/, "\n"));
    });
    namedExportCache.set(file, exports);
  }
  const text = exports.get(name);
  if (text === undefined) {
    throw new Error(`No "export function ${name}" or "export const ${name}" found in ${file}.`);
  }
  return text;
}

function spliceFunction(html, name, file) {
  return splice(
    html,
    `// GENERATED-FN-START: ${name}`,
    `// GENERATED-FN-END: ${name}`,
    findNamedExport(file, name),
    `generated-fn "${name}"`
  );
}

function run() {
  const verify = process.argv.includes("--verify");
  const original = fs.readFileSync(INDEX_HTML, "utf8");
  let html = original;

  for (const mod of MODULES) {
    const src = fs.readFileSync(path.join(ROOT, mod.file), "utf8");
    html = spliceModule(html, mod.name, toGlobalScript(src));
  }

  for (const fn of FUNCTIONS) {
    html = spliceFunction(html, fn.name, fn.file);
  }

  if (verify) {
    if (original !== html) {
      console.error(
        "docs/index.html is out of sync with src/core/*.js — run `npm run generate` and commit the result."
      );
      process.exit(1);
    }
    console.log("docs/index.html matches src/core/*.js — up to date.");
    return;
  }

  fs.writeFileSync(INDEX_HTML, html);
  console.log("Regenerated docs/index.html from src/core/*.js.");
}

run();
