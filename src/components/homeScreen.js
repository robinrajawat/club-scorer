import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Bell, ChevronRight, Trophy } from "./icons.js";
import { Btn } from "./formUiAtoms.js";
import { AppMark, LoadingNote, EmptyState } from "./illustrations.js";
import { SwipeableRow } from "./scoringUiAtoms.js";
import { SyncStatusBanner } from "./scoreboardAtoms.js";
import { FabButton, InstallHintBanner } from "./screenAtoms.js";
import { JoinCodeBar } from "./pickerAtoms.js";
import { ShareMenu } from "./shareMenus.js";
import { AuthBar } from "./authBar.js";
import { UpcomingFixtureCard } from "./upcomingFixtureCard.js";
import { matchScoreLine } from "../core/shareAndFormat.js";
import { matchDateTimeLabel } from "../core/miscHelpers.js";
import { hasSeenSwipeHint } from "../core/appLogic.js";
import { TAB_BAR_HEIGHT, TAB_BAR_SAFE_BOTTOM } from "./tabBar.js";

// A single match card -- swipe-to-delete, tap to open, a Share menu when this account can
// actually share it (onGetShareCode/onGetViewCode both present). Module-level (not nested in
// HomeScreen) since it closes over nothing but its own params -- everything it needs (onOpen,
// setConfirmDeleteId, setShowSwipeHint, tournamentNameById, onGetShareCode, onGetViewCode) comes
// through the third argument explicitly. Exported so LiveScreen's Home tab can reuse the exact
// same card, with the exact same owner actions, for this account's own completed matches sitting
// alongside everyone else's public results -- see liveScreen.js's own comment on that merge.
export function renderMatchCard(m, i, {
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
  }), tournamentNameById[m.tournamentId] || "Tournament", m.stage && ` · ${m.stage}`), /*#__PURE__*/React.createElement("div", {
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
  }, m.oversLimit, " overs · ", m.status === "complete" ? "Completed" : "In progress", m.shareCode ? " · Shared" : m.cloud ? " · Synced" : "", matchDateTimeLabel(m.createdAt) && ` · ${matchDateTimeLabel(m.createdAt)}`))), onGetShareCode && onGetViewCode && /*#__PURE__*/React.createElement(ShareMenu, {
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

// The Score tab: this account's own matches, queue AND history -- a "Continue scoring" hero for
// any match still in progress, a "Next up" teaser for the nearest scheduled tournament fixture,
// the full In Progress / Upcoming lists, and a Completed section below them. This is the admin
// home for standalone matches, the same role Cups plays for tournaments/series -- reported live,
// "home should be a feed page only for public matches... within score we can have a control on
// the matches". Completed briefly lived on the Home/Live tab's own Results section instead (see
// liveScreen.js's history); moved back here once that turned out to mix "browsing everyone's
// public results" with "managing my own match" in one feed, including matches marked private
// showing on a tab framed as public. Home's own Results still shows a public match this account
// owns too -- read-only there, same as anyone else's -- while this is where its owner actions
// (swipe-to-delete, Share, tap to reopen the scorecard) live, regardless of whether it's public or
// private. `Modal` (bare global, same as everywhere else in this suite) backs the delete-confirm
// dialog. Covered by tests/unit/components/homeScreen.test.js.
//
// `renderMatchCard`, the per-match-card renderer, is exported above this component rather than
// nested inside it -- see its own comment for why, and for LiveScreen's reuse of it.

export function HomeScreen({
  matches,
  onNew,
  onOpen,
  onDelete,
  user,
  profile,
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
  onGetShareCode,
  onGetViewCode,
  showInstallHint = false,
  onDismissInstallHint,
  showTabBar = false
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const matchToConfirmDelete = confirmDeleteId ? matches.find(m => m.id === confirmDeleteId) : null;
  // The "swipe to delete" label next to Saved Matches -- shown until a real swipe happens
  // anywhere in the app (see SwipeableRow's onSwipeStart / hasSeenSwipeHint), not just once ever
  // on render, so it keeps earning its space until the gesture's actually been demonstrated.
  const [showSwipeHint, setShowSwipeHint] = useState(() => !hasSeenSwipeHint());
  // In Progress stays open by default -- it's what someone most likely opened this screen to
  // resume. Upcoming defaults closed: it's planning-ahead information, not something to act on
  // right this moment the way a live match is, and a season's worth of it otherwise pushes past
  // the fold before the "New Match" button even comes into view. Both still get the same fold
  // affordance either way, so nothing here is one-way.
  const [inProgressExpanded, setInProgressExpanded] = useState(true);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  // BUG FIX: showUpcoming below used to force itself back open on every render whenever nothing
  // else was on the page, with no way to tell "the smart default" apart from "the person
  // deliberately tapped this closed" -- so once every in-progress match was resumed/finished
  // (leaving nothing else on the page), collapsing Upcoming was pointless: the very next render
  // forced it straight back open, since the only-content-on-screen condition was still true.
  // Reported live as "Home page completed doesn't collapse when all matches are completed" (the
  // same bug, on the Completed fold this screen no longer has -- Upcoming inherits the fix since
  // it's the one fold left with this exact "am I the only thing on the page" default). Once a
  // fold has actually been tapped once, its own state is the only thing that decides it from then
  // on -- this tracks that a manual choice happened at all, not what the choice was.
  const [upcomingManuallySet, setUpcomingManuallySet] = useState(false);
  // Same fold pattern as Upcoming, one section down -- collapsed by default (history isn't
  // something to act on the way a live match is), but forced open if it's the only thing on the
  // page so this screen never looks empty at a glance when all that's here is match history.
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [completedManuallySet, setCompletedManuallySet] = useState(false);
  // Every fixture, across every tournament, that hasn't been started yet (no matchId) -- these
  // aren't in `matches` at all, since a fixture only becomes a real match once someone actually
  // taps Start on it.
  const upcomingFixtures = tournaments.flatMap(t => (t.fixtures || []).filter(f => !f.matchId).map(f => ({
    tournament: t,
    fixture: f
  })));
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
  // has the complete, unbounded list one tap away).
  const UPCOMING_HOME_LIMIT = 4;
  const visibleUpcomingFixtures = sortedUpcomingFixtures.slice(0, UPCOMING_HOME_LIMIT);
  const hiddenUpcomingCount = sortedUpcomingFixtures.length - visibleUpcomingFixtures.length;
  // The hero "Continue scoring" card at the very top of the screen -- everyone else's live
  // matches (and this account's own completed ones) live on the Home tab now, but a match THIS
  // account is actively scoring is a different thing entirely: the one action someone opening
  // this screen mid-match is almost certainly here for, so it gets the most prominent slot on the
  // page, above even Next up. Not deduped against the "In Progress" list further down Saved
  // Matches -- same teaser-plus-full-list relationship as Next up has with the full Upcoming list.
  const inProgressOwnMatches = matches.filter(m => m.status === "in-progress");
  // Only ever in-progress now -- a completed match doesn't belong in this account's scoring
  // queue at all any more (see the top-of-file comment), so there's nothing left to filter here.
  const inProgressMatches = matches.filter(m => m.status !== "complete");
  // Same "don't fold the only thing on the page" rule the old Completed fold used to need too --
  // if Upcoming is literally the only section with anything in it (no in-progress match to
  // resume), force it open rather than handing back a Score tab that looks empty at a glance just
  // because collapsed-by-default is now the norm for this section.
  const showUpcoming = upcomingManuallySet ? upcomingExpanded : upcomingExpanded || inProgressMatches.length === 0 && sortedUpcomingFixtures.length > 0;
  // Most recently played first -- a history list, so newest is the natural default rather than
  // relying on `matches` already arriving in some particular order.
  const completedMatches = [...matches].filter(m => m.status === "complete").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const showCompleted = completedManuallySet ? completedExpanded : completedExpanded || inProgressMatches.length === 0 && sortedUpcomingFixtures.length === 0 && completedMatches.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 28,
      paddingLeft: 16,
      paddingRight: 16,
      // Reserves clearance under the fixed TabBar (see cricketScorer.js) when it's showing, so the
      // last bit of scrollable content here doesn't render partially hidden underneath it -- same
      // fixed-bar-overlap bug class as MatchScreen's scoring pad (see docs/history.md's "This
      // Over" writeup), just avoided from the start here since TabBar's height never changes.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 40px + ${TAB_BAR_SAFE_BOTTOM})` : 40,
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
    onOpenAccount: onOpenAccount,
    onOpenSharedLinks: onOpenSharedLinks,
    onOpenHelp: onOpenHelp,
    onOpenFeedback: onOpenFeedback,
    onOpenAbout: onOpenAbout,
    onSignOut: onSignOut,
    themePref: themePref,
    onSetTheme: onSetTheme
  }))), pendingCount > 0 && /*#__PURE__*/React.createElement("div", {
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
  })), /*#__PURE__*/React.createElement(JoinCodeBar, {
    onJoin: onJoinCode
  }), inProgressMatches.length > 0 || sortedUpcomingFixtures.length > 0 || completedMatches.length > 0 ? /*#__PURE__*/React.createElement("div", null, inProgressMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "Saved Matches"), showSwipeHint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      opacity: 0.7
    }
  }, "← swipe to delete")), inProgressMatches.length > 0 && (sortedUpcomingFixtures.length > 0) && /*#__PURE__*/React.createElement("button", {
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
    onClick: () => {
      // Flips whatever's actually ON SCREEN right now (showUpcoming), not the raw upcomingExpanded
      // state -- before the first manual tap, those two can disagree (showUpcoming forced open by
      // the "nothing else on the page" default while upcomingExpanded is still its false initial
      // value), and toggling the raw value in that case would leave the visible state unchanged.
      setUpcomingManuallySet(true);
      setUpcomingExpanded(!showUpcoming);
    },
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
    onClick: () => {
      setCompletedManuallySet(true);
      setCompletedExpanded(!showCompleted);
    },
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
      transform: showCompleted ? "rotate(90deg)" : "none",
      transition: "transform 0.15s ease",
      flexShrink: 0
    }
  }), "Completed (", completedMatches.length, ")"), showCompleted && completedMatches.map((m, i) => renderMatchCard(m, i, { onOpen, setConfirmDeleteId, setShowSwipeHint, tournamentNameById, onGetShareCode, onGetViewCode })))) : /*#__PURE__*/React.createElement(EmptyState, {
    minHeight: "50vh"
  }, "Nothing to score right now.", /*#__PURE__*/React.createElement("br", null), "Start a match to see it here."), matchToConfirmDelete && /*#__PURE__*/React.createElement(Modal, {
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
    ? `${matchToConfirmDelete.teamA} vs ${matchToConfirmDelete.teamB} is still in progress — deleting it throws away everything scored so far, not just a finished record. This can’t be undone.`
    : `${matchToConfirmDelete.teamA} vs ${matchToConfirmDelete.teamB} will be permanently removed from your saved matches. This can’t be undone.`), /*#__PURE__*/React.createElement("div", {
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
  }, "Delete"))), /*#__PURE__*/React.createElement(FabButton, {
    onClick: onNew,
    label: "New Match"
  }));
}
