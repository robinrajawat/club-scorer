import SwiftUI

struct RootView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.user != nil {
                HomeView()
            } else {
                WelcomeView()
            }
        }
        .animation(.default, value: authViewModel.user)
    }
}
