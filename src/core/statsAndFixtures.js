// Fixture generation, career stats aggregation, and Player-of-the-Match / Best-Fielder /
// Player-of-the-Tournament suggestion heuristics. Pure, match-data-only logic — no Firestore, no
// DOM. Covered by tests/unit/statsAndFixtures.test.js.

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function generateRoundRobinFixtures(teamNames, double) {
  const fixtures = [];
  for (let i = 0; i < teamNames.length; i++) {
    for (let j = i + 1; j < teamNames.length; j++) {
      fixtures.push({
        id: uid(),
        teamA: teamNames[i],
        teamB: teamNames[j],
        date: "",
        matchId: null
      });
      if (double) fixtures.push({
        id: uid(),
        teamA: teamNames[j],
        teamB: teamNames[i],
        date: "",
        matchId: null
      });
    }
  }
  return fixtures;
}

export function generateGroupRoundRobinFixtures(groups, double) {
  const fixtures = [];
  for (const g of groups) {
    for (const f of generateRoundRobinFixtures(g.teams, double)) {
      fixtures.push({
        ...f,
        group: g.label
      });
    }
  }
  return fixtures;
}

export function computePlayerStats(matches) {
  const players = {}; // name -> { runs, balls, dismissals, innings, wickets, ballsBowled, runsConceded, matches: Set }
  function get(name) {
    if (!players[name]) {
      players[name] = {
        name,
        runs: 0,
        balls: 0,
        dismissals: 0,
        battingInnings: 0,
        wickets: 0,
        ballsBowled: 0,
        // Separate from ballsBowled (a raw count, meaningless to sum across matches with
        // different ballsPerOver) — this accumulates each innings's contribution already scaled
        // to standard 6-ball-over terms, so economy stays correct for anyone who's played matches
        // with a non-default overs rule.
        oversBowledEquiv: 0,
        runsConceded: 0,
        matchIds: new Set(),
        // Personal-best tracking — best single-innings knock/bowling figures, not career totals.
        bestBattingRuns: null,
        bestBattingOut: null,
        // whether THAT specific best innings ended not-out
        bestBowlingWickets: null,
        bestBowlingRuns: null,
        catches: 0
      };
    }
    return players[name];
  }
  matches.forEach(m => {
    if (!m || !m.innings) return;
    m.innings.forEach(inn => {
      Object.entries(inn.batsmen || {}).forEach(([name, b]) => {
        const p = get(name);
        p.runs += b.runs || 0;
        p.balls += b.balls || 0;
        p.battingInnings += 1;
        if (b.out) p.dismissals += 1;
        p.matchIds.add(m.id);
        // Best batting: highest score wins outright; an unbeaten score only displaces an equal
        // dismissed one (matches the usual convention of listing the not-out score as the better
        // one when both are the same number of runs).
        const runs = b.runs || 0;
        if (p.bestBattingRuns === null || runs > p.bestBattingRuns || runs === p.bestBattingRuns && !b.out && p.bestBattingOut) {
          p.bestBattingRuns = runs;
          p.bestBattingOut = !!b.out;
        }
        // Catches: parsed from the dismissal's "how" text ("c Fielder b Bowler" or "c & b Bowler")
        // since fielderName isn't stored as its own field on the ball event — see applyBall's
        // wicket branch. Stumpings intentionally aren't counted here; they're a keeper's dismissal,
        // not a catch.
        if (b.out && b.how) {
          const andBowledMatch = b.how.match(/^c & b (.+)$/);
          const caughtMatch = b.how.match(/^c (.+) b .+$/);
          const catcher = andBowledMatch ? andBowledMatch[1] : caughtMatch ? caughtMatch[1] : null;
          if (catcher) get(catcher).catches += 1;
        }
      });
      Object.entries(inn.bowlers || {}).forEach(([name, bw]) => {
        const p = get(name);
        p.wickets += bw.wickets || 0;
        p.ballsBowled += bw.ballsBowled || 0;
        p.oversBowledEquiv += (bw.ballsBowled || 0) / (inn.ballsPerOver || 6);
        p.runsConceded += bw.runs || 0;
        p.matchIds.add(m.id);
        // Best bowling: most wickets wins outright; tied on wickets, fewer runs conceded wins —
        // the standard "best bowling figures" convention (e.g. 4/18 beats 4/32).
        const w = bw.wickets || 0,
          r = bw.runs || 0;
        if (p.bestBowlingWickets === null || w > p.bestBowlingWickets || w === p.bestBowlingWickets && r < p.bestBowlingRuns) {
          p.bestBowlingWickets = w;
          p.bestBowlingRuns = r;
        }
      });
    });
  });
  return Object.values(players).map(p => ({
    ...p,
    matchCount: p.matchIds.size,
    battingAvg: p.dismissals > 0 ? p.runs / p.dismissals : null,
    strikeRate: p.balls > 0 ? p.runs / p.balls * 100 : null,
    bowlingAvg: p.wickets > 0 ? p.runsConceded / p.wickets : null,
    economy: p.oversBowledEquiv > 0 ? p.runsConceded / p.oversBowledEquiv : null,
    bestBattingLabel: p.bestBattingRuns === null ? null : `${p.bestBattingRuns}${p.bestBattingOut ? "" : "*"}`,
    bestBowlingLabel: p.bestBowlingWickets === null ? null : `${p.bestBowlingWickets}/${p.bestBowlingRuns}`
  }));
}

