import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Btn } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { friendlyEmailAuthError } from "../core/miscHelpers.js";

// The landing screen for a Firebase Auth email action link (reset password, verify email, undo an
// email change) -- verifies the code on mount, then shows a status-specific view. Covered by
// tests/unit/components/authActionScreen.test.js.
//
// `auth` (the Firebase Auth SDK instance, a bare global, not extracted) is called directly from a
// mount-time useEffect, not just a handler, so every test stubs it -- same pattern as
// AvailabilityPollModal/BetaTestersScreen's own Firestore stubs. `sendPasswordReset` (also a bare
// global, not extracted) is only ever called from the "resend" button's onClick handler.

export function AuthActionScreen({
  mode,
  oobCode,
  onDone
}) {
  const [status, setStatus] = useState("checking"); // checking | resetForm | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [actionEmail, setActionEmail] = useState(""); // the email tied to this code, once known
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mode === "resetPassword") {
          const email = await auth.verifyPasswordResetCode(oobCode);
          if (cancelled) return;
          setActionEmail(email);
          setStatus("resetForm");
        } else if (mode === "verifyEmail") {
          await auth.applyActionCode(oobCode);
          if (cancelled) return;
          setStatus("success");
        } else if (mode === "recoverEmail") {
          // checkActionCode's data.email is the address being RESTORED (the original, pre-change
          // address) -- applyActionCode is what actually reverts the account to it.
          const info = await auth.checkActionCode(oobCode);
          const restoredEmail = info.data && info.data.email;
          await auth.applyActionCode(oobCode);
          if (cancelled) return;
          setActionEmail(restoredEmail || "");
          setStatus("success");
        }
      } catch (e) {
        if (cancelled) return;
        console.error("auth action failed", mode, e.code, e.message);
        setErrorMsg(friendlyEmailAuthError(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);
  async function submitNewPassword() {
    if (saving) return;
    if (newPassword.length < 6) {
      setSaveError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveError("Passwords don't match.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await auth.confirmPasswordReset(oobCode, newPassword);
      setSaving(false);
      setStatus("success");
    } catch (e) {
      setSaving(false);
      console.error("confirm password reset failed", e.code, e.message);
      setSaveError(friendlyEmailAuthError(e));
    }
  }
  async function resendResetLink() {
    if (!actionEmail || resendBusy) return;
    setResendBusy(true);
    const result = await sendPasswordReset(actionEmail);
    setResendBusy(false);
    if (result.ok) setResendSent(true);
  }
  const wrapStyle = {
    padding: "16px 20px 40px",
    maxWidth: 400,
    margin: "0 auto",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxSizing: "border-box"
  };
  const titleStyle = {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 24,
    color: COLORS.pitch,
    marginBottom: 8,
    textAlign: "center"
  };
  const bodyStyle = {
    fontFamily: "'Inter'",
    fontSize: 13.5,
    color: COLORS.inkSoft,
    lineHeight: 1.5,
    textAlign: "center",
    marginBottom: 20
  };
  if (status === "checking") {
    return /*#__PURE__*/React.createElement("div", {
      style: wrapStyle
    }, /*#__PURE__*/React.createElement(LoadingNote, {
      label: "Checking link\u2026",
      size: 26
    }));
  }
  if (status === "error") {
    return /*#__PURE__*/React.createElement("div", {
      style: wrapStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: titleStyle
    }, "Link didn't work"), /*#__PURE__*/React.createElement("div", {
      style: bodyStyle
    }, errorMsg), /*#__PURE__*/React.createElement(Btn, {
      variant: "primary",
      onClick: onDone,
      style: {
        width: "100%"
      }
    }, "Back to sign in"));
  }
  if (status === "resetForm") {
    return /*#__PURE__*/React.createElement("div", {
      style: wrapStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: titleStyle
    }, "Choose a new password"), /*#__PURE__*/React.createElement("div", {
      style: bodyStyle
    }, "For ", /*#__PURE__*/React.createElement("strong", null, actionEmail)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "password",
      value: newPassword,
      onChange: e => setNewPassword(e.target.value),
      placeholder: "New password",
      autoComplete: "new-password",
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
        boxShadow: "inset 0 1px 2px rgba(42,36,32,0.05)"
      }
    }), /*#__PURE__*/React.createElement("input", {
      type: "password",
      value: confirmPassword,
      onChange: e => setConfirmPassword(e.target.value),
      placeholder: "Confirm new password",
      autoComplete: "new-password",
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
        boxShadow: "inset 0 1px 2px rgba(42,36,32,0.05)"
      }
    })), saveError && /*#__PURE__*/React.createElement("div", {
      style: {
        color: COLORS.ball,
        fontSize: 12.5,
        fontFamily: "'Inter'",
        marginBottom: 12,
        textAlign: "center"
      }
    }, saveError), /*#__PURE__*/React.createElement(Btn, {
      variant: "primary",
      onClick: submitNewPassword,
      disabled: saving,
      style: {
        width: "100%"
      }
    }, saving ? "\u2026" : "Reset password"));
  }
  // success
  const successMessage = mode === "resetPassword" ? "Your password has been updated. You can sign in with it now." : mode === "verifyEmail" ? "Your email is verified." : `Your sign-in email has been changed back to ${actionEmail || "its original address"}. If you didn't make this change yourself, reset your password now to secure your account.`;
  return /*#__PURE__*/React.createElement("div", {
    style: wrapStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: titleStyle
  }, "Done"), /*#__PURE__*/React.createElement("div", {
    style: bodyStyle
  }, successMessage), mode === "recoverEmail" && actionEmail && !resendSent && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: resendResetLink,
    disabled: resendBusy,
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      textDecoration: "underline",
      marginBottom: 16
    }
  }, resendBusy ? "\u2026" : "Send me a password reset link"), resendSent && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.turfFixed,
      textAlign: "center",
      marginBottom: 16
    }
  }, "Reset link sent \u2014 check your inbox."), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: onDone,
    style: {
      width: "100%"
    }
  }, "Continue to Club Scorer"));
}
