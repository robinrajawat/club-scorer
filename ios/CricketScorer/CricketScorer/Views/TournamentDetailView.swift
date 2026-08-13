import SwiftUI

struct TournamentDetailView: View {
    let tournamentId: UUID
    @ObservedObject var tournamentStore: TournamentStore
    @ObservedObject var teamStore: TeamStore
    @ObservedObject var matchStore: MatchStore

    @State private var tab: Tab = .fixtures
    @State private var startingFixture: Fixture?
    @State private var navigateToMatch: Match?

    private enum Tab: String, CaseIterable {
        case fixtures = "Fixtures"
        case standings = "Standings"
    }

    private var tournament: Tournament? {
        tournamentStore.tournaments.first { $0.id == tournamentId }
    }

    var body: some View {
        Group {
            if let tournament {
                VStack(spacing: 0) {
                    Picker("View", selection: $tab) {
                        ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .padding()

                    switch tab {
                    case .fixtures:
                        fixturesList(tournament)
                    case .standings:
                        standingsList(tournament)
                    }
                }
                .navigationTitle(tournament.name)
                .navigationBarTitleDisplayMode(.inline)
                .sheet(item: $startingFixture) { fixture in
                    FixtureStartSheet(
                        fixture: fixture,
                        tournament: tournament,
                        teamStore: teamStore
                    ) { match in
                        var updated = tournament
                        if let idx = updated.fixtures.firstIndex(where: { $0.id == fixture.id }) {
                            updated.fixtures[idx].matchId = match.id
                        }
                        tournamentStore.save(updated)
                        matchStore.save(match)
                        startingFixture = nil
                        navigateToMatch = match
                    }
                }
                .navigationDestination(item: $navigateToMatch) { match in
                    MatchScoringView(match: match, store: matchStore)
                }
            } else {
                // Tournament was deleted (or this is being reached with a stale id) — nothing
                // sensible to show. Shouldn't normally happen since TournamentsListView only
                // navigates using ids it currently has.
                ContentUnavailableView("Tournament not found", systemImage: "questionmark.circle")
            }
        }
    }

    // MARK: - Fixtures

    private func fixturesList(_ tournament: Tournament) -> some View {
        List(tournament.fixtures) { fixture in
            fixtureRow(fixture, in: tournament)
        }
        .listStyle(.plain)
    }

    private func fixtureRow(_ fixture: Fixture, in tournament: Tournament) -> some View {
        let match = fixture.matchId.flatMap { id in matchStore.matches.first { $0.id == id } }

        return HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(fixture.teamA) vs \(fixture.teamB)").fontWeight(.semibold)
                if let match {
                    if match.status == "complete" {
                        Text(match.resultText ?? "Complete")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("In progress").font(.caption).foregroundStyle(.orange)
                    }
                } else {
                    Text("Not started").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            actionButton(fixture: fixture, match: match)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func actionButton(fixture: Fixture, match: Match?) -> some View {
        if let match {
            Button(match.status == "complete" ? "Result" : "Resume") {
                navigateToMatch = match
            }
            .buttonStyle(.bordered)
        } else {
            Button("Start") {
                startingFixture = fixture
            }
            .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Standings

    private func standingsList(_ tournament: Tournament) -> some View {
        let rows = TournamentEngine.standings(for: tournament, matches: matchStore.matches)
        return List {
            Section {
                standingsHeader
            }
            ForEach(rows) { row in
                standingsRow(row)
            }
        }
        .listStyle(.plain)
    }

    private var standingsHeader: some View {
        HStack {
            Text("Team").fontWeight(.semibold)
            Spacer()
            Text("P").frame(width: 24)
            Text("W").frame(width: 24)
            Text("L").frame(width: 24)
            Text("T").frame(width: 24)
            Text("Pts").frame(width: 32)
            Text("NRR").frame(width: 52)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
    }

    private func standingsRow(_ row: StandingsRow) -> some View {
        HStack {
            Text(row.team)
            Spacer()
            Text("\(row.played)").frame(width: 24)
            Text("\(row.won)").frame(width: 24)
            Text("\(row.lost)").frame(width: 24)
            Text("\(row.tied)").frame(width: 24)
            Text("\(row.points)").frame(width: 32).fontWeight(.semibold)
            Text(row.nrr, format: .number.precision(.fractionLength(2)).sign(strategy: .always()))
                .frame(width: 52)
        }
        .font(.subheadline)
    }
}

/// Sheet shown when starting a fixture: pick who bats first, then build and hand back a Match.
/// Batting-first isn't defaulted silently — this always shows an explicit segmented picker
/// rather than assuming Team A, following the same pattern (and avoiding the same past mistake)
/// as index.html's `teamAIsBattingFirst` bug-fix comment: hard-coding the batting side regardless
/// of an actual choice previously put the wrong team's players in the opening line-up.
private struct FixtureStartSheet: View {
    let fixture: Fixture
    let tournament: Tournament
    @ObservedObject var teamStore: TeamStore
    let onStart: (Match) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var battingFirst = 0 // 0 = teamA, 1 = teamB
    @State private var errorMessage: String?

    private var teamAPlayers: [String]? { teamStore.teams.first { $0.name == fixture.teamA }?.players }
    private var teamBPlayers: [String]? { teamStore.teams.first { $0.name == fixture.teamB }?.players }

    var body: some View {
        NavigationStack {
            Form {
                Section("Batting first") {
                    Picker("Batting first", selection: $battingFirst) {
                        Text(fixture.teamA).tag(0)
                        Text(fixture.teamB).tag(1)
                    }
                    .pickerStyle(.segmented)
                }

                if teamAPlayers == nil || teamBPlayers == nil {
                    // One of the saved teams this fixture referred to at creation time was
                    // deleted since. No fallback to manual entry here — that's NewMatchView's
                    // job, not this sheet's; the fixture just can't start until the team exists
                    // again (re-save it under the same name, or delete/recreate the tournament).
                    Text("A team for this fixture is missing from Teams — it may have been deleted since the tournament was created.")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("\(fixture.teamA) vs \(fixture.teamB)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start", action: start)
                        .disabled(teamAPlayers == nil || teamBPlayers == nil)
                }
            }
        }
    }

    private func start() {
        guard let aPlayers = teamAPlayers, let bPlayers = teamBPlayers else {
            errorMessage = "Both teams need a saved roster to start this fixture."
            return
        }
        guard aPlayers.count >= 2, bPlayers.count >= 2 else {
            errorMessage = "Each team needs at least 2 players."
            return
        }

        var match = Match(
            teamAName: fixture.teamA,
            teamBName: fixture.teamB,
            teamAPlayers: aPlayers,
            teamBPlayers: bPlayers,
            oversLimit: tournament.oversLimit
        )
        let battingTeam = battingFirst == 0 ? fixture.teamA : fixture.teamB
        let bowlingTeam = battingFirst == 0 ? fixture.teamB : fixture.teamA
        let order = battingFirst == 0 ? aPlayers : bPlayers
        match.innings = [ScoringEngine.newInnings(battingTeam: battingTeam, bowlingTeam: bowlingTeam, battingOrder: order)]

        onStart(match)
    }
}
