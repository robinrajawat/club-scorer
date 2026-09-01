// Tournament standings/DLS/bracket-placement logic, plus a grab-bag of smaller app-wide helpers
// (localStorage-backed prefs, theme/tour/install-hint flags, a couple of small UI hooks) that
// happened to live in the same stretch of index.html. Kept as one file rather than split further
// for now — these have no dependencies on each other or on anything outside this file, so grouping
// is just about not having proven out the splice pipeline on more than one module shape yet.
// computeStandings/dlsTarget/dlsResourcePercent/oversLeftTrueDecimal are covered by
// tests/unit/appLogic.test.js; the rest (DOM/localStorage-dependent) isn't unit-testable in Node
// and is unchanged from before this refactor.
export function computeStandings(tournament, allMatches) {
  const byId = new Map(allMatches.map(m => [m.id, m]));
  const table = new Map(tournament.teams.map(name => [name, {
    team: name,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    runsFor: 0,
    oversFor: 0,
    runsAgainst: 0,
    oversAgainst: 0
  }]));
  // A knockout-stage fixture's match (Quarterfinal/Semifinal/Final — anything with f.stage set)
  // must never count toward the league table: those points/NRR are already locked in by the time
  // a knockout is even played. The comment above computeGroupStandings shows this was ALREADY a
  // known concern, but only half-solved it — restricting a group's own table to its own teams
  // does stop a CROSS-group knockout match from polluting either group's table (one team won't be
  // in that group's list), but it does nothing for a knockout match between two teams that
  // started in the SAME group (a real possibility as soon as the bracket reaches the Final), and
  // nothing at all for a single-pool (no groups) tournament, where a knockout match always has
  // both teams in the one shared table. Excluding by fixture stage instead — a direct, complete
  // fix that doesn't depend on which teams happen to be paired.
  const knockoutMatchIds = new Set((tournament.fixtures || []).filter(f => f.stage && f.matchId).map(f => f.matchId));
  const tournamentMatches = allMatches.filter(m => m.tournamentId === tournament.id && m.status === "complete" && !knockoutMatchIds.has(m.id));
  for (const m of tournamentMatches) {
    const [i1, i2] = m.innings;
    // teamB read from i1.bowlingTeam rather than i2.battingTeam deliberately — a match abandoned
    // via declareNoResult partway through the FIRST innings never gets a second one created at
    // all, so i2 can be undefined here. i1 always carries both team names (newInning sets
    // battingTeam/bowlingTeam together), so this works whether or not a second innings ever
    // existed, instead of crashing the whole standings computation on i2.battingTeam.
    const teamA = i1.battingTeam;
    const teamB = i1.bowlingTeam;
    if (!table.has(teamA) || !table.has(teamB)) continue; // team not in this tournament's roster — skip rather than guess
    const rowA = table.get(teamA);
    const rowB = table.get(teamB);
    if (m.noResult) {
      // Genuinely different from a tie -- a tie is a completed, valid, decisive-enough-to-compare
      // match that just happened to end level, and correctly still counts toward NRR. A no-result
      // is the opposite: play was stopped too early or too unevenly for the runs/overs on either
      // side to mean anything as a fair comparison, so this deliberately skips the
      // runsFor/oversFor/runsAgainst/oversAgainst accumulation entirely below, unlike every other
      // branch here. 1 point each, same convention as a tie, tracked in its own noResult column
      // rather than folded into tied (a real points table distinguishes NR from T, and conflating
      // them would make the tied count lie about how many matches were actually drawn contests).
      rowA.played++;
      rowB.played++;
      rowA.noResult++;
      rowB.noResult++;
      rowA.points += 1;
      rowB.points += 1;
      continue;
    }
    if (!i2) continue; // still mid-match somehow (shouldn't happen for status "complete" outside noResult) — skip rather than guess
    let winner = null; // team name, or null for a tie
    if (i2.runs > i1.runs) winner = i2.battingTeam;else if (i1.runs > i2.runs) winner = i1.battingTeam;
    // A tie with a completed, decisive Super Over: follow the chain for points only.
    if (!winner && m.superOverMatchId) {
      const so = byId.get(m.superOverMatchId);
      if (so && so.status === "complete") {
        const [s1, s2] = so.innings;
        if (s2.runs > s1.runs) winner = s2.battingTeam;else if (s1.runs > s2.runs) winner = s1.battingTeam;
      }
    }
    rowA.played++;
    rowB.played++;
    // NRR convention: a side bowled out (or that simply completes its full quota) is credited with
    // the full overs ALLOTTED for the run-rate calculation, not just the balls it happened to face
    // — otherwise being bowled out cheaply would perversely IMPROVE a team's run rate.
    const wicketsLimitA = maxWicketsFor(m, i1);
    const wicketsLimitB = maxWicketsFor(m, i2);
    // Team 2's "full overs" fallback uses the revised limit when one was set (declareRevisedTarget,
    // a mid-chase rain adjustment) rather than always m.oversLimit -- crediting a team with more
    // overs than they were ever actually chasing within would inflate their NRR unfairly. Team 1's
    // own calculation never uses this, since a revision only ever adjusts what innings 2 is
    // chasing, never innings 1's own already-played total.
    const effectiveOversLimitB = m.revisedOvers != null ? m.revisedOvers : m.oversLimit;
    const oversA = i1.wickets >= wicketsLimitA ? m.oversLimit : i1.legalBalls / (i1.ballsPerOver || 6);
    const oversB = i2.wickets >= wicketsLimitB ? effectiveOversLimitB : i2.legalBalls / (i2.ballsPerOver || 6);
    rowA.runsFor += i1.runs;
    rowA.oversFor += oversA;
    rowA.runsAgainst += i2.runs;
    rowA.oversAgainst += oversB;
    rowB.runsFor += i2.runs;
    rowB.oversFor += oversB;
    rowB.runsAgainst += i1.runs;
    rowB.oversAgainst += oversA;
    if (winner === i1.battingTeam) {
      rowA.won++;
      rowA.points += 2;
      rowB.lost++;
    } else if (winner === i2.battingTeam) {
      rowB.won++;
      rowB.points += 2;
      rowA.lost++;
    } else {
      rowA.tied++;
      rowB.tied++;
      rowA.points += 1;
      rowB.points += 1;
    }
  }
  return [...table.values()].map(r => ({
    ...r,
    nrr: r.oversFor > 0 && r.oversAgainst > 0 ? r.runsFor / r.oversFor - r.runsAgainst / r.oversAgainst : 0
  })).sort((a, b) => b.points - a.points || b.nrr - a.nrr);
}
// One standings table per group instead of one combined table — reuses computeStandings itself
// rather than re-deriving the points/NRR math, by handing it a "tournament" scoped to just that
// group's teams (same real tournament id, so match-tagging still resolves correctly). Any
// knockout-stage result is excluded at the source now (see computeStandings' knockoutMatchIds),
// so the teams restriction here is just about scoping the table to the right group's roster, not
// about keeping knockout results out — that's handled once, centrally, regardless of which teams
// a knockout match happens to pair. Returns null when the tournament has no groups, so callers
// can use `computeGroupStandings(t, matches) || [{label: null, standings: computeStandings(t, matches)}]`
// as a uniform shape if they want to render single-pool and grouped tournaments the same way.
export function computeGroupStandings(tournament, allMatches) {
  if (!tournament.groups || !tournament.groups.length) return null;
  return tournament.groups.map(g => ({
    label: g.label,
    standings: computeStandings({
      ...tournament,
      teams: g.teams
    }, allMatches)
  }));
}
// First-knockout-round pairing for a multi-group tournament: qualifier rank R from group i faces
// qualifier rank (advancePerGroup - 1 - R) from the NEXT group, cycling group order. For the
// standard 2-group case this produces exactly "Group A #1 vs Group B #2" and "Group B #1 vs Group
// A #2" — the same pattern most club and franchise tournaments use to keep each group's top two
// apart until later. For 3+ groups this cycles the same rule through every group in turn; it's a
// reasonable generalization but only the 2-group case is the one this was actually validated
// against, since that's the shape real requests for this feature have taken so far.
export function crossGroupKnockoutPairs(groupStandings, advancePerGroup) {
  const n = groupStandings.length;
  const paired = new Set();
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let rank = 0; rank < advancePerGroup; rank++) {
      const key = `${i}:${rank}`;
      if (paired.has(key)) continue;
      const teamA = groupStandings[i].standings[rank] && groupStandings[i].standings[rank].team;
      if (!teamA) continue;
      const otherGroup = (i + 1) % n;
      const otherRank = advancePerGroup - 1 - rank;
      const otherKey = `${otherGroup}:${otherRank}`;
      if (otherGroup === i || paired.has(otherKey)) continue;
      const teamB = groupStandings[otherGroup].standings[otherRank] && groupStandings[otherGroup].standings[otherRank].team;
      if (!teamB) continue;
      pairs.push([teamA, teamB]);
      paired.add(key);
      paired.add(otherKey);
    }
  }
  return pairs;
}
// Renders a decimal overs count (e.g. 15.667) as cricket's own overs.balls notation ("15.4") —
// NOT a decimal number, the digit after the point is a ball count from 0-5 (or 0 to
// ballsPerOver-1), so this must floor to the nearest legal ball rather than round.
export function decimalOversToLabel(oversDecimal, ballsPerOver) {
  const b = ballsPerOver || 6;
  const totalBalls = Math.floor(oversDecimal * b + 1e-9); // epsilon guards against e.g. 3.9999997
  const whole = Math.floor(totalBalls / b);
  const balls = totalBalls % b;
  return `${whole}.${balls}`;
}
// The exact margin a team needs THIS match to finish with a higher NRR than a specified rival —
// assumes the two are tied on points once this match is done (the calculator only knows about
// NRR; points/qualification logic beyond that is on the person using it). `stats` is the team's
// standings row from computeStandings BEFORE this match (a live/in-progress match is naturally
// excluded already, since computeStandings only counts status:"complete" matches).
//
// The one thing that makes this tractable instead of a two-variable optimization: whichever side
// of the match is FIXED (the team's own overs faced, or the overs they bowled at their opponent)
// only has one free variable once you know who batted first — see the two branches below for why.
export function computeQualificationTarget({
  stats,
  rivalNRR,
  battingFirst,
  oversLimit,
  knownRuns
}) {
  const RF = stats.runsFor,
    OF = stats.oversFor,
    RA = stats.runsAgainst,
    OA = stats.oversAgainst;
  const L = oversLimit;
  if (battingFirst) {
    // We set `knownRuns` batting first. Our own oversFor contribution is fixed at L (bowled out
    // or all overs used — batting first never ends early). Our opponent's oversAgainst
    // contribution against us is ALSO fixed at L, whether they're bowled out or bat out their
    // overs (the only way it wouldn't be L is if THEY win the chase early, which isn't this
    // scenario — we're solving for scenarios where WE win). So the only lever left is how many
    // runs we restrict them to.
    const R_A = knownRuns;
    const forRate = (RF + R_A) / (OF + L);
    const maxConcedeExact = (forRate - rivalNRR) * (OA + L) - RA;
    return {
      kind: "restrict",
      maxConcedeExact,
      maxConcede: Math.max(0, Math.ceil(maxConcedeExact) - 1),
      achievable: maxConcedeExact > 0
    };
  } else {
    // `knownRuns` is the target we're chasing (opponent's completed first-innings score). Their
    // contribution to our AGAINST side is fixed the moment their innings ends (runs = target,
    // overs = L, same reasoning as above — they either got bowled out or batted out their overs).
    // A winning chase always finishes the instant we pass the target, so our runs (R_A) are
    // pinned at target+1 — the one lever left is how many overs we take to get there.
    const target = knownRuns;
    const R_A = target + 1;
    const againstRate = (RA + target) / (OA + L);
    const requiredForRate = rivalNRR + againstRate;
    if (requiredForRate <= 0) {
      // Even a for-rate of 0 (technically impossible, but the threshold is non-positive) clears
      // it — any win at all, in any number of overs, is enough.
      return {
        kind: "chaseWithin",
        anyWinWorks: true,
        achievable: true
      };
    }
    const maxOversExact = (RF + R_A) / requiredForRate - OF;
    return {
      kind: "chaseWithin",
      maxOversExact,
      achievable: maxOversExact > 0
    };
  }
}

