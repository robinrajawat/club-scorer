import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { NavWrap } from "./screenAtoms.js";
import { LoadingBallIllustration } from "./illustrations.js";
import { WelcomeScreen } from "./welcomeScreen.js";
import { AuthActionScreen } from "./authActionScreen.js";
import { HomeScreen } from "./homeScreen.js";
import { FirstLaunchTour } from "./miscModals.js";
import { SetupScreen } from "./setupScreen.js";
import { MatchScreen } from "./matchScreen.js";
import { TeamsScreen } from "./teamsScreen.js";
import { TeamEditScreen } from "./teamEditScreen.js";
import { MyTeamsScreen } from "./myTeamsScreen.js";
import { AccountScreen } from "./accountScreen.js";
import { InboxScreen } from "./inboxScreen.js";
import { PlayersScreen } from "./playersScreen.js";
import { TournamentsScreen } from "./tournamentsScreen.js";
import { TournamentDetailScreen } from "./tournamentDetailScreen.js";
import { SeriesDetailScreen } from "./seriesDetailScreen.js";
import { RecordsScreen } from "./recordsScreen.js";
import { FollowScreen } from "./followScreen.js";
import { FollowTournamentScreen } from "./followTournamentScreen.js";
import { PollRespondScreen } from "./pollRespondScreen.js";
import { HelpScreen, AboutScreen, FeedbackScreen, SharedLinksScreen, BetaTestersScreen } from "./infoScreens.js";
import { FeedbackInboxScreen } from "./feedbackInboxScreen.js";
import { PrintReport } from "./scorecard.js";
import {
  isFeedbackAdmin, getAuthActionFromUrl, getFollowCodeFromUrl, getTournamentFollowCodeFromUrl,
  getPollCodeFromUrl, getShortcutActionFromUrl, accountExistsLinkInfo, genMatchCode, isClubOwner,
  isFederationOwner
} from "../core/miscHelpers.js";
import {
  hasSeenTour, loadThemePref, loadPinnedIds, savePinnedIds, applyTheme, saveThemePref, isIOSSafari,
  isStandalone, hasSeenInstallHint, markInstallHintSeen, DEFAULT_RULES
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
  match: 1,
  account: 1,
  follow: 1,
  "follow-tournament": 1,
  "poll-respond": 1,
  tournaments: 1,
  players: 1,
  "team-edit": 2,
  "shared-links": 2,
  "inbox": 1,
  "tournament-detail": 2
};


