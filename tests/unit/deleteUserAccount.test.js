import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// deleteUserAccount (src/core/appLogic.js) talks to the Firestore/Auth globals that
// public/index.html provides, so it isn't exported. This runs its real source against a small
// in-memory stand-in for those globals (2026-11-18 data-safety audit: deleting an account must
// erase everything the account owns, and must not delete the sign-in account if it couldn't).
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = fs.readFileSync(path.join(ROOT, "src/core/appLogic.js"), "utf8");
const start = SRC.indexOf("async function deleteUserAccount(");
const body = SRC.slice(start, SRC.indexOf("\n}\n", start) + 2);

function setup({ failPaths = [], seed = {} } = {}) {
  const store = new Map(Object.entries(seed));
  const fail = (p) => failPaths.some((f) => p.startsWith(f));
  const ref = (p) => ({
    path: p,
    async get() { return { exists: store.has(p), data: () => store.get(p) }; },
    async delete() { if (fail(p)) throw new Error("denied"); store.delete(p); },
    async update(patch) {
      const cur = { ...store.get(p) };
      for (const [k, v] of Object.entries(patch)) cur[k] = (cur[k] || []).filter((x) => !v.remove.includes(x));
      store.set(p, cur);
    },
    collection: (name) => col(`${p}/${name}`)
  });
  const col = (p, filter) => ({
    doc: (id) => ref(`${p}/${id}`),
    where: (field, op, value) => col(p, { field, op, value }),
    async get() {
      if (fail(p)) throw new Error("denied");
      const docs = [...store.keys()]
        .filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
        .filter((k) => {
          if (!filter) return true;
          const v = store.get(k)[filter.field];
          return filter.op === "==" ? v === filter.value : Array.isArray(v) && v.includes(filter.value);
        })
        .map((k) => ({ ref: ref(k), id: k.split("/").pop(), data: () => store.get(k) }));
      return { docs };
    }
  });
  let authDeleted = false;
  const deletedMatches = [];
  const globals = {
    db: { collection: (name) => col(name) },
    auth: { currentUser: { uid: "u1", async delete() { authDeleted = true; } } },
    firebase: { firestore: { FieldValue: { arrayRemove: (...remove) => ({ remove }) } } },
    deleteMatch: async (id) => { deletedMatches.push(id); },
    signInGoogle: async () => ({ ok: true }),
    console: { error() {} }
  };
  const fn = new Function(...Object.keys(globals), `${body}\nreturn deleteUserAccount;`)(...Object.values(globals));
  return { fn, store, deletedMatches, authDeleted: () => authDeleted };
}

const fullAccount = {
  "users/u1/matches/m1": {}, "users/u1/matches/m2": {},
  "users/u1/meta/profile": {}, "users/u1/meta/teams": {}, "users/u1/meta/tournaments": {},
  "userDirectory/u1": { uid: "u1" }, "betaRequests/u1": { uid: "u1" }, "betaTesters/u1": { uid: "u1" },
  "activity/a1": { forUid: "u1" }, "activity/a2": { forUid: "u2" },
  "clubs/c1": { memberUids: ["u1", "u2"], coOwnerUids: ["u1"] },
  "users/u2/matches/x": {}, "userDirectory/u2": { uid: "u2" }
};

test("deleteUserAccount erases everything the account owns, then the sign-in account", async () => {
  const s = setup({ seed: fullAccount });
  await s.fn(["m1", "local9"]);
  assert.deepEqual(s.deletedMatches, ["m1", "local9"]);
  assert.deepEqual([...s.store.keys()].sort(), ["activity/a2", "clubs/c1", "userDirectory/u2", "users/u2/matches/x"]);
  assert.deepEqual(s.store.get("clubs/c1"), { memberUids: ["u2"], coOwnerUids: [] });
  assert.equal(s.authDeleted(), true);
});

test("an account without beta records or a public profile deletes cleanly", async () => {
  const s = setup({ seed: { "users/u1/meta/profile": {} } });
  await s.fn([]);
  assert.equal(s.store.size, 0);
  assert.equal(s.authDeleted(), true);
});

test("if anything can't be removed, the sign-in account is kept and the error says what", async () => {
  const s = setup({ seed: fullAccount, failPaths: ["userDirectory/u1"] });
  await assert.rejects(s.fn([]), /public profile/);
  assert.equal(s.authDeleted(), false);
  assert.ok(s.store.has("userDirectory/u1"));
  // Trying again once it works finishes the job.
  const again = setup({ seed: Object.fromEntries(s.store) });
  await again.fn([]);
  assert.equal(again.authDeleted(), true);
  assert.equal(again.store.has("userDirectory/u1"), false);
});

test("a club it can't leave doesn't block deletion (best-effort, as before)", async () => {
  const s = setup({ seed: fullAccount });
  s.store.set("clubs/c1", { memberUids: ["u1"], coOwnerUids: [] });
  await s.fn([]);
  assert.equal(s.authDeleted(), true);
});