// ---------- Knockout stages (Quarterfinal / Semifinal / Final) ----------
// Winner of a completed match, following the Super Over chain for a tied match — same convention
// computeStandings uses for points. Returns the team name, or null if the match is unplayed, or
// still tied with no decisive Super Over yet (a knockout can't advance a team on that).
export function matchWinner(m, matchById) {
  if (!m || m.status !== "complete" || !m.innings || !m.innings[1]) return null;
  const [i1, i2] = m.innings;
  if (i2.runs > i1.runs) return i2.battingTeam;
  if (i1.runs > i2.runs) return i1.battingTeam;
  if (m.superOverMatchId && matchById) {
    const so = matchById.get(m.superOverMatchId);
    if (so && so.status === "complete" && so.innings && so.innings[1]) {
      const [s1, s2] = so.innings;
      if (s2.runs > s1.runs) return s2.battingTeam;
      if (s1.runs > s2.runs) return s1.battingTeam;
    }
  }
  return null;
}
// A series (teamA vs teamB over N fixtures) needs a much simpler tally than a tournament's points
// table — just how many of the completed fixtures each side has won, reusing matchWinner exactly
// the way the knockout bracket does for its own winner resolution. A winner name that doesn't
// match either series team (e.g. a team got renamed after the fixture was played) lands in
// `unresolved` rather than being silently miscounted toward either side.
export function computeSeriesScore(series, allMatches) {
  const matchById = new Map(allMatches.map(m => [m.id, m]));
  let winsA = 0,
    winsB = 0,
    tied = 0,
    unresolved = 0,
    played = 0;
  for (const f of series.fixtures || []) {
    if (!f.matchId) continue;
    const m = matchById.get(f.matchId);
    if (!m || m.status !== "complete") continue;
    played++;
    const winner = matchWinner(m, matchById);
    if (winner === series.teamA) winsA++;else if (winner === series.teamB) winsB++;else if (winner) unresolved++;else tied++;
  }
  return {
    winsA,
    winsB,
    tied,
    unresolved,
    played,
    total: (series.fixtures || []).length
  };
}
// Standard single-elimination bracket sizes, largest first. Which ones apply to a given
// tournament is purely a function of how many teams are in it — e.g. 8+ teams get a Quarterfinal
// working down to a Final, 4-7 teams start at the Semifinal, 2-3 teams go straight to a Final,
// and fewer than 2 teams can't have a knockout stage at all.
export const KNOCKOUT_STAGES = [{
  label: "Quarterfinal",
  size: 8
}, {
  label: "Semifinal",
  size: 4
}, {
  label: "Final",
  size: 2
}];
export function applicableKnockoutStages(teamCount) {
  const start = KNOCKOUT_STAGES.findIndex(s => teamCount >= s.size);
  return start === -1 ? [] : KNOCKOUT_STAGES.slice(start);
}
// Plain-language preview of what applicableKnockoutStages(n) resolves to, for the tournament
// creation form — so picking a team count / group split shows what shape of tournament actually
// results before committing to it, rather than the person having to already know the
// Quarterfinal/Semifinal/Final cutoffs by heart.
export function knockoutStagesPreview(teamCount) {
  const stages = applicableKnockoutStages(teamCount);
  if (stages.length === 0) return null;
  return stages.map(s => s.label).join(", ");
}
// Seeding pairs for the FIRST knockout stage, keeping seed #1 and #2 apart until the final —
// index pairs into a standings-ranked array of length `size`, e.g. for 8: 1v8, 4v5, 2v7, 3v6.
// Later stages don't need this: their teams are already in bracket order (the winners of
// consecutive pairs from the previous stage), so they just pair up sequentially.
export const BRACKET_SEED_PAIRS = {
  8: [[0, 7], [3, 4], [1, 6], [2, 5]],
  4: [[0, 3], [1, 2]],
  2: [[0, 1]]
};

