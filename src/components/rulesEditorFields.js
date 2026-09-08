import React from "react";
import { COLORS } from "./theme.js";
import { TextField, RuleChoice } from "./formUiAtoms.js";
import { Field } from "./screenAtoms.js";
import { ToggleRule, NullableNumberRule, RuleSectionHeader } from "./tournamentsScreen.js";

// The full house-rules form (overs per innings through Impact Player), shared by RulesEditModal's
// two callers -- editing an existing tournament's defaultRules (TournamentDetailScreen) and editing
// an existing, not-yet-started match's own rules (MatchScreen's "This match" menu). Deliberately a
// fresh component rather than an extraction of TournamentsScreen's own inline rules section (which
// this mirrors closely): that section is wired into the New Cup wizard's collapsible "Customize"
// toggle and its own defaultOvers/rulesExpanded state, and refactoring already-working, already-
// tested wizard code purely to share this new, unrelated edit surface isn't worth the risk to it.
// `oversLimit` is a STRING (same convention as TextField/RuleChoice elsewhere in this file's
// sibling forms) so the caller owns parsing/validating it on save, same as every numeric field here.
export function RulesEditorFields({
  oversLimit,
  setOversLimit,
  oversPlaceholder = "20",
  rules,
  setRules
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Format",
    first: true
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Overs per innings"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: oversLimit,
    onChange: v => setOversLimit(v.replace(/[^0-9]/g, "")),
    placeholder: oversPlaceholder,
    style: {
      textAlign: "center",
      padding: "12px 8px"
    }
  }))), /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Players per side",
    value: rules.playersPerSide,
    onChange: v => setRules(r => ({
      ...r,
      playersPerSide: v
    })),
    options: [{
      value: 6,
      label: "6"
    }, {
      value: 7,
      label: "7"
    }, {
      value: 8,
      label: "8"
    }, {
      value: 9,
      label: "9"
    }, {
      value: 10,
      label: "10"
    }, {
      value: 11,
      label: "11 (standard)"
    }]
  }), /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Balls per over",
    value: rules.ballsPerOver,
    onChange: v => setRules(r => ({
      ...r,
      ballsPerOver: v
    })),
    options: [{
      value: 4,
      label: "4 (kids)"
    }, {
      value: 5,
      label: "5"
    }, {
      value: 6,
      label: "6 (standard)"
    }, {
      value: 8,
      label: "8"
    }]
  }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Extras"
  }), /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Runs on a wide",
    value: rules.wideRuns,
    onChange: v => setRules(r => ({
      ...r,
      wideRuns: v
    })),
    options: [{
      value: 1,
      label: "1 (standard)"
    }, {
      value: 2,
      label: "2"
    }, {
      value: 3,
      label: "3"
    }]
  }), /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Runs on a no-ball",
    value: rules.noballRuns,
    onChange: v => setRules(r => ({
      ...r,
      noballRuns: v
    })),
    options: [{
      value: 1,
      label: "1 (standard)"
    }, {
      value: 2,
      label: "2"
    }, {
      value: 3,
      label: "3"
    }]
  }), /*#__PURE__*/React.createElement(ToggleRule, {
    label: "Free hit after a no-ball",
    value: rules.freeHit,
    onChange: v => setRules(r => ({
      ...r,
      freeHit: v
    }))
  }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Bowling limits"
  }), /*#__PURE__*/React.createElement(NullableNumberRule, {
    label: "Max overs per bowler",
    value: rules.maxOversPerBowler,
    onChange: v => setRules(r => ({
      ...r,
      maxOversPerBowler: v
    })),
    seed: Math.max(1, Math.ceil(parseInt(oversLimit || "20", 10) / 5)),
    unit: "overs each",
    hint: "suggested from your overs per innings, editable"
  }), /*#__PURE__*/React.createElement(NullableNumberRule, {
    label: "Powerplay",
    value: rules.powerplayOvers,
    onChange: v => setRules(r => ({
      ...r,
      powerplayOvers: v
    })),
    seed: (() => {
      const n = parseInt(oversLimit || "20", 10);
      return Math.min(n, n <= 20 ? 6 : Math.round(n / 5));
    })(),
    unit: "overs",
    hint: "at the start of each innings, shown as a badge while it's in effect"
  }), /*#__PURE__*/React.createElement(NullableNumberRule, {
    label: "Time cap per innings",
    value: rules.timeCapMinutes,
    onChange: v => setRules(r => ({
      ...r,
      timeCapMinutes: v
    })),
    seed: Math.max(10, Math.round(parseInt(oversLimit || "20", 10) * 4.5)),
    unit: "minutes",
    hint: "a flag once you're past it, not a stop"
  }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Batting rules"
  }), /*#__PURE__*/React.createElement(NullableNumberRule, {
    label: "Retirement run cap",
    value: rules.retirementRuns,
    onChange: v => setRules(r => ({
      ...r,
      retirementRuns: v
    })),
    seed: 25,
    unit: "runs — must retire",
    hint: "a batsman reaching this is prompted to retire (not out)"
  }), /*#__PURE__*/React.createElement(NullableNumberRule, {
    label: "Big hit bonus",
    value: rules.bigHitRuns,
    onChange: v => setRules(r => ({
      ...r,
      bigHitRuns: v
    })),
    seed: 10,
    unit: "runs on a big hit",
    hint: "a six clearing your ground's extra-distance boundary rope scores this many instead of the standard 6"
  }), /*#__PURE__*/React.createElement(NullableNumberRule, {
    label: "Maximum hit bonus",
    value: rules.maxHitRuns,
    onChange: v => setRules(r => ({
      ...r,
      maxHitRuns: v
    })),
    seed: 15,
    unit: "runs on a maximum hit",
    hint: "a second, independent bonus-hit tier -- use it however suits your ground (e.g. an even longer boundary than Big Hit above)"
  }), /*#__PURE__*/React.createElement(RuleSectionHeader, {
    label: "Special rules"
  }), /*#__PURE__*/React.createElement(ToggleRule, {
    label: "Super Over if the match ties",
    value: rules.superOver,
    onChange: v => setRules(r => ({
      ...r,
      superOver: v
    }))
  }), /*#__PURE__*/React.createElement(ToggleRule, {
    label: "Wide/no-ball counts as a ball",
    value: rules.wideNoballCountsAsBall,
    onChange: v => setRules(r => ({
      ...r,
      wideNoballCountsAsBall: v
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      border: `1px solid ${COLORS.creamDark}`,
      background: COLORS.cream
    }
  }, /*#__PURE__*/React.createElement(ToggleRule, {
    label: "Last over rules",
    value: rules.lastOverRules && rules.lastOverRules.enabled,
    onChange: v => setRules(r => ({
      ...r,
      lastOverRules: { ...(r.lastOverRules || {}), enabled: v }
    }))
  }), rules.lastOverRules && rules.lastOverRules.enabled && /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Applies to the last",
    value: rules.lastOverRules.overCount || 1,
    onChange: v => setRules(r => ({
      ...r,
      lastOverRules: { ...(r.lastOverRules || {}), overCount: v }
    })),
    options: [1, 2, 3, 4, 5].map(n => ({
      value: n,
      label: n === 1 ? "1 over" : `${n} overs`
    }))
  }), rules.lastOverRules && rules.lastOverRules.enabled && rules.wideNoballCountsAsBall && /*#__PURE__*/React.createElement(ToggleRule, {
    label: "Wide/no-ball illegal again in the last over(s)",
    value: rules.lastOverRules.wideNoballIllegalAgain,
    onChange: v => setRules(r => ({
      ...r,
      lastOverRules: { ...(r.lastOverRules || {}), wideNoballIllegalAgain: v }
    }))
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      border: `1px solid ${COLORS.creamDark}`,
      background: COLORS.cream
    }
  }, /*#__PURE__*/React.createElement(ToggleRule, {
    label: "Impact Player substitution",
    value: rules.impactPlayerEnabled,
    onChange: v => setRules(r => ({
      ...r,
      impactPlayerEnabled: v
    }))
  }), rules.impactPlayerEnabled && /*#__PURE__*/React.createElement(RuleChoice, {
    label: "Substitutions allowed per team",
    value: rules.impactPlayerMaxSubs,
    onChange: v => setRules(r => ({
      ...r,
      impactPlayerMaxSubs: v
    })),
    options: [{
      value: 1,
      label: "1 (standard)"
    }, {
      value: 2,
      label: "2"
    }, {
      value: 3,
      label: "3"
    }]
  })));
}
