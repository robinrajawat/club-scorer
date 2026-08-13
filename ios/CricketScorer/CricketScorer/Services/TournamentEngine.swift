import Foundation

/// Ported from index.html's `computeStandings(tournament, allMatches)` — read the source before
/// writing this, not from memory. Deliberately narrower than the web version because this iOS
/// build's `Match` model doesn't have the concepts the web app's fuller formula depends on:
///
/// - **No groups.** The web app computes one table per group and excludes cross-group knockout
///   results by fixture `stage`. This build has one flat round-robin group and no knockout
///   fixtures at all, so that whole exclusion problem doesn't exist yet — but it also means a
///   full port needs to bring that logic back once groups/knockouts exist, not just copy this file.
/// - **No no-result / abandoned matches.** The web app tracks `m.noResult` (1 point each, no
///   runs/overs counted) via `declareNoResult`. iOS `Match` has no equivalent status — a match is
///   either in progress or `"complete"` — so this can't distinguish "abandoned" from "never
///   played" and doesn't try to.
/// - **No Super Over tie-break chain.** The web app follows `m.superOverMatchId` to resolve a
///   tied match's *points* (not its NRR) via a linked Super Over match, if one exists and is
///   complete. iOS has no Super Over feature, so a tie here just stays a tie — 1 point each,
///   same as the web app's own fallback when no Super Over exists or it isn't finished yet.
/// - **No revised-overs/DLS.** The web app's NRR calc uses `m.revisedOvers` (from a mid-chase rain
///   adjustment) as the second innings' "full overs" fallback when set. iOS has no rain-revision
///   feature, so this always uses `match.oversLimit` for both sides — correct as long as DLS
///   doesn't exist to revise it, wrong the moment it does.
///
/// Points convention (win = 2, tie = 1) and the NRR formula itself — full-overs credit when a
/// side is bowled out or completes its quota, `runsFor/oversFor − runsAgainst/oversAgainst` —
/// are unchanged from the web app.
enum TournamentEngine {
    static func standings(for tournament: Tournament, matches: [Match]) -> [StandingsRow] {
        var table: [String: StandingsRow] = Dictionary(
            uniqueKeysWithValues: tournament.teams.map { ($0, StandingsRow(team: $0)) }
        )

        let fixtureMatchIds = Set(tournament.fixtures.compactMap(\.matchId))
        let relevant = matches.filter { fixtureMatchIds.contains($0.id) && $0.status == "complete" }

        for match in relevant {
            guard match.innings.count == 2 else { continue }
            let i1 = match.innings[0]
            let i2 = match.innings[1]
            let teamA = i1.battingTeam
            let teamB = i1.bowlingTeam
            guard var rowA = table[teamA], var rowB = table[teamB] else { continue }

            rowA.played += 1
            rowB.played += 1

            // NRR convention: a side that's bowled out (or simply completes its full quota) is
            // credited with the full overs allotted, not just the balls it happened to face —
            // otherwise being bowled out cheaply would perversely improve a team's run rate.
            let maxWicketsA = match.maxWickets(for: teamA)
            let maxWicketsB = match.maxWickets(for: teamB)
            let oversA = i1.wickets >= maxWicketsA
                ? Double(match.oversLimit)
                : Double(i1.legalBalls) / Double(match.ballsPerOver)
            let oversB = i2.wickets >= maxWicketsB
                ? Double(match.oversLimit)
                : Double(i2.legalBalls) / Double(match.ballsPerOver)

            rowA.runsFor += i1.runs
            rowA.oversFor += oversA
            rowA.runsAgainst += i2.runs
            rowA.oversAgainst += oversB

            rowB.runsFor += i2.runs
            rowB.oversFor += oversB
            rowB.runsAgainst += i1.runs
            rowB.oversAgainst += oversA

            if i2.runs > i1.runs {
                rowB.won += 1
                rowB.points += 2
                rowA.lost += 1
            } else if i1.runs > i2.runs {
                rowA.won += 1
                rowA.points += 2
                rowB.lost += 1
            } else {
                rowA.tied += 1
                rowB.tied += 1
                rowA.points += 1
                rowB.points += 1
            }

            table[teamA] = rowA
            table[teamB] = rowB
        }

        return table.values.sorted { lhs, rhs in
            if lhs.points != rhs.points { return lhs.points > rhs.points }
            return lhs.nrr > rhs.nrr
        }
    }
}
