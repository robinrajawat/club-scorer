import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Btn } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { ChevronLeft, ChevronRight, Info, Trophy } from "./icons.js";
import { StandingsTable } from "./tableAtoms.js";
import { buildMapsUrl, nonStandardRulesText } from "../core/shareAndFormat.js";

// Read-only public view of a tournament's shared standings/fixtures snapshot, opened either via a
// "?tournament=CODE" link (see TournamentShareModal, which creates these) or by tapping a card in
// the Live tab's own tournaments feed (see openLiveTournament in cricketScorer.js) -- reachedInApp
// distinguishes the two: from inside the app this renders a small in-app "Back" link, while a cold
// outside visitor with nowhere else to go gets a prominent "Go to Club Scorer" CTA button instead.
// Covered by tests/unit/components/followTournamentScreen.test.js.
//
// Reads the snapshot directly via `db.collection("tournamentViews").doc(code).get()` from a
// mount-time useEffect -- `db` (the raw Firestore SDK instance, a bare global, not extracted) is
// stubbed on globalThis, same pattern as `auth` in authActionScreen.test.js.
//
// The snapshot (formatTournamentViewSnapshot, src/core/appLogic.js) carries more than just the
// points table: venue, a short format summary, a per-group breakdown when the tournament has
// groups, and a `result` line on any fixture whose match has completed. All of those are optional
// (older cached snapshots, or a tournament with no groups/venue, simply omit them), so every
// section below only renders when the data for it is actually present.
//
// A completed fixture's `result` line is tappable into the full scorecard (via onOpenMatch,
// passed the match's own plain `matchId`) whenever that match is known at all -- deliberately no
// bearer code here: /liveMatches (what FollowScreen's matchId prop reads) is already public,
// already-listable data, the same one Home's "Live now" feed has always opened matches through, so
// gating this one specific path behind a separately-minted credential was unneeded complexity, not
// an actual privacy boundary. A fixture with no matchId at all (never linked to a match) is the
// only case that stays plain, non-clickable text.

