import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";

// Player-record modals: EditPlayerModal (name/age/role/hand + optional club-directory fields) and
// TransferPlayerModal (search a public club directory, then confirm handing a player's profile
// over to it). Covered by tests/unit/components/playerModals.test.js.
//
// Both reference Modal as a bare, unimported global -- same pattern as ConfirmModal in
// formUiAtoms.js -- so their own tests can stub `globalThis.Modal` with a plain pass-through
// component rather than pulling in jsdom; Modal's real DOM behavior is already covered by
// modal.test.js, and these tests only need to exercise these two components' own prop wiring and
// state. TransferPlayerModal's onSearchClubs/onTransfer are passed in as props, not bare globals,
// so no Firestore stubbing is needed at all.

export const PLAYER_ROLES = [{
  value: "batsman",
  label: "Batsman"
}, {
  value: "bowler",
  label: "Bowler"
}, {
  value: "allrounder",
  label: "All-rounder"
}];

export const PLAYER_HANDS = [{
  value: "right",
  label: "Right"
}, {
  value: "left",
  label: "Left"
}];

export function EditPlayerModal({
  player,
  onSave,
  onClose,
  title = "Edit player details",
  extraFields = false
}) {
  const [name, setName] = useState(player.name || "");
  const [age, setAge] = useState(player.age || "");
  const [role, setRole] = useState(player.role || "");
  const [battingHand, setBattingHand] = useState(player.battingHand || "");
  const [bowlingHand, setBowlingHand] = useState(player.bowlingHand || "");
  const [team, setTeam] = useState(player.team || "");
  const [externalId, setExternalId] = useState(player.externalId || "");
  const [email, setEmail] = useState(player.email || "");
  const [note, setNote] = useState(player.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function pill(active, label, onClick, key) {
    return /*#__PURE__*/React.createElement("button", {
      key,
      type: "button",
      onClick,
      "aria-pressed": active,
      style: {
        padding: "4px 10px",
        borderRadius: 12,
        border: active ? "none" : `1.5px solid ${COLORS.willow}`,
        background: active ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
        color: active ? "#fff" : COLORS.inkSoft,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer"
      }
    }, label);
  }
  async function save() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError("");
    const payload = {
      name: n,
      age,
      role,
      battingHand,
      bowlingHand
    };
    if (extraFields) {
      payload.team = team.trim();
      payload.externalId = externalId.trim();
      payload.email = email.trim();
      payload.note = note.trim();
    }
    const result = await onSave(payload);
    setBusy(false);
    if (!result || result.ok === false) {
      setError(result && result.error || "Couldn't save these details.");
      return;
    }
    onClose(payload);
  }
  const labelStyle = {
    fontFamily: "'Inter'",
    fontSize: 11.5,
    fontWeight: 600,
    color: COLORS.inkSoft,
    marginBottom: 5
  };
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: busy ? () => {} : onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 16
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Name"), /*#__PURE__*/React.createElement(TextField, {
    value: name,
    onChange: setName,
    placeholder: "Player name"
  }), name.trim() && name.trim().toLowerCase() !== (player.name || "").trim().toLowerCase() && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.gold,
      marginTop: 4
    }
  }, "Career stats are matched by name against past scorecards \u2014 renaming means stats already recorded under the old name won't show up under this one.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Age & role"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: age,
    onChange: e => setAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 3)),
    placeholder: "Age",
    "aria-label": "Age",
    inputMode: "numeric",
    style: {
      width: 52,
      boxSizing: "border-box",
      textAlign: "center",
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ink,
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "6px 4px"
    }
  }), PLAYER_ROLES.map(r => pill(role === r.value, r.label, () => setRole(role === r.value ? "" : r.value), r.value)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Batting hand"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, PLAYER_HANDS.map(h => pill(battingHand === h.value, h.label, () => setBattingHand(battingHand === h.value ? "" : h.value), "bat-" + h.value)))), (role === "bowler" || role === "allrounder") && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Bowling hand"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, PLAYER_HANDS.map(h => pill(bowlingHand === h.value, h.label, () => setBowlingHand(bowlingHand === h.value ? "" : h.value), "bowl-" + h.value))))), extraFields && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Team"), /*#__PURE__*/React.createElement(TextField, {
    value: team,
    onChange: setTeam,
    placeholder: "e.g. U19s, Firsts \u2014 optional"
  })), extraFields && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "External ID"), /*#__PURE__*/React.createElement(TextField, {
    value: externalId,
    onChange: setExternalId,
    placeholder: "Membership / league ID \u2014 optional"
  })), extraFields && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Email"), /*#__PURE__*/React.createElement(TextField, {
    value: email,
    onChange: setEmail,
    placeholder: "Optional",
    autoCapitalize: "off",
    autoCorrect: "off",
    inputMode: "email"
  })), extraFields && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: labelStyle
  }, "Note"), /*#__PURE__*/React.createElement(TextField, {
    value: note,
    onChange: setNote,
    placeholder: "Optional"
  })), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12,
      fontFamily: "'Inter'",
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
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
    disabled: busy || !name.trim(),
    style: {
      flex: 1
    }
  }, busy ? "\u2026" : "Save")));
}

export function TransferPlayerModal({
  player,
  onSearchClubs,
  onTransfer,
  onClose
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState(null); // club object, once picked
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function runSearch() {
    setSearching(true);
    setError("");
    const list = await onSearchClubs(term);
    setSearching(false);
    // clubDirectory docs key themselves as `clubId`, not `id` -- see setClubVisibility/
    // SearchAndRequestPanel's own idKey handling of the same directory.
    setResults(list.filter(c => c.clubId !== player.homeClubId));
  }
  async function confirmTransfer() {
    setBusy(true);
    setError("");
    const result = await onTransfer(player.email, target.clubId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Couldn't transfer this player.");
      return;
    }
    onClose(target);
  }
  if (target) {
    return /*#__PURE__*/React.createElement(ConfirmModal, {
      title: `Transfer ${player.name} to ${target.name}?`,
      message: `${target.name} becomes the club that administers ${player.name}'s public profile \u2014 name, age, role, and batting/bowling hand carry over unchanged. Career stats stay computed from actual match data either way, and any team that already borrowed this player keeps its own local roster copy regardless.`,
      confirmLabel: "Transfer",
      busy: busy,
      onConfirm: confirmTransfer,
      onCancel: () => {
        setTarget(null);
        setError("");
      }
    });
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Transfer to another club"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16
    }
  }, `Search for the club ${player.name} is moving to. Only public clubs are searchable here \u2014 same directory as finding a club to affiliate with a federation.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: term,
    onChange: setTerm,
    placeholder: "Club name",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: runSearch,
    disabled: searching,
    style: {
      flexShrink: 0,
      padding: "0 16px",
      minHeight: 44
    }
  }, searching ? "\u2026" : "Search")), results !== null && (results.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No public clubs match that search.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, results.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.clubId,
    type: "button",
    onClick: () => setTarget(c),
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      color: COLORS.ink
    }
  }, c.name), c.ownerName && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft
    }
  }, "Owner: ", c.ownerName))))), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12.5,
      fontFamily: "'Inter'",
      marginTop: 10
    }
  }, error));
}
