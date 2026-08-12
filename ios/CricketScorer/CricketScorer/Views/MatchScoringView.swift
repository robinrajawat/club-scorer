import SwiftUI

struct MatchScoringView: View {
    @State private var match: Match
    @ObservedObject var store: MatchStore

    @State private var extraSheet: ExtraType?
    @State private var extraRuns = 0
    @State private var showingWicketSheet = false
    @State private var wicketType: WicketType = .bowled
    @State private var dismissedIsStriker = true
    @State private var pendingBowler: String?
    @State private var pendingBatter: String?
    @State private var navigateToResult = false

    init(match: Match, store: MatchStore) {
        _match = State(initialValue: match)
        self.store = store
    }

    private var inning: InningsState { match.current! }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                scoreHeader
                overStrip
                battersPanel

                if needsNewBowler {
                    bowlerPrompt
                } else if needsNewBatter {
                    batterPrompt
                } else {
                    scoringPad
                }
            }
            .padding()
        }
        .navigationTitle("\(match.teamAName) vs \(match.teamBName)")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $navigateToResult) {
            ResultView(match: match)
        }
        .sheet(item: $extraSheet) { type in
            extraRunsSheet(for: type)
        }
        .sheet(isPresented: $showingWicketSheet) {
            wicketSheet
        }
    }

    // MARK: - Header

    private var scoreHeader: some View {
        VStack(spacing: 6) {
            Text(inning.battingTeam).font(.headline)
            Text("\(inning.runs)/\(inning.wickets)")
                .font(.system(size: 40, weight: .bold, design: .rounded))
            Text("\(inning.oversDisplay) overs")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if let chase = match.chasing {
                Text("Need \(chase.runsNeeded) off \(chase.ballsLeft) balls · RRR \(chase.requiredRate, specifier: "%.2f")")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var overStrip: some View {
        Group {
            if let over = inning.overs.last {
                HStack(spacing: 6) {
                    ForEach(over.balls) { ball in
                        Text(ballLabel(ball))
                            .font(.caption2.weight(.semibold))
                            .frame(width: 26, height: 26)
                            .background(ball.isWicket ? Color.red.opacity(0.15) : Color.secondary.opacity(0.12))
                            .clipShape(Circle())
                    }
                }
            }
        }
    }

    private func ballLabel(_ ball: BallEvent) -> String {
        if ball.isWicket { return "W" }
        switch ball.extraType {
        case .wide: return "wd\(ball.runs > 0 ? "+\(ball.runs)" : "")"
        case .noBall: return "nb\(ball.runs > 0 ? "+\(ball.runs)" : "")"
        case .bye: return "b\(ball.runs)"
        case .legBye: return "lb\(ball.runs)"
        case .none: return "\(ball.runs)"
        }
    }

    private var battersPanel: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let striker = inning.strikerName {
                Label(striker + "*", systemImage: "figure.cricket")
            }
            if let nonStriker = inning.nonStrikerName {
                Text(nonStriker)
                    .foregroundStyle(.secondary)
            }
            if let bowler = inning.currentBowlerName {
                Text("Bowler: \(bowler)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Prompts

    private var needsNewBowler: Bool {
        !inning.complete && inning.currentBowlerName == nil
    }

    private var needsNewBatter: Bool {
        !inning.complete && (inning.strikerName == nil || inning.nonStrikerName == nil)
    }

    private var bowlingTeamPlayers: [String] {
        match.players(for: inning.bowlingTeam)
    }

    private var bowlerPrompt: some View {
        let lastBowler = inning.overs.last?.bowlerName
        let options = bowlingTeamPlayers.filter { $0 != lastBowler }
        return VStack(spacing: 12) {
            Text("Select next bowler").font(.subheadline.weight(.semibold))
            Picker("Bowler", selection: Binding(
                get: { pendingBowler ?? options.first ?? "" },
                set: { pendingBowler = $0 }
            )) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.wheel)
            .frame(height: 120)

            Button("Confirm bowler") {
                var updated = match
                var inn = updated.current!
                let bowler = pendingBowler ?? options.first ?? ""
                inn.overs.append(Over(bowlerName: bowler))
                updated.innings[updated.currentInningIndex] = inn
                match = updated
                pendingBowler = nil
                persist()
            }
            .buttonStyle(.borderedProminent)
            .disabled(options.isEmpty)
        }
    }

    private var batterPrompt: some View {
        let options = match.players(for: inning.battingTeam).filter { !inning.battersUsed.contains($0) }
        return VStack(spacing: 12) {
            Text("Select next batter").font(.subheadline.weight(.semibold))
            Picker("Batter", selection: Binding(
                get: { pendingBatter ?? options.first ?? "" },
                set: { pendingBatter = $0 }
            )) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.wheel)
            .frame(height: 120)

            Button("Confirm batter") {
                var updated = match
                var inn = updated.current!
                let batter = pendingBatter ?? options.first ?? ""
                if inn.strikerName == nil {
                    inn.strikerName = batter
                } else {
                    inn.nonStrikerName = batter
                }
                updated.innings[updated.currentInningIndex] = inn
                match = updated
                pendingBatter = nil
                persist()
            }
            .buttonStyle(.borderedProminent)
            .disabled(options.isEmpty)
        }
    }

    // MARK: - Scoring pad

    private var scoringPad: some View {
        VStack(spacing: 16) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 10) {
                ForEach([0, 1, 2, 3, 4, 5, 6], id: \.self) { runs in
                    Button("\(runs)") { recordRuns(runs) }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
            }

            HStack(spacing: 10) {
                extraButton("Wide", .wide)
                extraButton("No ball", .noBall)
                extraButton("Bye", .bye)
                extraButton("Leg bye", .legBye)
            }

            Button {
                showingWicketSheet = true
            } label: {
                Text("Wicket")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
    }

    private func extraButton(_ title: String, _ type: ExtraType) -> some View {
        Button(title) {
            extraRuns = 0
            extraSheet = type
        }
        .buttonStyle(.bordered)
        .frame(maxWidth: .infinity, minHeight: 40)
    }

    private func extraRunsSheet(for type: ExtraType) -> some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text(extraLabel(type)).font(.headline)
                Stepper("Runs: \(extraRuns)", value: $extraRuns, in: 0...4)
                Button("Add") {
                    recordExtra(type, runs: extraRuns)
                    extraSheet = nil
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .presentationDetents([.height(200)])
        }
    }

    private func extraLabel(_ type: ExtraType) -> String {
        switch type {
        case .wide: return "Wide — runs beyond the penalty"
        case .noBall: return "No ball — runs off the bat"
        case .bye: return "Byes"
        case .legBye: return "Leg byes"
        case .none: return ""
        }
    }

    private var wicketSheet: some View {
        NavigationStack {
            Form {
                Picker("How out", selection: $wicketType) {
                    ForEach(WicketType.allCases) { Text($0.label).tag($0) }
                }
                if inning.nonStrikerName != nil {
                    Picker("Who's out", selection: $dismissedIsStriker) {
                        Text(inning.strikerName ?? "Striker").tag(true)
                        Text(inning.nonStrikerName ?? "Non-striker").tag(false)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Wicket")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm") {
                        recordWicket()
                        showingWicketSheet = false
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingWicketSheet = false }
                }
            }
        }
    }

    // MARK: - Recording

    private func recordRuns(_ runs: Int) {
        guard let striker = inning.strikerName, let nonStriker = inning.nonStrikerName,
              let bowler = inning.currentBowlerName else { return }
        let ball = BallEvent(
            runs: runs, extraType: .none, isWicket: false, wicketType: nil,
            dismissedBatterName: nil, strikerName: striker, nonStrikerName: nonStriker, bowlerName: bowler
        )
        apply(ball)
    }

    private func recordExtra(_ type: ExtraType, runs: Int) {
        guard let striker = inning.strikerName, let nonStriker = inning.nonStrikerName,
              let bowler = inning.currentBowlerName else { return }
        let ball = BallEvent(
            runs: runs, extraType: type, isWicket: false, wicketType: nil,
            dismissedBatterName: nil, strikerName: striker, nonStrikerName: nonStriker, bowlerName: bowler
        )
        apply(ball)
    }

    private func recordWicket() {
        guard let striker = inning.strikerName, let nonStriker = inning.nonStrikerName,
              let bowler = inning.currentBowlerName else { return }
        let dismissed = dismissedIsStriker ? striker : nonStriker
        let ball = BallEvent(
            runs: 0, extraType: .none, isWicket: true, wicketType: wicketType,
            dismissedBatterName: dismissed, strikerName: striker, nonStrikerName: nonStriker, bowlerName: bowler
        )
        apply(ball)
    }

    private func apply(_ ball: BallEvent) {
        var updated = match
        ScoringEngine.apply(ball, to: &updated)
        match = updated
        persist()
        if updated.status == "complete" {
            navigateToResult = true
        }
    }

    private func persist() {
        store.save(match)
    }
}

extension ExtraType: Identifiable {
    public var id: String { rawValue }
}
