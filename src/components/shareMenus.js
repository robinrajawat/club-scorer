import React, { useState, useRef } from "react";
import { COLORS } from "./theme.js";
import { ArrowLeftRight, Check, Users, Share } from "./icons.js";
import { buildFollowUrl, buildLiveShareText, buildShareText } from "../core/shareAndFormat.js";

// Popover menus that portal to document.body so they're never clipped by an ancestor's
// overflow:hidden or trapped by its stacking context: MoveTeamMenu (pick which club a team
// belongs to) and ShareMenu (invite a co-scorer, share a read-only live link, or share a plain
// score summary). Both read real window/document/navigator APIs directly -- getBoundingClientRect
// for positioning, window.innerWidth/innerHeight, ReactDOM.createPortal(..., document.body), and
// (ShareMenu only) navigator.clipboard -- so like Modal, they need a real jsdom-backed DOM to test
// meaningfully; see tests/unit/components/shareMenus.test.js.
//
// ShareMenu's handleShareLive/handleShareDetails call `shareText` (navigator.share/clipboard,
// defined in public/index.html, not extracted -- browser-only and side-effecting, nothing to
// unit-test in the function itself) from their onClick handlers, same as elsewhere in this app.

export function MoveTeamMenu({
  team,
  clubs,
  currentClubId,
  onMove
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef(null);
  const destinations = [{
    id: null,
    name: "My Teams"
  }, ...clubs.map(c => ({
    id: c.id,
    name: c.name
  }))].filter(d => d.id !== currentClubId);
  if (destinations.length === 0) return null;
  function toggle() {
    setOpen(o => {
      const next = !o;
      if (next && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + 6,
          right: Math.max(8, window.innerWidth - rect.right)
        });
      }
      return next;
    });
  }
  async function handlePick(destId) {
    setOpen(false);
    setBusy(true);
    await onMove(team, destId);
    setBusy(false);
  }
  const menu = open && pos && /*#__PURE__*/ReactDOM.createPortal(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 100
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: "fixed",
      top: pos.top,
      right: pos.right,
      minWidth: 170,
      background: COLORS.ink,
      color: COLORS.creamFixed,
      borderRadius: 12,
      padding: 6,
      fontFamily: "'Inter'",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      zIndex: 101
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "6px 8px",
      fontSize: 10.5,
      opacity: 0.6,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5
    }
  }, "Move team to"), destinations.map(d => /*#__PURE__*/React.createElement("button", {
    key: d.id || "personal",
    onClick: () => handlePick(d.id),
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontSize: 13,
      fontWeight: 600,
      padding: "8px 8px",
      borderRadius: 8,
      cursor: "pointer"
    }
  }, d.name)))), document.body);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    ref: btnRef,
    onClick: toggle,
    disabled: busy,
    className: "cs-btn",
    "aria-label": "Move team",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: busy ? "default" : "pointer",
      padding: 8,
      borderRadius: 8,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 16
  })), menu);
}

export function ShareMenu({
  match,
  onGetCode,
  onGetViewCode,
  style
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // {top, right} in viewport coords
  const [menuAdjust, setMenuAdjust] = useState(null); // post-measure overrides once it's known the panel doesn't fit as opened
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedWhich, setCopiedWhich] = useState(null); // 'code' | 'link' | null
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
  // anywhere down a scrolling list -- opening below can run the ~230px-tall panel off the bottom
  // of the screen with no way to reach the lower rows. Measure it once it's actually on the page
  // and, if it doesn't fit, flip it above the trigger; if there isn't room on either side either,
  // pin it in view and let it scroll internally instead of spilling past the viewport edge.
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
  function flashCopied(which) {
    setCopiedWhich(which);
    setTimeout(() => setCopiedWhich(w => w === which ? null : w), 1500);
  }
  // Full-access score code (co-scoring). Deliberately separate from ensureViewCode below —
  // never conflate these two, that conflation was the exact hole that let a "read-only" viewer
  // gain scoring access.
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
  // Read-only view code. Resolves against match.viewCode / the liveViews collection only — this
  // value must never be accepted by the "Invite to help score" join flow.
  async function ensureViewCode() {
    if (match.viewCode) return {
      ok: true,
      code: match.viewCode
    };
    setBusy(true);
    setError("");
    const result = await onGetViewCode();
    setBusy(false);
    if (!result || result.ok === false) {
      setError(result && result.error || "Couldn't get a link.");
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
    flashCopied("code");
  }
  async function handleCopyLink() {
    const res = await ensureViewCode();
    if (!res.ok) return;
    const url = buildFollowUrl(res.code);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    flashCopied("link");
  }
  async function handleShareLive() {
    const res = await ensureViewCode();
    if (!res.ok) return;
    const text = buildLiveShareText(match, res.code);
    shareText(text);
    setOpen(false);
  }
  // Plain score snapshot, no follow link/code involved -- unlike handleShareLive this never
  // needs a view code, so it never touches ensureViewCode and can't fail on that account.
  function handleShareDetails() {
    shareText(buildShareText(match));
    setOpen(false);
  }
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
  }, match.status !== "complete" && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 8px 10px",
      borderBottom: "1px solid rgba(242,236,217,0.1)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: rowLabelStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: iconChipStyle
  }, /*#__PURE__*/React.createElement(ArrowLeftRight, {
    size: 12
  })), "Invite to help score"), /*#__PURE__*/React.createElement("div", {
    style: rowSubStyle
  }, "Full access \u2014 they can score too. Share the code, not a link."), match.shareCode ? /*#__PURE__*/React.createElement("button", {
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
  }, copiedWhich === "code" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
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
  }, busy ? "Getting code\u2026" : "Get code & copy")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 8px 8px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: rowLabelStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: iconChipStyle
  }, /*#__PURE__*/React.createElement(Users, {
    size: 12
  })), "Share live score"), /*#__PURE__*/React.createElement("div", {
    style: rowSubStyle
  }, "Read-only \u2014 anyone with the link can watch, not edit."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "cs-btn",
    onClick: handleShareLive,
    disabled: busy,
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      background: COLORS.turfFixed,
      border: "none",
      borderRadius: 10,
      color: "#fff",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      padding: "8px 6px",
      cursor: busy ? "default" : "pointer"
    }
  }, /*#__PURE__*/React.createElement(Share, {
    size: 14
  }), "Share"), /*#__PURE__*/React.createElement("button", {
    className: "cs-btn",
    onClick: handleCopyLink,
    disabled: busy,
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      background: "rgba(242,236,217,0.1)",
      border: "1px solid rgba(242,236,217,0.3)",
      borderRadius: 10,
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      padding: "8px 6px",
      cursor: busy ? "default" : "pointer"
    }
  }, copiedWhich === "link" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
    size: 14
  }), "Copied!") : "Copy link"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 8px 8px",
      borderTop: "1px solid rgba(242,236,217,0.1)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: rowLabelStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: iconChipStyle
  }, /*#__PURE__*/React.createElement(Share, {
    size: 12
  })), "Share match details"), /*#__PURE__*/React.createElement("div", {
    style: rowSubStyle
  }, "Just the score line \u2014 no live link, nothing to keep updating."), /*#__PURE__*/React.createElement("button", {
    className: "cs-btn",
    onClick: handleShareDetails,
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      background: COLORS.turfFixed,
      border: "none",
      borderRadius: 10,
      color: "#fff",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      padding: "8px 6px",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Share, {
    size: 14
  }), "Share")), error && /*#__PURE__*/React.createElement("div", {
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
