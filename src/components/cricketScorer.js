import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { NavWrap } from "./screenAtoms.js";
import { LoadingBallIllustration } from "./illustrations.js";
import { WelcomeScreen } from "./welcomeScreen.js";
import { AuthActionScreen } from "./authActionScreen.js";
import { HomeScreen } from "./homeScreen.js";
import { LiveScreen } from "./liveScreen.js";
import { TabBar } from "./tabBar.js";
import { FirstLaunchTour } from "./miscModals.js";
import { SetupScreen } from "./setupScreen.js";
import { MatchScreen } from "./matchScreen.js";
import { TeamEditScreen } from "./teamEditScreen.js";
import { MyTeamsScreen } from "./myTeamsScreen.js";
import { AccountScreen } from "./accountScreen.js";
import { InboxScreen } from "./inboxScreen.js";
import { TournamentsScreen } from "./tournamentsScreen.js";
import { TournamentDetailScreen } from "./tournamentDetailScreen.js";
import { SeriesDetailScreen } from "./seriesDetailScreen.js";
import { FollowScreen } from "./followScreen.js";
import { FollowTournamentScreen } from "./followTournamentScreen.js";
import { HelpScreen, AboutScreen, FeedbackScreen, SharedLinksScreen, BetaTestersScreen } from "./infoScreens.js";
import { FeedbackInboxScreen } from "./feedbackInboxScreen.js";
import { PrintReport } from "./scorecard.js";
import { AlertModal } from "./formUiAtoms.js";
import {
  isFeedbackAdmin, getAuthActionFromUrl, getFollowCodeFromUrl, getFollowMatchIdFromUrl, getTournamentFollowCodeFromUrl,
  getShortcutActionFromUrl, accountExistsLinkInfo, genMatchCode, isClubOwner,
  isFederationOwner
} from "../core/miscHelpers.js";
import {
  hasSeenTour, loadThemePref, loadPinnedIds, savePinnedIds, applyTheme, saveThemePref, isIOSSafari,
  isStandalone, hasSeenInstallHint, markInstallHintSeen, DEFAULT_RULES, computeStandings, findFixtureToAutoLink
} from "../core/appLogic.js";
import { ensureBatsman, ensureBowler, newInning } from "../core/scoringEngine.js";
import {
  pendingWriteCount, pruneOrphanedPendingWrites, lsGetIndex, upsertLocalPointer
} from "../core/localStorageOutbox.js";
import { uid } from "../core/statsAndFixtures.js";

// The root app-shell component: screen routing (browser history/popstate-backed, with a left-edge
// swipe-to-go-back gesture), Firebase Auth session state, and every Firestore load/save/delete
// handler the app has (clubs, federations, teams, tournaments, matches, profile, beta/admin
// tools, account export/import/delete -- upwards of 80 handler functions, all local to this
// component and none needing any closure-breaking refactor, since every one of them is only ever
// called from within CricketScorer's own render or its own effects). Delegates to every other
// already-extracted screen component via real imports, passing each of those ~80 handlers down
// as props -- none of the underlying Firestore/Auth SDK calls those handlers wrap are extracted
// (auth, loadClubs, saveMatch, signOutUser, and dozens more), matching the bare-global pattern
// every other screen in this app already established for its own Firestore-touching props.
// `FONT_LINK`/`GLOBAL_CSS`/`SCREEN_DEPTH` (three standalone top-level values, previously part of
// no module, used only here) travel alongside CricketScorer in this same file as their own
// GENERATED-FN exports, same treatment SETUP_PAGE_LABELS/MAX_UNDO_HISTORY got in earlier batches.
// Covered by tests/unit/components/cricketScorer.test.js.

export const FONT_LINK = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap";

