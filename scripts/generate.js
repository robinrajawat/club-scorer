#!/usr/bin/env node
// Splices the tested src/core/*.js modules into public/index.html.
//
// Two marker shapes, both replaced from src/core/ on every run:
//  - `// GENERATED-START: <name>` / `// GENERATED-END: <name>` — a whole module (MODULES below)
//    spliced in as one contiguous block.
//  - `// GENERATED-FN-START: <name>` / `// GENERATED-FN-END: <name>` — a single function, wrapped
//    in place around its existing declaration (FUNCTIONS below). Used for logic that's pure and
//    worth testing but lives scattered among public/index.html's React components rather than in one
//    contiguous span — this splices just that one function back in without relocating anything
//    else in the file.
//
// public/index.html is production (deployed to GitHub Pages via .github/workflows/deploy.yml) —
// there is no separate build output — so this script edits it in place. The modules in src/core/
// are the source of truth for the logic they cover; public/index.html's copy is regenerated from
// them, never hand-edited within a marker span.
//
// Usage:
//   node scripts/generate.js            # regenerate public/index.html in place
//   node scripts/generate.js --verify   # exit 1 if public/index.html would change (CI/pre-push check)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_HTML = path.join(ROOT, "public", "index.html");

const MODULES = [
  { name: "pack-utils", file: "src/core/packUtils.js" },
  { name: "scoring-engine", file: "src/core/scoringEngine.js" },
  { name: "app-logic", file: "src/core/appLogic.js" }
];

