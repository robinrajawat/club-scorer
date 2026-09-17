import React, { useState, useRef } from "react";
import { COLORS } from "./theme.js";
import { ArrowLeftRight, Check, Share } from "./icons.js";

// Popover that portals to document.body so it's never clipped by an ancestor's overflow:hidden
// or trapped by its stacking context: invite a co-scorer to a match by sharing its code. Used to
// also offer a read-only live-score link and a plain-text score summary, but neither saw real use
// next to the one thing people actually reach for a share button to do -- inviting someone to
// help score is the only option now. Reads real window/document/navigator APIs directly --
// getBoundingClientRect for positioning, window.innerWidth/innerHeight,
// ReactDOM.createPortal(..., document.body), and navigator.clipboard -- so like Modal, it needs a
// real jsdom-backed DOM to test meaningfully; see tests/unit/components/shareMenus.test.js.
//
// Renders nothing once the match is complete -- there's nobody left to invite to help score a
// match that's already over, so every call site (MatchScreen, Home's match list, ResultScreen)
// can just render this unconditionally rather than each re-deriving that same status check.

export function ShareMenu({
  match,
  onGetCode,
  style
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // {top, right} in viewport coords
  const [menuAdjust, setMenuAdjust] = useState(null); // post-measure overrides once it's known the panel doesn't fit as opened
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  function toggleOpen() {
    setOpen(o => {
      const next = !o;
      if (next && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        // Fixed-position + portal to document.body so this never gets clipped by an ancestor's
        // overflow:hidden (the scoring header uses one to contain its decorative background) or
        // trapped by an ancestor's stacking context — both bit us before this was a portal.
        setPos({
          top: rect.bottom + 8,
          right: Math.max(8, window.innerWidth - rect.right)
        });
      } else {
        setMenuAdjust(null);
      }
      return next;
    });
  }
  // The panel opens downward from the trigger by default, which is fine for the MatchScreen
  // header (always near the top of the viewport) but not for a Home-list row, which can sit
  // anywhere down a scrolling list -- opening below can run the panel off the bottom of the
  // screen with no way to reach the lower rows. Measure it once it's actually on the page and, if
  // it doesn't fit, flip it above the trigger; if there isn't room on either side either, pin it
  // in view and let it scroll internally instead of spilling past the viewport edge.
  React.useLayoutEffect(() => {
    if (!open || !pos || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const overflowBottom = rect.bottom - (window.innerHeight - 8);
    if (overflowBottom <= 0) {
      return;
    }
    const btnRect = btnRef.current && btnRef.current.getBoundingClientRect();
    const spaceAbove = btnRect ? btnRect.top - 8 : 0;
    if (btnRect && spaceAbove >= rect.height) {
      setMenuAdjust({
        top: Math.max(8, btnRect.top - 8 - rect.height),
        transformOrigin: "bottom right"
      });
    } else {
      setMenuAdjust({
        top: 8,
        maxHeight: window.innerHeight - 16,
        overflowY: "auto"
      });
    }
  }, [open, pos]);
  // Full-access score code (co-scoring). Deliberately separate from any read-only view-code
  // concept — never conflate the two, that conflation was the exact hole that once let a
  // "read-only" viewer gain scoring access.
  async function ensureCode() {
    if (match.shareCode) return {
      ok: true,
      code: match.shareCode
    };
    setBusy(true);
    setError("");
    const result = await onGetCode();
    setBusy(false);
    if (!result || result.ok === false) {
      setError(result && result.error || "Couldn't get a code.");
      return {
        ok: false
      };
    }
    return {
      ok: true,
      code: result.code
    };
  }
  async function handleInviteCopy() {
    const res = await ensureCode();
    if (!res.ok) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(res.code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  if (match.status === "complete") return null;
  const rowLabelStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700
  };
  const rowSubStyle = {
    fontSize: 11.5,
    opacity: 0.7,
    margin: "3px 0 8px",
    lineHeight: 1.4
  };
  const iconChipStyle = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(242,236,217,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  };
  const menu = open && pos && /*#__PURE__*/ReactDOM.createPortal(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.12)",
      zIndex: 100,
      animation: "cs-scrim 0.2s ease"
    }
  }), /*#__PURE__*/React.createElement("div", {
    ref: menuRef,
    onClick: e => e.stopPropagation(),
    style: {
      position: "fixed",
      top: pos.top,
      right: pos.right,
      width: 270,
      background: `linear-gradient(160deg, ${COLORS.pitchFixed} 0%, ${COLORS.pitchDarkFixed} 100%)`,
      color: COLORS.creamFixed,
      borderRadius: 14,
      border: "1px solid rgba(242,236,217,0.08)",
      padding: 10,
      fontFamily: "'Inter'",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
      transformOrigin: "top right",
      animation: "cs-menuPop 0.16s cubic-bezier(0.22, 1, 0.36, 1)",
      zIndex: 101,
      ...menuAdjust
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 8px 10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: rowLabelStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: iconChipStyle
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 12
  })), "Invite to help score"), /*#__PURE__*/React.createElement("div", {
    style: rowSubStyle
  }, "Full access — they can score too. Share the code, not a link."), match.shareCode ? /*#__PURE__*/React.createElement("button", {
    className: "cs-btn",
    onClick: handleInviteCopy,
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      background: "rgba(242,236,217,0.1)",
      border: "1px solid rgba(242,236,217,0.3)",
      borderRadius: 10,
      color: COLORS.creamFixed,
      fontFamily: "'IBM Plex Mono'",
      fontWeight: 600,
      fontSize: 13,
      letterSpacing: 0.5,
      padding: "8px 10px",
      cursor: "pointer"
    }
  }, copied ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
    size: 14
  }), "Copied!") : match.shareCode) : /*#__PURE__*/React.createElement("button", {
    className: "cs-btn",
    onClick: handleInviteCopy,
    disabled: busy,
    style: {
      width: "100%",
      background: "rgba(242,236,217,0.1)",
      border: "1px solid rgba(242,236,217,0.3)",
      borderRadius: 10,
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      padding: "8px 10px",
      cursor: busy ? "default" : "pointer"
    }
  }, busy ? "Getting code…" : "Get code & copy")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 8px 2px",
      fontSize: 11.5,
      color: COLORS.gold,
      lineHeight: 1.4
    }
  }, error))), document.body);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    ref: btnRef,
    className: "cs-btn",
    onClick: toggleOpen,
    title: "Share",
    "aria-label": "Share",
    style: {
      background: "rgba(242,236,217,0.14)",
      border: `1px solid rgba(242,236,217,0.35)`,
      borderRadius: 8,
      color: COLORS.creamFixed,
      cursor: "pointer",
      width: 38,
      height: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style
    }
  }, /*#__PURE__*/React.createElement(Share, {
    size: 17
  })), menu);
}
