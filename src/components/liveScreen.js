import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { Bell, ChevronRight, Trophy } from "./icons.js";
import { TextField } from "./formUiAtoms.js";
import { EmptyState, LoadingNote, AppMark } from "./illustrations.js";
import { matchScoreLine, formatFixtureDateTime } from "../core/shareAndFormat.js";
import { greetingPrefix, matchDateTimeLabel } from "../core/miscHelpers.js";
import { TAB_BAR_HEIGHT, TAB_BAR_SAFE_BOTTOM } from "./tabBar.js";
import { AuthBar } from "./authBar.js";

// The Live tab: the app-wide, unbounded view of the two live feeds (/liveMatches,
// /liveTournaments). A match card opens the live scoring/scorecard screen, a tournament card
// opens FollowTournamentScreen's read-only standings snapshot -- a tournament here is for
// watching a table, not scoring.
//
// Structured as two independent axes rather than one flat, recency-sorted scroll: WHAT (Matches /
// Tournaments -- different destinations, so never interleaved) and WHEN (Live / Results, or Live /
// Recently Finished for tournaments -- since a finished tournament showing under a section
// literally called "Live" read as a labeling bug, reported live, even once it was split out into
// its own clearly-headed section: "finished living inside live is misleading"). There's no page
// title repeating "Live" above these either, for the same reason -- this screen's own former big
// "Live" header, sitting directly above a "Results"/"Recently Finished" tab, was the more literal
// version of the same complaint: a page branded "Live" containing content that plainly isn't.
// Live/Results and Live/Recently Finished are peers here, not a page identity with an escape
// hatch; only the persistent bottom-nav tab is still named "Live" (a nav label, not a claim about
// what's inside).
//
// Which pill is selected first still defaults to Live, but only when that's actually true: the
// one-time effect below (autoTabPicked) flips a segment's default to Results/Recently Finished
// instead, the first time real data settles in with nothing currently live -- reported live,
// "Live can not be the entry point for general results/fixtures... if the match/tournament is not
// ongoing or upcoming." It only runs once per mount, so a live match starting or finishing later
// in the same session never yanks the tab out from under whichever one someone's actually looking
// at.
//
// A search box filters both feeds client-side (already fully loaded in memory, same as everywhere
// else this pattern's used) by team name, tournament name, or the tournament badge a match shows,
// narrowing whichever tab is currently open -- same persistent-inline-box placement as Home's own
// search.
//
// Carries the exact same header treatment regardless of whether anyone's signed in: AppMark +
// "Club Scorer" brand mark, a real AuthBar (same component HomeScreen's header uses, already built
// to handle a signed-out `user` -- "Sign in" instead of an avatar, Help/Feedback/About always
// available regardless), and a time-of-day greeting -- Live is a real landing page (see
// cricketScorer.js's own cold-landing comment, and the fix that keeps a returning signed-in visitor
// here too instead of bouncing to Home), not a separate stripped-down "watcher" shell one register
// down from every other tab -- reported live, "why landing page still feel disconnected... seems
// like we are still having a separate watcher page." Tapping the brand itself doesn't navigate
// anywhere (this already IS the landing screen) -- it resets the search and re-picks
// Live/Fixtures/Results fresh, same as "click on the brand... bring it back to the landing page"
// asked for. This AuthBar is also the only way back to sign-in for a signed-out visitor -- a
// separate "Sign in to score a match" link used to sit at the bottom of the screen too, reported
// live as redundant once AuthBar's own "Sign in" did the exact same thing ("instead sign in on top
// can lead to old signin landing page"), so it's gone. A signed-in visitor gets a second AuthBar
// here on top of Home's own, one tab away -- an accepted, deliberate bit of redundancy now that
// this header is unconditional, the same tradeoff every other tab already makes for its own
// consistent per-screen chrome. Account/Help/Feedback/About all return to wherever they were
// actually opened from (settingsReturnScreen in cricketScorer.js), not hardcoded back to Home.
//
// Matches' third pill, Fixtures, is every publicly-live tournament's own upcoming, unplayed
// fixtures (liveTournaments[].upcomingFixtures -- see pickUpcomingFixtures in appLogic.js and its
// mirror-write in index.html's shareTournament/refreshTournamentStandingsLive), flattened across
// every tournament and re-sorted nearest-first -- there's still no per-match "upcoming" concept
// outside a tournament (a standalone match is only ever created the moment someone starts
// scoring it), so this only ever surfaces tournament fixtures, same as FollowTournamentScreen's
// own Fixtures section for one specific tournament. Tapping a fixture opens its tournament (no
// scorecard exists yet to open instead) via the same onOpenLiveTournament prop tournament rows
// use.
//
// The smart Live default (autoTabPicked, above) now prefers Fixtures over Results when nothing's
// currently live but something IS coming up -- "starting soon" reads as more "live-adjacent" than
// a stale old result does.
//
// Results is everyone else's public completed matches (from liveMatches), read-only, opens
// FollowScreen -- reported live, "home should be a feed page only for public matches". This
// account's OWN matches (in-progress and completed alike) are administered from the Score tab
// instead now, the same way Cups is the admin home for tournaments/series -- see homeScreen.js's
// own Completed section for that. A match this account also owns and has shared publicly still
// shows here too, same as a public tournament shows on both Cups (admin) and Home (browse): once
// as a plain read-only row like any spectator sees it, and separately with full owner controls on
// Score.
//
// Covered by tests/unit/components/liveScreen.test.js.
export function LiveScreen({
  liveMatches = [],
  onOpenLiveMatch,
  liveTournaments = [],
  onOpenLiveTournament,
  tournamentNameById = {},
  showTabBar = false,
  loading = false,
  user,
  profile,
  onOpenAccount,
  onOpenInbox,
  inboxBadgeCount = 0,
  onOpenHelp,
  onOpenFeedback,
  onOpenAbout,
  onSignOut,
  themePref,
  onSetTheme
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("matches"); // matches | tournaments
  const [matchTab, setMatchTab] = useState("live"); // live | fixtures | results
  const [tourneyTab, setTourneyTab] = useState("live"); // live | finished

  // Every publicly-live tournament's own upcoming fixtures, flattened into one app-wide,
  // nearest-first list (each tournament's own slice already arrives pre-sorted -- see
  // pickUpcomingFixtures's own comment -- but interleaving multiple tournaments needs a re-sort).
  // `_key` disambiguates fixture ids that are only ever unique within their own tournament, not
  // globally, once flattened together here.
  const allFixtures = liveTournaments.flatMap(t => (t.upcomingFixtures || []).map(f => ({
    ...f,
    _key: `${t.tournamentId}:${f.id}`,
    tournamentId: t.tournamentId,
    tournamentShareCode: t.shareCode,
    tournamentName: t.name
  }))).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  // Live > Fixtures > Results, in that order of how "live-adjacent" each one reads -- reused by
  // both the auto-pick effect below and the brand header's own tap-to-reset.
  function pickDefaultMatchTab() {
    if (liveMatches.some(m => m.status !== "complete")) return "live";
    if (allFixtures.length > 0) return "fixtures";
    return "results";
  }
  function pickDefaultTourneyTab() {
    return liveTournaments.some(t => !t.champion) ? "live" : "finished";
  }
  // Which segment (Matches vs Tournaments) to land on isn't hardcoded to Matches either -- same
  // smart-default idea, one level up: whichever segment actually has the most "live-adjacent"
  // content wins, ranked live match > upcoming fixture > live tournament > finished match >
  // finished tournament. Reported live: a tournament that finished YESTERDAY sat one tap away
  // under Tournaments while a default-selected, entirely empty Matches segment greeted a
  // first-time visitor instead -- optimizing WHEN within a segment but never asking WHICH segment
  // was the same mistake the original Live-pill default was built to fix.
  //
  // Fixtures outranks "live tournament" deliberately: `!t.champion` is also true for a tournament
  // that simply hasn't started yet (zero matches played, nothing decided) -- there's no separate
  // "genuinely in progress" signal on the lean /liveTournaments mirror to tell that apart from one
  // that's actually mid-bracket. A concrete upcoming fixture (an opponent, a date) is more useful
  // to land on than a bare tournament card with only a team count, so it wins the tie.
  function pickDefaultView() {
    if (liveMatches.some(m => m.status !== "complete")) return "matches";
    if (allFixtures.length > 0) return "matches";
    if (liveTournaments.some(t => !t.champion)) return "tournaments";
    if (liveMatches.some(m => m.status === "complete")) return "matches";
    if (liveTournaments.some(t => t.champion)) return "tournaments";
    return "matches";
  }
  // Reported live: "no way to reopen the landing page... perhaps click on the brand should bring
  // it to landing page" -- the brand header (below) is that tap target. There's nowhere else to
  // navigate to (this screen already IS the landing page), so this clears the search and re-runs
  // the same smart-default picks fresh, rather than navigating anywhere.
  function resetToLanding() {
    setQuery("");
    setView(pickDefaultView());
    setMatchTab(pickDefaultMatchTab());
    setTourneyTab(pickDefaultTourneyTab());
  }

  // See this file's own top comment -- flips a segment's default pill (and, now, the segment
  // itself) away from Live/Matches, once, the first time real data settles in with nothing
  // currently live. Guarded by a ref (not state) so it can never fire a second time and fight a
  // choice made after that.
  const autoTabPicked = useRef(false);
  useEffect(() => {
    if (loading || autoTabPicked.current) return;
    autoTabPicked.current = true;
    setView(pickDefaultView());
    setMatchTab(pickDefaultMatchTab());
    setTourneyTab(pickDefaultTourneyTab());
  }, [loading, liveMatches, liveTournaments, allFixtures]);

  // tournamentNameById only knows this account's own tournaments, liveTournaments (the public
  // mirror) fills the gap for anyone else's non-private one, and a match whose tournament is
  // neither just gets no badge at all.
  const liveTournamentNameById = {};
  liveTournaments.forEach(t => {
    liveTournamentNameById[t.tournamentId] = t.name;
  });
  const tournamentNameForBadge = id => tournamentNameById[id] || liveTournamentNameById[id] || null;
  const q = query.trim().toLowerCase();
  const filteredMatches = q ? liveMatches.filter(m => m.teamA.toLowerCase().includes(q) || m.teamB.toLowerCase().includes(q) || (tournamentNameForBadge(m.tournamentId) || "").toLowerCase().includes(q)) : liveMatches;
  const filteredTournaments = q ? liveTournaments.filter(t => t.name.toLowerCase().includes(q)) : liveTournaments;
  const filteredFixtures = q ? allFixtures.filter(f => f.teamA.toLowerCase().includes(q) || f.teamB.toLowerCase().includes(q) || f.tournamentName.toLowerCase().includes(q)) : allFixtures;
  // m.status is the match's own real status; a tournament has no single status field, so
  // `champion` (see renderTournamentRow's own comment) stands in for it here too.
  const liveNowMatches = filteredMatches.filter(m => m.status !== "complete");
  // Most recently played first -- the /liveMatches mirror's own query orders by updatedAt (last
  // write to the mirror doc), not by when the match was actually played, so those can disagree
  // (e.g. a later edit, or a batch of matches mirrored in a different order than they were
  // played). Reported live: results showing in no discernible time order. Sorted client-side by
  // createdAt instead, same field the date/time under each result actually displays.
  const finishedMatches = filteredMatches.filter(m => m.status === "complete").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const liveNowTournaments = filteredTournaments.filter(t => !t.champion);
  const finishedTournaments = filteredTournaments.filter(t => t.champion);

  function segmentedControl(options, active, onSelect) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        background: COLORS.creamDark,
        padding: 4,
        borderRadius: 12,
        marginBottom: 18
      }
    }, options.map(opt => /*#__PURE__*/React.createElement("button", {
      key: opt.key,
      type: "button",
      onClick: () => onSelect(opt.key),
      className: "cs-btn",
      "aria-pressed": active === opt.key,
      style: {
        flex: 1,
        border: "none",
        borderRadius: 9,
        padding: "9px 0",
        cursor: "pointer",
        fontFamily: "'Inter'",
        fontSize: 13,
        fontWeight: 700,
        background: active === opt.key ? COLORS.surface : "transparent",
        color: active === opt.key ? COLORS.pitch : COLORS.inkSoft,
        boxShadow: active === opt.key ? "0 1px 3px rgba(42,36,32,0.08)" : "none"
      }
    }, opt.label)));
  }

  // A pill-row sub-selector (Live/Results, Live/Recently Finished) -- distinct from the segmented
  // control above (that one swaps WHAT you're browsing; this one swaps WHEN). `accentColor` is the
  // active pill's own color (red for matches' Live, gold for tournaments' Live) -- Results/
  // Recently Finished always uses the same muted ink-soft tone regardless, since "this is over"
  // isn't a state that should compete visually with "this is live right now."
  function tabPills(options, active, onSelect) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginBottom: 18
      }
    }, options.map(opt => {
      const isActive = active === opt.key;
      const color = isActive ? opt.accentColor || COLORS.pitch : COLORS.inkSoft;
      return /*#__PURE__*/React.createElement("button", {
        key: opt.key,
        type: "button",
        onClick: () => onSelect(opt.key),
        className: "cs-btn",
        "aria-pressed": isActive,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1.5px solid ${isActive ? color : COLORS.cardDivider}`,
          borderRadius: 20,
          padding: "7px 14px",
          cursor: "pointer",
          fontFamily: "'Inter'",
          fontSize: 12.5,
          fontWeight: 700,
          background: isActive ? color : COLORS.surface,
          color: isActive ? COLORS.creamFixed : COLORS.inkSoft
        }
      }, opt.dot && /*#__PURE__*/React.createElement("span", {
        "aria-hidden": "true",
        style: { width: 6, height: 6, borderRadius: "50%", background: isActive ? COLORS.creamFixed : COLORS.live }
      }), opt.label);
    }));
  }

  function liveRow(key, onClick, content) {
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      type: "button",
      onClick: onClick,
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
      style: { minWidth: 0, flex: 1 }
    }, content), /*#__PURE__*/React.createElement(ChevronRight, {
      size: 17,
      style: { color: COLORS.inkSoft, opacity: 0.55, flexShrink: 0 }
    }));
  }

  function renderMatchRow(m) {
    return liveRow(m.id, () => onOpenLiveMatch && onOpenLiveMatch(m.id), /*#__PURE__*/React.createElement(React.Fragment, null, m.tournamentId && /*#__PURE__*/React.createElement("div", {
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
    }), tournamentNameForBadge(m.tournamentId), m.stage && ` · ${m.stage}`), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 14,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, m.teamA, " ", /*#__PURE__*/React.createElement("span", {
      style: { color: COLORS.inkSoft, fontWeight: 500 }
    }, "vs"), " ", m.teamB), matchScoreLine(m) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12.5,
        fontWeight: 600,
        color: COLORS.inkSoft,
        marginTop: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, matchScoreLine(m)), matchDateTimeLabel(m.createdAt) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft,
        marginTop: 3
      }
    }, matchDateTimeLabel(m.createdAt))));
  }

  // No scorecard exists yet for an unplayed fixture -- opens its tournament instead (the same
  // destination a tournament row's own tap uses), where the fixture already shows in
  // FollowTournamentScreen's own Fixtures section with full context (venue, stage, the rest of
  // the schedule).
  function renderFixtureRow(f) {
    const when = formatFixtureDateTime(f.date || "");
    return liveRow(f._key, () => onOpenLiveTournament && onOpenLiveTournament(f.tournamentShareCode), /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
    }), f.tournamentName), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 14,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, f.teamA, " ", /*#__PURE__*/React.createElement("span", {
      style: { color: COLORS.inkSoft, fontWeight: 500 }
    }, "vs"), " ", f.teamB), when && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12.5,
        fontWeight: 600,
        color: COLORS.inkSoft,
        marginTop: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, when)));
  }

  function renderTournamentRow(t) {
    // `champion` (null until the tournament actually has a decided result -- see
    // formatTournamentViewSnapshot in appLogic.js, and shareTournament/refreshTournamentStandingsLive
    // in index.html, which mirror it onto this same /liveTournaments doc) means the difference
    // between "browsing to check on a live tournament's standings" and "browsing to see who won" --
    // shown right here so a viewer gets that answer without tapping in at all.
    return liveRow(t.tournamentId, () => onOpenLiveTournament && onOpenLiveTournament(t.shareCode), /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 14,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12.5,
        fontWeight: 600,
        color: t.champion ? COLORS.gold : COLORS.inkSoft,
        marginTop: 3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, t.champion ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Trophy, {
      size: 12,
      style: { verticalAlign: "-1.5px", marginRight: 3 }
    }), t.champion, " won") : `${t.teamsCount} team${t.teamsCount === 1 ? "" : "s"}`)));
  }

  const homeGreetingName = user ? (profile && profile.displayName ? profile.displayName : user.displayName || "").trim().split(" ")[0] : "";
  const homeGreeting = homeGreetingName ? `${greetingPrefix()}, ${homeGreetingName}` : `${greetingPrefix()}!`;

  const rawEmpty = liveMatches.length === 0 && liveTournaments.length === 0;
  const filteredEmpty = filteredMatches.length === 0 && filteredTournaments.length === 0 && filteredFixtures.length === 0;

  const isMatches = view === "matches";
  const currentList = isMatches ? matchTab === "live" ? liveNowMatches : matchTab === "fixtures" ? filteredFixtures : finishedMatches : tourneyTab === "live" ? liveNowTournaments : finishedTournaments;
  const currentRenderer = isMatches ? matchTab === "fixtures" ? renderFixtureRow : renderMatchRow : renderTournamentRow;
  // Shown only when the search itself found something (filteredEmpty already covers "nothing at
  // all"), but the specific tab currently open happens to have none of it -- e.g. a search that
  // only matches a finished match, while sitting on the Live tab.
  const emptyForTab = !filteredEmpty && currentList.length === 0 ? isMatches ? matchTab === "live" ? "No live matches right now." : matchTab === "fixtures" ? "No upcoming fixtures right now." : "No results yet." : tourneyTab === "live" ? "No live tournaments right now." : "No tournaments have finished yet." : null;

  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20,
      paddingLeft: 16,
      paddingRight: 16,
      // See the matching comment in homeScreen.js's own root style -- reserves clearance under
      // the fixed TabBar when it's showing.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 60px + ${TAB_BAR_SAFE_BOTTOM})` : 60,
      maxWidth: 560,
      margin: "0 auto",
      // Lets EmptyState (flex: 1 on itself) center in whatever space is actually left under the
      // header, rather than a fixed vh fraction of the whole screen -- see its own comment.
      display: "flex",
      flexDirection: "column",
      minHeight: "100dvh"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: resetToLanding,
    className: "cs-btn",
    "aria-label": "Club Scorer — back to the top",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(AppMark, {
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#141414"
    }
  }, "Club"), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.gold
    }
  }, "Scorer"))), /*#__PURE__*/React.createElement("div", {
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
      boxShadow: `0 0 0 1.5px ${COLORS.creamFixed}`
    }
  }, inboxBadgeCount > 9 ? "9+" : inboxBadgeCount)), /*#__PURE__*/React.createElement(AuthBar, {
    user: user,
    profile: profile,
    onOpenAccount: onOpenAccount,
    onOpenHelp: onOpenHelp,
    onOpenFeedback: onOpenFeedback,
    onOpenAbout: onOpenAbout,
    onSignOut: onSignOut,
    themePref: themePref,
    onSetTheme: onSetTheme
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 16,
      color: COLORS.pitch,
      marginBottom: 20
    }
  }, homeGreeting), rawEmpty && loading && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px"
    }
  }, /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading…",
    size: 22,
    style: { justifyContent: "center" }
  })), rawEmpty && !loading && /*#__PURE__*/React.createElement(EmptyState, null, "Nothing live right now."), !rawEmpty && /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement(TextField, {
      value: query,
      onChange: setQuery,
      placeholder: "Search live matches, fixtures & tournaments…",
      style: { paddingRight: 38 }
    }), query ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setQuery(""),
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
    }, "×") : null),
    filteredEmpty ? /*#__PURE__*/React.createElement(EmptyState, null, "Nothing matches “", query, "”.") : /*#__PURE__*/React.createElement(React.Fragment, null,
      segmentedControl([
        { key: "matches", label: "Matches" },
        { key: "tournaments", label: "Tournaments" }
      ], view, setView),
      isMatches ? tabPills([
        { key: "live", label: `Live (${liveNowMatches.length})`, dot: true, accentColor: COLORS.live },
        { key: "fixtures", label: `Fixtures (${filteredFixtures.length})`, accentColor: COLORS.gold },
        { key: "results", label: `Results (${finishedMatches.length})`, accentColor: COLORS.inkSoft }
      ], matchTab, setMatchTab) : tabPills([
        { key: "live", label: `Live (${liveNowTournaments.length})`, accentColor: COLORS.gold },
        { key: "finished", label: `Recently Finished (${finishedTournaments.length})`, accentColor: COLORS.inkSoft }
      ], tourneyTab, setTourneyTab),
      emptyForTab ? /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: "'Inter'",
          fontSize: 13,
          color: COLORS.inkSoft,
          textAlign: "center",
          padding: "24px 0"
        }
      }, emptyForTab) : currentList.map(currentRenderer)
    )
  ));
}
