// A grab-bag of small, pure, standalone helpers (src/core/miscHelpers.js).

import test from "node:test";
import assert from "node:assert/strict";
import {
  isFeedbackAdmin, genMatchCode, expiresAtMillis, inviteExpiryLabel,
  formatAddressLabel, weatherCodeInfo,
  parseCsvLine, parseBulkPlayers, normalizeEmail, isClubOwner, isFederationOwner,
  relativeDayLabel, greetingPrefix, tournamentStatus, tournamentDateRangeLabel,
  playerInitials, playerAvatarColor, parseOverLabel, ballLabelsForOver,
  buildClaudeFixPrompt, accountExistsLinkInfo, friendlyEmailAuthError,
  getFollowCodeFromUrl, getTournamentFollowCodeFromUrl, getPollCodeFromUrl,
  getShortcutActionFromUrl, getAuthActionFromUrl
} from "../../src/core/miscHelpers.js";

test("isFeedbackAdmin: matches the hardcoded admin email case-insensitively, false for anyone/anything else", () => {
  assert.equal(isFeedbackAdmin({ email: "RobinSinghRajawat@gmail.com" }), true);
  assert.equal(isFeedbackAdmin({ email: "someone@example.com" }), false);
  assert.equal(isFeedbackAdmin(null), false);
});

test("genMatchCode: 8 characters, only from the unambiguous alphabet (no 0/O/1/I)", () => {
  const code = genMatchCode();
  assert.equal(code.length, 8);
  assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
});

test("expiresAtMillis: accepts a plain millis number or a Firestore-Timestamp-shaped object", () => {
  assert.equal(expiresAtMillis(null), null);
  assert.equal(expiresAtMillis(12345), 12345);
  assert.equal(expiresAtMillis({ toMillis: () => 6789 }), 6789);
});

test("inviteExpiryLabel: Expired / Expires tomorrow / Expires in Nd, null with nothing to compute from", () => {
  assert.equal(inviteExpiryLabel(null), null);
  assert.equal(inviteExpiryLabel(Date.now() - 1000), "Expired");
  assert.equal(inviteExpiryLabel(Date.now() + 23 * 60 * 60 * 1000), "Expires tomorrow");
  assert.equal(inviteExpiryLabel(Date.now() + 4 * 24 * 60 * 60 * 1000 + 1000), "Expires in 5d");
});

test("formatAddressLabel: falls back to display_name when fewer than 2 address parts are known", () => {
  assert.equal(formatAddressLabel({ address: {}, display_name: "Somewhere, Nowhere" }), "Somewhere, Nowhere");
});

test("formatAddressLabel: leads with the named entity when it differs from the street", () => {
  const r = { name: "The Green", address: { road: "Main St", city: "Anytown", country: "UK" }, display_name: "ignored" };
  assert.equal(formatAddressLabel(r), "The Green, Main St, Anytown, UK");
});

test("weatherCodeInfo: known WMO code returns its label, unknown falls back to a placeholder", () => {
  assert.equal(weatherCodeInfo(0).label, "Clear");
  assert.equal(weatherCodeInfo(9999).label, "—");
});

test("parseCsvLine: splits on commas, handles quoted fields with embedded commas and doubled quotes", () => {
  assert.deepEqual(parseCsvLine("a,b,c"), ["a", "b", "c"]);
  assert.deepEqual(parseCsvLine('a,"b,c",d'), ["a", "b,c", "d"]);
  assert.deepEqual(parseCsvLine('a,"say ""hi""",c'), ["a", 'say "hi"', "c"]);
});

