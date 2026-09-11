import { matchResultText } from "./shareAndFormat.js";
import { suggestPlayerOfMatch } from "./statsAndFixtures.js";
import { oversLabel } from "./scoringEngine.js";

// Deterministic, zero-cost match recap — built entirely from data the app already computes
// (matchResultText, suggestPlayerOfMatch, an innings' own milestones), no LLM call involved. This
// is the recap shown by default; the optional "Polish with AI" step (see worker/recap-worker.js)
// takes this exact string as its starting draft rather than reassembling the match from raw data
// itself, so the LLM is only ever rephrasing something already factually correct.

// The three helpers below are exported (not just called from buildMatchRecapDraft in the same
// file) purely so scripts/generate.js's splice pipeline can find and register each one by name --
// an unexported/unregistered top-level helper sitting ahead of the one registered export in a file
// gets silently dropped from public/index.html (see auditReachability's own comment in
// scripts/generate.js, and generate.test.js), which would have shipped buildMatchRecapDraft as a
// live ReferenceError. None of the three are meant to be used from outside this module otherwise.
export function inningsLine(inn) {
  const overs = oversLabel(inn.legalBalls, inn.ballsPerOver);
  const batters = Object.entries(inn.batsmen || {}).filter(([, b]) => (b.balls || 0) > 0 || (b.runs || 0) > 0).sort((a, b) => (b[1].runs || 0) - (a[1].runs || 0));
  const top = batters[0];
  const topLine = top ? `, led by ${top[0]}'s ${top[1].runs} (${top[1].balls})` : "";
  return `${inn.battingTeam} made ${inn.runs}/${inn.wickets} in ${overs} overs${topLine}`;
}

export function bestBowlingLine(inn) {
  const bowlers = Object.entries(inn.bowlers || {}).filter(([, b]) => (b.wickets || 0) > 0).sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs);
  if (!bowlers.length) return null;
  const [name, figures] = bowlers[0];
  return `${name} took ${figures.wickets}/${figures.runs} for ${inn.bowlingTeam}`;
}

// Milestones worth a callout in a short recap — hat-tricks and five-wicket hauls are the standout
// bowling moments; batting fifties/hundreds and big partnerships are covered by the top-scorer
// line above already, so only pull the bowling-side ones here to avoid repeating the same numbers
// twice in a two-paragraph recap.
export function standoutMilestones(match) {
  const lines = [];
  for (const inn of match.innings || []) {
    for (const m of inn.milestones || []) {
      if (m.type === "hatTrick" || m.type === "fiveFor") lines.push(m.text);
    }
  }
  return lines;
}

// Builds the plain-text recap draft for a completed match. Returns null for anything not actually
// finished (matchResultText's own contract) rather than guessing at an incomplete match.
export function buildMatchRecapDraft(match) {
  const result = matchResultText(match, null);
  if (result == null) return null;
  const [i1, i2] = match.innings;
  const sentences = [inningsLine(i1) + "."];
  if (i2) sentences.push(inningsLine(i2) + ".");
  const bowling = [i1, i2].filter(Boolean).map(bestBowlingLine).filter(Boolean);
  if (bowling.length) sentences.push(bowling.join(". ") + ".");
  for (const line of standoutMilestones(match)) sentences.push(line + ".");
  sentences.push(result + ".");
  const pom = suggestPlayerOfMatch(match);
  if (pom) sentences.push(`${pom} was named Player of the Match.`);
  return sentences.join(" ");
}
