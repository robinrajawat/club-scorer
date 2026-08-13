import Foundation

/// Local-only persistence for saved teams, same pattern as MatchStore: UserDefaults + JSON via
/// Codable, no cloud sync. That's consistent with the rest of the app right now (nothing syncs
/// yet).
///
/// Checked against the web app's team-selection code (index.html, selectTeamA/selectTeamB)
/// rather than assuming: it copies the roster into local match-setup state on selection
/// (`setTeamASquad(players)`) — same one-way-copy behavior this does — but it *also* keeps a
/// `teamId` reference on the match itself (`setTeamAId(team.id)`). This iOS `Match` model has
/// no such field yet, so unlike the web app, there's currently no way to trace an iOS match back
/// to the saved Team it was created from, or bulk-update anything if a roster changes later.
/// Fine for the CRUD-only scope this was built for; worth closing before claiming parity.
@MainActor
final class TeamStore: ObservableObject {
    @Published private(set) var teams: [Team] = []

    private let defaultsKey = "cricketscorer.teams.v1"

    init() {
        load()
    }

    func save(_ team: Team) {
        if let idx = teams.firstIndex(where: { $0.id == team.id }) {
            teams[idx] = team
        } else {
            teams.append(team)
        }
        teams.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        persist()
    }

    func delete(_ team: Team) {
        teams.removeAll { $0.id == team.id }
        persist()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey) else { return }
        teams = (try? JSONDecoder().decode([Team].self, from: data)) ?? []
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(teams) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
    }
}
