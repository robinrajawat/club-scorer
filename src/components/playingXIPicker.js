import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { TextField } from "./formUiAtoms.js";

// Squad -> playing-XI picker: pick up to `required` players from a squad, optionally set captain/
// keeper and per-match jersey numbers, with a search box once the squad's big enough (>15) to make
// one worth showing. Every callback is a prop, no bare globals at all. Covered by
// tests/unit/components/playingXIPicker.test.js.

export function PlayingXIPicker({
  label,
  squad,
  captain,
  keeper,
  selected,
  onToggle,
  onSetCaptain,
  onSetKeeper,
  required,
  numbers,
  onNumberChange
}) {
  const count = selected.length;
  const atLimit = count >= required;
  // A search box only earns its space once the squad is big enough that scanning the whole pool
  // by eye stops being realistic -- a 12-15 player squad is still a quick scroll, but a 30-40
  // player one (common for a club-wide "everyone who's ever played" roster) turns into real work
  // without a way to narrow it down.
  const [search, setSearch] = useState("");
  const showSearch = squad.length > 15;
  const q = search.trim().toLowerCase();
  const poolNames = squad.map(p => p.name).filter(name => !selected.includes(name) && (!q || name.toLowerCase().includes(q)));
  // One pill renderer shared by both the Selected section and the searchable pool below --
  // branches on checked/disabled internally, so the same function produces the compact "tap to
  // add" pill or the fuller selected pill (with number/captain/keeper controls) depending on
  // which list it's called from.
  function renderPill(name) {
    const checked = selected.includes(name);
    const disabled = !checked && atLimit;
    // Once a player is in the XI, their pill grows two extra tap targets for captain/keeper —
    // needs to be a plain div (not a button) at the top level so those can be real sibling
    // buttons instead of illegally nesting buttons inside the selection button.
    const numberInput = onNumberChange && /*#__PURE__*/React.createElement("input", {
      key: "num",
      type: "text",
      inputMode: "numeric",
      maxLength: 3,
      value: (numbers && numbers[name]) || "",
      onChange: e => onNumberChange(name, e.target.value.replace(/[^0-9]/g, "").slice(0, 3)),
      onClick: e => e.stopPropagation(),
      placeholder: "#",
      "aria-label": `Jersey number for ${name} (this match only)`,
      style: {
        width: 30,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        padding: "5px 2px",
        borderRadius: 10,
        border: `1.5px solid ${checked ? "rgba(255,255,255,0.4)" : COLORS.creamDark}`,
        background: checked ? "rgba(255,255,255,0.15)" : COLORS.cream,
        color: checked ? "#fff" : COLORS.ink
      }
    });
    if (!checked) {
      return /*#__PURE__*/React.createElement("div", {
        key: name,
        className: "cs-shine",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 6px 5px 5px",
          borderRadius: 20,
          background: COLORS.surface,
          boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
          opacity: disabled ? 0.45 : 1
        }
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "cs-btn",
        disabled: disabled,
        onClick: () => onToggle(name),
        style: {
          padding: "3px 6px 3px 4px",
          borderRadius: 16,
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          background: "none",
          color: disabled ? COLORS.inkSoft : COLORS.ink,
          fontFamily: "'Inter'",
          fontWeight: 600,
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 15,
          height: 15,
          borderRadius: 4,
          flexShrink: 0,
          border: `1.5px solid ${COLORS.creamDark}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }), name), numberInput);
    }
    const isCaptain = name === captain;
    const isKeeper = name === keeper;
    return /*#__PURE__*/React.createElement("div", {
      key: name,
      className: "cs-shine",
      style: {
        padding: "5px 6px 5px 10px",
        borderRadius: 20,
        background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})`,
        boxShadow: "0 2px 8px rgba(45,80,22,0.3)",
        display: "inline-flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onToggle(name),
      style: {
        background: "none",
        border: "none",
        padding: "3px 0",
        cursor: "pointer",
        color: "#fff",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 15,
        height: 15,
        borderRadius: 4,
        flexShrink: 0,
        background: "rgba(255,255,255,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        lineHeight: 1
      }
    }, "✓")), name), numberInput, onSetCaptain && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onSetCaptain(isCaptain ? "" : name),
      "aria-label": isCaptain ? `Remove ${name} as captain` : `Make ${name} captain`,
      title: "Captain",
      style: {
        width: 22,
        height: 22,
        borderRadius: "50%",
        flexShrink: 0,
        border: "none",
        background: isCaptain ? `linear-gradient(160deg, #d4a544, ${COLORS.gold})` : "rgba(255,255,255,0.2)",
        color: isCaptain ? "#2e1c04" : "#fff",
        fontFamily: "'Inter'",
        fontSize: 9,
        fontWeight: 800,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, "C"), onSetKeeper && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onSetKeeper(isKeeper ? "" : name),
      "aria-label": isKeeper ? `Remove ${name} as wicketkeeper` : `Make ${name} wicketkeeper`,
      title: "Wicketkeeper",
      style: {
        width: 26,
        height: 22,
        borderRadius: 11,
        flexShrink: 0,
        border: "none",
        background: isKeeper ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
        color: isKeeper ? COLORS.pitch : "#fff",
        fontFamily: "'Inter'",
        fontSize: 8.5,
        fontWeight: 800,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, "WK"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      fontWeight: 700,
      color: count === required ? COLORS.turf : COLORS.inkSoft
    }
  }, count, "/", required, " selected")), onNumberChange && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, "Set jersey numbers for this match \u2014 doesn't change the saved squad."), count === required && (onSetCaptain || onSetKeeper) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, "Tap ", /*#__PURE__*/React.createElement("strong", null, "C"), " or ", /*#__PURE__*/React.createElement("strong", null, "WK"), " to set captain / keeper for this match."), count > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: showSearch || poolNames.length > 0 ? 14 : 0,
      paddingBottom: showSearch || poolNames.length > 0 ? 12 : 0,
      borderBottom: showSearch || poolNames.length > 0 ? `1px solid ${COLORS.creamDark}` : "none"
    }
  }, selected.map(renderPill)), showSearch && /*#__PURE__*/React.createElement(TextField, {
    value: search,
    onChange: setSearch,
    placeholder: `Search ${squad.length} players\u2026`,
    style: {
      marginBottom: 10
    }
  }), poolNames.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, q ? `No one matching "${search}".` : atLimit ? "Everyone else is already in." : "No more players in this squad.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, poolNames.map(renderPill)));
}
