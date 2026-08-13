import Foundation

/// A saved roster the user can reuse across matches without retyping player names each time.
/// Deliberately just name + player list — no captain, no roles, no stats. Those belong to
/// records/series stats (still unbuilt) once matches actually reference teams by id rather
/// than by free-text name, which they still don't (see TeamStore.swift for why).
struct Team: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    var players: [String]
}
