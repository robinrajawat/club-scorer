import Foundation

enum ScoringEngine {

    static func newInnings(battingTeam: String, bowlingTeam: String, battingOrder: [String]) -> InningsState {
        var inning = InningsState(battingTeam: battingTeam, bowlingTeam: bowlingTeam, battingOrder: battingOrder)
        inning.strikerName = battingOrder.first
        inning.nonStrikerName = battingOrder.count > 1 ? battingOrder[1] : nil
        return inning
    }

    /// Applies a completed ball to the match, mutating in place. Returns true if the innings
    /// (or match) just completed as a result, so the caller can navigate accordingly.
    @discardableResult
    static func apply(_ ball: BallEvent, to match: inout Match) -> Bool {
        guard var inning = match.current else { return false }

        if inning.overs.isEmpty || inning.overs.last!.isComplete {
            inning.overs.append(Over(bowlerName: ball.bowlerName))
        }
        inning.overs[inning.overs.count - 1].balls.append(ball)
        inning.runs += ball.totalRuns

        if ball.isWicket {
            inning.wickets += 1
            inning.fallOfWickets.append(
                FallOfWicket(
                    batterName: ball.dismissedBatterName ?? ball.strikerName,
                    score: inning.runs,
                    overSummary: "\(inning.oversDisplay) ov"
                )
            )
            if ball.dismissedBatterName == inning.nonStrikerName {
                inning.nonStrikerName = nil
            } else {
                inning.strikerName = nil
            }
        } else {
            // Batters physically cross the pitch on odd runs, regardless of whether the ball
            // was legal — this models that crossing, independent of the end-of-over swap below.
            let rotates = ball.runs % 2 == 1
            if rotates, let s = inning.strikerName, let n = inning.nonStrikerName {
                inning.strikerName = n
                inning.nonStrikerName = s
            }
        }

        if ball.isLegal, inning.overs.last!.isComplete, !inning.complete {
            if let s = inning.strikerName, let n = inning.nonStrikerName {
                inning.strikerName = n
                inning.nonStrikerName = s
            }
        }

        let maxWickets = match.maxWickets(for: inning.battingTeam)
        let ballsBowled = inning.legalBalls
        let oversDone = ballsBowled >= match.oversLimit * match.ballsPerOver
        let allOut = inning.wickets >= maxWickets
        var targetChased = false
        if match.currentInningIndex == 1, let target = match.innings.first.map({ $0.runs + 1 }) {
            targetChased = inning.runs >= target
        }

        if oversDone || allOut || targetChased {
            inning.complete = true
        }

        match.innings[match.currentInningIndex] = inning

        if inning.complete {
            return advance(&match)
        }
        return false
    }

    /// Moves to the second innings, or finalizes the match result if the second innings just ended.
    private static func advance(_ match: inout Match) -> Bool {
        if match.currentInningIndex == 0 {
            let first = match.innings[0]
            let battingTeam = first.bowlingTeam
            let bowlingTeam = first.battingTeam
            let order = match.players(for: battingTeam)
            match.innings.append(newInnings(battingTeam: battingTeam, bowlingTeam: bowlingTeam, battingOrder: order))
            match.currentInningIndex = 1
            return true
        } else {
            match.status = "complete"
            match.resultText = resultSummary(for: match)
            return true
        }
    }

    static func resultSummary(for match: Match) -> String {
        guard match.innings.count == 2 else { return "" }
        let first = match.innings[0]
        let second = match.innings[1]
        if second.runs >= first.runs + 1 {
            let maxWickets = match.maxWickets(for: second.battingTeam)
            let wicketsLeft = maxWickets - second.wickets
            return "\(second.battingTeam) won by \(wicketsLeft) wicket\(wicketsLeft == 1 ? "" : "s")"
        } else if second.runs == first.runs {
            return "Match tied"
        } else {
            let margin = first.runs - second.runs
            return "\(first.battingTeam) won by \(margin) run\(margin == 1 ? "" : "s")"
        }
    }

    /// Legal balls remaining in the over currently being bowled (0 if a new over is needed).
    static func ballsLeftInOver(_ inning: InningsState) -> Int {
        guard let last = inning.overs.last, !last.isComplete else { return 6 }
        return 6 - last.legalBallCount
    }
}
