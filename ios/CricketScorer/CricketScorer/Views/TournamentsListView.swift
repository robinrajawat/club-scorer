import SwiftUI

struct TournamentsListView: View {
    @ObservedObject var tournamentStore: TournamentStore
    @ObservedObject var teamStore: TeamStore
    @ObservedObject var matchStore: MatchStore
    @State private var showingNewTournament = false

    var body: some View {
        List {
            if tournamentStore.tournaments.isEmpty {
                ContentUnavailableView(
                    "No tournaments yet",
                    systemImage: "trophy",
                    description: Text("Create one from at least 2 saved teams to generate a round-robin schedule.")
                )
            } else {
                ForEach(tournamentStore.tournaments) { tournament in
                    NavigationLink {
                        TournamentDetailView(
                            tournamentId: tournament.id,
                            tournamentStore: tournamentStore,
                            teamStore: teamStore,
                            matchStore: matchStore
                        )
                    } label: {
                        row(for: tournament)
                    }
                }
                .onDelete { indexSet in
                    for index in indexSet { tournamentStore.delete(tournamentStore.tournaments[index]) }
                }
            }
        }
        .navigationTitle("Tournaments")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingNewTournament = true
                } label: {
                    Label("New tournament", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingNewTournament) {
            TournamentEditorView(tournamentStore: tournamentStore, teamStore: teamStore)
        }
    }

    private func row(for tournament: Tournament) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(tournament.name).fontWeight(.semibold)
            Text("\(tournament.teams.count) teams · \(tournament.fixtures.count) fixtures")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
