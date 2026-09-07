#!/usr/bin/env node
// Admin-only maintenance CLI for bulk data cleanup across users -- mainly for clearing out test
// matches/tournaments. Uses the Firebase Admin SDK (a service-account key), which authenticates
// as a trusted server identity and bypasses Firestore security rules entirely. That's deliberate:
// it's the only way to reach across every user's private /users/{uid} subtree without loosening
// firestore.rules for the deployed app itself (see that file's isAppAdminAuth() comment for why an
// in-app "admin delete anything" screen was rejected in favor of this script). This file is never
// spliced into public/index.html and ships nothing to the client.
//
// ---- Getting a service-account key ----
// Firebase Console -> Project settings -> Service accounts -> Generate new private key. This
// downloads a JSON file with real, standing admin credentials for the whole project -- treat it
// like a root password: never commit it (the repo's .gitignore blocks the conventional filename
// patterns, but that's a safety net, not a guarantee), never share it, and revoke it from the same
// console page if it's ever exposed.
//
// ---- Every destructive command is dry-run by default ----
// Every command that can delete something prints exactly what it found -- ids, team names,
// dates, share/view codes, owner emails -- and changes NOTHING until you re-run the identical
// command with --confirm appended. Look at the dry-run output before adding --confirm. There is
// no pattern-matching "looks like test data" heuristic here on purpose -- you name the exact
// user/club/tournament, or you explicitly nuke everything; nothing is ever guessed at.
//
// ---- Usage ----
//   node scripts/admin-data-cleanup.js --key <path-to-service-account.json> <command> [args]
//
// (Or set GOOGLE_APPLICATION_CREDENTIALS to the key path instead of passing --key.)
//
// Commands:
//   list-users
//       Lists every signed-up Firebase Auth user (uid, email, created). Use this to find who owns
//       the data you're trying to clean up.
//
//   inspect <uid-or-email>
//       Read-only. Prints every match and personal tournament that account owns, with enough
//       detail to decide whether it's test data.
//
//   delete-user-data <uid-or-email> [--confirm]
//       Deletes every match and personal tournament owned by that account, plus their public
//       mirrors (sharedMatches/liveViews/liveMatches/tournamentViews/tournamentMatches+entries/
//       liveTournaments docs) -- the same set of documents the app's own deleteMatch()/
//       deleteTournamentShareData() clean up, just run from the server side for every doc at once
//       instead of one at a time from the browser. Without --confirm, only prints what would be
//       deleted.
//
//   list-club-tournaments <clubId>
//   list-federation-tournaments <federationId>
//       Read-only. Prints every tournament hosted by that club/federation.
//
//   delete-club-tournament <clubId> <tournamentId> [--confirm]
//   delete-federation-tournament <federationId> <tournamentId> [--confirm]
//       Deletes one club-hosted or federation-hosted tournament plus its public mirrors. Without
//       --confirm, only prints what would be deleted.
//
//   nuke-all [--confirm-phrase "DELETE ALL MATCHES AND TOURNAMENTS"]
//       Deletes EVERY match and EVERY tournament in the project (personal, club-hosted, and
//       federation-hosted) plus every public mirror collection listed above, across every user.
//       Deliberately does NOT touch clubs, teams, rosters, players, invites, feedback, or beta
//       tester data -- only the matches/tournaments data model and its mirrors. Without
//       --confirm-phrase, only prints counts of what would be deleted. With it, the phrase must
//       match NUKE_ALL_CONFIRM_PHRASE below exactly (copy-paste it from the dry-run output) --
//       this is not a flag you can fat-finger by accident.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

const NUKE_ALL_CONFIRM_PHRASE = "DELETE ALL MATCHES AND TOURNAMENTS";

function fail(message) {
  console.error(`\nError: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--key") { args.key = argv[++i]; }
    else if (a === "--confirm") { args.confirm = true; }
    else if (a === "--confirm-phrase") { args.confirmPhrase = argv[++i]; }
    else { args._.push(a); }
  }
  return args;
}

function initAdmin(args) {
  const keyPath = args.key || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    fail("No service-account key given. Pass --key <path-to-service-account.json> or set GOOGLE_APPLICATION_CREDENTIALS.");
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  } catch (e) {
    fail(`Couldn't read/parse service-account key at ${keyPath}: ${e.message}`);
  }
  const app = initializeApp({ credential: cert(serviceAccount) });
  return { db: getFirestore(app), auth: getAuth(app) };
}

