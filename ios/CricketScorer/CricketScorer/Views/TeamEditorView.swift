import SwiftUI

/// Add/edit screen for a saved Team. Same view handles both: passing `team: nil` creates a new
/// one, passing an existing `Team` edits it in place (matched by id on save).
struct TeamEditorView: View {
    @ObservedObject var teamStore: TeamStore
    let team: Team?

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var players: [String]
    @State private var newPlayerName = ""
    @State private var errorMessage: String?
    @FocusState private var newPlayerFieldFocused: Bool

    init(teamStore: TeamStore, team: Team?) {
        self.teamStore = teamStore
        self.team = team
        _name = State(initialValue: team?.name ?? "")
        _players = State(initialValue: team?.players ?? [])
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Team") {
                    TextField("Team name", text: $name)
                }

                Section("Players") {
                    ForEach(players, id: \.self) { player in
                        Text(player)
                    }
                    .onDelete { indexSet in
                        players.remove(atOffsets: indexSet)
                    }
                    .onMove { source, destination in
                        players.move(fromOffsets: source, toOffset: destination)
                    }

                    HStack {
                        TextField("Add player", text: $newPlayerName)
                            .focused($newPlayerFieldFocused)
                            .submitLabel(.done)
                            .onSubmit(addPlayer)
                        Button("Add", action: addPlayer)
                            .disabled(newPlayerName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red).font(.footnote)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    // EditButton drives reordering/deleting via the List's built-in edit mode,
                    // same as HomeView's swipe-to-delete but with drag handles too since roster
                    // order plausibly matters (e.g. as a starting point for batting order).
                    EditButton()
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save)
                }
            }
            .navigationTitle(team == nil ? "New team" : "Edit team")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func addPlayer() {
        let trimmed = newPlayerName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        guard !players.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) else {
            errorMessage = "\(trimmed) is already on this roster."
            return
        }
        players.append(trimmed)
        newPlayerName = ""
        errorMessage = nil
        newPlayerFieldFocused = true
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else {
            errorMessage = "Enter a team name."
            return
        }
        guard players.count >= 2 else {
            errorMessage = "Add at least 2 players."
            return
        }
        var saved = team ?? Team(name: trimmedName, players: players)
        saved.name = trimmedName
        saved.players = players
        teamStore.save(saved)
        dismiss()
    }
}
