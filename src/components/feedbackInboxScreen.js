import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft } from "./icons.js";
import { ConfirmModal } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { buildClaudeFixPrompt } from "../core/miscHelpers.js";

// Admin-only feedback/crash-report inbox: filter by kind/status, expand a row for its full
// message/URL/user-agent, cycle priority/status, jot a private resolution note, copy a
// ready-to-paste Claude fix prompt, or delete. `loadFeedback` runs from a mount-time useEffect;
// `updateFeedbackStatus`/`updateFeedbackPriority`/`deleteFeedback` are bare-global Firestore calls
// (not extracted) from their respective button handlers -- stubbed the same way every other
// mount-effect screen's tests stub theirs. `navigator.clipboard` needs the same
// Object.defineProperty workaround Node's read-only `navigator` global requires elsewhere in this
// suite. Covered by tests/unit/components/feedbackInboxScreen.test.js.

export function FeedbackInboxScreen({
  onBack
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState("all"); // all | feedback | error
  const [statusFilter, setStatusFilter] = useState("open"); // all | open | planned | fixed | wontfix
  const [expandedId, setExpandedId] = useState(null);
  const [noteDraftById, setNoteDraftById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [priorityBusyId, setPriorityBusyId] = useState(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null); // { id } | null
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  async function refresh() {
    setLoading(true);
    const rows = await loadFeedback();
    setLoading(false);
    setItems(rows);
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function handleSetStatus(item, status) {
    setBusyId(item.id);
    const result = await updateFeedbackStatus(item.id, status, noteDraftById[item.id] !== undefined ? noteDraftById[item.id] : item.resolutionNote || "");
    setBusyId(null);
    if (result.ok) {
      setItems(list => list.map(x => x.id === item.id ? {
        ...x,
        status,
        resolutionNote: noteDraftById[item.id] !== undefined ? noteDraftById[item.id] : x.resolutionNote || ""
      } : x));
    }
  }
  // Note-saving no longer piggybacks on a status click now that status is a plain select rather
  // than a row of buttons you'd naturally tap through -- this is the explicit "persist my draft"
  // action instead (re-sends the current status unchanged alongside it, since updateFeedbackStatus
  // still writes both fields together).
  async function handleSaveNote(item) {
    const draft = noteDraftById[item.id];
    if (draft === undefined) return;
    await handleSetStatus(item, item.status || "open");
  }
  async function handleSetPriority(item, priority) {
    setPriorityBusyId(item.id);
    const result = await updateFeedbackPriority(item.id, priority);
    setPriorityBusyId(null);
    if (result.ok) {
      setItems(list => list.map(x => x.id === item.id ? {
        ...x,
        priority
      } : x));
    }
  }
  async function handleDeleteConfirm() {
    const {
      id
    } = confirmDeleteItem;
    setConfirmDeleteItem(null);
    setDeleteBusyId(id);
    const result = await deleteFeedback(id);
    setDeleteBusyId(null);
    if (result.ok) {
      setItems(list => list.filter(x => x.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  }
  function handleCopyPrompt(item) {
    // Copy should reflect what's actually on screen, including a note typed but not yet saved via
    // a status click -- same "draft wins if present" resolution handleSetStatus already uses, so
    // the two stay consistent with each other.
    const effectiveNote = noteDraftById[item.id] !== undefined ? noteDraftById[item.id] : item.resolutionNote;
    const prompt = buildClaudeFixPrompt({
      ...item,
      resolutionNote: effectiveNote
    });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(prompt).catch(() => {});
    }
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(id => id === item.id ? null : id), 1500);
  }
  const visible = items.filter(it => (kindFilter === "all" || it.kind === kindFilter) && (statusFilter === "all" || (it.status || "open") === statusFilter));
  const statusColor = {
    open: COLORS.ball,
    planned: COLORS.gold,
    fixed: COLORS.pitch,
    wontfix: COLORS.inkSoft
  };
  const priorityColor = {
    low: COLORS.inkSoft,
    medium: COLORS.gold,
    high: COLORS.ball
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 640,
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
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Feedback Inbox"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "Everything submitted via Send Feedback, plus auto-captured crashes. Newest first, up to 300 rows."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: kindFilter,
    onChange: e => setKindFilter(e.target.value),
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      padding: "7px 8px",
      borderRadius: 8,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.pitch,
      cursor: "pointer"
    }
  }, ["all", "feedback", "error"].map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, k === "all" ? "All kinds" : k))), /*#__PURE__*/React.createElement("select", {
    value: statusFilter,
    onChange: e => setStatusFilter(e.target.value),
    style: {
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      padding: "7px 8px",
      borderRadius: 8,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.pitch,
      cursor: "pointer"
    }
  }, ["open", "planned", "fixed", "wontfix", "all"].map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, s === "all" ? "All statuses" : s))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginLeft: "auto"
    }
  }, visible.length, " of ", items.length)), loading ? /*#__PURE__*/React.createElement(LoadingNote, {
    size: 14
  }) : visible.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontStyle: "italic"
    }
  }, "Nothing here.") : visible.map(it => {
    const isOpen = expandedId === it.id;
    const status = it.status || "open";
    const priority = it.priority || "medium";
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      style: {
        background: COLORS.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        boxShadow: "0 1px 3px rgba(42,36,32,0.06)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setExpandedId(isOpen ? null : it.id),
      style: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: it.kind === "error" ? COLORS.ball : COLORS.gold,
        marginBottom: 4
      }
    }, it.kind, it.email ? ` \u2014 ${it.email}` : "", " \u2014 ", new Date(it.createdAt).toLocaleString()), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: isOpen ? "pre-wrap" : "nowrap"
      }
    }, it.message)), /*#__PURE__*/React.createElement("div", {
      style: {
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: statusColor[status] || COLORS.inkSoft
      }
    }, status), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: priorityColor[priority] || COLORS.inkSoft
      }
    }, priority))), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px dashed ${COLORS.willow}`
      }
    }, it.url && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11,
        color: COLORS.inkSoft,
        marginBottom: 4,
        wordBreak: "break-all"
      }
    }, "URL: ", it.url), it.userAgent && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11,
        color: COLORS.inkSoft,
        marginBottom: 10,
        wordBreak: "break-all"
      }
    }, "Agent: ", it.userAgent), /*#__PURE__*/React.createElement("textarea", {
      value: noteDraftById[it.id] !== undefined ? noteDraftById[it.id] : it.resolutionNote || "",
      onChange: e => setNoteDraftById(m => ({
        ...m,
        [it.id]: e.target.value
      })),
      placeholder: "Private resolution note (only you see this)",
      rows: 2,
      style: {
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        padding: 8,
        borderRadius: 8,
        border: `1.5px solid ${COLORS.creamDark}`,
        background: COLORS.cream,
        resize: "vertical",
        marginBottom: 6
      }
    }), noteDraftById[it.id] !== undefined && noteDraftById[it.id] !== (it.resolutionNote || "") && /*#__PURE__*/React.createElement("button", {
      onClick: () => handleSaveNote(it),
      disabled: busyId === it.id,
      className: "cs-btn",
      style: {
        background: "none",
        border: "none",
        color: COLORS.gold,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer",
        padding: "0 0 8px",
        display: "block"
      }
    }, busyId === it.id ? "Saving\u2026" : "Save note"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        opacity: busyId === it.id || priorityBusyId === it.id ? 0.55 : 1,
        transition: "opacity 0.15s"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => handleSetPriority(it, ["low", "medium", "high"][(["low", "medium", "high"].indexOf(priority) + 1) % 3]),
      disabled: priorityBusyId === it.id,
      className: "cs-btn",
      title: "Tap to cycle priority",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11,
        padding: "3px 7px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: "none",
        color: priorityColor[priority] || COLORS.inkSoft,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: 7,
      height: 7,
      viewBox: "0 0 8 8"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: 4,
      cy: 4,
      r: 3.5,
      fill: "currentColor"
    })), priority), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleSetStatus(it, ["open", "planned", "fixed", "wontfix"][(["open", "planned", "fixed", "wontfix"].indexOf(status) + 1) % 4]),
      disabled: busyId === it.id,
      className: "cs-btn",
      title: "Tap to cycle status",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11,
        padding: "3px 7px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: "none",
        color: statusColor[status] || COLORS.inkSoft,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: 7,
      height: 7,
      viewBox: "0 0 8 8"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: 4,
      cy: 4,
      r: 3.5,
      fill: "currentColor"
    })), status), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleCopyPrompt(it),
      className: "cs-btn",
      style: {
        padding: "5px 10px",
        borderRadius: 8,
        border: `1px solid ${COLORS.gold}`,
        background: copiedId === it.id ? COLORS.gold : "none",
        color: copiedId === it.id ? COLORS.pitch : COLORS.gold,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer"
      }
    }, copiedId === it.id ? "Copied!" : "Copy prompt"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmDeleteItem({
        id: it.id
      }),
      disabled: deleteBusyId === it.id,
      className: "cs-btn",
      style: {
        marginLeft: "auto",
        padding: "5px 10px",
        borderRadius: 8,
        border: `1px solid ${COLORS.ball}`,
        background: "none",
        color: COLORS.ball,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer"
      }
    }, deleteBusyId === it.id ? "\u2026" : "Delete"))));
  })), confirmDeleteItem && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Delete this report?",
    message: "This can't be undone.",
    confirmLabel: "Delete",
    onConfirm: handleDeleteConfirm,
    onCancel: () => setConfirmDeleteItem(null)
  }));
}