async function resolveUser(auth, uidOrEmail) {
  try {
    return uidOrEmail.includes("@") ? await auth.getUserByEmail(uidOrEmail) : await auth.getUser(uidOrEmail);
  } catch (e) {
    fail(`No such user "${uidOrEmail}": ${e.message}`);
  }
}

// Deletes documents in batches of 450 (Firestore's hard limit is 500 writes per batch; leaving
// headroom rather than cutting it exactly at 500).
async function deleteRefs(db, refs) {
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + CHUNK)) batch.delete(ref);
    await batch.commit();
  }
}

function fmtMatch(m) {
  const bits = [`${m.teamA || "?"} vs ${m.teamB || "?"}`, `[${m.status || "unknown"}]`];
  if (m.updatedAt) bits.push(`updated ${new Date(m.updatedAt).toISOString()}`);
  if (m.shareCode) bits.push(`shareCode=${m.shareCode}`);
  if (m.viewCode) bits.push(`viewCode=${m.viewCode}`);
  if (m.tournamentId) bits.push(`tournamentId=${m.tournamentId}`);
  if (m.private) bits.push("[private]");
  return `  - ${m.id}  ${bits.join("  ")}`;
}

function fmtTournament(t) {
  const bits = [];
  if (t.shareCode) bits.push(`shareCode=${t.shareCode}`);
  if (t.private) bits.push("[private]");
  return `  - ${t.id}  "${t.name || "(unnamed)"}"${bits.length ? "  " + bits.join("  ") : ""}`;
}