// A tournament's final placement (champion/runner-up), computed the same way FixturesSection
// derives its "X won the tournament" banner, but as a standalone pure function so RecordsScreen
// can ask it of every tournament a club/federation has ever run, not just the one currently open.
// Two ways a tournament resolves a champion: (1) a decided Final fixture in its knockout bracket
// (mirrors FixturesSection exactly — same stages/fixturesForStage/stageDecided logic), or (2), for
// a tournament with too few teams for any bracket at all (fewer than 2, so applicableKnockoutStages
// returns []), the points-table topper once every fixture is complete — that's the only notion of
// "won it" a pure round-robin-with-no-knockout tournament has. A tournament that HAS a bracket but
// hasn't finished it yields no placement at all (not the standings leader), since an unplayed Final
// isn't a result. Returns null if the tournament has no fixtures yet or nothing is decided.
export function computeTournamentPlacement(tournament, matches) {
  const fixtures = tournament.fixtures || [];
  if (!fixtures.length) return null;
  const matchById = new Map((matches || []).filter(Boolean).map(m => [m.id, m]));
  // Best-known "decided on" date, ISO-validated the same way tournamentDateRangeLabel does —
  // fixture dates are freeform/optional, so this is a best-effort label, not a guarantee. Falls
  // back to the tournament's createdAt (always present) when no fixture date was ever set.
  function latestFixtureDate(fx) {
    const dates = fx.filter(f => ISO_DATETIME_RE.test(f.date || "")).map(f => f.date.slice(0, 10)).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  function fixturesForStage(label) {
    return fixtures.filter(f => f.stage === label);
  }
  function stageDecided(label) {
    const fx = fixturesForStage(label);
    return fx.length > 0 && fx.every(f => f.matchId && matchWinner(matchById.get(f.matchId), matchById));
  }
  const groupStandings = computeGroupStandings(tournament, matches || []);
  const advancePerGroup = tournament.advancePerGroup || 2;
  const stages = applicableKnockoutStages(groupStandings ? groupStandings.length * advancePerGroup : tournament.teams.length);
  if (stages.length) {
    const finalStage = stages[stages.length - 1];
    if (!stageDecided(finalStage.label)) return null;
    const finalFixture = fixturesForStage(finalStage.label)[0];
    const champion = matchWinner(matchById.get(finalFixture.matchId), matchById);
    if (!champion) return null;
    const runnerUp = finalFixture.teamA === champion ? finalFixture.teamB : finalFixture.teamA;
    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      champion,
      runnerUp,
      decidedDate: latestFixtureDate([finalFixture]),
      via: "knockout"
    };
  }
  // No bracket ever applies (fewer than 2 teams) — fall back to the standings topper, but only
  // once the tournament is actually finished (every fixture played), same reasoning FixturesSection
  // uses for groupStageDone: a leader mid-tournament isn't a result yet.
  const allPlayed = fixtures.every(f => f.matchId && matchById.get(f.matchId) && matchById.get(f.matchId).status === "complete");
  if (!allPlayed) return null;
  const standings = computeStandings(tournament, matches || []);
  if (!standings.length || standings[0].played === 0) return null;
  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    champion: standings[0].team,
    runnerUp: standings[1] ? standings[1].team : null,
    decidedDate: latestFixtureDate(fixtures),
    via: "table"
  };
}


