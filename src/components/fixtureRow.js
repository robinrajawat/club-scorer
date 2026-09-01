import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { CalendarClock, Hand, Pencil, Users } from "./icons.js";
import { Btn } from "./formUiAtoms.js";
import { FixturePollSummary } from "./scoreboardAtoms.js";
import { FixtureDateTimeModal, VenueEditModal } from "./venueAndDateModals.js";
import { AvailabilityPollModal } from "./availabilityPollModal.js";
import { ISO_DATETIME_RE, formatFixtureDateTime, buildFixtureICS, buildMapsUrl, resolvePollTeams, matchResultText, matchScoreLine } from "../core/shareAndFormat.js";
import { expiresAtMillis } from "../core/miscHelpers.js";

// A single fixture row for the tournament fixtures list (a sibling of UpcomingFixtureCard, which
// covers the Home screen's own upcoming-fixtures view) -- schedule/reschedule, edit venue, remove,
// score, or send an availability poll for one fixture, with a result/score line for a fixture
// that's already been played. References Modal as a bare, unimported global (same pattern as
// ConfirmModal/playerModals.js) for its own "which team?" picker, so tests can stub
// `globalThis.Modal` without pulling in jsdom. Covered by tests/unit/components/fixtureRow.test.js.
//
// `loadFixturePollSummary` (a bare-global Firestore call, not extracted) runs from a mount-time
// useEffect, same stubbing pattern as UpcomingFixtureCard/AvailabilityPollModal/BetaTestersScreen.
// `loadTeamPolls` and `downloadTextFile` are only ever called from onClick handlers.

