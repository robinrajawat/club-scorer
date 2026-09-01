// Generic search-and-request panel (src/components/searchAndRequestPanel.js). onSearch/onRequest
// are passed as props, not bare globals, so no stubbing is needed at all.

import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { SearchAndRequestPanel } from "../../../src/components/searchAndRequestPanel.js";
import { Btn, TextField } from "../../../src/components/formUiAtoms.js";

test("SearchAndRequestPanel: searches, shows an empty-state hint or results, and sends a request", async () => {
  let requested = null;
  const inst = renderer.create(React.createElement(SearchAndRequestPanel, {
    placeholder: "Club name", idKey: "clubId", actionLabel: "Request",
    onSearch: term => Promise.resolve(term === "empty" ? [] : [{ clubId: "c1", name: "Riverside CC", ownerName: "Robin" }]),
    onRequest: item => { requested = item; return Promise.resolve({ ok: true }); }
  }));

  const field = inst.root.findByType(TextField);
  field.props.onChange("empty");
  const searchBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Search" || b.props.children === "…");
  await searchBtn.props.onClick();
  assert.match(JSON.stringify(inst.toJSON()), /No matches/);

  field.props.onChange("riverside");
  await searchBtn.props.onClick();
  const text = JSON.stringify(inst.toJSON());
  assert.match(text, /Riverside CC/);
  assert.match(text, /Robin/);

  const requestBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Request");
  await requestBtn.props.onClick();
  assert.equal(requested.clubId, "c1");
});

test("SearchAndRequestPanel: a result already linked or just-requested shows the linked/already-sent label instead", async () => {
  const inst = renderer.create(React.createElement(SearchAndRequestPanel, {
    placeholder: "Club name", idKey: "clubId", actionLabel: "Request",
    alreadyLinkedIds: ["c1"], alreadyLinkedLabel: "Linked",
    onSearch: () => Promise.resolve([{ clubId: "c1", name: "Riverside CC" }]),
    onRequest: () => Promise.resolve({ ok: true })
  }));
  const searchBtn = inst.root.findAllByType(Btn)[0];
  await searchBtn.props.onClick();
  const linkedBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Linked");
  assert.ok(linkedBtn);
  assert.equal(linkedBtn.props.disabled, true);
});

test("SearchAndRequestPanel: shows the error when onRequest reports failure", async () => {
  const inst = renderer.create(React.createElement(SearchAndRequestPanel, {
    placeholder: "Club name", idKey: "clubId", actionLabel: "Request",
    onSearch: () => Promise.resolve([{ clubId: "c1", name: "Riverside CC" }]),
    onRequest: () => Promise.resolve({ ok: false, error: "Already pending." })
  }));
  const searchBtn = inst.root.findAllByType(Btn)[0];
  await searchBtn.props.onClick();
  const requestBtn = inst.root.findAllByType(Btn).find(b => b.props.children === "Request");
  await requestBtn.props.onClick();
  assert.match(JSON.stringify(inst.toJSON()), /Already pending/);
});
