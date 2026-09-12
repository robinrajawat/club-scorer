import React, { useRef, useState, useEffect } from "react";
import { COLORS } from "./theme.js";

// Bottom-sheet modal shell used throughout the app (confirmation dialogs, pickers, forms, etc).
// Tracks the visual viewport height (so the sheet shrinks correctly when a mobile keyboard opens),
// locks background scroll while open, and traps focus on the sheet itself for the duration. All
// three effects touch real window/document APIs, so tests exercise this against a jsdom-backed DOM
// (see tests/unit/components/modal.test.js) rather than the ambient-global-only pattern used by
// components that don't need a real DOM.

// A shared lock, stashed on `window` rather than a module-level variable -- several screens open a
// Modal-based editor that itself opens a ConfirmModal (also a Modal) for its final confirm step
// (e.g. RulesEditModal -> ConfirmModal). Without this, each Modal's own scroll-lock effect reads
// window.scrollY independently -- but once the OUTER modal has already pinned body to
// `position: fixed`, the page has nothing left to scroll, so window.scrollY genuinely reads 0 to
// the INNER modal, which then overwrites body's saved offset with 0. The result: the background
// page visibly jumps to scroll position 0 the moment the inner modal opens, and (depending on
// which modal closes first) can jump again or restore to the wrong position on close -- surfacing
// as page content/fixed elements visibly shifting around a nested confirm step. Tracking a shared
// open count means only the first (outermost) Modal to mount actually locks the page, and only the
// last one to unmount actually restores it, using the one true pre-any-modal scroll position.
//
// A plain module-level `let` (the first version of this fix) broke in production: public/index.html
// is built by splicing each named function's OWN body out of its src/components/*.js file
// (scripts/generate.js's per-function FUNCTIONS entries), not the whole module -- so a top-level
// `let` sitting above the function never made it into the generated file, leaving every reference
// to it an undeclared identifier and throwing ReferenceError the moment any Modal tried to mount.
// A property on `window` survives that splice untouched, since it's a real runtime global rather
// than a module-scoped declaration. Read/written inline inside Modal itself (not a separate helper
// function) for the same reason: a helper function would need its OWN entry in generate.js's
// FUNCTIONS array to be spliced in at all, and this file only registers "Modal".

export function Modal({
  children,
  onClose
}) {
  const sheetRef = useRef(null);
  const previouslyFocused = useRef(null);
  // Mobile keyboards shrink the *visual* viewport but a plain `vh` unit is sized against the
  // *layout* viewport, which most mobile browsers leave alone when the keyboard opens -- so a
  // sheet pinned to e.g. 85vh doesn't shrink, and whatever's near its bottom (whether that's the
  // footer buttons or a scrollable list once you're partway through it) ends up hidden behind the
  // keyboard instead of within the area that's actually still visible. Tracking
  // visualViewport.height directly and sizing off that instead keeps the sheet honest about how
  // much space is really on screen, keyboard included. Falls back to window.innerHeight on
  // browsers without the API (desktop mainly, where there's no keyboard to worry about anyway).
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport ? window.visualViewport.height : window.innerHeight);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      setViewportHeight(vv.height);
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  // Locks the page behind the sheet in place while it's open. `overflow: hidden` on body alone
  // doesn't reliably stop touch scrolling on iOS Safari -- the page can still rubber-band/scroll
  // behind a `position: fixed` overlay, most noticeably once a touch drag inside the sheet's own
  // scrollable content (e.g. the club pool picker's player list) reaches the top or bottom of
  // that list and the drag "leaks" into scrolling whatever's behind the modal. Pinning body itself
  // to `position: fixed` at its current scroll offset blocks that path entirely, and restoring
  // scrollTop on close (rather than letting the browser do it) avoids the page silently jumping
  // to the top while the sheet was open.
  useEffect(() => {
    if (!window.__csModalLock) window.__csModalLock = { count: 0, scrollY: 0, bodyStyle: null };
    const lock = window.__csModalLock;
    const isOutermost = lock.count === 0;
    lock.count++;
    if (isOutermost) {
      const body = document.body;
      lock.scrollY = window.scrollY;
      lock.bodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width
      };
      body.style.position = "fixed";
      body.style.top = `-${lock.scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    }
    return () => {
      lock.count--;
      if (lock.count === 0) {
        const body = document.body;
        body.style.position = lock.bodyStyle.position;
        body.style.top = lock.bodyStyle.top;
        body.style.left = lock.bodyStyle.left;
        body.style.right = lock.bodyStyle.right;
        body.style.width = lock.bodyStyle.width;
        window.scrollTo(0, lock.scrollY);
        lock.bodyStyle = null;
      }
    };
  }, []);
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    // Focus the sheet itself (not a specific control inside it, since Modal's content varies by
    // caller) — makes it the next thing a screen reader or Tab press lands on, without assuming
    // anything about what's inside.
    if (sheetRef.current) sheetRef.current.focus();
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to whatever opened this sheet — a background button that's still there and
      // still meaningful once the sheet closes, rather than leaving focus on <body>.
      if (previouslyFocused.current && previouslyFocused.current.focus) {
        previouslyFocused.current.focus();
      }
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      height: viewportHeight,
      background: "rgba(31,58,15,0.55)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: 50,
      animation: "cs-scrim 0.2s ease"
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    ref: sheetRef,
    role: "dialog",
    "aria-modal": "true",
    tabIndex: -1,
    onClick: e => e.stopPropagation(),
    style: {
      background: COLORS.cream,
      borderRadius: "20px 20px 0 0",
      padding: "22px 18px 30px",
      width: "100%",
      maxWidth: 560,
      maxHeight: viewportHeight * 0.85,
      overflowY: "auto",
      overscrollBehavior: "contain",
      WebkitOverflowScrolling: "touch",
      boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
      animation: "cs-slideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
      outline: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: COLORS.willow,
      margin: "0 auto 16px",
      opacity: 0.6
    }
  }), children));
}
