import React, { useEffect, useRef } from "react";
import { COLORS } from "./theme.js";

// An iOS-style scrollable "wheel" picker -- flick/drag through options with native momentum and
// snap-to-center (CSS scroll-snap does the actual physics, so it feels like the real thing rather
// than a JS-simulated approximation), or tap an option directly. Built for FixtureDateTimeModal's
// hour/minute/AM-PM pickers (previously three separate <select> dropdowns / a segmented button
// row), but takes a generic {value, label}[] so it isn't tied to time values specifically.
//
// `options[].value` is compared with `===`, so callers should pass primitives (numbers/strings) --
// matching how FixtureDateTimeModal already tracks hour12 (number) and minute (string) state.
//
// Real-DOM-only: reads/writes scrollTop and calls scrollTo, all no-ops under react-test-renderer's
// fake nodes (ref.current stays null there), so clicking an option to select it is still fully
// testable without a jsdom setup -- only the flick-to-scroll gesture itself needs a real browser.
// See tests/unit/components/wheelPicker.test.js.
//
// A first version of this only flipped a binary "selected"/"not" style once scrolling settled --
// felt cheap next to a real iOS picker, for two reasons this version fixes: (1) every row on a real
// wheel continuously scales and fades as it passes the center, tracked 1:1 with the finger, not
// snapped after the fact; (2) animating `font-size` (what v1 did to size up the selected row) never
// interpolates smoothly in a browser -- it's a discrete layout property, not a GPU-animatable one,
// so it visibly jumps. This version keeps font-size fixed and drives the size difference through
// `transform: scale(...)`, which the browser genuinely animates, and updates it on every scroll
// frame (direct DOM writes via refs, not React state -- a state-driven update at 60fps would be
// both slower and laggier than the finger).
//
// Real haptic "tick" feedback (what iOS's native picker gives on every detent) is wired in via
// navigator.vibrate where it exists, but that's Android Chrome/Firefox only -- iOS Safari has never
// exposed the Vibration API to web content at all, home-screen PWA included. That's an Apple
// platform restriction with no web-side workaround, not a bug in this component.
export function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
  itemHeight = 40,
  visibleCount = 5
}) {
  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const settleTimer = useRef(null);
  const rafId = useRef(null);
  const lastVibratedIndex = useRef(null);
  const padCount = Math.floor(visibleCount / 2);
  const containerHeight = itemHeight * visibleCount;
  const selectedIndex = options.findIndex(o => o.value === value);

  // The continuous per-row visual: distance from the center row (in whole "rows", capped at 2)
  // maps to a scale/opacity/weight falloff, applied straight to each item's DOM node so it updates
  // every scroll frame with no re-render in the loop.
  function applyContinuousStyles() {
    const el = containerRef.current;
    if (!el) return;
    const centerContent = el.scrollTop + containerHeight / 2;
    itemRefs.current.forEach((node, i) => {
      if (!node) return;
      const itemCenter = i * itemHeight + itemHeight / 2;
      const rows = Math.min(Math.abs((itemCenter - centerContent) / itemHeight), 2);
      node.style.transform = `scale(${1 - rows * 0.22})`;
      node.style.opacity = String(1 - rows * 0.42);
      node.style.fontWeight = rows < 0.4 ? "700" : "500";
      node.style.color = rows < 0.4 ? COLORS.pitch : COLORS.inkSoft;
    });
  }

  // Centers the initial value on mount -- later value changes (from tapping an option, or a scroll
  // settling) already scroll/style themselves as part of that same interaction, so this only needs
  // to run once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !el.scrollTo) return;
    const idx = Math.max(0, selectedIndex);
    el.scrollTo({ top: idx * itemHeight, behavior: "auto" });
    applyContinuousStyles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (rafId.current && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId.current);
  }, []);

  function vibrateIfChanged(idx) {
    if (idx === lastVibratedIndex.current) return;
    lastVibratedIndex.current = idx;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(4); // a single short tick, same idea as the native picker's detent click
    }
  }

  function selectIndex(idx, smooth) {
    const opt = options[idx];
    if (!opt) return;
    if (opt.value !== value) onChange(opt.value);
    vibrateIfChanged(idx);
    const el = containerRef.current;
    if (el && el.scrollTo) el.scrollTo({ top: idx * itemHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // Fires on every scroll frame while flicking/dragging: the visual update (applyContinuousStyles)
  // runs immediately, rAF-throttled, so rows track the finger in real time. Committing the actual
  // VALUE is still debounced separately -- mid-flick scrollTop doesn't mean anything settled yet,
  // and CSS scroll-snap itself may keep nudging the final rest position after momentum ends.
  function handleScroll() {
    if (rafId.current && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId.current);
    if (typeof requestAnimationFrame === "function") {
      rafId.current = requestAnimationFrame(applyContinuousStyles);
    } else {
      applyContinuousStyles();
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / itemHeight);
      selectIndex(idx, false);
    }, 120);
  }

  return /*#__PURE__*/React.createElement("div", {
    style: { position: "relative", height: containerHeight, flex: 1, minWidth: 0 }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: padCount * itemHeight,
      height: itemHeight,
      borderTop: `1.5px solid ${COLORS.willow}`,
      borderBottom: `1.5px solid ${COLORS.willow}`,
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    role: "listbox",
    "aria-label": ariaLabel,
    className: "cs-no-scrollbar",
    onScroll: handleScroll,
    style: {
      height: containerHeight,
      overflowY: "auto",
      scrollSnapType: "y mandatory",
      WebkitOverflowScrolling: "touch",
      overscrollBehavior: "contain"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: { height: padCount * itemHeight }
  }), options.map((opt, i) => /*#__PURE__*/React.createElement("button", {
    key: opt.value,
    ref: el => { itemRefs.current[i] = el; },
    type: "button",
    role: "option",
    "aria-selected": opt.value === value,
    onClick: () => selectIndex(i, true),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: itemHeight,
      scrollSnapAlign: "center",
      border: "none",
      background: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontSize: 16,
      // Server-rendered fallback (before the mount effect measures real scroll position and takes
      // over via direct DOM writes) -- keeps the initial paint from showing every row at full size.
      fontWeight: opt.value === value ? 700 : 500,
      color: opt.value === value ? COLORS.pitch : COLORS.inkSoft,
      opacity: opt.value === value ? 1 : 0.58,
      transform: opt.value === value ? "scale(1)" : "scale(0.78)",
      transition: "transform 0.12s ease-out, opacity 0.12s ease-out"
    }
  }, opt.label)), /*#__PURE__*/React.createElement("div", {
    style: { height: padCount * itemHeight }
  })));
}
