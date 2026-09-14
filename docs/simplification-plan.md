# Simplifying to Teams/Matches/Tournaments — plan and reasoning

**Status: agreed, Phases 1-4 complete, Phase 5 (cleanup) not started (2026-09-14).** Full club/federation/player-profile/
records-book version is preserved at the `archive/pre-simplification-club-federation` branch on
GitHub — recoverable in full any time, including if the app is ever officially adopted by a real
federation.

## Why

The app is currently built around club/federation-organized cricket as the primary product, with
personal (no-club) matches/teams/tournaments as a lightweight addon layered on top (see
`tabBar.js`'s own comment, which said exactly this). That shaped a lot of the last several months:
club ownership and co-owner roles, federation membership and join requests, a cross-club public
player directory, a career-spanning records book.

In practice, the app has had exactly one real user throughout — its owner. That owner did set up a
real federation (DCF) with several clubs and ran a real tournament under it, so the club/federation
model isn't unused/theoretical; it's been exercised for real. But the owner's own conclusion,
reached after actually living with it, is that this structure "will not come into existence unless
the app is officially adopted by some federation" — i.e. it's solving a governance problem that
doesn't apply to the actual, current use case: friendly/casual matches, series and tournaments run
by one person or a small group, where the important thing is being able to follow the game, not
who administratively owns it.

The stated core need going forward: **Teams (simple rosters), Matches (with customizable rules),
Tournament/series creation, and anyone interested can follow the game.** The core scoring engine —
the part that's actually been hardened through a real tournament's worth of live bugs this
session — is explicitly not in scope for any of this; it stays exactly as built.

## Why simplify in place, not build a new app

A new app doesn't reduce the work — the scoring engine, the personal (no-club) path, most of
Home/Live/Tournaments already exist and are tested here. A fresh app would mean re-porting all of
that and re-earning the correctness this codebase already has (overthrow crediting, undo-at-over-
boundary, DLS edge cases, and more). There's also no second real audience to justify maintaining
two parallel apps — there's one user. The `archive/pre-simplification-club-federation` branch gives
the same "nothing is really lost" safety a new app's un-deleted history would, at zero ongoing
maintenance cost.

## Scope, as agreed

**Kept, unchanged:**
- The scoring engine, `MatchScreen`, tournament standings/points table computation, knockout
  bracket logic, fixture generation.
- `shareCode`/`viewCode` sharing, the `/liveMatches` + `/liveTournaments` public feed
  infrastructure, and everything built this session on top of it (the Live tab's Matches/
  Tournaments segments, watcher mode, `AuthBar`, the app-wide Fixtures view).
- Team roster management (batting/bowling order, per-player role/hand) — just without a club
  wrapper around it.
- Account basics: sign-in, profile, theme, data export/import.
- The tab bar stays **4 tabs — Home, Live, Cups, Teams** (not 3, see below).

**Removed:**
- Club/federation creation and admin, co-owner invites, federation join requests, club-scoped
  Player Pools, `ClubPanel`/`FederationsPanel`.
- The public cross-account player directory and profile linking (`PlayersScreen`,
  `playerModals.js`) — including the Home search "Players" scope entirely (not even kept as a
  roster-only search — decided it has no purpose once there's no records book motivating it).
- The records book (`RecordsScreen`).
- Availability Polls (`availabilityPollModal.js`, `PollRespondScreen`, the `/clubs/.../polls` data
  path) — currently hard-wired to club ownership; cut alongside clubs rather than re-scoped to
  personal teams.
- Everything `clubId`/`federationId`-shaped across the ~16 files that currently touch it.

**Kept as dormant infrastructure, not deleted:** `InboxScreen`, the `activity` Firestore
collection, and `notifyActivity` — every current trigger (9 call sites) is a club/federation
membership event, so all of them go, and the Bell icon comes off Home for now (a permanently-empty
notification icon reads as broken, not simple). The screen and collection stay in the codebase for
reuse if/when team-sharing-with-another-person ships later and needs a notification mechanism.

**Correction made along the way:** the tab bar was originally going to drop from 4 tabs to 3
(folding Cups into Home), reasoning that Cups only existed to browse club/federation tournaments.
That reasoning didn't hold up — Cups' real job was always tournament *management* (fixtures,
standings, brackets), which is substantial enough to deserve its own screen regardless of who
organized the tournament. What actually goes away is only the cross-club *browsing* Cups used to
also do. Cups stays as its own tab, simplified the same way Teams is (no organizer picker, no
cross-club browsing — just "every tournament you've created").

## Phased plan

1. **Decouple Public/Private from organizer type.** Today, `isPrivate` on both a new match
   (`setupScreen.js`) and a new tournament (`tournamentsScreen.js`) is *derived* from which
   organizer (personal/club/federation) is selected, and the control that shows this is hidden
   entirely (`organizerOptions.length > 1`) for anyone with no clubs — meaning a personal match or
   tournament is silently private today with no visible way to change that. This becomes its own
   explicit, always-visible toggle, defaulting to Public, independent of organizer. Everything
   downstream (`planMatchSaveEffects`'s `/liveMatches` tiering, `shareTournament`) already keys off
   the plain `private` boolean, not the organizer — so this is a UI-layer fix, not a data model
   change.
2. **Simplify the creation flow.** Drop the Personal/Club/Federation organizer picker from Setup —
   every new team/match/tournament is just the account's own.
3. **Remove club/federation management** — `ClubPanel`, `FederationsPanel`, co-owner invites,
   federation requests, join codes, member hierarchy. The largest, most self-contained chunk.
4. **Remove player profiles/records** — `RecordsScreen`, `PlayersScreen`, the public player
   directory, profile linking, Availability Polls.
5. **Cleanup** — orphaned `clubId`/`federationId` fields left on existing match/tournament/team
   documents (harmless if simply left unread going forward — no destructive migration planned) and
   the now-dead Firestore rule blocks (14 of them), lowest priority since inert rules cost nothing
   to leave in place temporarily.

Existing data — including the real DCF federation, its clubs, and the tournament run under it — is
not touched or migrated by any of this. The match/tournament documents themselves stay exactly as
they are; what disappears is the UI that gave them a club/federation frame around them.
