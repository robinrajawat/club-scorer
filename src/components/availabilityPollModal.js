import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Plus, WhatsAppIcon } from "./icons.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { SwipeableRow } from "./scoringUiAtoms.js";
import { POLL_TTL_DAYS, buildPollUrl, buildPollShareText, pollExpiryDateLabel } from "../core/shareAndFormat.js";

// The team availability-poll sheet: list existing polls, create a new one, or view one poll's
// yes/no/maybe responses. References Modal as a bare, unimported global (same pattern as
// ConfirmModal/playerModals.js) so tests can stub `globalThis.Modal` without pulling in jsdom.
// Covered by tests/unit/components/availabilityPollModal.test.js.
//
// Reads/writes to the poll collection all go through bare-global Firestore functions defined in
// docs/index.html, not extracted (need the Firebase SDK): `loadTeamPolls`/`loadPollByCode` (also
// called from a mount-time useEffect, not just a handler -- see how PlayerOfMatchCard and
// BetaTestersScreen stub their own Firestore calls for the same reason), `createAvailabilityPoll`,
// `deleteAvailabilityPoll`. `shareToWhatsApp`/`copyLink` call `window.open`/`navigator.clipboard`
// only from their own onClick handlers, never during render.

export function AvailabilityPollModal({
  clubId,
  clubName,
  team,
  onClose,
  // Both optional, and mutually exclusive in practice: initialCode is "open this app straight to
  // one specific poll's results" (see the Inbox screen, which otherwise had no way to link a tap
  // through to the actual poll it was summarizing).
  // fixtureContext is "open straight to creating a new poll FOR this fixture" (see the Upcoming
  // card's "Send poll" action), pre-filling the question/date from the fixture and tagging the
  // created poll with tournamentId/fixtureId so it can be traced back.
  initialCode,
  fixtureContext
}) {
  const [view, setView] = useState(initialCode ? "results" : fixtureContext ? "create" : "list");
  const [polls, setPolls] = useState(null); // null = loading
  const [activePoll, setActivePoll] = useState(null); // full poll doc, once fetched for "results"
  const [question, setQuestion] = useState(fixtureContext && fixtureContext.question ? fixtureContext.question : `Available for ${team.name}'s next match?`);
  const [fixtureDate, setFixtureDate] = useState(fixtureContext && fixtureContext.fixtureDate || "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState(null); // set right after a successful create
  const [createdAt, setCreatedAt] = useState(null); // pairs with createdCode, for the exact expiry date
  const [copied, setCopied] = useState(false);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    let cancelled = false;
    loadTeamPolls(clubId, team.id).then(async list => {
      if (cancelled) return;
      setPolls(list); // show questions immediately, counts fill in a moment later
      // Deep-link straight to one poll's results as soon as we know it still exists -- doesn't
      // wait on the response-count hydration below, which is only needed for the list view this
      // immediately navigates away from. Waiting on that made the sheet open showing the full
      // list (or its loading state) for a beat before jumping to results, a jarring swap right
      // after the sheet had just settled into place. Falls back to the list view on a stale code
      // (poll deleted since the summary that linked here last loaded) rather than leaving the
      // results view stuck on its own loading state forever.
      if (initialCode) {
        if (list.some(p => p.code === initialCode)) {
          openResults(initialCode);
        } else if (!cancelled) {
          setView("list");
        }
      }
      // loadTeamPolls reads the lightweight index doc (question/date only, no responses --
      // see its own comment), so counts here would always read as 0 without this follow-up.
      const withResponses = await Promise.all(list.map(async p => {
        const full = await loadPollByCode(p.code);
        return {
          ...p,
          responses: full ? full.responses : {}
        };
      }));
      if (!cancelled) setPolls(withResponses);
    });
    return () => {
      cancelled = true;
    };
  }, [clubId, team.id]);
  const roster = (team.players || []).map(p => typeof p === "string" ? p : p.name).filter(Boolean);
  async function handleCreate() {
    setCreating(true);
    setError("");
    const result = await createAvailabilityPoll(clubId, clubName, team.id, team.name, roster, question, fixtureDate || null, fixtureContext ? {
      tournamentId: fixtureContext.tournamentId,
      fixtureId: fixtureContext.fixtureId
    } : null);
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPolls(cur => [{
      code: result.code,
      question: result.poll.question,
      fixtureDate: result.poll.fixtureDate,
      tournamentId: result.poll.tournamentId,
      fixtureId: result.poll.fixtureId,
      createdAt: result.poll.createdAt
    }, ...(cur || [])]);
    setCreatedCode(result.code);
    setCreatedAt(result.poll.createdAt);
  }
  async function openResults(code) {
    setActivePoll(null);
    setView("results");
    const poll = await loadPollByCode(code);
    setActivePoll(poll);
  }
  function copyLink(code) {
    const url = buildPollUrl(code);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function shareToWhatsApp(code, q, fixtureDateVal) {
    const text = buildPollShareText(q, fixtureDateVal, code);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    const result = await deleteAvailabilityPoll(clubId, team.id, confirmDeleteCode);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      setConfirmDeleteCode(null); // close the confirm sheet so the error underneath is visible
      return;
    }
    setPolls(cur => (cur || []).filter(p => p.code !== confirmDeleteCode));
    setConfirmDeleteCode(null);
    setView("list");
  }
  function counts(poll) {
    const vals = Object.values((poll && poll.responses) || {});
    return {
      yes: vals.filter(r => r.status === "yes").length,
      no: vals.filter(r => r.status === "no").length,
      maybe: vals.filter(r => r.status === "maybe").length
    };
  }
  const STATUS_LABEL = {
    yes: "Yes",
    no: "No",
    maybe: "Maybe"
  };
  const STATUS_COLOR = {
    yes: COLORS.pitch,
    no: COLORS.ball,
    maybe: COLORS.gold
  };
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "cs-no-scrollbar",
    style: {
      maxHeight: "70vh",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Availability"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16
    }
  }, `${team.name} \u2014 poll who's around, then share the link. No account needed to respond. Polls expire automatically ${POLL_TTL_DAYS} days after being created.`), view === "list" && /*#__PURE__*/React.createElement("div", null, polls === null ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading polls\u2026",
    size: 22
  }) : polls.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      marginBottom: 4
    }
  }, "No polls sent yet.") : polls.map(p => {
    const c = counts(p);
    return /*#__PURE__*/React.createElement(SwipeableRow, {
      key: p.code,
      onDelete: () => setConfirmDeleteCode(p.code),
      deleteLabel: "Delete"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => openResults(p.code),
      className: "cs-btn",
      style: {
        display: "block",
        width: "100%",
        textAlign: "left",
        background: COLORS.surface,
        border: `1px solid ${COLORS.willow}`,
        borderRadius: 12,
        padding: "10px 12px",
        marginBottom: 0,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 13.5,
        color: COLORS.ink,
        marginBottom: 3
      }
    }, p.question), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft
      }
    }, p.fixtureDate ? `${p.fixtureDate} \u00b7 ` : "", `${c.yes} yes \u00b7 ${c.no} no \u00b7 ${c.maybe} maybe`)));
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => setView("create"),
    style: {
      width: "100%",
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16,
    strokeWidth: 2.5
  }), " New poll")), view === "create" && /*#__PURE__*/React.createElement("div", null, !createdCode ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Field, {
    label: "Question"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: question,
    onChange: setQuestion,
    placeholder: "Available for our next match?"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fixture date (optional)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fixtureDate,
    onChange: e => setFixtureDate(e.target.value),
    style: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      fontFamily: "'Inter'",
      fontSize: 14,
      background: COLORS.surface,
      color: COLORS.ink,
      boxSizing: "border-box"
    }
  })), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12.5,
      fontFamily: "'Inter'",
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleCreate,
    disabled: creating || !question.trim(),
    style: {
      flex: 1
    }
  }, creating ? "\u2026" : "Create & get link"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => fixtureContext ? onClose() : setView("list"),
    style: {
      flex: 1
    }
  }, "Cancel"))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, "Poll created \u2014 share this link:"), pollExpiryDateLabel(createdAt) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: -6,
      marginBottom: 10
    }
  }, `Expires ${pollExpiryDateLabel(createdAt)}`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, buildPollUrl(createdCode)), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => copyLink(createdCode),
    style: {
      flexShrink: 0
    }
  }, copied ? "Copied!" : "Copy")), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => shareToWhatsApp(createdCode, question, fixtureDate),
    style: {
      width: "100%",
      marginBottom: 14,
      background: COLORS.turfFixed,
      color: "#fff",
      border: "none"
    }
  }, /*#__PURE__*/React.createElement(WhatsAppIcon, {
    size: 16
  }), "Share on WhatsApp"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => openResults(createdCode),
    style: {
      flex: 1
    }
  }, "View responses"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (fixtureContext) {
        onClose();
        return;
      }
      setCreatedCode(null);
      setCreatedAt(null);
      setQuestion(`Available for ${team.name}'s next match?`);
      setFixtureDate("");
      setView("list");
    },
    style: {
      flex: 1
    }
  }, "Done")))), view === "results" && /*#__PURE__*/React.createElement("div", null, !activePoll ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading responses\u2026",
    size: 22
  }) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14.5,
      color: COLORS.ink,
      marginBottom: 2
    }
  }, activePoll.question), activePoll.fixtureDate && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 2
    }
  }, activePoll.fixtureDate), pollExpiryDateLabel(activePoll.createdAt) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, `Expires ${pollExpiryDateLabel(activePoll.createdAt)}`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, [...new Set([...(activePoll.roster || []), ...Object.keys(activePoll.responses || {})])].map(name => {
    const r = (activePoll.responses || {})[name];
    return /*#__PURE__*/React.createElement("div", {
      key: name,
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "8px 0",
        borderBottom: `1px dashed ${COLORS.creamDark}`,
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.ink
      }
    }, name, r && r.note && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft,
        fontStyle: "italic",
        marginTop: 2
      }
    }, r.note)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 12,
        color: r ? STATUS_COLOR[r.status] : COLORS.inkSoft,
        flexShrink: 0
      }
    }, r ? STATUS_LABEL[r.status] : "\u2014"));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 12px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      marginBottom: 8
    }
  }, buildPollUrl(activePoll.code)), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => shareToWhatsApp(activePoll.code, activePoll.question, activePoll.fixtureDate),
    style: {
      width: "100%",
      marginBottom: 8,
      background: COLORS.turfFixed,
      color: "#fff",
      border: "none"
    }
  }, /*#__PURE__*/React.createElement(WhatsAppIcon, {
    size: 16
  }), "Share on WhatsApp"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => copyLink(activePoll.code),
    style: {
      flex: 1
    }
  }, copied ? "Copied!" : "Copy link"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setConfirmDeleteCode(activePoll.code),
    style: {
      flex: 1,
      color: COLORS.ball
    }
  }, "Delete")), deleteError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginBottom: 8
    }
  }, deleteError), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView("list"),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Back to polls")))), confirmDeleteCode && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Delete this poll?",
    message: "The link will stop working and every response is deleted with it. This can't be undone.",
    confirmLabel: "Delete",
    busy: deleting,
    onConfirm: confirmDelete,
    onCancel: () => setConfirmDeleteCode(null)
  }));
}