export function FixtureRow({
  fixture,
  tournament,
  match,
  onScore,
  onUpdateDate,
  onDelete,
  onEditVenue,
  clubs = [],
  clubTeamsById = {}
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const rawDate = fixture.date || "";
  const isIsoDate = ISO_DATETIME_RE.test(rawDate);
  const friendlyDateTime = formatFixtureDateTime(rawDate);
  // Same fixture-overrides-tournament fallback as UpcomingFixtureCard/handleEditVenueFromHome --
  // a fixture's own venue, when set, wins over the tournament's default.
  const venue = fixture.venue || tournament.venue;
  const venueLat = fixture.venue ? fixture.venueLat : tournament.venueLat;
  const venueLng = fixture.venue ? fixture.venueLng : tournament.venueLng;
  const fixtureDateStr = isIsoDate ? rawDate.split("T")[0] : null;
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollCheckBusy, setPollCheckBusy] = useState(false);
  const [existingPollCode, setExistingPollCode] = useState(null);
  const [pollTeamPickerOpen, setPollTeamPickerOpen] = useState(false);
  const [selectedPollTeam, setSelectedPollTeam] = useState(null); // {team, club}, once resolved or picked
  // Same as UpcomingFixtureCard -- quietly finds nothing (no "Send poll" button) for a fixture
  // where neither side corresponds to a roster-tracked team.
  const matchingPollTeams = resolvePollTeams(fixture.teamA, fixture.teamB, clubs, clubTeamsById);
  const [pollSummary, setPollSummary] = useState([]);
  useEffect(() => {
    let cancelled = false;
    loadFixturePollSummary(fixture.id, matchingPollTeams).then(result => {
      if (!cancelled) setPollSummary(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fixture.id, matchingPollTeams.map(e => e.team.id).join(",")]);
  async function openPollFor(club, team) {
    if (pollCheckBusy) return;
    setSelectedPollTeam({
      club,
      team
    });
    setPollCheckBusy(true);
    const pointers = await loadTeamPolls(club.id, team.id);
    const existing = pointers.find(p => p.fixtureId === fixture.id && (expiresAtMillis(p.expiresAt) == null || expiresAtMillis(p.expiresAt) > Date.now()));
    setPollCheckBusy(false);
    setExistingPollCode(existing ? existing.code : null);
    setPollModalOpen(true);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)"
    }
  }, fixture.stage && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.gold,
      marginBottom: 4
    }
  }, fixture.stage), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      color: COLORS.ink
    }
  }, fixture.teamA, " vs ", fixture.teamB), /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    className: "cs-btn",
    "aria-label": "Remove fixture",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      fontSize: 14,
      lineHeight: 1,
      padding: 4,
      flexShrink: 0
    }
  }, "\u2715")), venue ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      marginBottom: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: buildMapsUrl(venue, venueLat, venueLng),
    target: "_blank",
    rel: "noopener noreferrer",
    className: "cs-btn",
    "aria-label": `Open ${venue} in Maps`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      minWidth: 0,
      textDecoration: "none",
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.turf,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, "\uD83D\uDCCD ", venue), onEditVenue && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVenueModalOpen(true),
    className: "cs-btn",
    "aria-label": "Edit venue",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      flexShrink: 0,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 11
  }))) : onEditVenue && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVenueModalOpen(true),
    className: "cs-btn",
    "aria-label": "Add venue",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      marginBottom: 8,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 500,
      color: COLORS.turf
    }
  }, "\uD83D\uDCCD Add venue"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPickerOpen(true),
    className: "cs-btn",
    "aria-label": "Fixture date and time",
    style: {
      width: "100%",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: 6,
      textAlign: "left",
      fontFamily: "'Inter'",
      fontSize: 12.5,
      fontWeight: friendlyDateTime ? 600 : 500,
      color: friendlyDateTime ? COLORS.ink : COLORS.inkSoft,
      background: COLORS.creamDark,
      border: "none",
      borderRadius: 8,
      padding: "8px 10px",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(CalendarClock, {
    size: 14
  }), friendlyDateTime || "Set date & time"), !isIsoDate && rawDate && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      marginTop: 4
    }
  }, "Currently: \u201C", rawDate, "\u201D \u2014 tap above to replace"), pickerOpen && /*#__PURE__*/React.createElement(FixtureDateTimeModal, {
    value: isIsoDate ? rawDate : "",
    onSave: iso => {
      onUpdateDate(iso);
      setPickerOpen(false);
    },
    onClear: rawDate ? () => {
      onUpdateDate("");
      setPickerOpen(false);
    } : null,
    onClose: () => setPickerOpen(false)
  })), /*#__PURE__*/React.createElement(FixturePollSummary, {
    items: pollSummary
  }), matchingPollTeams.length > 0 && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      if (pollCheckBusy) return;
      if (matchingPollTeams.length > 1) {
        setPollTeamPickerOpen(true);
        return;
      }
      openPollFor(matchingPollTeams[0].club, matchingPollTeams[0].team);
    },
    className: "cs-btn",
    disabled: pollCheckBusy,
    "aria-label": "Send availability poll",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      flexShrink: 0,
      background: COLORS.creamDark,
      border: "none",
      borderRadius: 8,
      cursor: pollCheckBusy ? "default" : "pointer",
      opacity: pollCheckBusy ? 0.6 : 1,
      color: COLORS.turf
    }
  }, /*#__PURE__*/React.createElement(Hand, {
    size: 14
  })), fixture.date && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => downloadTextFile(`${fixture.teamA}-vs-${fixture.teamB}`.replace(/[^a-z0-9]+/gi, "-") + ".ics", "text/calendar", buildFixtureICS(fixture, tournament.name, venue, venueLat, venueLng)),
    className: "cs-btn",
    "aria-label": "Add to calendar",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      flexShrink: 0,
      background: COLORS.creamDark,
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      color: COLORS.turf
    }
  }, /*#__PURE__*/React.createElement(CalendarClock, {
    size: 14
  })), match ? /*#__PURE__*/React.createElement("button", {
    onClick: onScore,
    className: "cs-btn",
    style: {
      background: "none",
      border: `1.5px solid ${COLORS.willow}`,
      borderRadius: 8,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      padding: "7px 12px",
      cursor: "pointer",
      flexShrink: 0,
      whiteSpace: "nowrap"
    }
  }, match.status === "complete" ? matchResultText(match) || "View" : matchScoreLine(match) || "In progress") : /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: onScore,
    style: {
      padding: "7px 14px",
      fontSize: 12,
      flexShrink: 0
    }
  }, "Score")), venueModalOpen && /*#__PURE__*/React.createElement(VenueEditModal, {
    value: venue || "",
    initialLat: venueLat,
    initialLng: venueLng,
    clubs: clubs,
    onSave: (newVenue, newLat, newLng) => onEditVenue(newVenue, newLat, newLng),
    onClose: () => setVenueModalOpen(false)
  }), pollTeamPickerOpen && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setPollTeamPickerOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Which team?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16
    }
  }, `Both ${fixture.teamA} and ${fixture.teamB} are teams you manage \u2014 who's this poll for?`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, matchingPollTeams.map((entry, idx) => /*#__PURE__*/React.createElement("button", {
    key: entry.team.id,
    type: "button",
    onClick: () => {
      setPollTeamPickerOpen(false);
      openPollFor(entry.club, entry.team);
    },
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer",
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: "rgba(74,124,46,0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Users, {
    size: 13,
    style: {
      color: COLORS.turf
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      color: COLORS.ink
    }
  }, entry.team.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft
    }
  }, entry.club.name)))))), pollModalOpen && selectedPollTeam && /*#__PURE__*/React.createElement(AvailabilityPollModal, {
    clubId: selectedPollTeam.club.id,
    clubName: selectedPollTeam.club.name,
    team: selectedPollTeam.team,
    initialCode: existingPollCode || undefined,
    fixtureContext: existingPollCode ? undefined : {
      tournamentId: tournament.id,
      fixtureId: fixture.id,
      question: `Available for ${fixture.teamA} vs ${fixture.teamB}?`,
      fixtureDate: fixtureDateStr || ""
    },
    onClose: () => {
      setPollModalOpen(false);
      loadFixturePollSummary(fixture.id, matchingPollTeams).then(setPollSummary);
    }
  }));
}
