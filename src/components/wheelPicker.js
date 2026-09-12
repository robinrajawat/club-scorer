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
// Real-DOM-only: reads/writes scrollTop and calls scrollTo/scrollIntoView, all no-ops under
// react-test-renderer's fake nodes (ref.current stays null there), so clicking an option to select
// it is still fully testable without a jsdom setup -- only the flick-to-scroll gesture itself needs
// a real browser. See tests/unit/components/wheelPicker.test.js.
export function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
  itemHeight = 36,
  visibleCount = 5
}) {
  const containerRef = useRef(null);
  const settleTimer = useRef(null);
  const padCount = Math.floor(visibleCount / 2);
  const containerHeight = itemHeight * visibleCount;
  const selectedIndex = options.findIndex(o => o.value === value);

  // Centers the initial value on mount -- later value changes (from tapping an option) already
  // scroll themselves as part of that same interaction, so this only needs to run once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !el.scrollTo) return;
    const idx = Math.max(0, selectedIndex);
    el.scrollTo({ top: idx * itemHeight, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  function selectIndex(idx, smooth) {
    const opt = options[idx];
    if (!opt) return;
    if (opt.value !== value) onChange(opt.value);
    const el = containerRef.current;
    if (el && el.scrollTo) el.scrollTo({ top: idx * itemHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // Fires continuously while flicking/dragging -- debounced so the nearest-to-center option is only
  // read once the scroll has actually settled (mid-flick scrollTop doesn't mean anything yet, and
  // CSS scroll-snap itself may still nudge the final rest position after momentum ends).
  function handleScroll() {
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
      fontSize: opt.value === value ? 17 : 14,
      fontWeight: opt.value === value ? 700 : 500,
      color: opt.value === value ? COLORS.pitch : COLORS.inkSoft,
      opacity: opt.value === value ? 1 : 0.6,
      transition: "font-size 0.15s ease, opacity 0.15s ease, color 0.15s ease"
    }
  }, opt.label)), /*#__PURE__*/React.createElement("div", {
    style: { height: padCount * itemHeight }
  })));
}
