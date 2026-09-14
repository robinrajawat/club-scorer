// Signed-out landing screen (src/components/welcomeScreen.js). `signUpEmail`/`signInEmail`/
// `sendPasswordReset` are bare-global Firebase Auth wrappers, called only from the email-submit
// handler -- never during render or a mount effect -- so each test just stubs the one it needs.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { WelcomeScreen } from "../../../src/components/welcomeScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";

afterEach(() => {
  delete globalThis.signUpEmail;
  delete globalThis.signInEmail;
  delete globalThis.sendPasswordReset;
});

function baseProps(overrides = {}) {
  return { onSignIn: () => Promise.resolve({}), onSkip: () => {}, onWatch: () => {}, ...overrides };
}

function hasText(node, str) {
  if (typeof node === "string") return node.includes(str);
  if (Array.isArray(node)) return node.some(n => hasText(n, str));
  if (node && typeof node === "object" && node.props) return hasText(node.props.children, str);
  return false;
}

// Everything below "I'm watching"/"I'm scoring" is reached only after tapping "I'm scoring" --
// see welcomeScreen.js's own comment on why sign-in is no longer what a signed-out visitor lands
// on by default.
function renderScoring(props) {
  const inst = renderer.create(React.createElement(WelcomeScreen, baseProps(props)));
  const scoringBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "I'm scoring"));
  act(() => { scoringBtn.props.onClick(); });
  return inst;
}

// Reported live: most people who opened the app just to follow a tournament never realized they
// needed to find the Live tab at all, having landed on what read as a sign-in wall first. The
// entry screen now opens on an intent choice instead of presenting sign-in as the default.
test("WelcomeScreen: opens on an intent choice -- 'I'm watching' calls onWatch directly, with no sign-in content shown", () => {
  let watched = false;
  const inst = renderer.create(React.createElement(WelcomeScreen, baseProps({ onWatch: () => { watched = true; } })));
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Sign in with Google/, "sign-in content isn't shown until 'I'm scoring' is chosen");
  const watchBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "I'm watching"));
  act(() => { watchBtn.props.onClick(); });
  assert.equal(watched, true);
});

