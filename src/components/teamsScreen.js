import React, { useState, useRef } from "react";
import { COLORS } from "./theme.js";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Pencil, Shield } from "./icons.js";
import { Btn, TextField } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { EditPlayerModal, PLAYER_ROLES } from "./playerModals.js";
import { ClubPanel } from "./clubPanel.js";
import { FederationsPanel } from "./federationsPanel.js";
import { isClubOwner, parseBulkPlayers } from "../core/miscHelpers.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// The "Clubs" screen: a Clubs/Federations tab (rendering ClubPanel/FederationsPanel respectively),
// plus, once a club is active, its player pool (a club-wide roster to draw team lineups from --
// quick-add, bulk paste/upload with a preview, active/inactive toggle, edit, remove, and
// "create a team from everyone tagged X"). Every write action is a prop -- no bare globals, no
// mount effect. Covered by tests/unit/components/teamsScreen.test.js.

export function TeamsScreen({
  onManageTeams,
  onBack,
  clubs,
  activeClubId,
  currentUid,
  tab,
  onTabChange,
  // Clubs tab
  activeClubAdminId,
  onSelectClubAdmin,
  onCreateClub,
  onJoinClub,
  onInviteClubMember,
  onInviteClubCoOwner,
  coOwnerInvites,
  onCancelCoOwnerInvite,
  onRevokeClubInvite,
  onLeaveClub,
  onDeleteClub,
  onRenameClub,
  onUpdateClubDescription,
  onUpdateClubAddress,
  onUploadClubLogo,
  onRemoveClubLogo,
  onSetClubVisibility,
  onRemoveClubMember,
  onRemoveClubCoOwner,
  onRefreshMyMemberName,
  // Federations tab
  federationsById,
  onCreateFederation,
  onSearchPublicFederations,
  onSearchPublicClubs,
  onSearchPublicUsers,
  onRequestFederationAffiliation,
  onSetFederationVisibility,
  onLeaveFederation,
  onRenameFederation,
  onUpdateFederationDescription,
  onKickClubFromFederation,
  onDeleteFederation,
  onLoadFederationTeams,
  onLoadFederationMembers,
  federationRequests,
  onCancelFederationRequest,
  onInviteFederationCoOwnerByEmail,
  onRemoveFederationCoOwner,
  clubsLoading,
  federationsLoading,
  onOpenRecords,
  onAddUmpire,
  onRemoveUmpire,
  onAddPoolPlayers,
  onUpdatePoolPlayer,
  onRemovePoolPlayer,
  onCreateTeamFromPool,
  pinnedClubIds = [],
  onTogglePinClub,
  showTabBar = false
}) {
  const activeClub = activeClubId ? clubs.find(c => c.id === activeClubId) || null : null;
  const activeClubName = activeClub && activeClub.name;
  const canManage = !activeClubId || isClubOwner(activeClub, currentUid);
  const [showInfo, setShowInfo] = useState(false);
  // Club player pool -- a club-wide roster to draw team lineups from (see addPoolPlayers). Lives
  // here rather than in club settings since building teams is exactly where it's used. One
  // quick-add row for a single name, plus a bulk-paste/upload box for dropping in a whole
  // spreadsheet column at once (see parseBulkPlayers) with a preview before anything's written.
  const [poolOpen, setPoolOpen] = useState(false);
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolRole, setNewPoolRole] = useState("");
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolError, setPoolError] = useState("");
  const [poolRemoveBusyId, setPoolRemoveBusyId] = useState(null);
  const [poolStatusBusyId, setPoolStatusBusyId] = useState(null);
  async function togglePoolStatus(pl) {
    setPoolStatusBusyId(pl.id);
    const result = await onUpdatePoolPlayer(activeClubId, pl.id, {
      status: pl.status === "inactive" ? "active" : "inactive"
    });
    setPoolStatusBusyId(null);
    if (!result.ok) setPoolError(result.error);
  }
  const [editingPoolId, setEditingPoolId] = useState(null);
  function startPoolEdit(pl) {
    setEditingPoolId(pl.id);
  }
  async function savePoolEdit(pl, updates) {
    return onUpdatePoolPlayer(activeClubId, pl.id, updates);
  }
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const poolFileInputRef = useRef(null);
  // Distinct team tags present in the pool (e.g. "U15", "2nd XI") -- lets someone spin up an
  // actual Team pre-filled with everyone who shares that tag, instead of hand-picking each name
  // one by one via the roster's own pool picker. Inactive pool players are left out, same as
  // that picker, and a blank/unset tag isn't a group worth offering.
  const poolTeamGroups = [];
  (activeClub && activeClub.playerPool || []).forEach(p => {
    if (p.status === "inactive") return;
    const tag = (p.team || "").trim();
    if (!tag) return;
    const group = poolTeamGroups.find(g => g.tag === tag);
    if (group) group.players.push(p);else poolTeamGroups.push({
      tag,
      players: [p]
    });
  });
  poolTeamGroups.sort((a, b) => a.tag.localeCompare(b.tag));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20,
      paddingLeft: 16,
      paddingRight: 16,
      // See the matching comment in homeScreen.js's own root style -- reserves clearance under
      // the fixed TabBar when it's showing.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 40px + env(safe-area-inset-bottom))` : 40,
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
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
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Shield, {
    size: 23,
    style: {
      color: COLORS.pitch
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch
    }
  }, "Clubs"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShowInfo(v => !v),
    "aria-label": showInfo ? "Hide info" : "What's this screen for?",
    "aria-expanded": showInfo,
    className: "cs-btn",
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
  }, /*#__PURE__*/React.createElement(Info, {
    size: 17
  })), (clubsLoading || federationsLoading) && /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Refreshing\u2026",
    size: 14,
    style: {
      fontSize: 11.5
    }
  })), showInfo && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5,
      background: COLORS.surface,
      borderRadius: 12,
      padding: "10px 12px"
    }
  }, tab === "clubs" ? "Create or join a club to share rosters, tournaments, and records with its members \u2014 manage a club's teams from the Teams screen." : "Create or join a federation to link multiple clubs together for shared tournaments and records."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 18
    }
  }, [{
    key: "clubs",
    label: "Clubs"
  }, {
    key: "federations",
    label: "Federations"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.key,
    type: "button",
    onClick: () => onTabChange(t.key),
    className: "cs-btn",
    style: {
      flex: 1,
      padding: "9px 8px",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      background: tab === t.key ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: tab === t.key ? "#fff" : COLORS.inkSoft,
      boxShadow: tab === t.key ? "0 2px 8px rgba(45,80,22,0.3)" : "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13
    }
  }, t.label))), tab === "clubs" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 12
    }
  }, "Only the owner (and anyone they've made a co-owner) can rename a club, edit its description, invite people, or manage its teams and tournaments \u2014 everyone else is a plain member."), /*#__PURE__*/React.createElement(ClubPanel, {
    clubs: clubs,
    activeClubId: activeClubAdminId,
    onSelect: onSelectClubAdmin,
    onCreate: onCreateClub,
    onJoin: onJoinClub,
    onInvite: onInviteClubMember,
    onInviteCoOwner: onInviteClubCoOwner,
    coOwnerInvites: coOwnerInvites,
    onCancelCoOwnerInvite: onCancelCoOwnerInvite,
    onLeave: onLeaveClub,
    onDelete: onDeleteClub,
    onRename: onRenameClub,
    onUpdateDescription: onUpdateClubDescription,
    onUpdateAddress: onUpdateClubAddress,
    onUploadLogo: onUploadClubLogo,
    onRemoveLogo: onRemoveClubLogo,
    federationsById: federationsById,
    onLeaveFederation: onLeaveFederation,
    onRemoveMember: onRemoveClubMember,
    onRemoveCoOwner: onRemoveClubCoOwner,
    onRevokeInvite: onRevokeClubInvite,
    onRefreshMyMemberName: onRefreshMyMemberName,
    onSetVisibility: onSetClubVisibility,
    onSearchPublicFederations: onSearchPublicFederations,
    onSearchPublicUsers: onSearchPublicUsers,
    onRequestFederationAffiliation: onRequestFederationAffiliation,
    onOpenRecords: onOpenRecords,
    onAddUmpire: onAddUmpire,
    onRemoveUmpire: onRemoveUmpire,
    currentUid: currentUid,
    pinnedClubIds: pinnedClubIds,
    onTogglePinClub: onTogglePinClub
  })), tab === "clubs" && activeClubId && /*#__PURE__*/React.createElement(React.Fragment, null, activeClub && canManage && /*#__PURE__*/React.createElement("div", {
  style: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: COLORS.inkSoft
  }
}, `Player Pool \u00b7 ${(activeClub.playerPool || []).length}`), /*#__PURE__*/React.createElement("button", {
  onClick: () => setPoolOpen(o => !o),
  className: "cs-btn",
  "aria-label": poolOpen ? "Hide player pool" : "Show player pool",
  style: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: COLORS.pitch,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 11.5,
    cursor: "pointer",
    padding: 0
  }
}, poolOpen ? "Hide" : "Manage", /*#__PURE__*/React.createElement(ChevronDown, {
  size: 13,
  style: {
    transform: poolOpen ? "rotate(180deg)" : "none",
    transition: "transform 0.15s"
  }
}))), poolOpen && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 8
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11.5,
    color: COLORS.inkSoft,
    fontFamily: "'Inter'",
    marginBottom: 8
  }
}, "Add people once here, then pull them onto any of this club's teams from Team editing \u2014 separate from the cross-club public directory, and no email required."), poolTeamGroups.length > 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 10
  }
}, poolTeamGroups.map(g => /*#__PURE__*/React.createElement("div", {
  key: g.tag,
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "5px 8px",
    background: COLORS.cream,
    borderRadius: 8
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    minWidth: 0,
    display: "flex",
    alignItems: "baseline",
    gap: 4
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 11.5,
    fontFamily: "'Inter'",
    fontWeight: 600,
    color: COLORS.ink,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, g.tag), /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 10.5,
    color: COLORS.inkSoft,
    fontWeight: 500,
    flexShrink: 0
  }
}, `\u00b7 ${g.players.length}`)), /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: () => onCreateTeamFromPool(activeClubId, g.tag, g.players),
  "aria-label": `Create team from ${g.tag}`,
  style: {
    flexShrink: 0,
    background: "none",
    border: `1px solid ${COLORS.pitch}`,
    borderRadius: 10,
    color: COLORS.pitch,
    cursor: "pointer",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 10.5,
    padding: "3px 9px"
  }
}, "Create team")))), (activeClub.playerPool || []).length === 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12,
    color: COLORS.inkSoft,
    fontFamily: "'Inter'",
    fontStyle: "italic",
    marginBottom: 8
  }
}, "No players in the pool yet \u2014 add one below, or paste a whole list in at once."), (activeClub.playerPool || []).map(pl => /*#__PURE__*/React.createElement("div", {
  key: pl.id,
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 0",
    gap: 8,
    opacity: pl.status === "inactive" ? 0.55 : 1
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    minWidth: 0,
    display: "flex",
    alignItems: "baseline",
    gap: 6
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 12.5,
    color: COLORS.ink,
    fontFamily: "'Inter'",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
}, pl.name), pl.externalId && /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 10,
    color: COLORS.inkSoft,
    fontFamily: "'IBM Plex Mono'",
    flexShrink: 0
  }
}, `#${pl.externalId}`), /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 10.5,
    color: COLORS.inkSoft,
    fontFamily: "'Inter'",
    flexShrink: 0
  }
}, [(PLAYER_ROLES.find(r => r.value === pl.role) || {}).label || "Role not set", pl.team].filter(Boolean).join(" \u00b7 "))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: () => togglePoolStatus(pl),
  disabled: poolStatusBusyId === pl.id,
  "aria-label": pl.status === "inactive" ? `Mark ${pl.name} active` : `Mark ${pl.name} inactive`,
  style: {
    background: "none",
    border: `1px solid ${pl.status === "inactive" ? COLORS.willow : COLORS.turf}`,
    borderRadius: 10,
    color: pl.status === "inactive" ? COLORS.inkSoft : COLORS.turf,
    cursor: "pointer",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 10,
    padding: "2px 8px",
    flexShrink: 0
  }
}, pl.status === "inactive" ? "Inactive" : "Active"), /*#__PURE__*/React.createElement("button", {
  onClick: () => startPoolEdit(pl),
  "aria-label": `Edit ${pl.name}`,
  style: {
    background: "none",
    border: "none",
    color: COLORS.inkSoft,
    cursor: "pointer",
    padding: "4px 6px",
    display: "flex",
    alignItems: "center"
  }
}, /*#__PURE__*/React.createElement(Pencil, {
  size: 13
})), /*#__PURE__*/React.createElement("button", {
  onClick: async () => {
    setPoolRemoveBusyId(pl.id);
    const result = await onRemovePoolPlayer(activeClubId, pl.id);
    setPoolRemoveBusyId(null);
    if (!result.ok) setPoolError(result.error);
  },
  disabled: poolRemoveBusyId === pl.id,
  "aria-label": `Remove ${pl.name} from the pool`,
  style: {
    background: "none",
    border: "none",
    color: COLORS.inkSoft,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 6px",
    flexShrink: 0
  }
}, "\u00d7")))), editingPoolId && (() => {
  const editingPl = (activeClub.playerPool || []).find(p => p.id === editingPoolId);
  return editingPl && /*#__PURE__*/React.createElement(EditPlayerModal, {
    player: editingPl,
    title: "Edit pool player",
    extraFields: true,
    onSave: async updates => savePoolEdit(editingPl, updates),
    onClose: () => setEditingPoolId(null)
  });
})(), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap"
  }
}, /*#__PURE__*/React.createElement(TextField, {
  value: newPoolName,
  onChange: setNewPoolName,
  placeholder: "Player name",
  autoCapitalize: "words",
  autoCorrect: "off",
  autoComplete: "off",
  spellCheck: false,
  style: {
    flex: 1,
    minWidth: 120,
    padding: "8px 10px",
    fontSize: 13
  }
}), PLAYER_ROLES.map(r => /*#__PURE__*/React.createElement("button", {
  key: r.value,
  type: "button",
  onClick: () => setNewPoolRole(newPoolRole === r.value ? "" : r.value),
  "aria-pressed": newPoolRole === r.value,
  style: {
    padding: "4px 10px",
    borderRadius: 12,
    border: newPoolRole === r.value ? "none" : `1.5px solid ${COLORS.willow}`,
    background: newPoolRole === r.value ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
    color: newPoolRole === r.value ? "#fff" : COLORS.inkSoft,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 11,
    cursor: "pointer",
    flexShrink: 0
  }
}, r.label)), /*#__PURE__*/React.createElement(Btn, {
  onClick: async () => {
    setPoolBusy(true);
    setPoolError("");
    const result = await onAddPoolPlayers(activeClubId, [{
      name: newPoolName,
      role: newPoolRole
    }]);
    setPoolBusy(false);
    if (!result.ok) {
      setPoolError(result.error);
      return;
    }
    setNewPoolName("");
    setNewPoolRole("");
  },
  disabled: poolBusy || !newPoolName.trim(),
  style: {
    flexShrink: 0,
    padding: "0 14px"
  }
}, poolBusy ? "\u2026" : "Add")), poolError && /*#__PURE__*/React.createElement("div", {
  style: {
    color: COLORS.ball,
    fontSize: 11.5,
    fontFamily: "'Inter'",
    marginTop: 6
  }
}, poolError), /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: () => setBulkOpen(o => !o),
  className: "cs-btn",
  style: {
    background: "none",
    border: "none",
    color: COLORS.pitch,
    cursor: "pointer",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 11.5,
    padding: 0,
    textDecoration: "underline",
    marginTop: 10
  }
}, bulkOpen ? "Hide bulk add" : "Bulk add from a spreadsheet"), bulkOpen && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 8
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    color: COLORS.inkSoft,
    fontFamily: "'Inter'",
    marginBottom: 6
  }
}, "Paste rows straight from Excel/Sheets (or comma-separated), one player per line \u2014 name, role, team/division (e.g. U13, U19, Senior, Men, Women), then a registration/external ID. A leading number column is ignored. Add \u201c(C)\u201d or \u201c(WK)\u201d after a name to flag captain/keeper \u2014 both are set on the team roster once they're added, not stored on the pool entry itself. No dedicated ID column? An ID in parens on the name, e.g. \u201cVivek Srivastava (5037351)\u201d, still works as a fallback."), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 14,
    marginBottom: 8,
    flexWrap: "wrap"
  }
}, /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: () => downloadCSV("player-pool-template", ["Name", "Role", "Team", "ID"], [["Virat Kohli (C)", "Batsman", "Men", "1234567"], ["MS Dhoni (WK)", "Batsman", "Senior", "2345678"], ["Bumrah", "Bowler", "Men", ""]]),
  style: {
    background: "none",
    border: "none",
    color: COLORS.pitch,
    cursor: "pointer",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 11.5,
    padding: 0,
    textDecoration: "underline"
  }
}, "Download template (.csv)"), /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: () => poolFileInputRef.current && poolFileInputRef.current.click(),
  style: {
    background: "none",
    border: "none",
    color: COLORS.pitch,
    cursor: "pointer",
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 11.5,
    padding: 0,
    textDecoration: "underline"
  }
}, "Upload a CSV file"), /*#__PURE__*/React.createElement("input", {
  type: "file",
  accept: ".csv,text/csv",
  ref: poolFileInputRef,
  style: {
    display: "none"
  },
  onChange: e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkText(String(reader.result || ""));
    reader.readAsText(file);
  }
})), /*#__PURE__*/React.createElement("textarea", {
  value: bulkText,
  onChange: e => setBulkText(e.target.value),
  placeholder: "Virat Kohli (C)\tBatsman\tMen\t1234567\nMS Dhoni (WK)\tBatsman\tSenior\t2345678\nBumrah\tBowler\tMen",
  rows: 5,
  style: {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'IBM Plex Mono'",
    fontSize: 12,
    color: COLORS.ink,
    background: COLORS.surface,
    border: `1px solid ${COLORS.willow}`,
    borderRadius: 8,
    padding: "8px 10px",
    resize: "vertical"
  }
}), (() => {
  const rows = bulkText.trim() ? parseBulkPlayers(bulkText) : [];
  const existingNames = new Set((activeClub.playerPool || []).map(p => p.name.trim().toLowerCase()));
  const seen = new Set();
  const withFlags = rows.map(r => {
    const key = r.name.trim().toLowerCase();
    const dup = existingNames.has(key) || seen.has(key);
    seen.add(key);
    return {
      ...r,
      dup
    };
  });
  const toAdd = withFlags.filter(r => !r.dup);
  return rows.length === 0 ? null : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      maxHeight: "40vh",
      overflowY: "auto",
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8
    }
  }, withFlags.map(r => /*#__PURE__*/React.createElement("div", {
    key: r._key,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "6px 10px",
      borderBottom: `1px solid ${COLORS.willow}`,
      opacity: r.dup ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, r.name, r.regNo && ` (${r.regNo})`), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.inkSoft,
      flexShrink: 0
    }
  }, r.dup ? "Already in pool" : [(PLAYER_ROLES.find(x => x.value === r.role) || {}).label, r.isCaptainNote && "Captain", r.isKeeperNote && "Keeper", r.team].filter(Boolean).join(" \u00b7 ") || "No role detected")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: async () => {
      setBulkBusy(true);
      setPoolError("");
      const result = await onAddPoolPlayers(activeClubId, toAdd.map(r => ({
        name: r.name,
        role: r.role,
        team: r.team,
        externalId: r.regNo
      })));
      setBulkBusy(false);
      if (!result.ok) {
        setPoolError(result.error);
        return;
      }
      setBulkText("");
      setBulkOpen(false);
    },
    disabled: bulkBusy || toAdd.length === 0,
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 34,
      fontSize: 12
    }
  }, bulkBusy ? "\u2026" : `Add ${toAdd.length} player${toAdd.length === 1 ? "" : "s"}`), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setBulkText(""),
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      textDecoration: "underline",
      padding: 0
    }
  }, "Clear")));
})()))), /*#__PURE__*/React.createElement("div", {
  style: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 12.5,
    color: COLORS.inkSoft,
    lineHeight: 1.5
  }
}, canManage ? `Add, edit, or delete ${activeClubName}'s teams from the Teams screen.` : `View ${activeClubName}'s teams from the Teams screen.`), onManageTeams && /*#__PURE__*/React.createElement(Btn, {
  onClick: onManageTeams,
  style: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "10px 16px",
    fontSize: 12.5,
    borderRadius: 12
  }
}, canManage ? "Manage teams" : "View teams", /*#__PURE__*/React.createElement(ChevronRight, {
  size: 14
})))), tab === "federations" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FederationsPanel, {
    federationsById: federationsById,
    clubs: clubs,
    currentUid: currentUid,
    onCreateFederation: onCreateFederation,
    onSearchPublicFederations: onSearchPublicFederations,
    onSearchPublicClubs: onSearchPublicClubs,
    onSearchPublicUsers: onSearchPublicUsers,
    onRequestFederationAffiliation: onRequestFederationAffiliation,
    onSetFederationVisibility: onSetFederationVisibility,
    onLeaveFederation: onLeaveFederation,
    onLoadFederationTeams: onLoadFederationTeams,
    onLoadFederationMembers: onLoadFederationMembers,
    federationRequests: federationRequests,
    onCancelFederationRequest: onCancelFederationRequest,
    onRenameFederation: onRenameFederation,
    onUpdateFederationDescription: onUpdateFederationDescription,
    onInviteFederationCoOwnerByEmail: onInviteFederationCoOwnerByEmail,
    coOwnerInvites: coOwnerInvites,
    onCancelCoOwnerInvite: onCancelCoOwnerInvite,
    onRemoveFederationCoOwner: onRemoveFederationCoOwner,
    onKickClubFromFederation: onKickClubFromFederation,
    onDeleteFederation: onDeleteFederation,
    onOpenRecords: onOpenRecords
  })));
}
