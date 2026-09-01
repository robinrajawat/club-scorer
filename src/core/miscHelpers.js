import { ISO_DATETIME_RE } from "./shareAndFormat.js";
import { uid } from "./statsAndFixtures.js";

// A grab-bag of small, pure, standalone helpers scattered through docs/index.html's React
// components: admin-email checks, match/invite codes, address/weather formatting, CSV parsing for
// bulk player import, club/federation ownership checks, date labels, tournament status, player
// avatars, and over-label parsing. No Firestore, no DOM. Covered by
// tests/unit/miscHelpers.test.js.

export const FEEDBACK_ADMIN_EMAIL = "robinsinghrajawat@gmail.com";

export function isFeedbackAdmin(user) {
  return !!user && !!user.email && user.email.toLowerCase() === FEEDBACK_ADMIN_EMAIL;
}

export function genMatchCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export function expiresAtMillis(expiresAt) {
  if (!expiresAt) return null;
  return typeof expiresAt === "number" ? expiresAt : expiresAt.toMillis();
}

export function inviteExpiryLabel(expiresAt) {
  const ms = expiresAtMillis(expiresAt);
  if (ms == null) return null;
  const daysLeft = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return "Expired";
  if (daysLeft === 1) return "Expires tomorrow";
  return `Expires in ${daysLeft}d`;
}

export function formatAddressLabel(r) {
  const addr = r.address || {};
  const street = [addr.road, addr.house_number].filter(Boolean).join(" ");
  const locality = addr.city || addr.town || addr.village || addr.municipality || addr.county;
  const cityLine = [addr.postcode, locality].filter(Boolean).join(" ");
  const addressParts = [street, cityLine, addr.country].filter(Boolean);
  if (addressParts.length < 2) return r.display_name;
  const simplified = addressParts.join(", ");
  // r.name is the actual named entity Nominatim matched (a ground, club, business, landmark) when
  // the search hit one, distinct from the interpolated street address above -- worth leading with
  // for a venue search specifically, so picking a result shows what's actually there, not just its
  // street address with nothing to confirm it's the right place.
  return r.name && r.name !== street ? `${r.name}, ${simplified}` : simplified;
}

export const WMO_WEATHER_CODES = {
  0: { emoji: "\u2600\uFE0F", label: "Clear" },
  1: { emoji: "\uD83C\uDF24\uFE0F", label: "Mostly clear" },
  2: { emoji: "\u26C5", label: "Partly cloudy" },
  3: { emoji: "\u2601\uFE0F", label: "Overcast" },
  45: { emoji: "\uD83C\uDF2B\uFE0F", label: "Fog" },
  48: { emoji: "\uD83C\uDF2B\uFE0F", label: "Fog" },
  51: { emoji: "\uD83C\uDF26\uFE0F", label: "Light drizzle" },
  53: { emoji: "\uD83C\uDF26\uFE0F", label: "Drizzle" },
  55: { emoji: "\uD83C\uDF26\uFE0F", label: "Heavy drizzle" },
  56: { emoji: "\uD83C\uDF27\uFE0F", label: "Freezing drizzle" },
  57: { emoji: "\uD83C\uDF27\uFE0F", label: "Freezing drizzle" },
  61: { emoji: "\uD83C\uDF27\uFE0F", label: "Light rain" },
  63: { emoji: "\uD83C\uDF27\uFE0F", label: "Rain" },
  65: { emoji: "\uD83C\uDF27\uFE0F", label: "Heavy rain" },
  66: { emoji: "\uD83C\uDF27\uFE0F", label: "Freezing rain" },
  67: { emoji: "\uD83C\uDF27\uFE0F", label: "Freezing rain" },
  71: { emoji: "\uD83C\uDF28\uFE0F", label: "Light snow" },
  73: { emoji: "\uD83C\uDF28\uFE0F", label: "Snow" },
  75: { emoji: "\uD83C\uDF28\uFE0F", label: "Heavy snow" },
  77: { emoji: "\uD83C\uDF28\uFE0F", label: "Snow grains" },
  80: { emoji: "\uD83C\uDF26\uFE0F", label: "Rain showers" },
  81: { emoji: "\uD83C\uDF26\uFE0F", label: "Rain showers" },
  82: { emoji: "\uD83C\uDF27\uFE0F", label: "Heavy showers" },
  85: { emoji: "\uD83C\uDF28\uFE0F", label: "Snow showers" },
  86: { emoji: "\uD83C\uDF28\uFE0F", label: "Snow showers" },
  95: { emoji: "\u26C8\uFE0F", label: "Thunderstorm" },
  96: { emoji: "\u26C8\uFE0F", label: "Thunderstorm" },
  99: { emoji: "\u26C8\uFE0F", label: "Thunderstorm" }
};

