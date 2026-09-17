import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { CalendarClock, Pencil, Trophy } from "./icons.js";
import { Btn, AlertModal } from "./formUiAtoms.js";
import { FixtureDateTimeModal, VenueEditModal } from "./venueAndDateModals.js";
import { ISO_DATETIME_RE, formatFixtureDateTime, buildFixtureICS, buildMapsUrl } from "../core/shareAndFormat.js";
import { weatherCodeInfo } from "../core/miscHelpers.js";

// An upcoming fixture card for the Home screen (search results and the always-visible Upcoming
// section both use this): schedule date/time, edit venue (with a weather forecast once a verified
// address + upcoming date line up), and add to calendar. Own component rather than a plain render
// function -- it needs its own state for several inline modals, and hooks can't safely live in a
// function invoked via .map() the way a real component instance can. Covered by
// tests/unit/components/upcomingFixtureCard.test.js.
//
// `fetchFixtureWeather` (a bare-global network function, not extracted) runs from a mount-time
// useEffect, same stubbing pattern as BetaTestersScreen. `downloadTextFile` (a bare global too) is
// only ever called from its own onClick handler.
//
// Used to also have its own "Share match details" button (a plain-text blurb, separate from
// ShareMenu's invite-to-help-score) -- removed along with the app's other redundant share
// surfaces, see shareMenus.js's own comment.

export function UpcomingFixtureCard({
  tournament: t,
  fixture: f,
  index: i,
  onOpenTournament,
  onScheduleFixture,
  onStartFixture,
  onEditVenue,
  clubs = []
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  // Replaces the two plain window.alert() calls below with something styled to match the rest of
  // the app instead of an OS popup -- string | null.
  const [alertMessage, setAlertMessage] = useState(null);
  // A fixture's own venue overrides the tournament's default -- matches can be held across
  // multiple grounds regardless of who's organizing it, so the tournament's venue is only a
  // starting point every fixture inherits until it's given one of its own.
  const venue = f.venue || t.venue;
  const venueLat = f.venue ? f.venueLat : t.venueLat;
  const venueLng = f.venue ? f.venueLng : t.venueLng;
  const [weather, setWeather] = useState(null);
  const friendlyDateTime = formatFixtureDateTime(f.date || "");
  const fixtureDateStr = ISO_DATETIME_RE.test(f.date || "") ? f.date.split("T")[0] : null;
  // Open-Meteo's forecast horizon is 16 days -- outside that window (or for a fixture with no
  // scheduled date, or a venue with no verified coordinates) there's simply nothing to show, so
  // this quietly does nothing rather than showing a permanent "no forecast yet" placeholder.
  useEffect(() => {
    if (!fixtureDateStr || venueLat == null || venueLng == null) {
      setWeather(null);
      return;
    }
    const daysOut = Math.floor((new Date(fixtureDateStr + "T00:00:00") - new Date(new Date().toDateString())) / 86400000);
    if (daysOut < 0 || daysOut > 15) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    fetchFixtureWeather(venueLat, venueLng, fixtureDateStr).then(result => {
      if (!cancelled) setWeather(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureDateStr, venueLat, venueLng]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)",
      animation: `cs-slideUp 0.3s ease ${i * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onOpenTournament(t),
    className: "cs-btn",
    style: {
      display: "block",
      flex: 1,
      minWidth: 0,
      textAlign: "left",
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
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
  }), t.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14.5,
      color: COLORS.ink
    }
  }, f.teamA, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontWeight: 500
    }
  }, "vs"), " ", f.teamB))), venue ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      marginTop: 2,
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
      marginTop: 2,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 500,
      color: COLORS.turf
    }
  }, "\uD83D\uDCCD Add venue"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, onScheduleFixture ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setPickerOpen(true),
    className: "cs-btn",
    "aria-label": "Fixture date and time",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: friendlyDateTime ? 600 : 500,
      color: friendlyDateTime ? COLORS.inkSoft : COLORS.turf
    }
  }, /*#__PURE__*/React.createElement(CalendarClock, {
    size: 12
  }), friendlyDateTime || "Set date & time") : /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft
    }
  }, friendlyDateTime || "Not yet scheduled")), weather && /*#__PURE__*/React.createElement("div", {
    "aria-label": `Forecast: ${weatherCodeInfo(weather.code).label}, ${weather.tempMin}\u2013${weather.tempMax}\u00b0C`,
    title: `${weatherCodeInfo(weather.code).label} \u00b7 ${weather.tempMin}\u2013${weather.tempMax}\u00b0C \u00b7 ${weather.precipProbability}% rain`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 3,
      flexShrink: 0,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, weatherCodeInfo(weather.code).emoji, " ", weather.tempMin, "\u2013", weather.tempMax, "\u00b0"), f.date && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => downloadTextFile(`${f.teamA}-vs-${f.teamB}`.replace(/[^a-z0-9]+/gi, "-") + ".ics", "text/calendar", buildFixtureICS(f, t.name, venue, venueLat, venueLng)),
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
  })), onStartFixture && /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => onStartFixture(t, f),
    style: {
      padding: "7px 14px",
      fontSize: 12,
      flexShrink: 0
    }
  }, "Start match")), pickerOpen && /*#__PURE__*/React.createElement(FixtureDateTimeModal, {
    value: f.date || "",
    onSave: async iso => {
      // Firestore security rules are the real enforcement here (only the owner can write), not
      // any client-side check -- so a non-owner's save can still fail server-side even though the
      // button was tappable. Surface that instead of closing the modal as if it worked.
      const result = await onScheduleFixture(t, f.id, iso);
      if (result && result.ok === false) {
        setAlertMessage(result.error || "Couldn't schedule this fixture.");
        return;
      }
      setPickerOpen(false);
    },
    onClear: f.date ? async () => {
      const result = await onScheduleFixture(t, f.id, "");
      if (result && result.ok === false) {
        setAlertMessage(result.error || "Couldn't update this fixture.");
        return;
      }
      setPickerOpen(false);
    } : null,
    onClose: () => setPickerOpen(false)
  }), venueModalOpen && /*#__PURE__*/React.createElement(VenueEditModal, {
    value: venue || "",
    initialLat: venueLat,
    initialLng: venueLng,
    clubs: clubs,
    onSave: (newVenue, newLat, newLng) => onEditVenue(t, f, newVenue, newLat, newLng),
    onClose: () => setVenueModalOpen(false)
  }), alertMessage && /*#__PURE__*/React.createElement(AlertModal, {
    message: alertMessage,
    onClose: () => setAlertMessage(null)
  }));
}
