import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Btn } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { ChevronLeft } from "./icons.js";
import { StandingsTable } from "./tableAtoms.js";
import { buildMapsUrl } from "../core/shareAndFormat.js";

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

export function FollowTournamentScreen({
  code,
  onExit,
  reachedInApp = false
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
  const scheduledFixtures = fixtures.filter(f => !f.result);
  const formatSummary = formatSummaryText(data.format);
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
  }, data.teams.length, " teams \u00b7 as of ", new Date(data.sharedAt).toLocaleString()), formatSummary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.85,
      marginTop: 2
    }
  }, formatSummary), data.venue && /*#__PURE__*/React.createElement("a", {
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
  }, groups ? groups.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
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
  }, "Results"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink
    }
  }, completedFixtures.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      padding: "8px 0",
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, f.teamA, " vs ", f.teamB), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      marginTop: 2
    }
  }, f.result))))), scheduledFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: sectionCardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "Fixtures"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      lineHeight: 2
    }
  }, scheduledFixtures.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id
  }, f.date && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 12
    }
  }, new Date(`${f.date}:00`).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }), " \u2014 "), f.teamA, " vs ", f.teamB)))), !reachedInApp && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onExit
  }, "Go to Club Scorer"))));
}