// Each of these names must be an `export function <name>` or `export const <name> =` at column 0
// in the given file. Add a name here after wrapping its existing public/index.html declaration in
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
  { name: "impactSubsText", file: "src/core/shareAndFormat.js" },
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
  { name: "ballLabelsForOver", file: "src/core/miscHelpers.js" },
  { name: "buildClaudeFixPrompt", file: "src/core/miscHelpers.js" },
  { name: "accountExistsLinkInfo", file: "src/core/miscHelpers.js" },
  { name: "friendlyEmailAuthError", file: "src/core/miscHelpers.js" },
  { name: "getFollowCodeFromUrl", file: "src/core/miscHelpers.js" },
  { name: "getTournamentFollowCodeFromUrl", file: "src/core/miscHelpers.js" },
  { name: "getPollCodeFromUrl", file: "src/core/miscHelpers.js" },
  { name: "getShortcutActionFromUrl", file: "src/core/miscHelpers.js" },
  { name: "getAuthActionFromUrl", file: "src/core/miscHelpers.js" },
  { name: "CLUB_LOGO_UPLOAD_ENABLED", file: "src/core/miscHelpers.js" },
  { name: "liveMatchSetters", file: "src/core/liveMatchRegistry.js" },
  { name: "registerLiveMatch", file: "src/core/liveMatchRegistry.js" },
  { name: "unregisterLiveMatch", file: "src/core/liveMatchRegistry.js" },
  { name: "notifyLiveMatchSynced", file: "src/core/liveMatchRegistry.js" },
  { name: "LS_PREFIX", file: "src/core/localStorageOutbox.js" },
  { name: "PENDING_PREFIX", file: "src/core/localStorageOutbox.js" },
  { name: "lsSetItem", file: "src/core/localStorageOutbox.js" },
  { name: "lsGetIndex", file: "src/core/localStorageOutbox.js" },
  { name: "lsSetIndex", file: "src/core/localStorageOutbox.js" },
  { name: "upsertLocalPointer", file: "src/core/localStorageOutbox.js" },
  { name: "lsPendingIds", file: "src/core/localStorageOutbox.js" },
  { name: "lsSetPendingIds", file: "src/core/localStorageOutbox.js" },
  { name: "queuePendingWrite", file: "src/core/localStorageOutbox.js" },
  { name: "clearPendingWrite", file: "src/core/localStorageOutbox.js" },
  { name: "pendingWriteCount", file: "src/core/localStorageOutbox.js" },
  { name: "pruneOrphanedPendingWrites", file: "src/core/localStorageOutbox.js" },
  { name: "undoHistoryKey", file: "src/core/localStorageOutbox.js" },
  { name: "loadUndoHistory", file: "src/core/localStorageOutbox.js" },
  { name: "saveUndoHistory", file: "src/core/localStorageOutbox.js" },
  { name: "clearUndoHistory", file: "src/core/localStorageOutbox.js" },
  { name: "AppMark", file: "src/components/illustrations.js" },
  { name: "LoadingBallIllustration", file: "src/components/illustrations.js" },
  { name: "LoadingNote", file: "src/components/illustrations.js" },
  { name: "EmptyStateBallIllustration", file: "src/components/illustrations.js" },
  { name: "RoleBadge", file: "src/components/scoringUiAtoms.js" },
  { name: "BallCelebration", file: "src/components/scoringUiAtoms.js" },
  { name: "MILESTONE_ICONS", file: "src/components/scoringUiAtoms.js" },
  { name: "MilestoneToast", file: "src/components/scoringUiAtoms.js" },
  { name: "OdometerScore", file: "src/components/scoringUiAtoms.js" },
  { name: "InningsTimer", file: "src/components/scoringUiAtoms.js" },
  { name: "SwipeableRow", file: "src/components/scoringUiAtoms.js" },
  { name: "PlayerAvatar", file: "src/components/formUiAtoms.js" },
  { name: "TextField", file: "src/components/formUiAtoms.js" },
  { name: "RuleChoice", file: "src/components/formUiAtoms.js" },
  { name: "TeamChips", file: "src/components/formUiAtoms.js" },
  { name: "PinnableChip", file: "src/components/formUiAtoms.js" },
  { name: "HomeUtilityButton", file: "src/components/formUiAtoms.js" },
  { name: "ConfirmModal", file: "src/components/formUiAtoms.js" },
  { name: "COLORS", file: "src/components/theme.js" },
  { name: "Icon", file: "src/components/icons.js" },
  { name: "AlertTriangle", file: "src/components/icons.js" },
  { name: "ArrowLeftRight", file: "src/components/icons.js" },
  { name: "Bell", file: "src/components/icons.js" },
  { name: "BookOpen", file: "src/components/icons.js" },
  { name: "CalendarClock", file: "src/components/icons.js" },
  { name: "Check", file: "src/components/icons.js" },
  { name: "ChevronDown", file: "src/components/icons.js" },
  { name: "ChevronLeft", file: "src/components/icons.js" },
  { name: "ChevronRight", file: "src/components/icons.js" },
  { name: "Circle", file: "src/components/icons.js" },
  { name: "Download", file: "src/components/icons.js" },
  { name: "Globe", file: "src/components/icons.js" },
  { name: "GoogleGLogo", file: "src/components/icons.js" },
  { name: "Hand", file: "src/components/icons.js" },
  { name: "Hash", file: "src/components/icons.js" },
  { name: "HelpCircle", file: "src/components/icons.js" },
  { name: "InboxIcon", file: "src/components/icons.js" },
  { name: "Info", file: "src/components/icons.js" },
  { name: "LogIn", file: "src/components/icons.js" },
  { name: "LogOut", file: "src/components/icons.js" },
  { name: "MessageCircle", file: "src/components/icons.js" },
  { name: "Monitor", file: "src/components/icons.js" },
  { name: "Moon", file: "src/components/icons.js" },
  { name: "MoreVertical", file: "src/components/icons.js" },
  { name: "Pencil", file: "src/components/icons.js" },
  { name: "Pin", file: "src/components/icons.js" },
  { name: "Plus", file: "src/components/icons.js" },
  { name: "Printer", file: "src/components/icons.js" },
  { name: "Share", file: "src/components/icons.js" },
  { name: "Shield", file: "src/components/icons.js" },
  { name: "Sun", file: "src/components/icons.js" },
  { name: "Table2", file: "src/components/icons.js" },
  { name: "Trash2", file: "src/components/icons.js" },
  { name: "Trophy", file: "src/components/icons.js" },
  { name: "Undo2", file: "src/components/icons.js" },
  { name: "User", file: "src/components/icons.js" },
  { name: "Users", file: "src/components/icons.js" },
  { name: "WhatsAppIcon", file: "src/components/icons.js" },
  { name: "Btn", file: "src/components/formUiAtoms.js" },
  { name: "BallBadge", file: "src/components/matchDisplayAtoms.js" },
  { name: "VisibilitySwitch", file: "src/components/matchDisplayAtoms.js" },
  { name: "MatchInfoFold", file: "src/components/matchDisplayAtoms.js" },
  { name: "Field", file: "src/components/screenAtoms.js" },
  { name: "InstallHintBanner", file: "src/components/screenAtoms.js" },
  { name: "ClubSourceSelector", file: "src/components/screenAtoms.js" },
  { name: "StandingsTable", file: "src/components/tableAtoms.js" },
  { name: "RecordTable", file: "src/components/tableAtoms.js" },
  { name: "PlayerPicker", file: "src/components/pickerAtoms.js" },
  { name: "JoinCodeBar", file: "src/components/pickerAtoms.js" },
  { name: "ExportPdfButton", file: "src/components/exportButtons.js" },
  { name: "ExportTournamentPdfButton", file: "src/components/exportButtons.js" },
  { name: "Modal", file: "src/components/modal.js" },
  { name: "RunRateChart", file: "src/components/matchInsightCards.js" },
  { name: "RunsPerOverChart", file: "src/components/matchInsightCards.js" },
  { name: "SyncConflictModal", file: "src/components/matchInsightCards.js" },
  { name: "PlayerOfMatchCard", file: "src/components/matchInsightCards.js" },
  { name: "BestFielderCard", file: "src/components/matchInsightCards.js" },
  { name: "MoveTeamMenu", file: "src/components/shareMenus.js" },
  { name: "ShareMenu", file: "src/components/shareMenus.js" },
  { name: "OversStrip", file: "src/components/scoreboardAtoms.js" },
  { name: "FixturePollSummary", file: "src/components/scoreboardAtoms.js" },
  { name: "SyncStatusBanner", file: "src/components/scoreboardAtoms.js" },
  { name: "InningScorecard", file: "src/components/scorecard.js" },
  { name: "MatchStatsPanel", file: "src/components/scorecard.js" },
  { name: "ScorecardOverlay", file: "src/components/scorecard.js" },
  { name: "PrintReport", file: "src/components/scorecard.js" },
  { name: "TournamentPrintReport", file: "src/components/scorecard.js" },
  { name: "highlightMatch", file: "src/components/infoScreens.js" },
  { name: "HELP_SECTIONS", file: "src/components/infoScreens.js" },
  { name: "HelpScreen", file: "src/components/infoScreens.js" },
  { name: "AboutScreen", file: "src/components/infoScreens.js" },
  { name: "FeedbackScreen", file: "src/components/infoScreens.js" },
  { name: "SharedLinksScreen", file: "src/components/infoScreens.js" },
  { name: "BetaTestersScreen", file: "src/components/infoScreens.js" },
  { name: "PLAYER_ROLES", file: "src/components/playerModals.js" },
  { name: "PLAYER_HANDS", file: "src/components/playerModals.js" },
  { name: "EditPlayerModal", file: "src/components/playerModals.js" },
  { name: "TransferPlayerModal", file: "src/components/playerModals.js" },
  { name: "TOUR_SLIDES", file: "src/components/miscModals.js" },
  { name: "FirstLaunchTour", file: "src/components/miscModals.js" },
  { name: "TournamentShareModal", file: "src/components/miscModals.js" },
  { name: "QualificationCalculatorModal", file: "src/components/miscModals.js" },
  { name: "VenueEditModal", file: "src/components/venueAndDateModals.js" },
  { name: "WEEKDAY_LABELS", file: "src/components/venueAndDateModals.js" },
  { name: "MONTH_LABELS", file: "src/components/venueAndDateModals.js" },
  { name: "FixtureDateTimeModal", file: "src/components/venueAndDateModals.js" },
  { name: "AvailabilityPollModal", file: "src/components/availabilityPollModal.js" },
  { name: "UpcomingFixtureCard", file: "src/components/upcomingFixtureCard.js" },
  { name: "TOURNAMENT_STATUS_LABELS", file: "src/components/tournamentStatus.js" },
  { name: "TOURNAMENT_STATUS_COLORS", file: "src/components/tournamentStatus.js" },
  { name: "FixtureRow", file: "src/components/fixtureRow.js" },
  { name: "SuperOverOpenersSetup", file: "src/components/inningsSetupScreens.js" },
  { name: "confirmImpactSub", file: "src/components/inningsSetupScreens.js" },
  { name: "ImpactPlayerCard", file: "src/components/inningsSetupScreens.js" },
  { name: "SecondInningsSetup", file: "src/components/inningsSetupScreens.js" },
  { name: "SearchAndRequestPanel", file: "src/components/searchAndRequestPanel.js" },
  { name: "AuthActionScreen", file: "src/components/authActionScreen.js" },
  { name: "PlayingXIPicker", file: "src/components/playingXIPicker.js" },
  { name: "MyTeamsScreen", file: "src/components/myTeamsScreen.js" },
  { name: "FollowTournamentScreen", file: "src/components/followTournamentScreen.js" },
  { name: "PollRespondScreen", file: "src/components/pollRespondScreen.js" },
  { name: "Cap", file: "src/components/icons.js" },
  { name: "NavWrap", file: "src/components/screenAtoms.js" },
  { name: "WelcomeScreen", file: "src/components/welcomeScreen.js" },
  { name: "SeriesDetailScreen", file: "src/components/seriesDetailScreen.js" },
  { name: "InboxScreen", file: "src/components/inboxScreen.js" },
  { name: "ResultScreen", file: "src/components/resultScreen.js" },
  { name: "PlayersScreen", file: "src/components/playersScreen.js" },
  { name: "FollowScreen", file: "src/components/followScreen.js" },
  { name: "AuthBar", file: "src/components/authBar.js" },
  { name: "FeedbackInboxScreen", file: "src/components/feedbackInboxScreen.js" },
  { name: "RecordsScreen", file: "src/components/recordsScreen.js" },
  { name: "FixturesSection", file: "src/components/fixturesSection.js" },
  { name: "ToggleRule", file: "src/components/tournamentsScreen.js" },
  { name: "NullableNumberRule", file: "src/components/tournamentsScreen.js" },
  { name: "TournamentsScreen", file: "src/components/tournamentsScreen.js" },
  { name: "TournamentDetailScreen", file: "src/components/tournamentDetailScreen.js" },
  { name: "ClubPanel", file: "src/components/clubPanel.js" },
  { name: "FederationsPanel", file: "src/components/federationsPanel.js" },
  { name: "TeamsScreen", file: "src/components/teamsScreen.js" },
  { name: "HomeScreen", file: "src/components/homeScreen.js" },
  { name: "SETUP_PAGE_LABELS", file: "src/components/setupScreen.js" },
  { name: "SetupScreen", file: "src/components/setupScreen.js" },
  { name: "TeamEditScreen", file: "src/components/teamEditScreen.js" },
  { name: "AccountScreen", file: "src/components/accountScreen.js" },
  { name: "MAX_UNDO_HISTORY", file: "src/components/matchScreen.js" },
  { name: "MatchScreen", file: "src/components/matchScreen.js" },
  { name: "FONT_LINK", file: "src/components/cricketScorer.js" },
  { name: "GLOBAL_CSS", file: "src/components/cricketScorer.js" },
  { name: "SCREEN_DEPTH", file: "src/components/cricketScorer.js" },
  { name: "CricketScorer", file: "src/components/cricketScorer.js" },
  { name: "ErrorBoundary", file: "src/components/errorBoundary.js" }
];

