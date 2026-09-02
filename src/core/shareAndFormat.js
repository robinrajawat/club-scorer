import { DEFAULT_RULES, maxWicketsFor } from "./appLogic.js";
import { oversLabel } from "./scoringEngine.js";

// Fixture date/time parsing & formatting, .ics calendar export, CSV export, and match/poll
// share-text & URL builders. Pure logic — no Firestore. buildPollUrl/buildFollowUrl read
// window.location in the browser but fall back to a relative URL (via try/catch) anywhere that
// isn't available, including Node, so they're still meaningfully testable here; that fallback
// branch is what tests/unit/shareAndFormat.test.js exercises. Covered by
// tests/unit/shareAndFormat.test.js.

export const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export const FIXTURE_DEFAULT_HOUR = 11; // most club fixtures kick off mid-morning, so this is the sane default rather than midnight

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function parseFixtureDateTime(iso) {
  if (ISO_DATETIME_RE.test(iso)) {
    const [datePart, timePart] = iso.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    let hour12 = hh % 12;
    if (hour12 === 0) hour12 = 12;
    return {
      year: y,
      month: m - 1,
      day: d,
      hour12,
      minute: pad2(mm),
      period: hh >= 12 ? "PM" : "AM"
    };
  }
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: null,
    hour12: FIXTURE_DEFAULT_HOUR,
    minute: "00",
    period: "AM"
  };
}

export function buildFixtureIso(year, month, day, hour12, minute, period) {
  if (!day) return "";
  let hh = hour12 % 12;
  if (period === "PM") hh += 12;
  return `${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(hh)}:${minute}`;
}

export function formatFixtureDateTime(iso) {
  if (!ISO_DATETIME_RE.test(iso)) return null;
  const [datePart, timePart] = iso.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
  let hour12 = hh % 12;
  if (hour12 === 0) hour12 = 12;
  const period = hh >= 12 ? "PM" : "AM";
  return `${dateLabel} \u00b7 ${hour12}:${pad2(mm)} ${period}`;
}

