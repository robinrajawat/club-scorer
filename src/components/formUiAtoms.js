// Small, reusable presentational React components used across setup/roster/rules screens: a
// player avatar, a plain text input, a single-choice pill row, a team-selector chip row, a
// pinnable filter chip, an icon+label utility button, a generic button, and a generic confirm
// dialog. Covered by tests/unit/components/formUiAtoms.test.js using react-test-renderer.
// ConfirmModal's own test stubs Modal (not yet extracted -- it reads window.visualViewport with
// no guard, a bigger lift than a plain presentational leaf) rather than skipping the component.

import React from "react";
import { COLORS } from "./theme.js";
import { Pin } from "./icons.js";
import { useLongPress } from "../core/appLogic.js";
import { playerInitials, playerAvatarColor } from "../core/miscHelpers.js";

export function PlayerAvatar({
  name,
  photoURL,
  size = 40
}) {
  if (photoURL) {
    return /*#__PURE__*/React.createElement("img", {
      src: photoURL,
      alt: "",
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0
      }
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: playerAvatarColor(name),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: Math.round(size * 0.4),
      flexShrink: 0
    }
  }, playerInitials(name));
}

export function TextField({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  style,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  spellCheck,
  inputMode,
  list,
  autoFocus
}) {
  return /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    onBlur: onBlur,
    onKeyDown: onKeyDown,
    placeholder: placeholder,
    autoCapitalize: autoCapitalize,
    autoCorrect: autoCorrect,
    autoComplete: autoComplete,
    spellCheck: spellCheck,
    inputMode: inputMode,
    list: list,
    autoFocus: autoFocus,
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 15,
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.ink,
      width: "100%",
      boxSizing: "border-box",
      boxShadow: "inset 0 1px 2px rgba(42,36,32,0.05)",
      ...style
    }
  });
}

export function RuleChoice({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, options.map(opt => {
    const active = opt.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: opt.value,
      type: "button",
      className: "cs-btn cs-shine",
      onClick: () => onChange(opt.value),
      style: {
        padding: "8px 14px",
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
    }, opt.label);
  })));
}

export function TeamChips({
  teams,
  selectedId,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, teams.map(t => {
    const active = selectedId === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      type: "button",
      onClick: () => onSelect(t),
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
    }, t.name);
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onSelect(null),
    className: "cs-btn",
    style: {
      padding: "9px 14px",
      borderRadius: 20,
      border: `1.5px dashed ${COLORS.willow}`,
      cursor: "pointer",
      background: selectedId === null ? COLORS.creamDark : "transparent",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, "+ One-off"));
}

export function PinnableChip({
  label,
  active,
  pinned,
  onSelect,
  onTogglePin,
  dashed = false
}) {
  const longPress = useLongPress(onTogglePin);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onSelect,
    ...longPress,
    "aria-pressed": active,
    title: pinned ? `${label} \u00b7 press and hold to unpin` : `Press and hold to pin ${label}`,
    style: {
      padding: "7px 13px",
      borderRadius: 20,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 4,
      border: active ? "none" : `1px ${dashed ? "dashed" : "solid"} ${dashed ? COLORS.gold : COLORS.willow}`,
      background: active ? dashed ? `linear-gradient(160deg, #d4a544, ${COLORS.gold})` : COLORS.pitchFixed : COLORS.surface,
      color: active ? dashed ? "#2e1c04" : "#fff" : COLORS.inkSoft,
      whiteSpace: "nowrap",
      flexShrink: 0
    }
  }, pinned && /*#__PURE__*/React.createElement(Pin, {
    size: 10,
    fill: "currentColor"
  }), label);
}

export function HomeUtilityButton({
  icon: IconComp,
  label,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    className: "cs-btn",
    "aria-label": label,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      padding: "8px 4px",
      background: "none",
      border: "none",
      borderRadius: 12,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(IconComp, {
    size: 19,
    style: {
      color: COLORS.turf
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      color: COLORS.inkSoft
    }
  }, label));
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Remove",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel
}) {
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: busy ? () => {} : onCancel
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: variant === "danger" ? COLORS.ball : COLORS.pitch,
      marginBottom: 10
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginBottom: 18
    }
  }, message), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onCancel,
    disabled: busy,
    style: {
      flex: 1
    }
  }, cancelLabel), /*#__PURE__*/React.createElement(Btn, {
    variant: variant,
    onClick: onConfirm,
    disabled: busy,
    style: {
      flex: 1
    }
  }, busy ? "\u2026" : confirmLabel)));
}
export function Btn({
  children,
  onClick,
  variant = "default",
  disabled,
  style
}) {
  const base = {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 15,
    borderRadius: 14,
    padding: "14px 14px",
    minHeight: 48,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "none",
    opacity: disabled ? 0.45 : 1,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  };
  const variants = {
    default: {
      background: COLORS.surface,
      color: COLORS.ink,
      boxShadow: "0 1px 2px rgba(42,36,32,0.07), 0 3px 8px rgba(42,36,32,0.05)"
    },
    primary: {
      background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})`,
      color: "#fff",
      boxShadow: "0 3px 12px rgba(45,80,22,0.4)"
    },
    danger: {
      background: `linear-gradient(160deg, ${COLORS.ballLightFixed}, ${COLORS.ballFixed})`,
      color: "#fff",
      boxShadow: "0 3px 12px rgba(139,30,30,0.35)"
    },
    gold: {
      background: `linear-gradient(160deg, #d4a544, ${COLORS.gold})`,
      color: "#2e1c04",
      boxShadow: "0 3px 12px rgba(184,137,43,0.35)"
    },
    ghost: {
      background: "rgba(242,236,217,0.1)",
      color: COLORS.creamFixed,
      border: "1.5px solid rgba(242,236,217,0.35)"
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    className: variant === "ghost" ? "cs-btn" : "cs-btn cs-shine",
    onClick: onClick,
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, children);
}
