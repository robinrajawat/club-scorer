import SwiftUI

private enum EmailMode {
    case signIn, signUp, reset
}

struct WelcomeView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel

    @State private var emailMode: EmailMode?
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var resetSent = false
    @State private var isSubmitting = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                googleButton

                Text("Sync your matches and teams across devices, join clubs, and share live scores.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                divider

                emailSection
            }
            .padding(20)
            .frame(maxWidth: 400)
        }
    }

    private var header: some View {
        VStack(spacing: 6) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color("PitchColor"), Color("PitchDarkColor")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 64, height: 64)
                .overlay(Image(systemName: "circle.fill").foregroundStyle(.white).font(.title3))

            Text("Club Scorer")
                .font(.custom("DMSerifDisplay-Regular", size: 34))
                .foregroundStyle(Color("PitchColor"))

            Text("Ball-by-ball scoring for friendly games")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 32)
    }

    private var googleButton: some View {
        Button {
            Task {
                errorMessage = nil
                isSubmitting = true
                let result = await authViewModel.signInWithGoogle()
                isSubmitting = false
                if case .failure(let message) = result {
                    errorMessage = message
                }
            }
        } label: {
            HStack {
                Image(systemName: "g.circle")
                Text(isSubmitting ? "Opening Google…" : "Sign in with Google")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .buttonStyle(.bordered)
        .disabled(isSubmitting)
    }

    private var divider: some View {
        HStack(spacing: 10) {
            Rectangle().fill(Color.secondary.opacity(0.25)).frame(height: 1)
            Text("OR").font(.caption2).fontWeight(.semibold).foregroundStyle(.secondary)
            Rectangle().fill(Color.secondary.opacity(0.25)).frame(height: 1)
        }
    }

    @ViewBuilder
    private var emailSection: some View {
        if emailMode == nil {
            Button("Continue with email") {
                openEmailMode(.signIn)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
        } else {
            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(.roundedBorder)

                if emailMode != .reset {
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                }

                if resetSent {
                    Text("Check your inbox for a reset link.")
                        .font(.footnote)
                        .foregroundStyle(.green)
                }

                Button(submitLabel) {
                    Task { await handleEmailSubmit() }
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                .disabled(isSubmitting)

                modeSwitcher
            }
        }
    }

    private var submitLabel: String {
        switch emailMode {
        case .signIn: return "Sign in"
        case .signUp: return "Create account"
        case .reset: return "Send reset link"
        case .none: return ""
        }
    }

    private var modeSwitcher: some View {
        HStack {
            if emailMode == .signIn {
                Button("Forgot password?") { openEmailMode(.reset) }
                Spacer()
                Button("Create account") { openEmailMode(.signUp) }
            } else if emailMode == .signUp {
                Button("Already have an account? Sign in") { openEmailMode(.signIn) }
            } else {
                Button("Back to sign in") { openEmailMode(.signIn) }
            }
        }
        .font(.footnote)
    }

    private func openEmailMode(_ mode: EmailMode) {
        emailMode = mode
        errorMessage = nil
        resetSent = false
    }

    private func handleEmailSubmit() async {
        guard email.contains("@") else {
            errorMessage = "Enter a valid email address."
            return
        }
        if emailMode != .reset, password.isEmpty {
            errorMessage = "Enter a password."
            return
        }

        isSubmitting = true
        errorMessage = nil

        let result: Result<Void, String>
        switch emailMode {
        case .signUp:
            result = await authViewModel.signUp(email: email, password: password)
        case .reset:
            result = await authViewModel.sendPasswordReset(email: email)
        default:
            result = await authViewModel.signIn(email: email, password: password)
        }

        isSubmitting = false

        switch result {
        case .success:
            if emailMode == .reset {
                resetSent = true
            }
            // signIn/signUp: AuthViewModel's state listener picks up the signed-in
            // user and RootView navigates away — nothing more to do here.
        case .failure(let message):
            errorMessage = message
        }
    }
}
