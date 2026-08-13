import SwiftUI

struct TeamsListView: View {
    @ObservedObject var teamStore: TeamStore
    @State private var searchText = ""
    @State private var editingTeam: Team?
    @State private var showingNewTeam = false

    private var filteredTeams: [Team] {
        guard !searchText.isEmpty else { return teamStore.teams }
        return teamStore.teams.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        List {
            if teamStore.teams.isEmpty {
                ContentUnavailableView(
                    "No saved teams",
                    systemImage: "person.3",
                    description: Text("Save a team to reuse its roster next time you set up a match.")
                )
            } else if filteredTeams.isEmpty {
                ContentUnavailableView.search(text: searchText)
            } else {
                ForEach(filteredTeams) { team in
                    Button {
                        editingTeam = team
                    } label: {
                        row(for: team)
                    }
                    .buttonStyle(.plain)
                }
                .onDelete { indexSet in
                    for index in indexSet { teamStore.delete(filteredTeams[index]) }
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search teams")
        .navigationTitle("Teams")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingNewTeam = true
                } label: {
                    Label("New team", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingNewTeam) {
            TeamEditorView(teamStore: teamStore, team: nil)
        }
        .sheet(item: $editingTeam) { team in
            TeamEditorView(teamStore: teamStore, team: team)
        }
    }

    private func row(for team: Team) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(team.name).fontWeight(.semibold)
            Text("\(team.players.count) player\(team.players.count == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}
