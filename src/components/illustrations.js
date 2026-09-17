// Small, self-contained decorative/status React components -- loading spinners, empty-state art,
// the app icon mark. Covered by tests/unit/components/illustrations.test.js using
// react-test-renderer.

import React from "react";
import { COLORS } from "./theme.js";

export function AppMark({
  size
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: "./icons/icon-512.png",
    alt: "",
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      filter: "drop-shadow(0 3px 8px rgba(20,20,20,0.3))"
    }
  });
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
    r: "18",
    stroke: COLORS.creamDark,
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 4 A18 18 0 0 1 40 22",
    stroke: COLORS.gold,
    strokeWidth: "4",
    strokeLinecap: "round"
  }));
}

// The same antique-gold tone as CoinFlipIllustration below, shrunk down for inline use next to
// button text (the toss flow's "Flip"/"No coin handy?" labels) -- a plain CSS gradient circle,
// not an SVG one, so it needs no gradient-id (two of these can render on screen at once, e.g. the
// toggle button and the Flip button together, without any id-collision risk). No rim/highlight
// detail at this size -- the full coin's layered treatment turns to mud below ~30px, so this
// stays a flat swatch and only borrows the color.
export function CoinIcon({
  size = 14,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: "linear-gradient(160deg, #e8c37e, #a97a2a)",
      boxShadow: "0 1px 2px rgba(106,74,22,0.5), inset 0 0 0 1px rgba(255,240,210,0.35)",
      flexShrink: 0,
      verticalAlign: "middle",
      ...style
    }
  });
}

// A real coin, not a flickering label. This used to be two circular faces (Heads/Tails) glued
// back-to-back on a 3D-rotated (rotateY) disc, hidden/shown via backface-visibility -- the
// standard CSS flip-card technique. Dropped that after it turned out unreliable on iOS
// Safari/WKWebView (this PWA's actual runtime): even with the -webkit- prefixes added,
// reports kept coming in of both faces rendering at once, overlapping into a garbled letter.
// backface-visibility + perspective + preserve-3d has a long history of exactly this kind of
// inconsistency in WebKit, and this app has no way to test against real Safari to chase it
// further. So: only ONE face is ever in the DOM now, full stop -- see CoinFlipIllustration below
// for how a 2D horizontal squash (scaleX) fakes the flip instead. Structurally impossible for two
// faces to render simultaneously, on any engine, because there's only ever one.
//
// The face itself is still layered, not a flat gradient circle, for an actual minted-medal read:
// a two-tone rim (the outer radial gradient breaks to a darker ring right at the edge, reading as
// a raised lip rather than a drop shadow), an inset face with a conic sweep (light wrapping around
// a flat disc, not a sphere -- a plain radial highlight here shades it like a ball instead of a
// coin), a thin inner bevel border, and a tight crescent specular highlight (a small directional
// shine, not a full-face glow). A beaded rim was tried and dropped: at the ~56px this ever renders
// at, individual beads blur into noise instead of reading as beading -- detail that only survives
// at mockup size doesn't belong here.
function CoinFace({
  letter,
  size
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "radial-gradient(circle, #c99248 0%, #c99248 86%, #6b4a16 87%, #8a641f 93%, #b8892b 100%)",
      boxShadow: "0 2px 6px rgba(60,40,10,0.5), inset 0 0 0 1px rgba(50,34,10,0.35)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: "9%",
      borderRadius: "50%",
      background: "conic-gradient(from 215deg, #e8c37e, #a97a2a 42%, #7a5518 62%, #c99248 88%, #e8c37e)",
      boxShadow: "inset 0 2px 3px rgba(255,236,190,0.45), inset 0 -3px 6px rgba(50,34,10,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: "10%",
      borderRadius: "50%",
      boxShadow: "inset 0 1.5px 2px rgba(50,34,10,0.35), inset 0 -1px 2px rgba(255,236,190,0.3)",
      border: "1px solid rgba(50,34,10,0.2)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      top: "11%",
      left: "17%",
      width: "32%",
      height: "19%",
      borderRadius: "50%",
      background: "radial-gradient(ellipse at 40% 35%, rgba(255,242,210,0.75), rgba(255,242,210,0) 70%)",
      transform: "rotate(-25deg)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      zIndex: 1,
      fontFamily: "'DM Serif Display', serif",
      fontSize: Math.round(size * 0.42),
      fontWeight: 700,
      color: "#2e1c04",
      // The conic sweep behind this letter crosses several tones (cream-gold to deep umber), so a
      // single text-shadow read fine over some of them and vanished into others. A thin dark stroke
      // (not just a shadow) keeps the letter legible no matter which part of the sweep sits behind
      // it -- reads as engraving, not a flat sticker, which fits the minted-medal look.
      WebkitTextStroke: "0.6px rgba(42,26,4,0.55)",
      textShadow: "0 1px 0 rgba(255,236,190,0.55)"
    }
  }, letter)));
}
// `phase` drives the toss's vertical arc: "up" lifts the coin on a short ease-out (a hand
// launching it), "down" brings it back down on a longer ease-in (gravity winning), "rest" is the
// static pre-/post-flip state with no transition at all. `squashed` drives the spin, completely
// separately (own wrapper, own transition, own timing) -- a coin genuinely rotating, viewed
// face-on, visually IS a horizontal squash to nothing and back on every half-turn, so a handful of
// quick squash pulses in a row reads as spinning; `flipCoin` (setupScreen.js) fires several of
// these during the flight, swapping `face` at the bottom of each pulse (scaleX at or near 0, so
// the swap itself is imperceptible -- same trick paper flip clocks and CSS "fake 3D" card flips
// use), landing on the real result only on the last one. Arc and spin run on separate transforms
// specifically so the spin can pulse much faster than the single slow arc motion. Structurally
// this still only ever renders one CoinFace at a time -- see its own comment for why that matters
// (no dependency on backface-visibility/perspective/preserve-3d, which is what made the old
// 3D-rotated version unreliable on iOS Safari/WKWebView). The ground shadow shrinks and fades
// while airborne and grows back on landing, the usual cheap trick for selling height with a 2D
// element.
export function CoinFlipIllustration({
  face,
  phase = "rest",
  squashed = false,
  size = 56
}) {
  const lift = Math.round(size * 1.4);
  const translateY = phase === "up" ? -lift : 0;
  const arcTransition = phase === "rest" ? "none" : phase === "up" ? "transform 0.35s cubic-bezier(0.33,0,0.2,1)" : "transform 0.55s cubic-bezier(0.5,0,0.75,0.9)";
  const spinTransition = phase === "rest" ? "none" : "transform 0.1s ease-in-out";
  const shadowScale = phase === "up" ? 0.5 : 1;
  const shadowOpacity = phase === "up" ? 0.15 : 0.3;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: size + lift,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      transform: `translateY(${translateY}px)`,
      transition: arcTransition
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      position: "relative",
      transform: `scaleX(${squashed ? 0 : 1})`,
      transition: spinTransition
    }
  }, /*#__PURE__*/React.createElement(CoinFace, {
    letter: face === "Tails" ? "T" : face === "Heads" ? "H" : "",
    size
  })))), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      width: size * 0.7,
      height: size * 0.16,
      borderRadius: "50%",
      background: "rgba(20,20,20,0.35)",
      marginTop: 4,
      transform: `scale(${shadowScale})`,
      opacity: shadowOpacity,
      transition: phase === "rest" ? "none" : arcTransition
    }
  }));
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
  }, /*#__PURE__*/React.createElement("g", {
    transform: "translate(26,27) scale(1.9) translate(-10,-12.5)"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "14",
    height: "17",
    rx: "1.5",
    stroke: COLORS.gold,
    strokeWidth: "0.7",
    fill: "rgba(184,137,43,0.06)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6.5",
    y1: "9",
    x2: "13.5",
    y2: "9",
    stroke: COLORS.gold,
    strokeWidth: "0.7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6.5",
    y1: "13",
    x2: "11",
    y2: "13",
    stroke: COLORS.gold,
    strokeWidth: "0.7"
  })));
}