test("WelcomeScreen: 'I'm scoring' reveals the sign-in content, and Back returns to the intent choice", () => {
  const inst = renderScoring();
  assert.match(JSON.stringify(inst.toJSON()), /Sign in with Google/);
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /I'm watching/);

  const backBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Back"));
  act(() => { backBtn.props.onClick(); });
  assert.match(JSON.stringify(inst.toJSON()), /I'm watching/);
  assert.doesNotMatch(JSON.stringify(inst.toJSON()), /Sign in with Google/);
});

test("WelcomeScreen: clicking 'Sign in with Google' calls onSignIn", async () => {
  let called = false;
  const inst = renderScoring({ onSignIn: () => { called = true; return Promise.resolve({ ok: true }); } });
  const googleBtn = inst.root.findAllByType("button").find(b => Array.isArray(b.props.children) && (b.props.children[1] === "Sign in with Google" || b.props.children[1] === "Opening Google…"));
  await act(async () => {
    googleBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(called, true);
});

test("WelcomeScreen: a failed onSignIn shows the returned error", async () => {
  const inst = renderScoring({ onSignIn: () => Promise.resolve({ ok: false, error: "Sign-in was cancelled." }) });
  const googleBtn = inst.root.findAllByType("button").find(b => Array.isArray(b.props.children) && (b.props.children[1] === "Sign in with Google" || b.props.children[1] === "Opening Google…"));
  await act(async () => {
    googleBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /Sign-in was cancelled\./);
});

test("WelcomeScreen: onSignIn returning needsLink pre-fills the email and opens email sign-in mode", async () => {
  const inst = renderScoring({ onSignIn: () => Promise.resolve({ needsLink: true, linkEmail: "robin@example.com" }) });
  const googleBtn = inst.root.findAllByType("button").find(b => Array.isArray(b.props.children) && (b.props.children[1] === "Sign in with Google" || b.props.children[1] === "Opening Google…"));
  await act(async () => {
    googleBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  const emailInputs = inst.root.findAllByType("input").filter(i => i.props.type !== "password");
  assert.equal(emailInputs[0].props.value, "robin@example.com");
});

test("WelcomeScreen: 'Continue without an account' calls onSkip", () => {
  let skipped = false;
  const inst = renderScoring({ onSkip: () => { skipped = true; } });
  const skipBtn = inst.root.findAllByType("button").find(b => b.props.children === "Continue without an account");
  skipBtn.props.onClick();
  assert.equal(skipped, true);
});

test("WelcomeScreen: email sign-in validates a missing password before calling signInEmail", async () => {
  globalThis.signInEmail = () => { throw new Error("should not be called"); };
  const inst = renderScoring();
  const openBtn = inst.root.findAllByType("button").find(b => b.props.children === "Sign in with email");
  act(() => { openBtn.props.onClick(); });

  const emailField = inst.root.findAllByType("input").find(i => i.props.type !== "password");
  act(() => { emailField.props.onChange({ target: { value: "robin@example.com" } }); });

  const submitBtn = inst.root.findByType(Btn);
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /Enter a password\./);
});

test("WelcomeScreen: email sign-in submits email+password to signInEmail", async () => {
  let signedInWith = null;
  globalThis.signInEmail = (email, password) => { signedInWith = { email, password }; return Promise.resolve({ ok: true }); };
  const inst = renderScoring();
  const openBtn = inst.root.findAllByType("button").find(b => b.props.children === "Sign in with email");
  act(() => { openBtn.props.onClick(); });

  const emailField = inst.root.findAllByType("input").find(i => i.props.type !== "password");
  act(() => { emailField.props.onChange({ target: { value: "robin@example.com" } }); });
  const passwordInput = inst.root.findAllByType("input").find(i => i.props.type === "password");
  act(() => { passwordInput.props.onChange({ target: { value: "hunter22" } }); });

  const submitBtn = inst.root.findByType(Btn);
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.deepEqual(signedInWith, { email: "robin@example.com", password: "hunter22" });
});

test("WelcomeScreen: 'Forgot password?' switches to reset mode, and a successful reset shows a confirmation", async () => {
  globalThis.sendPasswordReset = () => Promise.resolve({ ok: true });
  const inst = renderScoring();
  const openBtn = inst.root.findAllByType("button").find(b => b.props.children === "Sign in with email");
  act(() => { openBtn.props.onClick(); });

  const forgotBtn = inst.root.findAllByType("button").find(b => b.props.children === "Forgot password?");
  act(() => { forgotBtn.props.onClick(); });

  const emailField = inst.root.findAllByType("input").find(i => i.props.type !== "password");
  act(() => { emailField.props.onChange({ target: { value: "robin@example.com" } }); });

  const submitBtn = inst.root.findByType(Btn);
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /Check .*robin@example\.com.* for a reset link\./);
});

test("WelcomeScreen: 'Create account' switches between sign-in and sign-up labels, calling signUpEmail", async () => {
  let signedUp = false;
  globalThis.signUpEmail = () => { signedUp = true; return Promise.resolve({ ok: true }); };
  const inst = renderScoring();
  const openBtn = inst.root.findAllByType("button").find(b => b.props.children === "Sign in with email");
  act(() => { openBtn.props.onClick(); });

  const createAcctBtn = inst.root.findAllByType("button").find(b => b.props.children === "Create account");
  act(() => { createAcctBtn.props.onClick(); });

  const emailField = inst.root.findAllByType("input").find(i => i.props.type !== "password");
  act(() => { emailField.props.onChange({ target: { value: "robin@example.com" } }); });
  const passwordInput = inst.root.findAllByType("input").find(i => i.props.type === "password");
  act(() => { passwordInput.props.onChange({ target: { value: "hunter22" } }); });

  const submitBtn = inst.root.findByType(Btn);
  assert.equal(submitBtn.props.children, "Create account");
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(signedUp, true);
});
