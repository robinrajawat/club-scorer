import { maxWicketsFor } from "./appLogic.js";

// Fixture generation, career/club stats aggregation, and Player-of-the-Match / Best-Fielder /
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

export function computeClubRecords(matches, sinceTs) {
  const completed = (matches || []).filter(m => m && m.status === "complete" && m.innings && m.innings.length && (!sinceTs || (m.createdAt || 0) >= sinceTs));
  const centuries = [];
  const fiveWicketHauls = [];
  const innTotals = [];
  const partnerships = [];
  const umpireCounts = {};
  completed.forEach(m => {
    const date = m.createdAt || null;
    // Once per match, not per innings — umpire1/umpire2 are match-level fields (see SetupScreen),
    // and Set here (not a plain push) so standing umpire for both ends of the same match is only
    // ever counted once for that match, matching how a real umpire's "matches stood in" tally
    // would never double-count a single match they officiated start to finish.
    new Set([m.umpire1, m.umpire2].filter(Boolean)).forEach(name => {
      umpireCounts[name] = (umpireCounts[name] || 0) + 1;
    });
    m.innings.forEach(inn => {
      const opponent = inn.bowlingTeam;
      innTotals.push({
        team: inn.battingTeam,
        opponent,
        runs: inn.runs || 0,
        wickets: inn.wickets || 0,
        allOut: (inn.wickets || 0) >= maxWicketsFor(m, inn),
        matchId: m.id,
        date
      });
      Object.entries(inn.batsmen || {}).forEach(([name, b]) => {
        const runs = b.runs || 0;
        if (runs >= 100) {
          centuries.push({
            name,
            runs,
            out: !!b.out,
            team: inn.battingTeam,
            opponent,
            matchId: m.id,
            date
          });
        }
      });
      Object.entries(inn.bowlers || {}).forEach(([name, bw]) => {
        const wickets = bw.wickets || 0;
        if (wickets >= 5) {
          fiveWicketHauls.push({
            name,
            wickets,
            runs: bw.runs || 0,
            team: inn.bowlingTeam,
            opponent: inn.battingTeam,
            matchId: m.id,
            date
          });
        }
      });
      // Only present on matches scored after partnership tracking was added (see newInning) --
      // older matches simply have nothing to contribute here, same as any other field added
      // after the fact.
      (inn.partnerships || []).forEach(p => {
        partnerships.push({
          batter1: p.batter1,
          batter2: p.batter2,
          runs: p.runs || 0,
          balls: p.balls || 0,
          wicket: p.wicket,
          unbeaten: !!p.unbeaten,
          team: inn.battingTeam,
          opponent,
          matchId: m.id,
          date
        });
      });
    });
  });
  centuries.sort((a, b) => b.runs - a.runs || (b.date || 0) - (a.date || 0));
  fiveWicketHauls.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs || (b.date || 0) - (a.date || 0));
  partnerships.sort((a, b) => b.runs - a.runs || (b.date || 0) - (a.date || 0));
  const centuriesTop = centuries.slice(0, 10);
  const fiveWicketHaulsTop = fiveWicketHauls.slice(0, 10);
  const biggestPartnerships = partnerships.slice(0, 10);
  const highestTotals = [...innTotals].sort((a, b) => b.runs - a.runs).slice(0, 10);
  const lowestAllOutTotals = innTotals.filter(t => t.allOut).sort((a, b) => a.runs - b.runs).slice(0, 10);
  // Win margins — same result logic as matchResultText, but recording the numbers instead of
  // formatting a sentence, and skipping ties/no-results since neither has a "margin".
  const winsByRuns = [];
  const winsByWickets = [];
  completed.forEach(m => {
    const [i1, i2] = m.innings;
    if (!i2 || m.noResult) return;
    const target = m.revisedTarget != null ? m.revisedTarget : i1.runs + 1;
    const date = m.createdAt || null;
    if (i2.runs >= target) {
      const wicketsInHand = maxWicketsFor(m, i2) - i2.wickets;
      winsByWickets.push({
        winner: i2.battingTeam,
        loser: i1.battingTeam,
        margin: wicketsInHand,
        matchId: m.id,
        date
      });
    } else if (i2.runs < target - 1) {
      winsByRuns.push({
        winner: i1.battingTeam,
        loser: i2.battingTeam,
        margin: target - 1 - i2.runs,
        matchId: m.id,
        date
      });
    }
  });
  winsByRuns.sort((a, b) => b.margin - a.margin);
  winsByWickets.sort((a, b) => b.margin - a.margin);
  const playerStats = computePlayerStats(completed);
  const mostRuns = [...playerStats].filter(p => p.balls > 0).sort((a, b) => b.runs - a.runs).slice(0, 10);
  const mostWickets = [...playerStats].filter(p => p.ballsBowled > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, 10);
  const mostCatches = [...playerStats].filter(p => p.catches > 0).sort((a, b) => b.catches - a.catches).slice(0, 10);
  const bestIndividualScores = [...playerStats].filter(p => p.bestBattingRuns !== null).sort((a, b) => b.bestBattingRuns - a.bestBattingRuns).slice(0, 10);
  const bestBowlingFigures = [...playerStats].filter(p => p.bestBowlingWickets !== null).sort((a, b) => b.bestBowlingWickets - a.bestBowlingWickets || a.bestBowlingRuns - b.bestBowlingRuns).slice(0, 10);
  const mostMatchesUmpired = Object.entries(umpireCounts).map(([name, count]) => ({
    name,
    count
  })).sort((a, b) => b.count - a.count).slice(0, 10);
  return {
    matchCount: completed.length,
    highestTotals,
    lowestAllOutTotals,
    winsByRuns: winsByRuns.slice(0, 10),
    winsByWickets: winsByWickets.slice(0, 10),
    mostRuns,
    mostWickets,
    mostCatches,
    bestIndividualScores,
    bestBowlingFigures,
    centuries: centuriesTop,
    fiveWicketHauls: fiveWicketHaulsTop,
    biggestPartnerships,
    mostMatchesUmpired
  };
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
