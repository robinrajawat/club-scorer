// Small, self-contained decorative/status React components -- loading spinners, empty-state art,
// the app icon mark. Covered by tests/unit/components/illustrations.test.js using
// react-test-renderer.

import React from "react";
import { COLORS } from "./theme.js";

export function AppMark({
  size
}) {
  const scale = 192 / 144; // inverse of the ~75%-of-canvas content box shared by every icon export
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: 0,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "./icons/icon-512.png",
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: size * scale,
      height: size * scale,
      transform: "translate(-50%, -50%)"
    }
  }));
}

export function LoadingBallIllustration({
  size = 44,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 44 44",
    fill: "none",
    style: {
      display: "block",
      animation: "cs-ballSpin 0.9s linear infinite",
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "22",
    cy: "22",
    r: "16",
    fill: `url(#cs-ball-grad)`,
    stroke: COLORS.ball,
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 10 C 17 16, 17 28, 12 34",
    stroke: "#f5ded9",
    strokeWidth: "1.3",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M32 10 C 27 16, 27 28, 32 34",
    stroke: "#f5ded9",
    strokeWidth: "1.3",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "cs-ball-grad",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: COLORS.ballLight
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: COLORS.ball
  }))));
}

export function LoadingNote({
  label = "Loading\u2026",
  size = 16,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      ...style
    }
  }, /*#__PURE__*/React.createElement(LoadingBallIllustration, {
    size
  }), label);
}

export function EmptyStateBallIllustration() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "52",
    height: "52",
    viewBox: "0 0 52 52",
    fill: "none",
    style: {
      margin: "0 auto",
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "26",
    cy: "26",
    r: "19",
    stroke: COLORS.willow,
    strokeWidth: "1.6",
    fill: "rgba(201,168,118,0.08)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 15 C 20 22, 20 30, 14 37",
    stroke: COLORS.willow,
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M38 15 C 32 22, 32 30, 38 37",
    stroke: COLORS.willow,
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round"
  }));
}