export function FollowTournamentScreen({
  code,
  onExit,
  reachedInApp = false,
  onOpenMatch
}) {
  // Plain-language "20 overs · 2 groups, top 1 advance · Semifinal, Final" summary of the
  // snapshot's `format` block -- mirrors the wording tournamentsScreen.js's own New Cup wizard
  // preview uses, so a spectator sees the same shape of description an organizer does. Returns
  // null when there's nothing worth a line for (no overs limit, no groups, no knockout stage -- a
  // bare round robin with an unset overs limit, which formatTournamentViewSnapshot can still
  // produce for an older tournament created before overs limits were mandatory).
  function formatSummaryText(format) {
    if (!format) return null;
    const parts = [];
    if (format.oversLimit) parts.push(`${format.oversLimit} overs`);
    if (format.groupsCount) parts.push(`${format.groupsCount} groups, top ${format.advancePerGroup} advance`);
    if (format.knockoutStages && format.knockoutStages.length) parts.push(format.knockoutStages.join(", "));
    return parts.length ? parts.join(" · ") : null;
  }
  const sectionCardStyle = {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
  };
  const sectionLabelStyle = {
    fontFamily: "'Inter'",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.inkSoft,
    marginBottom: 8
  };
  // Someone reaching this screen from inside the app already has a back button's worth of context
  // (they tapped a Live-tab card) -- render the same small chevron-link every other in-app screen
  // uses for that (see e.g. recordsScreen.js / matchScreen.js), not the big standalone CTA button
  // that only makes sense for a cold outside link with nowhere else to go. `onDark` picks between
  // the cream-on-green header styling and the plain pitch-on-cream styling of the loading/error
  // states, matching whichever background it sits on.
  const renderBackLink = onDark => /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: onDark ? COLORS.creamFixed : COLORS.pitch,
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      opacity: onDark ? 0.85 : 1,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Back");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | found | not-found | error
  const [error, setError] = useState("");
  const [showRulesModal, setShowRulesModal] = useState(false);
  useEffect(() => {
    if (!code) {
      setStatus("not-found");
      return;
    }
    db.collection("tournamentViews").doc(code).get().then(doc => {
      if (!doc.exists) {
        setStatus("not-found");
        return;
      }
      setData(doc.data());
      setStatus("found");
    }).catch(err => {
      console.error("[follow-tournament] load error \u2014 code:", err.code, "message:", err.message);
      setError(err.code === "permission-denied" ? "This link isn't available right now." : err.message || "Couldn't load this tournament.");
      setStatus("error");
    });
  }, [code]);
  const wrapStyle = {
    minHeight: "100vh",
    background: COLORS.cream,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,36,32,0.045) 28px)"
  };
  if (status === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(LoadingNote, {
      label: "Loading tournament\u2026",
      size: 32,
      style: {
        flexDirection: "column"
      }
    }));
  }
  if (status === "not-found" || status === "error") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center"
      }
    }, reachedInApp && /*#__PURE__*/React.createElement("div", {
      style: {
        alignSelf: "flex-start",
        marginBottom: 8
      }
    }, renderBackLink(false)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'DM Serif Display', serif",
        fontSize: 20,
        color: COLORS.pitch,
        marginBottom: 8
      }
    }, status === "not-found" ? "This link isn\u2019t valid" : "Couldn\u2019t load this tournament"), status === "error" && error && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft,
        marginBottom: 16
      }
    }, error), !reachedInApp && /*#__PURE__*/React.createElement(Btn, {
      onClick: onExit
    }, "Go to Club Scorer"));
  }
  const standings = [...data.standings].sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  const groups = data.groups ? data.groups.map(g => ({
    label: g.label,
    standings: [...g.standings].sort((a, b) => b.points - a.points || b.nrr - a.nrr)
  })) : null;
  const fixtures = data.fixtures || [];
  const completedFixtures = fixtures.filter(f => f.result);
  // BUG FIX: this used to require f.date, so an unscheduled fixture (common early in a tournament,
  // or an informal one where dates are never set at all) fell through both this filter and
  // completedFixtures above -- present in the snapshot, invisible on screen. Only the date LABEL
  // below is conditional on f.date now; the fixture itself always shows once it has no result.
  // Sorted by date/time (earliest first) rather than left in whatever order fixtures happen to be
  // generated/added in (e.g. all of Group A's matches, then all of Group B's) -- a viewer checking
  // what's coming up next wants "what's on today, in order," not the schedule grouped by pool. An
  // undated fixture has no time to sort by, so it sorts after every dated one (ISO "YYYY-MM-DDTHH:MM"
  // strings compare correctly as plain strings), keeping its position relative to other undated
  // fixtures stable rather than jumbling them.
  const scheduledFixtures = fixtures.filter(f => !f.result).sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
  const formatSummary = formatSummaryText(data.format);
  // Read-only house rules line -- reported live as a genuine miss: the in-app schedule (and the
  // review page when creating the tournament) always shows any non-standard rule (Free Hit, a
  // different wide/no-ball run value, Super Over, ...), but a spectator on this public view had no
  // way to see them at all. Reuses the exact same nonStandardRulesText summary the in-app "House
  // rules" editor's own review step already produces -- silent (null) for a tournament using
  // entirely standard rules, same "nothing non-default, nothing to show" convention as everywhere
  // else this function is used.
  const rulesSummary = nonStandardRulesText(data.rules);
  // Same "just the top row of the stats table" shortcut TournamentDetailScreen's own Orange/Purple
  // Cap callouts use -- topBatters/topBowlers already arrive from the snapshot sorted and cut to
  // the top 10 (formatTournamentViewSnapshot, src/core/appLogic.js), so there's no local
  // recomputation to do here, just picking [0].
  const orangeCap = data.topBatters && data.topBatters[0];
  const purpleCap = data.topBowlers && data.topBowlers[0];
  // Moved to sit right after the Tournament Champion card (below), not down past the whole
  // standings table -- requested live: "orange/purple cap card can also go after the champion
  // card." Both are the same kind of thing, an end-of-tournament summary callout, so they read
  // better grouped together at the top than split across the page.
  const capsCard = (orangeCap || purpleCap) && /*#__PURE__*/React.createElement("div", {
    style: sectionCardStyle
  }, orangeCap && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: purpleCap ? 10 : 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: "#e8791c"
    }
  }, "Orange Cap — most runs"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 16,
      color: COLORS.pitch
    }
  }, orangeCap.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 14,
      fontWeight: 700,
      color: COLORS.pitch
    }
  }, orangeCap.runs, " runs")), purpleCap && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: "#7b3fa0"
    }
  }, "Purple Cap — most wickets"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 16,
      color: COLORS.pitch
    }
  }, purpleCap.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 14,
      fontWeight: 700,
      color: COLORS.pitch
    }
  }, purpleCap.wickets, " wkts")));
  // Requested live once the app saw its first real tournament through to the end: a card showing
  // who won, the runner-up, and Player of the Tournament -- champion/runnerUp/playerOfTournament
  // all arrive from the snapshot already null until there's an actual decided result
  // (formatTournamentViewSnapshot, src/core/appLogic.js), same convention as topBatters/topBowlers
  // just above, so this section simply doesn't render at all before then.
  const isComplete = !!data.champion;
  // Shared by both the Results and Fixtures sections below -- used to just be a single bare
  // "teamA vs teamB" line with a result/date squeezed underneath, all crammed into one shared card.
  // Reported live: a knockout fixture proposed ahead of its round (see fixturesSection.js) showed
  // as a bare "vs" with nothing on either side, and nothing here ever showed which stage a fixture
  // even was (Final vs. an ordinary group match looked identical) or where it was being played.
  // Gives each fixture its own small card instead: a stage badge (same styling FixtureRow already
  // uses in-app) when one exists, "TBD" for a team not yet known, and a venue link (via
  // buildMapsUrl, already imported) when one's set -- same fixture-overrides-tournament-default
  // venue formatTournamentViewSnapshot now resolves before this ever sees it.
  function renderFixtureCard(f, { showResult }) {
    const dateLabel = f.date ? new Date(`${f.date}:00`).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      style: {
        background: COLORS.cream,
        borderRadius: 12,
        padding: "10px 12px",
        marginBottom: 8
      }
    }, f.stage && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: COLORS.gold,
        marginBottom: 4
      }
    }, f.stage), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 14,
        color: COLORS.ink
      }
    }, f.teamA || "TBD", " vs ", f.teamB || "TBD"), (dateLabel || f.venue) && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 4,
        fontFamily: "'Inter'",
        fontSize: 12,
        color: COLORS.inkSoft
      }
    }, dateLabel && /*#__PURE__*/React.createElement("span", null, dateLabel), f.venue && /*#__PURE__*/React.createElement("a", {
      href: buildMapsUrl(f.venue, f.venueLat, f.venueLng),
      target: "_blank",
      rel: "noopener noreferrer",
      style: {
        color: COLORS.turf,
        fontWeight: 600,
        textDecoration: "none"
      }
    }, "📍 ", f.venue)), showResult && f.result && (f.matchId && onOpenMatch ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onOpenMatch(f.matchId, f.stage),
      className: "cs-btn",
      "aria-label": `View scorecard: ${f.result}`,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        width: "100%",
        marginTop: 4,
        padding: 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "'Inter'",
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.pitch
      }
    }, f.result, /*#__PURE__*/React.createElement(ChevronRight, {
      size: 14,
      style: { flexShrink: 0, opacity: 0.7 }
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.pitch,
        marginTop: 4
      }
    }, f.result)));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrapStyle,
      paddingBottom: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(160deg, ${COLORS.turfFixed} 0%, ${COLORS.pitchFixed} 45%, ${COLORS.pitchDarkFixed} 100%)`,
      color: COLORS.creamFixed,
      padding: "20px 16px 26px"
    }
  }, reachedInApp && renderBackLink(true), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24
    }
  }, data.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.85,
      marginTop: 2
    }
  }, data.teams.length, " teams \u00b7 as of ", new Date(data.sharedAt).toLocaleString()), (formatSummary || rulesSummary) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 2
    }
  }, formatSummary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.85
    }
  }, formatSummary), rulesSummary && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowRulesModal(true),
    className: "cs-btn",
    "aria-label": "House rules",
    style: {
      background: "none",
      border: "none",
      padding: 2,
      display: "flex",
      color: COLORS.creamFixed,
      opacity: 0.85,
      cursor: "pointer",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 14
  }))), data.venue && /*#__PURE__*/React.createElement("a", {
    href: buildMapsUrl(data.venue, data.venueLat, data.venueLng),
    target: "_blank",
    rel: "noopener noreferrer",
    className: "cs-btn",
    "aria-label": `Open ${data.venue} in Maps`,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
      textDecoration: "none",
      fontFamily: "'Inter'",
      fontSize: 12.5,
      fontWeight: 600,
      color: COLORS.creamFixed,
      opacity: 0.9
    }
  }, "📍 ", data.venue)), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: "0 auto",
      padding: 16
    }
  }, isComplete && /*#__PURE__*/React.createElement("div", {
    style: {
      ...sectionCardStyle,
      background: `linear-gradient(160deg, ${COLORS.surface}, ${COLORS.cream})`,
      border: `1.5px solid ${COLORS.gold}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 16,
    color: COLORS.gold
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: COLORS.inkSoft
    }
  }, "Tournament Champion")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 22,
      color: COLORS.pitch,
      marginBottom: data.runnerUp || data.playerOfTournament ? 10 : 0
    }
  }, data.champion), data.runnerUp && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: data.playerOfTournament ? 8 : 0
    }
  }, "Runner-up: ", data.runnerUp), data.playerOfTournament && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft
    }
  }, "Player of the Tournament: ", /*#__PURE__*/React.createElement("span", {
    style: { fontWeight: 700, color: COLORS.pitch }
  }, data.playerOfTournament))), capsCard, groups ? groups.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.label
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.pitch,
      marginBottom: 8
    }
  }, g.label), /*#__PURE__*/React.createElement(StandingsTable, {
    standings: g.standings
  }))) : /*#__PURE__*/React.createElement(StandingsTable, {
    standings: standings
  }), completedFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: sectionCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "Results"), completedFixtures.map(f => renderFixtureCard(f, { showResult: true }))), scheduledFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: sectionCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "Fixtures"), scheduledFixtures.map(f => renderFixtureCard(f, { showResult: false }))), (data.topBatters || data.topBowlers) && /*#__PURE__*/React.createElement("div", {
    style: sectionCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "Stats"), data.topBatters && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: data.topBowlers ? 14 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Most runs"), data.topBatters.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      padding: "5px 0",
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("span", null, p.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, p.runs)))), data.topBowlers && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Most wickets"), data.topBowlers.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      padding: "5px 0",
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("span", null, p.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, p.wickets))))), !reachedInApp && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onExit
  }, "Go to Club Scorer"))), showRulesModal && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setShowRulesModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 18,
      color: COLORS.ink,
      marginBottom: 10
    }
  }, "House rules"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.7
    }
  }, rulesSummary)));
}