// ---------- Account profile (display name override) ----------
async function loadProfile() {
  if (!auth.currentUser) return null;
  try {
    const doc = await db.collection("users").doc(auth.currentUser.uid).collection("meta").doc("profile").get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    console.error("profile load failed", e);
    return null;
  }
}
async function saveProfile(profile) {
  if (!auth.currentUser) return;
  try {
    await db.collection("users").doc(auth.currentUser.uid).collection("meta").doc("profile").set(profile, {
      merge: true
    });
  } catch (e) {
    console.error("profile save failed", e);
  }
}
// ---------- Beta tester flag ----------
// Deliberately a TOP-LEVEL /betaTesters/{uid} doc, not something under /users/{uid} — the rules
// there grant the signed-in owner full read+write over their own subtree, which would let anyone
// self-grant beta access from the browser console. /betaTesters/{uid} is read-only to the owner
// themselves (see firestore.rules) -- an app admin can additionally read/list/write any entry, via
// the Beta Testers admin screen (see loadBetaTesters/approveBetaRequest/revokeBetaAccess below) or still directly
// in the Firebase Console. Absence of the doc, or `enabled` not === true, both mean "not a beta
// tester" — treat any read failure the same way rather than surfacing an error, since this gate
// should fail closed and silently for everyone but the person debugging it.
async function loadBetaStatus() {
  if (!auth.currentUser) return false;
  try {
    const doc = await db.collection("betaTesters").doc(auth.currentUser.uid).get();
    return doc.exists && doc.data().enabled === true;
  } catch (e) {
    console.error("beta status load failed", e);
    return false;
  }
}
// Self-service half of the beta-tester workflow: there's no client-side way to look up someone's
// UID from an email (that's an Admin-SDK-only operation, and this app has no server), so a normal
// "type an email, grant them beta access" admin control can't exist. Instead, a signed-in person
// requests for THEMSELVES -- their own uid/email need no lookup, since they're already provable
// via this exact auth session -- and an admin reviews real pending requests instead of guessing at
// UIDs. Doc id is the requester's own uid (see firestore.rules), so re-requesting after already
// having one pending is just an idempotent overwrite, not a duplicate.
async function submitBetaRequest() {
  if (!auth.currentUser) return {
    ok: false,
    error: "Sign in first."
  };
  try {
    await db.collection("betaRequests").doc(auth.currentUser.uid).set({
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || "",
      requestedAt: Date.now()
    });
    return {
      ok: true
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message || "Couldn't send that request."
    };
  }
}
// Admin-only from here down -- see the Beta Testers admin screen for the actual triage UI, same
// shape as the Feedback Inbox's own admin functions above.
async function loadBetaRequests() {
  try {
    const snap = await db.collection("betaRequests").orderBy("requestedAt", "desc").limit(200).get();
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  } catch (e) {
    console.error("beta requests load failed", e);
    return [];
  }
}
async function loadBetaTesters() {
  try {
    const snap = await db.collection("betaTesters").get();
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })).filter(t => t.enabled === true);
  } catch (e) {
    console.error("beta testers load failed", e);
    return [];
  }
}
// Approving a request both grants beta access AND clears the request in one place, so an approved
// request can't keep showing up as "still pending" after the grant already happened. email is
// carried over from the request onto the /betaTesters doc purely for display in the admin list --
// nothing in the actual beta-status check (loadBetaStatus above) reads it.
async function approveBetaRequest(uid, email) {
  try {
    const batch = db.batch();
    batch.set(db.collection("betaTesters").doc(uid), {
      enabled: true,
      email: email || "",
      grantedAt: Date.now()
    });
    batch.delete(db.collection("betaRequests").doc(uid));
    await batch.commit();
    return {
      ok: true
    };
  } catch (e) {
    return {
      ok: false,
      error: e.code === "permission-denied" ? "Only the admin account can do that." : e.message || "Couldn't approve that."
    };
  }
}
async function declineBetaRequest(uid) {
  try {
    await db.collection("betaRequests").doc(uid).delete();
    return {
      ok: true
    };
  } catch (e) {
    return {
      ok: false,
      error: e.code === "permission-denied" ? "Only the admin account can do that." : e.message || "Couldn't decline that."
    };
  }
}
async function revokeBetaAccess(uid) {
  try {
    await db.collection("betaTesters").doc(uid).delete();
    return {
      ok: true
    };
  } catch (e) {
    return {
      ok: false,
      error: e.code === "permission-denied" ? "Only the admin account can do that." : e.message || "Couldn't revoke that."
    };
  }
}
// ---------- Beta: dummy international data generator ----------
// Real international team rosters used purely as realistic placeholder names, so a beta tester
// has clubs/teams/players/a federation to try new features against without typing a roster by
// hand. Just names — no stats, no quotes, nothing else about the players. One club per country
// (named after its board, the way real cricket boards run their national teams), each with a
// senior XI and a "B" side — not personal teams, since a personal team can't be entered into a
// federation's tournaments anyway.
export const DUMMY_INTL_DATA = [{
  board: "BCCI",
  teams: [{
    name: "India",
    captain: "Rohit Sharma",
    keeper: "Rishabh Pant",
    players: ["Rohit Sharma", "Virat Kohli", "Shubman Gill", "Rishabh Pant", "Hardik Pandya", "Ravindra Jadeja", "KL Rahul", "Axar Patel", "Jasprit Bumrah", "Mohammed Shami", "Kuldeep Yadav"]
  }, {
    name: "India B",
    captain: "Shreyas Iyer",
    keeper: "Sanju Samson",
    players: ["Yashasvi Jaiswal", "Ishan Kishan", "Suryakumar Yadav", "Shreyas Iyer", "Washington Sundar", "Ravichandran Ashwin", "Sanju Samson", "Arshdeep Singh", "Prasidh Krishna", "Mohammed Siraj", "Avesh Khan"]
  }]
}, {
  board: "Cricket Australia",
  teams: [{
    name: "Australia",
    captain: "Pat Cummins",
    keeper: "Alex Carey",
    players: ["Pat Cummins", "Steve Smith", "David Warner", "Travis Head", "Mitchell Marsh", "Marnus Labuschagne", "Glenn Maxwell", "Alex Carey", "Josh Hazlewood", "Mitchell Starc", "Adam Zampa"]
  }, {
    name: "Australia A",
    captain: "Marcus Stoinis",
    keeper: "Josh Inglis",
    players: ["Cameron Green", "Matthew Short", "Josh Inglis", "Marcus Stoinis", "Tim David", "Nathan Ellis", "Sean Abbott", "Ashton Agar", "Spencer Johnson", "Aaron Hardie", "Jake Fraser-McGurk"]
  }]
}, {
  board: "ECB",
  teams: [{
    name: "England",
    captain: "Jos Buttler",
    keeper: "Jonny Bairstow",
    players: ["Jos Buttler", "Ben Stokes", "Joe Root", "Harry Brook", "Jonny Bairstow", "Moeen Ali", "Chris Woakes", "Mark Wood", "Adil Rashid", "Jofra Archer", "Liam Livingstone"]
  }, {
    name: "England Lions",
    captain: "Dawid Malan",
    keeper: "Tom Banton",
    players: ["Will Jacks", "Phil Salt", "Sam Curran", "Reece Topley", "Tom Banton", "Dawid Malan", "Zak Crawley", "Sam Hain", "Brydon Carse", "Matthew Potts", "Rehan Ahmed"]
  }]
}, {
  board: "PCB",
  teams: [{
    name: "Pakistan",
    captain: "Babar Azam",
    keeper: "Mohammad Rizwan",
    players: ["Babar Azam", "Mohammad Rizwan", "Shaheen Afridi", "Shadab Khan", "Naseem Shah", "Fakhar Zaman", "Imam-ul-Haq", "Haris Rauf", "Iftikhar Ahmed", "Mohammad Nawaz", "Abdullah Shafique"]
  }, {
    name: "Pakistan Shaheens",
    captain: "Shan Masood",
    keeper: "Azam Khan",
    players: ["Saim Ayub", "Usman Khan", "Azam Khan", "Mohammad Wasim Jr", "Faheem Ashraf", "Zaman Khan", "Abrar Ahmed", "Tayyab Tahir", "Salman Ali Agha", "Khushdil Shah", "Shan Masood"]
  }]
}, {
  board: "CSA",
  teams: [{
    name: "South Africa",
    captain: "Temba Bavuma",
    keeper: "Quinton de Kock",
    players: ["Temba Bavuma", "Quinton de Kock", "Kagiso Rabada", "David Miller", "Aiden Markram", "Heinrich Klaasen", "Marco Jansen", "Lungi Ngidi", "Rassie van der Dussen", "Tabraiz Shamsi", "Keshav Maharaj"]
  }, {
    name: "South Africa A",
    captain: "Wiaan Mulder",
    keeper: "Ryan Rickelton",
    players: ["Reeza Hendricks", "Tristan Stubbs", "Wiaan Mulder", "Gerald Coetzee", "Andile Phehlukwayo", "Bjorn Fortuin", "Ryan Rickelton", "Dewald Brevis", "Nqabayomzi Peter", "Ottniel Baartman", "Sisanda Magala"]
  }]
}, {
  board: "NZC",
  teams: [{
    name: "New Zealand",
    captain: "Kane Williamson",
    keeper: "Tom Latham",
    players: ["Kane Williamson", "Tom Latham", "Trent Boult", "Devon Conway", "Daryl Mitchell", "Glenn Phillips", "Mitchell Santner", "Tim Southee", "Lockie Ferguson", "Rachin Ravindra", "Kyle Jamieson"]
  }, {
    name: "New Zealand A",
    captain: "Tom Blundell",
    keeper: "Tom Blundell",
    players: ["Finn Allen", "Mark Chapman", "Will Young", "Michael Bracewell", "Ish Sodhi", "Matt Henry", "Adam Milne", "Tom Blundell", "Henry Nicholls", "Jacob Duffy", "Ben Sears"]
  }]
}];
export function buildDummyTeam(def) {
  return {
    id: uid(),
    name: def.name,
    players: def.players.map((n, i) => ({
      name: n,
      number: String(i + 1),
      email: "",
      public: false,
      homeClubId: null
    })),
    captain: def.captain,
    keeper: def.keeper,
    color: null,
    dummy: true // marks this team as generator output, so wipe knows what's safe to remove
  };
}
async function loadDummyDataMeta() {
  if (!auth.currentUser) return {};
  try {
    const doc = await db.collection("users").doc(auth.currentUser.uid).collection("meta").doc("dummyData").get();
    return doc.exists ? doc.data() : {};
  } catch (e) {
    console.error("dummy data meta load failed", e);
    return {};
  }
}
async function saveDummyDataMeta(meta) {
  if (!auth.currentUser) return;
  try {
    await db.collection("users").doc(auth.currentUser.uid).collection("meta").doc("dummyData").set(meta, {
      merge: true
    });
  } catch (e) {
    console.error("dummy data meta save failed", e);
  }
}
// Removes everything the generator below created: every dummy club (deleteClub already cascades
// to a club's own teams AND its entries in the federation directory, and now also clears the
// club's own id out of the federation's affiliatedClubIds — see syncFederationAffiliation).
// Deliberately leaves the ICC federation doc itself alone even though it's now empty and
// (as of the "Delete this federation" feature) technically deletable — it's meant to be reused
// next time Generate runs rather than recreated from scratch. Delete it yourself from Clubs &
// Federations if you'd rather not keep it around between runs.
// Deletes every dummy club tracked in meta, but only forgets the ones that actually succeeded —
// a deleteClub failure (permission hiccup, network blip, etc.) leaves that club's id in meta so
// the NEXT wipe or generate retries it, instead of silently losing track of an orphaned club.
async function wipeDummyData() {
  const meta = await loadDummyDataMeta();
  const clubIds = meta.clubIds || [];
  const results = await Promise.all(clubIds.map(async id => ({
    id,
    result: await deleteClub(id)
  })));
  const stillThere = results.filter(r => !r.result.ok).map(r => r.id);
  await saveDummyDataMeta({
    clubIds: stillThere
  });
  return {
    ok: stillThere.length === 0,
    failedCount: stillThere.length
  };
}
// Builds (or reuses) one shared "ICC" federation and one club per country — named after that
// country's board, e.g. BCCI for India — each affiliated with ICC and holding a senior XI plus a
// "B" side. Idempotent: always wipes any previous run's clubs first, so repeat clicks rebuild
// cleanly instead of piling up duplicates. Saves meta.clubIds progressively (after each club, not
// just at the end) so a failure partway through still leaves every already-created club
// discoverable by a future wipe, rather than silently orphaning it.
async function generateDummyData() {
  if (!auth.currentUser) return {
    ok: false,
    error: "Sign in first."
  };
  const wipeResult = await wipeDummyData();
  let federationId = (await loadDummyDataMeta()).federationId || null;
  if (federationId) {
    const fedDoc = await db.collection("federations").doc(federationId).get();
    if (!fedDoc.exists) federationId = null;
  }
  if (!federationId) {
    const fedResult = await createFederation("ICC");
    if (!fedResult.ok) return fedResult;
    federationId = fedResult.federation.id;
    await db.collection("federations").doc(federationId).update({
      dummy: true
    });
    await saveDummyDataMeta({
      federationId,
      clubIds: []
    });
  }
  const clubIds = [];
  for (const country of DUMMY_INTL_DATA) {
    const clubResult = await createClub(country.board);
    if (!clubResult.ok) {
      await saveDummyDataMeta({
        federationId,
        clubIds
      });
      return {
        ...clubResult,
        clubIds,
        federationId
      };
    }
    const clubId = clubResult.club.id;
    clubIds.push(clubId);
    await saveDummyDataMeta({
      federationId,
      clubIds
    });
    await db.collection("clubs").doc(clubId).update({
      dummy: true,
      federationIds: firebase.firestore.FieldValue.arrayUnion(federationId)
    });
    await syncFederationAffiliation(federationId, clubId, true);
    for (const def of country.teams) {
      const teamResult = await saveClubTeam(clubId, buildDummyTeam(def));
      if (!teamResult.ok) console.error("dummy team save failed", country.board, def.name, teamResult.error);
    }
  }
  return {
    ok: true,
    clubIds,
    federationId,
    partialWipeFailures: wipeResult.failedCount
  };
}
// Restores what exportUserData() produces: profile, teams, and personal matches, written back to
// the CURRENTLY signed-in account — not necessarily the same one the export came from, so this
// doubles as an account-to-account migration as well as a same-account restore. Deliberately does
// NOT touch clubs: the export's `clubs` array is informational only (id/name/role), not a full
// club document, and clubs are shared state gated by Firestore rules (membership, ownership,
// rosters) — there's no safe way to "restore" a club from three fields without either creating a
// duplicate or silently granting membership nobody approved. Matches are re-packed for Firestore
// (the export ran them through unpackMatchFromFirestore) and written as a plain overwrite with a
// fresh writeSeq — this is a deliberate restore the person asked for, not a background sync, so
// there's no conflict check to route around; a match id that already exists in the destination
// account is meant to be overwritten by the backup.
async function importUserData(data) {
  if (!auth.currentUser) return {
    ok: false,
    error: "Sign in first."
  };
  if (!data || typeof data !== "object" || (!data.profile && !Array.isArray(data.teams) && !Array.isArray(data.matches))) {
    return {
      ok: false,
      error: "That doesn't look like a Club Scorer backup file."
    };
  }
  const uid = auth.currentUser.uid;
  let profileRestored = false;
  let teamsCount = 0;
  let matchesCount = 0;
  const failedMatches = [];
  if (data.profile) {
    try {
      await saveProfile(data.profile);
      profileRestored = true;
    } catch (e) {
      console.error("import: profile restore failed", e);
    }
  }
  if (Array.isArray(data.teams)) {
    try {
      await saveTeams(data.teams);
      teamsCount = data.teams.length;
    } catch (e) {
      console.error("import: teams restore failed", e);
    }
  }
  if (Array.isArray(data.matches)) {
    for (const match of data.matches) {
      if (!match || !match.id) continue;
      try {
        const packed = packMatchForFirestore({
          ...match,
          writeSeq: 0,
          updatedAt: Date.now()
        });
        const emptyKeyPath = findEmptyKeyPath(packed, "");
        if (emptyKeyPath) {
          console.error("import: match restore skipped \u2014 empty field name at", emptyKeyPath, "| match id:", match.id);
          failedMatches.push(match.id);
          continue;
        }
        await db.collection("users").doc(uid).collection("matches").doc(match.id).set(packed);
        matchesCount++;
      } catch (e) {
        console.error("import: match restore failed", match.id, e);
        failedMatches.push(match.id);
      }
    }
  }
  return {
    ok: failedMatches.length === 0,
    profileRestored,
    teamsCount,
    matchesCount,
    failedCount: failedMatches.length
  };
}
// ---------- Account data export & deletion ----------
// Everything queryable by uid: profile, personal teams, personal cloud matches, and the clubs this
// account belongs to. This deliberately can't include matches that only ever existed as an open
// score/view code (sharedMatches/liveViews) — those documents have no owner field at all, by
// design (see the Firestore rules notes near genMatchCode), so there's nothing to query them by.
async function exportUserData() {
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;
  const [profile, teams, matchesSnap, clubsSnap] = await Promise.all([loadProfile(), loadTeams(), db.collection("users").doc(uid).collection("matches").get(), db.collection("clubs").where("memberUids", "array-contains", uid).get()]);
  return {
    exportedAt: new Date().toISOString(),
    account: {
      uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName
    },
    profile: profile || null,
    teams,
    matches: matchesSnap.docs.map(d => unpackMatchFromFirestore(d.data())),
    clubs: clubsSnap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      role: d.data().ownerUid === uid ? "owner" : "member"
    }))
  };
}
// Deletes everything this account can reach, then the Firebase Auth account itself. localMatchIds
// lets the caller pass in whatever this device's own match index knows about — those go through
// the regular deleteMatch() so a shareCode/viewCode pair tied to a match gets cleaned up too,
// which a plain Firestore query by uid could never find (same ownerless-by-design limitation as
// exportUserData above). Matches only ever seen on a DIFFERENT device won't be reachable from
// here; that's a real limitation of the open-code sharing model, not an oversight.
async function deleteUserAccount(localMatchIds) {
  const uid = auth.currentUser.uid;
  for (const id of localMatchIds) {
    await deleteMatch(id);
  }
  const matchesSnap = await db.collection("users").doc(uid).collection("matches").get();
  await Promise.all(matchesSnap.docs.map(d => d.ref.delete().catch(e => console.error("delete account: match cleanup failed", e))));
  await db.collection("users").doc(uid).collection("meta").doc("teams").delete().catch(e => console.error("delete account: teams cleanup failed", e));
  await db.collection("users").doc(uid).collection("meta").doc("profile").delete().catch(e => console.error("delete account: profile cleanup failed", e));
  // Leave every club this account is a member of. Both memberUids AND coOwnerUids must be
  // cleared in the SAME write — the clubs/{clubId} update rule's self-leave branch (C) requires
  // both to change together; a memberUids-only write (as this used to do) fails that branch
  // whenever the departing member was also a co-owner, silently leaving them stuck in
  // coOwnerUids forever pointing at a now-deleted account. This can never touch ownerUid itself —
  // there is no self-service ownership transfer, so a club where this account was the SOLE owner
  // (no co-owners) becomes permanently unmanageable by anyone. AccountScreen warns about this
  // before deletion; there's no way to prevent it here after the fact.
  const clubsSnap = await db.collection("clubs").where("memberUids", "array-contains", uid).get();
  await Promise.all(clubsSnap.docs.map(d => d.ref.update({
    memberUids: firebase.firestore.FieldValue.arrayRemove(uid),
    coOwnerUids: firebase.firestore.FieldValue.arrayRemove(uid)
  }).catch(e => console.error("delete account: club leave failed", e))));
  // Same idea for federation co-ownership (federations have no separate "member" list — only
  // createdBy and coOwnerUids). Relies on the federations/{federationId} update rule's branch
  // (C) — if that hasn't been published to this Firestore project yet, this best-effort write
  // fails harmlessly (caught below) and the now-deleted account stays listed as a co-owner. A
  // federation this account CREATED (createdBy) can never be reassigned — there's still no
  // ownership-transfer flow — but it CAN now be deleted by any remaining co-owner once it's empty
  // (see canSyncFederationClubJoin/Leave + the delete rule in firestore.rules), so a dead
  // createdBy uid no longer permanently strands it.
  const fedSnap = await db.collection("federations").where("coOwnerUids", "array-contains", uid).get();
  await Promise.all(fedSnap.docs.map(d => d.ref.update({
    coOwnerUids: firebase.firestore.FieldValue.arrayRemove(uid)
  }).catch(e => console.error("delete account: federation co-owner cleanup failed", e))));
  try {
    await auth.currentUser.delete();
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      // Firebase requires a fresh sign-in for account deletion specifically — reusing the same
      // sign-in flow (with its popup-blocked/redirect fallback already handled) rather than
      // duplicating that logic here.
      const reauth = await signInGoogle();
      if (!reauth.ok) throw e;
      await auth.currentUser.delete();
    } else {
      throw e;
    }
  }
}