// The "nothing here yet" state every list screen (Home, Live, Teams, Cups, Inbox) falls back to
// -- same look everywhere on purpose, so it doesn't matter which screen you're on.
// Used to be copy-pasted per screen with a fixed vh-fraction minHeight to fake vertical centering
// -- that reads as "too high" on any screen with more header/search/filter chrome above it than
// whichever screen that fraction happened to be eyeballed against, since a fixed fraction of the
// WHOLE viewport has no idea how much of it the header already used. `flex: 1` on this div does
// the actual job on most screens: it fills exactly whatever space is left below the header, so it
// centers correctly regardless of how tall that header is -- the one requirement is that the
// screen's own root element is itself `display: flex, flexDirection: "column"` with a real height
// to divide up (`minHeight: "100dvh"` on that root, same pattern on every screen that relies on
// this). Screens whose root isn't (yet) restructured that way can pass `minHeight` instead (a
// plain block-level minHeight, same old fallback) -- `flex: 1` is simply ignored by a non-flex
// parent, so this stays correct either way without the caller needing two code paths.
// No card/border/background around the icon+text -- a dashed box around "nothing here" read as
// more chrome than the empty state deserved, and swallowed a screen's worth of tint on any screen
// with a lot of leftover space (see Cups vs. Live). The icon and copy alone already read as
// unmistakably empty, not broken, without a container drawing attention to itself.
export function EmptyState({
  minHeight,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      ...(minHeight ? { minHeight } : {}),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "20px 0"
    }
  }, /*#__PURE__*/React.createElement(EmptyStateBallIllustration, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginTop: 12,
      maxWidth: 280
    }
  }, children));
}
