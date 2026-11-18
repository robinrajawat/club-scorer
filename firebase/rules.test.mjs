// Emulator checks for firestore.rules, run in CI (.github/workflows/ci.yml, verify-rules). Locally
// (needs Java 11+): cd firebase && npm ci && npm test. Prints "ALL <n>" when every check passed and
// exits non-zero at the first one that didn't. The rules are published by hand (Firebase Console),
// so this checks the repo's copy. Covers the 2026-11-18 audit changes (writeSeq on sharedMatches,
// shape checks on liveMatches) and the core privacy boundaries around them.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, runTransaction, Timestamp, setLogLevel } from 'firebase/firestore';
import fs from 'fs';
setLogLevel('silent'); // a refused write is the expected result in half the checks

const env = await initializeTestEnvironment({
  projectId: 'club-scorer-rules-test',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8089 }
});
const me = env.authenticatedContext('u1', { email: 'a@x.test' }).firestore();
const other = env.authenticatedContext('u2', { email: 'b@x.test' }).firestore();
const anon = env.unauthenticatedContext().firestore();
const d = (db, p) => doc(db, p);
let ok = 0;
const t = async (name, p) => { await p; ok++; console.log('ok', name); };
const days = (n) => Timestamp.fromMillis(Date.now() + n * 86400000);
const match = (extra) => ({ id: 'm1', teamA: 'A', teamB: 'B', innings: [], status: 'live', ...extra });

// Seed (the test library allows rules-off seeding once per run): a legacy shared match with no
// writeSeq, an account match, a public directory entry and a beta request.
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'sharedMatches/LEGACY01'), { id: 'm9', teamA: 'A', teamB: 'B', innings: [] });
  await setDoc(doc(db, 'users/u1/matches/m5'), match({ id: 'm5', writeSeq: 3 }));
  await setDoc(doc(db, 'userDirectory/u1'), { uid: 'u1', name: 'A', email: 'a@x.test' });
  await setDoc(doc(db, 'betaRequests/u1'), { uid: 'u1', email: 'a@x.test' });
});

// sharedMatches: the code is the capability (no sign-in needed), list is never allowed, and every
// write follows writeSeq: created at 1, then exactly +1.
await t('anyone with the code creates a shared match at writeSeq 1', assertSucceeds(setDoc(d(anon, 'sharedMatches/CODE0001'), match({ writeSeq: 1 }))));
await t('create at another writeSeq refused', assertFails(setDoc(d(anon, 'sharedMatches/CODE0002'), match({ writeSeq: 5 }))));
await t('create without writeSeq refused', assertFails(setDoc(d(anon, 'sharedMatches/CODE0003'), match())));
await t('anyone with the code reads it', assertSucceeds(getDoc(d(anon, 'sharedMatches/CODE0001'))));
await t('nobody lists shared matches', assertFails(getDocs(collection(anon, 'sharedMatches'))));
await t('next save at writeSeq + 1 succeeds', assertSucceeds(setDoc(d(other, 'sharedMatches/CODE0001'), match({ writeSeq: 2 }))));
await t('a stale save at the same writeSeq is refused', assertFails(setDoc(d(anon, 'sharedMatches/CODE0001'), match({ writeSeq: 2, status: 'stale' }))));
await t('going back is refused', assertFails(setDoc(d(anon, 'sharedMatches/CODE0001'), match({ writeSeq: 1 }))));
await t('skipping ahead is refused', assertFails(setDoc(d(anon, 'sharedMatches/CODE0001'), match({ writeSeq: 9 }))));
await t('a string writeSeq is refused', assertFails(setDoc(d(anon, 'sharedMatches/CODE0001'), match({ writeSeq: '3' }))));
await t('a legacy match without writeSeq takes its first counted save at 1', assertSucceeds(setDoc(d(anon, 'sharedMatches/LEGACY01'), match({ id: 'm9', writeSeq: 1 }))));
await t('the app\'s own transaction (read, then +1) works', assertSucceeds(runTransaction(anon, async (tx) => {
  const ref = d(anon, 'sharedMatches/CODE0001'); const s = await tx.get(ref);
  tx.set(ref, match({ writeSeq: (s.data().writeSeq || 0) + 1 }));
})));
await t('revoking or deleting a code still works', assertSucceeds(deleteDoc(d(anon, 'sharedMatches/LEGACY01'))));