// ---------- House rules (balls/over, wide & no-ball run values, free hit) ----------
// Device-local by default so guests (no sign-in required) can still set these; also synced into
// the Firestore profile doc when signed in, so they follow the account across devices.
export function loadRulesLocal() {
  try {
    return {
      ...DEFAULT_RULES,
      ...JSON.parse(localStorage.getItem(`${LS_PREFIX}rules`) || "{}")
    };
  } catch (e) {
    return DEFAULT_RULES;
  }
}
export function saveRulesLocal(rules) {
  const result = lsSetItem(`${LS_PREFIX}rules`, JSON.stringify(rules));
  if (!result.ok) console.error("save rules failed", result.error);
}
// ---------- Theme (light/dark/system) ----------
// Device-local only, deliberately — this is a display preference, not account data, so it doesn't
// go through Firestore/profile sync the way house rules optionally do. "system" isn't stored as a
// resolved light/dark value; it's kept as its own distinct choice so a later change to the OS
// setting keeps tracking it live (see the matchMedia listener in CricketScorer) instead of freezing
// at whatever the OS happened to be set to the first time the app loaded.
export function loadThemePref() {
  try {
    const v = localStorage.getItem(`${LS_PREFIX}theme`);
    // Default (no saved preference yet) is "light", not "system" -- we deliberately don't
    // follow the OS/browser preference on first load. "system" remains a selectable option
    // in the theme picker for anyone who wants live OS tracking; it's just no longer the default.
    return v === "light" || v === "dark" || v === "system" ? v : "light";
  } catch (e) {
    return "light";
  }
}
export function saveThemePref(pref) {
  const result = lsSetItem(`${LS_PREFIX}theme`, pref);
  if (!result.ok) console.error("save theme pref failed", result.error);
}
export function resolveTheme(pref) {
  if (pref === "dark" || pref === "light") return pref;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  const meta = document.getElementById("cs-theme-color");
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#17140f" : "#2d5016");
}
// Pinning a club or federation to the front of its chip row is a per-device browsing
// preference, not account data -- same reasoning as theme above, so it lives in localStorage
// rather than Firestore and doesn't follow the account to another phone. Shared across Teams,
// the Clubs hub, and Cups (one club pin list, since "this is one of my go-to clubs" means the
// same thing everywhere a club chip shows up); federations only ever appear in Cups, so they
// get their own list.
export function loadPinnedIds(key) {
  try {
    const v = JSON.parse(localStorage.getItem(`${LS_PREFIX}${key}`) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}
export function savePinnedIds(key, ids) {
  const result = lsSetItem(`${LS_PREFIX}${key}`, JSON.stringify(ids));
  if (!result.ok) console.error(`save ${key} failed`, result.error);
}
// Stable pinned-first sort -- pinned items keep their relative order among themselves, and so
// does everything unpinned, so pinning something doesn't shuffle the rest of the row around.
export function withPinnedFirst(items, pinnedIds) {
  if (!pinnedIds || pinnedIds.length === 0) return items;
  const pinned = [];
  const rest = [];
  items.forEach(item => (pinnedIds.includes(item.id) ? pinned : rest).push(item));
  return [...pinned, ...rest];
}
// Press-and-hold to pin/unpin a chip without needing a separate visible button crowding the
// small chip UI -- ~500ms matches the OS-level long-press threshold people already have muscle
// memory for. Cancels cleanly on scroll/drag (a horizontal swipe through the chip row shouldn't
// accidentally pin whatever's under the finger when it lifts).
export function useLongPress(onLongPress, ms = 500) {
  const timer = useRef(null);
  const fired = useRef(false);
  function start() {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  }
  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: e => e.preventDefault(),
    // Swallows the click that follows a long-press's pointerup so a pin toggle doesn't also
    // select/switch to that chip in the same gesture.
    onClickCapture: e => {
      if (fired.current) {
        e.stopPropagation();
        e.preventDefault();
        fired.current = false;
      }
    }
  };
}
// Device-local, same reasoning as theme: a first-launch tour is about orienting THIS device's
// first session, not something that should follow an account and skip the tour on a second phone.
export function hasSeenTour() {
  try {
    return localStorage.getItem(`${LS_PREFIX}tour-seen`) === "1";
  } catch (e) {
    return true; // if localStorage is unavailable, don't repeatedly try to show the tour
  }
}
export function markTourSeen() {
  const result = lsSetItem(`${LS_PREFIX}tour-seen`, "1");
  if (!result.ok) console.error("save tour-seen failed", result.error);
}
// Same device-local reasoning as the tour above -- "have I dismissed this hint" is about this
// device/browser, not something that should follow an account onto a different phone that hasn't
// seen it. Scoped to iOS Safari specifically: Android Chrome already shows its own native install
// nudge (the mini-infobar) automatically, so a custom banner there would just be a second,
// redundant prompt on top of one the browser already gives for free -- iOS Safari has no
// programmatic install prompt at all, which is the one place a custom banner is the only option.
export function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}
export function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}
export function hasSeenInstallHint() {
  try {
    return localStorage.getItem(`${LS_PREFIX}install-hint-seen`) === "1";
  } catch (e) {
    return true;
  }
}
export function markInstallHintSeen() {
  const result = lsSetItem(`${LS_PREFIX}install-hint-seen`, "1");
  if (!result.ok) console.error("save install-hint-seen failed", result.error);
}
// Same one-time-hint pattern as install-hint above, for the "swipe to delete" label shown next to
// Home's Saved Matches / Teams' team list headers. Shared across both surfaces deliberately --
// once someone's actually swiped a row anywhere in the app, they know the gesture; repeating the
// hint on the other screen would be teaching something already learned. Marked seen only once a
// real swipe happens (see SwipeableRow's onSwipeStart), not just on first render, so it keeps
// showing until the gesture is actually demonstrated rather than disappearing after one glance.
export function hasSeenSwipeHint() {
  try {
    return localStorage.getItem(`${LS_PREFIX}swipe-hint-seen`) === "1";
  } catch (e) {
    return true;
  }
}
export function markSwipeHintSeen() {
  const result = lsSetItem(`${LS_PREFIX}swipe-hint-seen`, "1");
  if (!result.ok) console.error("save swipe-hint-seen failed", result.error);
}
async function loadRules() {
  if (auth.currentUser) {
    const prof = await loadProfile();
    if (prof && prof.rules) return {
      ...DEFAULT_RULES,
      ...prof.rules
    };
  }
  return loadRulesLocal();
}
async function saveRules(rules) {
  saveRulesLocal(rules);
  if (auth.currentUser) {
    await saveProfile({
      rules
    });
  }
}
export function rosterFor(match, teamName) {
  const roster = teamName === match.teamA ? match.teamARoster : match.teamBRoster;
  return roster || [];
}
export function captainFor(match, teamName) {
  return (teamName === match.teamA ? match.teamACaptain : match.teamBCaptain) || "";
}
export function keeperFor(match, teamName) {
  return (teamName === match.teamA ? match.teamAKeeper : match.teamBKeeper) || "";
}
// Team colors are optional (most club teams never set one) — callers always pass a sensible
// default so the app looks exactly as it did before this existed when nobody's picked a color.
export function teamColorFor(match, teamName, fallback) {
  const c = teamName === match.teamA ? match.teamAColor : match.teamBColor;
  return c || fallback;
}
export function suggestedNextBowler(inning) {
  // The most common club-cricket pattern is two (or a small rotation of) bowlers alternating
  // ends every over. The bowler from two overs ago — i.e. not the one who just finished, but the
  // one before that — is usually who comes back on. Still just a suggestion; always overridable.
  if (!inning.overBowlers || inning.overBowlers.length < 2) return null;
  return inning.overBowlers[inning.overBowlers.length - 2] || null;
}
export function bowlersAtMaxOvers(inning) {
  if (!inning.maxOversPerBowler) return [];
  const maxBalls = inning.maxOversPerBowler * (inning.ballsPerOver || 6);
  return Object.entries(inning.bowlers || {}).filter(([, bw]) => (bw.ballsBowled || 0) >= maxBalls).map(([name]) => name);
}
// Powerplay in this app is informational only, deliberately — there's no fielder-position
// tracking anywhere in the app for an actual "max 2 outside the circle" restriction to attach to,
// so this just marks the window (a badge during play, a note on the scorecard/summary
// afterward) rather than pretending to enforce a rule it has no way to check.
export function inPowerplay(inning) {
  if (!inning.powerplayOvers || inning.complete) return false;
  return inning.legalBalls < inning.powerplayOvers * (inning.ballsPerOver || 6);
}
// A soft flag, not a stop, on purpose — real innings routinely run past a target time (a slow over,
// a longer changeover, a chatty drinks break), and the app has no business ending an innings on a
// clock when it doesn't even know why the clock ran long. This exists so someone glancing at the
// scoring screen can SEE it's overrunning and make their own call, not to enforce anything —
// there's no auto-stop, no confirmation prompt, nothing blocked. Same "informational, not
// enforced" stance as powerplay.
export function isOverTimeCap(inning) {
  if (!inning.timeCapMinutes || !inning.startedAt || inning.complete) return false;
  return Date.now() - inning.startedAt > inning.timeCapMinutes * 60000;
}
export function numberFor(match, teamName, playerName) {
  const map = teamName === match.teamA ? match.teamANumbers : match.teamBNumbers;
  return map && map[playerName] ? map[playerName] : "";
}
export function numbersFor(match, teamName) {
  return (teamName === match.teamA ? match.teamANumbers : match.teamBNumbers) || {};
}
export function playerLabel(match, teamName, playerName) {
  const num = numberFor(match, teamName, playerName);
  return num ? `#${num} ${playerName}` : playerName;
}

