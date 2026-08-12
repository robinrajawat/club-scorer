import Foundation
import FirebaseAuth

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var user: AppUser?
    @Published var isBusy = false

    private var handle: AuthStateDidChangeListenerHandle?

    init() {
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, firebaseUser in
            self?.user = firebaseUser.map {
                AppUser(uid: $0.uid, email: $0.email, displayName: $0.displayName)
            }
        }
    }

    deinit {
        if let handle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    // MARK: - Email / password

    func signIn(email: String, password: String) async -> Result<Void, String> {
        isBusy = true
        defer { isBusy = false }
        do {
            try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespaces), password: password)
            return .success(())
        } catch {
            return .failure(friendlyMessage(for: error))
        }
    }

    func signUp(email: String, password: String) async -> Result<Void, String> {
        isBusy = true
        defer { isBusy = false }
        do {
            try await Auth.auth().createUser(withEmail: email.trimmingCharacters(in: .whitespaces), password: password)
            return .success(())
        } catch {
            return .failure(friendlyMessage(for: error))
        }
    }

    func sendPasswordReset(email: String) async -> Result<Void, String> {
        isBusy = true
        defer { isBusy = false }
        do {
            try await Auth.auth().sendPasswordReset(withEmail: email.trimmingCharacters(in: .whitespaces))
            return .success(())
        } catch {
            return .failure(friendlyMessage(for: error))
        }
    }

    // MARK: - Google

    // Ported later: needs the GoogleSignIn-iOS SDK plus the REVERSED_CLIENT_ID URL
    // scheme registered from GoogleService-Info.plist. Wiring this before that setup
    // exists would fail silently on device, so it's stubbed until both are in place.
    func signInWithGoogle() async -> Result<Void, String> {
        .failure("Google sign-in isn't wired up yet — coming once GoogleService-Info.plist is added.")
    }

    func signOut() {
        try? Auth.auth().signOut()
    }

    // MARK: - Error mapping
    // Mirrors friendlyEmailAuthError() from the web app's index.html so error copy
    // stays consistent across platforms.

    private func friendlyMessage(for error: Error) -> String {
        let code = AuthErrorCode(rawValue: (error as NSError).code)
        switch code {
        case .emailAlreadyInUse:
            return "That email already has an account — try signing in instead. If you originally signed up with Google, use \u{201c}Continue with Google\u{201d} rather than a password."
        case .weakPassword:
            return "Choose a stronger password (6+ characters)."
        case .invalidEmail:
            return "That email address doesn't look right."
        case .missingPassword:
            return "Enter a password."
        case .invalidCredential, .userNotFound, .wrongPassword:
            return "Email or password didn't match — double-check them, use \u{201c}Forgot password?\u{201d}, or if you originally signed up with Google, use \u{201c}Continue with Google\u{201d} instead."
        case .tooManyRequests:
            return "Too many attempts — wait a bit and try again."
        case .networkError:
            return "Network error — check your connection and try again."
        case .operationNotAllowed:
            return "Email/password sign-in isn't turned on for this app yet."
        default:
            return error.localizedDescription
        }
    }
}
