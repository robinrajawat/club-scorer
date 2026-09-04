import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Bell, ChevronRight, Info, Plus, Trophy } from "./icons.js";
import { Btn, PlayerAvatar, TextField } from "./formUiAtoms.js";
import { AppMark, LoadingNote, EmptyStateBallIllustration } from "./illustrations.js";
import { SwipeableRow } from "./scoringUiAtoms.js";
import { SyncStatusBanner } from "./scoreboardAtoms.js";
import { InstallHintBanner } from "./screenAtoms.js";
import { JoinCodeBar } from "./pickerAtoms.js";
import { ShareMenu } from "./shareMenus.js";
import { AuthBar } from "./authBar.js";
import { UpcomingFixtureCard } from "./upcomingFixtureCard.js";
import { PLAYER_ROLES } from "./playerModals.js";
import { HELP_SECTIONS } from "./infoScreens.js";
import { matchScoreLine } from "../core/shareAndFormat.js";
import { relativeDayLabel, greetingPrefix } from "../core/miscHelpers.js";
import { hasSeenSwipeHint } from "../core/appLogic.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// The app's landing screen once signed in (or skipped sign-in): a "Continue scoring" hero for any
// match this account has in progress, a "Next up" teaser for the nearest scheduled tournament
// fixture, saved matches (in-progress/upcoming/completed, each collapsible), and a unified search
// across matches/teams/players/tournaments/clubs/federations/help. Everyone else's live matches/
// tournaments moved to the Live tab (see TabBar/LiveScreen) -- this screen only ever surfaces this
// account's own stuff, plus what's coming up next for it. `onLoadPublicPlayers` runs lazily from a
// useEffect only once the Players search chip is picked, not on mount -- a prop, not a bare global.
// Matches search also reaches beyond this account's own saved matches: `onLoadRecentMatches`
// lazily fetches every live/recently-completed match app-wide (see fetchLiveAndRecentMatches in
// index.html) the first time someone actually types a query, surfacing a match found that way
// under "Across Club Scorer". `Modal` (bare global, same as everywhere else in this suite) backs
// one dialog. Covered by tests/unit/components/homeScreen.test.js.
//
// `renderMatchCard`, the per-match-card renderer, stays nested inside HomeScreen exactly as it was
// in public/index.html, but its signature was refactored here (before this extraction) to take the
// values it used to close over -- onOpen, setConfirmDeleteId, setShowSwipeHint, tournamentNameById,
// onGetShareCode, onGetViewCode -- as an explicit third argument instead, since a module-level
// function obviously can't close over another function's local state/props the way a truly nested
// one can. Every one of its four call sites (still inside HomeScreen) was updated to pass that
// object explicitly; the change is otherwise behavior-preserving -- same values, same call order,
// nothing about what actually renders differs. This was flagged back when `renderMatchCard` was
// first discovered (during an earlier batch's extraction survey) as the one thing blocking
// HomeScreen from being extracted the same verbatim-splice way as everything else in this project;
// the other nested helpers below it (renderClubRow, renderCupRow, renderFederationRow,
// renderHelpRow, renderTeamRow, searchResultRow, seeAllLink, roleLabel) needed no such treatment --
// they're only ever called from within HomeScreen's own render, so they simply travel with it as
// part of the same function body, no refactor required.

