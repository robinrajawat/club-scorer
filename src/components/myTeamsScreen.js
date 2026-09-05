import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { CalendarClock, ChevronDown, Pencil, Plus, Users } from "./icons.js";
import { ClubSourceSelector } from "./screenAtoms.js";
import { LoadingNote, EmptyStateBallIllustration } from "./illustrations.js";
import { SwipeableRow } from "./scoringUiAtoms.js";
import { MoveTeamMenu } from "./shareMenus.js";
import { AvailabilityPollModal } from "./availabilityPollModal.js";
import { hasSeenSwipeHint } from "../core/appLogic.js";
import { isClubOwner } from "../core/miscHelpers.js";
import { TAB_BAR_HEIGHT } from "./tabBar.js";

// "My Teams" screen: every team this person can score for, merged across their personal teams and
// every club they belong to (with a source chip picker once there's more than one source), plus
// per-team new/edit/delete/move/send-poll actions. Covered by
// tests/unit/components/myTeamsScreen.test.js.
//
// Every write action is a prop (onDeleteTeam/onEditTeam/onMoveTeam/etc.), not a bare global, so
// this needs no Firestore stubbing at all -- AvailabilityPollModal (used for the "send poll"
// action) still needs Modal as a bare global internally, same as everywhere else it's used, but
// that's handled inside its own module and test file, not here.

