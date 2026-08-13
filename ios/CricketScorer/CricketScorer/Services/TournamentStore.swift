import Foundation

@MainActor
final class TournamentStore: ObservableObject {
    @Published private(set) var tournaments: [Tournament] = []

    private let defaultsKey = "cricketscorer.tournaments.v1"

    init() {
        load()
    }

    func save(_ tournament: Tournament) {
        if let idx = tournaments.firstIndex(where: { $0.id == tournament.id }) {
            tournaments[idx] = tournament
        } else {
            tournaments.insert(tournament, at: 0)
        }
        persist()
    }

    func delete(_ tournament: Tournament) {
        tournaments.removeAll { $0.id == tournament.id }
        persist()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey) else { return }
        tournaments = (try? JSONDecoder().decode([Tournament].self, from: data)) ?? []
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(tournaments) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
    }
}