// ---------- Match model ----------
export const DEFAULT_RULES = {
  ballsPerOver: 6,
  wideRuns: 1,
  noballRuns: 1,
  freeHit: false,
  superOver: false,
  maxOversPerBowler: null,
  powerplayOvers: null,
  timeCapMinutes: null,
  playersPerSide: 11
};
// The number of batsmen a given team actually has for this match — NOT always 11. Uses the
// playing-XI/roster recorded for that team at match start (teamARoster/teamBRoster, capped to
// playersPerSide when the squad was picked via the squad picker), falling back to the match's
// playersPerSide rule when no roster was recorded at all (teams entered as free-form names with no
// squad picker, effectively uncapped until the scorer manually ends the innings).
export function battingTeamXISize(match, teamName) {
  const roster = teamName === match.teamA ? match.teamARoster : teamName === match.teamB ? match.teamBRoster : null;
  if (roster && roster.length > 0) return roster.length;
  return match.rules && match.rules.playersPerSide || DEFAULT_RULES.playersPerSide;
}
// A side is all out one wicket before it runs out of batsmen, i.e. XI size minus 1 — a 9-a-side
// team is all out on the 8th wicket, not the 10th. A Super Over is the one fixed exception (Law-set
// at 2, regardless of squad size), so that check comes first and short-circuits the roster lookup.
// Prefers inning.maxWickets (baked in once at newInning time — see there) over recomputing live,
// since applyBall itself needs this value and has no access to `match` to recompute it; recomputing
// here is only a fallback for innings saved before this field existed.
export function maxWicketsFor(match, inning) {
  if (inning && inning.maxWickets != null) return inning.maxWickets;
  if (match.isSuperOver) return 2;
  return battingTeamXISize(match, inning.battingTeam) - 1;
}
// ---------- Duckworth-Lewis (Standard Edition) ----------
// The Standard Edition, not the Professional Edition ICC internationals use — that one's
// resource table is genuinely proprietary and was never published. The Standard Edition table
// below is the current, officially published one (ICC's own regulations document, reproduced
// under "The regulations below describe only the operation of the D-L Standard Edition... In the
// event of computer non-availability or malfunction... the D-L Standard Edition... shall be
// used"), i.e. this is the ICC's own designated fallback for exactly the "no proper DLS computer
// available" situation a club match is always in. Transcribed from the over-by-over table (overs
// 50 down to 0, wickets lost 0-9) and validated line-for-line against all five of the ICC
// document's own worked examples before going anywhere near this file.
export const DLS_STANDARD_TABLE = {
  50: [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7],
  49: [99.1, 92.6, 84.5, 74.4, 62.5, 48.9, 34.9, 22.0, 11.9, 4.7],
  48: [98.1, 91.7, 83.8, 74.0, 62.2, 48.8, 34.9, 22.0, 11.9, 4.7],
  47: [97.1, 90.9, 83.2, 73.5, 61.9, 48.6, 34.9, 22.0, 11.9, 4.7],
  46: [96.1, 90.0, 82.5, 73.0, 61.6, 48.5, 34.8, 22.0, 11.9, 4.7],
  45: [95.0, 89.1, 81.8, 72.5, 61.3, 48.4, 34.8, 22.0, 11.9, 4.7],
  44: [93.9, 88.2, 81.0, 72.0, 61.0, 48.3, 34.8, 22.0, 11.9, 4.7],
  43: [92.8, 87.3, 80.3, 71.4, 60.7, 48.1, 34.7, 22.0, 11.9, 4.7],
  42: [91.7, 86.3, 79.5, 70.9, 60.3, 47.9, 34.7, 22.0, 11.9, 4.7],
  41: [90.5, 85.3, 78.7, 70.3, 59.9, 47.8, 34.6, 22.0, 11.9, 4.7],
  40: [89.3, 84.2, 77.8, 69.6, 59.5, 47.6, 34.6, 22.0, 11.9, 4.7],
  39: [88.0, 83.1, 76.9, 69.0, 59.1, 47.4, 34.5, 22.0, 11.9, 4.7],
  38: [86.7, 82.0, 76.0, 68.3, 58.7, 47.1, 34.5, 21.9, 11.9, 4.7],
  37: [85.4, 80.9, 75.0, 67.6, 58.2, 46.9, 34.4, 21.9, 11.9, 4.7],
  36: [84.1, 79.7, 74.1, 66.8, 57.7, 46.6, 34.3, 21.9, 11.9, 4.7],
  35: [82.7, 78.5, 73.0, 66.0, 57.2, 46.4, 34.2, 21.9, 11.9, 4.7],
  34: [81.3, 77.2, 72.0, 65.2, 56.6, 46.1, 34.1, 21.9, 11.9, 4.7],
  33: [79.8, 75.9, 70.9, 64.4, 56.0, 45.8, 34.0, 21.9, 11.9, 4.7],
  32: [78.3, 74.6, 69.7, 63.5, 55.4, 45.4, 33.9, 21.9, 11.9, 4.7],
  31: [76.7, 73.2, 68.6, 62.5, 54.8, 45.1, 33.7, 21.9, 11.9, 4.7],
  30: [75.1, 71.8, 67.3, 61.6, 54.1, 44.7, 33.6, 21.8, 11.9, 4.7],
  29: [73.5, 70.3, 66.1, 60.5, 53.4, 44.2, 33.4, 21.8, 11.9, 4.7],
  28: [71.8, 68.8, 64.8, 59.5, 52.6, 43.8, 33.2, 21.8, 11.9, 4.7],
  27: [70.1, 67.2, 63.4, 58.4, 51.8, 43.3, 33.0, 21.7, 11.9, 4.7],
  26: [68.3, 65.6, 62.0, 57.2, 50.9, 42.8, 32.8, 21.7, 11.9, 4.7],
  25: [66.5, 63.9, 60.5, 56.0, 50.0, 42.2, 32.6, 21.6, 11.9, 4.7],
  24: [64.6, 62.2, 59.0, 54.7, 49.0, 41.6, 32.3, 21.6, 11.9, 4.7],
  23: [62.7, 60.4, 57.4, 53.4, 48.0, 40.9, 32.0, 21.5, 11.9, 4.7],
  22: [60.7, 58.6, 55.8, 52.0, 47.0, 40.2, 31.6, 21.4, 11.9, 4.7],
  21: [58.7, 56.7, 54.1, 50.6, 45.8, 39.4, 31.2, 21.3, 11.9, 4.7],
  20: [56.6, 54.8, 52.4, 49.1, 44.6, 38.6, 30.8, 21.2, 11.9, 4.7],
  19: [54.4, 52.8, 50.5, 47.5, 43.4, 37.7, 30.3, 21.1, 11.9, 4.7],
  18: [52.2, 50.7, 48.6, 45.9, 42.0, 36.8, 29.8, 20.9, 11.9, 4.7],
  17: [49.9, 48.5, 46.7, 44.1, 40.6, 35.8, 29.2, 20.7, 11.9, 4.7],
  16: [47.6, 46.3, 44.7, 42.3, 39.1, 34.7, 28.5, 20.5, 11.8, 4.7],
  15: [45.2, 44.1, 42.6, 40.5, 37.6, 33.5, 27.8, 20.2, 11.8, 4.7],
  14: [42.7, 41.7, 40.4, 38.5, 35.9, 32.2, 27.0, 19.9, 11.8, 4.7],
  13: [40.2, 39.3, 38.1, 36.5, 34.2, 30.8, 26.1, 19.5, 11.7, 4.7],
  12: [37.6, 36.8, 35.8, 34.3, 32.3, 29.4, 25.1, 19.0, 11.6, 4.7],
  11: [34.9, 34.2, 33.4, 32.1, 30.4, 27.8, 24.0, 18.5, 11.5, 4.7],
  10: [32.1, 31.6, 30.8, 29.8, 28.3, 26.1, 22.8, 17.9, 11.4, 4.7],
  9: [29.3, 28.9, 28.2, 27.4, 26.1, 24.2, 21.4, 17.1, 11.2, 4.7],
  8: [26.4, 26.0, 25.5, 24.8, 23.8, 22.3, 19.9, 16.2, 10.9, 4.7],
  7: [23.4, 23.1, 22.7, 22.2, 21.4, 20.1, 18.2, 15.2, 10.5, 4.7],
  6: [20.3, 20.1, 19.8, 19.4, 18.8, 17.8, 16.4, 13.9, 10.1, 4.6],
  5: [17.2, 17.0, 16.8, 16.5, 16.1, 15.4, 14.3, 12.5, 9.4, 4.6],
  4: [13.9, 13.8, 13.7, 13.5, 13.2, 12.7, 12.0, 10.7, 8.4, 4.5],
  3: [10.6, 10.5, 10.4, 10.3, 10.2, 9.9, 9.5, 8.7, 7.2, 4.2],
  2: [7.2, 7.1, 7.1, 7.0, 7.0, 6.8, 6.6, 6.2, 5.5, 3.7],
  1: [3.6, 3.6, 3.6, 3.6, 3.6, 3.5, 3.5, 3.4, 3.2, 2.5],
  0: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};
