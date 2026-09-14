import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, Plus, Trash2 } from "./icons.js";
import { Field } from "./screenAtoms.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";
import { SwipeableRow } from "./scoringUiAtoms.js";
import { uid } from "../core/statsAndFixtures.js";
import { TEAM_COLOR_PRESETS } from "../core/miscHelpers.js";

// Create/edit a team's roster: name, jersey color, add/remove/reorder players,
// captain/vice-captain/keeper toggles. Every write that reaches storage (onSave/onDelete) is a
// prop. Covered by tests/unit/components/teamEditScreen.test.js.

export function TeamEditScreen({
  team,
  onSave,
  onCancel,
  onDelete
}) {
  const [name, setName] = useState(team ? team.name : "");
  const [players, setPlayers] = useState(team ? team.players.map(p => typeof p === "string" ? {
    name: p,
    number: "",
    _key: uid()
  } : {
    name: p.name,
    number: p.number || "",
    _key: uid()
  }) : []);
  const [newPlayer, setNewPlayer] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [captain, setCaptain] = useState(team ? team.captain || "" : "");
  const [viceCaptain, setViceCaptain] = useState(team ? team.viceCaptain || "" : "");
  const [keeper, setKeeper] = useState(team ? team.keeper || "" : "");
  const [color, setColor] = useState(team ? team.color || "" : "");
  // Removing a player is destructive to whatever local edits (number, captain/keeper role) they
  // had on this team, so it goes through the same ConfirmModal pattern as every other destructive
  // action in the app, instead of the previous single-tap X.
  const [confirmRemove, setConfirmRemove] = useState(null); // the player row object, or null
  // Deleting the whole team, not just one player off its roster -- same ConfirmModal pattern,
  // gated on there actually being an existing team (and a caller that wants to offer it at all)
  // rather than a brand-new one that's never been saved and has nothing to delete yet.
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const [addError, setAddError] = useState("");
  function addPlayer() {
    const n = newPlayer.trim();
    if (!n) return;
    if (players.some(p => p.name.trim().toLowerCase() === n.toLowerCase())) {
      setAddError(`${n} is already on this team.`);
      return;
    }
    setAddError("");
    setPlayers(p => [...p, {
      name: n,
      number: newNumber.trim(),
      _key: uid()
    }]);
    setNewPlayer("");
    setNewNumber("");
  }
  function removePlayer(key) {
    const old = players.find(p => p._key === key);
    setPlayers(p => p.filter(x => x._key !== key));
    if (old) {
      if (captain === old.name) setCaptain("");
      if (viceCaptain === old.name) setViceCaptain("");
      if (keeper === old.name) setKeeper("");
    }
  }
  function updateNumber(key, num) {
    setPlayers(p => p.map(x => x._key === key ? {
      ...x,
      number: num
    } : x));
  }
  function updateName(key, newName) {
    const old = players.find(p => p._key === key);
    setPlayers(p => p.map(x => x._key === key ? {
      ...x,
      name: newName
    } : x));
    if (old) {
      if (captain === old.name) setCaptain(newName);
      if (viceCaptain === old.name) setViceCaptain(newName);
      if (keeper === old.name) setKeeper(newName);
    }
  }
  function buildTeamPayload() {
    const savedPlayers = players.map(p => ({
      name: p.name.trim(),
      number: p.number
    }));
    return {
      id: team ? team.id : uid(),
      name: name.trim(),
      players: savedPlayers,
      captain: captain.trim(),
      viceCaptain: viceCaptain.trim(),
      keeper: keeper.trim(),
      color: color || null
    };
  }
  const trimmedNames = players.map(p => p.name.trim());
  const canSave = name.trim() && players.length > 0 && trimmedNames.every(n => n) && new Set(trimmedNames.map(n => n.toLowerCase())).size === players.length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Teams"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 18
    }
  }, team ? "Edit Team" : "New Team"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Team name"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: name,
    onChange: setName,
    placeholder: "e.g. Willow CC"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, "Jersey color ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: COLORS.inkSoft
    }
  }, "(optional — used on charts and the scoreboard)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center"
    }
  }, TEAM_COLOR_PRESETS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    type: "button",
    onClick: () => setColor(color === c ? "" : c),
    "aria-label": `Jersey color ${c}`,
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: color === c ? `2.5px solid ${COLORS.ink}` : "2.5px solid transparent",
      boxShadow: "0 1px 3px rgba(42,36,32,0.25)",
      background: c,
      cursor: "pointer",
      padding: 0
    }
  })), /*#__PURE__*/React.createElement("label", {
    "aria-label": "Custom jersey color",
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: `1.5px dashed ${COLORS.willow}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: !color || TEAM_COLOR_PRESETS.includes(color) ? "#fff" : color,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: color && !TEAM_COLOR_PRESETS.includes(color) ? color : "#888888",
    onChange: e => setColor(e.target.value),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "pointer",
      border: "none",
      padding: 0
    }
  }), (!color || TEAM_COLOR_PRESETS.includes(color)) && /*#__PURE__*/React.createElement(Plus, {
    size: 14,
    style: {
      color: COLORS.inkSoft
    }
  })), color && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setColor(""),
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "underline",
      padding: "0 0 0 4px"
    }
  }, "Clear")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 4
    }
  }, "Players"), players.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10
    }
    // Quick, display-only summary of the roster's current shape -- no need to scan every row's
    // own C/VC/WK tag just to answer "how many players do we have" or "who's captain right now".
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      background: COLORS.cream,
      padding: "3px 9px",
      borderRadius: 12
    }
  }, players.length, " player", players.length === 1 ? "" : "s"), captain && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.gold,
      background: "rgba(184,137,43,0.16)",
      padding: "3px 9px",
      borderRadius: 12
    }
  }, "C · ", captain), viceCaptain && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: "#7a5c22",
      background: "rgba(201,168,118,0.3)",
      padding: "3px 9px",
      borderRadius: 12
    }
  }, "VC · ", viceCaptain), keeper && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.turf,
      background: "rgba(45,80,22,0.12)",
      padding: "3px 9px",
      borderRadius: 12
    }
  }, "WK · ", keeper)), players.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, "Tap ", /*#__PURE__*/React.createElement("strong", null, "C"), ", ", /*#__PURE__*/React.createElement("strong", null, "VC"), ", or ", /*#__PURE__*/React.createElement("strong", null, "WK"), " on a row to set captain / vice-captain / keeper — tap again to clear. Swipe a row left to remove that player."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: addError ? 4 : 12
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: newPlayer,
    onChange: v => {
      setNewPlayer(v);
      if (addError) setAddError("");
    },
    onKeyDown: e => {
      if (e.key === "Enter") addPlayer();
    },
    placeholder: "Player name"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: newNumber,
    onChange: v => setNewNumber(v.replace(/[^0-9]/g, "").slice(0, 3)),
    onKeyDown: e => {
      if (e.key === "Enter") addPlayer();
    },
    placeholder: "#",
    style: {
      textAlign: "center"
    }
  })), /*#__PURE__*/React.createElement(Btn, {
    onClick: addPlayer,
    style: {
      flexShrink: 0,
      padding: "0 16px"
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 17
  }))), addError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginBottom: 12
    }
  }, addError), players.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No players added yet") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, players.map(p => /*#__PURE__*/React.createElement(React.Fragment, {
    key: p._key
  }, /*#__PURE__*/React.createElement(SwipeableRow, {
    onDelete: () => setConfirmRemove(p),
    deleteLabel: "Remove"
    // Swipe reveals Remove instead of an always-visible button -- same confirm-before-removing
    // flow as before (this still only opens confirmRemove; the actual removal still needs
    // confirming there), just freeing up row space that button used to take.
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "7px 8px 7px 6px",
      borderRadius: 12,
      background: COLORS.creamDark
    }
    // Two rows, not one -- a jersey number and name (row 1), plus C/VC/WK (row 2) below it.
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: p.number,
    onChange: e => updateNumber(p._key, e.target.value.replace(/[^0-9]/g, "").slice(0, 3)),
    placeholder: "#",
    style: {
      width: "100%",
      textAlign: "center",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.turf,
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "5px 2px"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: p.name,
    onChange: e => updateName(p._key, e.target.value),
    placeholder: "Player name",
    style: {
      flex: 1,
      minWidth: 0,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      color: COLORS.ink,
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "5px 8px"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 6,
      paddingLeft: 52
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid ${COLORS.willow}`,
      flexShrink: 0
    }
    // One pill divided into three sections, rather than three separate same-sized round buttons
    // floating with gaps between them -- reads as a single "set the role" control.
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setCaptain(captain === p.name ? "" : p.name),
    "aria-label": captain === p.name ? `Remove ${p.name} as captain` : `Make ${p.name} captain`,
    title: "Captain",
    style: {
      padding: "5px 9px",
      border: "none",
      borderRight: `1px solid ${COLORS.willow}`,
      background: captain === p.name ? COLORS.gold : "transparent",
      color: captain === p.name ? "#2e1c04" : COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 10,
      fontWeight: 800,
      cursor: "pointer"
    }
  }, "C"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setViceCaptain(viceCaptain === p.name ? "" : p.name),
    "aria-label": viceCaptain === p.name ? `Remove ${p.name} as vice-captain` : `Make ${p.name} vice-captain`,
    title: "Vice-captain",
    style: {
      padding: "5px 9px",
      border: "none",
      borderRight: `1px solid ${COLORS.willow}`,
      background: viceCaptain === p.name ? "#c9a876" : "transparent",
      color: viceCaptain === p.name ? "#5a4522" : COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 9,
      fontWeight: 800,
      cursor: "pointer"
    }
  }, "VC"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setKeeper(keeper === p.name ? "" : p.name),
    "aria-label": keeper === p.name ? `Remove ${p.name} as wicketkeeper` : `Make ${p.name} wicketkeeper`,
    title: "Wicketkeeper",
    style: {
      padding: "5px 9px",
      border: "none",
      background: keeper === p.name ? COLORS.turf : "transparent",
      color: keeper === p.name ? "#fff" : COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 9,
      fontWeight: 800,
      cursor: "pointer"
    }
  }, "WK")))))))), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !canSave,
    onClick: () => onSave(buildTeamPayload()),
    style: {
      width: "100%"
    }
  }, "Save Team"), team && onDelete && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setConfirmDeleteTeam(true),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: "100%",
      marginTop: 10,
      padding: "10px 0",
      background: "none",
      border: "none",
      cursor: "pointer",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 15
  }), "Delete team"), confirmDeleteTeam && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: `Delete ${name.trim() || "this team"}?`,
    message: "Removes this team and its roster entirely. Matches already scored with it are untouched — this only affects future ones. This can't be undone.",
    confirmLabel: "Delete",
    onConfirm: () => {
      setConfirmDeleteTeam(false);
      onDelete();
    },
    onCancel: () => setConfirmDeleteTeam(false)
  }), confirmRemove && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: `Remove ${confirmRemove.name}?`,
    message: `Removes ${confirmRemove.name} from this team's roster. If they're captain, vice-captain, or wicketkeeper here, that's cleared too.`,
    confirmLabel: "Remove",
    onConfirm: () => {
      removePlayer(confirmRemove._key);
      setConfirmRemove(null);
    },
    onCancel: () => setConfirmRemove(null)
  })));
}