// liveMatches: the public feed. Listable; writes must be shaped like the app's own mirror.
await t('the feed can be listed by anyone', assertSucceeds(getDocs(collection(anon, 'liveMatches'))));
await t('the app\'s mirror write (id matches, 1-day expiry) succeeds', assertSucceeds(setDoc(d(anon, 'liveMatches/m1'), match({ expiresAt: days(1) }))));
await t('a 180-day tournament mirror succeeds', assertSucceeds(setDoc(d(anon, 'liveMatches/m2'), match({ id: 'm2', expiresAt: days(180) }))));
await t('a doc whose id field differs from its key is refused', assertFails(setDoc(d(anon, 'liveMatches/m3'), match({ id: 'other', expiresAt: days(1) }))));
await t('a doc without expiresAt is refused', assertFails(setDoc(d(anon, 'liveMatches/m4'), match({ id: 'm4' }))));
await t('an expiry beyond 181 days is refused', assertFails(setDoc(d(anon, 'liveMatches/m5'), match({ id: 'm5', expiresAt: days(400) }))));
await t('an expiry in the past is refused', assertFails(setDoc(d(anon, 'liveMatches/m6'), match({ id: 'm6', expiresAt: days(-1) }))));
await t('deleting a feed entry still works (match deletion)', assertSucceeds(deleteDoc(d(anon, 'liveMatches/m2'))));

// liveViews: read-only follow mirror, get by code but never listable.
await t('a view code reads its mirror', assertSucceeds(setDoc(d(anon, 'liveViews/VIEW0001'), match()).then(() => getDoc(d(anon, 'liveViews/VIEW0001')))));
await t('nobody lists live views', assertFails(getDocs(collection(anon, 'liveViews'))));

// Personal account data stays private to its owner.
await t('owner reads own match', assertSucceeds(getDoc(d(me, 'users/u1/matches/m5'))));
await t('owner restores a backup over an existing match (writeSeq 0)', assertSucceeds(setDoc(d(me, 'users/u1/matches/m5'), match({ id: 'm5', writeSeq: 0 }))));
await t('another account cannot read it', assertFails(getDoc(d(other, 'users/u1/matches/m5'))));
await t('another account cannot write it', assertFails(setDoc(d(other, 'users/u1/matches/m5'), match({ id: 'm5' }))));
await t('signed out cannot read it', assertFails(getDoc(d(anon, 'users/u1/matches/m5'))));

// User directory: opt-in, signed-in only, own entry only.
await t('a signed-in user reads the directory', assertSucceeds(getDoc(d(other, 'userDirectory/u1'))));
await t('signed out cannot read the directory', assertFails(getDoc(d(anon, 'userDirectory/u1'))));
await t('nobody writes someone else\'s entry', assertFails(setDoc(d(other, 'userDirectory/u1'), { uid: 'u1', name: 'X', email: 'b@x.test' })));
await t('owner removes own entry', assertSucceeds(deleteDoc(d(me, 'userDirectory/u1'))));

// Beta requests: own only.
await t('owner reads own beta request', assertSucceeds(getDoc(d(me, 'betaRequests/u1'))));
await t('another account cannot read it', assertFails(getDoc(d(other, 'betaRequests/u1'))));

// Feedback: anyone files, nobody else reads.
await t('signed out files feedback', assertSucceeds(setDoc(d(anon, 'feedback/f1'), { kind: 'error', message: 'boom' })));
await t('a user cannot read feedback', assertFails(getDoc(d(me, 'feedback/f1'))));
await t('nobody makes themselves admin', assertFails(setDoc(d(me, 'admins/u1'), {})));

console.log('ALL', ok);
await env.cleanup();
