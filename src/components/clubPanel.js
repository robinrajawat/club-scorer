import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { BookOpen, ChevronDown, Pencil, Plus } from "./icons.js";
import { Btn, ConfirmModal, PinnableChip, TextField } from "./formUiAtoms.js";
import { VisibilitySwitch } from "./matchDisplayAtoms.js";
import { SearchAndRequestPanel } from "./searchAndRequestPanel.js";
import { uid } from "../core/statsAndFixtures.js";
import { isClubOwner, inviteExpiryLabel, playerAvatarColor, CLUB_LOGO_UPLOAD_ENABLED } from "../core/miscHelpers.js";
import { withPinnedFirst } from "../core/appLogic.js";

// Full club administration: create/join a club, an owner-only "Manage" mode (invite a member or
// co-owner, umpires, members, federation affiliation search, delete), and a self-service "Edit club
// details" form (name/description/address, with a debounced Nominatim address search). Every write
// action is a prop -- the one exception is `searchAddress` (also used, independently, by
// VenueEditModal), a bare-global network call from the debounced address-search effect, not
// extracted; stubbed the usual way in tests that exercise it. Covered by
// tests/unit/components/clubPanel.test.js.

export function ClubPanel({
  clubs,
  activeClubId,
  onSelect,
  onCreate,
  onJoin,
  onInvite,
  onInviteCoOwner,
  coOwnerInvites = [],
  onCancelCoOwnerInvite,
  onLeave,
  onDelete,
  onRename,
  onUpdateDescription,
  onUpdateAddress,
  onUploadLogo,
  onRemoveLogo,
  federationsById = {},
  onLeaveFederation,
  onRemoveMember,
  onRemoveCoOwner,
  onRevokeInvite,
  onRefreshMyMemberName,
  onSetVisibility,
  onSearchPublicFederations,
  onSearchPublicUsers,
  onRequestFederationAffiliation,
  onOpenRecords,
  onAddUmpire,
  onRemoveUmpire,
  currentUid,
  pinnedClubIds = [],
  onTogglePinClub
}) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visBusy, setVisBusy] = useState(false);
  const [findFedOpen, setFindFedOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(null); // email just invited, once sent
  const [inviteBusy, setInviteBusy] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [coOwnerInviteOpen, setCoOwnerInviteOpen] = useState(false);
  const [coOwnerInviteEmail, setCoOwnerInviteEmail] = useState("");
  const [coOwnerInviteSent, setCoOwnerInviteSent] = useState(null); // email just invited, once sent
  const [coOwnerInviteBusy, setCoOwnerInviteBusy] = useState(false);
  const [coOwnerSearchOpen, setCoOwnerSearchOpen] = useState(false);
  const [cancelCoOwnerInviteBusyId, setCancelCoOwnerInviteBusyId] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [descEditing, setDescEditing] = useState(false);
  const [descText, setDescText] = useState("");
  const [descBusy, setDescBusy] = useState(false);
  const [addressText, setAddressText] = useState("");
  const [addressCoords, setAddressCoords] = useState(null); // {lat,lng} from a picked suggestion, cleared on further hand-editing -- same "coords must match the exact text that produced them" reasoning as VenueEditModal
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  // Debounced address search for the club-details form, identical in shape to VenueEditModal's own
  // (same Nominatim endpoint, same 400ms pause-before-searching, same policy reasoning) -- not
  // extracted into one shared component since the two forms differ in everything around the search
  // itself (inline vs modal, what "save" does), and duplicating just this one effect is simpler
  // than threading a shared hook through both call shapes.
  useEffect(() => {
    if (!descEditing || addressCoords) return;
    const q = addressText.trim();
    if (q.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setAddressSearching(true);
    const handle = setTimeout(async () => {
      const results = await searchAddress(q);
      setAddressSuggestions(results);
      setAddressSearching(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [addressText, addressCoords, descEditing]);
  function pickAddressSuggestion(s) {
    setAddressText(s.label);
    setAddressCoords({
      lat: s.lat,
      lng: s.lng
    });
    setAddressSuggestions([]);
  }
  async function handleLogoPick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // let picking the same file again re-fire onChange
    if (!file || !activeClub) return;
    setLogoBusy(true);
    setLogoError("");
    const result = await onUploadLogo(activeClub.id, file);
    setLogoBusy(false);
    if (!result.ok) setLogoError(result.error || "Couldn't upload the logo.");
  }
  async function handleLogoRemove() {
    if (!activeClub || logoBusy) return;
    setLogoBusy(true);
    setLogoError("");
    const result = await onRemoveLogo(activeClub.id);
    setLogoBusy(false);
    if (!result.ok) setLogoError(result.error || "Couldn't remove the logo.");
  }
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberBusyUid, setMemberBusyUid] = useState(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null); // { uid, name } | null
  const [confirmDeleteClub, setConfirmDeleteClub] = useState(false);
  const [umpiresOpen, setUmpiresOpen] = useState(false);
  const [newUmpireName, setNewUmpireName] = useState("");
  const [umpireBusy, setUmpireBusy] = useState(false);
  const [umpireError, setUmpireError] = useState("");
  const [confirmLeaveFederation, setConfirmLeaveFederation] = useState(null); // federation | null
  const [confirmRevokeInvite, setConfirmRevokeInvite] = useState(null); // { code, email } | null
  const [revokeBusyCode, setRevokeBusyCode] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const activeClub = clubs.find(c => c.id === activeClubId) || null;
  const activeIsOwner = activeClub ? isClubOwner(activeClub, currentUid) : false;
  const pendingCoOwnerInvites = activeClub ? coOwnerInvites.filter(inv => inv.scope === "club" && inv.entityId === activeClub.id && inv.status === "pending") : [];
  // Same " · Owner" / " · Co-owner" / "" convention as FederationsPanel's roleLabel(f) just below
  // in this same screen — matching it exactly rather than inventing a parallel one, including
  // showing nothing at all for a plain member (the common case), not a "Member" badge.
  function clubRoleLabel(club) {
    if (!club || !currentUid) return "";
    if (club.ownerUid === currentUid) return " \u00b7 Owner";
    if ((club.coOwnerUids || []).includes(currentUid)) return " \u00b7 Co-owner";
    return "";
  }
  const activeClubFederations = activeClub ? (activeClub.federationIds || []).map(id => federationsById[id]).filter(Boolean) : [];
  // Self-heal a stale/missing memberNames entry the moment a club with one is opened — e.g. a
  // member who joined back when their Google account had no display name set, so it got stored
  // as the literal word "Member" instead of something identifying. Harmless to call again if the
  // freshly computed name still comes out the same.
  useEffect(() => {
    if (!activeClub || !currentUid || !onRefreshMyMemberName) return;
    const stored = activeClub.memberNames && activeClub.memberNames[currentUid];
    if (!stored || stored === "Member") onRefreshMyMemberName(activeClub.id);
    setFindFedOpen(false);
    setManageOpen(false);
  }, [activeClubId]);
  async function handleSetVisibility(isPublic) {
    if (!activeClub || !onSetVisibility) return;
    setVisBusy(true);
    const result = await onSetVisibility(activeClub.id, isPublic);
    setVisBusy(false);
    if (!result.ok) setError(result.error || "Couldn't update visibility.");
  }
  function requestRemoveCoOwner(uid, name) {
    setConfirmRemoveMember({
      uid,
      name,
      role: "coOwner"
    });
  }
  async function handleRemoveCoOwnerClick() {
    const {
      uid
    } = confirmRemoveMember;
    setConfirmRemoveMember(null);
    setMemberBusyUid(uid);
    await onRemoveCoOwner(activeClub.id, uid);
    setMemberBusyUid(null);
  }
  async function submitCoOwnerInvite() {
    if (!coOwnerInviteEmail.trim() || coOwnerInviteBusy) return;
    setCoOwnerInviteBusy(true);
    setError("");
    const result = await onInviteCoOwner(activeClub.id, coOwnerInviteEmail.trim());
    setCoOwnerInviteBusy(false);
    if (!result.ok) {
      setError(result.error || "Couldn't send that invite.");
      return;
    }
    setCoOwnerInviteSent(coOwnerInviteEmail.trim());
  }
  async function handleCancelCoOwnerInviteClick(inviteId) {
    setCancelCoOwnerInviteBusyId(inviteId);
    await onCancelCoOwnerInvite(inviteId);
    setCancelCoOwnerInviteBusyId(null);
  }
  function requestRemoveMember(uid, name) {
    setConfirmRemoveMember({
      uid,
      name,
      role: "member"
    });
  }
  async function handleRemoveMemberClick() {
    const {
      uid
    } = confirmRemoveMember;
    setConfirmRemoveMember(null);
    setMemberBusyUid(uid);
    await onRemoveMember(activeClub.id, uid);
    setMemberBusyUid(null);
  }
  function requestRevokeInvite(code, email) {
    setConfirmRevokeInvite({
      code,
      email
    });
  }
  async function handleRevokeInviteClick() {
    const {
      code
    } = confirmRevokeInvite;
    setConfirmRevokeInvite(null);
    setRevokeBusyCode(code);
    await onRevokeInvite(activeClub.id, code);
    setRevokeBusyCode(null);
  }
  function closeAdd() {
    setMode(null);
    setText("");
    setError("");
  }
  async function submitAdd() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = mode === "create" ? await onCreate(text.trim()) : await onJoin(text.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Something went wrong.");
      return;
    }
    closeAdd();
    if (result.club) onSelect(result.club.id);
  }
  async function submitInvite() {
    if (!inviteEmail.trim() || inviteBusy) return;
    setInviteBusy(true);
    setError("");
    const result = await onInvite(activeClub.id, inviteEmail.trim());
    setInviteBusy(false);
    if (!result.ok) {
      setError(result.error || "Couldn't send that invite.");
      return;
    }
    setInviteSent(inviteEmail.trim());
  }
  // Picking a name-search result never sends the invite directly -- it just fills in the email
  // field of the already-familiar "type email, tap Invite" form and opens it, same as if that
  // email had been typed by hand. Keeps a single, already-tested code path for what actually
  // authorizes and sends an invite (submitInvite/submitCoOwnerInvite above), rather than a second
  // one that only runs when the person was found by search.
  function pickSearchedMember(item) {
    setInviteEmail(item.email);
    setInviteSent(null);
    setInviteOpen(true);
    setMemberSearchOpen(false);
    return Promise.resolve({
      ok: true
    });
  }
  function pickSearchedCoOwner(item) {
    setCoOwnerInviteEmail(item.email);
    setCoOwnerInviteSent(null);
    setCoOwnerInviteOpen(true);
    setCoOwnerSearchOpen(false);
    return Promise.resolve({
      ok: true
    });
  }
  function handleSelect(id) {
    setInviteOpen(false);
    setInviteSent(null);
    setMemberSearchOpen(false);
    setCoOwnerInviteOpen(false);
    setCoOwnerInviteSent(null);
    setCoOwnerSearchOpen(false);
    setError("");
    setRenaming(false);
    setDescEditing(false);
    setMembersOpen(false);
    onSelect(id);
  }
  function startRename() {
    setRenameText(activeClub.name);
    setRenaming(true);
  }
  function startDescEdit() {
    setDescText(activeClub.description || "");
    setAddressText(activeClub.address || "");
    setAddressCoords(activeClub.addressLat != null && activeClub.addressLng != null ? {
      lat: activeClub.addressLat,
      lng: activeClub.addressLng
    } : null);
    setDescEditing(true);
  }
  // A single "Edit club details" entry point covering name, description, and address — previously
  // name/description were two separate pencil buttons in Manage, which made a simple identity edit
  // feel like two different tasks; address joined the same form for the same reason. Reuses the
  // existing rename/description state and submit logic rather than duplicating it, just drives all
  // three together.
  function startEditDetails() {
    startRename();
    startDescEdit();
  }
  function cancelEditDetails() {
    setRenaming(false);
    setDescEditing(false);
    setAddressSuggestions([]);
  }
  async function submitEditDetails() {
    if (!renameText.trim() || renameBusy || descBusy || addressBusy) return;
    const nameChanged = renameText.trim() !== activeClub.name;
    const descChanged = descText.trim() !== (activeClub.description || "");
    const addressChanged = addressText.trim() !== (activeClub.address || "");
    setRenameBusy(nameChanged);
    setDescBusy(descChanged);
    setAddressBusy(addressChanged);
    const [renameResult, descResult, addressResult] = await Promise.all([nameChanged ? onRename(activeClub.id, renameText.trim()) : Promise.resolve({
      ok: true
    }), descChanged ? onUpdateDescription(activeClub.id, descText.trim()) : Promise.resolve({
      ok: true
    }), addressChanged ? onUpdateAddress(activeClub.id, addressText.trim(), addressCoords ? addressCoords.lat : null, addressCoords ? addressCoords.lng : null) : Promise.resolve({
      ok: true
    })]);
    setRenameBusy(false);
    setDescBusy(false);
    setAddressBusy(false);
    if (!renameResult.ok) {
      setError(renameResult.error || "Couldn't rename the club.");
      return;
    }
    if (!descResult.ok) {
      setError(descResult.error || "Couldn't update the description.");
      return;
    }
    if (!addressResult.ok) {
      setError(addressResult.error || "Couldn't update the address.");
      return;
    }
    setRenaming(false);
    setDescEditing(false);
  }
  const chipStyle = active => ({
    padding: "7px 13px",
    borderRadius: 20,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    border: active ? "none" : `1px solid ${COLORS.willow}`,
    background: active ? COLORS.pitchFixed : COLORS.surface,
    color: active ? "#fff" : COLORS.inkSoft,
    whiteSpace: "nowrap"
  });
  const orderedClubs = withPinnedFirst(clubs, pinnedClubIds);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, clubs.length > 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      marginBottom: 6
    }
  }, "\u2192 swipe to see more \u00b7 press and hold to pin"), /*#__PURE__*/React.createElement("div", {
    className: "cs-no-scrollbar",
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      paddingBottom: 4
    }
  }, orderedClubs.map(c => /*#__PURE__*/React.createElement(PinnableChip, {
    key: c.id,
    label: c.name + (c.ownerUid === currentUid ? " · Owner" : (c.coOwnerUids || []).includes(currentUid) ? " · Co-owner" : ""),
    active: activeClubId === c.id,
    pinned: pinnedClubIds.includes(c.id),
    onSelect: () => handleSelect(c.id),
    onTogglePin: () => onTogglePinClub(c.id)
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode(mode ? null : "create"),
    "aria-label": "Add or join a club",
    style: { ...chipStyle(false),
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13,
    strokeWidth: 2.5
  }), " Club")), mode && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
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
  }, "Create a club"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMode("join");
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
      background: mode === "join" ? COLORS.pitchFixed : "rgba(0,0,0,0.06)",
      color: mode === "join" ? "#fff" : COLORS.inkSoft
    }
  }, "Join with code")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: text,
    onChange: v => setText(mode === "join" ? v.toUpperCase().replace(/[^A-Z0-9]/g, "") : v),
    placeholder: mode === "join" ? "Invite code, e.g. 7GQK4RTP" : "Club name",
    autoCapitalize: mode === "join" ? "characters" : "words",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: submitAdd,
    disabled: busy || !text.trim(),
    style: {
      flexShrink: 0,
      padding: "0 16px",
      minHeight: 44
    }
  }, busy ? "\u2026" : mode === "join" ? "Join" : "Create")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12,
      fontFamily: "'Inter'",
      marginTop: 8
    }
  }, error), /*#__PURE__*/React.createElement("button", {
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
  }, "Cancel")), activeClub && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: 14,
      borderRadius: 14,
      background: `color-mix(in srgb, ${COLORS.surface} 60%, transparent)`,
      border: `1px solid ${COLORS.willow}`,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 8
    }
  }, CLUB_LOGO_UPLOAD_ENABLED && (activeClub.logoURL ? /*#__PURE__*/React.createElement("img", {
    src: activeClub.logoURL,
    alt: "",
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: 0
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: playerAvatarColor(activeClub.name),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14,
      flexShrink: 0
    }
  }, activeClub.name.charAt(0).toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
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
  }, activeClub.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.gold,
      flexShrink: 0
    }
  }, clubRoleLabel(activeClub))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8
    }
  }, onOpenRecords && /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenRecords("club", activeClub.id, activeClub.name),
    className: "cs-btn cs-shine",
    "aria-label": `${activeClub.name} Record Book`,
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
  }), "Records"), activeIsOwner && onSetVisibility && /*#__PURE__*/React.createElement(VisibilitySwitch, {
    isPublic: activeClub.visibility === "public",
    busy: visBusy,
    onChange: handleSetVisibility,
    publicHint: "Public \u2014 federations can find and invite this club",
    privateHint: "Private \u2014 not discoverable"
  }), activeIsOwner && /*#__PURE__*/React.createElement("button", {
    onClick: () => setManageOpen(o => !o),
    className: "cs-btn",
    style: {
      background: manageOpen ? COLORS.pitchFixed : `color-mix(in srgb, ${COLORS.surface} 70%, transparent)`,
      border: "none",
      borderRadius: 10,
      color: manageOpen ? "#fff" : COLORS.pitch,
      cursor: "pointer",
      padding: "4px 9px",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 11
    }
  }, manageOpen ? "Done" : "Manage")))), activeClub.description && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 12,
      marginBottom: 8
    }
  }, activeClub.description), activeClub.address && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 11.5,
      marginBottom: 8
    }
  }, "\uD83D\uDCCD ", activeClub.address), /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.inkSoft,
      marginBottom: 8,
      lineHeight: 1.5
    }
  }, "Everyone in \u201C", activeClub.name, "\u201D sees these teams \u2014 only the owner can edit them \u2014 ", activeClub.memberUids.length, " member", activeClub.memberUids.length === 1 ? "" : "s", ".", !activeIsOwner && activeClub.visibility && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: activeClub.visibility === "public" ? COLORS.gold : COLORS.inkSoft
    }
  }, activeClub.visibility === "public" ? "\u00b7 Public" : "\u00b7 Private")), !activeIsOwner && /*#__PURE__*/React.createElement("button", {
    onClick: () => onLeave(activeClub.id),
    style: {
      padding: "6px 10px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      marginBottom: 10
    }
  }, "Leave club"), activeIsOwner && manageOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      marginBottom: 10,
      borderRadius: 12,
      background: `color-mix(in srgb, ${COLORS.gold} 6%, transparent)`,
      border: `1px solid color-mix(in srgb, ${COLORS.gold} 35%, transparent)`
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
  }, "Manage club"), onRename && CLUB_LOGO_UPLOAD_ENABLED && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 14
    }
  }, activeClub.logoURL ? /*#__PURE__*/React.createElement("img", {
    src: activeClub.logoURL,
    alt: "",
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: 0
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: playerAvatarColor(activeClub.name),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 15,
      flexShrink: 0
    }
  }, activeClub.name.charAt(0).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: logoBusy ? "default" : "pointer",
      opacity: logoBusy ? 0.6 : 1,
      padding: 0,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5
    }
  }, logoBusy ? "Uploading\u2026" : activeClub.logoURL ? "Change logo" : "Add logo", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleLogoPick,
    disabled: logoBusy,
    style: {
      display: "none"
    }
  })), activeClub.logoURL && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: handleLogoRemove,
    disabled: logoBusy,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      cursor: logoBusy ? "default" : "pointer",
      opacity: logoBusy ? 0.6 : 1,
      padding: 0,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5
    }
  }, "Remove"))), CLUB_LOGO_UPLOAD_ENABLED && logoError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.live,
      marginBottom: 10
    }
  }, logoError), onRename && (renaming || descEditing) ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: renameText,
    onChange: setRenameText,
    placeholder: "Club name",
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
    placeholder: "Club description (optional)",
    autoCapitalize: "sentences",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: true,
    style: {
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement(TextField, {
    value: addressText,
    onChange: v => {
      setAddressText(v);
      setAddressCoords(null);
    },
    placeholder: "Home ground address (optional)",
    autoCapitalize: "words",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    style: {
      marginBottom: addressCoords || addressSuggestions.length > 0 ? 5 : 8
    }
  }), addressCoords && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.turf,
      marginBottom: 8
    }
  }, "\u2713 Address verified \u2014 this ground can be picked when setting a fixture's venue"), addressSuggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8,
      border: `1px solid ${COLORS.cardDivider}`,
      borderRadius: 10,
      overflow: "hidden"
    }
  }, addressSuggestions.map((s, idx) => /*#__PURE__*/React.createElement("button", {
    key: idx,
    type: "button",
    onClick: () => pickAddressSuggestion(s),
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: COLORS.surface,
      border: "none",
      borderBottom: idx < addressSuggestions.length - 1 ? `1px solid ${COLORS.cardDivider}` : "none",
      padding: "8px 10px",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ink
    }
  }, s.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: submitEditDetails,
    disabled: renameBusy || descBusy || addressBusy || !renameText.trim(),
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 38,
      fontSize: 12.5
    }
  }, renameBusy || descBusy || addressBusy ? "\u2026" : "Save"), /*#__PURE__*/React.createElement("button", {
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
  }, "Cancel"))) : onRename && /*#__PURE__*/React.createElement("button", {
    onClick: startEditDetails,
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
  }), "Edit club name & description"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 4
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
  }, "Invite people"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      lineHeight: 1.5,
      marginBottom: 6
    }
  }, "A member can sign in and view this club's teams and tournaments \u2014 no edit access, and no roster change of its own. Meant for players: they don't need this to be added to a team, only if they'd like to check the roster or schedule themselves."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, (inviteSent ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      lineHeight: 1.5
    }
  }, "Invite sent to ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, inviteSent), " \u2014 they'll see it in their Inbox next time they sign in with that email.") : inviteOpen ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: inviteEmail,
    onChange: setInviteEmail,
    placeholder: "person@example.com",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: submitInvite,
    disabled: inviteBusy || !inviteEmail.trim(),
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 38,
      fontSize: 12.5
    }
  }, inviteBusy ? "\u2026" : "Invite"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setInviteOpen(false),
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
  }, "Cancel")) : /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setInviteOpen(true);
      setInviteEmail("");
      setInviteSent(null);
    },
    style: {
      padding: "6px 10px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: COLORS.surface,
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Invite someone"))), onSearchPublicUsers && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, memberSearchOpen ? /*#__PURE__*/React.createElement(SearchAndRequestPanel, {
    placeholder: "Search by name",
    idKey: "uid",
    avatarKey: "photoURL",
    secondaryKey: "email",
    secondaryPrefix: "",
    actionLabel: "Use",
    alreadyLinkedLabel: "Selected",
    emptyHint: "No one found — they may not have made their profile discoverable yet.",
    onSearch: onSearchPublicUsers,
    onRequest: pickSearchedMember
  }) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMemberSearchOpen(true),
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
  }, "Search by name instead")))), activeIsOwner && manageOpen && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px dashed ${COLORS.willow}`
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
}, `Umpires \u00b7 ${(activeClub.umpires || []).length}`), /*#__PURE__*/React.createElement("button", {
  onClick: () => setUmpiresOpen(o => !o),
  className: "cs-btn",
  "aria-label": umpiresOpen ? "Hide umpires" : "Show umpires",
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
}, umpiresOpen ? "Hide" : "Manage", /*#__PURE__*/React.createElement(ChevronDown, {
  size: 13,
  style: {
    transform: umpiresOpen ? "rotate(180deg)" : "none",
    transition: "transform 0.15s"
  }
}))), umpiresOpen && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 8
  }
}, (activeClub.umpires || []).length === 0 && /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12,
    color: COLORS.inkSoft,
    fontFamily: "'Inter'",
    fontStyle: "italic",
    marginBottom: 8
  }
}, "No umpires added yet \u2014 add a few names below to pick from at match setup, instead of retyping them every time."), (activeClub.umpires || []).map(name => /*#__PURE__*/React.createElement("div", {
  key: name,
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 0"
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 12.5,
    color: COLORS.ink,
    fontFamily: "'Inter'"
  }
}, name), /*#__PURE__*/React.createElement("button", {
  onClick: () => onRemoveUmpire(activeClubId, name),
  "aria-label": `Remove umpire ${name}`,
  style: {
    background: "none",
    border: "none",
    color: COLORS.inkSoft,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 6px"
  }
}, "\u00d7"))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 6,
    marginTop: 8
  }
}, /*#__PURE__*/React.createElement(TextField, {
  value: newUmpireName,
  onChange: setNewUmpireName,
  placeholder: "Umpire name",
  autoCapitalize: "words",
  autoCorrect: "off",
  autoComplete: "off",
  spellCheck: false,
  style: {
    flex: 1,
    padding: "8px 10px",
    fontSize: 13
  }
}), /*#__PURE__*/React.createElement(Btn, {
  onClick: async () => {
    setUmpireBusy(true);
    setUmpireError("");
    const result = await onAddUmpire(activeClubId, newUmpireName);
    setUmpireBusy(false);
    if (!result.ok) {
      setUmpireError(result.error);
      return;
    }
    setNewUmpireName("");
  },
  disabled: umpireBusy || !newUmpireName.trim(),
  style: {
    flexShrink: 0,
    padding: "0 14px"
  }
}, umpireBusy ? "\u2026" : "Add")), umpireError && /*#__PURE__*/React.createElement("div", {
  style: {
    color: COLORS.ball,
    fontSize: 11.5,
    fontFamily: "'Inter'",
    marginTop: 6
  }
}, umpireError))), activeIsOwner && manageOpen && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px dashed ${COLORS.willow}`
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
}, `Members \u00b7 ${activeClub.memberUids.length}`), /*#__PURE__*/React.createElement("button", {
  onClick: () => setMembersOpen(o => !o),
  className: "cs-btn",
  "aria-label": membersOpen ? "Hide members" : "Show members",
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
}, membersOpen ? "Hide" : "Manage", /*#__PURE__*/React.createElement(ChevronDown, {
  size: 13,
  style: {
    transform: membersOpen ? "rotate(180deg)" : "none",
    transition: "transform 0.15s"
  }
}))), membersOpen && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 8
  }
}, activeClub.memberUids.map(uid => {
  const name = activeClub.memberNames && activeClub.memberNames[uid] || `Member ${uid.slice(0, 6)}`;
  const isOwner = uid === activeClub.ownerUid;
  const isCoOwner = (activeClub.coOwnerUids || []).includes(uid);
  const roleLabel = isOwner ? "Owner" : isCoOwner ? "Co-owner" : "Member";
  return /*#__PURE__*/React.createElement("div", {
    key: uid,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontWeight: 600,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: isOwner ? COLORS.gold : isCoOwner ? COLORS.gold : COLORS.inkSoft,
      flexShrink: 0
    }
  }, roleLabel), isCoOwner && /*#__PURE__*/React.createElement("button", {
    onClick: () => requestRemoveCoOwner(uid, name),
    disabled: memberBusyUid === uid,
    style: {
      background: "none",
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "3px 8px",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 10.5,
      cursor: "pointer",
      flexShrink: 0
    }
  }, memberBusyUid === uid ? "\u2026" : "Remove co-owner"), !isOwner && /*#__PURE__*/React.createElement("button", {
    onClick: () => requestRemoveMember(uid, name),
    disabled: memberBusyUid === uid,
    "aria-label": `Remove ${name}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      cursor: "pointer",
      padding: "3px 4px",
      flexShrink: 0,
      fontSize: 14,
      lineHeight: 1
    }
  }, "\u00d7"));
}), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px dashed ${COLORS.willow}`
  }
}, coOwnerInviteSent ? /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11.5,
    color: COLORS.inkSoft,
    fontFamily: "'Inter'",
    lineHeight: 1.5
  }
}, "Invite sent to ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: COLORS.ink
  }
}, coOwnerInviteSent), " \u2014 they'll see it in their Inbox next time they sign in with that email.") : coOwnerInviteOpen ? /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 6,
    alignItems: "center"
  }
}, /*#__PURE__*/React.createElement(TextField, {
  value: coOwnerInviteEmail,
  onChange: setCoOwnerInviteEmail,
  placeholder: "person@example.com",
  autoCapitalize: "none",
  autoCorrect: "off",
  autoComplete: "off",
  spellCheck: false
}), /*#__PURE__*/React.createElement(Btn, {
  onClick: submitCoOwnerInvite,
  disabled: coOwnerInviteBusy || !coOwnerInviteEmail.trim(),
  style: {
    flexShrink: 0,
    padding: "0 14px",
    minHeight: 38,
    fontSize: 12.5
  }
}, coOwnerInviteBusy ? "\u2026" : "Invite"), /*#__PURE__*/React.createElement("button", {
  onClick: () => setCoOwnerInviteOpen(false),
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
}, "Cancel")) : /*#__PURE__*/React.createElement("button", {
  onClick: () => {
    setCoOwnerInviteOpen(true);
    setCoOwnerInviteEmail("");
    setCoOwnerInviteSent(null);
  },
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
}, "+ Invite a co-owner by email"), onSearchPublicUsers && /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 8
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
  onRequest: pickSearchedCoOwner
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
}, "Search by name instead")))))), activeIsOwner && manageOpen && activeClub.pendingInvites && Object.keys(activeClub.pendingInvites).length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "Pending invites"), Object.entries(activeClub.pendingInvites).map(([code, invite]) => /*#__PURE__*/React.createElement("div", {
    key: code,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, invite.email), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: COLORS.inkSoft
    }
  }, inviteExpiryLabel(invite.expiresAt))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.gold,
      flexShrink: 0
    }
  }, invite.role === "coOwner" ? "Co-owner" : "Member"), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestRevokeInvite(code, invite.email),
    disabled: revokeBusyCode === code,
    "aria-label": `Revoke invite to ${invite.email}`,
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
  }, revokeBusyCode === code ? "\u2026" : "Revoke")))), activeIsOwner && manageOpen && pendingCoOwnerInvites.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "Pending invites"), pendingCoOwnerInvites.map(inv => /*#__PURE__*/React.createElement("div", {
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
  }, inv.email), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: COLORS.inkSoft,
      flexShrink: 0
    }
  }, inv.role === "coOwner" ? "Co-owner" : "Member"), /*#__PURE__*/React.createElement("button", {
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
  }, cancelCoOwnerInviteBusyId === inv.id ? "\u2026" : "Cancel")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px dashed ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 6
    }
  }, "Federations this club belongs to"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, activeClubFederations.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 11.5
    }
  }, "Not affiliated with any federation yet."), activeClubFederations.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 6px 5px 10px",
      borderRadius: 16,
      background: "rgba(184,137,43,0.12)",
      border: `1px solid ${COLORS.gold}`,
      fontWeight: 700,
      fontSize: 11.5,
      color: COLORS.pitch
    }
  }, f.name, f.createdBy === currentUid ? " · Owner" : (f.coOwnerUids || []).includes(currentUid) ? " · Co-owner" : "", activeIsOwner && manageOpen && /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmLeaveFederation(f),
    "aria-label": `Leave ${f.name}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 0,
      lineHeight: 1,
      fontSize: 14
    }
  }, "\u00d7"))))), activeIsOwner && manageOpen && onSearchPublicFederations && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px dashed ${COLORS.willow}`
    }
  }, findFedOpen ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SearchAndRequestPanel, {
    placeholder: "Search public federations by name",
    onSearch: onSearchPublicFederations,
    idKey: "federationId",
    actionLabel: "Request",
    alreadyLinkedIds: activeClub.federationIds || [],
    onRequest: fed => onRequestFederationAffiliation("club_to_federation", activeClub.id, fed.federationId)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setFindFedOpen(false),
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
  }, "Close")) : /*#__PURE__*/React.createElement("button", {
    onClick: () => setFindFedOpen(true),
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
  }, "+ Find a federation to join")), activeIsOwner && manageOpen && activeClub.ownerUid === currentUid && /*#__PURE__*/React.createElement("div", {
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
      fontSize: 11.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      marginBottom: 8,
      lineHeight: 1.5
    }
  }, "Deletes this club for everyone, including any teams, tournaments, and player profiles it administers. This can't be undone."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmDeleteClub(true),
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
  }, "Delete club")), confirmRemoveMember && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: confirmRemoveMember.role === "coOwner" ? "Remove co-owner?" : "Remove member?",
    message: confirmRemoveMember.role === "coOwner" ? `Remove ${confirmRemoveMember.name} as co-owner of "${activeClub.name}"? They'll stay on as a plain member.` : `Remove ${confirmRemoveMember.name} from "${activeClub.name}"?`,
    confirmLabel: "Remove",
    onConfirm: confirmRemoveMember.role === "coOwner" ? handleRemoveCoOwnerClick : handleRemoveMemberClick,
    onCancel: () => setConfirmRemoveMember(null)
  }), confirmDeleteClub && activeClub && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Delete this club?",
    message: `Delete "${activeClub.name}" for everyone? This can't be undone \u2014 including any player profiles this club administers (their name, age, role, and batting/bowling hand), not just this club's own teams and tournaments.`,
    confirmLabel: "Delete",
    onConfirm: () => {
      setConfirmDeleteClub(false);
      onDelete(activeClub.id);
    },
    onCancel: () => setConfirmDeleteClub(false)
  }), confirmLeaveFederation && activeClub && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Stop sharing with this federation?",
    message: `Stop sharing "${activeClub.name}"'s teams with "${confirmLeaveFederation.name}"?`,
    confirmLabel: "Stop sharing",
    onConfirm: () => {
      const fed = confirmLeaveFederation;
      setConfirmLeaveFederation(null);
      onLeaveFederation(activeClub.id, fed.id);
    },
    onCancel: () => setConfirmLeaveFederation(null)
  }), confirmRevokeInvite && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Revoke this invite?",
    message: `Revoke the invite to ${confirmRevokeInvite.email}? The code will stop working immediately.`,
    confirmLabel: "Revoke",
    onConfirm: handleRevokeInviteClick,
    onCancel: () => setConfirmRevokeInvite(null)
  }));
}