export function CricketScorer() {
  const initialAuthAction = useRef(getAuthActionFromUrl()).current;
  const initialFollowCode = useRef(getFollowCodeFromUrl()).current;
  const initialTournamentFollowCode = useRef(getTournamentFollowCodeFromUrl()).current;
  const initialPollCode = useRef(getPollCodeFromUrl()).current;
  const initialShortcutAction = useRef(getShortcutActionFromUrl()).current;
  const [screen, setScreenRaw] = useState(initialAuthAction ? "auth-action" : initialFollowCode ? "follow" : initialTournamentFollowCode ? "follow-tournament" : initialPollCode ? "poll-respond" : "login"); // home | login | setup | match | teams | team-edit | follow | follow-tournament | poll-respond | auth-action
  const [followCode, setFollowCode] = useState(initialFollowCode);
  // Set instead of followCode when FollowScreen is reached from the Home screen's "Live now" feed
  // (a tap, not a "?live=CODE" link) -- see openLiveMatch/handleOpenLiveMatch below. Exactly one of
  // followCode/followMatchId is ever set at a time; FollowScreen itself treats them as equivalent.
  const [followMatchId, setFollowMatchId] = useState(null);
  const [navDirection, setNavDirection] = useState("forward");
  const [matches, setMatches] = useState([]);
  const [match, setMatch] = useState(null);
  // Set only while openMatch's Firestore/localStorage read is in flight — a match can be sizeable
  // (a full ball-by-ball innings) and the fetch is a real network round trip, so on a slow
  // connection tapping a match previously just sat there with the list still showing and nothing
  // to indicate the tap registered. See the loading overlay near the end of this component's render.
  const [matchLoading, setMatchLoading] = useState(false);
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
  // Single "which club" selector for the Clubs tab -- used to be two separate ones (this one for
  // Teams' own roster-source selector, another for which club's admin panel is expanded) back
  // when Teams was its own tab with its own personal-vs-club choice. Now that personal teams live
  // on Home instead, there's only one remaining question ("which club am I looking at"), so the
  // two collapsed into this single selector.
  const [activeClubAdminId, setActiveClubAdminId] = useState(null);
  const [teamsTab, setTeamsTab] = useState("clubs"); // clubs | federations
  // Seeds the Help screen's own search box when someone taps a Help result from Home's global
  // search -- so the same query carries over instead of landing on an unfiltered FAQ list they'd
  // have to re-type into.
  const [helpInitialQuery, setHelpInitialQuery] = useState("");
  const [clubTeamsById, setClubTeamsById] = useState({}); // clubId -> team[]
  const [federationsById, setFederationsById] = useState({}); // federationId -> {id, name, ...}
  const [myFederationRequests, setMyFederationRequests] = useState([]); // federationRequests rows touching a club/federation I own or co-own
  const [myCoOwnerInvites, setMyCoOwnerInvites] = useState([]); // coOwnerInvites rows I sent (club/federation I own or co-own) or that are addressed to my own email
  const [myActivity, setMyActivity] = useState([]); // activity notification rows addressed to me -- see /activity in firestore.rules
  const [isProfilePublic, setIsProfilePublic] = useState(false); // whether I've published myself to /userDirectory -- see AccountScreen's "Discoverable for invites" toggle
  const [liveMatches, setLiveMatches] = useState([]); // Home screen's "Live now" feed -- every match currently in progress, from /liveMatches (see loadLiveMatches in index.html), unrelated to sign-in state
  const [pendingPollItems, setPendingPollItems] = useState([]); // active polls, across every team I have access to, still missing at least one response -- feeds both the Inbox screen and its badge count
  const [federationTeamOptions, setFederationTeamOptions] = useState([]); // teams visible via activeTournamentClubId's federations, excluding its own
  const [tournaments, setTournaments] = useState([]);
  const [clubTournamentsById, setClubTournamentsById] = useState({}); // clubId -> tournament[]
  const [activeTournamentClubId, setActiveTournamentClubId] = useState(null); // Tournaments screen's own source selector
  // Federation-hosted tournaments, keyed the same way as clubTournamentsById -- only for
  // federations this user owns/co-owns (myOwnedFederationIds, below), since that's the same set
  // that can actually create/manage a tournament under one. Read access is technically open to
  // any signed-in user (see the security rules), but the in-app navigation only surfaces
  // federations you run, same as how a club chip here means "you're at least a member," not
  // "anyone with the id could theoretically read this."
  const [federationTournamentsById, setFederationTournamentsById] = useState({}); // federationId -> tournament[]
  const [activeTournamentFederationId, setActiveTournamentFederationId] = useState(null); // Tournaments screen's source selector, federation variant -- at most one of this and activeTournamentClubId is ever non-null
  const [viewingTournament, setViewingTournament] = useState(null);
  const [viewingRecordsSource, setViewingRecordsSource] = useState(null); // { type, id, name } | null
  // Shared by the Record Book entry points on both TournamentsScreen (club/federation source
  // chips) and TeamsScreen (ClubPanel/FederationsPanel per-club, per-federation buttons) — same
  // destination screen either way, just a different jumping-off point.
  function handleOpenRecords(sourceType, sourceId, sourceName) {
    setViewingRecordsSource({
      type: sourceType,
      id: sourceId,
      name: sourceName
    });
    setScreen("records");
  }
  const [themePref, setThemePrefState] = useState(loadThemePref);
  const [pinnedClubIds, setPinnedClubIds] = useState(() => loadPinnedIds("pinned-clubs"));
  const [pinnedFederationIds, setPinnedFederationIds] = useState(() => loadPinnedIds("pinned-federations"));
  function handleTogglePinClub(clubId) {
    setPinnedClubIds(prev => {
      const next = prev.includes(clubId) ? prev.filter(id => id !== clubId) : [...prev, clubId];
      savePinnedIds("pinned-clubs", next);
      return next;
    });
  }
  function handleTogglePinFederation(federationId) {
    setPinnedFederationIds(prev => {
      const next = prev.includes(federationId) ? prev.filter(id => id !== federationId) : [...prev, federationId];
      savePinnedIds("pinned-federations", next);
      return next;
    });
  }
  const [showTour, setShowTour] = useState(() => !hasSeenTour());
  // Only ever true for iOS Safari, not already installed, and not yet dismissed on this device
  // (see isIOSSafari/isStandalone/hasSeenInstallHint) -- gated separately from showTour below (in
  // the render condition, not here) so the two never show at once and compete for a first-time
  // visitor's attention.
  const [showInstallHint, setShowInstallHint] = useState(() => isIOSSafari() && !isStandalone() && !hasSeenInstallHint());
  const [viewingTournamentClubId, setViewingTournamentClubId] = useState(null); // which source viewingTournament came from
  const [viewingTournamentFederationId, setViewingTournamentFederationId] = useState(null); // federation variant of the above -- at most one of this and viewingTournamentClubId is ever non-null
  const [presetTournament, setPresetTournament] = useState(null); // tournament to tag onto the next match created via Setup
  // Set when Home's Players-tab search result is tapped directly, so PlayersScreen opens straight
  // to that player's detail instead of its own list view. Cleared on the way back to Home so a
  // later, unrelated entry into the players screen doesn't reopen a stale profile.
  const [playersInitialSelected, setPlayersInitialSelected] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null); // null = new team
  // Prefills a new team's name/roster when team-edit is opened via "Create team" from a Player
  // Pool group (see handleCreateTeamFromPool) instead of the usual empty new-team state. Cleared
  // after save and by every other route into team-edit, so a stale seed never leaks into an
  // unrelated "New Team" tap afterward.
  const [presetTeamSeed, setPresetTeamSeed] = useState(null);
  // Which screen to return to after saving/cancelling out of team-edit -- entering from Home
  // (a personal team) should land back on Home, entering from the Teams tab (personal or a
  // club's own team) should land back there, same as it always did.
  const [teamEditReturnScreen, setTeamEditReturnScreen] = useState("teams");
  // Same idea as teamEditReturnScreen, for tournament-detail/series-detail/records -- opening a
  // tournament from My Tournaments (personal) should return there on Back, opening one from Cups
  // (a club/federation) should return to Cups, same as it always did.
  const [tournamentDetailReturnScreen, setTournamentDetailReturnScreen] = useState("tournaments");
  const [loading, setLoading] = useState(!initialFollowCode && !initialTournamentFollowCode);
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
  // This account's own published player profile, if any club has ever published one at this
  // exact email (see publishPlayer/linkPlayerIfMatch) -- fetched by a direct doc lookup on the
  // signed-in person's own email (the doc id itself), not a query, so it works whether or not the
  // player is marked public. Surfaced on the Account screen; view-only there, since editing name/
  // age/role/hand is deliberately the home club's alone (see the players/{email} update rule) --
  // this account being the PERSON the profile describes doesn't grant edit rights to it, only
  // linkedUid (set once, automatically, on first sign-in after a matching email is published).
  const [myPlayer, setMyPlayer] = useState(null);
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
    return loadLiveMatches(setLiveMatches);
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
  // Owner/co-owner-of ids feed both the federationRequests query below and the notification
  // badge — memoized as plain values (not useMemo) since `clubs`/`federationsById` already only
  // change on an actual data refresh.
  const myOwnedClubIds = clubs.filter(c => isClubOwner(c, user && user.uid)).map(c => c.id);
  const myOwnedFederationIds = Object.values(federationsById).filter(f => f && user && (f.createdBy === user.uid || (f.coOwnerUids || []).includes(user.uid))).map(f => f.id);
  async function refreshMyFederationRequests() {
    const rows = await loadMyFederationRequests();
    setMyFederationRequests(rows);
  }
  // Feeds the Inbox screen's requests section, and half of its combined badge count (see
  // pendingPollItems below for the other half). Unlike before, doesn't depend on
  // myOwnedClubIds/myOwnedFederationIds -- loadMyFederationRequests now queries by fromUid/
  // toOwnerUids on the request itself (see its comment), not by which entities I currently own.
  useEffect(() => {
    if (!user) {
      setMyFederationRequests([]);
      return;
    }
    refreshMyFederationRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  async function refreshMyCoOwnerInvites() {
    const rows = await loadMyCoOwnerInvites();
    setMyCoOwnerInvites(rows);
  }
  // Feeds the Inbox screen's co-owner-invites section and the other half of its badge count,
  // alongside federationRequestsNeedingAction below. Unlike the federationRequests effect above,
  // this doesn't depend on myOwnedClubIds/myOwnedFederationIds at all — loadMyCoOwnerInvites now
  // queries by my own uid/email only (see its comment), not by which entities I own.
  useEffect(() => {
    if (!user) {
      setMyCoOwnerInvites([]);
      return;
    }
    refreshMyCoOwnerInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
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
  // Loads whether I've already published myself to /userDirectory -- feeds AccountScreen's toggle
  // state on mount, same "queries by my own uid" shape as the coOwnerInvites/activity effects
  // above.
  useEffect(() => {
    if (!user) {
      setIsProfilePublic(false);
      return;
    }
    loadMyProfileVisibility().then(setIsProfilePublic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  async function handleSetProfileVisibility(isPublic) {
    const result = await setMyProfileVisibility(isPublic);
    if (result.ok) setIsProfilePublic(isPublic);
    return result;
  }
  // A request "needs my attention" if: it's pending and I'm the receiving side, or it's an
  // accepted club_to_federation request and I'm the requesting club's owner (I still need to
  // finish the join — see completeAcceptedFederationRequest).
  const federationRequestsNeedingAction = myFederationRequests.filter(r => {
    if (r.direction === "club_to_federation") {
      if (r.status === "pending") return myOwnedFederationIds.includes(r.federationId);
      if (r.status === "accepted") return myOwnedClubIds.includes(r.clubId);
      return false;
    }
    if (r.direction === "federation_to_club") {
      return r.status === "pending" && myOwnedClubIds.includes(r.clubId);
    }
    return false;
  });
  // A co-owner invite "needs my attention" only on the recipient side -- a still-pending invite
  // addressed to my own signed-in email. An outgoing one I sent needs no action from me until
  // someone else responds, same asymmetry as federationRequestsNeedingAction above.
  const myEmailLower = (user && user.email || "").toLowerCase();
  const coOwnerInvitesNeedingAction = myCoOwnerInvites.filter(inv => inv.status === "pending" && inv.email === myEmailLower);
  // Activity notifications never require an action the way an invite/request does -- they're
  // informational -- so "needs my attention" here just means unread.
  const unreadActivityCount = myActivity.filter(item => !item.read).length;
  async function refreshPendingPollItems() {
    const items = await loadPendingPollItems(clubs, clubTeamsById);
    setPendingPollItems(items);
  }
  // Reloads whenever clubs/teams change (sign-in, team roster edits, a new poll sent) — feeds the
  // Inbox screen's polls section, and the other half of its combined badge count alongside
  // federationRequestsNeedingAction above.
  useEffect(() => {
    if (!user || clubs.length === 0) {
      setPendingPollItems([]);
      return;
    }
    refreshPendingPollItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, clubs, clubTeamsById]);
  // Loads tournaments for every federation this user owns/co-owns -- same trigger condition as
  // the federationRequests effect just above (the ownership set changing). Only fetches ids not
  // already in federationTournamentsById, so re-renders and screen switches don't refetch
  // everything that's already loaded.
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
  // Whenever the Tournaments screen's active club (or that club's federation affiliations)
  // changes, refresh the read-only cross-club team directory it can offer alongside the club's
  // own roster. Excludes the active club's own entries since those already come from teamOptions.
  // A federation-scoped tournament is different -- a federation owns no teams of its own, so
  // there's no "own roster" to exclude; this just loads that one federation's whole directory
  // directly, unfiltered, since every entry in it is a legitimate pick for a federation-hosted
  // tournament (see teamOptions/federationTeamOptions on the TournamentsScreen prop below, which
  // is why teamOptions is empty and federationTeamOptions carries everything in that case).
  useEffect(() => {
    let cancelled = false;
    if (activeTournamentFederationId) {
      loadFederationTeams(activeTournamentFederationId).then(list => {
        if (cancelled) return;
        setFederationTeamOptions(list);
      });
      return () => {
        cancelled = true;
      };
    }
    const club = clubs.find(c => c.id === activeTournamentClubId);
    const fedIds = club ? club.federationIds || [] : [];
    if (fedIds.length === 0) {
      setFederationTeamOptions([]);
      return;
    }
    Promise.all(fedIds.map(loadFederationTeams)).then(lists => {
      if (cancelled) return;
      const seen = new Set();
      const deduped = lists.flat().filter(t => {
        if (t.clubId === activeTournamentClubId) return false;
        const key = `${t.clubId}_${t.teamId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setFederationTeamOptions(deduped);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTournamentClubId, activeTournamentFederationId, clubs]);
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
        setActiveClubAdminId(null); // clubs are signed-in-only; drop out of one if signing out
        setActiveTournamentClubId(null);
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
      // Courtesy auto-link, not something worth blocking or surfacing errors for — see
      // linkPlayerIfMatch's own comment for exactly what it will and won't touch. Chained (not
      // fired in parallel) so loadMyPlayerProfile picks up a just-completed auto-link instead of
      // racing it.
      if (u && u.email) {
        linkPlayerIfMatch(u.uid, u.email, u.photoURL).catch(() => {}).then(() => loadMyPlayerProfile(u.email)).then(setMyPlayer);
      } else {
        setMyPlayer(null);
      }
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
  // Once someone signs in from the welcome screen (or already had a session restored), move
  // straight past it into Home rather than leaving them stuck looking at a sign-in button. If the
  // app was opened via the "New match" home-screen shortcut, land straight on Setup instead —
  // same destination as tapping Home's own "New" button, just skipping the extra tap for the
  // exact case that shortcut exists for. Only ever fires once: initialShortcutAction is a ref
  // (frozen at mount from the URL), not state, so it can't re-trigger on a later sign-out/in.
  useEffect(() => {
    if (user && screen === "login") {
      setScreen(initialShortcutAction === "new-match" ? "setup" : "home");
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
    setActiveClubAdminId(null);
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
      teamAKeeper: setup.teamAKeeper || "",
      teamAColor: setup.teamAColor || null,
      teamBCaptain: setup.teamBCaptain || "",
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
    }
  }
  async function openMatch(id) {
    setMatchLoading(true);
    try {
      const m = await loadMatch(id);
      if (m) {
        setMatch(m);
        setScreen("match");
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
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* noop — worst case the param stays in the address bar */
    }
    setFollowCode(null);
    setFollowMatchId(null);
    setScreen("home");
  }
  // Tapping a card in the Home screen's "Live now" feed -- same destination screen as a "?live="
  // link (exitFollow above clears both, so either path leaves cleanly), just reached by matchId
  // instead of a code, with no URL param to set since this was never a link someone navigated to.
  function openLiveMatch(id) {
    setFollowMatchId(id);
    setScreen("follow");
  }
  function exitFollowTournament() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tournament");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* noop — worst case the param stays in the address bar */
    }
    setScreen("home");
  }
  function exitPoll() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("poll");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* noop — worst case the param stays in the address bar */
    }
    setScreen("home");
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
        case "poll-respond":
          return exitPoll;
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
  // Opened from a Player Pool group in TeamsScreen ("Create team" next to a team tag like "U15")
  // -- jumps straight into team-edit for a brand-new team pre-filled with that tag's name and
  // everyone in it, instead of the usual empty roster. clubId comes from the caller (always the
  // pool's own club) rather than ambient activeClubAdminId, same reasoning as handleSaveTeam
  // above.
  function handleCreateTeamFromPool(clubId, tagName, poolPlayers) {
    setActiveClubAdminId(clubId);
    setEditingTeam(null);
    setPresetTeamSeed({
      name: tagName,
      players: poolPlayers
    });
    setTeamEditReturnScreen("teams");
    setScreen("team-edit");
  }
  // clubId is passed explicitly (rather than read from ambient activeClubId) so this is correct
  // no matter where it's called from -- the Teams tab passes its own activeClubId, Home always
  // passes null (personal). Relying on ambient state here would silently misfile a save under
  // whatever club happened to be last selected elsewhere in the app.
  async function handleSaveTeam(team, clubId) {
    if (clubId) {
      const result = await saveClubTeam(clubId, team);
      if (result.ok) {
        setClubTeamsById(prev => ({
          ...prev,
          [clubId]: [...(prev[clubId] || []).filter(t => t.id !== team.id), team].sort((a, b) => a.name.localeCompare(b.name))
        }));
      }
    } else {
      const updated = teams.filter(t => t.id !== team.id);
      updated.push(team);
      updated.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(updated);
      await saveTeams(updated);
    }
    setScreen(teamEditReturnScreen);
    setEditingTeam(null);
    setPresetTeamSeed(null);
  }
  async function handleDeleteTeam(id, clubId) {
    if (clubId) {
      await deleteClubTeam(clubId, id);
      setClubTeamsById(prev => ({
        ...prev,
        [clubId]: (prev[clubId] || []).filter(t => t.id !== id)
      }));
    } else {
      const updated = teams.filter(t => t.id !== id);
      setTeams(updated);
      await saveTeams(updated);
    }
  }
  async function handleCreateClub(name) {
    const result = await createClub(name);
    if (result.ok) {
      setClubs(cs => [...cs, result.club]);
      setClubTeamsById(prev => ({
        ...prev,
        [result.club.id]: []
      }));
    }
    return result;
  }
  // Beta tools (see AccountScreen): generate/wipe a realistic set of clubs (one per country,
  // named after its board), teams, players, and a shared federation, so beta testers have
  // something to try new features against right away. refreshClubs() re-syncs
  // clubTeamsById/federationsById after either call, since both add or remove clubs and teams.
  async function handleGenerateDummyData() {
    const result = await generateDummyData();
    await refreshClubs(); // even a partial/failed run may have created clubs worth showing
    return result;
  }
  async function handleWipeDummyData() {
    const result = await wipeDummyData();
    await refreshClubs();
    return result;
  }
  function mirrorPendingInvite(setClubsOrFeds, id, code, entry) {
    setClubsOrFeds(prev => prev.map ? prev.map(c => c.id === id ? {
      ...c,
      pendingInvites: { ...(c.pendingInvites || {}),
        [code]: entry
      }
    } : c) : { ...prev,
      [id]: { ...(prev[id] || {}),
        pendingInvites: { ...((prev[id] || {}).pendingInvites || {}),
          [code]: entry
        }
      }
    });
  }
  // Sends a member invite -- unified with co-owner invites (same coOwnerInvites doc shape, role:
  // "member" instead of "coOwner"; see inviteCoOwner in index.html), so a member invite no longer
  // mints a bearer code to copy and send out-of-band: it shows up in the recipient's Inbox
  // automatically, the same as a co-owner invite. Appends locally for the same reason
  // handleInviteCoOwner below does -- shows up in the sender's own pending-invites list
  // immediately, without waiting on the next refreshMyCoOwnerInvites().
  async function handleInviteClubMember(clubId, email) {
    const result = await inviteCoOwner("club", clubId, email, "member");
    if (result.ok) {
      setMyCoOwnerInvites(prev => [...prev, result.invite]);
    }
    return result;
  }
  // Unified co-owner invite for both clubs and federations -- see inviteCoOwner in index.html.
  // Appends the new invite locally so it shows up in the sender's own "pending co-owner invites"
  // list immediately, without waiting on the next refreshMyCoOwnerInvites().
  async function handleInviteCoOwner(scope, entityId, email) {
    const result = await inviteCoOwner(scope, entityId, email);
    if (result.ok) {
      setMyCoOwnerInvites(prev => [...prev, result.invite]);
    }
    return result;
  }
  // Recipient accepting/declining a co-owner or member invite -- see respondCoOwnerInvite in
  // index.html. On accept, mirrors the resulting grant onto local clubs/federationsById state so
  // it shows up without waiting for a full refreshClubs().
  //
  // BUG FIX: this used to patch the club/federation already in local state via
  // cs.map(c => c.id === result.entityId ? {...} : c) -- a no-op for the common case of accepting
  // an invite to somewhere you had NO prior access to (the whole point of an invite), since
  // .map() only updates an element that's already present, it never adds a new one. The club (or
  // federation) -- and, for a club, its teams, since nothing ever called loadClubTeams for an id
  // that was never in clubTeamsById -- would silently stay invisible for the rest of the session,
  // fixed only by a full reload (which reruns refreshClubs() from scratch and picks it up
  // correctly, since the underlying Firestore write was always correct -- this was purely a local
  // state bug). Fixed by using the real, freshly-fetched entity respondCoOwnerInvite now returns
  // (result.entity) and inserting/replacing it wholesale, the same "filter out any stale copy,
  // concat the real one" shape handleJoinClub already uses correctly for the equivalent
  // code-based join -- plus loading its teams explicitly, same as that function does too.
  async function handleRespondCoOwnerInvite(inviteId, accept) {
    const result = await respondCoOwnerInvite(inviteId, accept);
    if (result.ok && accept && result.entity) {
      if (result.scope === "club") {
        setClubs(cs => [...cs.filter(c => c.id !== result.entityId), result.entity]);
        const teamList = await loadClubTeams(result.entityId);
        setClubTeamsById(prev => ({ ...prev,
          [result.entityId]: teamList
        }));
      } else if (result.scope === "federation") {
        setFederationsById(prev => ({ ...prev,
          [result.entityId]: result.entity
        }));
      }
    }
    if (result.ok) {
      setMyCoOwnerInvites(prev => prev.map(inv => inv.id === inviteId ? {
        ...inv,
        status: accept ? "accepted" : "declined"
      } : inv));
    }
    return result;
  }
  async function handleCancelCoOwnerInvite(inviteId) {
    const result = await cancelCoOwnerInvite(inviteId);
    if (result.ok) {
      setMyCoOwnerInvites(prev => prev.map(inv => inv.id === inviteId ? {
        ...inv,
        status: "cancelled"
      } : inv));
    }
    return result;
  }
  async function handleDeleteCoOwnerInvite(inviteId) {
    const result = await deleteCoOwnerInvite(inviteId);
    if (result.ok) {
      setMyCoOwnerInvites(prev => prev.filter(inv => inv.id !== inviteId));
    }
    return result;
  }
  async function handleRevokeClubInvite(clubId, code) {
    const result = await revokeClubInvite(clubId, code);
    if (result.ok) {
      setClubs(cs => cs.map(c => {
        if (c.id !== clubId) return c;
        const pendingInvites = { ...(c.pendingInvites || {})
        };
        delete pendingInvites[code];
        return { ...c,
          pendingInvites
        };
      }));
    }
    return result;
  }
  async function handleJoinClub(code) {
    const result = await joinClubWithCode(code);
    if (result.ok) {
      setClubs(cs => [...cs.filter(c => c.id !== result.club.id), result.club]);
      const teamList = await loadClubTeams(result.club.id);
      setClubTeamsById(prev => ({
        ...prev,
        [result.club.id]: teamList
      }));
    }
    return result;
  }
  async function handleLeaveClub(clubId) {
    await leaveClub(clubId);
    setClubs(cs => cs.filter(c => c.id !== clubId));
    setClubTeamsById(prev => {
      const next = { ...prev
      };
      delete next[clubId];
      return next;
    });
    if (activeClubAdminId === clubId) setActiveClubAdminId(null);
  }
  async function handleDeleteClub(clubId) {
    const result = await deleteClub(clubId);
    if (result.ok) {
      setClubs(cs => cs.filter(c => c.id !== clubId));
      setClubTeamsById(prev => {
        const next = { ...prev
        };
        delete next[clubId];
        return next;
      });
      if (activeClubAdminId === clubId) setActiveClubAdminId(null);
    }
    return result;
  }
  async function handleRenameClub(clubId, name) {
    const trimmed = (name || "").trim();
    const result = await renameClub(clubId, trimmed);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        name: trimmed
      } : c));
    }
    return result;
  }
  async function handleUpdateClubDescription(clubId, description) {
    const trimmed = (description || "").trim();
    const result = await updateClubDescription(clubId, trimmed);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        description: trimmed
      } : c));
    }
    return result;
  }
  async function handleUpdateClubAddress(clubId, address, lat, lng) {
    const trimmed = (address || "").trim();
    const result = await updateClubAddress(clubId, trimmed, lat, lng);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        address: trimmed,
        addressLat: lat != null ? lat : null,
        addressLng: lng != null ? lng : null
      } : c));
    }
    return result;
  }
  async function handleUploadClubLogo(clubId, file) {
    const result = await uploadClubLogo(clubId, file);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        logoURL: result.logoURL
      } : c));
    }
    return result;
  }
  async function handleRemoveClubLogo(clubId) {
    const result = await removeClubLogo(clubId);
    if (result.ok) {
      setClubs(cs => cs.map(c => {
        if (c.id !== clubId) return c;
        const next = {
          ...c
        };
        delete next.logoURL;
        return next;
      }));
    }
    return result;
  }
  async function handleAddUmpire(clubId, name) {
    const trimmed = (name || "").trim();
    const result = await addClubUmpire(clubId, trimmed);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        // arrayUnion already de-duped on the Firestore side; mirror that here too, or adding the
        // same name twice would show a local-only duplicate until the next real fetch.
        umpires: (c.umpires || []).includes(trimmed) ? c.umpires : [...(c.umpires || []), trimmed]
      } : c));
    }
    return result;
  }
  async function handleRemoveUmpire(clubId, name) {
    const result = await removeClubUmpire(clubId, name);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        umpires: (c.umpires || []).filter(u => u !== name)
      } : c));
    }
    return result;
  }
  async function handleAddPoolPlayers(clubId, players) {
    const result = await addPoolPlayers(clubId, players);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        // Mirror arrayUnion's own de-dup here too (same reasoning as handleAddUmpire above), so
        // re-submitting an unchanged bulk paste doesn't show local-only duplicates.
        playerPool: [...(c.playerPool || []), ...result.added.filter(p => !(c.playerPool || []).some(x => x.id === p.id))]
      } : c));
    }
    return result;
  }
  async function handleUpdatePoolPlayer(clubId, playerId, updates) {
    const result = await updatePoolPlayer(clubId, playerId, updates);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        playerPool: (c.playerPool || []).map(p => p.id === playerId ? {
          ...p,
          ...updates
        } : p)
      } : c));
    }
    return result;
  }
  async function handleRemovePoolPlayer(clubId, playerId) {
    const result = await removePoolPlayer(clubId, playerId);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        playerPool: (c.playerPool || []).filter(p => p.id !== playerId)
      } : c));
    }
    return result;
  }
  async function handleCreateFederation(name) {
    const result = await createFederation(name);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [result.federation.id]: result.federation
      }));
    }
    return result;
  }
  async function handleJoinFederation(clubId, code) {
    const result = await joinFederationWithCode(clubId, code);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [result.federation.id]: result.federation
      }));
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        federationIds: [...(c.federationIds || []).filter(id => id !== result.federation.id), result.federation.id]
      } : c));
    }
    return result;
  }
  async function handleLeaveFederation(clubId, federationId) {
    const result = await leaveFederation(clubId, federationId);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        federationIds: (c.federationIds || []).filter(id => id !== federationId)
      } : c));
    }
    return result;
  }
  async function handleSetClubVisibility(clubId, isPublic) {
    const result = await setClubVisibility(clubId, isPublic);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        visibility: isPublic ? "public" : "private"
      } : c));
    }
    return result;
  }
  async function handleSetFederationVisibility(federationId, isPublic) {
    const result = await setFederationVisibility(federationId, isPublic);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [federationId]: { ...(prev[federationId] || {}),
          visibility: isPublic ? "public" : "private"
        }
      }));
    }
    return result;
  }
  async function handleRequestFederationAffiliation(direction, clubId, federationId) {
    const result = await requestFederationAffiliation(direction, clubId, federationId);
    if (result.ok) refreshMyFederationRequests();
    return result;
  }
  async function handleRespondFederationRequest(requestId, accept) {
    const result = await respondFederationRequest(requestId, accept);
    if (result.ok) {
      if (accept && result.clubId && result.federationId) {
        // federation_to_club acceptance already wrote federationIds server-side above — mirror
        // that locally so it shows up without waiting for the next full refreshClubs().
        setClubs(cs => cs.map(c => c.id === result.clubId ? {
          ...c,
          federationIds: [...(c.federationIds || []).filter(id => id !== result.federationId), result.federationId]
        } : c));
      }
      refreshMyFederationRequests();
    }
    return result;
  }
  async function handleCancelFederationRequest(requestId) {
    const result = await cancelFederationRequest(requestId);
    if (result.ok) refreshMyFederationRequests();
    return result;
  }
  async function handleCompleteAcceptedFederationRequest(requestId, clubId, federationId) {
    const result = await completeAcceptedFederationRequest(requestId, clubId, federationId);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        federationIds: [...(c.federationIds || []).filter(id => id !== federationId), federationId]
      } : c));
      refreshMyFederationRequests();
    }
    return result;
  }
  async function handleRemoveMember(clubId, uid) {
    const result = await removeClubMember(clubId, uid);
    if (result.ok) {
      setClubs(cs => cs.map(c => {
        if (c.id !== clubId) return c;
        const memberNames = { ...(c.memberNames || {})
        };
        delete memberNames[uid];
        return {
          ...c,
          memberUids: (c.memberUids || []).filter(u => u !== uid),
          coOwnerUids: (c.coOwnerUids || []).filter(u => u !== uid),
          memberNames
        };
      }));
    }
    return result;
  }
  async function handleRefreshMyMemberName(clubId) {
    const name = await refreshMyMemberName(clubId);
    if (name && user) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        memberNames: { ...(c.memberNames || {}),
          [user.uid]: name
        }
      } : c));
    }
  }
  async function handleRemoveClubCoOwner(clubId, uid) {
    const result = await removeClubCoOwner(clubId, uid);
    if (result.ok) {
      setClubs(cs => cs.map(c => c.id === clubId ? {
        ...c,
        coOwnerUids: (c.coOwnerUids || []).filter(u => u !== uid)
      } : c));
    }
    return result;
  }
  async function handleRenameFederation(federationId, name) {
    const trimmed = (name || "").trim();
    const result = await renameFederation(federationId, trimmed);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [federationId]: { ...(prev[federationId] || {}),
          name: trimmed
        }
      }));
    }
    return result;
  }
  async function handleUpdateFederationDescription(federationId, description) {
    const trimmed = (description || "").trim();
    const result = await updateFederationDescription(federationId, trimmed);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [federationId]: { ...(prev[federationId] || {}),
          description: trimmed
        }
      }));
    }
    return result;
  }
  async function handleInviteFederation(federationId, email) {
    const result = await inviteFederationByEmail(federationId, email);
    if (result.ok) {
      mirrorPendingInvite(setFederationsById, federationId, result.code, {
        kind: "club",
        email: email.trim().toLowerCase(),
        createdAt: result.createdAt
      });
    }
    return result;
  }
  async function handleRemoveFederationCoOwner(federationId, uid) {
    const result = await removeFederationCoOwner(federationId, uid);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [federationId]: { ...(prev[federationId] || {}),
          coOwnerUids: ((prev[federationId] || {}).coOwnerUids || []).filter(u => u !== uid)
        }
      }));
    }
    return result;
  }
  async function handleKickClubFromFederation(federationId, clubId) {
    const result = await kickClubFromFederation(federationId, clubId);
    if (result.ok) {
      setFederationsById(prev => ({
        ...prev,
        [federationId]: { ...(prev[federationId] || {}),
          kickedClubIds: [...((prev[federationId] || {}).kickedClubIds || []).filter(id => id !== clubId), clubId],
          affiliatedClubIds: ((prev[federationId] || {}).affiliatedClubIds || []).filter(id => id !== clubId)
        }
      }));
    }
    return result;
  }
  // Only reachable once a federation has no affiliated clubs left (see FederationsPanel, which
  // hides the button otherwise, and firestore.rules, which enforces it regardless).
  async function handleDeleteFederation(federationId) {
    const result = await deleteFederation(federationId);
    if (result.ok) {
      setFederationsById(prev => {
        const next = { ...prev };
        delete next[federationId];
        return next;
      });
    }
    return result;
  }
  // "My Tournaments" (no specific club/federation chip selected) shows a merged view — personal
  // tournaments plus every club's and every owned federation's, each tagged with its source (see
  // the club/federation name caption in TournamentsScreen) — rather than requiring a separate
  // click per source to find one. Picking a specific chip still narrows down to just that one
  // source's list. Only one of activeTournamentClubId/activeTournamentFederationId is ever
  // non-null at a time (the source-selector UI enforces that), so these two branches can never
  // both apply.
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
  const activeTournaments = activeTournamentClubId ? clubTournamentsById[activeTournamentClubId] || [] : activeTournamentFederationId ? federationTournamentsById[activeTournamentFederationId] || [] : allTournamentsFlat;
  async function handleCreateTournament(name, teamNames, groups, advancePerGroup, defaultOvers, defaultRules, venueInfo) {
    const t = {
      id: uid(),
      name,
      teams: teamNames,
      groups: groups || null,
      advancePerGroup: groups ? advancePerGroup || 2 : null,
      defaultOvers: defaultOvers || null,
      defaultRules: defaultRules || null,
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
    if (activeTournamentFederationId) {
      const result = await saveFederationTournament(activeTournamentFederationId, t);
      if (result.ok) {
        setFederationTournamentsById(prev => ({
          ...prev,
          [activeTournamentFederationId]: [...(prev[activeTournamentFederationId] || []), t]
        }));
      }
      return {
        ...result,
        tournament: t
      };
    }
    if (activeTournamentClubId) {
      const result = await saveClubTournament(activeTournamentClubId, t);
      if (result.ok) {
        setClubTournamentsById(prev => ({
          ...prev,
          [activeTournamentClubId]: [...(prev[activeTournamentClubId] || []), t]
        }));
      }
      return {
        ...result,
        tournament: t
      };
    }
    const updated = [...tournaments, t];
    setTournaments(updated);
    await saveTournaments(updated);
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
    if (activeTournamentFederationId) {
      const result = await saveFederationTournament(activeTournamentFederationId, t);
      if (result.ok) {
        setFederationTournamentsById(prev => ({
          ...prev,
          [activeTournamentFederationId]: [...(prev[activeTournamentFederationId] || []), t]
        }));
      }
      return {
        ...result,
        tournament: t
      };
    }
    if (activeTournamentClubId) {
      const result = await saveClubTournament(activeTournamentClubId, t);
      if (result.ok) {
        setClubTournamentsById(prev => ({
          ...prev,
          [activeTournamentClubId]: [...(prev[activeTournamentClubId] || []), t]
        }));
      }
      return {
        ...result,
        tournament: t
      };
    }
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
  async function handleUpdateTournament(updated) {
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
      }
      return result;
    }
    const updatedList = tournaments.map(t => t.id === updated.id ? updated : t);
    setTournaments(updatedList);
    await saveTournaments(updatedList);
    setViewingTournament(updated);
    return {
      ok: true
    };
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
  // Merged Teams view (mirrors allTournamentsFlat below): personal teams plus every club's,
  // each tagged with its source, so the Teams screen can show one combined list by default with
  // "My Teams"/per-club chips narrowing it down, the same pattern Cups already uses.
  const allTeamsFlat = [...teams.map(t => ({ ...t,
    _clubId: null
  })), ...Object.entries(clubTeamsById).flatMap(([cid, list]) => (list || []).map(t => ({ ...t,
    _clubId: cid
  })))].sort((a, b) => a.name.localeCompare(b.name));
  const teamsForTeamsScreen = activeClubAdminId ? (clubTeamsById[activeClubAdminId] || []).map(t => ({ ...t,
    _clubId: activeClubAdminId
  })) : allTeamsFlat;
  // Copies a team into the destination first, then deletes it from the source — so a failed or
  // denied destination write (e.g. rules not yet published) never loses the team.
  // fromClubId is passed explicitly for the same reason clubId is on handleSaveTeam/
  // handleDeleteTeam above -- reading ambient activeClubId here would silently assume the team
  // being moved came from wherever activeClubId currently happens to point, which is wrong (and
  // effectively duplicates the team without ever removing the original) the moment this is
  // called from anywhere that isn't the Teams tab, e.g. Home's own team list.
  async function handleMoveTeam(team, fromClubId, toClubId) {
    if (toClubId === fromClubId) return;
    if (toClubId) {
      const result = await saveClubTeam(toClubId, team);
      if (!result.ok) {
        alert(result.error || "Couldn't move the team.");
        return;
      }
      setClubTeamsById(prev => ({
        ...prev,
        [toClubId]: [...(prev[toClubId] || []).filter(t => t.id !== team.id), team].sort((a, b) => a.name.localeCompare(b.name))
      }));
    } else {
      const updated = [...teams.filter(t => t.id !== team.id), team].sort((a, b) => a.name.localeCompare(b.name));
      setTeams(updated);
      await saveTeams(updated);
    }
    if (fromClubId) {
      await deleteClubTeam(fromClubId, team.id);
      setClubTeamsById(prev => ({
        ...prev,
        [fromClubId]: (prev[fromClubId] || []).filter(t => t.id !== team.id)
      }));
    } else {
      const updated = teams.filter(t => t.id !== team.id);
      setTeams(updated);
      await saveTeams(updated);
    }
  }
  const tournamentNameById = {};
  for (const t of tournaments) tournamentNameById[t.id] = t.name;
  for (const list of Object.values(clubTournamentsById)) {
    for (const t of list) tournamentNameById[t.id] = t.name;
  }
  for (const list of Object.values(federationTournamentsById)) {
    for (const t of list) tournamentNameById[t.id] = t.name;
  }
  const wrapStyle = {
    minHeight: "100vh",
    background: COLORS.cream,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,36,32,0.045) 28px)",
    WebkitTextSizeAdjust: "100%",
    touchAction: "manipulation"
  };
  if (loading || !authChecked && !initialFollowCode && !initialTournamentFollowCode) {
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
    onSkip: () => setScreen(initialShortcutAction === "new-match" ? "setup" : "home")
  })), screen === "home" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "home",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(HomeScreen, {
    matches: matches,
    onNew: () => setScreen("setup"),
    onOpen: openMatch,
    onDelete: handleDelete,
    onManageTeams: () => {
      setActiveClubAdminId(null);
      setScreen("my-teams");
    },
    onOpenClubs: () => setScreen("teams"),
    onOpenClub: clubId => {
      setActiveClubAdminId(clubId);
      setTeamsTab("clubs");
      setScreen("teams");
    },
    onOpenFederation: () => {
      setActiveClubAdminId(null);
      setTeamsTab("federations");
      setScreen("teams");
    },
    user: user,
    profile: profile,
    isProfilePublic: isProfilePublic,
    onOpenAccount: () => setScreen("account"),
    onOpenInbox: () => setScreen("inbox"),
    onOpenSharedLinks: () => setScreen("shared-links"),
    onOpenHelp: (q) => {
      setHelpInitialQuery(q || "");
      setScreen("help");
    },
    onOpenFeedback: () => setScreen("feedback"),
    onOpenAbout: () => setScreen("about"),
    onSignOut: signOutUser,
    themePref: themePref,
    onSetTheme: handleSetTheme,
    onJoinCode: handleJoinCode,
    onOpenTournaments: () => {
      setActiveTournamentClubId(null);
      setActiveTournamentFederationId(null);
      setScreen("tournaments");
    },
    onOpenPlayer: player => {
      setPlayersInitialSelected(player);
      setScreen("players");
    },
    onLoadPublicPlayers: loadPublicPlayers,
    pendingCount: pendingCount,
    onPendingSynced: refreshPendingCount,
    inboxBadgeCount: federationRequestsNeedingAction.length + coOwnerInvitesNeedingAction.length + pendingPollItems.length + unreadActivityCount,
    tournamentNameById: tournamentNameById,
    tournaments: allTournamentsFlat,
    onOpenTournament: t => {
      setViewingTournament(t);
      setViewingTournamentClubId(t._clubId || null);
      setViewingTournamentFederationId(t._federationId || null);
      setTournamentDetailReturnScreen("home");
      setScreen(t.kind === "series" ? "series-detail" : "tournament-detail");
    },
    onScheduleFixture: handleScheduleFixtureFromHome,
    onStartFixture: handleStartFixtureMatch,
    onEditVenue: handleEditVenueFromHome,
    clubs: clubs,
    federationsById: federationsById,
    clubTeamsById: clubTeamsById,
    teams: allTeamsFlat,
    onOpenTeam: t => {
      setActiveClubAdminId(t._clubId || null);
      setScreen("my-teams");
    },
    onGetShareCode: handleGetShareCodeForMatch,
    onGetViewCode: handleGetViewCodeForMatch,
    liveMatches: liveMatches,
    onOpenLiveMatch: openLiveMatch,
    showInstallHint: showInstallHint && !showTour,
    onDismissInstallHint: () => {
      setShowInstallHint(false);
      markInstallHintSeen();
    }
  })), showTour && screen === "home" && /*#__PURE__*/React.createElement(FirstLaunchTour, {
    onDone: () => setShowTour(false)
  }), screen === "setup" && /*#__PURE__*/React.createElement(NavWrap, {
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
    clubUmpires: (activeClubAdminId && (clubs.find(c => c.id === activeClubAdminId) || {}).umpires) || [],
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
    teams: teamsForTeamsScreen,
    teamsLoading: teamsLoading,
    matches: matches,
    clubs: clubs,
    activeClubId: activeClubAdminId,
    onSelectClub: setActiveClubAdminId,
    currentUid: user && user.uid,
    pinnedClubIds: pinnedClubIds,
    onTogglePinClub: handleTogglePinClub,
    onBack: () => setScreen("home"),
    onNewTeam: () => {
      setEditingTeam(null);
      setPresetTeamSeed(null);
      setTeamEditReturnScreen("my-teams");
      setScreen("team-edit");
    },
    onEditTeam: t => {
      setActiveClubAdminId(t._clubId || null);
      setEditingTeam(t);
      setPresetTeamSeed(null);
      setTeamEditReturnScreen("my-teams");
      setScreen("team-edit");
    },
    onDeleteTeam: (id, clubId) => handleDeleteTeam(id, clubId),
    onMoveTeam: (team, toClubId) => handleMoveTeam(team, team._clubId || null, toClubId)
  })), screen === "teams" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "teams",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(TeamsScreen, {
    onManageTeams: () => setScreen("my-teams"),
    onBack: () => setScreen("home"),
    clubs: clubs,
    activeClubId: activeClubAdminId,
    currentUid: user && user.uid,
    pinnedClubIds: pinnedClubIds,
    onTogglePinClub: handleTogglePinClub,
    tab: teamsTab,
    onTabChange: setTeamsTab,
    activeClubAdminId: activeClubAdminId,
    onSelectClubAdmin: setActiveClubAdminId,
    onCreateClub: handleCreateClub,
    onJoinClub: handleJoinClub,
    onInviteClubMember: handleInviteClubMember,
    onInviteClubCoOwner: (clubId, email) => handleInviteCoOwner("club", clubId, email),
    onCancelCoOwnerInvite: handleCancelCoOwnerInvite,
    coOwnerInvites: myCoOwnerInvites,
    onRevokeClubInvite: handleRevokeClubInvite,
    onLeaveClub: handleLeaveClub,
    onDeleteClub: handleDeleteClub,
    onRenameClub: handleRenameClub,
    onUpdateClubDescription: handleUpdateClubDescription,
    onUpdateClubAddress: handleUpdateClubAddress,
    onUploadClubLogo: handleUploadClubLogo,
    onRemoveClubLogo: handleRemoveClubLogo,
    onSetClubVisibility: handleSetClubVisibility,
    onRemoveClubMember: handleRemoveMember,
    onRemoveClubCoOwner: handleRemoveClubCoOwner,
    onRefreshMyMemberName: handleRefreshMyMemberName,
    federationsById: federationsById,
    onCreateFederation: handleCreateFederation,
    onSearchPublicFederations: searchPublicFederations,
    onSearchPublicClubs: searchPublicClubs,
    onSearchPublicUsers: searchPublicUsers,
    onRequestFederationAffiliation: handleRequestFederationAffiliation,
    onSetFederationVisibility: handleSetFederationVisibility,
    onLeaveFederation: handleLeaveFederation,
    onRenameFederation: handleRenameFederation,
    onUpdateFederationDescription: handleUpdateFederationDescription,
    onKickClubFromFederation: handleKickClubFromFederation,
    onDeleteFederation: handleDeleteFederation,
    onLoadFederationTeams: loadFederationTeams,
    onLoadFederationMembers: loadFederationMembers,
    federationRequests: myFederationRequests,
    onCancelFederationRequest: handleCancelFederationRequest,
    onInviteFederationCoOwnerByEmail: (federationId, email) => handleInviteCoOwner("federation", federationId, email),
    onRemoveFederationCoOwner: handleRemoveFederationCoOwner,
    clubsLoading: clubsLoading,
    federationsLoading: federationsLoading,
    onOpenRecords: handleOpenRecords,
    onAddUmpire: handleAddUmpire,
    onRemoveUmpire: handleRemoveUmpire,
    onAddPoolPlayers: handleAddPoolPlayers,
    onUpdatePoolPlayer: handleUpdatePoolPlayer,
    onRemovePoolPlayer: handleRemovePoolPlayer,
    onCreateTeamFromPool: handleCreateTeamFromPool
  })), screen === "tournaments" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "tournaments",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(TournamentsScreen, {
    tournaments: activeTournaments,
    clubs: clubs,
    activeClubId: activeTournamentClubId,
    onSelectSource: clubId => {
      setActiveTournamentClubId(clubId);
      setActiveTournamentFederationId(null);
    },
    myFederations: myOwnedFederationIds.map(id => federationsById[id]).filter(Boolean),
    activeFederationId: activeTournamentFederationId,
    onSelectFederationSource: fedId => {
      setActiveTournamentFederationId(fedId);
      setActiveTournamentClubId(null);
    },
    teamOptions: activeTournamentFederationId ? [] : (activeTournamentClubId ? clubTeamsById[activeTournamentClubId] || [] : teams).map(t => t.name),
    federationTeamOptions: activeTournamentClubId || activeTournamentFederationId ? federationTeamOptions : [],
    onCreateTournament: handleCreateTournament,
    onCreateSeries: handleCreateSeries,
    onOpenTournament: t => {
      setViewingTournament(t);
      setViewingTournamentClubId(activeTournamentClubId || t._clubId || null);
      setViewingTournamentFederationId(activeTournamentFederationId || t._federationId || null);
      setTournamentDetailReturnScreen("tournaments");
      setScreen(t.kind === "series" ? "series-detail" : "tournament-detail");
    },
    onOpenRecords: handleOpenRecords,
    onBack: () => setScreen("home"),
    currentUid: user && user.uid,
    clubsLoading: clubsLoading,
    federationsLoading: federationsLoading,
    pinnedClubIds: pinnedClubIds,
    onTogglePinClub: handleTogglePinClub,
    pinnedFederationIds: pinnedFederationIds,
    onTogglePinFederation: handleTogglePinFederation
  })), screen === "records" && viewingRecordsSource && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "records",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(RecordsScreen, {
    sourceType: viewingRecordsSource.type,
    sourceId: viewingRecordsSource.id,
    sourceName: viewingRecordsSource.name,
    onBack: () => setScreen("tournaments")
  })), screen === "series-detail" && viewingTournament && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "series-detail",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(SeriesDetailScreen, {
    series: viewingTournament,
    onBack: () => setScreen(tournamentDetailReturnScreen),
    backLabel: tournamentDetailReturnScreen === "home" ? "Home" : "Cups",
    onStartFixtureMatch: handleStartFixtureMatch,
    onUpdateSeries: handleUpdateTournament,
    onOpenMatch: id => {
      openMatch(id);
    },
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
    onOpenMatch: id => {
      openMatch(id);
    },
    onDeleteTournament: handleDeleteTournament,
    // Lets the champion banner (see FixturesSection) link straight to the club/federation's
    // Record Book the moment a title's actually decided — the same handleOpenRecords used by the
    // Club/Federation screen entry points, just resolved from whichever source this tournament
    // was opened from (at most one of viewingTournamentClubId/FederationId is ever set).
    onOpenRecords: viewingTournamentFederationId ? () => handleOpenRecords("federation", viewingTournamentFederationId, (federationsById[viewingTournamentFederationId] || {}).name || "") : viewingTournamentClubId ? () => handleOpenRecords("club", viewingTournamentClubId, (clubs.find(c => c.id === viewingTournamentClubId) || {}).name || "") : undefined,
    canManage: viewingTournamentFederationId ? isFederationOwner(federationsById[viewingTournamentFederationId], user && user.uid) : !viewingTournamentClubId || isClubOwner(clubs.find(c => c.id === viewingTournamentClubId), user && user.uid),
    clubs: clubs,
    clubTeamsById: clubTeamsById
  })), screen === "account" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "account",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(AccountScreen, {
    user: user,
    profile: profile,
    myPlayer: myPlayer,
    isAdmin: isAdmin,
    onOpenFeedbackInbox: () => setScreen("feedback-inbox"),
    onOpenBetaTesters: () => setScreen("beta-testers"),
    onOpenClub: clubId => {
      setActiveClubAdminId(clubId);
      setTeamsTab("clubs");
      setScreen("teams");
    },
    isBetaTester: isBetaTester,
    onGenerateDummyData: handleGenerateDummyData,
    onWipeDummyData: handleWipeDummyData,
    clubs: clubs,
    federationsById: federationsById,
    onSignIn: handleSignInGoogle,
    onSignOut: signOutUser,
    onSaveProfile: handleSaveProfile,
    onExportData: handleExportData,
    onImportData: handleImportData,
    onDeleteAccount: handleDeleteAccount,
    onBack: () => setScreen("home"),
    redirectError: authError,
    linkStatus: linkStatus,
    onClearLinkStatus: () => setLinkStatus(""),
    isProfilePublic: isProfilePublic,
    onSetProfileVisibility: handleSetProfileVisibility
  })), screen === "help" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "help",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(HelpScreen, {
    onBack: () => setScreen("home"),
    initialQuery: helpInitialQuery,
    onReplayTour: () => {
      setShowTour(true);
      setScreen("home");
    }
  })), screen === "feedback" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "feedback",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FeedbackScreen, {
    onBack: () => setScreen("home"),
    userEmail: user && user.email
  })), screen === "feedback-inbox" && isAdmin && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "feedback-inbox",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FeedbackInboxScreen, {
    onBack: () => setScreen("home")
  })), screen === "beta-testers" && isAdmin && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "beta-testers",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(BetaTestersScreen, {
    onBack: () => setScreen("home")
  })), screen === "about" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "about",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(AboutScreen, {
    onBack: () => setScreen("home")
  })), screen === "inbox" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "inbox",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(InboxScreen, {
    requests: myFederationRequests,
    clubs: clubs,
    federationsById: federationsById,
    currentUid: user && user.uid,
    currentEmail: user && user.email,
    onRespond: handleRespondFederationRequest,
    onCancel: handleCancelFederationRequest,
    onCompleteJoin: handleCompleteAcceptedFederationRequest,
    coOwnerInvites: myCoOwnerInvites,
    onRespondCoOwnerInvite: handleRespondCoOwnerInvite,
    onCancelCoOwnerInvite: handleCancelCoOwnerInvite,
    onDeleteCoOwnerInvite: handleDeleteCoOwnerInvite,
    activity: myActivity,
    onMarkActivityRead: handleMarkActivityRead,
    onDeleteActivity: handleDeleteActivity,
    pollItems: pendingPollItems,
    onPollsChanged: refreshPendingPollItems,
    onBack: () => setScreen("home")
  })), screen === "shared-links" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "shared-links",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(SharedLinksScreen, {
    matches: matches,
    onRevokeShareCode: handleRevokeShareCode,
    onRevokeViewCode: handleRevokeViewCode,
    onBack: () => setScreen("account")
  })), screen === "players" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "players",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(PlayersScreen, {
    onBack: () => {
      setScreen("home");
      setPlayersInitialSelected(null);
    },
    initialSelected: playersInitialSelected,
    onLoadPublicPlayers: loadPublicPlayers,
    onComputeCareerStats: computePlayerCareerStats,
    onDeletePlayer: deletePlayer,
    onSearchPublicClubs: searchPublicClubs,
    onTransferPlayer: transferPlayerHomeClub,
    onUpdatePlayerInfo: updatePlayerInfo,
    currentUid: user && user.uid,
    clubs: clubs
  })), screen === "follow" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "follow",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FollowScreen, {
    code: followCode,
    matchId: followMatchId,
    onExit: exitFollow
  })), screen === "follow-tournament" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "follow-tournament",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(FollowTournamentScreen, {
    code: initialTournamentFollowCode,
    onExit: exitFollowTournament
  })), screen === "poll-respond" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "poll-respond",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(PollRespondScreen, {
    code: initialPollCode,
    onExit: exitPoll
  })), screen === "team-edit" && /*#__PURE__*/React.createElement(NavWrap, {
    navKey: "team-edit",
    direction: navDirection
  }, /*#__PURE__*/React.createElement(TeamEditScreen, {
    team: editingTeam,
    clubId: activeClubAdminId,
    clubs: clubs,
    onPublishPlayer: publishPlayer,
    onUnpublishPlayer: unpublishPlayer,
    onUpdatePlayerInfo: updatePlayerInfo,
    onLoadPublicPlayers: loadPublicPlayers,
    onAddPoolPlayers: handleAddPoolPlayers,
    presetTeamSeed: presetTeamSeed,
    onSave: team => handleSaveTeam(team, activeClubAdminId),
    onCancel: () => setScreen(teamEditReturnScreen)
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
  }, "Opening match\u2026"))));
}