// oversLeft: true decimal overs remaining (e.g. 4 overs + 3 balls of a 6-ball over = 4.5, NOT
// cricket notation's "4.3") — see oversLeftTrueDecimal below for the conversion every caller
// actually uses. wicketsLost: 0-9; 10+ is always 0% and handled by the caller, not here, since
// "all out" needs no table lookup. Linearly interpolates between the two nearest whole-over rows
// in the official over-by-over table — a standard, disclosed approximation of the official
// ball-by-ball table (which the ICC also publishes but isn't linear within an over); checked
// against that ball-by-ball table directly and found accurate to within about 0.1 percentage
// point in every case tried, exact at every whole-over boundary.
export function dlsResourcePercent(oversLeft, wicketsLost) {
  if (wicketsLost >= 10) return 0;
  const clamped = Math.max(0, Math.min(50, oversLeft));
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);
  const frac = clamped - lower;
  const lowVal = DLS_STANDARD_TABLE[lower][wicketsLost];
  if (frac === 0 || upper === lower) return lowVal;
  const highVal = DLS_STANDARD_TABLE[upper][wicketsLost];
  return lowVal + (highVal - lowVal) * frac;
}
// Balls-remaining -> true decimal overs, for feeding dlsResourcePercent — NOT the same as cricket
// notation (4 overs + 3 balls is written "4.3" on a scorecard but IS 4.5 true decimal overs of a
// 6-ball over). DLS itself always assumes 6-ball overs regardless of this match's own
// ballsPerOver rule, since the published table has no other-length-over version.
export function oversLeftTrueDecimal(oversLimit, legalBallsBowled) {
  const totalBalls = oversLimit * 6;
  const ballsLeft = Math.max(0, totalBalls - legalBallsBowled);
  return ballsLeft / 6;
}
// The full Standard Edition target formula (ICC regulations §5.6) — S is Team 1's score, R1/R2
// are resource percentages (0-100), G50 the average 50-over total for this level of the game
// (200 for lower/associate levels, 245 for full-member internationals and first-class — this app
// defaults to 200, being for club rather than international cricket, but leaves it editable since
// "what level is this really" is a judgment call the app shouldn't make silently). Returns both
// the target to win and the par score (target minus 1) — same "target vs score to tie" pairing
// matchResultText and the live RRR display already use elsewhere for a revised target.
export function dlsTarget(S, R1, R2, G50) {
  let target;
  if (R2 < R1) {
    target = Math.floor(S * R2 / R1) + 1;
  } else if (R2 === R1) {
    target = S + 1;
  } else {
    target = Math.floor(S + G50 * (R2 - R1) / 100) + 1;
  }
  return {
    target,
    par: target - 1
  };
}
