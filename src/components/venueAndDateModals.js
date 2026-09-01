import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, ChevronRight } from "./icons.js";
import { TextField, Btn } from "./formUiAtoms.js";
import { parseFixtureDateTime, buildFixtureIso } from "../core/shareAndFormat.js";

// Fixture scheduling modals: VenueEditModal (address search with a club-address shortcut, feeding
// the weather forecast card) and FixtureDateTimeModal (a small custom date/time picker, using
// WEEKDAY_LABELS/MONTH_LABELS below). Covered by tests/unit/components/venueAndDateModals.test.js.
//
// Both reference Modal as a bare, unimported global (same pattern as ConfirmModal/playerModals.js)
// so tests can stub globalThis.Modal without pulling in jsdom. VenueEditModal's address search
// (`searchAddress`, a debounced Nominatim fetch call, defined in docs/index.html, not extracted --
// network-touching and side-effecting) is gated behind a 400ms setTimeout and a 3-character
// minimum; tests exercise venue.length < 3 and the independent club-address-shortcut path
// (clubMatches, computed with no debounce at all) without ever reaching that timer, since
// triggering it for real would mean either waiting out 400ms per test or risking a leaked timer if
// a test doesn't unmount before it fires.

export function VenueEditModal({
  value,
  initialLat,
  initialLng,
  clubs = [],
  onSave,
  onClose
}) {
  const [venue, setVenueValue] = useState(value || "");
  // Verified coordinates from picking a real address suggestion -- cleared the moment the person
  // edits the text further, since a hand-edited string no longer necessarily matches the address
  // that produced these coordinates, and a stale wrong location silently feeding the weather card
  // would be worse than no location at all.
  const [coords, setCoords] = useState(initialLat != null && initialLng != null ? {
    lat: initialLat,
    lng: initialLng
  } : null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Most fixtures actually happen at a ground the person's own club already has an address for
  // (see updateClubAddress) -- surfacing those first, before any free-text search, means the
  // common case is a single tap instead of retyping/re-searching an address that's already on
  // file. Shown with no query needed (an empty venue field lists every club with a saved address)
  // and narrowed by name or address text once typing starts; only clubs with verified coordinates
  // count, since an unverified address string wouldn't give the weather card anything usable
  // anyway. Falls through to the existing free-text Nominatim search below regardless -- this is a
  // shortcut in front of that, not a replacement for it.
  const q = venue.trim().toLowerCase();
  const clubMatches = coords ? [] : clubs.filter(c => c.address && c.addressLat != null && c.addressLng != null).filter(c => !q || c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
  // Debounced address search -- one Nominatim request per pause in typing, not per keystroke, both
  // to stay comfortably under their 1 request/second usage policy and because there's no reason to
  // search on every character.
  useEffect(() => {
    if (coords) return; // just picked a suggestion -- don't immediately re-search its own label
    if (venue.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const results = await searchAddress(venue.trim());
      setSuggestions(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [venue, coords]);
  function pickClub(c) {
    setVenueValue(c.address);
    setCoords({
      lat: c.addressLat,
      lng: c.addressLng
    });
    setSuggestions([]);
  }
  function pickSuggestion(s) {
    setVenueValue(s.label);
    setCoords({
      lat: s.lat,
      lng: s.lng
    });
    setSuggestions([]);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onSave(venue.trim(), coords ? coords.lat : null, coords ? coords.lng : null);
    setBusy(false);
    if (result && result.ok === false) {
      setError(result.error || "Couldn't save the venue.");
      return;
    }
    onClose();
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: busy ? () => {} : onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 16
    }
  }, "Edit venue"), /*#__PURE__*/React.createElement(TextField, {
    value: venue,
    onChange: v => {
      setVenueValue(v);
      setCoords(null);
    },
    placeholder: "e.g. Riverside Ground",
    onKeyDown: e => {
      if (e.key === "Enter" && suggestions.length === 0 && clubMatches.length === 0) save();
    }
  }), coords && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.turf,
      marginTop: 5
    }
  }, "\u2713 Address verified \u2014 weather forecast will be available for this fixture"), clubMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Your clubs"), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${COLORS.cardDivider}`,
      borderRadius: 10,
      overflow: "hidden"
    }
  }, clubMatches.map((c, idx) => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    type: "button",
    onClick: () => pickClub(c),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: "none",
      borderBottom: idx < clubMatches.length - 1 ? `1px solid ${COLORS.cardDivider}` : "none",
      padding: "8px 10px",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ink
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0
    }
  }, "\uD83C\uDFDF\uFE0F"), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: COLORS.inkSoft,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, c.address)))))), !coords && clubMatches.length === 0 && suggestions.length === 0 && !searching && venue.trim().length >= 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      marginTop: 5
    }
  }, "No address match \u2014 you can still save this as free text, but weather won't be available"), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      border: `1px solid ${COLORS.cardDivider}`,
      borderRadius: 10,
      overflow: "hidden"
    }
  }, suggestions.map((s, idx) => /*#__PURE__*/React.createElement("button", {
    key: idx,
    type: "button",
    onClick: () => pickSuggestion(s),
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: "none",
      borderBottom: idx < suggestions.length - 1 ? `1px solid ${COLORS.cardDivider}` : "none",
      padding: "8px 10px",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ink
    }
  }, s.label))), error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.live,
      marginTop: 6
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onClose,
    disabled: busy,
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: save,
    disabled: busy,
    style: {
      flex: 1
    }
  }, busy ? "\u2026" : "Save")));
}

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function FixtureDateTimeModal({
  value,
  onSave,
  onClear,
  onClose
}) {
  const initial = parseFixtureDateTime(value || "");
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [selYear, setSelYear] = useState(initial.year);
  const [selMonth, setSelMonth] = useState(initial.month);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState(initial.period);
  function pickDay(d) {
    setDay(d);
    setSelYear(viewYear);
    setSelMonth(viewMonth);
  }
  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  const isSelected = d => d && day === d && selMonth === viewMonth && selYear === viewYear;
  const today = new Date();
  const isToday = d => d && viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
  function save() {
    if (!day) return;
    onSave(buildFixtureIso(selYear, selMonth, day, hour12, minute, period));
  }
  const selectStyle = {
    flex: 1,
    minWidth: 0,
    fontFamily: "'Inter'",
    fontSize: 13,
    padding: "8px 6px",
    borderRadius: 8,
    border: `1px solid ${COLORS.willow}`,
    background: COLORS.surface,
    color: COLORS.ink
  };
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 14
    }
  }, "Fixture date & time"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => changeMonth(-1),
    className: "cs-btn",
    "aria-label": "Previous month",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 6,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14,
      color: COLORS.ink
    }
  }, MONTH_LABELS[viewMonth], " ", viewYear), /*#__PURE__*/React.createElement("button", {
    onClick: () => changeMonth(1),
    className: "cs-btn",
    "aria-label": "Next month",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 6,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(ChevronRight, {
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      marginBottom: 4
    }
  }, WEEKDAY_LABELS.map(w => /*#__PURE__*/React.createElement("div", {
    key: w,
    style: {
      textAlign: "center",
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      padding: "4px 0"
    }
  }, w))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 2,
      marginBottom: 18
    }
  }, cells.map((d, i) => d === null ? /*#__PURE__*/React.createElement("div", {
    key: `blank-${i}`
  }) : /*#__PURE__*/React.createElement("button", {
    key: d,
    onClick: () => pickDay(d),
    className: "cs-btn",
    style: {
      aspectRatio: "1",
      border: "none",
      borderRadius: 999,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      fontWeight: isSelected(d) ? 700 : 500,
      cursor: "pointer",
      background: isSelected(d) ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : "transparent",
      color: isSelected(d) ? "#fff" : COLORS.ink,
      boxShadow: isSelected(d) ? "0 2px 8px rgba(45,80,22,0.35)" : "none",
      outline: !isSelected(d) && isToday(d) ? `1.5px solid ${COLORS.willow}` : "none",
      outlineOffset: "-1.5px"
    }
  }, d))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, "Time"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: hour12,
    onChange: e => setHour12(Number(e.target.value)),
    "aria-label": "Hour",
    style: selectStyle
  }, Array.from({
    length: 12
  }, (_, i) => i + 1).map(h => /*#__PURE__*/React.createElement("option", {
    key: h,
    value: h
  }, h))), /*#__PURE__*/React.createElement("select", {
    value: minute,
    onChange: e => setMinute(e.target.value),
    "aria-label": "Minute",
    style: selectStyle
  }, ["00", "15", "30", "45"].map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderRadius: 8,
      overflow: "hidden",
      border: `1px solid ${COLORS.willow}`,
      flex: 1.4
    }
  }, ["AM", "PM"].map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => setPeriod(p),
    className: "cs-btn",
    style: {
      flex: 1,
      border: "none",
      padding: "8px 0",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      background: period === p ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: period === p ? "#fff" : COLORS.inkSoft
    }
  }, p)))), onClear && /*#__PURE__*/React.createElement("button", {
    onClick: onClear,
    className: "cs-btn",
    style: {
      display: "block",
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      padding: "4px 0",
      marginBottom: 14,
      textDecoration: "underline"
    }
  }, "Clear date"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onClose,
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: save,
    disabled: !day,
    style: {
      flex: 1
    }
  }, "Save")));
}