export function weatherCodeInfo(code) {
  return WMO_WEATHER_CODES[code] || { emoji: "\uD83C\uDF21\uFE0F", label: "\u2014" };
}

export function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function parseBulkPlayers(text) {
  const ROLE_SYNONYMS = {
    "batsman": "batsman",
    "bat": "batsman",
    "batter": "batsman",
    "bowler": "bowler",
    "bowl": "bowler",
    "all rounder": "allrounder",
    "all-rounder": "allrounder",
    "allrounder": "allrounder",
    "wicket keeper": "batsman",
    "wicketkeeper": "batsman",
    "keeper": "batsman",
    "wk": "batsman"
  };
  const CAPTAIN_MARKERS = new Set(["c", "capt", "captain"]);
  const KEEPER_MARKERS = new Set(["wk", "keeper", "wicket keeper", "wicketkeeper"]);
  const NAME_ALIASES = new Set(["name", "player", "player name"]);
  const ROLE_ALIASES = new Set(["role", "player role"]);
  const TEAM_ALIASES = new Set(["team", "division", "age group", "squad"]);
  const ID_ALIASES = new Set(["id", "player id", "external id", "reg", "reg no", "reg no.", "registration", "registration no"]);

  // Returns {name, role, team, id} column indices if `cells` looks like a header row, else null.
  // Deliberately excludes "No"/"No." from the Name aliases -- that's the index column, not the
  // name column, and the federation template's header has both ("No", "Player Name") in the same
  // row; conflating them would point the name field at the index column instead. Only the Name
  // column is required to recognize a row as a header at all -- Role/Team/ID are picked up
  // opportunistically if present, in whatever order they appear, so a re-arranged or reduced
  // column set still works.
  function detectHeaderMap(cells) {
    const lower = cells.map(c => c.trim().toLowerCase());
    const nameIdx = lower.findIndex(c => NAME_ALIASES.has(c));
    if (nameIdx === -1) return null;
    const map = { name: nameIdx };
    const roleIdx = lower.findIndex(c => ROLE_ALIASES.has(c));
    if (roleIdx !== -1) map.role = roleIdx;
    const teamIdx = lower.findIndex(c => TEAM_ALIASES.has(c));
    if (teamIdx !== -1) map.team = teamIdx;
    const idIdx = lower.findIndex(c => ID_ALIASES.has(c));
    if (idIdx !== -1) map.id = idIdx;
    return map;
  }

  // Reads a trailing "(...)" off a cell's text, classifying its content as a captain marker, a
  // keeper marker, or (if neither) a raw ID candidate. Applied to both Name and Role cells so a
  // marker placed on either one is still caught.
  function extractParen(raw) {
    const m = (raw || "").match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (!m) return { text: (raw || "").trim(), isCaptain: false, isKeeper: false, idCandidate: "" };
    const parts = m[2].toLowerCase().split(/[\/,&]+/).map(s => s.trim()).filter(Boolean);
    const isCaptain = parts.some(p => CAPTAIN_MARKERS.has(p));
    const isKeeper = parts.some(p => KEEPER_MARKERS.has(p));
    return {
      text: m[1].trim(),
      isCaptain,
      isKeeper,
      idCandidate: !isCaptain && !isKeeper ? m[2].trim() : ""
    };
  }

  const lines = (text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  let columnMap = null;
  for (const line of lines) {
    const cells = (line.includes("\t") ? line.split("\t") : parseCsvLine(line)).map(c => c.trim().replace(/^\uFEFF/, ""));
    if (cells.length === 0 || cells.every(c => !c)) continue;
    if (cells.slice(1).every(c => !c) && /^dansk cricket forbund$/i.test(cells[0])) continue; // title row, not data

    const detectedMap = detectHeaderMap(cells);
    if (detectedMap) {
      columnMap = detectedMap;
      continue; // this line IS the header, not a player
    }

    let rawName, rawRole, rawTeam, rawId;
    if (columnMap) {
      rawName = cells[columnMap.name] || "";
      rawRole = columnMap.role !== undefined ? cells[columnMap.role] || "" : "";
      rawTeam = columnMap.team !== undefined ? cells[columnMap.team] || "" : "";
      rawId = columnMap.id !== undefined ? cells[columnMap.id] || "" : "";
    } else {
      // No header seen yet in this paste -- fall back to the federation template's own fixed
      // column order. A leading index column is dropped whether it's a bare "12" or the "12."
      // style some spreadsheet exports use for a numbered list.
      const withoutIndex = /^\d+\.?$/.test(cells[0]) ? cells.slice(1) : cells;
      if (withoutIndex.length === 0 || !withoutIndex[0]) continue;
      rawName = withoutIndex[0];
      rawRole = withoutIndex[1] || "";
      rawTeam = withoutIndex[2] || "";
      rawId = withoutIndex[3] || "";
    }
    if (!rawName.trim()) continue;

    const nameParsed = extractParen(rawName);
    const roleParsed = extractParen(rawRole);
    const name = nameParsed.text;
    if (!name) continue;
    const isCaptainNote = nameParsed.isCaptain || roleParsed.isCaptain;
    const isKeeperNoteFromParen = nameParsed.isKeeper || roleParsed.isKeeper;
    const regNo = rawId.trim() || nameParsed.idCandidate || roleParsed.idCandidate;
    const roleKey = roleParsed.text.toLowerCase();
    rows.push({
      name,
      role: ROLE_SYNONYMS[roleKey] || "",
      team: rawTeam.trim(),
      isKeeperNote: /keeper|\bwk\b/.test(roleKey) || isKeeperNoteFromParen,
      isCaptainNote,
      regNo,
      _key: uid()
    });
  }
  return rows;
}

export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export function isClubOwner(club, uid) {
  return !!club && !!uid && (club.ownerUid === uid || (club.coOwnerUids || []).includes(uid));
}

export function isFederationOwner(federation, uid) {
  return !!federation && !!uid && (federation.createdBy === uid || (federation.coOwnerUids || []).includes(uid));
}

export const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function relativeDayLabel(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  const startOf = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const base = `${SHORT_WEEKDAYS[d.getDay()]}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function tournamentStatus(t) {
  const fixtures = t.fixtures || [];
  if (fixtures.length === 0) return "upcoming";
  const playedCount = fixtures.filter(f => f.matchId).length;
  if (playedCount === 0) return "upcoming";
  if (playedCount === fixtures.length) return "completed";
  return "ongoing";
}

export function tournamentDateRangeLabel(t) {
  const dates = (t.fixtures || []).filter(f => ISO_DATETIME_RE.test(f.date || "")).map(f => f.date.slice(0, 10)).sort();
  if (dates.length === 0) {
    if (!t.createdAt) return null;
    const days = Math.floor((Date.now() - t.createdAt) / 86400000);
    if (days <= 0) return "Created today";
    if (days === 1) return "Created yesterday";
    return `Created ${days} days ago`;
  }
  const fmt = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${SHORT_MONTHS[m - 1]}`;
  };
  const first = dates[0],
    last = dates[dates.length - 1];
  return first === last ? fmt(first) : `${fmt(first)} \u2013 ${fmt(last)}`;
}

export const TEAM_COLOR_PRESETS = ["#1b3a6b", "#7a1f2b", "#1f5c3a", "#c9a227", "#2d7dd2", "#d2691e", "#6a3d9a", "#2b2b2b", "#c0392b", "#16a085"];

export function playerInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function playerAvatarColor(name) {
  const s = name || "";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return TEAM_COLOR_PRESETS[hash % TEAM_COLOR_PRESETS.length];
}

export function parseOverLabel(label, ballsPerOver) {
  const [whole, balls] = String(label).split(".").map(Number);
  return whole + (balls || 0) / (ballsPerOver || 6);
}

export function ballLabelsForOver(overIndex, balls) {
  let legalCount = 0;
  return balls.map(ev => {
    const isLegal = ev.kind !== "wide" && ev.kind !== "noball";
    if (isLegal) legalCount += 1;
    return `${overIndex + 1}.${legalCount + (isLegal ? 0 : 1)}`;
  });
}
