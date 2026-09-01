import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { TextField, Btn } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { LoadingBallIllustration } from "./illustrations.js";

// Public availability-poll response screen, opened via a poll link (see AvailabilityPollModal,
// which creates these). Pick your name (from the team's roster, or type it), an available/no/
// maybe answer, and an optional note. Covered by tests/unit/components/pollRespondScreen.test.js.
//
// `loadPollByCode` runs from a mount-time useEffect and `submitPollResponse` from the submit
// handler -- both bare-global Firestore calls, not extracted, same stubbing pattern as
// AvailabilityPollModal's own tests.

export function PollRespondScreen({
  code,
  onExit
}) {
  const [poll, setPoll] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | found | not-found
  const [selectedName, setSelectedName] = useState("");
  const [customName, setCustomName] = useState("");
  const [rsvp, setRsvp] = useState(null); // "yes" | "no" | "maybe"
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setStatus("not-found");
      return;
    }
    loadPollByCode(code).then(p => {
      if (cancelled) return;
      if (!p) {
        setStatus("not-found");
      } else {
        setPoll(p);
        setStatus("found");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code]);
  const wrapStyle = {
    minHeight: "100vh",
    background: COLORS.cream,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,36,32,0.045) 28px)"
  };
  if (status === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(LoadingBallIllustration, null));
  }
  if (status === "not-found") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        maxWidth: 320
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'DM Serif Display', serif",
        fontSize: 20,
        color: COLORS.ink,
        marginBottom: 8
      }
    }, "Poll not found"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft,
        lineHeight: 1.5,
        marginBottom: 20
      }
    }, "This link may be wrong, or the poll was deleted."), /*#__PURE__*/React.createElement("button", {
      className: "cs-btn cs-shine",
      onClick: onExit,
      style: {
        background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})`,
        border: "none",
        borderRadius: 10,
        color: "#fff",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 13.5,
        padding: "10px 20px",
        cursor: "pointer"
      }
    }, "Go to Club Scorer")));
  }
  const finalName = selectedName === "__other__" ? customName.trim() : selectedName;
  async function submit() {
    if (!finalName || !rsvp) return;
    setSubmitting(true);
    setSubmitError("");
    const result = await submitPollResponse(code, finalName, rsvp, note);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setPoll(cur => ({
      ...cur,
      responses: {
        ...cur.responses,
        [finalName]: {
          status: rsvp,
          note: note.trim() || null,
          respondedAt: Date.now()
        }
      }
    }));
    setJustSubmitted(true);
  }
  const RSVP_OPTIONS = [{
    value: "yes",
    label: "Yes"
  }, {
    value: "no",
    label: "No"
  }, {
    value: "maybe",
    label: "Maybe"
  }];
  const allNames = [...new Set([...(poll.roster || []), ...Object.keys(poll.responses || {})])];
  return /*#__PURE__*/React.createElement("div", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 12,
      padding: 4
    }
  }, "Exit"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 4
    }
  }, poll.teamName, " \u00b7 ", poll.clubName), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 21,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, poll.question), poll.fixtureDate && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 18
    }
  }, poll.fixtureDate), !justSubmitted ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Your name"
  }, /*#__PURE__*/React.createElement("select", {
    value: selectedName,
    onChange: e => setSelectedName(e.target.value),
    style: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.willow}`,
      fontFamily: "'Inter'",
      fontSize: 14,
      background: COLORS.surface,
      color: COLORS.ink
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Choose\u2026"), (poll.roster || []).map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)), /*#__PURE__*/React.createElement("option", {
    value: "__other__"
  }, "Someone else\u2026"))), selectedName === "__other__" && /*#__PURE__*/React.createElement(Field, {
    label: "Your name"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: customName,
    onChange: setCustomName,
    placeholder: "Type your name",
    autoCapitalize: "words",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Available?"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, RSVP_OPTIONS.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    onClick: () => setRsvp(o.value),
    className: "cs-btn cs-shine",
    style: {
      flex: 1,
      padding: "9px 0",
      borderRadius: 10,
      border: "none",
      background: rsvp === o.value ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.cream,
      color: rsvp === o.value ? "#fff" : COLORS.ink,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }
  }, o.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Note (optional)"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: note,
    onChange: setNote,
    placeholder: "e.g. can only make 2nd half"
  })), submitError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 12.5,
      fontFamily: "'Inter'",
      marginBottom: 10
    }
  }, submitError), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: submit,
    disabled: !finalName || !rsvp || submitting,
    style: {
      width: "100%"
    }
  }, submitting ? "\u2026" : "Submit")) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14,
      color: COLORS.ink,
      marginBottom: 4
    }
  }, "Thanks \u2014 saved!"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setJustSubmitted(false),
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
  }, "Change your answer")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "Who's said what"), allNames.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No responses yet.") : allNames.map(name => {
    const r = (poll.responses || {})[name];
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
        color: r ? r.status === "yes" ? COLORS.pitch : r.status === "no" ? COLORS.ball : COLORS.gold : COLORS.inkSoft,
        flexShrink: 0
      }
    }, r ? r.status === "yes" ? "Yes" : r.status === "no" ? "No" : "Maybe" : "\u2014"));
  })));
}
