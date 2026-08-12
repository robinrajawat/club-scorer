import SwiftUI

struct ResultView: View {
    let match: Match

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text(match.resultText ?? "Match complete")
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .padding(.top, 32)

                ForEach(match.innings.indices, id: \.self) { idx in
                    let inning = match.innings[idx]
                    VStack(spacing: 4) {
                        Text(inning.battingTeam).font(.headline)
                        Text("\(inning.runs)/\(inning.wickets) (\(inning.oversDisplay) ov)")
                            .font(.title3)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.secondary.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding()
        }
        .navigationTitle("Result")
        .navigationBarTitleDisplayMode(.inline)
    }
}
