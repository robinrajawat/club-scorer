import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Btn, ConfirmModal } from "./formUiAtoms.js";
import { RulesEditorFields } from "./rulesEditorFields.js";

// A confirm-gated editor for an existing tournament's defaultRules or an existing, not-yet-started
// match's own rules -- see TournamentDetailScreen (tournament) and MatchScreen's "This match" menu
// (match, only offered before any ball has been bowled -- see matchScreen.js's own comment on why).
// `Modal` is referenced as a bare global, same convention as every other Modal-wrapped screen in
// this app (see TournamentShareModal in miscModals.js) -- tests stub it on globalThis.
// `warningText`, when given, is shown both under the header (so it's visible while editing, not
// just at the final confirm step) and as the confirm step's own message -- the two callers use this
// for very different things: the tournament caller explains that already-played/in-progress
// fixtures are unaffected, the match caller doesn't need one at all (a not-yet-started match has no
// such caveat).
export function RulesEditModal({
  title = "Edit rules",
  initialOversLimit,
  initialRules,
  warningText,
  onSave,
  onClose
}) {
  const [oversLimit, setOversLimit] = useState(initialOversLimit != null ? String(initialOversLimit) : "");
  const [rules, setRules] = useState({ ...initialRules });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  async function handleConfirm() {
    setBusy(true);
    const n = parseInt(oversLimit, 10);
    await onSave(isNaN(n) || n < 1 ? null : n, rules);
    setBusy(false);
    setConfirming(false);
    onClose();
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 8
    }
  }, title), warningText && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14,
      background: COLORS.cream,
      border: `1px solid ${COLORS.creamDark}`,
      borderRadius: 10,
      padding: "10px 12px"
    }
  }, warningText), /*#__PURE__*/React.createElement(RulesEditorFields, {
    oversLimit,
    setOversLimit,
    rules,
    setRules
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => setConfirming(true),
    style: {
      width: "100%",
      marginTop: 16
    }
  }, "Save rules"), confirming && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Save these rules?",
    message: warningText || "This updates the rules going forward.",
    confirmLabel: busy ? "Saving…" : "Save",
    onConfirm: handleConfirm,
    onCancel: () => setConfirming(false)
  }));
}