export function icsEscape(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function icsLocalDateTime(iso) {
  return iso.replace(/[-:]/g, "").slice(0, 15) + "00"; // YYYY-MM-DDTHH:MM -> YYYYMMDDTHHMM + seconds
}

export function fixtureIcsEvent(f, stamp, contextName, venue, lat, lng) {
  const start = icsLocalDateTime(f.date);
  // Two-hour placeholder duration — the app has no fixed match length independent of overs/
  // format, and this is just meant to block a calendar slot, not predict a finish time exactly.
  const [datePart, timePart] = f.date.split("T");
  const startDate = new Date(`${datePart}T${timePart}:00`);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const end = icsLocalDateTime(`${endDate.getFullYear()}-${pad2(endDate.getMonth() + 1)}-${pad2(endDate.getDate())}T${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`);
  const lines = ["BEGIN:VEVENT", `UID:${f.id}@cricket-scorer`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsEscape(`${f.teamA} vs ${f.teamB}`)}`, `DESCRIPTION:${icsEscape(`${contextName} fixture`)}`];
  if (venue) lines.push(`LOCATION:${icsEscape(venue)}`);
  // GEO is a separate, standard ICS property some calendar apps use to offer their own "open in
  // maps" action -- worth including whenever we have coordinates, venue text or not.
  if (lat != null && lng != null) lines.push(`GEO:${lat};${lng}`);
  lines.push("END:VEVENT");
  return lines;
}

export function buildTournamentICS(tournament) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Club Scorer//Tournament Export//EN", "CALSCALE:GREGORIAN"];
  (tournament.fixtures || []).forEach(f => {
    if (!ISO_DATETIME_RE.test(f.date || "")) return; // skip fixtures with no scheduled time
    // A fixture's own venue overrides the tournament's default -- same fallback UpcomingFixtureCard
    // uses, so exporting the whole schedule doesn't flatten every match back onto one ground.
    const venue = f.venue || tournament.venue;
    const venueLat = f.venue ? f.venueLat : tournament.venueLat;
    const venueLng = f.venue ? f.venueLng : tournament.venueLng;
    lines.push(...fixtureIcsEvent(f, stamp, tournament.name, venue, venueLat, venueLng));
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function buildFixtureICS(fixture, contextName, venue, lat, lng) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Club Scorer//Tournament Export//EN", "CALSCALE:GREGORIAN", ...fixtureIcsEvent(fixture, stamp, contextName, venue, lat, lng), "END:VCALENDAR"];
  return lines.join("\r\n");
}

export function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers, rows) {
  const lines = [headers.map(csvCell).join(","), ...rows.map(r => r.map(csvCell).join(","))];
  return "\uFEFF" + lines.join("\r\n");
}

export function multiSectionCSV(sections) {
  const lines = [];
  sections.forEach((sec, i) => {
    if (i > 0) lines.push("");
    lines.push(csvCell(sec.title));
    lines.push(sec.headers.map(csvCell).join(","));
    sec.rows.forEach(r => lines.push(r.map(csvCell).join(",")));
  });
  return "\uFEFF" + lines.join("\r\n");
}

export function safeFilenamePart(name) {
  return String(name || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "export";
}

export const POLL_TTL_DAYS = 120;

// Deliberately silent on maxOversPerBowler, unlike every other field here: SetupScreen defaults
// it to Math.ceil(oversLimit / 5) for every new match (the standard "no bowler bowls more than a
// fifth of the innings" law), so it's non-null on essentially every match, standard or not --
// including it here would make "silent when standard" never actually fire.
export function nonStandardRulesText(rules) {
  if (!rules) return null;
  const bits = [];
  if (rules.ballsPerOver && rules.ballsPerOver !== DEFAULT_RULES.ballsPerOver) bits.push(`${rules.ballsPerOver}-ball overs`);
  if (rules.wideRuns && rules.wideRuns !== DEFAULT_RULES.wideRuns) bits.push(`${rules.wideRuns} runs on a wide`);
  if (rules.noballRuns && rules.noballRuns !== DEFAULT_RULES.noballRuns) bits.push(`${rules.noballRuns} runs on a no-ball`);
  if (rules.freeHit) bits.push("Free Hit enabled");
  if (rules.superOver) bits.push("Super Over on a tie");
  if (rules.powerplayOvers) bits.push(`${rules.powerplayOvers}-over powerplay`);
  if (rules.timeCapMinutes) bits.push(`${rules.timeCapMinutes}-min innings target`);
  if (rules.retirementRuns) bits.push(`retire at ${rules.retirementRuns}`);
  if (rules.bigHitRuns) bits.push(`big hit bonus (${rules.bigHitRuns} runs on the long boundary)`);
  if (rules.wideNoballCountsAsBall) {
    const lor = rules.lastOverRules;
    const revertsInLastOvers = lor && lor.enabled && lor.wideNoballIllegalAgain;
    const lastOversLabel = revertsInLastOvers ? (lor.overCount > 1 ? `last ${lor.overCount} overs` : "last over") : null;
    bits.push(revertsInLastOvers ? `wide/no-ball counts as a ball (except the ${lastOversLabel})` : "wide/no-ball counts as a ball");
  }
  if (rules.impactPlayerEnabled) bits.push(rules.impactPlayerMaxSubs > 1 ? `Impact Player substitution (up to ${rules.impactPlayerMaxSubs} per team)` : "Impact Player substitution");
  return bits.length ? bits.join(" · ") : null;
}

// One line per Impact Player substitution actually made this match (match.impactSubs -- see
// confirmImpactSub in inningsSetupScreens.js), for the scorecard. null when none were made, same
// "nothing happened, don't render anything" convention as nonStandardRulesText.
export function impactSubsText(impactSubs) {
  if (!impactSubs || impactSubs.length === 0) return null;
  return impactSubs.map(s => `${s.inName} on for ${s.outName} (${s.team})`).join(" · ");
}
export function tossText(toss) {
  if (!toss || !toss.wonBy) return null;
  return toss.decision ? `${toss.wonBy} won the toss, chose to ${toss.decision.toLowerCase()}` : `${toss.wonBy} won the toss`;
}

export function umpiresText(match) {
  const names = [match.umpire1, match.umpire2].filter(Boolean);
  if (names.length === 0) return null;
  return `Umpire${names.length === 1 ? "" : "s"}: ${names.join(", ")}`;
}

export function matchResultText(match) {
  const [i1, i2] = match.innings;
  if (match.status !== "complete") return null;
  // Checked before the !i2 guard below deliberately -- "Abandon match" (declareNoResult) can be
  // used mid-way through the FIRST innings, before a second one has even been created, so a match
  // this happened to would otherwise hit `!i2` and return null, silently showing nothing at all
  // rather than "No result".
  if (match.noResult) return "No result";
  if (!i2) return null;
  // A revised target (declareRevisedTarget, mid-chase rain adjustment short of full DLS) changes
  // what "won"/"tied"/the runs margin actually mean -- i1.runs is still team 1's real, played
  // total, but it's no longer what team 2 was actually chasing, so every branch below needs to
  // compare against the target that was actually in play, not always i1.runs + 1.
  const target = match.revisedTarget != null ? match.revisedTarget : i1.runs + 1;
  if (i2.runs >= target) {
    const wicketsInHand = maxWicketsFor(match, i2) - i2.wickets;
    return `${i2.battingTeam} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`;
  } else if (i2.runs === target - 1) {
    return "Match tied";
  }
  const margin = target - 1 - i2.runs;
  return `${i1.battingTeam} won by ${margin} run${margin === 1 ? "" : "s"}`;
}

export function matchScoreLine(match) {
  if (!match || !match.innings || match.innings.length === 0) return null;
  if (match.status === "complete") return matchResultText(match);
  const inn = match.innings[match.currentInningIndex] || match.innings[match.innings.length - 1];
  if (!inn || !inn.battingOrder || inn.battingOrder.length === 0) return null;
  return `${inn.battingTeam} ${inn.runs}-${inn.wickets} (${oversLabel(inn.legalBalls, inn.ballsPerOver)} ov)`;
}

export function chasingInfo(match) {
  const inn = match.innings[1];
  if (!inn || inn.complete) return null;
  const target = match.revisedTarget != null ? match.revisedTarget : match.innings[0].runs + 1;
  const effectiveOversLimit = match.revisedOvers != null ? match.revisedOvers : match.oversLimit;
  const ballsLeft = effectiveOversLimit * (inn.ballsPerOver || 6) - inn.legalBalls;
  const runsNeeded = target - inn.runs;
  const reqRate = ballsLeft > 0 ? (runsNeeded / ballsLeft * (inn.ballsPerOver || 6)).toFixed(2) : null;
  return {
    target,
    ballsLeft,
    runsNeeded,
    reqRate
  };
}

export function buildShareText(match) {
  const lines = [`\uD83C\uDFCF ${match.teamA} vs ${match.teamB}`];
  const toss = tossText(match.toss);
  if (toss) lines.push(toss);
  match.innings.forEach(inn => {
    if (!inn.battingOrder || inn.battingOrder.length === 0) return;
    lines.push(`${inn.battingTeam}: ${inn.runs}-${inn.wickets} (${oversLabel(inn.legalBalls, inn.ballsPerOver)} ov)`);
  });
  if (match.status === "complete") {
    const result = matchResultText(match);
    if (result) lines.push(result);
    if (match.playerOfMatch) lines.push(`\u2B50 Player of the Match: ${match.playerOfMatch}`);
    if (match.bestFielder) lines.push(`\u{1F91A} Best Fielder: ${match.bestFielder}`);
  }
  if (match.shareCode) lines.push(`Match code: ${match.shareCode}`);
  return lines.join("\n");
}

export function buildFixtureShareText(tournamentName, fixture, venue) {
  const lines = [`\uD83C\uDFCF ${fixture.teamA} vs ${fixture.teamB}`];
  if (tournamentName) lines.push(tournamentName);
  const when = formatFixtureDateTime(fixture.date || "");
  if (when) lines.push(when);
  if (venue) lines.push(`\uD83D\uDCCD ${venue}`);
  return lines.join("\n");
}

export function pollExpiryDateLabel(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt + POLL_TTL_DAYS * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function buildMapsUrl(venue, lat, lng) {
  if (venue) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
  }
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=`;
}

export function resolvePollTeams(nameA, nameB, clubs, clubTeamsById) {
  const a = (nameA || "").toLowerCase();
  const b = (nameB || "").toLowerCase();
  const out = [];
  (clubs || []).forEach(club => {
    (clubTeamsById[club.id] || []).forEach(team => {
      if (team.name && (team.name.toLowerCase() === a || team.name.toLowerCase() === b)) {
        out.push({
          team,
          club
        });
      }
    });
  });
  return out;
}

export function buildPollUrl(code) {
  try {
    const {
      origin,
      pathname
    } = window.location;
    return `${origin}${pathname}?poll=${code}`;
  } catch (e) {
    return `?poll=${code}`;
  }
}

export function buildPollShareText(question, fixtureDate, code) {
  const lines = [question];
  if (fixtureDate) lines.push(fixtureDate);
  lines.push(buildPollUrl(code));
  return lines.join("\n");
}

export function buildFollowUrl(code) {
  try {
    const {
      origin,
      pathname
    } = window.location;
    return `${origin}${pathname}?follow=${code}`;
  } catch (e) {
    return `?follow=${code}`;
  }
}

export function buildLiveShareText(match, code) {
  const lines = [`\uD83C\uDFCF ${match.teamA} vs ${match.teamB}`];
  match.innings.forEach(inn => {
    if (!inn.battingOrder || inn.battingOrder.length === 0) return;
    lines.push(`${inn.battingTeam}: ${inn.runs}-${inn.wickets} (${oversLabel(inn.legalBalls, inn.ballsPerOver)} ov)`);
  });
  if (match.status === "complete") {
    const result = matchResultText(match);
    if (result) lines.push(result);
  } else {
    lines.push("Follow live \u2192");
  }
  lines.push(buildFollowUrl(code));
  return lines.join("\n");
}