test("parseBulkPlayers: tab-separated with a header row, columns in any order", () => {
  const text = "Name\tRole\tTeam\nRohit Sharma (C)\tBatsman\tIndia";
  const rows = parseBulkPlayers(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Rohit Sharma");
  assert.equal(rows[0].role, "batsman");
  assert.equal(rows[0].team, "India");
  assert.equal(rows[0].isCaptainNote, true);
});

test("parseBulkPlayers: no header falls back to Name/Role/Team/ID positional order, drops a leading index", () => {
  const text = "1\tMS Dhoni (C/WK)\tKeeper\tChennai\t4190964";
  const rows = parseBulkPlayers(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "MS Dhoni");
  assert.equal(rows[0].isCaptainNote, true);
  assert.equal(rows[0].isKeeperNote, true);
});

test("parseBulkPlayers: skips a bare federation title row and blank lines", () => {
  const text = "Dansk Cricket Forbund\n\nName\tRole\nP1\tBatsman";
  const rows = parseBulkPlayers(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "P1");
});

test("normalizeEmail: trims and lowercases", () => {
  assert.equal(normalizeEmail("  Foo@BAR.com  "), "foo@bar.com");
  assert.equal(normalizeEmail(null), "");
});

test("isClubOwner/isFederationOwner: true for the owner or a co-owner, false otherwise", () => {
  const club = { ownerUid: "u1", coOwnerUids: ["u2"] };
  assert.equal(isClubOwner(club, "u1"), true);
  assert.equal(isClubOwner(club, "u2"), true);
  assert.equal(isClubOwner(club, "u3"), false);
  assert.equal(isClubOwner(null, "u1"), false);
  const federation = { createdBy: "u1", coOwnerUids: [] };
  assert.equal(isFederationOwner(federation, "u1"), true);
  assert.equal(isFederationOwner(federation, "u2"), false);
});

test("relativeDayLabel: Today / Yesterday / weekday-and-date, year appended only if not this year", () => {
  const now = Date.now();
  assert.equal(relativeDayLabel(now), "Today");
  assert.equal(relativeDayLabel(now - 24 * 60 * 60 * 1000), "Yesterday");
  assert.equal(relativeDayLabel(null), null);
});

test("greetingPrefix: returns one of the three time-of-day greetings", () => {
  assert.ok(["Good morning", "Good afternoon", "Good evening"].includes(greetingPrefix()));
});

test("tournamentStatus: upcoming with no fixtures or none played, ongoing partway, completed once all are", () => {
  assert.equal(tournamentStatus({ fixtures: [] }), "upcoming");
  assert.equal(tournamentStatus({ fixtures: [{ matchId: null }, { matchId: null }] }), "upcoming");
  assert.equal(tournamentStatus({ fixtures: [{ matchId: "m1" }, { matchId: null }] }), "ongoing");
  assert.equal(tournamentStatus({ fixtures: [{ matchId: "m1" }, { matchId: "m2" }] }), "completed");
});

test("tournamentDateRangeLabel: spans earliest to latest scheduled fixture date", () => {
  const t = { fixtures: [{ date: "2026-07-20T11:00" }, { date: "2026-06-12T11:00" }] };
  assert.equal(tournamentDateRangeLabel(t), "12 Jun – 20 Jul");
});

test("tournamentDateRangeLabel: falls back to a relative 'Created N days ago' with no dated fixtures", () => {
  const t = { fixtures: [], createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000 };
  assert.equal(tournamentDateRangeLabel(t), "Created 3 days ago");
  assert.equal(tournamentDateRangeLabel({ fixtures: [] }), null);
});

test("playerInitials: first+last initial for a full name, single initial for one name, ? for empty", () => {
  assert.equal(playerInitials("Rohit Sharma"), "RS");
  assert.equal(playerInitials("Rohit"), "R");
  assert.equal(playerInitials(""), "?");
});

test("playerAvatarColor: deterministic (same name always the same color), from the preset palette", () => {
  const c1 = playerAvatarColor("Rohit Sharma");
  const c2 = playerAvatarColor("Rohit Sharma");
  assert.equal(c1, c2);
  assert.match(c1, /^#[0-9a-f]{6}$/);
});

test("parseOverLabel: cricket X.Y notation to a true decimal using ballsPerOver", () => {
  assert.equal(parseOverLabel("4.3", 6), 4.5);
  assert.equal(parseOverLabel("4", 6), 4);
});

test("ballLabelsForOver: legal balls increment the label, wide/no-ball share the next legal ball's number", () => {
  const balls = [
    { kind: "run" },
    { kind: "wide" },
    { kind: "run" }
  ];
  assert.deepEqual(ballLabelsForOver(0, balls), ["1.1", "1.2*", "1.2"]);
});

test("buildClaudeFixPrompt: includes the message, page/browser context, and a resolution note when present", () => {
  const prompt = buildClaudeFixPrompt({ kind: "error", message: "Crash on save", url: "/match/1", createdAt: Date.now(), resolutionNote: "Happens on iOS only" });
  assert.match(prompt, /user-reported crash/);
  assert.match(prompt, /"Crash on save"/);
  assert.match(prompt, /Page: \/match\/1/);
  assert.match(prompt, /Happens on iOS only/);
});

test("accountExistsLinkInfo: extracts email/credential only for the specific account-exists error code", () => {
  assert.equal(accountExistsLinkInfo({ code: "auth/wrong-password" }), null);
  const info = accountExistsLinkInfo({ code: "auth/account-exists-with-different-credential", email: "a@b.com", credential: "cred" });
  assert.deepEqual(info, { email: "a@b.com", credential: "cred" });
});

test("friendlyEmailAuthError: maps known Firebase Auth codes to user-facing copy, falls back to err.message", () => {
  assert.match(friendlyEmailAuthError({ code: "auth/weak-password" }), /at least 6 characters/);
  assert.match(friendlyEmailAuthError({ code: "auth/user-not-found" }), /didn't match/);
  assert.match(friendlyEmailAuthError({ code: "auth/wrong-password" }), /didn't match/);
  assert.equal(friendlyEmailAuthError({ code: "auth/something-unmapped", message: "raw message" }), "raw message");
  assert.equal(friendlyEmailAuthError({ code: "auth/something-unmapped" }), "Something went wrong.");
});

test("getFollowCodeFromUrl and friends: fall back to null when window isn't available (as in Node)", () => {
  assert.equal(getFollowCodeFromUrl(), null);
  assert.equal(getTournamentFollowCodeFromUrl(), null);
  assert.equal(getPollCodeFromUrl(), null);
  assert.equal(getShortcutActionFromUrl(), null);
  assert.equal(getAuthActionFromUrl(), null);
});
