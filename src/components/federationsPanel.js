import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { BookOpen, Pencil, Plus } from "./icons.js";
import { Btn, ConfirmModal, TextField } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { VisibilitySwitch } from "./matchDisplayAtoms.js";
import { SearchAndRequestPanel } from "./searchAndRequestPanel.js";
import { uid } from "../core/statsAndFixtures.js";
import { isClubOwner } from "../core/miscHelpers.js";

// Federation administration, the sibling of ClubPanel: create/find-and-request-to-join a
// federation, and, per federation, an owner-only "Manage" mode (edit name/description, invite a
// club by search or by email, invite/remove a co-owner, remove a member club, cancel a pending
// outgoing invite, delete once no clubs remain affiliated). Every write action is a prop -- no bare
// globals, no mount effect; "Manage" loads its member-club list via
// onLoadFederationMembers/onLoadFederationTeams/onSearchPublicClubs, all props, from its own click
// handler. Covered by tests/unit/components/federationsPanel.test.js.

export function FederationsPanel({
  federationsById = {},
  clubs,
  currentUid,
  onCreateFederation,
  onSearchPublicFederations,
  onSearchPublicClubs,
  onSearchPublicUsers,
  onRequestFederationAffiliation,
  onSetFederationVisibility,
  onLeaveFederation,
  onLoadFederationTeams,
  onLoadFederationMembers,
  onRenameFederation,
  onUpdateFederationDescription,
  onInviteFederationCoOwnerByEmail,
  coOwnerInvites = [],
  onCancelCoOwnerInvite,
  onRemoveFederationCoOwner,
  onKickClubFromFederation,
  onDeleteFederation,
  federationRequests = [],
  onCancelFederationRequest,
  onOpenRecords
}) {
  const federations = Object.values(federationsById).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const [mode, setMode] = useState(null); // null | 'create' | 'find'
  const [text, setText] = useState("");
  const [joinClubId, setJoinClubId] = useState(clubs[0] ? clubs[0].id : "");
  const [busy, setBusy] = useState(false);
  const [visBusyId, setVisBusyId] = useState(null);
  const [findClubOpen, setFindClubOpen] = useState(false);
  const [error, setError] = useState("");
  const [manageOpenId, setManageOpenId] = useState(null);
  const [manageClubs, setManageClubs] = useState([]);
  const [manageNameById, setManageNameById] = useState({});
  const [manageLoading, setManageLoading] = useState(false);
  const [kickBusyClubId, setKickBusyClubId] = useState(null);
  const [cancelInviteBusyId, setCancelInviteBusyId] = useState(null);
  const [deleteFedBusy, setDeleteFedBusy] = useState(false);
  const [deleteFedConfirmId, setDeleteFedConfirmId] = useState(null);
  const [deleteFedError, setDeleteFedError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [descEditing, setDescEditing] = useState(false);
  const [descText, setDescText] = useState("");
  const [descBusy, setDescBusy] = useState(false);
  const [emailInviteKind, setEmailInviteKind] = useState(null); // null | 'club' | 'coOwner'
  const [emailInviteText, setEmailInviteText] = useState("");
  const [emailInviteBusy, setEmailInviteBusy] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState("");
  const [emailInviteResult, setEmailInviteResult] = useState(null); // {kind, email, code}
  const [coOwnerSearchOpen, setCoOwnerSearchOpen] = useState(false);
  const [leaveBusyClubId, setLeaveBusyClubId] = useState(null);
  const [confirmKick, setConfirmKick] = useState(null); // { federationId, clubId, clubName } | null
  const [confirmLeave, setConfirmLeave] = useState(null); // { clubId, federationId, federationName } | null
  const [confirmRemoveCoOwner, setConfirmRemoveCoOwner] = useState(null); // { federationId, uid } | null
  const [coOwnerBusyUid, setCoOwnerBusyUid] = useState(null);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState(null); // { requestId, clubName } | null
  const [cancelCoOwnerInviteBusyId, setCancelCoOwnerInviteBusyId] = useState(null);
  function pendingCoOwnerInvitesFor(f) {
    return coOwnerInvites.filter(inv => inv.scope === "federation" && inv.entityId === f.id && inv.status === "pending");
  }
  async function handleCancelCoOwnerInviteClick(inviteId) {
    setCancelCoOwnerInviteBusyId(inviteId);
    await onCancelCoOwnerInvite(inviteId);
    setCancelCoOwnerInviteBusyId(null);
  }
  function isOwner(f) {
    return !!f && !!currentUid && (f.createdBy === currentUid || (f.coOwnerUids || []).includes(currentUid));
  }
  // Outgoing federation_to_club invites sent by search (as opposed to the co-owner invites shown
  // lower down) -- these live in federationRequests, not on the federation doc itself, so without
  // this they were invisible in the manage panel: a club could
  // have an invite sitting unanswered and the owner would have no way to see it, cancel it, or
  // avoid sending a second one. manageNameById is populated by openManage; falls back to the raw
  // clubId if a name was never resolved (e.g. panel not yet opened this session).
  function pendingClubInvitesFor(f) {
    return federationRequests.filter(r => r.direction === "federation_to_club" && r.status === "pending" && r.federationId === f.id).map(r => ({
      requestId: r.id,
      clubId: r.clubId,
      clubName: manageNameById[r.clubId] || r.clubId
    }));
  }
  function roleLabel(f) {
    if (!f || !currentUid) return "";
    if (f.createdBy === currentUid) return " · Owner";
    if ((f.coOwnerUids || []).includes(currentUid)) return " · Co-owner";
    return "";
  }
  function closeAdd() {
    setMode(null);
    setText("");
    setError("");
  }
  async function submitCreate() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await onCreateFederation(text.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Couldn't create the federation.");
      return;
    }
    closeAdd();
  }
  async function submitRequestJoin(federation) {
    if (!joinClubId) return {
      ok: false,
      error: "Pick which of your clubs is requesting this."
    };
    return onRequestFederationAffiliation("club_to_federation", joinClubId, federation.federationId);
  }
  async function handleSetVisibility(federationId, isPublic) {
    setVisBusyId(federationId);
    const result = await onSetFederationVisibility(federationId, isPublic);
    setVisBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't update visibility.");
  }
  function openManage(f) {
    setManageOpenId(f.id);
    setRenaming(false);
    setDescEditing(false);
    setDescText(f.description || "");
    setEmailInviteKind(null);
    setEmailInviteResult(null);
    setFindClubOpen(false);
    setManageClubs([]);
    setManageLoading(true);
    // Member list is driven by affiliatedClubIds (the actual join/leave record), not by which
    // clubs happen to have published a team into this federation's directory -- those are two
    // different things (a club can affiliate without ever publishing a team). Team data and the
    // public clubDirectory are used only to resolve a display name for each affiliated id, in
    // that priority order, since a federation owner has no Firestore read access to a club doc
    // they don't belong to (see clubs/{clubId} rules) -- a private club with no published team
    // has no name available at all and falls back to a placeholder.
    Promise.all([onLoadFederationMembers(f.id), onLoadFederationTeams(f.id), onSearchPublicClubs("")]).then(([members, teams, directory]) => {
      // Priority: members directory (written at join time for every affiliated club, so this is
      // the only source guaranteed to cover all of them) > clubDirectory (public clubs only) >
      // team snapshot (covers pre-existing affiliations from before the members directory
      // existed). Members intentionally wins over the team snapshot too, since a club can rename
      // itself after publishing a team but before its membership doc is next touched -- rare, but
      // members is the fresher of the two either way.
      const nameById = new Map();
      (teams || []).forEach(t => nameById.set(t.clubId, t.clubName));
      (directory || []).forEach(c => {
        if (c.clubId) nameById.set(c.clubId, c.name || "");
      });
      (members || []).forEach(m => nameById.set(m.clubId, m.clubName));
      const list = (f.affiliatedClubIds || []).map(clubId => ({
        clubId,
        clubName: nameById.get(clubId) || "Unnamed club"
      }));
      setManageLoading(false);
      setManageClubs(list);
      setManageNameById(Object.fromEntries(nameById)); // also feeds pendingClubInvitesFor's name lookup
    });
  }
  function toggleManage(f) {
    if (manageOpenId === f.id) {
      setManageOpenId(null);
      return;
    }
    openManage(f);
  }
  function startRename(f) {
    setRenaming(f.id);
    setRenameText(f.name);
  }
  function startDescEdit(f) {
    setDescText(f.description || "");
    setDescEditing(true);
  }
  // Same merge as ClubPanel: one "Edit federation details" entry point covering name and
  // description together, instead of two separate pencil buttons.
  function startEditDetails(f) {
    startRename(f);
    startDescEdit(f);
  }
  function cancelEditDetails() {
    setRenaming(false);
    setDescEditing(false);
  }
  async function submitEditDetails(f) {
    if (!renameText.trim() || renameBusy || descBusy) return;
    const nameChanged = renameText.trim() !== f.name;
    const descChanged = descText.trim() !== (f.description || "");
    setRenameBusy(nameChanged);
    setDescBusy(descChanged);
    const [renameResult, descResult] = await Promise.all([nameChanged ? onRenameFederation(f.id, renameText.trim()) : Promise.resolve({
      ok: true
    }), descChanged ? onUpdateFederationDescription(f.id, descText.trim()) : Promise.resolve({
      ok: true
    })]);
    setRenameBusy(false);
    setDescBusy(false);
    if (!renameResult.ok) {
      setError(renameResult.error || "Couldn't rename the federation.");
      return;
    }
    if (!descResult.ok) {
      setError(descResult.error || "Couldn't update the description.");
      return;
    }
    setRenaming(false);
    setDescEditing(false);
  }
  function startEmailInvite(kind) {
    setEmailInviteKind(kind);
    setEmailInviteText("");
    setEmailInviteError("");
    setEmailInviteResult(null);
    setCoOwnerSearchOpen(false);
  }
  // Picking a name-search result never sends the invite directly -- it just fills in the email
  // field of the already-familiar email-invite form, same as if that email had been typed by
  // hand. See ClubPanel's identical pickSearchedMember/pickSearchedCoOwner for the same reasoning.
  function pickSearchedFederationCoOwner(item) {
    setEmailInviteText(item.email);
    setEmailInviteError("");
    setEmailInviteResult(null);
    setCoOwnerSearchOpen(false);
    return Promise.resolve({
      ok: true
    });
  }
  async function submitEmailInvite(federationId) {
    if (!emailInviteText.trim() || emailInviteBusy) return;
    setEmailInviteBusy(true);
    setEmailInviteError("");
    const result = await onInviteFederationCoOwnerByEmail(federationId, emailInviteText.trim());
    setEmailInviteBusy(false);
    if (!result.ok) {
      setEmailInviteError(result.error || "Couldn't send that invite.");
      return;
    }
    setEmailInviteResult({
      kind: emailInviteKind,
      email: emailInviteText.trim()
    });
  }
  function requestRemoveCoOwner(federationId, uid) {
    setConfirmRemoveCoOwner({
      federationId,
      uid
    });
  }
  async function handleRemoveCoOwnerClick() {
    const {
      federationId,
      uid
    } = confirmRemoveCoOwner;
    setConfirmRemoveCoOwner(null);
    setCoOwnerBusyUid(uid);
    const result = await onRemoveFederationCoOwner(federationId, uid);
    setCoOwnerBusyUid(null);
    if (result && !result.ok) {
      setError(result.error || "Couldn't remove that co-owner.");
    }
  }
  function requestKick(federationId, clubId, clubName) {
    setConfirmKick({
      federationId,
      clubId,
      clubName
    });
  }
  async function handleKick() {
    const {
      federationId,
      clubId
    } = confirmKick;
    setConfirmKick(null);
    setKickBusyClubId(clubId);
    const result = await onKickClubFromFederation(federationId, clubId);
    setKickBusyClubId(null);
    if (result.ok) {
      setManageClubs(cs => cs.filter(c => c.clubId !== clubId));
    } else {
      setError(result.error || "Couldn't remove that club.");
    }
  }
  function requestDeleteFederation(federationId) {
    setDeleteFedError("");
    setDeleteFedConfirmId(federationId);
  }
  function requestCancelInvite(requestId, clubName) {
    setConfirmCancelInvite({
      requestId,
      clubName
    });
  }
  async function handleCancelInviteClick() {
    const {
      requestId
    } = confirmCancelInvite;
    setConfirmCancelInvite(null);
    setCancelInviteBusyId(requestId);
    const result = await onCancelFederationRequest(requestId);
    setCancelInviteBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't cancel that invite.");
  }
  async function handleDeleteFederationConfirm() {
    const federationId = deleteFedConfirmId;
    setDeleteFedConfirmId(null);
    setDeleteFedBusy(true);
    const result = await onDeleteFederation(federationId);
    setDeleteFedBusy(false);
    if (!result.ok) {
      setDeleteFedError(result.error || "Couldn't delete that federation.");
    }
  }
  function requestLeave(clubId, federationId, federationName) {
    const club = clubs.find(c => c.id === clubId);
    setConfirmLeave({
      clubId,
      federationId,
      federationName,
      clubName: club ? club.name : "this club"
    });
  }
  async function handleLeave() {
    const {
      clubId,
      federationId
    } = confirmLeave;
    setConfirmLeave(null);
    setLeaveBusyClubId(clubId);
    await onLeaveFederation(clubId, federationId);
    setLeaveBusyClubId(null);
  }
  const cardStyle = {
    background: `color-mix(in srgb, ${COLORS.surface} 60%, transparent)`,
    border: `1px solid ${COLORS.willow}`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, "Only a federation's own owner or co-owner can rename it, edit its description, invite a club, or invite a co-owner."), federations.length === 0 && !mode && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      marginBottom: 12
    }
  }, "You're not connected to any federation yet."), federations.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: cardStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 16,
      color: COLORS.pitch,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, f.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.gold,
      flexShrink: 0
    }
  }, roleLabel(f))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8
    }
  }, onOpenRecords && /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenRecords("federation", f.id, f.name),
    className: "cs-btn cs-shine",
    "aria-label": `${f.name} Record Book`,
    style: {
      background: `color-mix(in srgb, ${COLORS.gold} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${COLORS.gold} 35%, transparent)`,
      borderRadius: 20,
      color: COLORS.pitch,
      cursor: "pointer",
      padding: "5px 10px 5px 8px",
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 11.5,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(BookOpen, {
    size: 14
  }), "Records"), isOwner(f) && /*#__PURE__*/React.createElement(VisibilitySwitch, {
    isPublic: f.visibility === "public",
    busy: visBusyId === f.id,
    onChange: isPublic => handleSetVisibility(f.id, isPublic)
  }), isOwner(f) && /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleManage(f),
    className: "cs-btn",
    style: {
      background: manageOpenId === f.id ? COLORS.pitchFixed : `color-mix(in srgb, ${COLORS.surface} 70%, transparent)`,
      border: "none",
      borderRadius: 10,
      color: manageOpenId === f.id ? "#fff" : COLORS.pitch,
      cursor: "pointer",
      padding: "4px 9px",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 11
    }
  }, manageOpenId === f.id ? "Close" : "Manage"))), f.description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, f.description), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, (f.affiliatedClubIds || []).length, " club", (f.affiliatedClubIds || []).length === 1 ? "" : "s", " affiliated", !isOwner(f) && f.visibility && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: f.visibility === "public" ? COLORS.gold : COLORS.inkSoft
    }
  }, f.visibility === "public" ? "\u00b7 Public" : "\u00b7 Private")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Your clubs here"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: manageOpenId === f.id ? 10 : 0
    }
  }, clubs.filter(c => (c.federationIds || []).includes(f.id)).length === 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "None of your clubs are affiliated with this one.") : clubs.filter(c => (c.federationIds || []).includes(f.id)).map(c => /*#__PURE__*/React.createElement("span", {
    key: c.id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 5px 4px 9px",
      borderRadius: 14,
      background: "rgba(184,137,43,0.12)",
      border: `1px solid ${COLORS.gold}`,
      fontWeight: 600,
      fontSize: 11,
      color: COLORS.pitch
    }
  }, c.name, isClubOwner(c, currentUid) && /*#__PURE__*/React.createElement("button", {
    onClick: () => requestLeave(c.id, f.id, f.name),
    disabled: leaveBusyClubId === c.id,
    "aria-label": `Stop sharing ${c.name} with ${f.name}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 0,
      lineHeight: 1,
      fontSize: 13
    }
  }, "\u00d7")))), manageOpenId === f.id && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: COLORS.pitch,
      marginBottom: 10
    }
  }, "Manage federation"), (renaming === f.id || descEditing) ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: renameText,
    onChange: setRenameText,
    placeholder: "Federation name",
    autoCapitalize: "words",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    style: {
      marginBottom: 6
    }
  }), /*#__PURE__*/React.createElement(TextField, {
    value: descText,
    onChange: setDescText,
    placeholder: "Federation description (optional)",
    autoCapitalize: "sentences",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: true,
    style: {
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => submitEditDetails(f),
    disabled: renameBusy || descBusy || !renameText.trim(),
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 38,
      fontSize: 12.5
    }
  }, renameBusy || descBusy ? "\u2026" : "Save"), /*#__PURE__*/React.createElement("button", {
    onClick: cancelEditDetails,
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: "0 4px"
    }
  }, "Cancel"))) : /*#__PURE__*/React.createElement("button", {
    onClick: () => startEditDetails(f),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      marginBottom: 14,
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 0,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 12
  }), "Edit federation name & description"), /*#__PURE__*/React.createElement("button", {
    onClick: () => startEmailInvite("coOwner"),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      marginBottom: 14,
      padding: "6px 10px",
      borderRadius: 8,
      border: `1px solid ${COLORS.gold}`,
      background: "rgba(184,137,43,0.08)",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      width: "fit-content"
    }
  }, "+ Invite a co-owner"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "All member clubs"), manageLoading ? /*#__PURE__*/React.createElement(LoadingNote, {
    size: 14
  }) : manageClubs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontStyle: "italic",
      marginBottom: 10
    }
  }, "No clubs affiliated yet.") : manageClubs.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.clubId,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "5px 0",
      fontFamily: "'Inter'",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.ink,
      fontWeight: 600
    }
  }, c.clubName), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestKick(f.id, c.clubId, c.clubName),
    disabled: kickBusyClubId === c.clubId,
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      textDecoration: "underline",
      padding: 0
    }
  }, kickBusyClubId === c.clubId ? "\u2026" : "Remove"))), isOwner(f) && pendingClubInvitesFor(f).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px dashed ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Pending club invites"), pendingClubInvitesFor(f).map(inv => /*#__PURE__*/React.createElement("div", {
    key: inv.requestId,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "5px 0",
      fontFamily: "'Inter'",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft
    }
  }, inv.clubName, " \u2014 awaiting response"), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestCancelInvite(inv.requestId, inv.clubName),
    disabled: cancelInviteBusyId === inv.requestId,
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      textDecoration: "underline",
      padding: 0
    }
  }, cancelInviteBusyId === inv.requestId ? "\u2026" : "Cancel")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px dashed ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Co-owners"), (f.coOwnerUids || []).length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontStyle: "italic"
    }
  }, "No co-owners yet.") : (f.coOwnerUids || []).map(uid => /*#__PURE__*/React.createElement("div", {
    key: uid,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "5px 0",
      fontFamily: "'Inter'",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.ink,
      fontWeight: 600
    }
  }, `Co-owner ${uid.slice(0, 6)}`), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestRemoveCoOwner(f.id, uid),
    disabled: coOwnerBusyUid === uid,
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      textDecoration: "underline",
      padding: 0
    }
  }, coOwnerBusyUid === uid ? "\u2026" : "Remove"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px dashed ${COLORS.willow}`,
      display: "flex",
      gap: 14,
      flexWrap: "wrap"
    }
  }, findClubOpen ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement(SearchAndRequestPanel, {
    placeholder: "Search public clubs by name",
    onSearch: onSearchPublicClubs,
    idKey: "clubId",
    actionLabel: "Invite",
    alreadyLinkedIds: [...manageClubs.map(c => c.clubId), ...pendingClubInvitesFor(f).map(inv => inv.clubId)],
    alreadyLinkedLabel: "Member",
    linkedLabelById: Object.fromEntries(pendingClubInvitesFor(f).map(inv => [inv.clubId, "Invited"])),
    onRequest: club => onRequestFederationAffiliation("federation_to_club", club.clubId, f.id)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setFindClubOpen(false),
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: "0 4px",
      marginTop: 4
    }
  }, "Close")) : emailInviteKind ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: emailInviteText,
    onChange: setEmailInviteText,
    placeholder: "person@example.com",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => submitEmailInvite(f.id),
    disabled: emailInviteBusy || !emailInviteText.trim(),
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 38,
      fontSize: 12.5
    }
  }, emailInviteBusy ? "\u2026" : "Invite"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEmailInviteKind(null),
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: "0 4px"
    }
  }, "Cancel")), emailInviteKind === "coOwner" && onSearchPublicUsers && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, coOwnerSearchOpen ? /*#__PURE__*/React.createElement(SearchAndRequestPanel, {
    placeholder: "Search by name",
    idKey: "uid",
    avatarKey: "photoURL",
    secondaryKey: "email",
    secondaryPrefix: "",
    actionLabel: "Use",
    alreadyLinkedLabel: "Selected",
    emptyHint: "No one found — they may not have made their profile discoverable yet.",
    onSearch: onSearchPublicUsers,
    onRequest: pickSearchedFederationCoOwner
  }) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setCoOwnerSearchOpen(true),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      cursor: "pointer",
      padding: 0,
      textDecoration: "underline"
    }
  }, "Search by name instead")), emailInviteError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 11.5,
      fontFamily: "'Inter'",
      marginTop: 6
    }
  }, emailInviteError), emailInviteResult && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      marginTop: 6,
      lineHeight: 1.5
    }
  }, "Invite sent to ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, emailInviteResult.email), " \u2014 they'll see it in their Inbox next time they sign in with that email.")) : /*#__PURE__*/React.createElement("button", {
    onClick: () => setFindClubOpen(true),
    className: "cs-btn",
    style: {
      padding: "5px 9px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: COLORS.surface,
      color: COLORS.pitch,
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5
    }
  }, "+ Find a club to invite"))), isOwner(f) && pendingCoOwnerInvitesFor(f).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      background: `color-mix(in srgb, ${COLORS.surface} 60%, transparent)`,
      border: `1px solid ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Pending co-owner invites"), pendingCoOwnerInvitesFor(f).map(inv => /*#__PURE__*/React.createElement("div", {
    key: inv.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 0"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 12,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, inv.email), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCancelCoOwnerInviteClick(inv.id),
    disabled: cancelCoOwnerInviteBusyId === inv.id,
    "aria-label": `Cancel invite to ${inv.email}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11,
      cursor: "pointer",
      padding: "3px 4px",
      flexShrink: 0,
      textDecoration: "underline"
    }
  }, cancelCoOwnerInviteBusyId === inv.id ? "\u2026" : "Cancel")))), isOwner(f) && (f.affiliatedClubIds || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      background: `color-mix(in srgb, ${COLORS.ball} 6%, transparent)`,
      border: `1px solid color-mix(in srgb, ${COLORS.ball} 30%, transparent)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: COLORS.ball,
      marginBottom: 6
    }
  }, "Danger zone"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 8,
      lineHeight: 1.5
    }
  }, "No clubs are affiliated, so this is safe to remove for good. This can't be undone."), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestDeleteFederation(f.id),
    disabled: deleteFedBusy,
    className: "cs-btn",
    style: {
      padding: "6px 10px",
      borderRadius: 8,
      border: `1px solid ${COLORS.ball}`,
      background: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer"
    }
  }, deleteFedBusy ? "\u2026" : "Delete this federation"), deleteFedError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.ball,
      marginTop: 6
    }
  }, deleteFedError))))), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12,
      fontFamily: "'Inter'",
      marginTop: 4,
      marginBottom: 8
    }
  }, error), mode ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      borderRadius: 12,
      background: `color-mix(in srgb, ${COLORS.surface} 60%, transparent)`,
      border: `1px solid ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMode("create");
      setText("");
      setError("");
    },
    style: {
      flex: 1,
      padding: "6px 8px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      background: mode === "create" ? COLORS.pitchFixed : "rgba(0,0,0,0.06)",
      color: mode === "create" ? "#fff" : COLORS.inkSoft
    }
  }, "New federation"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMode("find");
      setText("");
      setError("");
    },
    style: {
      flex: 1,
      padding: "6px 8px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      background: mode === "find" ? COLORS.pitchFixed : "rgba(0,0,0,0.06)",
      color: mode === "find" ? "#fff" : COLORS.inkSoft
    }
  }, "Find a federation")), mode === "find" && clubs.length > 1 && /*#__PURE__*/React.createElement("select", {
    value: joinClubId,
    onChange: e => setJoinClubId(e.target.value),
    style: {
      width: "100%",
      marginBottom: 8,
      fontFamily: "'Inter'",
      fontSize: 13,
      padding: "8px 6px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: COLORS.surface
    }
  }, clubs.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, "Request as ", c.name))), mode === "find" && clubs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      marginBottom: 8
    }
  }, "You need a club of your own before you can request to affiliate one with a federation."), mode === "find" ? clubs.length > 0 && /*#__PURE__*/React.createElement(SearchAndRequestPanel, {
    placeholder: "Search public federations by name",
    onSearch: onSearchPublicFederations,
    idKey: "federationId",
    actionLabel: "Request",
    alreadyLinkedIds: (clubs.find(c => c.id === joinClubId) || {}).federationIds || [],
    onRequest: submitRequestJoin
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: text,
    onChange: setText,
    placeholder: "Federation name, e.g. DCF",
    autoCapitalize: "words",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: submitCreate,
    disabled: busy || !text.trim(),
    style: {
      flexShrink: 0,
      padding: "0 16px",
      minHeight: 44
    }
  }, busy ? "\u2026" : "Create")), /*#__PURE__*/React.createElement("button", {
    onClick: closeAdd,
    style: {
      display: "block",
      marginTop: 8,
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Cancel")) : /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMode("create");
      setText("");
      setError("");
    },
    className: "cs-btn",
    style: {
      padding: "8px 14px",
      borderRadius: 10,
      border: `1px dashed ${COLORS.willow}`,
      background: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13,
    strokeWidth: 2.5
  }), " Federation"), deleteFedConfirmId && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Delete federation?",
    message: `This permanently deletes "${(federationsById[deleteFedConfirmId] || {}).name || "this federation"}". It can't be undone, and this is only possible because no clubs are currently affiliated with it.`,
    confirmLabel: "Delete",
    variant: "danger",
    busy: deleteFedBusy,
    onConfirm: handleDeleteFederationConfirm,
    onCancel: () => setDeleteFedConfirmId(null)
  }), confirmKick && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Remove this club?",
    message: `Remove ${confirmKick.clubName} from the federation? It'll stop showing up in tournament pickers for other member clubs.`,
    confirmLabel: "Remove",
    onConfirm: handleKick,
    onCancel: () => setConfirmKick(null)
  }), confirmLeave && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Stop sharing with this federation?",
    message: `Stop sharing "${confirmLeave.clubName}"'s teams with "${confirmLeave.federationName}"?`,
    confirmLabel: "Stop sharing",
    onConfirm: handleLeave,
    onCancel: () => setConfirmLeave(null)
  }), confirmRemoveCoOwner && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Remove co-owner?",
    message: "Remove this co-owner from the federation? They'll lose the ability to rename it, edit its description, or manage invites.",
    confirmLabel: "Remove",
    onConfirm: handleRemoveCoOwnerClick,
    onCancel: () => setConfirmRemoveCoOwner(null)
  }), confirmCancelInvite && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Cancel this invite?",
    message: `Cancel the pending invite to ${confirmCancelInvite.clubName}? They'll no longer be able to accept it.`,
    confirmLabel: "Cancel invite",
    onConfirm: handleCancelInviteClick,
    onCancel: () => setConfirmCancelInvite(null)
  }));
}
