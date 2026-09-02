# Co-owner invites in the Inbox — implementation plan

**Status: shipped and fully cleaned up (2026-09-02).** Built in PR #84 (`coOwnerInvites`
collection, Inbox section, email-only invite UI in `ClubPanel`/`FederationsPanel`), with a
same-day hotfix in PR #85 after a branch-reconstruction mistake shipped `public/index.html`
without the new hand-written Firestore glue functions it depended on — see
`docs/handoff-prompt.md`'s Current State for the full story and the general lesson (these
hand-written functions have zero auto-sync/test coverage; see the note at the bottom of this file).
The cleanup PR then retired `federationCoOwnerInviteCodes` entirely (rules, redemption UI, the
matching self-redeem branch on `federations/{federationId}`) once every invite minted under it was
confirmed redeemed or expired. `clubJoinCodes` stays alive permanently for plain club **member**
invites (always out of scope for this migration — see "Proposed design" below).

The rest of this document is the original design write-up, kept as-is for context on **why** things
are shaped the way they are; it no longer describes a "not started" plan.

## Current state

Two parallel, near-identical systems exist today, both "bearer code addressed to one email":

- **Club co-owner invites** (`inviteClubCoOwnerByEmail`, `public/index.html`): mints an 8-char
  code via `genMatchCode()`, writes `clubJoinCodes/{code} = {clubId, email, role, createdBy,
  createdAt, expiresAt}` (7-day TTL). The owner copies the code and sends it to the invitee
  out-of-band (chat, WhatsApp, in person). The invitee pastes it into a text field in `ClubPanel`;
  `joinClubWithCode` fetches the doc by ID, checks the email matches, and grants membership.
- **Federation co-owner invites** (`inviteFederationCoOwnerByEmail`): identical shape,
  `federationCoOwnerInviteCodes/{code}`, redeemed via a dashed-border code box in
  `TeamsScreen`. Notably has **no `expiresAt` at all** — an existing asymmetry with the club
  version worth fixing alongside this work, not on its own.

In both cases there is no notification to the invitee. They must already know to go find the
redeem box and have the code in hand. This is the UX the feature is meant to replace.

## Why it isn't just "add a query"

`firestore.rules` deliberately sets `allow list: if false` on both `clubJoinCodes` and
`federationCoOwnerInviteCodes` (`firebase/firestore.rules:429-442, 595-608`) — comment: "a stranger can't discover
which club/federation a code points to... can't be dumped wholesale." A signed-in user can `get`
a code doc if they already know its exact ID, but there is no way to query "codes addressed to my
email" against either collection. That's structural, not an oversight — loosening it would let
anyone enumerate pending invites club-by-club.

**This repo has already solved this exact problem once**, for a sibling feature: club↔federation
affiliation used to work the same bearer-code way (`federationJoinCodes`, now dead code per the
comment at `firestore.rules:691-694`) and was replaced by `federationRequests` — a proper
record-per-request collection, queried client-side via
`where("clubId","in",myOwnedClubIds).get()` / `where("federationId","in",myOwnedFederationIds)`,
with `allow list: if canSeeRequest(resource.data)` re-validating each returned doc's owner via a
`get()` lookup rather than trusting the query's own filter. `InboxScreen` already renders this as
"needs your response" / "sent, waiting" sections with Accept/Decline/Cancel. This plan is
"do the same migration `federationJoinCodes → federationRequests` already did, for co-owner
invites."

## Proposed design

One new collection, `coOwnerInvites/{inviteId}`, replacing both `clubJoinCodes`'
coOwner-invite role and `federationCoOwnerInviteCodes` (leave plain club **member** invites — no
Inbox ask for those — on the existing bearer-code flow; narrower scope, revisit separately if
wanted later):

```js
{
  scope: "club" | "federation",
  entityId: string,        // clubId or federationId
  email: string,           // invitee's email, lowercased
  createdBy: string,       // uid
  createdByName: string,
  createdAt: Timestamp,
  expiresAt: Timestamp,    // fixes the federation-invite TTL gap too
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired"
}
```

**A real UX win beyond "shows in the Inbox," worth calling out**: since matching happens by
`request.auth.token.email` at read/accept time (same as today), there's no bearer secret to
generate at all. The owner just types the invitee's email and taps Send — no code to copy, no
out-of-band message to send. The invitee sees it appear the next time they open the Inbox while
signed in with that email. Simpler for the sender than what exists today, not just for the
receiver.

### firestore.rules

```
match /coOwnerInvites/{inviteId} {
  function isRecipient(data) {
    return data.email == request.auth.token.email.lower();
  }
  function isSender(data) {
    return data.scope == 'club'
      ? isClubOwner(get(/databases/$(database)/documents/clubs/$(data.entityId)).data)
      : isFederationOwner(get(/databases/$(database)/documents/federations/$(data.entityId)).data);
  }
  allow get, list: if request.auth != null && (isRecipient(resource.data) || isSender(resource.data));

  allow create: if request.auth != null
    && request.resource.data.status == 'pending'
    && request.resource.data.email is string
    && isSender(request.resource.data);

  // Recipient may only flip pending -> accepted/declined; sender may only flip pending -> cancelled.
  allow update: if request.auth != null && resource.data.status == 'pending' && (
    (isRecipient(resource.data) && request.resource.data.status in ['accepted', 'declined'])
    || (isSender(resource.data) && request.resource.data.status == 'cancelled')
  );
  allow delete: if false;
}
```

