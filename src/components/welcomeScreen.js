import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { AppMark } from "./illustrations.js";
import { GoogleGLogo } from "./icons.js";
import { TextField, Btn } from "./formUiAtoms.js";

// Signed-out landing screen: "Sign in with Google", email sign-in/sign-up/reset, or "Continue
// without an account". Covered by tests/unit/components/welcomeScreen.test.js.
//
// `signUpEmail`, `signInEmail`, `sendPasswordReset` are bare-global Firebase Auth wrappers (not
// extracted), called only from the email-submit handler -- never during render or a mount effect,
// so no act()-wrapped-mount stubbing is needed here, just a plain stub per test.

export function WelcomeScreen({
  onSignIn,
  onSkip
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailMode, setEmailMode] = useState(null); // null | 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  async function handleSignIn() {
    setBusy(true);
    setError("");
    const result = await onSignIn();
    setBusy(false);
    if (result && result.ok === false && result.error) setError(result.error);
    if (result && result.needsLink) {
      setEmail(result.linkEmail);
      openEmailMode("signin");
    }
  }
  function openEmailMode(mode) {
    setEmailMode(mode);
    setEmailError("");
    setResetSent(false);
  }
  async function handleEmailSubmit() {
    if (emailBusy) return;
    if (!email.trim() || !email.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (emailMode !== "reset" && !password) {
      setEmailError("Enter a password.");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    const result = emailMode === "signup" ? await signUpEmail(email, password) : emailMode === "reset" ? await sendPasswordReset(email) : await signInEmail(email, password);
    setEmailBusy(false);
    if (!result.ok) {
      setEmailError(result.error);
      return;
    }
    if (emailMode === "reset") {
      setResetSent(true);
    }
    // signin/signup: onAuthStateChanged elsewhere picks up the now-signed-in user and navigates
    // away from this screen — nothing more to do here.
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px 40px",
      maxWidth: 400,
      margin: "0 auto",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: "50%",
      margin: "0 auto 16px",
      boxShadow: "0 6px 18px rgba(45,80,22,0.35)"
    }
  }, /*#__PURE__*/React.createElement(AppMark, {
    size: 64
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 34,
      color: COLORS.pitch,
      letterSpacing: -0.5
    }
  }, "Club Scorer"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      marginTop: 5
    }
  }, "Ball-by-ball scoring for friendly games")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: `1.5px solid rgba(139,30,30,0.25)`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    onClick: handleSignIn,
    disabled: busy,
    className: "cs-btn",
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 14.5,
      borderRadius: 10,
      minHeight: 48,
      cursor: busy ? "not-allowed" : "pointer",
      border: `1.5px solid ${COLORS.willow}`,
      background: "none",
      color: COLORS.pitch,
      opacity: busy ? 0.6 : 1,
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent"
    }
  }, /*#__PURE__*/React.createElement(GoogleGLogo, {
    size: 17
  }), busy ? "Opening Google…" : "Sign in with Google"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      textAlign: "center",
      lineHeight: 1.5,
      margin: "10px 0 20px"
    }
  }, "Sync your matches and teams across devices, join clubs, and share live scores."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "0 0 4px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: COLORS.creamDark
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 600,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5
    }
  }, "or"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: COLORS.creamDark
    }
  })), !emailMode ? /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode("signin"),
    className: "cs-btn",
    style: {
      width: "100%",
      minHeight: 44,
      background: "none",
      border: `1.5px solid ${COLORS.willow}`,
      borderRadius: 10,
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      cursor: "pointer",
      padding: "12px 10px",
      marginBottom: 4,
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent"
    }
  }, "Sign in with email") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 4
    }
  }, emailError && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: `1.5px solid rgba(139,30,30,0.25)`,
      borderRadius: 12,
      padding: "10px 12px",
      marginBottom: 10,
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, emailError), emailMode === "reset" && resetSent ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.turf,
      textAlign: "center",
      padding: "10px 0"
    }
  }, "Check ", email, " for a reset link.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    value: email,
    onChange: setEmail,
    placeholder: "Email",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "email",
    inputMode: "email",
    style: {
      marginBottom: 8
    }
  }), emailMode !== "reset" && /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "Password",
    autoComplete: emailMode === "signup" ? "new-password" : "current-password",
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 15,
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.ink,
      width: "100%",
      boxSizing: "border-box",
      boxShadow: "inset 0 1px 2px rgba(42,36,32,0.05)",
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleEmailSubmit,
    disabled: emailBusy,
    style: {
      width: "100%",
      marginBottom: 8
    }
  }, emailBusy ? "\u2026" : emailMode === "signup" ? "Create account" : emailMode === "reset" ? "Send reset email" : "Sign in")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode(null),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: 4,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, "\u2190 Back"), emailMode !== "reset" ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode(emailMode === "signup" ? "signin" : "signup"),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontWeight: 600,
      cursor: "pointer",
      padding: 4,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, emailMode === "signup" ? "Sign in instead" : "Create account"), emailMode === "signin" && /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode("reset"),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontWeight: 600,
      cursor: "pointer",
      padding: 4,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, "Forgot password?")) : null)), /*#__PURE__*/React.createElement("button", {
    onClick: onSkip,
    className: "cs-btn",
    style: {
      width: "100%",
      minHeight: 44,
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      cursor: "pointer",
      padding: "13px 10px",
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent"
    }
  }, "Continue without an account"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      textAlign: "center",
      marginTop: 4,
      lineHeight: 1.5
    }
  }, "Matches and teams stay on this device only. You can sign in anytime from Account."));
}
