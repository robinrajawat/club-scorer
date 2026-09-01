// Public availability-poll response screen (src/components/pollRespondScreen.js). `loadPollByCode`
// runs from a mount-time useEffect and `submitPollResponse` from the submit handler -- both bare
// globals, not extracted, stubbed here the same way AvailabilityPollModal's own tests stub them.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { PollRespondScreen } from "../../../src/components/pollRespondScreen.js";
import { Btn } from "../../../src/components/formUiAtoms.js";
import { TextField } from "../../../src/components/formUiAtoms.js";

afterEach(() => {
  delete globalThis.loadPollByCode;
  delete globalThis.submitPollResponse;
});

function poll(overrides = {}) {
  return {
    teamName: "Riverside 1st XI",
    clubName: "Riverside CC",
    question: "Available for Saturday's match?",
    fixtureDate: "Sat 3 May, 2:00 PM",
    roster: ["Alex", "Sam"],
    responses: {},
    ...overrides
  };
}

async function renderScreen(code, pollObj, extraProps = {}) {
  globalThis.loadPollByCode = () => Promise.resolve(pollObj);
  let inst;
  await act(async () => {
    inst = renderer.create(React.createElement(PollRespondScreen, { code, onExit: () => {}, ...extraProps }));
    await new Promise(r => setTimeout(r, 0));
  });
  return inst;
}

test("PollRespondScreen: loads and shows the question, team/club name, and roster options", async () => {
  const inst = await renderScreen("CODE1", poll());
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Available for Saturday's match\?/);
  assert.match(text, /Riverside 1st XI/);
  const options = inst.root.findAllByType("option").map(o => o.props.children);
  assert.deepEqual(options, ["Choose…", "Alex", "Sam", "Someone else…"]);
});

test("PollRespondScreen: null poll shows not-found without crashing", async () => {
  const inst = await renderScreen("MISSING", null);
  assert.match(JSON.stringify(inst.toJSON()), /Poll not found/);
});

test("PollRespondScreen: selecting a roster name and RSVP, then submitting, calls submitPollResponse and shows the thanks state", async () => {
  let submittedWith = null;
  globalThis.submitPollResponse = (code, name, rsvp, note) => {
    submittedWith = { code, name, rsvp, note };
    return Promise.resolve({ ok: true });
  };
  const inst = await renderScreen("CODE1", poll());

  const select = inst.root.findByType("select");
  act(() => { select.props.onChange({ target: { value: "Alex" } }); });

  const yesBtn = inst.root.findAllByType("button").find(b => b.props.children === "Yes");
  act(() => { yesBtn.props.onClick(); });

  const submitBtn = inst.root.findByType(Btn);
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });

  assert.deepEqual(submittedWith, { code: "CODE1", name: "Alex", rsvp: "yes", note: "" });
  assert.match(JSON.stringify(inst.toJSON()), /saved/);
});

test("PollRespondScreen: 'Someone else' reveals a name TextField, and a failed submit shows the error", async () => {
  globalThis.submitPollResponse = () => Promise.resolve({ ok: false, error: "Something went wrong." });
  const inst = await renderScreen("CODE1", poll());

  const select = inst.root.findByType("select");
  act(() => { select.props.onChange({ target: { value: "__other__" } }); });
  const nameField = inst.root.findAllByType(TextField)[0];
  act(() => { nameField.props.onChange("Jordan"); });

  const maybeBtn = inst.root.findAllByType("button").find(b => b.props.children === "Maybe");
  act(() => { maybeBtn.props.onClick(); });

  const submitBtn = inst.root.findByType(Btn);
  await act(async () => {
    submitBtn.props.onClick();
    await new Promise(r => setTimeout(r, 0));
  });

  assert.match(JSON.stringify(inst.toJSON()), /Something went wrong\./);
});

test("PollRespondScreen: submit button is disabled until a name and RSVP are both chosen", async () => {
  const inst = await renderScreen("CODE1", poll());
  let submitBtn = inst.root.findByType(Btn);
  assert.equal(submitBtn.props.disabled, true);

  const select = inst.root.findByType("select");
  act(() => { select.props.onChange({ target: { value: "Sam" } }); });
  submitBtn = inst.root.findByType(Btn);
  assert.equal(submitBtn.props.disabled, true);

  const yesBtn = inst.root.findAllByType("button").find(b => b.props.children === "Yes");
  act(() => { yesBtn.props.onClick(); });
  submitBtn = inst.root.findByType(Btn);
  assert.equal(submitBtn.props.disabled, false);
});

test("PollRespondScreen: shows existing responses under 'Who's said what'", async () => {
  const inst = await renderScreen("CODE1", poll({
    responses: { Alex: { status: "yes", note: "can only make 2nd half" } }
  }));
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Who's said what/);
  assert.match(text, /can only make 2nd half/);
});
