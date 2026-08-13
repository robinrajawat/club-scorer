import SwiftUI

/// Creates a new Tournament. Deliberately requires picking from *saved* Teams (TeamStore) rather
/// than typing rosters ad hoc — a round-robin has each team playing multiple fixtures, so a
/// persisted roster is the only way "Start" on a fixture can build a Match without re-asking for
/// player names every time. If someone hasn't saved any teams yet, this screen says so and points
/// at Teams rather than degrading into a free-text form (that's what NewMatchView is for).
struct TournamentEditorView: View {
    @ObservedObject var tournamentStore: TournamentStore
    @ObservedObject var teamStore: TeamStore
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var oversLimit = 20
    @State private var selectedTeamNames: Set<String> = []
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Tournament") {
                    TextField("Name", text: $name)
                    Stepper("Overs per match: \(oversLimit)", value: $oversLimit, in: 1...50)
                }

                Section("Teams") {
                    if teamStore.teams.isEmpty {
                        Text("No saved teams yet. Save at least 2 teams (Home → Teams) before creating a tournament.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(teamStore.teams) { team in
                            Button {
                                toggle(team.name)
                            } label: {
                                HStack {
                                    Text(team.name)
                                    Spacer()
                                    if selectedTeamNames.contains(team.name) {
                                        Image(systemName: "checkmark").foregroundStyle(.tint)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if !selectedTeamNames.isEmpty {
                    Section {
                        let count = selectedTeamNames.count
                        let fixtureCount = count * (count - 1) / 2
                        Text("\(count) team\(count == 1 ? "" : "s") selected · \(fixtureCount) fixture\(fixtureCount == 1 ? "" : "s") will be generated")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("New tournament")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create", action: create)
                }
            }
        }
    }

    private func toggle(_ teamName: String) {
        if selectedTeamNames.contains(teamName) {
            selectedTeamNames.remove(teamName)
        } else {
            selectedTeamNames.insert(teamName)
        }
    }

    private func create() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else {
            errorMessage = "Enter a tournament name."
            return
        }
        guard selectedTeamNames.count >= 2 else {
            errorMessage = "Select at least 2 teams."
            return
        }
        // Preserve TeamStore's order (already alphabetical) rather than Set's undefined order,
        // so fixture generation is deterministic and the standings table starts in a stable order.
        let teams = teamStore.teams.map(\.name).filter { selectedTeamNames.contains($0) }
        var tournament = Tournament(name: trimmedName, teams: teams, oversLimit: oversLimit)
        tournament.fixtures = Tournament.roundRobinFixtures(teams: teams)
        tournamentStore.save(tournament)
        dismiss()
    }
}
