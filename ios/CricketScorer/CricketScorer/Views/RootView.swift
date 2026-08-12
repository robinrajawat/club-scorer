import SwiftUI

struct RootView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.user != nil {
                // Placeholder — HomeView (matches list, new match, teams, tournaments)
                // gets ported next, once auth is verified end-to-end on device.
                VStack(spacing: 8) {
                    Text("Signed in")
                        .font(.title2)
                    if let email = authViewModel.user?.email {
                        Text(email)
                            .foregroundStyle(.secondary)
                    }
                    Button("Sign out") {
                        authViewModel.signOut()
                    }
                    .padding(.top, 16)
                }
            } else {
                WelcomeView()
            }
        }
        .animation(.default, value: authViewModel.user)
    }
}
