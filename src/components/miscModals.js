import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Table2, Share, Users, Trophy } from "./icons.js";
import { Btn } from "./formUiAtoms.js";
import { markTourSeen } from "../core/appLogic.js";

// A grab-bag of one-off Modal-wrapped screens that don't share enough with any other file to
// justify their own: FirstLaunchTour (the swipeable first-run welcome tour, using TOUR_SLIDES
// below) and TournamentShareModal (create/copy/stop a read-only public tournament link). Covered
// by tests/unit/components/miscModals.test.js.
//
// Both reference Modal as a bare, unimported global -- same pattern as ConfirmModal in
// formUiAtoms.js -- so their own tests can stub `globalThis.Modal` with a plain pass-through
// component rather than pulling in jsdom; see playerModals.test.js for the same pattern.
// TournamentShareModal reads window.location.origin/pathname directly during render (not just
// from a handler), so its test also needs a lightweight globalThis.window stub with just enough
// shape for that -- no full jsdom needed since nothing else here touches a real DOM API.

export const TOUR_SLIDES = [{
  icon: Table2,
  title: "Score ball-by-ball, works offline",
  body: "Runs, wides, no-balls, every dismissal type \u2014 sign-in is optional, and it keeps working with no signal once it's loaded."
}, {
  icon: Share,
  title: "Share your score two ways",
  body: "A score code gives full scoring access \u2014 for a teammate co-scoring alongside you. A view code is read-only, for anyone just following along. They're never interchangeable."
}, {
  icon: Users,
  title: "Clubs, federations, and borrowed players",
  body: "Save a team's roster once and reuse it. A club can affiliate with a federation to play other clubs' teams, and you can borrow a player from another club's public directory without retyping their details."
}, {
  icon: Trophy,
  title: "Tournaments or a simple series",
  body: "Build a full tournament \u2014 round-robin, self-seeding knockout, points table \u2014 or a head-to-head series between two teams with just a running score."
}];

export function FirstLaunchTour({
  onDone
}) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === TOUR_SLIDES.length - 1;
  function finish() {
    markTourSeen();
    onDone();
  }
  const current = TOUR_SLIDES[slide];
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: finish
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 6,
      marginBottom: 18
    }
  }, TOUR_SLIDES.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: i === slide ? 18 : 6,
      height: 6,
      borderRadius: 3,
      background: i === slide ? COLORS.pitch : COLORS.creamDark,
      transition: "width 0.2s ease"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(current.icon, {
    size: 40,
    style: {
      color: COLORS.pitch
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 21,
      color: COLORS.pitch,
      textAlign: "center",
      marginBottom: 8
    }
  }, current.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      lineHeight: 1.6,
      marginBottom: 22,
      padding: "0 6px"
    }
  }, current.body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, !isLast && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: finish,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      flex: 1
    }
  }, "Skip"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: isLast ? finish : () => setSlide(s => s + 1),
    style: {
      flex: isLast ? 1 : 2
    }
  }, isLast ? "Get started" : "Next")));
}

export function TournamentShareModal({
  tournament,
  standings,
  onClose,
  onUpdateTournament
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const code = tournament.shareCode || null;
  const link = code ? `${window.location.origin}${window.location.pathname}?tournament=${code}` : "";
  async function handleShare() {
    setBusy(true);
    setError("");
    const result = await shareTournament(tournament, standings);
    setBusy(false);
    if (result.ok) {
      if (!tournament.shareCode) onUpdateTournament({
        ...tournament,
        shareCode: result.code
      });
    } else {
      setError(result.error || "Couldn't create a share link.");
    }
  }
  async function handleStop() {
    if (!code) return;
    setBusy(true);
    setError("");
    const result = await stopSharingTournament(code);
    setBusy(false);
    if (result.ok) {
      onUpdateTournament({
        ...tournament,
        shareCode: null
      });
    } else {
      setError(result.error || "Couldn't stop sharing.");
    }
  }
  function handleCopy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Share this tournament"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Anyone with the link can view standings and fixtures \u2014 no account needed. It's a snapshot, not live: hit Refresh after new results come in. A link nobody's refreshed in a long while may also expire on its own on some servers."), code ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: COLORS.cream,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, link), /*#__PURE__*/React.createElement("button", {
    onClick: handleCopy,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12,
      cursor: "pointer",
      flexShrink: 0
    }
  }, copied ? "Copied!" : "Copy")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontSize: 12,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: handleShare,
    disabled: busy,
    style: {
      flex: 1
    }
  }, busy ? "\u2026" : "Refresh snapshot"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: handleStop,
    disabled: busy,
    style: {
      flex: 1
    }
  }, "Stop sharing"))) : /*#__PURE__*/React.createElement(React.Fragment, null, error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontSize: 12,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleShare,
    disabled: busy,
    style: {
      width: "100%"
    }
  }, busy ? "Creating\u2026" : "Create share link")));
}