export function suggestPlayerOfMatch(match) {
  // simple, transparent heuristic: runs scored + 20 per wicket taken, combined across both innings
  const scores = {};
  match.innings.forEach(inn => {
    Object.entries(inn.batsmen || {}).forEach(([name, b]) => {
      scores[name] = (scores[name] || 0) + (b.runs || 0);
    });
    Object.entries(inn.bowlers || {}).forEach(([name, bw]) => {
      scores[name] = (scores[name] || 0) + (bw.wickets || 0) * 20;
    });
  });
  let best = null,
    bestScore = -1;
  Object.entries(scores).forEach(([name, s]) => {
    if (s > bestScore) {
      bestScore = s;
      best = name;
    }
  });
  return best;
}

export function suggestBestFielder(match) {
  const counts = {};
  match.innings.forEach(inn => {
    Object.values(inn.batsmen || {}).forEach(b => {
      if (!b.out || !b.how) return;
      const andBowledMatch = b.how.match(/^c & b (.+)$/);
      const caughtMatch = b.how.match(/^c (.+) b .+$/);
      const runOutMatch = b.how.match(/^run out \((.+)\)$/);
      const fielder = andBowledMatch ? andBowledMatch[1] : caughtMatch ? caughtMatch[1] : runOutMatch ? runOutMatch[1] : null;
      if (fielder) counts[fielder] = (counts[fielder] || 0) + 1;
    });
  });
  let best = null,
    bestCount = 0;
  Object.entries(counts).forEach(([name, c]) => {
    if (c > bestCount) {
      bestCount = c;
      best = name;
    }
  });
  return bestCount > 0 ? best : null;
}

export function suggestPlayerOfTournament(matches) {
  // same transparent heuristic as suggestPlayerOfMatch, aggregated across every completed
  // match in the tournament: runs scored + 20 per wicket taken.
  const scores = {};
  matches.forEach(m => {
    if (!m || !m.innings) return;
    m.innings.forEach(inn => {
      Object.entries(inn.batsmen || {}).forEach(([name, b]) => {
        scores[name] = (scores[name] || 0) + (b.runs || 0);
      });
      Object.entries(inn.bowlers || {}).forEach(([name, bw]) => {
        scores[name] = (scores[name] || 0) + (bw.wickets || 0) * 20;
      });
    });
  });
  let best = null,
    bestScore = -1;
  Object.entries(scores).forEach(([name, s]) => {
    if (s > bestScore) {
      bestScore = s;
      best = name;
    }
  });
  return best;
}

export function allMatchPlayers(match) {
  const names = new Set();
  match.innings.forEach(inn => {
    (inn.battingOrder || []).forEach(n => names.add(n));
    (inn.bowlingOrder || []).forEach(n => names.add(n));
  });
  return Array.from(names);
}
