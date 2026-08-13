import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel
    @StateObject private var store = MatchStore()
    @StateObject private var teamStore = TeamStore()
    @State private var showingNewMatch = false

    var body: some View {
        NavigationStack {
            List {
                if store.matches.isEmpty {
                    ContentUnavailableView(
                        "No matches yet",
                        systemImage: "sportscourt",
                        description: Text("Start your first game to see it here.")
                    )
                } else {
                    ForEach(store.matches) { match in
                        NavigationLink(value: match.id) {
                            matchRow(match)
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet { store.delete(store.matches[index]) }
                    }
                }
            }
            .navigationTitle("Club Scorer")
            .navigationDestination(for: UUID.self) { id in
                if let match = store.matches.first(where: { $0.id == id }) {
                    if match.status == "complete" {
                        ResultView(match: match)
                    } else {
                        MatchScoringView(match: match, store: store)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingNewMatch = true
                    } label: {
                        Label("New match", systemImage: "plus")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        TeamsListView(teamStore: teamStore)
                    } label: {
                        Label("Teams", systemImage: "person.3")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        if let email = authViewModel.user?.email {
                            Text(email)
                        }
                        Button("Sign out", role: .destructive) {
                            authViewModel.signOut()
                        }
                    } label: {
                        Image(systemName: "person.circle")
                    }
                }
            }
            .sheet(isPresented: $showingNewMatch) {
                NewMatchView(store: store, teamStore: teamStore)
            }
        }
    }

    private func matchRow(_ match: Match) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(match.teamAName).fontWeight(.semibold)
                Text("vs").foregroundStyle(.secondary)
                Text(match.teamBName).fontWeight(.semibold)
            }
            Text("\(match.oversLimit) overs · \(match.status == "complete" ? "Completed" : "In progress")")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