export function MyTeamsScreen({
  teams = [],
  teamsLoading = false,
  matches,
  clubs = [],
  activeClubId = null,
  onSelectClub,
  currentUid,
  onNewTeam,
  onEditTeam,
  onDeleteTeam,
  onMoveTeam,
  pinnedClubIds = [],
  onTogglePinClub,
  showTabBar = false
}) {
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  // Same shared, learn-once flag as Home's Saved Matches list -- see hasSeenSwipeHint's own
  // comment for why this is one flag across both screens rather than two separate ones.
  const [showSwipeHint, setShowSwipeHint] = useState(() => !hasSeenSwipeHint());
  // Team to show the availability-poll modal for, or null when it's closed -- club teams only
  // (see canManageTeam below and the modal's own team-scoping), matching how sending a poll has
  // always been club-only: there's nobody else to poll for a personal team.
  const [pollingTeam, setPollingTeam] = useState(null);
  // Source label shown on each row when the list is the merged, all-sources view (no chip
  // picked) -- lets "My Teams" sit alongside every club's roster without them being confused for
  // one another, the same tagging Cups already does on its merged list.
  function sourceLabel(t) {
    if (!t._clubId) return "Personal";
    const club = clubs.find(c => c.id === t._clubId);
    return club ? club.name : "Club";
  }
  // A personal team is always editable by whoever's looking at it; a club team only by that
  // club's owner/co-owner -- matches firestore.rules (allow write: if isClubOwner(...)), which
  // silently rejects anyone else's write. Without this check the merged list would offer New/
  // Edit/Delete/Move to any plain club member and let them hit that rejection after filling out
  // a whole team, instead of never showing the controls in the first place.
  function canManageTeam(t) {
    if (!t._clubId) return true;
    return isClubOwner(clubs.find(c => c.id === t._clubId), currentUid);
  }
  const activeClub = activeClubId ? clubs.find(c => c.id === activeClubId) || null : null;
  const canManageActive = !activeClub || isClubOwner(activeClub, currentUid);
  function teamMatchCount(teamId) {
    return matches.filter(m => m.teamAId === teamId || m.teamBId === teamId).length;
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 20,
      paddingLeft: 16,
      paddingRight: 16,
      // See the matching comment in homeScreen.js's own root style -- reserves clearance under
      // the fixed TabBar when it's showing.
      paddingBottom: showTabBar ? `calc(${TAB_BAR_HEIGHT}px + 60px + env(safe-area-inset-bottom))` : 60,
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Users, {
    size: 22,
    style: {
      color: COLORS.pitch
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch
    }
  }, "Teams"), teamsLoading && /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Refreshing\u2026",
    size: 14,
    style: {
      fontSize: 11.5
    }
  })), clubs.length > 0 && /*#__PURE__*/React.createElement(ClubSourceSelector, {
    clubs: clubs,
    activeClubId: activeClubId,
    onSelect: onSelectClub,
    pinnedClubIds: pinnedClubIds,
    onTogglePinClub: onTogglePinClub
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 18,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, activeClubId ? (clubs.find(c => c.id === activeClubId) || {}).name || "Club Teams" : "All Teams"), teams.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft
    }
  }, `\u00b7 ${teams.length}`)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, canManageActive && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onNewTeam,
    "aria-label": "New team",
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 3,
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      padding: "4px 2px"
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14,
    strokeWidth: 2.5
  }), "New"), teams.length > 0 && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTeamsExpanded(e => !e),
    className: "cs-btn",
    "aria-label": teamsExpanded ? "Hide your teams" : "Show your teams",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: 6,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(ChevronDown, {
    size: 15,
    style: {
      transform: teamsExpanded ? "rotate(180deg)" : "none",
      transition: "transform 0.15s"
    }
  })))), (teamsExpanded || teams.length === 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: teams.length > 0 ? 10 : 14
    }
  }, teamsLoading && teams.length === 0 ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading your teams\u2026",
    size: 20,
    style: {
      padding: "10px 4px"
    }
  }) : teams.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px",
      borderRadius: 16,
      border: `1.5px dashed ${COLORS.willow}`,
      background: `color-mix(in srgb, ${COLORS.surface} 40%, transparent)`
    }
  }, /*#__PURE__*/React.createElement(EmptyStateBallIllustration, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginTop: 14
    }
  }, activeClubId ? "No teams saved for this club yet." : "No teams saved yet.", /*#__PURE__*/React.createElement("br", null), canManageActive ? "Add one to reuse its line-up in future matches." : "Only the club's owner can add one.")) : /*#__PURE__*/React.createElement(React.Fragment, null, showSwipeHint && teams.some(canManageTeam) && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.inkSoft,
      opacity: 0.7,
      marginBottom: 4
    }
  }, "\u2190 swipe to delete"), teams.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      animation: `cs-slideUp 0.3s ease ${i * 0.04}s backwards`,
      marginBottom: i === teams.length - 1 ? 0 : 6
    }
  }, /*#__PURE__*/React.createElement(SwipeableRow, {
    onDelete: canManageTeam(t) ? () => onDeleteTeam(t.id, t._clubId || null) : undefined,
    deleteLabel: "Delete",
    onSwipeStart: () => setShowSwipeHint(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "cs-row",
    style: {
      background: COLORS.creamDark,
      padding: "12px 12px",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: canManageTeam(t) ? () => onEditTeam(t) : undefined,
    onKeyDown: canManageTeam(t) ? e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEditTeam(t);
      }
    } : undefined,
    role: canManageTeam(t) ? "button" : undefined,
    tabIndex: canManageTeam(t) ? 0 : undefined,
    style: {
      cursor: canManageTeam(t) ? "pointer" : "default",
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7
    }
  }, t._clubId && (clubs.find(c => c.id === t._clubId) || {}).logoURL && /*#__PURE__*/React.createElement("img", {
    src: (clubs.find(c => c.id === t._clubId) || {}).logoURL,
    alt: "",
    style: {
      width: 16,
      height: 16,
      borderRadius: "50%",
      objectFit: "cover",
      flexShrink: 0
    }
  }), t.color && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 11,
      height: 11,
      borderRadius: "50%",
      background: t.color,
      border: `1px solid ${COLORS.creamDark}`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13.5,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, t.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 1
    }
  }, t.players.length, " player", t.players.length === 1 ? "" : "s", " \u00b7 ", teamMatchCount(t.id), " match", teamMatchCount(t.id) === 1 ? "" : "es", " played", !activeClubId && /*#__PURE__*/React.createElement(React.Fragment, null, " \u00b7 ", sourceLabel(t)))), canManageTeam(t) && /*#__PURE__*/React.createElement(MoveTeamMenu, {
    team: t,
    clubs: clubs,
    currentClubId: t._clubId || null,
    onMove: onMoveTeam
  }), canManageTeam(t) && t._clubId && /*#__PURE__*/React.createElement("button", {
    onClick: () => setPollingTeam(t),
    className: "cs-btn",
    "aria-label": `Poll availability for ${t.name}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: 8,
      borderRadius: 8,
      display: "flex",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(CalendarClock, {
    size: 15
  })), canManageTeam(t) && /*#__PURE__*/React.createElement("button", {
    onClick: () => onEditTeam(t),
    className: "cs-btn",
    "aria-label": `Edit ${t.name}`,
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: 8,
      borderRadius: 8,
      display: "flex",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 15
  })))))))))
), pollingTeam && /*#__PURE__*/React.createElement(AvailabilityPollModal, {
    clubId: pollingTeam._clubId,
    clubName: sourceLabel(pollingTeam),
    team: pollingTeam,
    onClose: () => setPollingTeam(null)
  }))
}
