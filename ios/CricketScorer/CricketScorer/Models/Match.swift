import Foundation

enum ExtraType: String, Codable, CaseIterable {
    case none, wide, noBall, bye, legBye
}

enum WicketType: String, Codable, CaseIterable, Identifiable {
    case bowled, caught, runOut, stumped, lbw, hitWicket, retired, other
    var id: String { rawValue }

    var label: String {
        switch self {
        case .bowled: return "Bowled"
        case .caught: return "Caught"
        case .runOut: return "Run out"
        case .stumped: return "Stumped"
        case .lbw: return "LBW"
        case .hitWicket: return "Hit wicket"
        case .retired: return "Retired"
        case .other: return "Other"
        }
    }
}

struct BallEvent: Codable, Equatable, Identifiable {
    var id = UUID()
    var runs: Int
    var extraType: ExtraType
    var isWicket: Bool
    var wicketType: WicketType?
    var dismissedBatterName: String?
    var strikerName: String
    var nonStrikerName: String
    var bowlerName: String
    /// True if this delivery was bowled as a free hit (i.e. it followed a no-ball).
    /// Defaulted for backward compatibility with any match JSON saved before this
    /// field existed — old saves just decode every ball as `false`.
    var isFreeHit: Bool = false

    var isLegal: Bool { extraType != .wide && extraType != .noBall }

    /// Runs that count toward the team total, including penalty runs for wides/no-balls.
    var totalRuns: Int {
        switch extraType {
        case .wide, .noBall: return runs + 1
        default: return runs
        }
    }

    /// Whether these runs count toward the striker's individual score.
    var countsForBatter: Bool {
        extraType == .none || extraType == .noBall
    }
}

struct Over: Codable, Equatable, Identifiable {
    var id = UUID()
    var bowlerName: String
    var balls: [BallEvent] = []

    var legalBallCount: Int { balls.filter(\.isLegal).count }
    var runsConceded: Int { balls.reduce(0) { $0 + $1.totalRuns } }
    var isComplete: Bool { legalBallCount >= 6 }
}

struct FallOfWicket: Codable, Equatable {
    var batterName: String
    var score: Int
    var overSummary: String
}

struct InningsState: Codable, Equatable {
    var battingTeam: String
    var bowlingTeam: String
    var battingOrder: [String]
    var nextBatterIndex: Int = 0

    var overs: [Over] = []
    var strikerName: String?
    var nonStrikerName: String?
    /// True if the *next* legal delivery bowled in this innings is a free hit
    /// (i.e. the previous ball was a no-ball, or was itself a free-hit delivery
    /// that turned out to be another illegal ball).
    var freeHitNext: Bool = false

    var runs: Int = 0
    var wickets: Int = 0
    var fallOfWickets: [FallOfWicket] = []
    var complete: Bool = false

    var legalBalls: Int {
        overs.reduce(0) { $0 + $1.legalBallCount }
    }

    var oversDisplay: String {
        let full = legalBalls / 6
        let rem = legalBalls % 6
        return "\(full).\(rem)"
    }

    var currentBowlerName: String? {
        overs.last(where: { !$0.isComplete })?.bowlerName
    }

    var battersUsed: Set<String> {
        Set(fallOfWickets.map(\.batterName) + [strikerName, nonStrikerName].compactMap { $0 })
    }

    var nextAvailableBatter: String? {
        battingOrder.first { !battersUsed.contains($0) }
    }
}

struct Match: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var teamAName: String
    var teamBName: String
    var teamAPlayers: [String]
    var teamBPlayers: [String]
    var oversLimit: Int
    var ballsPerOver: Int = 6

    var innings: [InningsState] = []
    var currentInningIndex: Int = 0
    var status: String = "inprogress"
    var createdAt: Date = Date()
    var resultText: String?

    var current: InningsState? {
        innings.indices.contains(currentInningIndex) ? innings[currentInningIndex] : nil
    }

    func players(for teamName: String) -> [String] {
        teamName == teamAName ? teamAPlayers : teamBPlayers
    }

    func maxWickets(for teamName: String) -> Int {
        max(1, players(for: teamName).count - 1)
    }

    /// Second-innings target and required-rate context. nil during the first innings.
    var chasing: (target: Int, ballsLeft: Int, runsNeeded: Int, requiredRate: Double)? {
        guard currentInningIndex == 1, let inning = current, innings.count > 0 else { return nil }
        let target = innings[0].runs + 1
        let ballsBowled = inning.legalBalls
        let totalBalls = oversLimit * ballsPerOver
        let ballsLeft = max(0, totalBalls - ballsBowled)
        let runsNeeded = max(0, target - inning.runs)
        let requiredRate = ballsLeft > 0 ? (Double(runsNeeded) / Double(ballsLeft)) * 6 : 0
        return (target, ballsLeft, runsNeeded, requiredRate)
    }
}