export function HomeScreen({
  matches,
  onNew,
  onOpen,
  onDelete,
  onOpenClub,
  onOpenFederation,
  user,
  profile,
  isProfilePublic,
  onOpenAccount,
  onOpenInbox,
  onOpenSharedLinks,
  onOpenHelp,
  onOpenFeedback,
  onOpenAbout,
  onSignOut,
  themePref,
  onSetTheme,
  onJoinCode,
  onOpenTournaments,
  onOpenPlayer,
  onLoadPublicPlayers,
  pendingCount,
  onPendingSynced,
  inboxBadgeCount = 0,
  tournamentNameById = {},
  tournaments = [],
  onOpenTournament,
  onScheduleFixture,
  onStartFixture,
  onEditVenue,
  clubs = [],
  federationsById = {},
  clubTeamsById = {},
  teams = [],
  onOpenTeam,
  onGetShareCode,
  onGetViewCode,
  onOpenLiveMatch,
  onLoadRecentMatches,
  showInstallHint = false,
  onDismissInstallHint,
  showTabBar = false
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const matchToConfirmDelete = confirmDeleteId ? matches.find(m => m.id === confirmDeleteId) : null;
  const [query, setQuery] = useState("");
  // The "swipe to delete" label next to Saved Matches -- shown until a real swipe happens
  // anywhere in the app (see SwipeableRow's onSwipeStart / hasSeenSwipeHint), not just once ever
  // on render, so it keeps earning its space until the gesture's actually been demonstrated.
  const [showSwipeHint, setShowSwipeHint] = useState(() => !hasSeenSwipeHint());
  // Collapsed by default -- a season's worth of completed matches otherwise buries the in-progress
  // ones (the matches someone's actually mid-way through and likely opened this screen to resume)
  // under everything already finished. Forced open below whenever there are no in-progress matches
  // to separate it from, since folding the only content on screen would just look empty.
  const [completedExpanded, setCompletedExpanded] = useState(false);
  // In Progress stays open by default -- it's what someone most likely opened this screen to
  // resume. Upcoming and Completed both default closed: Upcoming is planning-ahead information,
  // not something to act on right this moment the way a live match is, and a season's worth of
  // either otherwise pushes past the fold before the "New Match" button and search even come into
  // view. All three still get the same fold affordance either way, so nothing here is one-way.
  const [inProgressExpanded, setInProgressExpanded] = useState(true);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  // Merges what used to be separate destinations (a "Search players" screen, plus Cups/Clubs/
  // Federations/Help each living behind their own tap) into one search box: type once, see
  // matches, players, tournaments/series, clubs, federations, and FAQ entries all filtered by the
  // same query, with a chip row to narrow down to just one kind of result. "All" only ever
  // searches data already sitting in memory (matches, tournaments, clubs, and the static FAQ
  // content) -- the public player directory is a real network fetch, so it's loaded lazily and
  // only once someone deliberately picks the Players chip, same as before this was unified.
  const [searchScope, setSearchScope] = useState("all"); // all | matches | teams | players | cups | clubs | federations | help
  const [showSearchInfo, setShowSearchInfo] = useState(false);
  const [publicPlayers, setPublicPlayers] = useState(null); // null = not loaded yet
  const [playersLoading, setPlayersLoading] = useState(false);
  const hasPlayerSearch = typeof onLoadPublicPlayers === "function";
  // Live + recently-completed matches across the whole app (not just this account's own), for the
  // Matches search only -- same lazy-loaded, fetched-once-then-filtered-in-memory pattern as
  // publicPlayers above, but keyed off any non-empty query rather than a chip pick, since Matches
  // is the default scope. Deliberately never shown outside of an active search: the Home screen's
  // own "Live now" strip above already covers browsing, this is only for finding one specific
  // match someone remembers watching.
  const [recentMatches, setRecentMatches] = useState(null); // null = not loaded yet
  const [recentMatchesLoading, setRecentMatchesLoading] = useState(false);
  const hasRecentMatchSearch = typeof onLoadRecentMatches === "function";
  // Same first-name logic AuthBar's own trigger label used to show directly -- now the greeting's
  // job instead, since the account button is icon-only. Blank (not "Account"/some placeholder)
  // when there's genuinely no name to show, so the greeting line just doesn't render at all rather
  // than saying something empty or generic.
  const homeGreetingName = user ? (profile && profile.displayName ? profile.displayName : user.displayName || "").trim().split(" ")[0] : "";
  useEffect(() => {
    if (searchScope !== "players" || publicPlayers !== null || !hasPlayerSearch) return;
    let cancelled = false;
    setPlayersLoading(true);
    onLoadPublicPlayers().then(list => {
      if (cancelled) return;
      setPublicPlayers(list);
      setPlayersLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [searchScope, publicPlayers, hasPlayerSearch]);
  useEffect(() => {
    if (!query.trim() || recentMatches !== null || !hasRecentMatchSearch) return;
    if (searchScope !== "matches" && searchScope !== "all") return;
    let cancelled = false;
    setRecentMatchesLoading(true);
    onLoadRecentMatches().then(list => {
      if (cancelled) return;
      setRecentMatches(list);
      setRecentMatchesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query, searchScope, recentMatches, hasRecentMatchSearch]);
  const q = query.trim().toLowerCase();
  // Matches against both team names and the tournament name (when it belongs to one) -- someone
  // searching is far more likely to remember "that Riverside game" or "the DCF final" than to
  // scroll hunting for a specific date. Venue isn't included: local-only/offline matches never
  // carry it on this lightweight list (see upsertLocalPointer), only cloud-synced ones do, and a
  // filter that only sometimes searches a field would be more confusing than one that reliably
  // doesn't.
  const filteredMatches = q ? matches.filter(m => m.teamA.toLowerCase().includes(q) || m.teamB.toLowerCase().includes(q) || (m.tournamentId && (tournamentNameById[m.tournamentId] || "").toLowerCase().includes(q))) : matches;
  // Excludes anything already in `matches` -- a match this account owns (or has open) shows once,
  // in Saved Matches, not a second time down here just because it's also currently live or recent.
  const ownMatchIds = new Set(matches.map(m => m.id));
  const filteredRecentMatches = q && recentMatches ? recentMatches.filter(m => !ownMatchIds.has(m.id) && (m.teamA.toLowerCase().includes(q) || m.teamB.toLowerCase().includes(q))) : [];
  const filteredPlayers = publicPlayers ? (q ? publicPlayers.filter(p => p.name.toLowerCase().includes(q)) : publicPlayers) : [];
  const roleLabel = v => (PLAYER_ROLES.find(r => r.value === v) || {}).label;
  // Every fixture, across every tournament, that hasn't been started yet (no matchId) -- these
  // aren't in `matches` at all, since a fixture only becomes a real match once someone actually
  // taps Start on it. Searched alongside saved matches so "that Riverside game" finds it whether
  // it's already been played or is still just sitting on a tournament's schedule -- without this,
  // searching for an upcoming game here would silently come back empty, which is worse than not
  // having search at all. Only surfaced while there's an active query (see below) -- a permanent
  // always-visible upcoming section is a bigger change than what was asked for here.
  const upcomingFixtures = tournaments.flatMap(t => (t.fixtures || []).filter(f => !f.matchId).map(f => ({
    tournament: t,
    fixture: f
  })));
  const filteredUpcoming = q ? upcomingFixtures.filter(({
    tournament: t,
    fixture: f
  }) => f.teamA.toLowerCase().includes(q) || f.teamB.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : [];
  // Chronological, nearest first -- fixtures without a scheduled date/time yet fall to the end
  // rather than sorting arbitrarily first, since "not yet scheduled" isn't more urgent than
  // something happening tomorrow. f.date is an ISO datetime-local string ("YYYY-MM-DDTHH:MM"),
  // which sorts correctly as a plain string compare -- no need to parse it into a Date first.
  const sortedUpcomingFixtures = [...upcomingFixtures].sort((a, b) => {
    if (!a.fixture.date && !b.fixture.date) return 0;
    if (!a.fixture.date) return 1;
    if (!b.fixture.date) return -1;
    return a.fixture.date < b.fixture.date ? -1 : a.fixture.date > b.fixture.date ? 1 : 0;
  });
  // Capped on the home screen -- a full tournament's fixture list could easily be 20+ games, and
  // this is meant as a "here's what's next" glance, not a duplicate of the Cups tab (which already
  // has the complete, unbounded list one tap away). Uncapped in search results below, since a
  // filtered set is already short and specific.
  const UPCOMING_HOME_LIMIT = 4;
  const visibleUpcomingFixtures = sortedUpcomingFixtures.slice(0, UPCOMING_HOME_LIMIT);
  const hiddenUpcomingCount = sortedUpcomingFixtures.length - visibleUpcomingFixtures.length;
  // The hero "Continue scoring" card at the very top of the screen -- everyone else's live
  // matches moved to the Live tab (see TabBar/LiveScreen), but a match THIS account is actively
  // scoring is a different thing entirely: the one action someone opening the app mid-match is
  // almost certainly here for, so it gets the most prominent slot on the page, above even Next
  // up. Not deduped against the "In Progress" list further down Saved Matches -- same
  // teaser-plus-full-list relationship as Next up has with the full Upcoming list.
  const inProgressOwnMatches = matches.filter(m => m.status === "in-progress");
  // Cups (tournaments + series), teams, clubs, federations, and Help/FAQ entries -- all already
  // sitting in memory (tournaments/teams/clubs are loaded right after sign-in for other reasons;
  // HELP_SECTIONS is static), so unlike Players these cost nothing to search and only ever show
  // while there's a query, same "no browse mode" reasoning as filteredUpcoming above.
  const filteredTournaments = q ? tournaments.filter(t => t.name.toLowerCase().includes(q)) : [];
  // teams is the same merged, source-tagged list (personal + every club's) the Teams screen
  // itself shows -- see allTeamsFlat -- so a search here finds a team no matter which club it
  // belongs to, not just personal ones.
  const filteredTeamsList = q ? teams.filter(t => t.name.toLowerCase().includes(q)) : [];
  const filteredClubsList = q ? clubs.filter(c => c.name.toLowerCase().includes(q)) : [];
  const allFederations = Object.values(federationsById);
  const filteredFederationsList = q ? allFederations.filter(f => f.name.toLowerCase().includes(q)) : [];
  // Matches against both the question and the answer text, same reasoning as HelpScreen's own
  // search -- kept each entry tagged with its section title so a result out of context ("Set at
  // match creation, under Customize") still makes sense on its own.
  const filteredHelpEntries = q ? HELP_SECTIONS.flatMap(section => section.entries.filter(e => e.q.toLowerCase().includes(q) || e.a.toLowerCase().includes(q)).map(e => ({ ...e,
    section: section.title
  }))) : [];
  // Cap per category when showing everything at once under "All" -- a glance, not a duplicate of
  // what picking that category's own chip shows uncapped.
  const ALL_SCOPE_CAP = 3;
  // In progress first (the ones someone likely opened this screen to resume), completed second and
  // foldable -- see completedExpanded above. Grouping is skipped entirely while searching: a filtered
  // result set is already short and specific, so splitting it into two labeled groups (one likely
  // collapsed) would just be extra taps to find the one match being searched for.
  const inProgressMatches = filteredMatches.filter(m => m.status !== "complete");
  const completedMatches = filteredMatches.filter(m => m.status === "complete");
function renderMatchCard(m, i, {
  onOpen,
  setConfirmDeleteId,
  setShowSwipeHint,
  tournamentNameById,
  onGetShareCode,
  onGetViewCode
}) {
    return /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      animation: `cs-slideUp 0.3s ease ${i * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement(SwipeableRow, {
    onDelete: () => setConfirmDeleteId(m.id),
    deleteLabel: "Delete",
    onSwipeStart: () => setShowSwipeHint(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "cs-row",
    style: {
      background: COLORS.surface,
      padding: "14px 14px",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => onOpen(m),
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(m);
      }
    },
    role: "button",
    tabIndex: 0,
    style: {
      cursor: "pointer",
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      flexShrink: 0,
      // Matches the "Live" pulsing dot on the Follow screen (red, not green) -- red is the
      // convention someone already recognizes from every other live-broadcast indicator (YouTube,
      // Twitch, sports apps), whereas green usually reads as "healthy/done" rather than "happening
      // right now". Having two different colors for the same in-progress state across screens
      // would be a genuine inconsistency, not a stylistic choice.
      background: m.status === "complete" ? COLORS.inkSoft : COLORS.live,
      boxShadow: m.status === "complete" ? "none" : "0 0 0 3px rgba(230,84,75,0.18)",
      animation: m.status === "complete" ? "none" : "cs-pulse 1.6s ease infinite"
    }
  }), /*#__PURE__*/React.createElement("div", null, m.tournamentId && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "'Inter'",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.gold,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 10
  }), tournamentNameById[m.tournamentId] || "Tournament"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14.5,
      color: COLORS.ink
    }
  }, m.teamA, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontWeight: 500
    }
  }, "vs"), " ", m.teamB), (() => {
    // Cloud-synced matches land in `matches` as full docs (loadIndex reads them straight from
    // Firestore), so compute fresh from m.innings when it's there -- it's already up to date and
    // needs no extra plumbing. A local-only/offline match never carries full innings data on this
    // screen, only the lightweight pointer upsertLocalPointer wrote at save time, so it falls back
    // to that pointer's own pre-computed m.scoreLine instead.
    const line = m.innings ? matchScoreLine(m) : m.scoreLine;
    return line ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12.5,
        fontWeight: 600,
        color: m.status === "complete" ? COLORS.turf : COLORS.inkSoft,
        marginTop: 2
      }
    }, line) : null;
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginTop: 1
    }
  }, m.oversLimit, " overs · ", m.status === "complete" ? "Completed" : "In progress", m.shareCode ? " · Shared" : m.cloud ? " · Synced" : "", relativeDayLabel(m.createdAt) && ` · ${relativeDayLabel(m.createdAt)}`))), onGetShareCode && onGetViewCode && /*#__PURE__*/React.createElement(ShareMenu, {
    match: m,
    onGetCode: () => onGetShareCode(m),
    onGetViewCode: () => onGetViewCode(m),
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      width: 32,
      height: 32,
      flexShrink: 0,
      marginLeft: 8
    }
  }))));
  }
  // A live/recent match found via app-wide search, opening straight into the same read-only
  // FollowScreen a Live tab card does (see onOpenLiveMatch) -- there's no owner-only affordance
  // here (no swipe-to-delete, no ShareMenu) since this is someone else's match, found by search,
  // not one of this account's own.
  function renderRecentMatchRow(m) {
    return /*#__PURE__*/React.createElement("button", {
      key: "recent-" + m.id,
      type: "button",
      onClick: () => onOpenLiveMatch && onOpenLiveMatch(m.id),
      className: "cs-btn",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        width: "100%",
        textAlign: "left",
        background: COLORS.surface,
        border: "none",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 6,
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(42,36,32,0.06)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 13.5,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, m.teamA, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.inkSoft,
        fontWeight: 500
      }
    }, "vs"), " ", m.teamB), matchScoreLine(m) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.inkSoft,
        marginTop: 2
      }
    }, matchScoreLine(m))), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        background: m.status === "complete" ? COLORS.inkSoft : COLORS.live,
        boxShadow: m.status === "complete" ? "none" : "0 0 0 3px rgba(230,84,75,0.18)",
        animation: m.status === "complete" ? "none" : "cs-pulse 1.6s ease infinite"
      }
    }));
  }
  // Shared row style for the four new search categories below -- same look as the player search
  // results just above, so a mixed set of result kinds still reads as one consistent list style
  // rather than four differently-designed rows bolted together.
  function searchResultRow(key, onClick, primary, secondary) {
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      type: "button",
      onClick: onClick,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "none",
        background: COLORS.surface,
        cursor: "pointer",
        textAlign: "left",
        boxShadow: "0 1px 2px rgba(42,36,32,0.06)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 14,
        color: COLORS.ink
      }
    }, primary), secondary && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft
      }
    }, secondary));
  }
  function renderCupRow(t) {
    return searchResultRow(t.id, () => onOpenTournament(t), t.name, t.kind === "series" ? "Series" : "Tournament");
  }
  function renderTeamRow(t) {
    const club = t._clubId ? clubs.find(c => c.id === t._clubId) : null;
    return searchResultRow(t.id, () => onOpenTeam(t), t.name, club ? club.name : "Personal");
  }
  function renderClubRow(c) {
    return searchResultRow(c.id, () => onOpenClub(c.id), c.name, "Club");
  }
  function renderFederationRow(f) {
    return searchResultRow(f.id, () => onOpenFederation(), f.name, "Federation");
  }
  function renderHelpRow(e) {
    return searchResultRow(e.q, () => onOpenHelp(query), e.q, e.section);
  }
  // "See all N" link under an All-scope category preview -- switches straight to that category's
  // own chip instead of just being a label, so narrowing down is one tap from the preview itself.
  function seeAllLink(scope, count) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setSearchScope(scope),
      className: "cs-btn",
      style: {
        display: "block",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "6px 2px",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 12,
        color: COLORS.turf,
        textDecoration: "underline"
      }
    }, `See all ${count}`);
  }
  function categorySectionLabel(text) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        marginBottom: 8,
        opacity: 0.75
      }
    }, text);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 28,
      paddingLeft: 16,
      paddingRight: 16,
      // Reserves clearance under the fixed TabBar (see cricketScorer.js) when it's showing, so the
      // last bit of scrollable content here doesn't render partially hidden underneath it -- same
      // fixed-bar-overlap bug class as MatchScreen's scoring pad (see docs/history.md's "This
      // Over" writeup), just avoided from the start here since TabBar's height never changes.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 40px + env(safe-area-inset-bottom))` : 40,
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(AppMark, {
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.pitch
    }
  }, "Club Scorer")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, onOpenInbox && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenInbox,
    "aria-label": inboxBadgeCount > 0 ? `Inbox, ${inboxBadgeCount} pending` : "Inbox",
    className: "cs-btn",
    style: {
      position: "relative",
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "none",
      border: "none",
      borderRadius: "50%",
      color: COLORS.pitch,
      cursor: "pointer",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Bell, {
    size: 19
  }), inboxBadgeCount > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 4,
      right: 4,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      minWidth: 13,
      height: 13,
      padding: "0 3px",
      borderRadius: 7,
      background: COLORS.ballFixed,
      color: "#fff",
      fontFamily: "'Inter'",
      fontSize: 9,
      fontWeight: 700,
      lineHeight: 1,
      // A soft box-shadow ring reads as separation from the icon behind it without the harder,
      // more attention-grabbing look a solid 1.5px border gave it -- same visual job, quieter
      // execution, so the badge signals "something's here" without being the loudest thing on
      // the screen the way a thick white-ringed red circle was.
      boxShadow: `0 0 0 1.5px ${COLORS.creamFixed}`
    }
  }, inboxBadgeCount > 9 ? "9+" : inboxBadgeCount)), /*#__PURE__*/React.createElement(AuthBar, {
    user: user,
    profile: profile,
    isProfilePublic: isProfilePublic,
    onOpenAccount: onOpenAccount,
    onOpenSharedLinks: onOpenSharedLinks,
    onOpenHelp: onOpenHelp,
    onOpenFeedback: onOpenFeedback,
    onOpenAbout: onOpenAbout,
    onSignOut: onSignOut,
    themePref: themePref,
    onSetTheme: onSetTheme
  }))), homeGreetingName && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 18,
      color: COLORS.pitch,
      marginBottom: 26
    }
  }, `${greetingPrefix()}, ${homeGreetingName}`), pendingCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SyncStatusBanner, {
    count: pendingCount,
    onSynced: onPendingSynced
  })), showInstallHint && /*#__PURE__*/React.createElement(InstallHintBanner, {
    onDismiss: onDismissInstallHint
  }), inProgressOwnMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: COLORS.live,
      boxShadow: "0 0 0 3px rgba(230,84,75,0.18)",
      animation: "cs-pulse 1.6s ease infinite",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 1.2,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "Continue scoring")), inProgressOwnMatches.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    type: "button",
    onClick: () => onOpen(m),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: "none",
      borderRadius: 14,
      padding: "12px 14px",
      marginBottom: 8,
      cursor: "pointer",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, m.tournamentId && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "'Inter'",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.gold,
      marginBottom: 3,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 10,
    style: { flexShrink: 0 }
  }), tournamentNameById[m.tournamentId] || "Tournament"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14.5,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, m.teamA, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontWeight: 500
    }
  }, "vs"), " ", m.teamB), (m.innings ? matchScoreLine(m) : m.scoreLine) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12.5,
      fontWeight: 700,
      color: COLORS.turf,
      marginTop: 2
    }
  }, m.innings ? matchScoreLine(m) : m.scoreLine)), /*#__PURE__*/React.createElement(ChevronRight, {
    size: 17,
    style: { color: COLORS.inkSoft, opacity: 0.55, flexShrink: 0 }
  }))))
  // The nearest scheduled-but-not-yet-started fixture, surfaced here right under the "Continue
  // scoring" hero rather than only inside the collapsed "Upcoming" fold further down -- most
  // sessions on this screen are resuming or starting an already-planned tournament match, not an
  // ad-hoc one, and that path used to require a scroll and a tap just to see what's next.
  // sortedUpcomingFixtures[0] is the same nearest-first ordering the full Upcoming list already
  // uses; this doesn't hide or dedupe it from that list below -- a short teaser plus the full,
  // browsable list.
  , sortedUpcomingFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 1.2,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "Next up"), /*#__PURE__*/React.createElement(UpcomingFixtureCard, {
    key: sortedUpcomingFixtures[0].fixture.id,
    tournament: sortedUpcomingFixtures[0].tournament,
    fixture: sortedUpcomingFixtures[0].fixture,
    index: 0,
    onOpenTournament: onOpenTournament,
    onScheduleFixture: onScheduleFixture,
    onStartFixture: onStartFixture,
    onEditVenue: onEditVenue,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onNew,
    style: {
      paddingLeft: 22,
      paddingRight: 22
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 17
  }), "New Match")), /*#__PURE__*/React.createElement(JoinCodeBar, {
    onJoin: onJoinCode
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: query,
    onChange: setQuery,
    placeholder: "Search everything\u2026",
    style: {
      paddingRight: 38
    }
  }), query ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setQuery("");
      setSearchScope("all");
    },
    "aria-label": "Clear search",
    className: "cs-btn",
    style: {
      position: "absolute",
      right: 8,
      top: "50%",
      transform: "translateY(-50%)",
      width: 26,
      height: 26,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: COLORS.inkSoft,
      borderRadius: "50%",
      fontSize: 20,
      lineHeight: 1
    }
  }, "\u00d7") : /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowSearchInfo(v => !v),
    "aria-label": showSearchInfo ? "Hide info" : "What does this search?",
    "aria-expanded": showSearchInfo,
    className: "cs-btn",
    style: {
      position: "absolute",
      right: 8,
      top: "50%",
      transform: "translateY(-50%)",
      width: 26,
      height: 26,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 18
  }))), showSearchInfo && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 14,
      lineHeight: 1.5,
      background: COLORS.surface,
      borderRadius: 12,
      padding: "10px 12px"
    }
  }, "Searches your matches, teams, cups & series, clubs, federations, and Help & FAQ all at once. Players is separate \u2014 it's a public directory fetched fresh, so pick that chip on purpose rather than every search reaching out for it."), (q || searchScope !== "all") && /*#__PURE__*/React.createElement("div", {
    className: "cs-no-scrollbar",
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      paddingBottom: 4,
      marginBottom: 14
    }
  }, [{
    key: "all",
    label: "All"
  }, {
    key: "matches",
    label: "Matches"
  }, {
    key: "teams",
    label: "Teams"
  }, ...(hasPlayerSearch ? [{
    key: "players",
    label: "Players"
  }] : []), {
    key: "cups",
    label: "Cups"
  }, {
    key: "clubs",
    label: "Clubs"
  }, {
    key: "federations",
    label: "Federations"
  }, {
    key: "help",
    label: "Help"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.key,
    type: "button",
    onClick: () => setSearchScope(t.key),
    className: "cs-btn",
    style: {
      flexShrink: 0,
      padding: "7px 13px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: searchScope === t.key ? COLORS.pitch : COLORS.creamDark,
      color: searchScope === t.key ? "#fff" : COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12.5,
      whiteSpace: "nowrap"
    }
  }, t.label))), (searchScope === "matches" || (searchScope === "all" && !q)) && (matches.length > 0 || sortedUpcomingFixtures.length > 0 ? /*#__PURE__*/React.createElement("div", null, matches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: 1.2,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "Saved Matches"), showSwipeHint && !q && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      opacity: 0.7
    }
  }, "← swipe to delete")), filteredMatches.length === 0 && filteredUpcoming.length === 0 && filteredRecentMatches.length === 0 && !recentMatchesLoading && q ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "24px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No matches match \u201c", query.trim(), "\u201d.") : (() => {
    if (q) return /*#__PURE__*/React.createElement(React.Fragment, null, filteredMatches.map((m, i) => renderMatchCard(m, i, { onOpen, setConfirmDeleteId, setShowSwipeHint, tournamentNameById, onGetShareCode, onGetViewCode })), filteredUpcoming.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: filteredMatches.length > 0 ? 18 : 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        marginBottom: 8,
        opacity: 0.75
      }
    }, "Upcoming"), filteredUpcoming.map(({
      tournament: t,
      fixture: f
    }, i) => /*#__PURE__*/React.createElement(UpcomingFixtureCard, {
      key: f.id,
      tournament: t,
      fixture: f,
      index: i,
      onOpenTournament: onOpenTournament,
      onScheduleFixture: onScheduleFixture,
      onStartFixture: onStartFixture,
      onEditVenue: onEditVenue,
      clubs: clubs,
      clubTeamsById: clubTeamsById
    }))), (recentMatchesLoading || filteredRecentMatches.length > 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: filteredMatches.length > 0 || filteredUpcoming.length > 0 ? 18 : 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        marginBottom: 8,
        opacity: 0.75
      }
    }, "Across Club Scorer"), recentMatchesLoading ? /*#__PURE__*/React.createElement(LoadingNote, {
      label: "Searching live & recent matches…"
    }) : filteredRecentMatches.map(renderRecentMatchRow)));
    const showCompleted = completedExpanded || inProgressMatches.length === 0 && sortedUpcomingFixtures.length === 0;
    // Same "don't fold the only thing on the page" rule as showCompleted above, mirrored: if
    // Upcoming is literally the only section with anything in it (no in-progress match to resume,
    // no completed history either), force it open rather than handing back a Home screen that
    // looks empty at a glance just because collapsed-by-default is now the norm for this section.
    const showUpcoming = upcomingExpanded || inProgressMatches.length === 0 && completedMatches.length === 0 && sortedUpcomingFixtures.length > 0;
    return /*#__PURE__*/React.createElement(React.Fragment, null, inProgressMatches.length > 0 && (completedMatches.length > 0 || sortedUpcomingFixtures.length > 0) && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setInProgressExpanded(e => !e),
      className: "cs-btn",
      "aria-expanded": inProgressExpanded,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        marginBottom: 8,
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        opacity: 0.75
      }
    }, /*#__PURE__*/React.createElement(ChevronRight, {
      size: 13,
      style: {
        transform: inProgressExpanded ? "rotate(90deg)" : "none",
        transition: "transform 0.15s ease",
        flexShrink: 0
      }
    }), "In Progress (", inProgressMatches.length, ")"), inProgressExpanded && inProgressMatches.map((m, i) => renderMatchCard(m, i, { onOpen, setConfirmDeleteId, setShowSwipeHint, tournamentNameById, onGetShareCode, onGetViewCode })), sortedUpcomingFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: inProgressMatches.length > 0 ? 18 : 0
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setUpcomingExpanded(e => !e),
      className: "cs-btn",
      "aria-expanded": showUpcoming,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        marginBottom: 8,
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        opacity: 0.75
      }
    }, /*#__PURE__*/React.createElement(ChevronRight, {
      size: 13,
      style: {
        transform: showUpcoming ? "rotate(90deg)" : "none",
        transition: "transform 0.15s ease",
        flexShrink: 0
      }
    }), "Upcoming (", sortedUpcomingFixtures.length, ")"), showUpcoming && visibleUpcomingFixtures.map(({
      tournament: t,
      fixture: f
    }, i) => /*#__PURE__*/React.createElement(UpcomingFixtureCard, {
      key: f.id,
      tournament: t,
      fixture: f,
      index: i,
      onOpenTournament: onOpenTournament,
      onScheduleFixture: onScheduleFixture,
      onStartFixture: onStartFixture,
      onEditVenue: onEditVenue,
      clubs: clubs,
      clubTeamsById: clubTeamsById
    })), showUpcoming && hiddenUpcomingCount > 0 && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onOpenTournaments,
      className: "cs-btn",
      style: {
        display: "block",
        width: "100%",
        textAlign: "center",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "6px 0 2px",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 12,
        color: COLORS.turf
      }
    }, "+", hiddenUpcomingCount, " more in Cups")), completedMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: inProgressMatches.length > 0 || sortedUpcomingFixtures.length > 0 ? 18 : 0
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setCompletedExpanded(e => !e),
      className: "cs-btn",
      "aria-expanded": showCompleted,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 0 10px",
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        opacity: 0.75
      }
    }, /*#__PURE__*/React.createElement(ChevronRight, {
      size: 13,
      style: {
        transform: showCompleted ? "rotate(90deg)" : "none",
        transition: "transform 0.15s ease",
        flexShrink: 0
      }
    }), "Completed (", completedMatches.length, ")"), showCompleted && completedMatches.map((m, i) => renderMatchCard(m, i, { onOpen, setConfirmDeleteId, setShowSwipeHint, tournamentNameById, onGetShareCode, onGetViewCode }))));
  })()) : /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px",
      borderRadius: 16,
      border: `1.5px dashed ${COLORS.willow}`,
      background: `color-mix(in srgb, ${COLORS.surface} 40%, transparent)`
    }
  }, /*#__PURE__*/React.createElement(EmptyStateBallIllustration, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginTop: 14
    }
  }, "No matches yet.", /*#__PURE__*/React.createElement("br", null), "Start your first game to see it here."))), searchScope === "players" && /*#__PURE__*/React.createElement("div", null, playersLoading ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading players\u2026"
  }) : filteredPlayers.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, (publicPlayers || []).length === 0 ? "No public players yet." : "No players match that search.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredPlayers.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    type: "button",
    onClick: () => onOpenPlayer(p),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: "none",
      background: COLORS.surface,
      cursor: "pointer",
      textAlign: "left",
      boxShadow: "0 1px 2px rgba(42,36,32,0.06)"
    }
  }, /*#__PURE__*/React.createElement(PlayerAvatar, {
    name: p.name,
    photoURL: p.photoURL,
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14,
      color: COLORS.ink
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft
    }
  }, [roleLabel(p.role), p.age && `${p.age} yrs`].filter(Boolean).join(" \u00b7 "))))))), searchScope === "cups" && /*#__PURE__*/React.createElement("div", null, filteredTournaments.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, q ? "No tournaments or series match that search." : "Type to search tournaments & series.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredTournaments.map(renderCupRow))), searchScope === "teams" && /*#__PURE__*/React.createElement("div", null, filteredTeamsList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, q ? "No teams match that search." : "Type to search your teams.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredTeamsList.map(renderTeamRow))), searchScope === "clubs" && /*#__PURE__*/React.createElement("div", null, filteredClubsList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, q ? "No clubs match that search." : "Type to search your clubs.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredClubsList.map(renderClubRow))), searchScope === "federations" && /*#__PURE__*/React.createElement("div", null, filteredFederationsList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, q ? "No federations match that search." : "Type to search your federations.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredFederationsList.map(renderFederationRow))), searchScope === "help" && /*#__PURE__*/React.createElement("div", null, filteredHelpEntries.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, q ? "No Help & FAQ entries match that search." : "Type to search Help & FAQ.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredHelpEntries.map(renderHelpRow))), searchScope === "all" && q && (filteredMatches.length === 0 && filteredUpcoming.length === 0 && filteredRecentMatches.length === 0 && !recentMatchesLoading && filteredTournaments.length === 0 && filteredTeamsList.length === 0 && filteredClubsList.length === 0 && filteredFederationsList.length === 0 && filteredHelpEntries.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No results for \u201c", query.trim(), "\u201d.") : /*#__PURE__*/React.createElement("div", null, (filteredMatches.length > 0 || filteredUpcoming.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Matches"), filteredMatches.slice(0, ALL_SCOPE_CAP).map((m, i) => renderMatchCard(m, i, { onOpen, setConfirmDeleteId, setShowSwipeHint, tournamentNameById, onGetShareCode, onGetViewCode })), filteredUpcoming.slice(0, ALL_SCOPE_CAP).map(({
    tournament: t,
    fixture: f
  }, i) => /*#__PURE__*/React.createElement(UpcomingFixtureCard, {
    key: f.id,
    tournament: t,
    fixture: f,
    index: i,
    onOpenTournament: onOpenTournament,
    onScheduleFixture: onScheduleFixture,
    onStartFixture: onStartFixture,
    onEditVenue: onEditVenue,
    clubs: clubs,
    clubTeamsById: clubTeamsById
  })), filteredMatches.length + filteredUpcoming.length > ALL_SCOPE_CAP && seeAllLink("matches", filteredMatches.length + filteredUpcoming.length)), (recentMatchesLoading || filteredRecentMatches.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Across Club Scorer"), recentMatchesLoading ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Searching live & recent matches…"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredRecentMatches.slice(0, ALL_SCOPE_CAP).map(renderRecentMatchRow)), filteredRecentMatches.length > ALL_SCOPE_CAP && seeAllLink("matches", filteredMatches.length + filteredUpcoming.length)), filteredTournaments.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Cups"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredTournaments.slice(0, ALL_SCOPE_CAP).map(renderCupRow)), filteredTournaments.length > ALL_SCOPE_CAP && seeAllLink("cups", filteredTournaments.length)), filteredTeamsList.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Teams"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredTeamsList.slice(0, ALL_SCOPE_CAP).map(renderTeamRow)), filteredTeamsList.length > ALL_SCOPE_CAP && seeAllLink("teams", filteredTeamsList.length)), filteredClubsList.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Clubs"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredClubsList.slice(0, ALL_SCOPE_CAP).map(renderClubRow)), filteredClubsList.length > ALL_SCOPE_CAP && seeAllLink("clubs", filteredClubsList.length)), filteredFederationsList.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Federations"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredFederationsList.slice(0, ALL_SCOPE_CAP).map(renderFederationRow)), filteredFederationsList.length > ALL_SCOPE_CAP && seeAllLink("federations", filteredFederationsList.length)), filteredHelpEntries.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, categorySectionLabel("Help & FAQ"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filteredHelpEntries.slice(0, ALL_SCOPE_CAP).map(renderHelpRow)), filteredHelpEntries.length > ALL_SCOPE_CAP && seeAllLink("help", filteredHelpEntries.length)), hasPlayerSearch && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "Looking for a player? Switch to the Players tab above."))), matchToConfirmDelete && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setConfirmDeleteId(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.ball,
      marginBottom: 10
    }
  }, matchToConfirmDelete.status !== "complete" ? "Delete this in-progress match?" : "Delete this match?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginBottom: 18
    }
  }, matchToConfirmDelete.status !== "complete"
    // Same swipe-and-confirm path as a completed match, but a completed one is just historical
    // data at that point -- this one is still live, so an accidental swipe here throws away
    // everything scored so far, not a finished record sitting safely in the background. Called
    // out explicitly rather than reusing the completed-match wording verbatim.
    ? `${matchToConfirmDelete.teamA} vs ${matchToConfirmDelete.teamB} is still in progress \u2014 deleting it throws away everything scored so far, not just a finished record. This can\u2019t be undone.`
    : `${matchToConfirmDelete.teamA} vs ${matchToConfirmDelete.teamB} will be permanently removed from your saved matches. This can\u2019t be undone.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setConfirmDeleteId(null),
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => {
      onDelete(matchToConfirmDelete.id);
      setConfirmDeleteId(null);
    },
    style: {
      flex: 1
    }
  }, "Delete"))));
}
