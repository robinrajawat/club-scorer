import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Hash } from "./icons.js";
import { RoleBadge } from "./scoringUiAtoms.js";
import { TextField, Btn } from "./formUiAtoms.js";

// A roster picker (falls back to a plain text field when there's no saved roster to pick from)
// and the "have a match code" collapsible join bar. Covered by
// tests/unit/components/pickerAtoms.test.js using react-test-renderer.

export function PlayerPicker({
  roster,
  value,
  onChange,
  exclude,
  excludeList,
  placeholder,
  captain,
  keeper,
  numbers,
  noteFor
}) {
  const excluded = new Set([exclude, ...(excludeList || [])].filter(Boolean));
  const pool = roster && roster.length ? roster.filter(n => !excluded.has(n)) : null;
  if (pool && pool.length > 0) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, pool.map(name => {
      const active = value === name;
      const num = numbers && numbers[name];
      const note = noteFor && noteFor(name);
      return /*#__PURE__*/React.createElement("button", {
        key: name,
        type: "button",
        onClick: () => onChange(name),
        className: "cs-btn cs-shine",
        style: {
          padding: "9px 14px",
          borderRadius: 20,
          border: "none",
          cursor: "pointer",
          background: active ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
          color: active ? "#fff" : COLORS.ink,
          boxShadow: active ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
          fontFamily: "'Inter'",
          fontWeight: 600,
          fontSize: 13
        }
      }, num ? `#${num} ${name}` : name, /*#__PURE__*/React.createElement(RoleBadge, {
        isCaptain: name === captain,
        isKeeper: name === keeper
      }), note && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "inline-block",
          marginLeft: 5,
          padding: "1px 5px",
          borderRadius: 5,
          background: active ? "rgba(255,255,255,0.22)" : "rgba(184,137,43,0.16)",
          color: active ? "#fff" : COLORS.gold,
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: 0.3,
          verticalAlign: "middle",
          fontFamily: "'Inter'"
        }
      }, note));
    }));
  }
  return /*#__PURE__*/React.createElement(TextField, {
    value: value,
    onChange: onChange,
    placeholder: placeholder
  });
}

export function JoinCodeBar({
  onJoin
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleaned || busy) return;
    setBusy(true);
    setError("");
    const result = await onJoin(cleaned);
    setBusy(false);
    if (!result.ok) setError(result.error || "No match found for that code.");
  }
  if (!open) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "cs-btn",
      onClick: () => setOpen(true),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        margin: "0 auto 24px",
        background: "none",
        border: "none",
        color: COLORS.inkSoft,
        fontFamily: "'Inter'",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(Hash, {
      size: 14,
      style: {
        flexShrink: 0
      }
    }), "Have a match code from a teammate?");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: code,
    onChange: v => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "")),
    placeholder: "Enter code, e.g. 7GQK4RTP",
    autoCapitalize: "characters",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    inputMode: "text",
    style: {
      textTransform: "uppercase",
      letterSpacing: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: submit,
    disabled: busy,
    style: {
      flexShrink: 0,
      padding: "0 16px",
      minHeight: 44
    }
  }, busy ? "Joining…" : "Join"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setOpen(false);
      setCode("");
      setError("");
    },
    "aria-label": "Close",
    style: {
      flexShrink: 0,
      width: 44,
      height: 44,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      fontSize: 22,
      lineHeight: 1
    }
  }, "\u00d7")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12,
      fontFamily: "'Inter'",
      marginTop: 8
    }
  }, error));
}
