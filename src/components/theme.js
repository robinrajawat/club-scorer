// Design-token color palette, referenced by (almost) every component in src/components/.
// Values are CSS custom-property references (var(--cs-...)) resolved by index.html's own
// light/dark <style> block -- this module doesn't need a DOM to be imported, only to actually
// render, so it's safe for tests to import directly.

export const COLORS = {
  pitch: "var(--cs-pitch)",
  pitchDark: "var(--cs-pitch-dark)",
  pitchDarkFixed: "var(--cs-pitch-dark-fixed)",
  turf: "var(--cs-turf)",
  cream: "var(--cs-cream)",
  creamDark: "var(--cs-cream-dark)",
  willow: "var(--cs-willow)",
  ink: "var(--cs-ink)",
  inkSoft: "var(--cs-ink-soft)",
  ball: "var(--cs-ball)",
  ballLight: "var(--cs-ball-light)",
  gold: "var(--cs-gold)",
  surface: "var(--cs-surface)",
  cardDivider: "var(--cs-card-divider)",
  creamFixed: "var(--cs-cream-fixed)",
  turfFixed: "var(--cs-turf-fixed)",
  pitchFixed: "var(--cs-pitch-fixed)",
  ballFixed: "var(--cs-ball-fixed)",
  ballLightFixed: "var(--cs-ball-light-fixed)",
  // A distinct "this is happening right now" red, deliberately separate from ball/ballFixed (the
  // cricket-ball accent color) even though both are reds — this one is reserved for live/urgent
  // status (pulsing dots, alert borders) and, like the app's other accent colors, stays constant
  // across both themes rather than flipping with dark mode.
  live: "#e6544b"
};
