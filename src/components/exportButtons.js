import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Printer } from "./icons.js";
import { Btn } from "./formUiAtoms.js";

// Print-to-PDF buttons for a match scorecard / tournament report. Both call window.print(),
// document.title, and requestAnimationFrame, but only inside their onClick handler, never during
// render -- so they're safely renderable in tests with no DOM stub; only handleExport's own
// browser-print behavior goes untested, not the button's rendering or state. Covered by
// tests/unit/components/exportButtons.test.js using react-test-renderer.

export function ExportPdfButton({
  match,
  style
}) {
  const [preparing, setPreparing] = useState(false);
  // iOS Safari can hang for a long time — and sometimes render a blank print preview — if
  // window.print() fires while the web fonts (DM Serif Display / IBM Plex Mono / Inter) are
  // still mid-fetch, since it tries to lay the print document out with fonts that swap mid-paint.
  // Waiting for document.fonts.ready, then giving the browser two animation frames to actually
  // paint before printing, is the standard workaround for that class of WebKit print bug. The
  // 1.2s race is a safety net in case fonts.ready itself never resolves on some browsers.
  function handleExport() {
    if (preparing) return;
    setPreparing(true);
    const prevTitle = document.title;
    document.title = `${match.teamA} vs ${match.teamB} — Scorecard`;
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    Promise.race([fontsReady, new Promise(resolve => setTimeout(resolve, 1200))]).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.print();
        setPreparing(false);
        setTimeout(() => {
          document.title = prevTitle;
        }, 500);
      }));
    });
  }
  return /*#__PURE__*/React.createElement("button", {
    onClick: handleExport,
    disabled: preparing,
    className: "cs-btn",
    title: "Export PDF",
    "aria-label": "Export PDF",
    style: {
      background: "rgba(242,236,217,0.14)",
      border: "1px solid rgba(242,236,217,0.35)",
      borderRadius: 8,
      color: COLORS.creamFixed,
      cursor: preparing ? "default" : "pointer",
      opacity: preparing ? 0.6 : 1,
      width: 38,
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style
    }
  }, /*#__PURE__*/React.createElement(Printer, {
    size: 17
  }));
}

export function ExportTournamentPdfButton({
  tournament,
  style
}) {
  const [preparing, setPreparing] = useState(false);
  function handleExport() {
    if (preparing) return;
    setPreparing(true);
    const prevTitle = document.title;
    document.title = `${tournament.name} \u2014 Standings & Fixtures`;
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    Promise.race([fontsReady, new Promise(resolve => setTimeout(resolve, 1200))]).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.print();
        setPreparing(false);
        setTimeout(() => {
          document.title = prevTitle;
        }, 500);
      }));
    });
  }
  return /*#__PURE__*/React.createElement(Btn, {
    onClick: handleExport,
    disabled: preparing,
    style: {
      flex: 1,
      fontSize: 12.5,
      ...style
    }
  }, /*#__PURE__*/React.createElement(Printer, {
    size: 14
  }), " ", preparing ? "Preparing\u2026" : "Export PDF");
}
