import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, ChevronRight, Hand } from "./icons.js";
import { Btn } from "./formUiAtoms.js";
import { AvailabilityPollModal } from "./availabilityPollModal.js";
import { isClubOwner } from "../core/miscHelpers.js";

// Combined "inbox" screen: availability polls waiting on a response, plus club-federation
// affiliation requests sent or received. Every write action (respond/cancel/complete-join) is a
// prop; the one Firestore-adjacent piece is AvailabilityPollModal, opened for a tapped poll item,
// which is already its own tested module. Covered by tests/unit/components/inboxScreen.test.js.

export function InboxScreen({
  requests,
  clubs,
  federationsById,
  currentUid,
  currentEmail,
  onRespond,
  onCancel,
  onCompleteJoin,
  coOwnerInvites = [],
  onRespondCoOwnerInvite,
  onCancelCoOwnerInvite,
  activity = [],
  onMarkActivityRead,
  onDeleteActivity,
  pollItems = [],
  onPollsChanged,
  onBack
}) {
  const [busyId, setBusyId] = useState(null);
  const [coOwnerBusyId, setCoOwnerBusyId] = useState(null);
  const [error, setError] = useState("");
  const [openPoll, setOpenPoll] = useState(null); // {clubId, clubName, team, code} | null
  // Accepting/declining a co-owner invite used to give NO feedback at all -- the card just
  // vanished from the incoming list with nothing to confirm it worked. This is the one-time
  // confirmation shown right after responding, cleared on the next navigation into this screen
  // (see the recipient's own click handler below for where it's set).
  const [justRespondedCoOwnerInvite, setJustRespondedCoOwnerInvite] = useState(null); // {name, accept, role} | null
  function clubById(id) {
    return clubs.find(c => c.id === id) || null;
  }
  function fedById(id) {
    return federationsById[id] || null;
  }
  function clubName(id) {
    const c = clubById(id);
    return c && c.name || "a club";
  }
  function fedName(id) {
    const f = fedById(id);
    return f && f.name || "a federation";
  }
  function isMyClub(id) {
    return isClubOwner(clubById(id), currentUid);
  }
  function isMyFederation(id) {
    const f = fedById(id);
    return !!f && !!currentUid && (f.createdBy === currentUid || (f.coOwnerUids || []).includes(currentUid));
  }
  const incoming = requests.filter(r => r.status === "pending" && (r.direction === "club_to_federation" && isMyFederation(r.federationId) || r.direction === "federation_to_club" && isMyClub(r.clubId)));
  const outgoing = requests.filter(r => r.status === "pending" && (r.direction === "club_to_federation" && isMyClub(r.clubId) || r.direction === "federation_to_club" && isMyFederation(r.federationId)));
  const needsFinalize = requests.filter(r => r.direction === "club_to_federation" && r.status === "accepted" && isMyClub(r.clubId));
  const myEmailLower = (currentEmail || "").toLowerCase();
  const incomingCoOwnerInvites = coOwnerInvites.filter(inv => inv.status === "pending" && inv.email === myEmailLower);
  // Sending an invite used to give the sender no way to ever find out what happened to it -- an
  // accepted/declined invite just dropped out of this same status==="pending" filter and was gone
  // for good. Keeping a resolved one visible for a week (the same expiry window a still-pending
  // invite gets, see CLUB_INVITE_TTL_DAYS in index.html) gives the sender one real chance to see
  // the outcome next time they open their Inbox, then lets it quietly age out like everything else
  // here rather than needing an explicit dismiss action this collection's rules don't support
  // anyway (delete is `false` -- see firestore.rules).
  const RESOLVED_COOWNER_INVITE_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;
  const outgoingCoOwnerInvites = coOwnerInvites.filter(inv => {
    if (inv.createdBy !== currentUid) return false;
    if (inv.status === "pending") return true;
    if (inv.status === "accepted" || inv.status === "declined") {
      return inv.respondedAt && Date.now() - inv.respondedAt < RESOLVED_COOWNER_INVITE_VISIBLE_MS;
    }
    return false; // cancelled -- the sender already knows, they did it themselves
  });
  // Prefers the name snapshotted onto the invite itself at send time (see inviteCoOwner in
  // index.html) -- the recipient of an incoming invite has no read access to the real club/
  // federation doc (not a member yet), so clubName/fedName's own-data lookup would come up empty
  // for them specifically. Falls back to that lookup for any invite sent before this field
  // existed, and for the sender's own outgoing card (already has full access either way).
  function coOwnerInviteEntityName(inv) {
    if (inv.entityName) return inv.entityName;
    return inv.scope === "club" ? clubName(inv.entityId) : fedName(inv.entityId);
  }
  // The "sent" card's own copy, branching on how it was resolved -- see outgoingCoOwnerInvites
  // above for why a resolved one still shows up here at all.
  function outgoingCoOwnerInviteLine(inv) {
    const name = coOwnerInviteEntityName(inv);
    const roleWord = inv.role === "member" ? "join" : "co-own";
    if (inv.status === "accepted") return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, inv.email), " accepted your invite to ", roleWord, " ", /*#__PURE__*/React.createElement("strong", null, name));
    if (inv.status === "declined") return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, inv.email), " declined your invite to ", roleWord, " ", /*#__PURE__*/React.createElement("strong", null, name));
    return /*#__PURE__*/React.createElement(React.Fragment, null, "You invited ", /*#__PURE__*/React.createElement("strong", null, inv.email), " to ", roleWord, " ", /*#__PURE__*/React.createElement("strong", null, name), " — waiting on a response");
  }
  async function handleRespondCoOwner(inv, accept) {
    if (coOwnerBusyId) return;
    setCoOwnerBusyId(inv.id);
    setError("");
    setJustRespondedCoOwnerInvite(null);
    const name = coOwnerInviteEntityName(inv);
    const result = await onRespondCoOwnerInvite(inv.id, accept);
    setCoOwnerBusyId(null);
    if (!result.ok) {
      setError(result.error || "Couldn't respond to that invite.");
      return;
    }
    setJustRespondedCoOwnerInvite({
      name,
      accept,
      role: inv.role
    });
  }
  async function handleCancelCoOwner(inv) {
    if (coOwnerBusyId) return;
    setCoOwnerBusyId(inv.id);
    setError("");
    const result = await onCancelCoOwnerInvite(inv.id);
    setCoOwnerBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't cancel that invite.");
  }
  async function handleRespond(r, accept) {
    if (busyId) return;
    setBusyId(r.id);
    setError("");
    const result = await onRespond(r.id, accept);
    setBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't respond to that request.");
  }
  async function handleCancel(r) {
    if (busyId) return;
    setBusyId(r.id);
    setError("");
    const result = await onCancel(r.id);
    setBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't cancel that request.");
  }
  async function handleFinalize(r) {
    if (busyId) return;
    setBusyId(r.id);
    setError("");
    const result = await onCompleteJoin(r.id, r.clubId, r.federationId);
    setBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't complete that join.");
  }
  const cardStyle = {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
  };
  const sectionTitleStyle = {
    fontFamily: "'Inter'",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.inkSoft,
    margin: "18px 0 8px"
  };
  const descStyle = {
    fontFamily: "'Inter'",
    fontSize: 13,
    color: COLORS.ink,
    lineHeight: 1.5,
    marginBottom: 10
  };
  function requestLine(r) {
    if (r.direction === "club_to_federation") {
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, clubName(r.clubId)), " wants to join ", /*#__PURE__*/React.createElement("strong", null, fedName(r.federationId)));
    }
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, fedName(r.federationId)), " invited ", /*#__PURE__*/React.createElement("strong", null, clubName(r.clubId)), " to affiliate");
  }
  // Newest first, capped -- an unbounded, ever-growing activity feed isn't the goal here, just
  // "what happened lately that I should know about." 30 is generous for how often club/federation
  // membership actually changes, and anything older can just be cleared (see onDeleteActivity).
  const sortedActivity = [...activity].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30);
  const unreadActivityIds = activity.filter(item => !item.read).map(item => item.id);
  const allActivityIds = activity.map(item => item.id);
  function activityEntityName(item) {
    if (item.entityName) return item.entityName;
    return item.scope === "club" ? clubName(item.entityId) : fedName(item.entityId);
  }
  function activityLine(item) {
    const name = activityEntityName(item);
    const actor = /*#__PURE__*/React.createElement("strong", null, item.actorName || "Someone");
    const entity = /*#__PURE__*/React.createElement("strong", null, name);
    if (item.kind === "joined") return /*#__PURE__*/React.createElement(React.Fragment, null, actor, " joined ", entity, item.role === "coOwner" ? " as a co-owner" : "");
    if (item.kind === "left") return /*#__PURE__*/React.createElement(React.Fragment, null, actor, " left ", entity);
    if (item.kind === "removed") return /*#__PURE__*/React.createElement(React.Fragment, null, "You were removed from ", entity, " by ", actor);
    if (item.kind === "role_changed") return item.role === "member" ? /*#__PURE__*/React.createElement(React.Fragment, null, actor, " removed your co-owner rights on ", entity, " — you're still a member") : /*#__PURE__*/React.createElement(React.Fragment, null, actor, " made you a co-owner of ", entity);
    if (item.kind === "invite_response") return item.accepted ? /*#__PURE__*/React.createElement(React.Fragment, null, actor, " accepted your invite to ", entity) : /*#__PURE__*/React.createElement(React.Fragment, null, actor, " declined your invite to ", entity);
    return /*#__PURE__*/React.createElement(React.Fragment, null, actor, " — ", entity);
  }
  const isEmpty = incoming.length === 0 && outgoing.length === 0 && needsFinalize.length === 0 && pollItems.length === 0 && incomingCoOwnerInvites.length === 0 && outgoingCoOwnerInvites.length === 0 && sortedActivity.length === 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
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
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Inbox"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      marginBottom: 18,
      lineHeight: 1.5
    }
  }, "Availability polls waiting on a response, and club-federation affiliation requests you've sent or received."), error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: "1.5px solid rgba(139,30,30,0.25)",
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, error), justRespondedCoOwnerInvite && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "color-mix(in srgb, " + COLORS.turfFixed + " 12%, transparent)",
      border: `1.5px solid color-mix(in srgb, ${COLORS.turfFixed} 35%, transparent)`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ink,
      lineHeight: 1.5
    }
  }, justRespondedCoOwnerInvite.accept ? /*#__PURE__*/React.createElement(React.Fragment, null, "You're now a ", justRespondedCoOwnerInvite.role === "member" ? "member" : "co-owner", " of ", /*#__PURE__*/React.createElement("strong", null, justRespondedCoOwnerInvite.name), ".") : /*#__PURE__*/React.createElement(React.Fragment, null, "You declined the invite to ", /*#__PURE__*/React.createElement("strong", null, justRespondedCoOwnerInvite.name), ".")), isEmpty && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 13.5,
      lineHeight: 1.6
    }
  }, "Nothing pending right now."), pollItems.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: sectionTitleStyle
  }, "Availability polls"), pollItems.map((item, idx) => /*#__PURE__*/React.createElement("button", {
    key: item.code,
    type: "button",
    onClick: () => setOpenPoll(item),
    className: "cs-btn",
    style: {
      ...cardStyle,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      width: "100%",
      textAlign: "left",
      border: "none",
      cursor: "pointer",
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: "rgba(74,124,46,0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Hand, {
    size: 14,
    style: {
      color: COLORS.turf
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, item.question || `${item.team.name}'s next match`), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft
    }
  }, item.team.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      color: "#fff",
      background: COLORS.turfFixed,
      padding: "4px 8px",
      borderRadius: 20
    }
  }, item.pendingCount, " left", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 13
  }))))), needsFinalize.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: sectionTitleStyle
  }, "Approved \u2014 finish joining"), needsFinalize.map((r, idx) => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      ...cardStyle,
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: descStyle
  }, requestLine(r), " \u2014 the federation approved this. Finish affiliating to start sharing teams."), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => handleFinalize(r),
    disabled: busyId === r.id,
    style: {
      width: "100%"
    }
  }, busyId === r.id ? "\u2026" : "Finish joining")))), incomingCoOwnerInvites.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: sectionTitleStyle
  }, "Co-owner invites"), incomingCoOwnerInvites.map((inv, idx) => /*#__PURE__*/React.createElement("div", {
    key: inv.id,
    style: {
      ...cardStyle,
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: descStyle
  }, /*#__PURE__*/React.createElement("strong", null, inv.createdByName || "Someone"), inv.role === "member" ? " invited you to be a member of " : " invited you to be a co-owner of ", /*#__PURE__*/React.createElement("strong", null, coOwnerInviteEntityName(inv))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => handleRespondCoOwner(inv, true),
    disabled: coOwnerBusyId === inv.id,
    style: {
      flex: 1
    }
  }, coOwnerBusyId === inv.id ? "\u2026" : "Accept"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleRespondCoOwner(inv, false),
    disabled: coOwnerBusyId === inv.id,
    className: "cs-btn",
    style: {
      flex: 1,
      padding: "0 14px",
      minHeight: 44,
      borderRadius: 10,
      border: `1.5px solid ${COLORS.willow}`,
      background: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer"
    }
  }, "Decline"))))), incoming.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: sectionTitleStyle
  }, "Needs your response"), incoming.map((r, idx) => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      ...cardStyle,
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: descStyle
  }, requestLine(r)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => handleRespond(r, true),
    disabled: busyId === r.id,
    style: {
      flex: 1
    }
  }, busyId === r.id ? "\u2026" : "Accept"), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleRespond(r, false),
    disabled: busyId === r.id,
    className: "cs-btn",
    style: {
      flex: 1,
      padding: "0 14px",
      minHeight: 44,
      borderRadius: 10,
      border: `1.5px solid ${COLORS.willow}`,
      background: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer"
    }
  }, "Decline"))))), outgoing.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: sectionTitleStyle
  }, "Sent \u2014 waiting on a response"), outgoing.map((r, idx) => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      ...cardStyle,
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: descStyle
  }, requestLine(r)), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCancel(r),
    disabled: busyId === r.id,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      padding: 0,
      textDecoration: "underline"
    }
  }, busyId === r.id ? "\u2026" : "Cancel request")))), outgoingCoOwnerInvites.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: sectionTitleStyle
  }, "Co-owner invites sent"), outgoingCoOwnerInvites.map((inv, idx) => /*#__PURE__*/React.createElement("div", {
    key: inv.id,
    style: {
      ...cardStyle,
      animation: `cs-slideUp 0.3s ease ${idx * 0.04}s backwards`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: descStyle
  }, outgoingCoOwnerInviteLine(inv)), inv.status === "pending" && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleCancelCoOwner(inv),
    disabled: coOwnerBusyId === inv.id,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      padding: 0,
      textDecoration: "underline"
    }
  }, coOwnerBusyId === inv.id ? "\u2026" : "Cancel invite")))), sortedActivity.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      ...sectionTitleStyle
    }
  }, /*#__PURE__*/React.createElement("span", null, "Activity"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, unreadActivityIds.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => onMarkActivityRead && onMarkActivityRead(unreadActivityIds),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      padding: 0,
      textTransform: "none",
      letterSpacing: 0
    }
  }, "Mark all read"), onDeleteActivity && allActivityIds.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => onDeleteActivity(allActivityIds),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      padding: 0,
      textTransform: "none",
      letterSpacing: 0
    }
  }, "Clear all"))), sortedActivity.map((item, idx) => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    style: {
      ...cardStyle,
      animation: `cs-slideUp 0.3s ease ${idx * 0.02}s backwards`,
      display: "flex",
      alignItems: "flex-start",
      gap: 8
    }
  }, !item.read && /*#__PURE__*/React.createElement("span", {
    "aria-label": "Unread",
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: COLORS.turfFixed,
      marginTop: 6,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...descStyle,
      marginBottom: 0,
      opacity: item.read ? 0.65 : 1,
      flex: 1
    }
  }, activityLine(item)), onDeleteActivity && /*#__PURE__*/React.createElement("button", {
    onClick: () => onDeleteActivity(item.id),
    "aria-label": "Clear this notification",
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: "0 2px",
      flexShrink: 0,
      fontSize: 16,
      lineHeight: 1
    }
  }, "×")))), openPoll && /*#__PURE__*/React.createElement(AvailabilityPollModal, {
    clubId: openPoll.clubId,
    clubName: openPoll.clubName,
    team: openPoll.team,
    initialCode: openPoll.code,
    onClose: () => {
      setOpenPoll(null);
      // A poll deleted (or responded to) inside the modal doesn't change clubs/clubTeamsById, so
      // the Inbox's own pollItems list -- fetched once and only re-run on that dependency -- never
      // finds out on its own. Closing the modal is the one moment we know something might have
      // changed, so force a refetch here rather than leaving a deleted poll showing until an
      // unrelated club/team edit happens to trigger one.
      if (onPollsChanged) onPollsChanged();
    }
  }));
}
