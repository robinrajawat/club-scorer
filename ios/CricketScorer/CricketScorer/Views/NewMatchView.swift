import SwiftUI

struct NewMatchView: View {
    @ObservedObject var store: MatchStore
    @Environment(\.dismiss) private var dismiss

    @State private var teamAName = ""
    @State private var teamBName = ""
    @State private var teamAPlayersText = ""
    @State private var teamBPlayersText = ""
    @State private var oversLimit = 20
    @State private var battingFirst = 0 // 0 = team A, 1 = team B
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Teams") {
                    TextField("Team A name", text: $teamAName)
                    TextField("Team A players (comma separated)", text: $teamAPlayersText, axis: .vertical)
                    TextField("Team B name", text: $teamBName)
                    TextField("Team B players (comma separated)", text: $teamBPlayersText, axis: .vertical)
                }

                Section("Format") {
                    Stepper("Overs: \(oversLimit)", value: $oversLimit, in: 1...50)
                    Picker("Batting first", selection: $battingFirst) {
                        Text(teamAName.isEmpty ? "Team A" : teamAName).tag(0)
                        Text(teamBName.isEmpty ? "Team B" : teamBName).tag(1)
                    }
                    .pickerStyle(.segmented)
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("New match")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start") { start() }
                }
            }
        }
    }

    private func players(from text: String) -> [String] {
        text.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    private func start() {
        let a = teamAName.trimmingCharacters(in: .whitespaces)
        let b = teamBName.trimmingCharacters(in: .whitespaces)
        let aPlayers = players(from: teamAPlayersText)
        let bPlayers = players(from: teamBPlayersText)

        guard !a.isEmpty, !b.isEmpty else {
            errorMessage = "Enter both team names."
            return
        }
        guard aPlayers.count >= 2, bPlayers.count >= 2 else {
            errorMessage = "Each team needs at least 2 players."
            return
        }

        var match = Match(
            teamAName: a,
            teamBName: b,
            teamAPlayers: aPlayers,
            teamBPlayers: bPlayers,
            oversLimit: oversLimit
        )
        let battingTeam = battingFirst == 0 ? a : b
        let bowlingTeam = battingFirst == 0 ? b : a
        let order = battingFirst == 0 ? aPlayers : bPlayers
        match.innings = [ScoringEngine.newInnings(battingTeam: battingTeam, bowlingTeam: bowlingTeam, battingOrder: order)]

        store.save(match)
        dismiss()
    }
}
