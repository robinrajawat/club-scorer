import React from "react";
import { COLORS } from "./theme.js";

// Top-level crash boundary wrapping <CricketScorer /> at the bootstrap render call. Auto-reports
// a caught render error via reportErrorAuto (a bare global, not extracted -- a Firestore write),
// and lets the person add a free-text follow-up note via submitFeedback (also bare). Both read
// RECENT_CONSOLE_ERRORS, a small in-memory ring buffer of recent console.error calls populated
// elsewhere in docs/index.html (a shared bare global, not specific to this component, so it
// stays unextracted rather than moving here). Covered by tests/unit/components/errorBoundary.test.js.

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      reportStatus: "pending",
      // "pending" | "sent" | "failed"
      note: "",
      noteSent: false,
      noteSending: false
    };
    this.handleNoteChange = e => this.setState({
      note: e.target.value
    });
    this.handleSendNote = () => this.sendNote();
  }
  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }
  componentDidCatch(error, info) {
    console.error("Cricket Scorer crashed:", error, info && info.componentStack);
    reportErrorAuto((error && (error.stack || error.message)) || "Unknown render error", {
      source: "ErrorBoundary",
      componentStack: info && info.componentStack
    }).then(result => {
      this.setState({
        reportStatus: result.ok || result.skipped ? "sent" : "failed"
      });
    });
  }
  async sendNote() {
    if (!this.state.note.trim() || this.state.noteSending) return;
    this.setState({
      noteSending: true
    });
    const result = await submitFeedback({
      kind: "error",
      message: `Follow-up note on a crash: ${this.state.note.trim()}`,
      extra: {
        auto: false,
        consoleLog: RECENT_CONSOLE_ERRORS.slice(-10)
      }
    });
    this.setState({
      noteSending: false,
      noteSent: result.ok
    });
  }
  render() {
    if (this.state.hasError) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          background: COLORS.cream,
          fontFamily: "'Inter', sans-serif"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 40,
          marginBottom: 12
        }
      }, "\uD83C\uDFCF"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: "'DM Serif Display', serif",
          fontSize: 22,
          color: COLORS.pitch,
          marginBottom: 8
        }
      }, "Something went wrong"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13.5,
          color: COLORS.inkSoft,
          marginBottom: 14,
          maxWidth: 320,
          lineHeight: 1.6
        }
      }, "The app hit an unexpected error. Your saved matches and teams are safe \u2014 reloading should fix this."), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11.5,
          color: this.state.reportStatus === "failed" ? COLORS.ball : COLORS.inkSoft,
          marginBottom: 18,
          fontStyle: "italic"
        }
      }, this.state.reportStatus === "pending" ? "Reporting this automatically\u2026" : this.state.reportStatus === "sent" ? "This has been reported automatically." : "Couldn't report this automatically \u2014 your connection may be down."), /*#__PURE__*/React.createElement("button", {
        onClick: () => window.location.reload(),
        style: {
          background: COLORS.pitchFixed,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Inter'",
          marginBottom: 20
        }
      }, "Reload"), /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 320,
          width: "100%"
        }
      }, this.state.noteSent ? /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12.5,
          color: COLORS.pitch
        }
      }, "Thanks \u2014 that extra detail has been sent too.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("textarea", {
        value: this.state.note,
        onChange: this.handleNoteChange,
        placeholder: "What were you doing when this happened? (optional, helps a lot)",
        rows: 3,
        style: {
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          padding: 10,
          borderRadius: 10,
          border: "1.5px solid rgba(42,36,32,0.15)",
          resize: "vertical",
          marginBottom: 8
        }
      }), /*#__PURE__*/React.createElement("button", {
        onClick: this.handleSendNote,
        disabled: !this.state.note.trim() || this.state.noteSending,
        style: {
          background: "none",
          border: `1.5px solid ${COLORS.pitch}`,
          color: COLORS.pitch,
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: this.state.note.trim() ? "pointer" : "not-allowed",
          fontFamily: "'Inter'",
          opacity: this.state.note.trim() ? 1 : 0.5
        }
      }, this.state.noteSending ? "Sending\u2026" : "Send this detail too"))));
    }
    return this.props.children;
  }
}