Query shape (mirrors `loadMyFederationRequests`):
```js
db.collection("coOwnerInvites").where("email", "==", myEmail.toLowerCase())
  .where("status", "==", "pending").get();
db.collection("coOwnerInvites").where("entityId", "in", myOwnedClubIds.concat(myOwnedFederationIds).slice(0, 10)).get();
```
Two equality filters (`email` + `status`) don't need a composite index — Firestore's automatic
single-field indexes cover that combination. **Adding `.orderBy("createdAt", "desc")` on top of
either query would need one** (composite indexes are their own manual deploy step, same
non-automatic caveat as rules — flag this explicitly if the UI ends up wanting sorted results).

### Core logic (new, replacing the invite-half of the existing functions)

- `inviteCoOwner(scope, entityId, email)` — create with `status: "pending"`.
- `loadMyCoOwnerInvites()` — the two-query load above, called from the same `useEffect` that
  already reloads `myFederationRequests` on `[user, myOwnedClubIds, myOwnedFederationIds]`.
- `respondToCoOwnerInvite(inviteId, accept)` — recipient flips status; on accept, also writes
  `coOwnerUids: arrayUnion(uid)` onto the club/federation doc (same permission shape as
  `respondFederationRequest`'s `federation_to_club` accept branch — the recipient already has
  implicit write access to add themselves once accepted, same pattern to reuse, not invent fresh).
- `cancelCoOwnerInvite(inviteId)` — sender flips to `cancelled`.

### UI

- `InboxScreen` (`src/components/inboxScreen.js`): a third section alongside federation requests
  and polls — "Co-owner invites," same Accept/Decline/Cancel treatment. Feeds `inboxBadgeCount`.
- `ClubPanel` / `FederationsPanel` "Invite people" section: replace "mint a code, copy it, show a
  Copy button" with a plain email field + Send button, and "Invite sent — they'll see it in their
  Inbox" confirmation instead of a code pill. Pending-invites list becomes a live query against
  `coOwnerInvites` (`entityId == this club/federation`) instead of the `pendingInvites` map mirror
  on the club/federation doc — which can then be dropped entirely (it only ever existed because
  `clubJoinCodes` couldn't be listed).
- `TeamsScreen`: remove the federation-invite-code redemption box — nothing left to paste once
  invites appear in the Inbox on their own.

## Rollout sequencing (the part that actually needs care)

`firestore.rules` is **not auto-deployed** — it takes a manual paste into Firebase Console →
Firestore Database → Rules → Publish. Code, on the other hand, deploys to production within about
a minute of landing on `main`. Shipping the code before the rules are live would mean the new
Inbox query and the new invite-create call both hit `permission-denied` for real users.

Order that avoids that:
1. Add the `coOwnerInvites` rules block, paste into Firebase Console, confirm it's live (a quick
   manual read/write check against the new collection from the console or a scratch script).
2. Only then merge/deploy the code change (new functions, Inbox section, sender UI).
3. Leave the old `clubJoinCodes`/`federationCoOwnerInviteCodes` redemption paths and their rules
   alive for a transition window — any invite already sent under the old system is still a live
   bearer code sitting in Firestore and needs to keep working until it's redeemed or expires (7
   days for club invites; federation invites have no TTL today, so either backfill one during this
   work or manually confirm none are outstanding before retiring that path).
4. Once confident no old-style invites are pending, a small cleanup PR removes the old
   collections' create paths (stop minting new ones) and eventually the redemption UI/rules
   entirely.

## Effort estimate

Comparable in size to the original `federationJoinCodes → federationRequests` migration this
mirrors — a real, multi-file change, not a quick fix:
- `firestore.rules` (+ manual Console deploy, sequenced before code)
- New core functions for invite/respond/cancel/load
- `InboxScreen` new section + badge count
- `ClubPanel`, `FederationsPanel`, `TeamsScreen` UI changes
- Tests for all of the above (new unit tests + updates to existing invite-flow tests)
- A follow-up cleanup PR once the old bearer-code paths are confirmed drained

Medium-large. Worth its own dedicated session rather than folding into other work.

## Postscript: what actually happened, and the lesson worth keeping

Shipped over three PRs on 2026-09-02: #84 (the build above), #85 (a same-day hotfix), and a
cleanup PR retiring `federationCoOwnerInviteCodes`. The middle one is the part worth remembering.

`inviteCoOwner`/`loadMyCoOwnerInvites`/`respondCoOwnerInvite`/`cancelCoOwnerInvite` — like every
other Firestore-calling function this app never extracted (`joinClubWithCode`,
`respondFederationRequest`, and so on) — live only as hand-written code directly in
`public/index.html`. Unlike `src/core/` or `src/components/`, there is no `scripts/generate.js`
splice covering them, so nothing keeps this hand-written portion of the file in sync with anything:
`npm run generate:verify` doesn't check it, and the component test suite stubs these functions as
`globalThis.*` fakes rather than ever executing the real ones. A branch that reconstructs
`public/index.html` from its component sources (e.g. after discovering it was built on a stale
`main`, as happened here) will silently regenerate every *spliced* section correctly while leaving
every *hand-written* one at whatever it was before — no error, no test failure, nothing but a
`ReferenceError` waiting for the first real user. That's exactly what PR #84 shipped, and #85
fixed a few minutes later.

The takeaway for next time a branch needs this kind of reconstruction: `npm run generate` syncs
`src/core/`/`src/components/` into `public/index.html`, full stop — it does nothing for hand-written
glue functions, and there's no automated way to tell they've drifted. After any branch rebuild that
touches `public/index.html`, diff the hand-written functions you actually changed against what the
PR was supposed to contain, don't just trust `generate:verify` + `npm test` to have caught it.
