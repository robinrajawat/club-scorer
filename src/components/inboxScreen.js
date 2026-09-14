import React from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft } from "./icons.js";
import { EmptyState } from "./illustrations.js";

// The "inbox" screen -- now just a plain activity feed. Availability polls and club/federation
// affiliation requests/co-owner invites (this screen's whole reason for existing, originally) were
// removed alongside clubs/federations (see docs/simplification-plan.md); `activity`/
// `notifyActivity` are kept as dormant infrastructure for a possible future team-sharing feature,
// so this screen and its route stay too, reduced to what that dormant data can actually drive.
// Covered by tests/unit/components/inboxScreen.test.js.

export function InboxScreen({
  activity = [],
  onMarkActivityRead,
  onDeleteActivity,
  onBack
}) {
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
  // Newest first, capped -- an unbounded, ever-growing activity feed isn't the goal here, just
  // "what happened lately that I should know about." 30 is generous, and anything older can just
  // be cleared (see onDeleteActivity).
  const sortedActivity = [...activity].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30);
  const unreadActivityIds = activity.filter(item => !item.read).map(item => item.id);
  const allActivityIds = activity.map(item => item.id);
  function activityLine(item) {
    const name = item.entityName || "something";
    const actor = /*#__PURE__*/React.createElement("strong", null, item.actorName || "Someone");
    const entity = /*#__PURE__*/React.createElement("strong", null, name);
    if (item.kind === "joined") return /*#__PURE__*/React.createElement(React.Fragment, null, actor, " joined ", entity, item.role === "coOwner" ? " as a co-owner" : "");
    if (item.kind === "left") return /*#__PURE__*/React.createElement(React.Fragment, null, actor, " left ", entity);
    if (item.kind === "removed") return /*#__PURE__*/React.createElement(React.Fragment, null, "You were removed from ", entity, " by ", actor);
    if (item.kind === "role_changed") return item.role === "member" ? /*#__PURE__*/React.createElement(React.Fragment, null, actor, " removed your co-owner rights on ", entity, " — you're still a member") : /*#__PURE__*/React.createElement(React.Fragment, null, actor, " made you a co-owner of ", entity);
    if (item.kind === "invite_response") return item.accepted ? /*#__PURE__*/React.createElement(React.Fragment, null, actor, " accepted your invite to ", entity) : /*#__PURE__*/React.createElement(React.Fragment, null, actor, " declined your invite to ", entity);
    return /*#__PURE__*/React.createElement(React.Fragment, null, actor, " — ", entity);
  }
  const isEmpty = sortedActivity.length === 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto",
      // Lets EmptyState (flex: 1 on itself) center in whatever space is actually left under the
      // header, rather than a fixed vh fraction of the whole screen -- see its own comment.
      display: "flex",
      flexDirection: "column",
      minHeight: "100dvh"
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
  }, "Recent activity on your account."), isEmpty && /*#__PURE__*/React.createElement(EmptyState, null, "Nothing here right now."), sortedActivity.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
  }, "×")))));
}