async function loadUserMatches(db, uid) {
  const snap = await db.collection("users").doc(uid).collection("matches").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadUserTournaments(db, uid) {
  const doc = await db.collection("users").doc(uid).collection("meta").doc("tournaments").get();
  return doc.exists ? (doc.data().list || []) : [];
}

// Every doc a match/tournament's public mirrors could live in -- the exact set deleteMatch() and
// deleteTournamentShareData() clean up client-side in public/index.html, gathered here as
// DocumentReferences so the caller can print them before deciding to delete anything.
async function matchMirrorRefs(db, match) {
  const refs = [];
  if (match.shareCode) refs.push(db.collection("sharedMatches").doc(match.shareCode));
  if (match.viewCode) refs.push(db.collection("liveViews").doc(match.viewCode));
  refs.push(db.collection("liveMatches").doc(match.id));
  if (match.tournamentId) {
    refs.push(db.collection("tournamentMatches").doc(match.tournamentId).collection("entries").doc(match.id));
  }
  return refs;
}

async function tournamentMirrorRefs(db, tournamentId, shareCode) {
  const refs = [db.collection("tournamentMatches").doc(tournamentId), db.collection("liveTournaments").doc(tournamentId)];
  const entriesSnap = await db.collection("tournamentMatches").doc(tournamentId).collection("entries").get();
  refs.push(...entriesSnap.docs.map(d => d.ref));
  if (shareCode) refs.push(db.collection("tournamentViews").doc(shareCode));
  return refs;
}

async function cmdListUsers(ctx) {
  let pageToken;
  let count = 0;
  do {
    const page = await ctx.auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      count++;
      console.log(`  ${u.uid}  ${u.email || "(no email)"}  created ${u.metadata.creationTime}`);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`\n${count} user(s) total.`);
}

async function cmdInspect(ctx, uidOrEmail) {
  const user = await resolveUser(ctx.auth, uidOrEmail);
  const [matches, tournaments] = await Promise.all([loadUserMatches(ctx.db, user.uid), loadUserTournaments(ctx.db, user.uid)]);
  console.log(`\n${user.email || user.uid} (uid ${user.uid})`);
  console.log(`\nMatches (${matches.length}):`);
  matches.forEach(m => console.log(fmtMatch(m)));
  console.log(`\nPersonal tournaments (${tournaments.length}):`);
  tournaments.forEach(t => console.log(fmtTournament(t)));
}

async function cmdDeleteUserData(ctx, uidOrEmail, args) {
  const user = await resolveUser(ctx.auth, uidOrEmail);
  const [matches, tournaments] = await Promise.all([loadUserMatches(ctx.db, user.uid), loadUserTournaments(ctx.db, user.uid)]);

  const matchRefs = [...matches.map(m => ctx.db.collection("users").doc(user.uid).collection("matches").doc(m.id))];
  const mirrorRefs = (await Promise.all(matches.map(m => matchMirrorRefs(ctx.db, m)))).flat();
  const tournamentMirrorRefLists = await Promise.all(tournaments.map(t => tournamentMirrorRefs(ctx.db, t.id, t.shareCode)));
  const allTournamentMirrorRefs = tournamentMirrorRefLists.flat();

  console.log(`\n${args.confirm ? "Deleting" : "Would delete"} for ${user.email || user.uid} (uid ${user.uid}):`);
  console.log(`\nMatches (${matches.length}):`);
  matches.forEach(m => console.log(fmtMatch(m)));
  console.log(`\nPersonal tournaments (${tournaments.length}):`);
  tournaments.forEach(t => console.log(fmtTournament(t)));
  console.log(`\nPublic mirror documents (${mirrorRefs.length + allTournamentMirrorRefs.length}):`);
  [...mirrorRefs, ...allTournamentMirrorRefs].forEach(r => console.log(`  - ${r.path}`));

  if (!args.confirm) {
    console.log("\nDry run only -- nothing deleted. Re-run with --confirm to actually delete the above.");
    return;
  }

  await deleteRefs(ctx.db, [...matchRefs, ...mirrorRefs, ...allTournamentMirrorRefs]);
  if (tournaments.length > 0) {
    await ctx.db.collection("users").doc(user.uid).collection("meta").doc("tournaments").set({ list: [] });
  }
  console.log(`\nDone. Deleted ${matches.length} match(es) and ${tournaments.length} personal tournament(s), plus ${mirrorRefs.length + allTournamentMirrorRefs.length} mirror document(s).`);
}

async function loadHostedTournaments(db, hostCollection, hostId) {
  const snap = await db.collection(hostCollection).doc(hostId).collection("tournaments").get();
  return snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
}

async function cmdListHostedTournaments(ctx, hostCollection, hostId) {
  const tournaments = await loadHostedTournaments(ctx.db, hostCollection, hostId);
  console.log(`\nTournaments hosted by ${hostCollection}/${hostId} (${tournaments.length}):`);
  tournaments.forEach(t => console.log(fmtTournament(t)));
}

async function cmdDeleteHostedTournament(ctx, hostCollection, hostId, tournamentId, args) {
  const ref = ctx.db.collection(hostCollection).doc(hostId).collection("tournaments").doc(tournamentId);
  const doc = await ref.get();
  if (!doc.exists) fail(`No tournament ${tournamentId} under ${hostCollection}/${hostId}.`);
  const tournament = { id: doc.id, ...doc.data() };
  const mirrorRefs = await tournamentMirrorRefs(ctx.db, tournamentId, tournament.shareCode);

  console.log(`\n${args.confirm ? "Deleting" : "Would delete"}:`);
  console.log(fmtTournament(tournament));
  console.log(`\nPublic mirror documents (${mirrorRefs.length}):`);
  mirrorRefs.forEach(r => console.log(`  - ${r.path}`));

  if (!args.confirm) {
    console.log("\nDry run only -- nothing deleted. Re-run with --confirm to actually delete the above.");
    return;
  }

  await deleteRefs(ctx.db, [ref, ...mirrorRefs]);
  console.log("\nDone.");
}

// Full wipe of every match/tournament, personal, club-hosted, and federation-hosted, plus every
// public mirror collection -- but deliberately nothing else (clubs/teams/rosters/players/invites/
// feedback/beta-tester data are all untouched). Reads everything up front so the dry-run output
// and the actual deletion are guaranteed to act on the exact same snapshot.
async function cmdNukeAll(ctx, args) {
  const [usersPage, clubsSnap, federationsSnap, sharedMatchesSnap, liveViewsSnap, liveMatchesSnap, tournamentViewsSnap, tournamentMatchesSnap, liveTournamentsSnap] = await Promise.all([
    ctx.auth.listUsers(1000),
    ctx.db.collection("clubs").get(),
    ctx.db.collection("federations").get(),
    ctx.db.collection("sharedMatches").get(),
    ctx.db.collection("liveViews").get(),
    ctx.db.collection("liveMatches").get(),
    ctx.db.collection("tournamentViews").get(),
    ctx.db.collection("tournamentMatches").get(),
    ctx.db.collection("liveTournaments").get()
  ]);

  const perUser = await Promise.all(usersPage.users.map(async u => ({
    uid: u.uid,
    email: u.email,
    matchRefs: (await ctx.db.collection("users").doc(u.uid).collection("matches").get()).docs.map(d => d.ref),
    hasTournamentsDoc: (await ctx.db.collection("users").doc(u.uid).collection("meta").doc("tournaments").get()).exists
  })));
  const personalMatchRefs = perUser.flatMap(u => u.matchRefs);
  const personalTournamentDocRefs = perUser.filter(u => u.hasTournamentsDoc).map(u => ctx.db.collection("users").doc(u.uid).collection("meta").doc("tournaments"));

  const clubTournamentRefs = (await Promise.all(clubsSnap.docs.map(c => c.ref.collection("tournaments").get()))).flatMap(s => s.docs.map(d => d.ref));
  const federationTournamentRefs = (await Promise.all(federationsSnap.docs.map(f => f.ref.collection("tournaments").get()))).flatMap(s => s.docs.map(d => d.ref));

  const tournamentEntriesRefs = (await Promise.all(tournamentMatchesSnap.docs.map(d => d.ref.collection("entries").get()))).flatMap(s => s.docs.map(e => e.ref));

  const totalMatches = personalMatchRefs.length;
  const totalTournaments = personalTournamentDocRefs.length + clubTournamentRefs.length + federationTournamentRefs.length;
  const mirrorRefs = [
    ...sharedMatchesSnap.docs.map(d => d.ref),
    ...liveViewsSnap.docs.map(d => d.ref),
    ...liveMatchesSnap.docs.map(d => d.ref),
    ...tournamentViewsSnap.docs.map(d => d.ref),
    ...tournamentMatchesSnap.docs.map(d => d.ref),
    ...tournamentEntriesRefs,
    ...liveTournamentsSnap.docs.map(d => d.ref)
  ];

  console.log(`\n${args.confirmPhrase ? "NUKING" : "Would nuke"}:`);
  console.log(`  Personal matches across ${perUser.length} user(s): ${totalMatches}`);
  console.log(`  Personal tournament lists: ${personalTournamentDocRefs.length}`);
  console.log(`  Club-hosted tournaments across ${clubsSnap.size} club(s): ${clubTournamentRefs.length}`);
  console.log(`  Federation-hosted tournaments across ${federationsSnap.size} federation(s): ${federationTournamentRefs.length}`);
  console.log(`  Public mirror documents: ${mirrorRefs.length}`);
  console.log(`  Total documents affected: ${totalMatches + totalTournaments + mirrorRefs.length}`);
  console.log("\nClubs, teams, rosters, players, invites, feedback, and beta-tester data are NOT touched.");

  if (!args.confirmPhrase) {
    console.log(`\nDry run only -- nothing deleted. Re-run with --confirm-phrase "${NUKE_ALL_CONFIRM_PHRASE}" to actually delete all of the above.`);
    return;
  }
  if (args.confirmPhrase !== NUKE_ALL_CONFIRM_PHRASE) {
    fail(`--confirm-phrase must match exactly: "${NUKE_ALL_CONFIRM_PHRASE}"`);
  }

  await deleteRefs(ctx.db, [...personalMatchRefs, ...clubTournamentRefs, ...federationTournamentRefs, ...mirrorRefs]);
  await Promise.all(personalTournamentDocRefs.map(ref => ref.set({ list: [] })));
  console.log("\nDone. Everything listed above has been deleted.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command, ...rest] = args._;
  if (!command) {
    const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n");
    const header = [];
    for (const line of lines.slice(1)) {
      if (!line.startsWith("//")) break;
      header.push(line.replace(/^\/\/ ?/, ""));
    }
    console.log(header.join("\n"));
    process.exit(1);
  }

  const ctx = initAdmin(args);

  switch (command) {
    case "list-users":
      return cmdListUsers(ctx);
    case "inspect":
      if (!rest[0]) fail("Usage: inspect <uid-or-email>");
      return cmdInspect(ctx, rest[0]);
    case "delete-user-data":
      if (!rest[0]) fail("Usage: delete-user-data <uid-or-email> [--confirm]");
      return cmdDeleteUserData(ctx, rest[0], args);
    case "list-club-tournaments":
      if (!rest[0]) fail("Usage: list-club-tournaments <clubId>");
      return cmdListHostedTournaments(ctx, "clubs", rest[0]);
    case "list-federation-tournaments":
      if (!rest[0]) fail("Usage: list-federation-tournaments <federationId>");
      return cmdListHostedTournaments(ctx, "federations", rest[0]);
    case "delete-club-tournament":
      if (!rest[0] || !rest[1]) fail("Usage: delete-club-tournament <clubId> <tournamentId> [--confirm]");
      return cmdDeleteHostedTournament(ctx, "clubs", rest[0], rest[1], args);
    case "delete-federation-tournament":
      if (!rest[0] || !rest[1]) fail("Usage: delete-federation-tournament <federationId> <tournamentId> [--confirm]");
      return cmdDeleteHostedTournament(ctx, "federations", rest[0], rest[1], args);
    case "nuke-all":
      return cmdNukeAll(ctx, args);
    default:
      fail(`Unknown command "${command}". Run with no arguments to see usage.`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