export const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  /* Disables the browser/OS's own text-selection UI everywhere except real text inputs. Originally
     shipped as the leading theory for the long-standing "mystery apostrophe" report (a stray mark
     next to a just-updated label, looking like a native selection drag-handle) -- but a later report
     of the same symptom on OversStrip's "Not started" placeholder (a brand new empty over, not an
     existing label being replaced) stayed stuck on screen until some unrelated re-render, rather
     than clearing itself the way a selection handle would once the tap/hold ends. That rules this
     theory out for at least that occurrence -- see the offsetHeight/translateZ(0) mitigation in
     OversStrip (scoreboardAtoms.js) for the current, WebKit-stale-paint-based theory instead. Kept
     here regardless: a text app like this one has nothing that needs manual copy-selection (every
     "copy" action already goes through an explicit Share/Copy button), so it's harmless either way,
     whatever the actual cause turns out to be for either report.
  */
  * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  input, textarea { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
  /* Theme tokens. Every COLORS.* value below resolves to one of these instead of a literal hex,
     so switching data-theme on <html> re-themes the whole app without touching the ~700 places
     COLORS.* is used. Light values are the app's original, unchanged palette; dark values are a
     genuinely separate set (not just "same hue, invert lightness") chosen for legibility on a
     dark surface, not derived mechanically. --cs-surface is new — it's what "#fff card on cream
     page" becomes; it did not exist as a COLORS.* entry before dark mode, since a light theme
     never needed to distinguish "the page" from "a card floating on the page." Deliberately does
     NOT touch accent/semantic colors used for badges, jersey presets, or milestone icons — those
     stay constant across both themes, same as most apps keep brand accent colors fixed while
     backgrounds/text flip. --cs-cream-fixed is the other deliberate exception: COLORS.cream got
     reused in two genuinely different roles — the page background (should flip dark) and light
     text/icons sitting on a permanently-colored surface like the pitch-gradient match header
     (should NOT flip, or that text goes near-black-on-dark-green in dark mode). --cs-cream-fixed
     is the second role, split out and pinned to the light value in both themes.
     --cs-turf-fixed/--cs-pitch-fixed/--cs-ball-fixed/--cs-ball-light-fixed are the same fix for
     the same reason: the turf/pitch and ball/ballLight gradient pair is used everywhere as a
     solid button/chip background with white text on top. In dark mode COLORS.turf/pitch/ball/
     ballLight are brightened (correctly) for use as accent text/icon color against a dark page --
     but that brightening drops white-on-gradient contrast to ~2.1-2.5:1, failing WCAG AA 4.5:1.
     The *-fixed variants pin the light-mode (darker) values in both themes so white text on these
     gradients stays legible everywhere; COLORS.turf/pitch/ball/ballLight themselves are untouched
     and keep flipping for their existing text/icon uses. */
  :root {
    --cs-pitch: #2d5016;
    --cs-pitch-dark: #1f3a0f;
    --cs-pitch-dark-fixed: #1f3a0f;
    --cs-turf: #4a7c2e;
    --cs-cream: #f2ecd9;
    --cs-cream-dark: #e5dcc1;
    --cs-cream-fixed: #f2ecd9;
    --cs-turf-fixed: #4a7c2e;
    --cs-pitch-fixed: #2d5016;
    --cs-ball-fixed: #8b1e1e;
    --cs-ball-light-fixed: #b23b3b;
    --cs-willow: #c9a876;
    --cs-ink: #2a2420;
    --cs-ink-soft: #5c5347;
    --cs-ball: #8b1e1e;
    --cs-ball-light: #b23b3b;
    --cs-gold: #b8892b;
    --cs-surface: #ffffff;
    --cs-card-divider: #e5dcc1;
    --cs-shadow: rgba(42,36,32,0.07);
    --cs-shadow-soft: rgba(42,36,32,0.05);
    /* .cs-shine's glossy top-highlight overlay (see below) — full strength against a light-mode
       surface, where it barely reads at all against the already-pale background. Needs its own
       theme-aware value rather than a fixed one: fixed at this same strength, it reads as a
       visibly two-toned band against a dark surface (a bright top strip against dark below), not
       a subtle highlight — strong enough that button text sitting in the darker lower portion
       reads as sunk toward the bottom relative to that visual divide, even though it's actually
       centered correctly the whole time. */
    --cs-shine-opacity: 0.30;
  }
  [data-theme="dark"] {
    --cs-pitch: #7ac35a;
    --cs-pitch-dark: #3d6b24;
    --cs-turf: #6bb849;
    --cs-cream: #17140f;
    --cs-cream-dark: #232019;
    --cs-willow: #c9a876;
    --cs-ink: #f0ece3;
    --cs-ink-soft: #b5ab9a;
    --cs-ball: #d16257;
    --cs-ball-light: #e08277;
    --cs-gold: #d4a544;
    --cs-surface: #242019;
    --cs-card-divider: #3a3228;
    --cs-shadow: rgba(0,0,0,0.35);
    --cs-shadow-soft: rgba(0,0,0,0.25);
    --cs-shine-opacity: 0.08;
  }
  html, body { background: var(--cs-cream); }
  @keyframes cs-pulse { 0% { transform: scale(1); } 35% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes cs-pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes cs-slideUp { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes cs-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cs-scrim { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cs-menuPop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes cs-navInRight { from { transform: translateX(18px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes cs-navInLeft { from { transform: translateX(-18px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes cs-sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes cs-boundaryPop {
    0% { transform: scale(0.4) rotate(-3deg); opacity: 0; }
    18% { transform: scale(1.1) rotate(1deg); opacity: 1; }
    28% { transform: scale(1) rotate(0deg); opacity: 1; }
    78% { transform: scale(1) rotate(0deg); opacity: 1; }
    100% { transform: scale(0.94) translateY(-16px); opacity: 0; }
  }
  @keyframes cs-digitRoll { from { transform: translateY(65%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes cs-ballSpin { to { transform: rotate(360deg); } }
  @keyframes cs-swipeHint { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-8px); } }
  @keyframes cs-toastDown { from { transform: translateY(-18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .cs-btn { transition: transform 0.14s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.14s ease, filter 0.1s ease; -webkit-tap-highlight-color: transparent; }
  .cs-btn:active { transform: scale(0.95) !important; filter: brightness(0.95); }
  .cs-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
  .cs-no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .cs-shine { position: relative; overflow: hidden; }
  .cs-shine::before {
    content: ""; position: absolute; inset: 0 0 55% 0; border-radius: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,var(--cs-shine-opacity)), rgba(255,255,255,0));
    pointer-events: none;
  }
  .cs-shine:active::before { opacity: 0.4; }
  .cs-row { transition: background 0.12s ease, transform 0.12s ease; }
  .cs-row:active { background: rgba(45,80,22,0.05) !important; transform: scale(0.99); }
  .cs-focus:focus-visible { outline: 2px solid #b8892b; outline-offset: 2px; }
  input:focus { outline: 2px solid #b8892b44; }
  .print-only { display: none; }
  @media print {
    .no-print { visibility: hidden !important; }
    .print-only {
      display: block !important; visibility: visible !important;
      position: absolute; top: 0; left: 0; width: 100%;
    }
    body, html { background: #fff !important; }
    .print-only * { visibility: visible !important; box-shadow: none !important; animation: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export const SCREEN_DEPTH = {
  home: 0,
  login: 0,
  "auth-action": 0,
  setup: 1,
  teams: 1,
  "my-teams": 1,
  match: 1,
  account: 1,
  follow: 1,
  "follow-tournament": 1,
  tournaments: 1,
  players: 1,
  live: 1,
  "team-edit": 2,
  "shared-links": 2,
  "inbox": 1,
  "tournament-detail": 2
};

// The four screens TabBar (see tabBar.js) offers direct navigation to -- the persistent bottom
// bar only renders while `screen` is one of these, hidden everywhere else (mid-match scoring,
// setup wizard, edit/detail screens reached by drilling in further) since it would just compete
// with those screens' own fixed-position UI (MatchScreen's scoring pad chief among them) or with
// their own single-purpose back button. "teams" here is the Teams tab (MyTeamsScreen, every roster
// you've created). "my-teams" is the same MyTeamsScreen reached instead from a Home shortcut, so it
// renders with no tab bar, same as "records"/"team-edit"/every other drill-in screen -- see
// tabBar.js's own TABS list for the reasoning.
export const TAB_BAR_SCREENS = ["home", "live", "tournaments", "teams"];

export function CricketScorer() {
  const initialAuthAction = useRef(getAuthActionFromUrl()).current;
  const initialFollowCode = useRef(getFollowCodeFromUrl()).current;
  // A "?followMatch=ID" link (see buildFollowMatchUrl) -- the Share button on FollowScreen itself
  // builds one of these when it was reached via a matchId rather than a code (i.e. via the Home
  // screen's Live now feed or app-wide search, neither of which involves a code at all), so a
  // viewer who found a match that way can still forward the exact thing they're watching.
  const initialFollowMatchId = useRef(getFollowMatchIdFromUrl()).current;
  const initialTournamentFollowCode = useRef(getTournamentFollowCodeFromUrl()).current;
  const initialShortcutAction = useRef(getShortcutActionFromUrl()).current;
  // A plain cold visit (no special URL param below) now lands straight on "live" with watcherMode
  // on -- no sign-in step, no upfront "who are you" choice screen either (that shipped once, then
  // got dropped: "Scorer and watcher views has to be blended in a sense," since asking a spectator
  // to declare an intent before showing them anything was still friction nobody watching a match
  // actually wanted). Reported live, the underlying complaint both times: most people who opened
  // the app just to follow a tournament never realized they needed to find the Live tab at all,
  // having landed on what read as a sign-in wall first. WelcomeScreen is still there -- reached by
  // Live's own AuthBar, "Sign in" (openAccount below) -- just not the default landing any more.
  const isDefaultColdLanding = !initialAuthAction && !initialFollowCode && !initialFollowMatchId && !initialTournamentFollowCode;
  const [screen, setScreenRaw] = useState(initialAuthAction ? "auth-action" : initialFollowCode || initialFollowMatchId ? "follow" : initialTournamentFollowCode ? "follow-tournament" : "live"); // home | login | setup | match | teams | team-edit | live | follow | follow-tournament | auth-action
  // Tracks whether this session arrived cold and anonymous (no account yet, no deep link) --
  // purely internal bookkeeping now, not a UI mode: the tab bar and every screen's own header
  // render exactly the same regardless (see the TabBar render below and LiveScreen's own header,
  // both unconditional -- a signed-out visitor gets the full app shell, same as a signed-in one,
  // rather than a stripped-down separate experience). What it still does: distinguishes a session
  // silently resolving to signed-in on its own (stay put, see the auth-redirect effect below) from
  // an explicit "Sign in" interaction (redirect to Home/Setup). True from mount for the default
  // cold landing above; left untouched (never explicitly cleared) by a trip through WelcomeScreen
  // to sign in -- see openAccount's own comment -- and only actually cleared once the auth-redirect
  // effect below fires on a real sign-in, or "Continue without an account" is chosen.
  const [watcherMode, setWatcherMode] = useState(isDefaultColdLanding);
  const [followCode, setFollowCode] = useState(initialFollowCode);
  // Set instead of followCode when FollowScreen is reached from Home's recent-match row (a tap),
  // the Live tab, search, or a "?followMatch=ID" link -- see openLiveMatch/handleOpenLiveMatch
  // below. Exactly one of followCode/followMatchId is ever set at a time; FollowScreen itself
  // treats them as equivalent.
  const [followMatchId, setFollowMatchId] = useState(initialFollowMatchId);
  // The opened match's own fixture stage ("Group"/"Semifinal"/"Final"/...), only ever set by
  // openTournamentResultMatch below -- every other way of reaching FollowScreen (a direct link,
  // Home's "Live now" feed) has no fixture to read a stage from, so this stays null for those,
  // same as before this existed. Cleared in exitFollow alongside followCode/followMatchId.
  const [followStage, setFollowStage] = useState(null);
  // Set instead of relying on initialTournamentFollowCode alone when FollowTournamentScreen is
  // reached from the Live tab (a tap) rather than a "?tournament=" link -- see
  // openLiveTournament/exitFollowTournament below. Starts at the URL-driven value so a direct link
  // still works exactly as before.
  const [tournamentFollowCode, setTournamentFollowCode] = useState(initialTournamentFollowCode);
  // Which screen to return to on exiting FollowScreen/FollowTournamentScreen -- both Home (recent
  // match row) and the Live tab can lead there, and "Back"/"Done" should land wherever the person
  // actually came from rather than always dumping them on Home. Only ever "home" or "live"; a
  // "?follow="/"?tournament=" link opens the screen directly with no prior screen to return to, so
  // the "home" default is correct there too.
  const [followReturnScreen, setFollowReturnScreen] = useState("home");
  // Same idea as followReturnScreen, for Account/Help/Feedback/About -- these used to be reachable
  // only from Home's own AuthBar, so their own onBack always just went straight back to "home".
  // Live's header carries its own AuthBar too (see its own comment: "if we don't show account
  // icon/menu then you don't present any app level information? like about, support, help"), so
  // opening one of these from Live needs Back to return to Live, not get dumped onto Home.
  const [settingsReturnScreen, setSettingsReturnScreen] = useState("home");
  const [navDirection, setNavDirection] = useState("forward");
  const [matches, setMatches] = useState([]);
  const [match, setMatch] = useState(null);
  // Set only while openMatch's Firestore/localStorage read is in flight — a match can be sizeable
  // (a full ball-by-ball innings) and the fetch is a real network round trip, so on a slow
  // connection tapping a match previously just sat there with the list still showing and nothing
  // to indicate the tap registered. See the loading overlay near the end of this component's render.
  const [matchLoading, setMatchLoading] = useState(false);
  // A single in-app AlertModal, replacing every plain window.alert() call in this file -- an OS
  // popup looks like it belongs to a different app entirely next to the rest of this screen's own
  // styling. { title?, message } | null; see the AlertModal render near the end of this
  // component's own render for where it actually shows up.
  const [alertModal, setAlertModal] = useState(null);
  const [teams, setTeams] = useState([]);
  // True only until the FIRST loadTeams() resolves, at mount -- not re-set to true on every
  // later reload (sign-in/out), since teams already falls back to local data immediately in that
  // case (see the comment further down on the auth-state-change effect) and re-showing a spinner
  // over already-visible data on every reload would be worse than the silent-swap it replaces.
  // The gap this closes is specifically the FIRST load on a fresh device/session, where local
  // cache is empty and there's nothing on screen at all while the real fetch is still in flight --
  // exactly the same "no loading indicator either way" problem clubs already had and got the
  // TIMING half of a fix for, without ever getting the visual half.
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  // Seeds the Help screen's own search box when someone taps a Help result from Home's global
  // search -- so the same query carries over instead of landing on an unfiltered FAQ list they'd
  // have to re-type into.
  const [helpInitialQuery, setHelpInitialQuery] = useState("");
  const [clubTeamsById, setClubTeamsById] = useState({}); // clubId -> team[]
  const [federationsById, setFederationsById] = useState({}); // federationId -> {id, name, ...}
  const [myActivity, setMyActivity] = useState([]); // activity notification rows addressed to me -- see /activity in firestore.rules
  const [liveMatches, setLiveMatches] = useState([]); // Live tab's Matches segment -- every in-progress AND recently-completed match, from /liveMatches (see loadLiveMatches in index.html), unrelated to sign-in state
  const [liveTournaments, setLiveTournaments] = useState([]); // Live tab's Tournaments segment -- every publicly-shared, non-private tournament, from /liveTournaments (see loadLiveTournaments in index.html), unrelated to sign-in state
  // Whether each feed's first snapshot has arrived yet -- lets LiveScreen tell "still loading" apart
  // from "confirmed, genuinely nothing live right now" instead of flashing the empty state for the
  // brief window before onSnapshot's first callback fires (see the two useEffects just below).
  const [liveMatchesLoaded, setLiveMatchesLoaded] = useState(false);
  const [liveTournamentsLoaded, setLiveTournamentsLoaded] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [clubTournamentsById, setClubTournamentsById] = useState({}); // clubId -> tournament[], existing club-organized tournaments only -- every new tournament is created personal now
  // Federation-hosted tournaments, keyed the same way as clubTournamentsById -- only for
  // federations this user owns/co-owns (myOwnedFederationIds, below), since that's the same set
  // that can actually create/manage a tournament under one. Read access is technically open to
  // any signed-in user (see the security rules), but the in-app navigation only surfaces
  // federations you run, same as how a club chip here means "you're at least a member," not
  // "anyone with the id could theoretically read this."
  const [federationTournamentsById, setFederationTournamentsById] = useState({}); // federationId -> tournament[]
  // Names for tournaments this account has no other way to see at all -- a co-owner's own
  // personal or differently-scoped club tournament, discovered only through a match that's been
  // shared. Keyed by tournamentId, `null` recorded (not omitted) once looked up and not found, so
  // the effect below doesn't keep retrying the same miss on every render. See
  // loadPublicTournamentName's own comment for where this data actually comes from.
  const [foreignTournamentNames, setForeignTournamentNames] = useState({});
  const [viewingTournament, setViewingTournament] = useState(null);
  const [themePref, setThemePrefState] = useState(loadThemePref);
  const [showTour, setShowTour] = useState(() => !hasSeenTour());
  // Only ever true for iOS Safari, not already installed, and not yet dismissed on this device
  // (see isIOSSafari/isStandalone/hasSeenInstallHint) -- gated separately from showTour below (in
  // the render condition, not here) so the two never show at once and compete for a first-time
  // visitor's attention.
  const [showInstallHint, setShowInstallHint] = useState(() => isIOSSafari() && !isStandalone() && !hasSeenInstallHint());
  const [viewingTournamentClubId, setViewingTournamentClubId] = useState(null); // which source viewingTournament came from
  const [viewingTournamentFederationId, setViewingTournamentFederationId] = useState(null); // federation variant of the above -- at most one of this and viewingTournamentClubId is ever non-null
  const [presetTournament, setPresetTournament] = useState(null); // tournament to tag onto the next match created via Setup
  const [editingTeam, setEditingTeam] = useState(null); // null = new team
  // Which screen to return to after saving/cancelling out of team-edit -- entering from Home
  // (a personal team) should land back on Home, entering from the Teams tab (personal or a
  // club's own team) should land back there, same as it always did.
  const [teamEditReturnScreen, setTeamEditReturnScreen] = useState("teams");
  // Same idea as teamEditReturnScreen, for tournament-detail/series-detail -- opening a
  // tournament from My Tournaments (personal) should return there on Back, opening one from Cups
  // (a club/federation) should return to Cups, same as it always did.
  const [tournamentDetailReturnScreen, setTournamentDetailReturnScreen] = useState("tournaments");
  const [loading, setLoading] = useState(!initialFollowCode && !initialFollowMatchId && !initialTournamentFollowCode);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // isFeedbackAdmin(user) (hardcoded-email, instant) covers this account with zero delay/flicker.
  // isCollectionAdmin is the async /admins/{uid} check -- starts false and only ever flips true
  // after the Firestore read resolves, so it only affects a hypothetical second admin, never this
  // account's own experience. Combined into isAdmin below, which is what's actually threaded
  // through props from here on instead of components each recomputing isFeedbackAdmin themselves.
  const [isCollectionAdmin, setIsCollectionAdmin] = useState(false);
  const isAdmin = isFeedbackAdmin(user) || isCollectionAdmin;
  useEffect(() => {
    if (!user) {
      setIsCollectionAdmin(false);
      return;
    }
    let cancelled = false;
    checkIsCollectionAdmin(user.uid).then(result => {
      if (!cancelled) setIsCollectionAdmin(result);
    });
    return () => {
      cancelled = true;
    };
  }, [user && user.uid]);
  const [profile, setProfile] = useState(null);
  const [isBetaTester, setIsBetaTester] = useState(false);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [authError, setAuthError] = useState("");
  // Account linking: {email, credential} from a Google sign-in attempt that hit
  // account-exists-with-different-credential — either just now (popup path, in handleSignInGoogle
  // below) or on a previous page load, recovered from getRedirectResult() after the redirect round
  // trip (mount effect below). Consumed by the effect right under this state block, which
  // completes the link automatically the moment `user` matches — covers both paths with one path
  // of code instead of duplicating the completion logic per screen.
  const [pendingGoogleLink, setPendingGoogleLink] = useState(null);
  const [linkStatus, setLinkStatus] = useState(""); // brief feedback after an auto-link attempt
  async function handleSignInGoogle() {
    const result = await signInGoogle();
    if (result.needsLink) {
      setPendingGoogleLink({
        email: result.linkEmail,
        credential: result.pendingCredential
      });
    }
    return result;
  }
  // Applied on mount and whenever the person explicitly changes it (see handleSetTheme). When set
  // to "system", also tracks the OS-level preference live via matchMedia's change event, so
  // switching the phone's system theme re-themes the app without needing a reload — the listener
  // is a no-op (and gets torn down) the moment the person picks an explicit light/dark instead.
  useEffect(() => {
    applyTheme(themePref);
    if (themePref !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themePref]);
  function handleSetTheme(pref) {
    setThemePrefState(pref);
    saveThemePref(pref);
  }
  // The Home screen's "Live now" feed -- deliberately unconditional (not gated on `user`), same as
  // the rest of /liveMatches: it's a public, read-only mirror of every currently in-progress match,
  // so a signed-out visitor sees it too. Runs for the lifetime of the app, not just while screen ===
  // "home", since there's no cheap way to pause/resume a Firestore listener across a screen change
  // without re-subscribing every time Home is revisited -- one live subscription for as long as the
  // tab is open is simpler and no more expensive than that would be.
  useEffect(() => {
    return loadLiveMatches(list => {
      setLiveMatches(list);
      setLiveMatchesLoaded(true);
    });
  }, []);
  // Same reasoning as the "Live now" subscription just above, for shared tournaments' standings
  // (/liveTournaments -- see loadLiveTournaments in index.html and refreshTournamentStandingsLive/
  // shareTournament for what writes it).
  useEffect(() => {
    return loadLiveTournaments(list => {
      setLiveTournaments(list);
      setLiveTournamentsLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!user || !pendingGoogleLink) return;
    if (pendingGoogleLink.email && user.email && pendingGoogleLink.email.toLowerCase() !== user.email.toLowerCase()) {
      // Signed in as someone else entirely (e.g. backed out and used a different account) —
      // drop the stale pending link rather than attach Google to the wrong account.
      setPendingGoogleLink(null);
      return;
    }
    const cred = pendingGoogleLink.credential;
    setPendingGoogleLink(null);
    auth.currentUser.linkWithCredential(cred).then(() => {
      setLinkStatus("Google is now linked to this account \u2014 you can sign in with either from now on.");
    }).catch(e => {
      console.error("auto-link google failed", e.code, e.message);
      setLinkStatus("Signed in, but couldn't link Google automatically. You can try again from Account \u2192 Sign-in methods.");
    });
  }, [user, pendingGoogleLink]);
  const [pendingCount, setPendingCount] = useState(0);
  // Hoisted out of the poll effect below so SyncStatusBanner's own manual "tap to retry" can call
  // it directly too — without this, a tap-triggered flush could succeed and clear the outbox, but
  // the banner would still read the old count (and look like tapping did nothing) until the next
  // 15s poll or 'online' event happened to catch up.
  function refreshPendingCount() {
    setPendingCount(pendingWriteCount());
  }
  // Separate from the top-level `loading` splash (which only covers local-first data — matches,
  // teams, tournaments — and clears quickly). Clubs have no local fallback (loadClubs just
  // returns [] when signed out), so this stays true across whichever refreshClubs() call actually
  // resolves it — see the auth-state effect below for why that's no longer the same call every time.
  const [clubsLoading, setClubsLoading] = useState(true);
  // Federation data loads via two fire-and-forget calls inside refreshClubs (kept unawaited there
  // deliberately, so federations don't add a round trip of latency on top of clubs/teams/
  // tournaments) -- but that meant nothing ever tracked whether they'd actually finished, so any
  // screen showing federation data had no way to show a loading state for it and would just show
  // whatever was in federationsById at that instant, which could still be empty/stale a moment
  // after clubsLoading had already gone false. Tracked separately so a screen CAN show its own
  // loading state for federations specifically without slowing down the clubs/teams path.
  const [federationsLoading, setFederationsLoading] = useState(true);
  const fontLoaded = useRef(false);
  const initialLoadDone = useRef(false);
  // Custom left-edge swipe-to-go-back (see swipe-gesture useEffect near the bottom of this
  // component). backActionRef always holds whatever "back" means for the CURRENTLY shown screen
  // — kept in sync every render rather than recomputed inside the touch handler itself, since the
  // handler is only ever attached once (empty-deps effect) and would otherwise close over stale
  // screen/state values.
  const backActionRef = useRef(null);
  const swipeStartRef = useRef(null); // {x, y} | null — set on a touchstart within the edge zone
  // Guards refreshClubs against overlapping calls -- now that setScreen fires one on every visit
  // to Teams/Tournaments (see below), a slower earlier call finishing AFTER a faster later one
  // would otherwise silently overwrite fresher state with its own stale snapshot. Each call
  // captures its own generation number and checks it's still current before every setState that
  // depends on data fetched partway through -- a call that's been superseded just quietly stops
  // instead of writing anything.
  const clubsRefreshGenRef = useRef(0);
  const lastClubsRefreshRef = useRef(0); // epoch ms of the last refreshClubs call that actually ran
  // A ref (not state) so the popstate handler below can flip it synchronously without waiting on
  // a re-render -- it needs to be true *before* setScreen's own pushState call would otherwise
  // fire, to stop a swipe-back/hardware-back gesture from re-pushing the very entry the browser
  // just popped (which would trap the person needing to swipe back twice for one screen).
  const suppressHistoryPushRef = useRef(false);
  // Core of screen navigation, minus the history bookkeeping -- split out so both setScreen
  // (forward taps, and the "Back" buttons) and the popstate handler below (native swipe-back /
  // hardware back / browser back button) can share the same direction-detection, scroll-reset,
  // and background-refresh logic without the latter also pushing a redundant history entry for
  // a navigation the browser already performed on its own.
  function applyScreenTransition(next) {
    setScreenRaw(current => {
      const from = SCREEN_DEPTH[current] ?? 0;
      const to = SCREEN_DEPTH[next] ?? 0;
      setNavDirection(to >= from ? "forward" : "back");
      return next;
    });
    // Swapping which top-level screen renders doesn't move the scroll position on its own --
    // without this, navigating away from partway down a long page (Account is the one people
    // actually notice this on, but it's not special-cased to it) leaves the destination screen
    // opened mid-scroll instead of from the top. Same fix SetupScreen already has for its own
    // internal step changes, just centralized here since every top-level transition already
    // funnels through this one function.
    window.scrollTo(0, 0);
    // Club/federation data (see refreshClubs) previously only ever loaded once, right after
    // sign-in -- someone else's edit (or even this same person's, from a different device or tab)
    // would never show up on Teams or Tournaments without a full sign-out/in or page reload.
    // Re-running it in the background every time either screen is entered keeps it current without
    // blocking the navigation itself; both screens already render progressively off whatever's in
    // state, so this just quietly refreshes underneath rather than needing its own transition.
    // Throttled to once per 15s here specifically -- someone bouncing Home/Teams/Tournaments back
    // and forth shouldn't re-run a multi-collection fetch on every single tap; a deliberate refresh
    // trigger elsewhere (after creating a club, joining one, etc.) still always runs regardless.
    if ((next === "teams" || next === "tournaments" || next === "my-teams") && Date.now() - lastClubsRefreshRef.current > 15000) {
      lastClubsRefreshRef.current = Date.now();
      refreshClubs();
    }
  }
  // Every top-level navigation (every "Back" button, every onOpenX prop) funnels through this,
  // so pushing one history entry per screen here is what makes native swipe-back / hardware back
  // / the browser's own back button actually walk the app's own screen stack backwards, instead
  // of leaving the OS gesture with nothing of ours to act on and falling through to unpredictable
  // default browser behavior (see the popstate listener below for the other half of this).
  // `opts.replace` swaps the pushState for a replaceState -- for transitions like starting a
  // match, where the screen being left (setup) shouldn't remain a swipe-back target once the
  // match it produced already exists and is saved: landing back in a live match's setup wizard
  // let a second "Start Match" tap spin up an entirely separate match, orphaning the first one
  // still in progress. Replacing collapses setup out of the stack, so back from match goes
  // straight to wherever setup itself was opened from.
  function setScreen(next, opts) {
    applyScreenTransition(next);
    if (!suppressHistoryPushRef.current) {
      if (opts && opts.replace) {
        window.history.replaceState({
          screen: next
        }, "");
      } else {
        window.history.pushState({
          screen: next
        }, "");
      }
    }
  }
  // TabBar's onSelect.
  function selectTab(next) {
    setScreen(next);
  }
  // Seeds the current history entry with the starting screen (so the very first swipe-back has
  // a real {screen} to fall back to instead of landing on whatever a later replaceState call
  // elsewhere leaves behind — see the auth-action/follow-code URL cleanups, which replace state
  // with null/{} since they're not tracking screens themselves), then listens for the browser
  // popping an entry (swipe-back, hardware back, the browser's own Back button) and mirrors it
  // into React state without re-pushing.
  useEffect(() => {
    window.history.replaceState({
      screen
    }, "");
    function handlePopState(e) {
      suppressHistoryPushRef.current = true;
      applyScreenTransition(e.state && e.state.screen ? e.state.screen : "home");
      suppressHistoryPushRef.current = false;
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  // Loads every club the user belongs to, then eagerly loads each club's teams too — so the
  // match-setup picker can offer a teammate's club rosters alongside your own without an extra
  // round trip the moment you pick "New Match".
  async function refreshClubs() {
    const gen = ++clubsRefreshGenRef.current;
    setClubsLoading(true);
    const clubList = await loadClubs();
    if (clubsRefreshGenRef.current !== gen) return clubList; // superseded by a newer call while awaiting
    setClubs(clubList);
    const [teamEntries, tournamentEntries] = await Promise.all([Promise.all(clubList.map(async c => [c.id, await loadClubTeams(c.id)])), Promise.all(clubList.map(async c => [c.id, await loadClubTournaments(c.id)]))]);
    if (clubsRefreshGenRef.current !== gen) return clubList;
    setClubTeamsById(Object.fromEntries(teamEntries));
    setClubTournamentsById(Object.fromEntries(tournamentEntries));
    // Federations only depend on clubList (just fetched above), not on the team/tournament loads
    // right above — so this stays unawaited relative to refreshClubs itself, deliberately, so
    // federations don't add a round trip of latency on top of clubs/teams/tournaments. Wrapped in
    // its own tracked async block now (rather than two separate untracked fire-and-forget .then()
    // chains) so federationsLoading accurately reflects when BOTH federation sources -- club-
    // affiliated and directly-owned -- have actually settled, instead of nothing ever tracking
    // completion at all.
    (async () => {
      setFederationsLoading(true);
      const fedIds = Array.from(new Set(clubList.flatMap(c => c.federationIds || [])));
      // auth.currentUser rather than the component's `user` state deliberately: refreshClubs runs
      // synchronously right after setUser(u) in the SAME auth-state-change callback (see below),
      // and React state updates don't apply until the next render -- reading `user` here would see
      // whatever it was BEFORE this callback, stale exactly on the one call that matters most
      // (right after sign-in). auth.currentUser is the SDK's own, not React's, so it's already
      // current.
      const ownedUid = auth.currentUser ? auth.currentUser.uid : null;
      const [affiliatedFeds, ownedFeds] = await Promise.all([fedIds.length > 0 ? loadFederationsByIds(fedIds) : Promise.resolve([]), ownedUid ? loadMyOwnedFederations(ownedUid) : Promise.resolve([])]);
      if (clubsRefreshGenRef.current !== gen) return;
      const freshFederationsById = Object.fromEntries([...affiliatedFeds, ...ownedFeds].map(f => [f.id, f]));
      setFederationsById(prev => ({
        ...prev,
        ...freshFederationsById
      }));
      if (affiliatedFeds.length > 0) {
        // Self-heal any affiliatedClubIds drift now that both sides (clubList, just loaded above,
        // and these federations' current affiliatedClubIds, just loaded here) are in hand — see
        // reconcileFederationAffiliation's own comment for why this can't just be made atomic at
        // the source instead. The write itself is best-effort/fire-and-forget same as before, but
        // the correction still needs applying to state here once it's done — otherwise the fix
        // lands in Firestore while the UI keeps showing the stale pre-fix copy for the rest of
        // this session (the actual bug: not that a stale check could ever really delete something
        // still in use — the server-side rule always reads the true current document — but that
        // the button confidently offered "safe to delete" right up until a real click on it
        // returned a confusing permission error instead).
        const corrected = await reconcileFederationAffiliation(clubList, freshFederationsById);
        if (clubsRefreshGenRef.current !== gen) return;
        if (Object.keys(corrected).length > 0) {
          setFederationsById(prev => ({
            ...prev,
            ...corrected
          }));
        }
      }
      if (clubsRefreshGenRef.current === gen) setFederationsLoading(false);
    })();
    setClubsLoading(false);
    return clubList;
  }
  // Federations this user owns/co-owns -- feeds the federation-tournament preload effect below and
  // TournamentsScreen's own `myFederations` prop (read-only display now, see tournamentsScreen.js).
  const myOwnedFederationIds = Object.values(federationsById).filter(f => f && user && (f.createdBy === user.uid || (f.coOwnerUids || []).includes(user.uid))).map(f => f.id);
  async function refreshMyActivity() {
    const rows = await loadMyActivity();
    setMyActivity(rows);
  }
  // Feeds the Inbox screen's Activity section and the last third of its badge count. Same
  // "queries by my own uid, not by what I own" shape as the coOwnerInvites effect above -- see
  // loadMyActivity's own comment.
  useEffect(() => {
    if (!user) {
      setMyActivity([]);
      return;
    }
    refreshMyActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  async function handleMarkActivityRead(activityIds) {
    await markActivityRead(activityIds);
    const ids = Array.isArray(activityIds) ? activityIds : [activityIds];
    setMyActivity(items => items.map(item => ids.includes(item.id) ? { ...item, read: true } : item));
  }
  async function handleDeleteActivity(activityIds) {
    await deleteActivity(activityIds);
    const ids = Array.isArray(activityIds) ? activityIds : [activityIds];
    setMyActivity(items => items.filter(item => !ids.includes(item.id)));
  }
  // My own profile is always discoverable by name now -- a name-lookup convenience, not a
  // data-access gate (firestore.rules keeps write access pinned to the caller's own identity
  // regardless of this). No user-facing toggle for it any more; publishes to /userDirectory once
  // per sign-in if not already there, self-healing anyone who opted out (or never opted in) before
  // this simplification.
  useEffect(() => {
    if (!user) return;
    loadMyProfileVisibility().then(isPublic => {
      if (!isPublic) setMyProfileVisibility(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  // Activity notifications never require an action the way an invite/request does -- they're
  // informational -- so "needs my attention" here just means unread.
  const unreadActivityCount = myActivity.filter(item => !item.read).length;
  // Feeds both HomeScreen's own bell icon and TabBar's Home-tab badge (see selectTab/TabBar
  // below).
  const inboxBadgeCount = unreadActivityCount;
  // Loads tournaments for every federation this user owns/co-owns. Only fetches ids not already in
  // federationTournamentsById, so re-renders and screen switches don't refetch everything that's
  // already loaded.
  useEffect(() => {
    const missing = myOwnedFederationIds.filter(id => !(id in federationTournamentsById));
    if (missing.length === 0) return;
    Promise.all(missing.map(async id => [id, await loadFederationTournaments(id)])).then(entries => {
      setFederationTournamentsById(prev => ({
        ...prev,
        ...Object.fromEntries(entries)
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOwnedFederationIds.join(",")]);
  useEffect(() => {
    if (!fontLoaded.current) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_LINK;
      document.head.appendChild(link);
      fontLoaded.current = true;
    }
    auth.getRedirectResult().catch(e => {
      console.error("sign-in redirect error", e);
      const link = accountExistsLinkInfo(e);
      if (link) {
        // Same case handleSignInGoogle's popup path handles — just arriving here instead because
        // the popup got blocked and fell back to a full-page redirect, so this is the only place
        // that ever sees the error (the local-state version in that path can't survive the reload).
        setPendingGoogleLink({
          email: link.email,
          credential: link.credential
        });
        setAuthError(`An account already exists for ${link.email} with a password \u2014 sign in below with that password, and Google will be linked to it too.`);
        return;
      }
      setAuthError(e.message || "Sign-in didn't complete. Please try again.");
    });
    const unsubAuth = auth.onAuthStateChanged(u => {
      setUser(u);
      setAuthChecked(true);
      if (initialLoadDone.current) {
        // account state changed after first load (sign in/out) — re-fetch from the right source
        Promise.all([loadIndex(), loadTeams(), loadProfile(), loadRules(), loadTournaments(), loadBetaStatus()]).then(([idx, teamList, prof, r, tourneys, beta]) => {
          setMatches(idx);
          setTeams(teamList);
          setProfile(prof);
          setRules(r);
          setTournaments(tourneys);
          setIsBetaTester(beta);
        });
      }
      // Clubs (and federations, which are loaded off clubs' federationIds) have no local fallback
      // — loadClubs just returns [] when signed out — so unlike the Promise.all above (which is
      // safe to fire immediately at mount, since loadIndex/loadTeams/loadTournaments all fall back
      // to local data), refreshClubs() waits specifically for THIS callback, which only ever fires
      // once Firebase Auth has actually resolved the session. Calling it eagerly at mount instead
      // used to race that resolution: lose the race and clubs loaded empty, then silently
      // corrected themselves whenever auth actually finished — with no loading indicator either
      // way, so it looked like clubs/federations just took an unpredictable while to show up.
      refreshClubs();
    });
    Promise.all([loadIndex(), loadTeams(), loadProfile(), loadRules(), loadTournaments(), loadBetaStatus()]).then(([idx, teamList, prof, r, tourneys, beta]) => {
      setMatches(idx);
      setTeams(teamList);
      setProfile(prof);
      setRules(r);
      setTournaments(tourneys);
      setIsBetaTester(beta);
      setLoading(false);
      setTeamsLoading(false);
      initialLoadDone.current = true;
    });
    return unsubAuth;
  }, []);
  // Once someone signs in from the welcome screen, move straight past it into Home rather than
  // leaving them stuck looking at a sign-in button. If the app was opened via the "New match"
  // home-screen shortcut, land straight on Setup instead — same destination as tapping Home's own
  // "New" button, just skipping the extra tap for the exact case that shortcut exists for.
  //
  // BUG FIX: this used to fire for watcherMode too whenever `user` went truthy for ANY reason --
  // including Firebase Auth silently RESTORING an already-signed-in session on a cold reload, not
  // just an explicit "Sign in" tap. Since a cold visit lands on "live" with watcherMode on by
  // design (see isDefaultColdLanding above -- Live is meant to be the default landing page), that
  // silent restore was yanking every returning signed-in visitor off Live and onto Home the moment
  // their session resolved, often before they'd even seen Live render. Only screen === "login" (a
  // real, explicit sign-in interaction -- the only way to reach that screen from watcherMode, see
  // openAccount) still redirects to Home/Setup; watcherMode resolving to signed-in on its own just
  // drops the watcher-only chrome and lets them keep browsing Live right where they landed.
  useEffect(() => {
    if (!user) return;
    if (screen === "login") {
      setWatcherMode(false);
      setScreen(initialShortcutAction === "new-match" ? "setup" : "home");
    } else if (watcherMode) {
      setWatcherMode(false);
    }
  }, [user]);
  // Feedback Inbox and Beta Testers are the two screens gated by a boolean (isAdmin) rather than
  // always rendering and letting the screen itself handle "you can't see this" -- so unlike every
  // other screen, nothing falls back if isAdmin flips false while either is open (sign out, or the
  // async /admins/{uid} check resolving false after an optimistic true). Without this, that leaves
  // a blank screen instead of landing somewhere real.
  useEffect(() => {
    if ((screen === "feedback-inbox" || screen === "beta-testers") && !isAdmin) {
      setScreen("home");
    }
  }, [isAdmin, screen]);
  // Offline outbox: retry queued writes whenever the browser tells us we're back online, and on a
  // slow poll as a safety net for platforms where the 'online' event doesn't fire reliably. The
  // poll also keeps the visible pending count in sync with reality (e.g. after a match screen's
  // own save clears its own entry) without threading a callback through every save call site.
  useEffect(() => {
    let cancelled = false;
    function refreshPendingCountIfMounted() {
      if (!cancelled) refreshPendingCount();
    }
    function handleOnline() {
      flushPendingWrites().then(refreshPendingCountIfMounted);
    }
    window.addEventListener("online", handleOnline);
    pruneOrphanedPendingWrites(); // sweep up anything left behind by a delete from before that cleanup existed
    refreshPendingCountIfMounted();
    flushPendingWrites().then(refreshPendingCountIfMounted); // catch up on anything queued from a prior session
    const poll = setInterval(() => {
      if (navigator.onLine !== false) {
        flushPendingWrites().then(refreshPendingCountIfMounted);
      } else {
        refreshPendingCountIfMounted();
      }
    }, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      clearInterval(poll);
    };
  }, []);
  async function refreshIndex() {
    setMatches(await loadIndex());
  }
  async function handleSaveProfile(p) {
    await saveProfile(p);
    setProfile(p);
  }
  async function handleExportData() {
    return await exportUserData();
  }
  async function handleImportData(data) {
    const result = await importUserData(data);
    // A restore can bring back matches/teams this device's in-memory state doesn't know about yet
    // (or overwrite ones it does) — refresh both from source rather than trying to patch the
    // existing state in place.
    if (result.ok || result.matchesCount > 0 || result.teamsCount > 0) {
      refreshIndex();
      loadTeams().then(setTeams);
    }
    return result;
  }
  async function handleDeleteAccount() {
    // Passes this device's own match index so deleteUserAccount can route each one through
    // deleteMatch() — the only way a match's shareCode/viewCode docs (which have no owner field to
    // query by) get cleaned up. auth.currentUser.delete() triggers the same onAuthStateChanged
    // listener a normal sign-out does, so user/profile clear themselves; this just needs to reset
    // the screens that were showing this account's now-deleted data.
    await deleteUserAccount(matches.map(m => m.id));
    setMatches(await loadIndex());
    setTeams(await loadTeams());
    setClubs([]);
    setClubTeamsById({});
    setScreen("home");
  }
  async function handleSaveRules(r) {
    await saveRules(r);
    setRules(r);
  }
  async function handleRevokeShareCode(id) {
    const result = await revokeShareCode(id);
    if (result.ok) setMatches(await loadIndex());
    return result;
  }
  async function handleRevokeViewCode(id) {
    const result = await revokeViewCode(id);
    if (result.ok) setMatches(await loadIndex());
    return result;
  }
  async function handleJoinCode(code) {
    const result = await fetchSharedMatch(code);
    if (!result.found) return {
      ok: false,
      error: result.error || "No match found for that code."
    };
    upsertLocalPointer(result.match, {
      shareCode: code,
      cloud: false
    });
    setMatch(result.match);
    setScreen("match");
    refreshIndex();
    return {
      ok: true
    };
  }
  function startNewMatch(setup) {
    const battingFirstTeam = setup.battingFirstTeam || setup.teamA;
    const bowlingFirstTeam = setup.battingFirstTeam === setup.teamB ? setup.teamA : setup.teamB;
    // Same XI-size lookup as battingTeamXISize/maxWicketsFor, done inline here since `m` (the
    // match object those helpers expect) doesn't exist yet at this point — it's what we're about
    // to build, and its innings array needs this value passed in up front.
    const battingFirstRoster = battingFirstTeam === setup.teamA ? setup.teamARoster : setup.teamBRoster;
    const battingFirstXISize = battingFirstRoster && battingFirstRoster.length || setup.rules && setup.rules.playersPerSide || DEFAULT_RULES.playersPerSide;
    const m = {
      id: uid(),
      createdAt: Date.now(),
      teamA: setup.teamA,
      teamB: setup.teamB,
      teamAId: setup.teamAId || null,
      teamBId: setup.teamBId || null,
      teamARoster: setup.teamARoster || [],
      teamBRoster: setup.teamBRoster || [],
      teamABench: setup.teamABench || [],
      teamBBench: setup.teamBBench || [],
      // Count of Impact Player substitutions each team has made so far, not a boolean -- a
      // tournament's own rule book can allow more than the standard 1 (impactPlayerMaxSubs).
      teamAImpactUsed: 0,
      teamBImpactUsed: 0,
      // {team, outName, inName} per Impact Player substitution actually made -- see
      // confirmImpactSub in inningsSetupScreens.js. Stays empty for any match that never uses the
      // rule, same as penalties/fallOfWickets' own "nothing happened, empty array" convention.
      impactSubs: [],
      teamACaptain: setup.teamACaptain || "",
      teamAViceCaptain: setup.teamAViceCaptain || "",
      teamAKeeper: setup.teamAKeeper || "",
      teamAColor: setup.teamAColor || null,
      teamBCaptain: setup.teamBCaptain || "",
      teamBViceCaptain: setup.teamBViceCaptain || "",
      teamBKeeper: setup.teamBKeeper || "",
      teamBColor: setup.teamBColor || null,
      teamANumbers: setup.teamANumbers || {},
      teamBNumbers: setup.teamBNumbers || {},
      oversLimit: setup.oversLimit,
      venue: setup.venue || null,
      venueLat: setup.venueLat != null ? setup.venueLat : null,
      venueLng: setup.venueLng != null ? setup.venueLng : null,
      umpire1: setup.umpire1 || null,
      umpire2: setup.umpire2 || null,
      currentInningIndex: 0,
      status: "in-progress",
      // Who this match is organized under -- mirrors the same club/federation/personal distinction
      // tournaments already have, just stored as an explicit field here instead of which collection
      // the record lives in (matches, unlike tournaments, have always been one flat collection with
      // no per-club/federation subcollection split). A standalone match is always personal now
      // (SetupScreen has no Organizer picker of its own any more); only a match started from within
      // an existing club/federation tournament still inherits one, via
      // presetTournament._clubId/_federationId.
      clubId: setup.clubId || null,
      federationId: setup.federationId || null,
      // Opt-out from the Live tab's Matches segment / app-wide search -- its own explicit choice
      // on SetupScreen now, independent of Organizer (used to be derived: personal always private,
      // club/federation always public, with no visible control for anyone who had no clubs to pick
      // from at all). Gates the /liveMatches mirror write in saveMatch -- a private match is never
      // written there at all, live or after completion.
      private: !!setup.private,
      rules: setup.rules || DEFAULT_RULES,
      toss: setup.toss || null,
      playerOfMatch: null,
      bestFielder: null,
      tournamentId: setup.tournamentId || null,
      // BUG FIX: this used to always be newInning(setup.teamA, setup.teamB, ...) — the first
      // innings was hard-coded as Team A batting regardless of the toss. battingFirstTeam (set by
      // SetupScreen from the actual toss decision, defaulting to teamA if no toss was recorded)
      // is what makes this track reality instead.
      innings: [newInning(battingFirstTeam, bowlingFirstTeam, setup.rules, battingFirstXISize - 1, setup.oversLimit)],
      awaitingSecondInningsSetup: false
    };
    m.innings[0].strikerName = setup.strikerA;
    m.innings[0].nonStrikerName = setup.nonStrikerA;
    m.innings[0].bowlerName = setup.bowlerB;
    ensureBatsman(m.innings[0], setup.strikerA);
    ensureBatsman(m.innings[0], setup.nonStrikerA);
    ensureBowler(m.innings[0], setup.bowlerB);
    // Auto-share club/federation matches up front when more than one person could plausibly need
    // to pick up scoring this exact match -- every "co-owner can't continue scoring" bug fixed this
    // session traced back to the same gap: a club match (tournament or standalone) stayed locked to
    // just its creator's own account until they remembered to tap Share, so a teammate who saw it
    // in "Continue Scoring" (via the world-readable tournamentMatches/entries pointer, for a
    // tournament match) hit a dead end. Minting the code here with the same genMatchCode() the
    // manual Share button uses closes that gap outright instead of only wording the resulting
    // error message better (see checkTournamentMatchShareStatus). Keyed off m.clubId/m.federationId
    // directly rather than presetTournament, purely for simplicity -- both end up set from the
    // same source now (a fixture inheriting its tournament's own club/federation).
    // Scoped to clubs with more than one member and federations with at least one co-owner -- a
    // solo personal match/tournament has no one else who'd ever need this, so it isn't worth the
    // wider access a share code grants. Only ever true today for a match started from within an
    // existing club/federation tournament, since a standalone match is always personal now.
    {
      const club = m.clubId ? clubs.find(c => c.id === m.clubId) : null;
      const federation = m.federationId ? federationsById[m.federationId] : null;
      if (club && (club.memberUids || []).length > 1 || federation && (federation.coOwnerUids || []).length > 0) {
        m.shareCode = genMatchCode();
      }
    }
    setMatch(m);
    saveMatch(m).then(result => {
      // First-ever write for a brand new match — merge the assigned writeSeq back so the very
      // first ball scored doesn't immediately false-conflict against a baseline of 0.
      if (result.ok && result.writeSeq != null) {
        setMatch(cur => cur ? {
          ...cur,
          writeSeq: result.writeSeq
        } : cur);
      }
    });
    setScreen("match", {
      replace: true
    });
    setPresetTournament(null);
    // BUG FIX: this used to run unconditionally, so a tournament's own rules (Free Hit, custom
    // wide/no-ball runs, whatever house rules that competition set) got remembered as THIS DEVICE's
    // own default -- meaning the very next standalone "New Match" from Home (no tournament
    // involved) silently inherited them instead of starting from DEFAULT_RULES/standard, which is
    // what someone starting a plain friendly expects. Mirrors SetupScreen's own reasoning for why a
    // tournament's defaultRules take priority OVER this saved value when one IS in play (see its
    // matchRules comment) -- the same asymmetry applies here: a tournament's rules are allowed to
    // flow INTO its own matches, but must never flow back OUT into becoming everyone's new default.
    if (setup.rules && !setup.tournamentId) handleSaveRules(setup.rules); // remember as the default seed for next match's setup screen
    // Came from "Score this fixture" — link the new match back onto that fixture so it shows as
    // played instead of staying listed as upcoming. Not awaited, same as elsewhere this fire-
    // and-forget pattern is already used (e.g. handleDelete's tournament cleanup below) — a
    // failure here shouldn't block the match that was just created and already navigated to.
    if (setup.fixtureId && setup.tournamentId) {
      linkFixtureToMatch(setup.tournamentId, setup.fixtureId, m.id, setup.rules, setup.venue, setup.oversLimit);
    } else if (setup.tournamentId) {
      // Same pairing, started some other way (e.g. "Start Match" from within the tournament
      // itself, rather than "Start Fixture" on one specific card) — back-fill the link if exactly
      // one still-unplayed fixture matches these two teams, so it doesn't stay stuck looking
      // "upcoming" everywhere else despite already counting toward standings. presetTournament is
      // safe to read here even after setPresetTournament(null) just above -- that only schedules a
      // future re-render, this closure's own copy still holds the tournament setup.tournamentId
      // came from (SetupScreen's Organizer picker has no independent way to set tournamentId at
      // all; it's only ever populated from presetTournament in the first place, via
      // handleStartMatchInTournament/handleStartFixtureMatch). See findFixtureToAutoLink's own
      // comment for why an ambiguous match (0 or 2+ candidates) is left alone rather than guessed at.
      const fixtureId = findFixtureToAutoLink(presetTournament, m.innings[0].battingTeam, m.innings[0].bowlingTeam);
      if (fixtureId) linkFixtureToMatch(setup.tournamentId, fixtureId, m.id, setup.rules, setup.venue, setup.oversLimit);
    }
  }
  // Takes either a plain match id (Home's own matches -- always loadable straight from this
  // account's own uid) or the full match object a screen already has in hand (a tournament/series
  // screen's loadTournamentMatches data, or Home once one of those matches gets a local pointer --
  // see below). BUG FIX: passing only an id left no way to open a co-owner's shared match the
  // first time this device ever saw it -- loadMatch(id) alone can only resolve one via a local
  // index pointer (lsGetIndex) or under this account's own uid, and a teammate's match that this
  // device has never independently opened has neither, so it fell through every branch and
  // returned null with no visible effect. Seeding a local pointer from the known object's
  // shareCode first (same fix loadMatch's own shareCode branch already relies on for
  // handleJoinCode) lets the normal cross-account lookup find it; the known object itself is the
  // last-resort fallback if that still comes back empty (e.g. offline).
  async function openMatch(matchOrId) {
    const isObject = matchOrId && typeof matchOrId === "object";
    const id = isObject ? matchOrId.id : matchOrId;
    const knownMatch = isObject ? matchOrId : null;
    // BUG FIX: "the known object" above is NOT always a full match -- once a shared match has
    // been opened here even once, upsertLocalPointer's deliberately lightweight index entry for it
    // (id/teamA/teamB/status/shareCode/scoreLine, no innings -- see loadIndex/upsertLocalPointer)
    // is what loadIndex() hands back for it on every later load, including as the very object
    // Home's own "Continue scoring" card passes back in here. Falling back to THAT when loadMatch
    // failed (a network blip, a since-revoked code) put a match with no innings into `match` state
    // -- MatchScreen and PrintReport both assume real innings data unconditionally, so the screen
    // crashed outright instead of the harmless silent no-op this fallback was meant to be.
    const knownMatchIsUsable = knownMatch && Array.isArray(knownMatch.innings) && knownMatch.innings.length > 0;
    setMatchLoading(true);
    try {
      if (knownMatch && knownMatch.shareCode) upsertLocalPointer(knownMatch);
      const loaded = await loadMatch(id);
      // BUG FIX: the pointer refresh just above only ever re-saves the STALE card data Home passed
      // in, before the real fetch below -- reported live as a match stuck showing "Continue
      // scoring" on Home long after it was actually completed (elsewhere, by a co-scorer via this
      // match's shareCode; opening it here correctly went straight to the results screen, since
      // `loaded` itself was already accurate). Only a shareCode match's local index entry is ever
      // this device's OWN source of truth for it (see loadIndex/upsertLocalPointer) -- an
      // account-owned match is refreshed for free every time from the cloud query in loadIndex,
      // so re-saving its pointer here is a harmless no-op, filtered out there either way.
      if (loaded) upsertLocalPointer(loaded);
      const m = loaded || (knownMatchIsUsable ? knownMatch : null);
      if (m) {
        setMatch(m);
        setScreen("match");
        // Self-heal for a match created before auto-share existed (see startNewMatch) -- an old
        // tournament match never got a shareCode, so it's exactly as invisible to co-owners as
        // auto-share was built to prevent for new ones, and nothing about scoring it ever
        // revisits that decision afterward. `loaded` succeeding (not the "known match" fallback
        // just above, which can be a stale snapshot handed in by the caller) is what makes this
        // safe: it means THIS account's own /users/{uid}/matches copy resolved, i.e. this really
        // is that match's own scorer opening it, on the one path that can legitimately decide to
        // share it -- reusing the exact qualification startNewMatch already applies.
        if (loaded && loaded.tournamentId && !loaded.shareCode) {
          const owningTournament = allTournamentsFlat.find(t => t.id === loaded.tournamentId);
          const club = owningTournament && owningTournament._clubId ? clubs.find(c => c.id === owningTournament._clubId) : null;
          const federation = owningTournament && owningTournament._federationId ? federationsById[owningTournament._federationId] : null;
          if (club && (club.memberUids || []).length > 1 || federation && (federation.coOwnerUids || []).length > 0) {
            handleGetShareCodeForMatch(loaded).then(result => {
              if (result.ok) setMatch(cur => cur && cur.id === loaded.id ? { ...cur,
                shareCode: result.code
              } : cur);
            });
          }
        }
      } else if (isObject) {
        // BUG FIX: "check your connection" was misleading for the actual common case here -- a
        // teammate's or club co-owner's match that was never explicitly shared (tapped Share) by
        // whoever's actually scoring it. There's no automatic cross-account access just from
        // being in the same club; a matching shareCode has to exist at all. Diagnoses the real
        // reason when this match is tournament-tagged (the only case with a public pointer to
        // check at all) so the message says something true instead of guessing "network."
        let message = "Couldn't open that match — check your connection and try again.";
        if (knownMatch && knownMatch.tournamentId) {
          const status = await checkTournamentMatchShareStatus(knownMatch.tournamentId, id);
          if (status === "never-shared") {
            message = "This match hasn't been shared yet — ask whoever's scoring it to open it and tap Share.";
          } else if (status === "expired") {
            message = "This match's share link has expired — ask whoever's scoring it to share it again.";
          }
        }
        setAlertModal({
          message
        });
      }
    } finally {
      setMatchLoading(false);
    }
  }
  // Generic counterparts to MatchScreen's own handleGetCode/handleGetViewCode, for sharing a match
  // straight from its Home screen list row -- those versions are scoped to whichever ONE match is
  // currently open (match/setMatch, singular), which doesn't exist yet here; this operates on a
  // specific match object passed in and writes back into the plural matches list instead.
  async function handleGetShareCodeForMatch(m) {
    if (m.shareCode) return {
      ok: true,
      code: m.shareCode
    };
    const updated = {
      ...m,
      shareCode: genMatchCode()
    };
    const result = await saveMatch(updated);
    if (result.ok) {
      setMatches(prev => prev.map(x => x.id === m.id ? {
        ...updated,
        writeSeq: result.writeSeq
      } : x));
      return {
        ok: true,
        code: updated.shareCode
      };
    }
    return {
      ok: false,
      error: result.error || (result.conflict ? "This match changed on another device \u2014 reopen it to see the latest before sharing a code." : undefined)
    };
  }
  async function handleGetViewCodeForMatch(m) {
    if (m.viewCode) return {
      ok: true,
      code: m.viewCode
    };
    const updated = {
      ...m,
      viewCode: genMatchCode()
    };
    const result = await saveMatch(updated);
    if (result.ok) {
      setMatches(prev => prev.map(x => x.id === m.id ? {
        ...updated,
        writeSeq: result.writeSeq
      } : x));
      return {
        ok: true,
        code: updated.viewCode
      };
    }
    return {
      ok: false,
      error: result.error || (result.conflict ? "This match changed on another device \u2014 reopen it to see the latest before sharing a link." : undefined)
    };
  }
  // Links a newly-created match back onto the fixture it came from, marking it played instead of
  // leaving it listed as upcoming forever. Same reasoning as clearFixtureForDeletedMatch just
  // below: independent of viewingTournament*Id (which reflects whatever tournament screen is
  // CURRENTLY open, not necessarily the one this fixture belongs to) rather than assuming which
  // one's active -- starting a match straight from Home's "Start match" button has no "currently
  // viewed tournament" context at all, so relying on viewingTournament here would silently no-op
  // and leave the fixture stuck showing as upcoming even after it's been played. Also backfills
  // defaultRules/venue onto the tournament, but only if it doesn't already have them -- the first
  // fixture scored for a tournament silently becomes its default going forward, same as before.
  // Separately backfills the fixture's own venue too (same only-if-unset rule), since a typed-in-
  // setup venue is the most direct signal of where that specific fixture is actually happening --
  // matches aren't always all at the tournament's default ground. defaultOvers gets the same
  // only-if-unset backfill as defaultRules -- this is the fallback path for a tournament that
  // never had its rules set explicitly at creation (see TournamentsScreen's "Match rules
  // (optional)" section); one that did already has defaultOvers/defaultRules set, so `t.defaultOvers
  // || fallbackOvers` is a no-op there.
  async function linkFixtureToMatch(tournamentId, fixtureId, matchId, fallbackRules, fallbackVenue, fallbackOvers) {
    const personalIdx = tournaments.findIndex(t => t.id === tournamentId);
    if (personalIdx !== -1) {
      const t = tournaments[personalIdx];
      const updatedT = {
        ...t,
        defaultRules: t.defaultRules || fallbackRules || null,
        defaultOvers: t.defaultOvers || fallbackOvers || null,
        venue: t.venue || fallbackVenue || null,
        fixtures: (t.fixtures || []).map(f => f.id === fixtureId ? {
          ...f,
          matchId,
          venue: f.venue || fallbackVenue || null
        } : f)
      };
      const updatedList = tournaments.map((x, i) => i === personalIdx ? updatedT : x);
      setTournaments(updatedList);
      await saveTournaments(updatedList);
      return;
    }
    for (const [clubId, list] of Object.entries(clubTournamentsById)) {
      const t = (list || []).find(x => x.id === tournamentId);
      if (!t) continue;
      const updatedT = {
        ...t,
        defaultRules: t.defaultRules || fallbackRules || null,
        defaultOvers: t.defaultOvers || fallbackOvers || null,
        venue: t.venue || fallbackVenue || null,
        fixtures: (t.fixtures || []).map(f => f.id === fixtureId ? {
          ...f,
          matchId,
          venue: f.venue || fallbackVenue || null
        } : f)
      };
      const result = await saveClubTournament(clubId, updatedT);
      if (result.ok) {
        setClubTournamentsById(prev => ({
          ...prev,
          [clubId]: (prev[clubId] || []).map(x => x.id === tournamentId ? updatedT : x)
        }));
      }
      return;
    }
    for (const [fedId, list] of Object.entries(federationTournamentsById)) {
      const t = (list || []).find(x => x.id === tournamentId);
      if (!t) continue;
      const updatedT = {
        ...t,
        defaultRules: t.defaultRules || fallbackRules || null,
        defaultOvers: t.defaultOvers || fallbackOvers || null,
        venue: t.venue || fallbackVenue || null,
        fixtures: (t.fixtures || []).map(f => f.id === fixtureId ? {
          ...f,
          matchId,
          venue: f.venue || fallbackVenue || null
        } : f)
      };
      const result = await saveFederationTournament(fedId, updatedT);
      if (result.ok) {
        setFederationTournamentsById(prev => ({
          ...prev,
          [fedId]: (prev[fedId] || []).map(x => x.id === tournamentId ? updatedT : x)
        }));
      }
      return;
    }
  }
  // If a deleted match was linked to a tournament fixture, clear that fixture's matchId back to
  // null so it correctly reverts to "upcoming" instead of pointing at a match that no longer
  // exists. Without this, the fixture kept LOOKING unplayed (isFixturePlayed reads the match
  // through matchById, which correctly no longer finds a deleted one) but still tried to OPEN the
  // dead match id first when tapped (FixtureRow's onScore checks f.matchId truthy, not whether a
  // match actually exists behind it) — so the button visually read "Score" while silently failing
  // to do anything. Independent of viewingTournament*Id (which reflects whatever's CURRENTLY open,
  // not necessarily the tournament this specific match belongs to — deleting from the Home/Matches
  // list has no "currently viewed tournament" context at all), so this searches all three storage
  // locations by tournamentId directly rather than assuming which one is active.
  async function clearFixtureForDeletedMatch(tournamentId, matchId) {
    const personalIdx = tournaments.findIndex(t => t.id === tournamentId);
    if (personalIdx !== -1) {
      const t = tournaments[personalIdx];
      const fx = t.fixtures || [];
      if (!fx.some(f => f.matchId === matchId)) return;
      const updated = tournaments.map((x, i) => i === personalIdx ? {
        ...t,
        fixtures: fx.map(f => f.matchId === matchId ? {
          ...f,
          matchId: null
        } : f)
      } : x);
      setTournaments(updated);
      await saveTournaments(updated);
      return;
    }
    for (const [clubId, list] of Object.entries(clubTournamentsById)) {
      const t = (list || []).find(x => x.id === tournamentId);
      if (!t) continue;
      const fx = t.fixtures || [];
      if (!fx.some(f => f.matchId === matchId)) return;
      const updatedT = {
        ...t,
        fixtures: fx.map(f => f.matchId === matchId ? {
          ...f,
          matchId: null
        } : f)
      };
      const result = await saveClubTournament(clubId, updatedT);
      if (result.ok) {
        setClubTournamentsById(prev => ({
          ...prev,
          [clubId]: (prev[clubId] || []).map(x => x.id === tournamentId ? updatedT : x)
        }));
      }
      return;
    }
    for (const [fedId, list] of Object.entries(federationTournamentsById)) {
      const t = (list || []).find(x => x.id === tournamentId);
      if (!t) continue;
      const fx = t.fixtures || [];
      if (!fx.some(f => f.matchId === matchId)) return;
      const updatedT = {
        ...t,
        fixtures: fx.map(f => f.matchId === matchId ? {
          ...f,
          matchId: null
        } : f)
      };
      const result = await saveFederationTournament(fedId, updatedT);
      if (result.ok) {
        setFederationTournamentsById(prev => ({
          ...prev,
          [fedId]: (prev[fedId] || []).map(x => x.id === tournamentId ? updatedT : x)
        }));
      }
      return;
    }
  }
  async function handleDelete(id) {
    // Captured before deleteMatch runs — the local index entry for this match (which is where
    // tournamentId actually lives, same as deleteMatch's own cleanup reads it from) is gone once
    // the delete completes.
    const pointer = lsGetIndex().find(m => m.id === id);
    await deleteMatch(id);
    refreshIndex();
    // deleteMatch clears this match's outbox entry, but the "N not synced" banner reads a separate
    // pendingCount state that otherwise only updates on the 15s poll — without this, deleting the
    // one match that was stuck retrying still leaves the banner showing until that poll catches up.
    refreshPendingCount();
    if (pointer && pointer.tournamentId) {
      // Best-effort, not awaited — a failure here shouldn't block or error out the delete itself,
      // same reasoning as the tournament-pointer cleanup inside deleteMatch.
      clearFixtureForDeletedMatch(pointer.tournamentId, id).catch(e => console.error("fixture cleanup after match delete failed", e));
    }
  }
  function exitToHome() {
    // If this match belongs to the tournament the person was just looking at, go back there
    // instead of all the way home — "Back" from a tournament's match should land you back on
    // that tournament's fixtures/standings, not dump you at the top-level Home screen.
    const backToTournament = match && match.tournamentId && viewingTournament && viewingTournament.id === match.tournamentId;
    setMatch(null);
    setScreen(backToTournament ? "tournament-detail" : "home");
    refreshIndex();
  }
  function exitFollow() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("follow");
      url.searchParams.delete("followMatch");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* noop — worst case the param stays in the address bar */
    }
    setFollowCode(null);
    setFollowMatchId(null);
    setFollowStage(null);
    // tournamentFollowCode is only ever still set here when this match's follow view was opened
    // FROM FollowTournamentScreen's own Results section (openTournamentResultMatch below
    // deliberately leaves it in place, unlike openLiveTournament/exitFollowTournament) -- "Back"
    // should land on that tournament's follow view, not wherever followReturnScreen points.
    setScreen(tournamentFollowCode ? "follow-tournament" : followReturnScreen);
  }
  // Tapping a card in Home's recent-match row, the Live tab, or an app-wide search result -- same
  // destination screen as a "?follow=" or "?followMatch=" link (exitFollow above clears both
  // params, so every path leaves cleanly), just reached by matchId instead of a code, with no URL
  // param to set here since a tap (unlike a link) never touches the address bar to begin with.
  function openLiveMatch(id) {
    setFollowReturnScreen(screen === "live" ? "live" : "home");
    setFollowMatchId(id);
    setScreen("follow");
  }
  // Same reasoning as openLiveMatch just above, for the Live tab's tournaments feed -- reached by
  // shareCode rather than a matchId since that's what FollowTournamentScreen has always taken (the
  // same code a "?tournament=" link carries), no separate matchId-shaped path needed.
  function openLiveTournament(code) {
    setFollowReturnScreen(screen === "live" ? "live" : "home");
    setTournamentFollowCode(code);
    setScreen("follow-tournament");
  }
  // Account/Help/Feedback/About -- shared between HomeScreen's own AuthBar and Live's own (see its
  // own comment). settingsReturnScreen captures wherever this was actually opened from,
  // so each one's own onBack (below) returns there instead of always dumping back onto Home.
  //
  // "Sign in" for a signed-out visitor -- whether that's a watcher or a guest on Home who chose
  // "Continue without an account" -- goes straight to WelcomeScreen instead of AccountScreen's own
  // (separate, near-duplicate) sign-in prompt. Reported live: "instead sign in on top can lead to
  // old signin landing page" -- one canonical sign-in screen, reached the same way from anywhere,
  // rather than two different ones depending on which "Sign in" you happened to tap. watcherMode
  // itself is left untouched here (not cleared) -- WelcomeScreen's own Back (settingsReturnScreen)
  // returns to "live" exactly as it was if that's where this came from; for a Home guest, watcherMode
  // was never true to begin with.
  function openAccount() {
    setSettingsReturnScreen(screen);
    setScreen(user ? "account" : "login");
  }
  function openHelp(q) {
    setHelpInitialQuery(q || "");
    setSettingsReturnScreen(screen);
    setScreen("help");
  }
  function openFeedback() {
    setSettingsReturnScreen(screen);
    setScreen("feedback");
  }
  function openAbout() {
    setSettingsReturnScreen(screen);
    setScreen("about");
  }
  function exitFollowTournament() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tournament");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* noop — worst case the param stays in the address bar */
    }
    setTournamentFollowCode(null);
    setScreen(followReturnScreen);
  }
  // Opens a completed tournament fixture's own read-only match view from FollowTournamentScreen's
  // own Results section (see that component's onOpenMatch prop) -- reported live as a genuine gap:
  // "match completed for the tournament, are not able to get into it to see the scorecard." By
  // matchId, not a bearer code -- FollowScreen's matchId prop already reads the match straight from
  // the open, already-listable /liveMatches collection, the same path Home's "Live now" feed uses,
  // so no code ever needed minting for this. Deliberately leaves tournamentFollowCode set (unlike
  // openLiveTournament, which always sets a fresh one) so exitFollow's own check sends "Back"/"Done"
  // from this match straight back to the tournament's follow view rather than home/live.
  function openTournamentResultMatch(matchId, stage) {
    setFollowMatchId(matchId);
    setFollowStage(stage || null);
    setScreen("follow");
  }
  // Keeps backActionRef pointed at whatever "Back" does for the screen on display right now —
  // deliberately mirrors each screen's own onBack/onCancel/onExit prop below (see the render at
  // the bottom of this component) rather than introducing a second source of truth for where
  // "back" goes; home/login are top-level and stay null (nothing to swipe back to).
  useEffect(() => {
    backActionRef.current = (() => {
      switch (screen) {
        case "setup":
          return () => {
            const cameFromTournament = !!presetTournament && viewingTournament && viewingTournament.id === presetTournament.id;
            setPresetTournament(null);
            setScreen(cameFromTournament ? "tournament-detail" : "home");
          };
        case "match":
          return match ? exitToHome : null;
        case "teams":
        case "tournaments":
        case "account":
        case "players":
          return () => setScreen("home");
        case "tournament-detail":
          return () => setScreen("tournaments");
        case "shared-links":
          return () => setScreen("account");
        case "follow":
          return exitFollow;
        case "follow-tournament":
          return exitFollowTournament;
        case "team-edit":
          return () => setScreen("teams");
        case "inbox":
          return () => setScreen("account");
        default:
          return null;
      }
    })();
  });
  // Left-edge swipe-to-go-back, since a plain React/state-driven "screen" has no browser history
  // for Safari's own edge-swipe gesture to hook into (see chat) — this reimplements just the
  // gesture-detection part: a touch starting within EDGE_ZONE of the left edge that travels more
  // than SWIPE_THRESHOLD px, mostly horizontally, fires whatever backActionRef currently holds.
  // Attached once (empty deps) with plain DOM listeners rather than per-render, since it must
  // survive every screen change without re-attaching; freshness comes from backActionRef instead.
  useEffect(() => {
    const EDGE_ZONE = 24;
    const SWIPE_THRESHOLD = 70;
    function onTouchStart(e) {
      const t = e.touches[0];
      // Skip arming entirely inside a horizontally-scrollable row (club/team chip strips, the
      // overs strip, etc. — anything marked .cs-no-scrollbar) — scrolling one of those is a large,
      // mostly-horizontal drag that satisfies the exact same thresholds as an intentional
      // edge-swipe-back, so without this check, scrolling through your clubs on an iPhone could
      // silently fire backActionRef and bounce you off the screen mid-scroll. Reported as "can't
      // click on existing clubs" — the tap itself likely landed fine; a moment later a scroll
      // elsewhere in the same gesture set was what actually navigated away.
      const inScroller = t && t.target && t.target.closest && t.target.closest(".cs-no-scrollbar");
      if (inScroller) {
        console.log("[cs-swipe] touchstart inside .cs-no-scrollbar, not arming", t.clientX, t.clientY);
        swipeStartRef.current = null;
        return;
      }
      swipeStartRef.current = t && t.clientX <= EDGE_ZONE ? {
        x: t.clientX,
        y: t.clientY
      } : null;
      if (swipeStartRef.current) {
        console.log("[cs-swipe] armed at", swipeStartRef.current.x, swipeStartRef.current.y, "target:", t.target && t.target.tagName, t.target && t.target.className);
      }
    }
    function onTouchEnd(e) {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const qualifies = dx > SWIPE_THRESHOLD && dx > Math.abs(dy) * 1.5;
      console.log("[cs-swipe] end dx:", dx, "dy:", dy, "qualifies:", qualifies, "hasBackAction:", !!backActionRef.current);
      if (qualifies && backActionRef.current) {
        console.log("[cs-swipe] firing backActionRef");
        backActionRef.current();
      }
    }
    document.addEventListener("touchstart", onTouchStart, {
      passive: true
    });
    document.addEventListener("touchend", onTouchEnd, {
      passive: true
    });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
  // Every .cs-no-scrollbar strip (club/team chip rows, tournament filter chips, the overs strip,
  // ...) relies on a horizontal swipe to see what's off-screen -- reported as unreachable on a
  // desktop with a plain mouse (no trackpad, no touchscreen), since a bare vertical wheel doesn't
  // scroll a horizontal-only container in most browsers, and the hidden scrollbar (the whole point
  // of the class) leaves nothing to click-drag either. Converts an ordinary vertical wheel gesture
  // over one of these strips into horizontal scrolling instead, so a mouse alone is enough.
  // Deliberately skips a gesture that already has its own horizontal component (deltaX >= deltaY --
  // a trackpad swipe or a shift+wheel scroll) and a strip with nothing to scroll to, so this never
  // swallows an ordinary page scroll that merely happens to pass over a fully-visible strip.
  useEffect(() => {
    function onWheel(e) {
      const scroller = e.target && e.target.closest && e.target.closest(".cs-no-scrollbar");
      if (!scroller) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      scroller.scrollLeft += e.deltaY;
      e.preventDefault();
    }
    document.addEventListener("wheel", onWheel, {
      passive: false
    });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);
  async function handleSaveTeam(team) {
    const updated = teams.filter(t => t.id !== team.id);
    updated.push(team);
    updated.sort((a, b) => a.name.localeCompare(b.name));
    setTeams(updated);
    await saveTeams(updated);
    setScreen(teamEditReturnScreen);
    setEditingTeam(null);
  }
  async function handleDeleteTeam(id) {
    const updated = teams.filter(t => t.id !== id);
    setTeams(updated);
    await saveTeams(updated);
  }
  // The Cups tab always shows this merged view — personal tournaments plus every club's and every
  // owned federation's, each tagged with its organizer (see TournamentsScreen's own per-row tag) —
  // rather than requiring a club/federation to be pre-selected before its tournaments are even
  // visible. Also what Home's own search/team-adjacent surfaces use.
  const allTournamentsFlat = [...tournaments.map(t => ({ ...t,
    _clubId: null,
    _federationId: null
  })), ...Object.entries(clubTournamentsById).flatMap(([cid, list]) => list.map(t => ({ ...t,
    _clubId: cid,
    _federationId: null
  }))), ...Object.entries(federationTournamentsById).flatMap(([fid, list]) => list.map(t => ({ ...t,
    _clubId: null,
    _federationId: fid
  })))];
  async function handleCreateTournament(name, teamNames, groups, advancePerGroup, defaultOvers, defaultRules, venueInfo, isPrivate) {
    const t = {
      id: uid(),
      name,
      teams: teamNames,
      groups: groups || null,
      advancePerGroup: groups ? advancePerGroup || 2 : null,
      defaultOvers: defaultOvers || null,
      defaultRules: defaultRules || null,
      // A private tournament's fixtures default to private too -- a fixture started from within one
      // inherits presetTournament.private directly (see SetupScreen), same "set once, inherited by
      // every fixture" relationship defaultOvers/defaultRules already have.
      private: !!isPrivate,
      // BUG FIX: tournamentsScreen.js's create form has always collected an optional default venue
      // (see its own "Default venue" field/VenueEditModal) and passed it as this 7th argument, but
      // this function only ever declared six parameters -- the venue was silently dropped on every
      // tournament creation, with no error, no missing field on screen (the create form just closes
      // normally). The only way to actually see it apply was to add it again afterward via the
      // tournament detail screen's own "Add a venue" flow (editTournamentVenue), same fields
      // (venue/venueLat/venueLng), just never wired in at creation time.
      venue: venueInfo ? venueInfo.venue : null,
      venueLat: venueInfo ? venueInfo.venueLat : null,
      venueLng: venueInfo ? venueInfo.venueLng : null,
      createdAt: Date.now()
    };
    const updated = [...tournaments, t];
    setTournaments(updated);
    await saveTournaments(updated);
    maybeAutoPublishTournament(t, async t2 => {
      const list = updated.map(x => x.id === t2.id ? t2 : x);
      setTournaments(list);
      await saveTournaments(list);
    });
    return {
      ok: true,
      tournament: t
    };
  }
  // A series is stored through the exact same paths as a tournament (saveClubTournament/
  // saveTournaments, the same `tournaments` list/subcollection) — it's a tournament-shaped doc
  // distinguished only by kind: "series", a fixed two-team `teams`, and fixtures pre-generated
  // between exactly those two teams rather than left for a round-robin generator to fill in.
  // That reuse is why handleUpdateTournament/handleDeleteTournament need no series-specific
  // counterpart — they already operate generically on whatever's in `tournaments`/the club
  // subcollection, kind included.
  async function handleCreateSeries(name, teamA, teamB, matchCount) {
    const t = {
      id: uid(),
      name,
      kind: "series",
      teams: [teamA, teamB],
      teamA,
      teamB,
      fixtures: Array.from({
        length: matchCount
      }, () => ({
        id: uid(),
        teamA,
        teamB,
        date: "",
        matchId: null
      })),
      createdAt: Date.now()
    };
    const updated = [...tournaments, t];
    setTournaments(updated);
    await saveTournaments(updated);
    return {
      ok: true,
      tournament: t
    };
  }
  async function handleDeleteTournament(t) {
    const clubId = viewingTournamentClubId;
    const federationId = viewingTournamentFederationId;
    if (federationId) {
      await deleteFederationTournament(federationId, t.id);
      setFederationTournamentsById(prev => ({
        ...prev,
        [federationId]: (prev[federationId] || []).filter(x => x.id !== t.id)
      }));
    } else if (clubId) {
      await deleteClubTournament(clubId, t.id);
      setClubTournamentsById(prev => ({
        ...prev,
        [clubId]: (prev[clubId] || []).filter(x => x.id !== t.id)
      }));
    } else {
      const updated = tournaments.filter(x => x.id !== t.id);
      setTournaments(updated);
      await saveTournaments(updated);
    }
    setViewingTournament(null);
    setViewingTournamentClubId(null);
    setViewingTournamentFederationId(null);
    setScreen("tournaments");
  }
  // Persists any change to the currently-viewed tournament (fixtures generated/added/edited/
  // deleted, teams, name, ...) — single choke point so every fixture action doesn't need its own
  // save-plus-state-sync logic, and so it's automatically correct about which source (personal, a
  // specific club, or a specific federation) the tournament actually lives in.
  // Closes the friction gap between matches and tournaments: a non-private MATCH is discoverable
  // in the Home screen's Live now feed the instant it's saved, no extra step -- a non-private
  // TOURNAMENT used to stay invisible until its owner explicitly tapped "Share" once. Called after
  // every successful tournament save (creation and every edit) except a series, which has never
  // collected a Visibility choice at creation -- defaulting it into auto-publish here would
  // silently make a "private by omission" series discoverable, so it's left alone. `persist` is
  // however THIS caller already knows to save an update back to the right storage tier (club/
  // federation/personal) -- kept as an explicit callback rather than reaching for ambient
  // `viewingTournament*` state, which isn't guaranteed to already point at a just-created
  // tournament by the time this (fire-and-forget, awaited-later) call resolves.
  async function maybeAutoPublishTournament(tournament, persist) {
    if (tournament.kind === "series" || tournament.private) return;
    if (tournament.shareCode) {
      // BUG FIX: this used to call ONLY refreshTournamentStandingsLive, which recomputes standings
      // against whatever fixtures/venue/groups/teams already happen to be sitting in the public
      // /tournamentMatches/{tournamentId} config doc -- never refreshes that doc itself. Since the
      // config doc is only ever written by shareTournament, and this is the owner's own client
      // editing an already-published tournament (this branch never runs for a guest), every
      // fixture generated/added/edited after the tournament's first auto-publish silently never
      // reached the public snapshot until the owner happened to open the Share panel and tap
      // "Refresh now" by hand. syncTournamentConfig re-syncs that config doc from the current
      // tournament object first, so the standings refresh right after it runs against fresh data.
      await syncTournamentConfig(tournament);
      refreshTournamentStandingsLive(tournament.id);
      return;
    }
    // Never shared before -- mint a code and publish for the first time, the same work
    // TournamentShareModal's "Share" button does, just triggered automatically instead of by a
    // tap. Empty match list is correct here: a tournament this is reachable for has either just
    // been created (genuinely zero matches) or is being auto-healed after an edit with no
    // shareCode yet -- either way, the very next refreshTournamentStandingsLive (triggered by any
    // match completing) recomputes the real standings from scratch once a shareCode exists.
    const result = await shareTournament(tournament, computeStandings(tournament, []));
    if (result.ok) {
      persist({
        ...tournament,
        shareCode: result.code
      });
    }
  }
  async function handleUpdateTournament(updated, skipAutoPublish = false) {
    const clubId = viewingTournamentClubId;
    const federationId = viewingTournamentFederationId;
    if (federationId) {
      const result = await saveFederationTournament(federationId, updated);
      if (result.ok) {
        setFederationTournamentsById(prev => ({
          ...prev,
          [federationId]: (prev[federationId] || []).map(t => t.id === updated.id ? updated : t)
        }));
        setViewingTournament(updated);
        if (!skipAutoPublish) maybeAutoPublishTournament(updated, t => handleUpdateTournament(t, true));
      }
      return result;
    }
    if (clubId) {
      const result = await saveClubTournament(clubId, updated);
      if (result.ok) {
        setClubTournamentsById(prev => ({
          ...prev,
          [clubId]: (prev[clubId] || []).map(t => t.id === updated.id ? updated : t)
        }));
        setViewingTournament(updated);
        if (!skipAutoPublish) maybeAutoPublishTournament(updated, t => handleUpdateTournament(t, true));
      }
      return result;
    }
    const updatedList = tournaments.map(t => t.id === updated.id ? updated : t);
    setTournaments(updatedList);
    await saveTournaments(updatedList);
    setViewingTournament(updated);
    if (!skipAutoPublish) maybeAutoPublishTournament(updated, t => handleUpdateTournament(t, true));
    return {
      ok: true
    };
  }
  // Flips a tournament's own Visibility after creation. There's no manual UI for this any more --
  // Visibility is derived from Organizer and fixed at creation -- so the only caller left is
  // TournamentDetailScreen's self-heal effect, correcting one still carrying the opposite of what
  // its organizer now implies. Saves through the normal handleUpdateTournament path, which on its
  // own now handles the "going public" side (maybeAutoPublishTournament -- mints a share code and
  // publishes for the first time if this tournament was never shared, or just republishes if it
  // was). All this function needs to add is the one thing handleUpdateTournament has no reason to
  // know about: going private removes it from /liveTournaments immediately
  // (removeTournamentFromLiveFeed), rather than waiting for its TTL to catch up.
  async function handleToggleTournamentVisibility(tournament) {
    const updated = {
      ...tournament,
      private: !tournament.private
    };
    const result = await handleUpdateTournament(updated);
    if (result.ok && updated.private) {
      removeTournamentFromLiveFeed(updated.id);
    }
    return result;
  }
  // Saves an updated tournament doc back to whichever of the three storage locations it actually
  // lives in, addressed by the tournament's own _clubId/_federationId tag (allTournamentsFlat
  // attaches this to every entry) rather than assuming which one's "currently active" -- shared by
  // every Home-screen edit that touches a tournament without navigating into it first (scheduling
  // a fixture, editing venue, and any future one), so this branch only needs to be right in one
  // place instead of re-derived at each call site.
  async function saveTournamentFromHome(tournament, updated) {
    const clubId = tournament._clubId;
    const federationId = tournament._federationId;
    if (federationId) {
      const result = await saveFederationTournament(federationId, updated);
      if (result.ok) {
        setFederationTournamentsById(prev => ({
          ...prev,
          [federationId]: (prev[federationId] || []).map(t => t.id === updated.id ? updated : t)
        }));
      }
      return result;
    }
    if (clubId) {
      const result = await saveClubTournament(clubId, updated);
      if (result.ok) {
        setClubTournamentsById(prev => ({
          ...prev,
          [clubId]: (prev[clubId] || []).map(t => t.id === updated.id ? updated : t)
        }));
      }
      return result;
    }
    const updatedList = tournaments.map(t => t.id === updated.id ? updated : t);
    setTournaments(updatedList);
    await saveTournaments(updatedList);
    return {
      ok: true
    };
  }
  // Shared by both places a tournament gets opened into its detail screen (Home's own tournament
  // cards and the Cups tab) so the self-heal below only has to be written once. Self-heal for a
  // tournament created before auto-publish existed (see maybeAutoPublishTournament) -- its public
  // tournamentMatches/{tournamentId} doc was never created, so no account outside this tournament's
  // own club/federation can ever resolve its name (see foreignTournamentNames) even once one of its
  // matches gets shared. maybeAutoPublishTournament already no-ops for anything private, already-
  // published, or a series, so firing it on every open (not just an edit) is safe.
  function openTournamentDetail(t, returnScreen, clubId, federationId) {
    setViewingTournament(t);
    setViewingTournamentClubId(clubId);
    setViewingTournamentFederationId(federationId);
    setTournamentDetailReturnScreen(returnScreen);
    setScreen(t.kind === "series" ? "series-detail" : "tournament-detail");
    maybeAutoPublishTournament(t, updated => saveTournamentFromHome(t, updated).then(result => {
      if (result.ok) setViewingTournament(cur => cur && cur.id === updated.id ? updated : cur);
    }));
  }
  // Lets a fixture's date/time be set right from the Home screen's Upcoming section, without
  // first navigating into the tournament. Same underlying save as FixturesSection's updateDate
  // (mirrored below), just addressed by the fixture's own tournament -- via the _clubId/
  // _federationId tag allTournamentsFlat already attaches to every entry -- instead of reading
  // viewingTournamentClubId/FederationId state, since Home never opens that screen at all and
  // that state wouldn't reflect the tournament this fixture actually belongs to.
  async function handleScheduleFixtureFromHome(tournament, fixtureId, date) {
    const updated = {
      ...tournament,
      fixtures: (tournament.fixtures || []).map(f => f.id === fixtureId ? {
        ...f,
        date
      } : f)
    };
    return saveTournamentFromHome(tournament, updated);
  }
  // Each fixture carries its own optional venue that overrides the tournament's default (see
  // UpcomingFixtureCard's venue/venueLat/venueLng) -- matches in a tournament aren't always all
  // at the same ground, regardless of who's organizing it. The tournament's own venue field is
  // still what a fixture without an override falls back to, and still gets backfilled as a side
  // effect of scoring a tournament's first fixture (see linkFixtureToMatch's fallbackVenue), but
  // this is the only place a fixture's own venue is directly editable.
  // lat/lng are only present when VenueEditModal's address search actually matched a real address
  // (see coords in that component) -- null for a hand-typed venue with no match, which is fine to
  // save as free text, it just means no weather forecast can be looked up for it.
  async function handleEditVenueFromHome(tournament, fixture, venue, lat, lng) {
    const updated = {
      ...tournament,
      fixtures: (tournament.fixtures || []).map(f => f.id === fixture.id ? {
        ...f,
        venue: venue || null,
        venueLat: lat != null ? lat : null,
        venueLng: lng != null ? lng : null
      } : f)
    };
    return saveTournamentFromHome(tournament, updated);
  }
  function handleStartMatchInTournament(t) {
    setPresetTournament(t);
    setScreen("setup");
  }
  // Same as above but pre-fills the team pickers from a specific unplayed fixture, and — once the
  // match is actually created (see startNewMatch) — links the new match's id back onto that
  // fixture so it shows as played instead of staying listed as upcoming.
  function handleStartFixtureMatch(t, fixture) {
    setPresetTournament({
      ...t,
      // Same fixture-overrides-tournament fallback as UpcomingFixtureCard/buildTournamentICS --
      // without this, starting a match from a fixture that has its own venue override would show
      // the tournament's default venue in setup instead of the ground this fixture actually got
      // scheduled at.
      venue: fixture.venue || t.venue,
      venueLat: fixture.venue ? fixture.venueLat : t.venueLat,
      venueLng: fixture.venue ? fixture.venueLng : t.venueLng,
      fixtureId: fixture.id,
      fixtureTeamA: fixture.teamA,
      fixtureTeamB: fixture.teamB
    });
    setScreen("setup");
  }
  const allTeamsForSetup = [...teams, ...Object.values(clubTeamsById).flat()];
  // Merged, source-tagged team list (mirrors allTournamentsFlat below): personal teams plus every
  // club's. Only ever consumed by Home now (its own team search, and to tell onOpenTeam whether a
  // tapped team is personal or a specific club's).
  const allTeamsFlat = [...teams.map(t => ({ ...t,
    _clubId: null
  })), ...Object.entries(clubTeamsById).flatMap(([cid, list]) => (list || []).map(t => ({ ...t,
    _clubId: cid
  })))].sort((a, b) => a.name.localeCompare(b.name));
  const tournamentNameById = {};
  for (const t of tournaments) tournamentNameById[t.id] = t.name;
  for (const list of Object.values(clubTournamentsById)) {
    for (const t of list) tournamentNameById[t.id] = t.name;
  }
  for (const list of Object.values(federationTournamentsById)) {
    for (const t of list) tournamentNameById[t.id] = t.name;
  }
  for (const [id, name] of Object.entries(foreignTournamentNames)) {
    if (name && !tournamentNameById[id]) tournamentNameById[id] = name;
  }
  // BUG FIX: a match tagged with a tournament this account can't otherwise see at all (a
  // co-owner's own tournament, discovered only because the match itself got shared) always fell
  // back to the bare "Tournament" placeholder every card/badge above already shows for an unknown
  // id -- even though that tournament auto-published its name publicly the moment it was created
  // (see loadPublicTournamentName). Looks up whichever tournamentIds show up in `matches` that
  // aren't resolved by any of the three loops above, one bare Firestore doc read each.
  const unresolvedTournamentIdsKey = [...new Set(matches.map(m => m.tournamentId).filter(id => id && !tournamentNameById[id] && !(id in foreignTournamentNames)))].sort().join(",");
  useEffect(() => {
    if (!unresolvedTournamentIdsKey) return;
    const ids = unresolvedTournamentIdsKey.split(",");
    let cancelled = false;
    Promise.all(ids.map(id => loadPublicTournamentName(id))).then(names => {
      if (cancelled) return;
      setForeignTournamentNames(prev => {
        const next = { ...prev };
        ids.forEach((id, i) => {
          next[id] = names[i];
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [unresolvedTournamentIdsKey]);
  const wrapStyle = {
    minHeight: "100vh",
    background: COLORS.cream,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,36,32,0.045) 28px)",
    WebkitTextSizeAdjust: "100%",
    touchAction: "manipulation"
  };
  if (loading || !authChecked && !initialFollowCode && !initialFollowMatchId && !initialTournamentFollowCode) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("style", null, GLOBAL_CSS), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(LoadingBallIllustration, {
      style: {
        margin: "0 auto 12px"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        color: COLORS.inkSoft,
        fontSize: 13
      }
    }, "Loading…")));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: wrapStyle,
    className: "no-print"
  }, /*#__PURE__*/React.createElement("style", null, GLOBAL_CSS), screen === "auth-action" && initialAuthAction && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "auth-action",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(AuthActionScreen, {
    mode: initialAuthAction.mode,
    oobCode: initialAuthAction.oobCode,
    onDone: () => {
      // Drop mode/oobCode from the URL so refreshing (or just leaving the tab open) doesn't
      // re-run an already-used, now-invalid code -- same reasoning as the follow/tournament/poll
      // codes never getting cleaned up because those stay valid to revisit, unlike a one-time
      // action code.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("mode");
        url.searchParams.delete("oobCode");
        url.searchParams.delete("apiKey");
        url.searchParams.delete("lang");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch (e) {}
      setScreen(user ? "home" : "login");
    }
  })), screen === "login" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "login",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(WelcomeScreen, {
    onSignIn: handleSignInGoogle,
    // Clears watcherMode too, not just navigates -- same internal bookkeeping cleanup a real
    // sign-in does via the auth-redirect effect above, once someone's explicitly chosen a path
    // (signed in, or "Continue without an account") rather than still sitting on the undecided
    // cold-landing default. Harmless no-op otherwise, since watcherMode is already false whenever
    // this is reached any other way.
    onSkip: () => {
      setWatcherMode(false);
      setScreen(initialShortcutAction === "new-match" ? "setup" : "home");
    },
    onBack: () => setScreen(settingsReturnScreen)
  })), screen === "home" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "home",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(HomeScreen, {
    matches: matches,
    onNew: () => setScreen("setup"),
    onOpen: openMatch,
    onDelete: handleDelete,
    user: user,
    profile: profile,
    onOpenAccount: openAccount,
    onOpenInbox: () => setScreen("inbox"),
    onOpenSharedLinks: () => setScreen("shared-links"),
    onOpenHelp: openHelp,
    onOpenFeedback: openFeedback,
    onOpenAbout: openAbout,
    onSignOut: signOutUser,
    themePref: themePref,
    onSetTheme: handleSetTheme,
    onJoinCode: handleJoinCode,
    onOpenTournaments: () => setScreen("tournaments"),
    onLoadRecentMatches: fetchLiveAndRecentMatches,
    pendingCount: pendingCount,
    onPendingSynced: refreshPendingCount,
    inboxBadgeCount: inboxBadgeCount,
    tournamentNameById: tournamentNameById,
    tournaments: allTournamentsFlat,
    onOpenTournament: t => openTournamentDetail(t, "home", t._clubId || null, t._federationId || null),
    onScheduleFixture: handleScheduleFixtureFromHome,
    onStartFixture: handleStartFixtureMatch,
    onEditVenue: handleEditVenueFromHome,
    clubs: clubs,
    federationsById: federationsById,
    clubTeamsById: clubTeamsById,
    teams: allTeamsFlat,
    onOpenTeam: () => setScreen("my-teams"),
    onGetShareCode: handleGetShareCodeForMatch,
    onGetViewCode: handleGetViewCodeForMatch,
    onOpenLiveMatch: openLiveMatch,
    showTabBar: true,
    showInstallHint: showInstallHint && !showTour,
    onDismissInstallHint: () => {
      setShowInstallHint(false);
      markInstallHintSeen();
    }
  })), showTour && screen === "home" && /*#__PURE__*/React.createElement(FirstLaunchTour, {
    onDone: () => setShowTour(false)
  }), screen === "live" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "live",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(LiveScreen, {
    liveMatches: liveMatches,
    onOpenLiveMatch: openLiveMatch,
    liveTournaments: liveTournaments,
    onOpenLiveTournament: openLiveTournament,
    tournamentNameById: tournamentNameById,
    loading: !liveMatchesLoaded || !liveTournamentsLoaded,
    showTabBar: true,
    user: user,
    profile: profile,
    onOpenAccount: openAccount,
    onOpenHelp: openHelp,
    onOpenFeedback: openFeedback,
    onOpenAbout: openAbout,
    onSignOut: signOutUser,
    themePref: themePref,
    onSetTheme: handleSetTheme
  })), screen === "setup" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "setup",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(SetupScreen, {
    onStart: startNewMatch,
    onCancel: () => {
      const cameFromTournament = !!presetTournament && viewingTournament && viewingTournament.id === presetTournament.id;
      setPresetTournament(null);
      setScreen(cameFromTournament ? "tournament-detail" : "home");
    },
    teams: allTeamsForSetup,
    rules: rules,
    presetTournament: presetTournament,
    clubs: clubs
  })), screen === "match" && match && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "match",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(MatchScreen, {
    match: match,
    setMatch: setMatch,
    onExit: exitToHome,
    pendingCount: pendingCount,
    onPendingSynced: refreshPendingCount,
    tournament: match && match.tournamentId && viewingTournament && viewingTournament.id === match.tournamentId ? viewingTournament : null
  })), screen === "my-teams" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "my-teams",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(MyTeamsScreen, {
    teams: teams,
    teamsLoading: teamsLoading,
    matches: matches,
    onBack: () => setScreen("home"),
    onNewTeam: () => {
      setEditingTeam(null);
      setTeamEditReturnScreen("my-teams");
      setScreen("team-edit");
    },
    onEditTeam: t => {
      setEditingTeam(t);
      setTeamEditReturnScreen("my-teams");
      setScreen("team-edit");
    },
    onDeleteTeam: id => handleDeleteTeam(id, null),
    showTabBar: false
  })), screen === "teams" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "teams",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(MyTeamsScreen, {
    teams: teams,
    teamsLoading: teamsLoading,
    matches: matches,
    onNewTeam: () => {
      setEditingTeam(null);
      setTeamEditReturnScreen("teams");
      setScreen("team-edit");
    },
    onEditTeam: t => {
      setEditingTeam(t);
      setTeamEditReturnScreen("teams");
      setScreen("team-edit");
    },
    onDeleteTeam: id => handleDeleteTeam(id, null),
    showTabBar: true
  })), screen === "tournaments" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "tournaments",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(TournamentsScreen, {
    tournaments: allTournamentsFlat,
    clubs: clubs,
    myFederations: myOwnedFederationIds.map(id => federationsById[id]).filter(Boolean),
    teamOptions: teams.map(t => t.name),
    onCreateTournament: handleCreateTournament,
    onCreateSeries: handleCreateSeries,
    onOpenTournament: t => openTournamentDetail(t, "tournaments", t._clubId || null, t._federationId || null),
    showTabBar: true
  })), screen === "series-detail" && viewingTournament && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "series-detail",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(SeriesDetailScreen, {
    series: viewingTournament,
    onBack: () => setScreen(tournamentDetailReturnScreen),
    backLabel: tournamentDetailReturnScreen === "home" ? "Home" : "Cups",
    onStartFixtureMatch: handleStartFixtureMatch,
    onUpdateSeries: handleUpdateTournament,
    onOpenMatch: openMatch,
    onDeleteSeries: handleDeleteTournament,
    canManage: viewingTournamentFederationId ? isFederationOwner(federationsById[viewingTournamentFederationId], user && user.uid) : !viewingTournamentClubId || isClubOwner(clubs.find(c => c.id === viewingTournamentClubId), user && user.uid)
  })), screen === "tournament-detail" && viewingTournament && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "tournament-detail",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(TournamentDetailScreen, {
    tournament: viewingTournament,
    onBack: () => setScreen(tournamentDetailReturnScreen),
    backLabel: tournamentDetailReturnScreen === "home" ? "Home" : "Cups",
    onStartMatch: handleStartMatchInTournament,
    onStartFixtureMatch: handleStartFixtureMatch,
    onUpdateTournament: handleUpdateTournament,
    onToggleVisibility: handleToggleTournamentVisibility,
    onOpenMatch: openMatch,
    onDeleteTournament: handleDeleteTournament,
    canManage: viewingTournamentFederationId ? isFederationOwner(federationsById[viewingTournamentFederationId], user && user.uid) : !viewingTournamentClubId || isClubOwner(clubs.find(c => c.id === viewingTournamentClubId), user && user.uid),
    isPersonal: !viewingTournamentClubId && !viewingTournamentFederationId,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  })), screen === "account" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "account",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(AccountScreen, {
    user: user,
    profile: profile,
    isAdmin: isAdmin,
    // Both one level down from Account, same as SharedLinksScreen just below -- their own onBack
    // (below) returns to "account" directly, not settingsReturnScreen (which points at wherever
    // Account ITSELF was opened from). Found auditing navigation for "proper navigation, not some
    // exits randomly": these used to skip past Account straight to Home.
    onOpenFeedbackInbox: () => setScreen("feedback-inbox"),
    onOpenBetaTesters: () => setScreen("beta-testers"),
    isBetaTester: isBetaTester,
    clubs: clubs,
    federationsById: federationsById,
    onSignIn: handleSignInGoogle,
    onSignOut: signOutUser,
    onSaveProfile: handleSaveProfile,
    onExportData: handleExportData,
    onImportData: handleImportData,
    onDeleteAccount: handleDeleteAccount,
    onBack: () => setScreen(settingsReturnScreen),
    redirectError: authError,
    linkStatus: linkStatus,
    onClearLinkStatus: () => setLinkStatus("")
  })), screen === "help" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "help",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(HelpScreen, {
    onBack: () => setScreen(settingsReturnScreen),
    initialQuery: helpInitialQuery,
    onReplayTour: () => {
      setShowTour(true);
      setScreen("home");
    }
  })), screen === "feedback" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "feedback",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FeedbackScreen, {
    onBack: () => setScreen(settingsReturnScreen),
    userEmail: user && user.email
  })), screen === "feedback-inbox" && isAdmin && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "feedback-inbox",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FeedbackInboxScreen, {
    onBack: () => setScreen("account")
  })), screen === "beta-testers" && isAdmin && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "beta-testers",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(BetaTestersScreen, {
    onBack: () => setScreen("account")
  })), screen === "about" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "about",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(AboutScreen, {
    onBack: () => setScreen(settingsReturnScreen)
  })), screen === "inbox" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "inbox",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(InboxScreen, {
    activity: myActivity,
    onMarkActivityRead: handleMarkActivityRead,
    onDeleteActivity: handleDeleteActivity,
    onBack: () => setScreen("home")
  })), screen === "shared-links" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "shared-links",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(SharedLinksScreen, {
    matches: matches,
    onRevokeShareCode: handleRevokeShareCode,
    onRevokeViewCode: handleRevokeViewCode,
    onBack: () => setScreen("account")
  })), screen === "follow" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "follow",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FollowScreen, {
    code: followCode,
    matchId: followMatchId,
    onExit: exitFollow,
    stage: followStage
  })), screen === "follow-tournament" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "follow-tournament",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FollowTournamentScreen, {
    code: tournamentFollowCode,
    onExit: exitFollowTournament,
    // "Go to Club Scorer" only makes sense for someone who landed here cold via a "?tournament="
    // link and might not even have the app open anywhere else -- openLiveTournament (the Live
    // tab's only entry point into this screen) is the one place that ever sets followReturnScreen
    // to "live", so its presence here means this render is reached from inside the app, where that
    // phrasing just reads as a mistake.
    reachedInApp: followReturnScreen === "live",
    onOpenMatch: openTournamentResultMatch
  })), screen === "team-edit" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "team-edit",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(TeamEditScreen, {
    team: editingTeam,
    onSave: team => handleSaveTeam(team, null),
    onCancel: () => setScreen(teamEditReturnScreen),
    onDelete: editingTeam ? () => handleDeleteTeam(editingTeam.id, null).then(() => setScreen(teamEditReturnScreen)) : undefined
  }))), screen === "match" && match && /*#__PURE__*/React.createElement(PrintReport, {
    match: match
  }), matchLoading && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(23,20,15,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
      animation: "cs-fadeIn 0.15s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      background: COLORS.surface,
      borderRadius: 16,
      padding: "24px 28px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.25)"
    }
  }, /*#__PURE__*/React.createElement(LoadingBallIllustration, {
    style: {
      margin: "0 auto 12px"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      color: COLORS.inkSoft,
      fontSize: 13
    }
  }, "Opening match\u2026"))), alertModal && /*#__PURE__*/React.createElement(AlertModal, {
    title: alertModal.title,
    message: alertModal.message,
    onClose: () => setAlertModal(null)
  }), TAB_BAR_SCREENS.includes(screen) && /*#__PURE__*/React.createElement(TabBar, {
    active: screen,
    onSelect: selectTab,
    homeBadgeCount: inboxBadgeCount
  }));
}
