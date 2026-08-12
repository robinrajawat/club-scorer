import Foundation

@MainActor
final class MatchStore: ObservableObject {
    @Published private(set) var matches: [Match] = []

    private let defaultsKey = "cricketscorer.matches.v1"

    init() {
        load()
    }

    func save(_ match: Match) {
        if let idx = matches.firstIndex(where: { $0.id == match.id }) {
            matches[idx] = match
        } else {
            matches.insert(match, at: 0)
        }
        persist()
    }

    func delete(_ match: Match) {
        matches.removeAll { $0.id == match.id }
        persist()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey) else { return }
        matches = (try? JSONDecoder().decode([Match].self, from: data)) ?? []
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(matches) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
    }
}
