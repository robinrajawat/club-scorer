// The sign-in screen (src/components/welcomeScreen.js), reached only when someone deliberately
// asks for it (Live's "Sign in to score a match" link) -- not what a cold, signed-out visit lands
// on any more (see cricketScorer.test.js for that). `signUpEmail`/`signInEmail`/
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

function render(props) {
  return renderer.create(React.createElement(WelcomeScreen, baseProps(props)));
}

test("WelcomeScreen: renders sign-in content directly -- no intent choice in front of it", () => {
  const inst = render();
  assert.match(JSON.stringify(inst.toJSON()), /Sign in with Google/);
});

test("WelcomeScreen: the Back arrow calls onWatch (returns to Live with no sign-in), not internal state", () => {
  let watched = false;
  const inst = render({ onWatch: () => { watched = true; } });
  const backBtn = inst.root.findAllByType("button").find(b => hasText(b.props.children, "Back"));
  act(() => { backBtn.props.onClick(); });
  assert.equal(watched, true);
});

test("WelcomeScreen: clicking 'Sign in with Google' calls onSignIn", async () => {
  let called = false;
  const inst = render({ onSignIn: () => { called = true; return Promise.resolve({ ok: true }); } });
  const googleBtn = inst.root.findAllByType("button").find(b => Array.isArray(b.props.children) && (b.props.children[1] === "Sign in with Google" || b.props.children[1] === "Opening Google…"));
  await act(async () => {
    googleBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.equal(called, true);
});

test("WelcomeScreen: a failed onSignIn shows the returned error", async () => {
  const inst = render({ onSignIn: () => Promise.resolve({ ok: false, error: "Sign-in was cancelled." }) });
  const googleBtn = inst.root.findAllByType("button").find(b => Array.isArray(b.props.children) && (b.props.children[1] === "Sign in with Google" || b.props.children[1] === "Opening Google…"));
  await act(async () => {
    googleBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });
  assert.match(JSON.stringify(inst.toJSON()), /Sign-in was cancelled\./);
});

test("WelcomeScreen: onSignIn returning needsLink pre-fills the email and opens email sign-in mode", async () => {
  const inst = render({ onSignIn: () => Promise.resolve({ needsLink: true, linkEmail: "robin@example.com" }) });
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
  const inst = render({ onSkip: () => { skipped = true; } });
  const skipBtn = inst.root.findAllByType("button").find(b => b.props.children === "Continue without an account");
  skipBtn.props.onClick();
  assert.equal(skipped, true);
});

test("WelcomeScreen: email sign-in validates a missing password before calling signInEmail", async () => {
  globalThis.signInEmail = () => { throw new Error("should not be called"); };
  const inst = render();
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
  const inst = render();
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
  const inst = render();
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
  const inst = render();
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