// Strips the ES module syntax needed for the file to be importable/testable under Node, so what's
// left is plain global-scope script — exactly what public/index.html's inline (non-module) <script> can
// run. Local imports (`import { X } from "./other.js"`) are dropped entirely: by the time a
// spliced block runs in public/index.html, everything from every other module is already declared in the
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
      `Could not find ${label} markers in public/index.html — expected ` +
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

// Finds a single `export function <name>`, `export const <name> =`, or `export class <name>`
// declaration at column 0 in a src/core/ or src/components/ file (declarations are assumed
// non-overlapping and not nested) and returns its text with `export ` stripped, ready to splice
// back into a `GENERATED-FN` marker pair. `export class` support was added for ErrorBoundary, the
// one class-based component in this codebase (a React error boundary, which can only be a class —
// componentDidCatch/getDerivedStateFromError have no hook equivalent).
const namedExportCache = new Map();
function findNamedExport(file, name) {
  let exports = namedExportCache.get(file);
  if (!exports) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    exports = new Map();
    const re = /^export (?:function (\w+)|const (\w+) =|class (\w+))/gm;
    const matches = [...source.matchAll(re)];
    matches.forEach((m, i) => {
      const declName = m[1] || m[2] || m[3];
      const start = m.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
      // `\s*$` (not `\s+$`) so this still appends exactly one trailing newline even when the
      // source file has none at all -- e.g. the last declaration in a file someone appended to
      // by hand without a final newline. Silently dropping this would glue the declaration's
      // closing brace onto the next line (the GENERATED-FN-END marker), an easy mistake to miss
      // in review since the diff still looks like "just marker lines".
      exports.set(declName, source.slice(start, end).replace(/^export /, "").replace(/\s*$/, "\n"));
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

// Guards against a specific way FUNCTIONS entries above can silently produce a broken
// public/index.html: findNamedExport only ever captures `export function/const/class`
// declarations, so a plain (non-exported) top-level helper in one of these files -- or an
// `export`ed one nobody remembered to add to FUNCTIONS -- simply falls outside every registered
// declaration's [start, nextExportStart) slice and gets dropped with no error at all. It's only
// "safe" by accident when it happens to sit textually between two REGISTERED exports in the same
// file (the earlier one's slice then sweeps it in) -- fragile, and easy to break by reordering.
// This happened twice in one session (ToggleRule/NullableNumberRule in tournamentsScreen.js,
// impactSubsText in shareAndFormat.js): each shipped a React component/function that was
// `undefined` in production, a live crash on clubscorer.com in one case and on every single
// scorecard render in the other. Run before every splice so a repeat fails loudly here, not there.
function auditReachability() {
  const moduleFiles = new Set(MODULES.map(m => m.file));
  const byFile = new Map(); // file -> Set(registered names)
  for (const fn of FUNCTIONS) {
    if (!byFile.has(fn.file)) byFile.set(fn.file, new Set());
    byFile.get(fn.file).add(fn.name);
  }
  const exportRe = /^export (?:function (\w+)|const (\w+) =|class (\w+))/gm;
  const declRe = /^(?:export )?(?:function (\w+)|const (\w+) =|class (\w+))/gm;
  const orphans = [];
  for (const [file, regNames] of byFile) {
    if (moduleFiles.has(file)) continue; // whole-file splice, not at risk
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const exportMatches = [...source.matchAll(exportRe)].map(m => ({ name: m[1] || m[2] || m[3], index: m.index }));
    const declMatches = [...source.matchAll(declRe)].map(m => ({ name: m[1] || m[2] || m[3], index: m.index }));
    for (const decl of declMatches) {
      if (regNames.has(decl.name)) continue;
      let owner = null;
      for (const em of exportMatches) {
        if (em.index <= decl.index) owner = em;
        else break;
      }
      if (!owner || !regNames.has(owner.name)) {
        orphans.push({ file, name: decl.name, owner: owner ? owner.name : null });
      }
    }
  }
  if (orphans.length === 0) return;
  console.error("Found declarations that would be silently dropped from public/index.html:\n");
  for (const o of orphans) {
    const reason = o.owner === o.name
      ? "it's exported but not registered in FUNCTIONS"
      : o.owner
        ? `it isn't its own registered export, and its neighbor "${o.owner}" (whose slice would otherwise sweep it in) isn't registered either`
        : "no export precedes it in the file at all, so no slice could ever include it";
    console.error(`  ${o.file} :: "${o.name}" -- ${reason}`);
  }
  console.error(
    "\nFix: add `export` to the declaration (if missing) and register it in this file's FUNCTIONS " +
    "array, then wrap its (possibly empty) location in public/index.html with a matching " +
    "// GENERATED-FN-START/END pair before running `npm run generate`."
  );
  process.exit(1);
}

function run() {
  auditReachability();
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
        "public/index.html is out of sync with src/core/*.js — run `npm run generate` and commit the result."
      );
      process.exit(1);
    }
    console.log("public/index.html matches src/core/*.js — up to date.");
    return;
  }

  fs.writeFileSync(INDEX_HTML, html);
  console.log("Regenerated public/index.html from src/core/*.js.");
}

run();
