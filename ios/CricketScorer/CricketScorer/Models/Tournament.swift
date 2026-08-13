import Foundation

/// A single round-robin group: every team in `teams` plays every other team once. No groups, no
/// knockout stage, no qualification-scenario math — those are the two hardest pieces still
/// unbuilt (see ios/STATUS.md). `teams` holds names, not Team ids, matching the web app's own
/// tournament model (index.html's computeStandings does `tournament.teams.map(name => ...)`) —
/// a name-based roster here isn't a shortcut, it's the same design the web app already uses.
struct Tournament: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    var teams: [String]
    /// Applied to every Match created from one of this tournament's fixtures.
    var oversLimit: Int = 20
    var fixtures: [Fixture] = []

    /// Every unordered pair of teams, once each. Order of the resulting list follows `teams`'
    /// order (team[0] vs team[1], team[0] vs team[2], ... team[1] vs team[2], ...) — arbitrary
    /// but stable, not seeded or scheduled against any real-world date/venue constraint.
    static func roundRobinFixtures(teams: [String]) -> [Fixture] {
        guard teams.count >= 2 else { return [] }
        var fixtures: [Fixture] = []
        for i in 0..<teams.count {
            for j in (i + 1)..<teams.count {
                fixtures.append(Fixture(teamA: teams[i], teamB: teams[j]))
            }
        }
        return fixtures
    }
}

struct Fixture: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var teamA: String
    var teamB: String
    /// Set once a Match has been created for this fixture (see TournamentDetailView's "Start").
    /// nil means not started yet.
    var matchId: UUID?
}

/// One row of a points table. Computed fresh from Tournament + the match list each time it's
/// needed (TournamentEngine.standings) rather than stored, so it's always consistent with
/// whatever matches currently exist — same reason MatchStore doesn't cache derived totals either.
struct StandingsRow: Identifiable, Equatable {
    var id: String { team }
    var team: String
    var played = 0
    var won = 0
    var lost = 0
    var tied = 0
    var points = 0
    var runsFor = 0
    var oversFor: Double = 0
    var runsAgainst = 0
    var oversAgainst: Double = 0

    var nrr: Double {
        guard oversFor > 0, oversAgainst > 0 else { return 0 }
        return (Double(runsFor) / oversFor) - (Double(runsAgainst) / oversAgainst)
    }
}
