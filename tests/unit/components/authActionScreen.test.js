// Firebase Auth email-action landing screen (src/components/authActionScreen.js). `auth` (the
// Firebase Auth SDK instance, a bare global, not extracted) is called directly from a mount-time
// useEffect, so every test stubs it and wraps the initial render in act(). `sendPasswordReset`
// (also a bare global) is only ever called from the "resend" button's handler.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { AuthActionScreen } from "../../../src/components/authActionScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

afterEach(() => {
  delete globalThis.auth;
  delete globalThis.sendPasswordReset;
});

async function renderScreen(mode, authStub, extraProps = {}) {
  globalThis.auth = authStub;
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(AuthActionScreen, { mode, oobCode: "code123", onDone: () => {}, ...extraProps }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("AuthActionScreen: resetPassword mode verifies the code, then shows the new-password form", async () => {
  const inst = await renderScreen("resetPassword", {
    verifyPasswordResetCode: () => Promise.resolve("robin@example.com")
  });
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Choose a new password/);
  assert.match(text, /robin@example\.com/);
});

test("AuthActionScreen: resetPassword form validates length and matching before calling confirmPasswordReset", async () => {
  let confirmedWith = null;
  const inst = await renderScreen("resetPassword", {
    verifyPasswordResetCode: () => Promise.resolve("robin@example.com"),
    confirmPasswordReset: (code, pw) => { confirmedWith = pw; return Promise.resolve(); }
  });
  const inputs = inst.root.findAllByType("input");
  const resetBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Reset password");

  act(() => { inputs[0].props.onChange({ target: { value: "short" } }); });
  act(() => { inputs[1].props.onChange({ target: { value: "short" } }); });
  await act(async () => { resetBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /at least 6 characters/);

  act(() => { inputs[0].props.onChange({ target: { value: "longenough" } }); });
  act(() => { inputs[1].props.onChange({ target: { value: "different" } }); });
  await act(async () => { resetBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /don't match/);

  act(() => { inputs[1].props.onChange({ target: { value: "longenough" } }); });
  await act(async () => {
    resetBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(confirmedWith, "longenough");
  assert.match(JSON.stringify(inst.toJSON()), /Done/);
});

test("AuthActionScreen: verifyEmail mode applies the code, then shows success", async () => {
  const inst = await renderScreen("verifyEmail", {
    applyActionCode: () => Promise.resolve()
  });
  assert.match(JSON.stringify(inst.toJSON()), /email is verified/);
});

test("AuthActionScreen: recoverEmail mode restores the original address and offers a password-reset resend", async () => {
  globalThis.sendPasswordReset = () => Promise.resolve({ ok: true });
  const inst = await renderScreen("recoverEmail", {
    checkActionCode: () => Promise.resolve({ data: { email: "old@example.com" } }),
    applyActionCode: () => Promise.resolve()
  });
  let text = JSON.stringify(inst.toJSON());
  assert.match(text, /old@example\.com/);

  const resendBtn = inst.root.findByProps({ children: "Send me a password reset link" });
  await act(async () => {
    resendBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  text = JSON.stringify(inst.toJSON());
  assert.match(text, /Reset link sent/);
});

test("AuthActionScreen: a failing verification shows the friendly error and a 'Back to sign in' button", async () => {
  let backClicked = false;
  const inst = await renderScreen(
    "resetPassword",
    { verifyPasswordResetCode: () => Promise.reject({ code: "auth/expired-action-code", message: "expired" }) },
    { onDone: () => { backClicked = true; } }
  );
  assert.match(JSON.stringify(inst.toJSON()), /Link didn't work/);
  const backBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Back to sign in");
  backBtn.props.onClick();
  assert.equal(backClicked, true);
});
