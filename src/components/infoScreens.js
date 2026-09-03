import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, Info } from "./icons.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { POLL_TTL_DAYS } from "../core/shareAndFormat.js";

// Secondary, mostly-static account/info screens: HelpScreen (searchable FAQ, using
// highlightMatch/HELP_SECTIONS below), AboutScreen, FeedbackScreen, SharedLinksScreen (revoke a
// match's active share/view codes), and BetaTestersScreen (admin approve/decline/revoke beta
// access). Covered by tests/unit/components/infoScreens.test.js.
//
// FeedbackScreen calls `submitFeedback` and BetaTestersScreen calls `loadBetaRequests`/
// `loadBetaTesters`/`approveBetaRequest`/`declineBetaRequest`/`revokeBetaAccess` (all Firestore
// writes/reads, defined in public/index.html, not extracted -- need the Firebase SDK global).
// BetaTestersScreen calls its load functions from a mount-time useEffect (not just an event
// handler), so its own test stubs them on globalThis before rendering -- see the module's test file.

export function highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) => i % 2 === 1 ? /*#__PURE__*/React.createElement("mark", {
    key: i,
    style: {
      background: COLORS.gold,
      color: "#fff",
      borderRadius: 3,
      padding: "0 1px"
    }
  }, part) : part);
}

export const HELP_SECTIONS = [{
  title: "Scoring",
  entries: [{
    q: "What does the powerplay badge actually do?",
    a: "It marks the window (however many overs you set at the start of an innings) — nothing more. There's no fielder-position tracking in the app, so it can't enforce a fielding restriction; it just shows a badge while you're in it."
  }, {
    q: "What happens when an innings goes over its time cap?",
    a: "Nothing gets stopped. Set a target in Match Rules and an \u201cOVER TIME\u201d badge shows up once an innings runs past it \u2014 it's a heads-up for whoever's scoring, not an enforced limit, since real innings overrun for all kinds of legitimate reasons the app has no way to judge."
  }, {
    q: "How does Free Hit work here?",
    a: "Turn it on in Match Rules. After a no-ball, only a run out counts as a dismissal until the next legal delivery — the app handles this automatically once it's on."
  }, {
    q: "What does the retirement run cap do?",
    a: "When a tournament or match sets “retire at N runs” (Match Rules → Batting rules), a batsman who reaches N is required to retire the moment they get there — not a dismissal, doesn't count as a wicket or credit the bowler. They can come back in later, once the rest of the batting order has had a turn (same as the Laws), and pick up right where their runs left off — reaching the next multiple of N triggers the same prompt again."
  }, {
    q: "What does “wide/no-ball counts as a ball” do?",
    a: "Turn it on in Match Rules → Extras and a wide or no-ball counts toward the over and the bowler's own figures, instead of being re-bowled — some leagues use this to keep matches moving. You can flip it back to standard Laws for just the last over(s) of the innings (so it can't be used to run the clock down right when it matters most), set separately, right below the main toggle."
  }, {
    q: "How do Big Hit and Maximum Hit work?",
    a: "Two independent, optional bonus-hit tiers (Match Rules → Special rules) — e.g. Big Hit for a six that clears a ground's own extra-distance boundary rope, Maximum Hit for an even bigger one. Each is worth whatever run total you configure, not necessarily 6, but counts as a six for every stat and milestone, and has its own button on the scoring pad. Like a real six, it's a dead ball — no running, strike doesn't rotate off it."
  }, {
    q: "How does Impact Player substitution work?",
    a: "Turn it on in Match Rules → Special rules and set how many substitutions each team gets (standard 1, up to however many the competition allows). From the Innings Break screen, either team can swap one player on their saved-squad bench in for someone currently in their XI, any time before the chase starts. The player coming off can't stay captain or keeper. Made a wrong substitution? There's an Undo right on the same card, as long as nothing else has happened since. Only works for a team with a saved squad — a team entered as free-text names has no bench to draw from."
  }, {
    q: "What's the difference between retired hurt and retired out?",
    a: "Retired hurt doesn't count as a wicket and credits no bowler — use it for an injury or anything that pulls someone away mid-innings. Retired out counts exactly like a normal dismissal. Both are on the \u201cRetire\u201d button and only apply to whoever's currently on strike \u2014 there's a Swap Strike button right in that popup if it's actually the other end who needs to leave. A retired-hurt batsman can come back in later the same innings \u2014 they show up as a normal option on the next batsman picker again once someone else is out, same as the Laws allow."
  }, {
    q: "Can I end an innings before the overs or wickets run out?",
    a: "Yes \u2014 \u201cEnd innings\u201d on the main scoring screen closes the current innings out right there, behind a confirmation. Use it for bad weather, running out of time, a forfeit, or a hopeless mismatch. Whoever's currently batting stays not out; everything scored so far stands."
  }, {
    q: "How do I record a non-striker run out?",
    a: "Every dismissal is recorded against whoever's currently on strike \u2014 there's no separate \u201cwhich end\u201d concept. If it was actually the non-striker who was run out, tap Swap Strike (it's right there in the run-out popup, no need to back out first) so the correct batsman is in the striker slot before you confirm."
  }, {
    q: "Can I record a run out or stumping that happened on a wide or no-ball?",
    a: "Yes \u2014 the run-out/stumped popup asks whether the ball was fair, a wide, or (run out only) a no-ball, and credits the extra run alongside the dismissal. It also asks how many runs the pair had completed before the wicket fell, since that's common on a run out and easy to lose track of otherwise."
  }, {
    q: "I found a scoring mistake after the match already ended \u2014 can I fix it?",
    a: "\u201cFix a mistake\u201d on the result screen reopens the match's last innings \u2014 Undo and every other correction tool work again from there, same as live scoring. It only works on the most recent innings: an earlier one can't be reopened once a later one has real balls in it, since the target, the result, and (in a tournament) NRR all depend on that total by then. One more thing worth knowing if it's a knockout-bracket match: fixing a mistake that changes the winner doesn't automatically update a later round that's already been set up from the old result \u2014 you'd need to fix that fixture by hand too."
  }, {
    q: "Play got stopped and there's no fair way to decide a winner \u2014 what do I do?",
    a: "\u201cAbandon match\u201d on the main scoring screen (next to \u201cEnd innings\u201d) ends the whole match immediately, in either innings, with no winner \u2014 rain, bad light, running out of time, whatever the reason. It shows as \u201cNo result\u201d rather than a win for anyone. In a tournament, both teams get 1 point (the same as a tie), tracked in its own NR column so it's not confused with a genuine drawn contest \u2014 and unlike a tie, the runs and overs from that match don't count toward either team's NRR, since play was stopped too early for them to mean anything as a fair comparison. There's no automatic check for whether it's actually too early for a result; that judgment call is entirely yours. \u201cFix a mistake\u201d still works on it afterward if you change your mind."
  }, {
    q: "Rain interrupted the chase, but the match can still finish \u2014 can I adjust the target?",
    a: "\u201cRevise target\u201d, in the same menu as \u201cEnd innings\u201d and \u201cAbandon match\u201d, only shown once the second innings is under way. Two modes: Manual, for whatever number both sides have actually agreed on, or Calculate with DLS, which computes it for you using the official Duckworth-Lewis Standard Edition resource table and formula \u2014 not the Professional Edition ICC internationals use (that one's resource table was never published; the Standard Edition is the ICC's own designated fallback for exactly this situation). Enter the new overs limit and it shows the revised target live, using G50 = 200 by default (the ICC's own figure for below full-international/first-class level \u2014 edit it if this match calls for something else) and Team 1's resource automatically computed from an uninterrupted innings (only override that if Team 1's OWN innings was also rain-interrupted). A second interruption during the same chase correctly compounds with the first rather than recalculating from scratch. Everything downstream follows the revised numbers from that point on: the live target/required-rate display, when the innings actually ends, the final result text, and (in a tournament) NRR, which credits the chasing side with the revised overs rather than the original ones if they end up all out."
  }, {
    q: "What happens if a match ties with Super Over on?",
    a: "A one-over eliminator decides it, same as international matches. Turn it on per match in Match Rules."
  }, {
    q: "How do I set up a 9-a-side (or other short-format) match?",
    a: "\u201cPlayers per side\u201d is on the Teams & Format step of setup (6\u201311, standard is 11). It controls how many players the Playing XI step asks you to select \u2014 set it before picking your XI, or a saved squad with more than 9 registered players would otherwise ask for a full 11."
  }, {
    q: "How is Best Fielder suggested?",
    a: "Whoever's credited with the most catches and run outs combined, across both innings \u2014 same \u201csuggest, then confirm or pick someone else\u201d flow as Player of the Match, right below it on the result screen. Stumpings aren't counted; that's the keeper's dismissal, not a fielding play."
  }]
}, {
  title: "Sharing & sync",
  entries: [{
    q: "Score code vs. view code \u2014 what's the difference?",
    a: "A score code (\u201cInvite to help score\u201d) gives full read-and-write scoring access \u2014 treat it like a shared password, only for someone you actually want scoring alongside you. A view code (\u201cShare live score\u201d) is read-only \u2014 anyone with the link can watch, nobody can edit, even if they have both codes."
  }, {
    q: "Do I need an account?",
    a: "No. Score codes and view codes work with no sign-in at all. Signing in with Google is only needed if you want your matches, teams, and clubs to follow you across devices."
  }, {
    q: "What does exporting/importing my data actually cover?",
    a: "Export (Account \u2192 Your data) gives you a JSON backup of your profile, teams, and matches saved to that account. Import restores it \u2014 into the same account, or a different one to migrate. It doesn't cover clubs (shared state, not personal data) or matches only ever shared via a score code."
  }, {
    q: "Do share links, poll links, or invite codes ever expire?",
    a: `Club invite codes always expire 7 days after they're sent \u2014 that one's enforced no matter what, shown as a countdown next to each pending invite. View links (match and tournament) can *optionally* expire too, on servers that have turned that on: months of nobody using one before it quietly goes stale, refreshed automatically every time it's actually used (a ball scored, a tournament reshared). Availability polls are different \u2014 on servers with that turned on, a poll expires a fixed ${POLL_TTL_DAYS} days after it was created, shown right on the poll itself, regardless of how many responses come in after. None of this ever touches the underlying match, tournament, club, or poll data itself \u2014 only the link stops working, and a new one can always be generated. The one thing that's never set up to expire on its own is a match kept with no account at all (a guest match, reachable only by its score code) \u2014 that would mean losing the only copy of it, so it's excluded entirely.`
  }]
}, {
  title: "Clubs & federations",
  entries: [{
    q: "What can a club co-owner do that a member can't?",
    a: "Co-owners have identical rights to the owner \u2014 rename the club, manage teams and tournaments, invite or remove members, affiliate with a federation. Members can use the club's teams for scoring but can't change them. Only the original owner can delete the club outright."
  }, {
    q: "What does making a club or federation \u201cPublic\u201d actually expose?",
    a: "Just its name and owner's name \u2014 never the roster or member list \u2014 so the other side can find it and request affiliation. It's the one place in the app with real search; everything else (club membership, co-ownership) stays strictly invite-by-email, with no way to browse for a person."
  }, {
    q: "How do I borrow a player from another club?",
    a: "On the Teams screen, search the public player directory (players another club has chosen to publish) and add them to your roster. Their name, email, age, role, and batting/bowling hand stay locked to their home club \u2014 only their jersey number is yours to set."
  }, {
    q: "Where can I see my own player profile?",
    a: "The Account screen, under \u201cYour player profile\u201d \u2014 it shows up automatically the moment any club adds you to a roster using the exact email you're signed in with, no separate setup needed. It's view-only there: whichever club added you first is the one that can edit your name, age, role, or batting/bowling hand, the same as for any borrowed player."
  }, {
    q: "How do availability polls work, and does someone need an account to respond?",
    a: "No account needed to respond \u2014 only the link, the same distribution model as \u201cShare live score.\u201d On a club team's row (Home \u2192 Teams), the owner/co-owner sends a poll (a question, optionally tied to a fixture date) and gets a link back; anyone with it picks their name off the roster or types their own, then answers Yes/No/Maybe with an optional note, and can see who else has answered. Only club owners/co-owners can send one or see the short history of a team's past polls \u2014 it's a club-team feature only, not offered for a personal team, since there's nobody else to poll there."
  }]
}, {
  title: "Tournaments & series",
  entries: [{
    q: "Tournament vs. series \u2014 which one do I want?",
    a: "A tournament is built for 3+ teams \u2014 round-robin group stage, an optional self-seeding knockout bracket, a points table with NRR. A series is for exactly two teams playing a set of matches head-to-head (like a 3-match ODI series) \u2014 just a running score, no table or bracket."
  }, {
    q: "What does splitting a tournament into groups actually do?",
    a: "Turn it on when you create the tournament (2\u20134 groups, e.g. \u201cGroup A\u201d / \u201cGroup B\u201d) and set how many teams advance from each. Round-robin then only happens within a group \u2014 a team never plays a team from another group until the knockout stage \u2014 and each group gets its own points table. The knockout bracket seeds itself cross-group (Group A's #1 plays Group B's #2, and vice versa) once every group fixture is played."
  }, {
    q: "Why do some fixtures skip the Match Rules step?",
    a: "The first fixture scored for a tournament or series sets its default rules and venue automatically \u2014 every fixture after that inherits them, so you're not re-entering the same 7 settings every time. You can still override a single fixture if it genuinely needs different rules."
  }, {
    q: "What does the qualification calculator do?",
    a: "Pick your team and a rival inside a tournament, and it works out the run target or rate you'd need in an upcoming fixture to get past them on net run rate \u2014 handy when NRR is close in the run-up to a knockout stage."
  }, {
    q: "What exactly goes into the Record Book, and how is All Time different from the current year?",
    a: "Every completed match that belongs to a tournament or series that club has run \u2014 or, for a federation, one the federation itself has hosted directly (not each affiliated club's own separate tournaments). Same matches the Tournament Stats tab already draws from, just combined across every tournament instead of one at a time. A match started outside any tournament, or one that's still in progress, is never counted. The current-year tab is the exact same data, just filtered to matches created on or after local midnight on January 1st; All Time has no such cutoff. A team filter and a player search on the same screen narrow any table down further. Every leaderboard and milestone list (centuries, five-wicket hauls, biggest partnerships, and the rest) is capped to the top 10. Biggest Partnerships only shows matches scored after that feature shipped \u2014 older matches never tracked individual stands, so there's genuinely nothing there to surface for them."
  }, {
    q: "Can I get the stats out of the app, into a spreadsheet?",
    a: "Yes \u2014 the Tournament Stats tab (batting/bowling leaderboard) and the Record Book both have an \u201cExport CSV\u201d button. The Record Book's downloads every table as one file, one section per table, respecting whichever team filter is selected but not the player search box (that's just an on-screen narrowing, not something that should silently shrink your export). Opens straight in Excel, Google Sheets, or Numbers."
  }, {
    q: "The auto-generated knockout bracket doesn't match my tournament's playoff format \u2014 what do I do?",
    a: "The built-in bracket is a standard Quarterfinal/Semifinal/Final elimination \u2014 it won't build something like the IPL's Qualifier 1 / Eliminator / Qualifier 2 / Final shape, where the top two teams get a second chance. Add those fixtures by hand instead (\u201cAdd a fixture\u201d on the tournament's schedule) and give each one a Stage label when you do \u2014 that keeps it out of the points table and NRR, exactly like the auto-generated bracket already is, and it shows up in its own \u201cPlayoffs\u201d section on the schedule."
  }, {
    q: "Can a federation host its own tournament, not just lend teams to a club's?",
    a: "Yes \u2014 pick the federation as the source when you create a tournament (the same chip row you'd use to switch to a specific club), and its team picker draws from every affiliated club's roster directly. Only the federation's owner/co-owner can create or manage it; anyone signed in can view it, same as the federation's own name and team directory already work."
  }]
}, {
  title: "Appearance",
  entries: [{
    q: "Does my theme choice (Light/Dark/System) follow my account?",
    a: "No \u2014 it's saved per device, on purpose, same as house rules default to being local-first. Switch it separately on each device from the account menu \u2192 Appearance."
  }]
}];

export function HelpScreen({
  onBack,
  onReplayTour,
  initialQuery = ""
}) {
  const [query, setQuery] = useState(initialQuery);
  const q = query.trim().toLowerCase();
  // Matches against both the question and the answer text -- someone searching "DLS" or "9-a-side"
  // is often describing what they want to know, not quoting the exact question wording back, so
  // limiting the search to just `e.q` would miss a lot of otherwise-findable entries.
  const filteredSections = q ? HELP_SECTIONS.map(section => ({
    ...section,
    entries: section.entries.filter(e => e.q.toLowerCase().includes(q) || e.a.toLowerCase().includes(q))
  })).filter(section => section.entries.length > 0) : HELP_SECTIONS;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Help & FAQ"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "The things that genuinely aren't obvious just from exploring \u2014 not a full manual. See the README on GitHub for everything else."), /*#__PURE__*/React.createElement(TextField, {
    value: query,
    onChange: setQuery,
    placeholder: "Search Help & FAQ",
    style: {
      marginBottom: 20
    }
  }), filteredSections.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No results for \u201c", query.trim(), "\u201d.") : filteredSections.map(section => /*#__PURE__*/React.createElement("div", {
    key: section.title,
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, section.title), section.entries.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: COLORS.surface,
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 8,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13.5,
      color: COLORS.ink,
      marginBottom: 5
    }
  }, highlightMatch(e.q, query.trim())), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.55
    }
  }, highlightMatch(e.a, query.trim())))))), onReplayTour && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onReplayTour,
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "center",
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer",
      padding: "10px 4px",
      textDecoration: "underline"
    }
  }, "Replay the welcome tour")));
}

export function AboutScreen({
  onBack
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 14,
    style: {
      color: COLORS.inkSoft
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "About")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 18,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Club Scorer"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginBottom: 12
    }
  }, "Ball-by-ball cricket scoring for friendly club games \u2014 single-file, no build step, made by a fellow club scorer."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.cardDivider,
      margin: "14px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginBottom: 12
    }
  }, "Open source under the ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, "MIT License"), " \u2014 free to use, copy, modify and share. \u00A9 2026 Robin Singh Rajawat."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => window.open("https://github.com/robinrajawat/club-scorer", "_blank", "noopener,noreferrer"),
    style: {
      flex: "1 1 auto",
      minHeight: 40,
      padding: "0 14px",
      fontSize: 13
    }
  }, "View source"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => window.open("https://github.com/robinrajawat/club-scorer/blob/main/LICENSE", "_blank", "noopener,noreferrer"),
    style: {
      flex: "1 1 auto",
      minHeight: 40,
      padding: "0 14px",
      fontSize: 13
    }
  }, "View license")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.cardDivider,
      margin: "14px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginBottom: 10
    }
  }, "Club Scorer stays free, with no ads and no locked features. If it's useful for your club, a tip is appreciated but never expected."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => window.open("https://ko-fi.com/robinrajawat", "_blank", "noopener,noreferrer"),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      width: "100%",
      minHeight: 42,
      padding: "0 14px",
      borderRadius: 10,
      // Flat solid fill -- see the same button's comment in AuthBar's dropdown for the full
      // reasoning (this is the app's only monetization channel, so it earns staying genuinely
      // visible, just without the old gradient+glossy-shine treatment; fixed brighter hex rather
      // than COLORS.gold, which reads dark in light mode).
      background: "#d4a544",
      border: "none",
      color: "#2e1c04",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13.5,
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(184,137,43,0.25)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"
  })), "Buy me a coffee"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.cardDivider,
      margin: "14px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Info, {
    size: 14,
    style: {
      color: COLORS.inkSoft
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "Data & privacy")), ["Scoring on this device alone needs nothing from you \u2014 no account, and nothing leaves your phone.", "Signing in to sync across devices or share a live-view link stores your email and whatever team and player details you enter (names, roles, batting/bowling hand, notes) in Firestore, Google's cloud database, under this app's own project. A live-view link is read-only and works for anyone with the link or code; there's no login on the viewing side.", "Publishing a player to the cross-club directory makes their name, email, and those same details visible to other clubs searching for them, until you make them private again. Turning on \u201cDiscoverable for invites\u201d in Account does the same for your own account \u2014 your name, email, and photo become findable by name to any club or federation owner sending an invite, until you turn it off.", "There are no analytics, no trackers, and no ads in this app \u2014 nothing here is sold or shared with advertisers."].map((para, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      lineHeight: 1.7,
      marginBottom: idx < 3 ? 10 : 0
    }
  }, para)))));
}

export function FeedbackScreen({
  onBack,
  userEmail
}) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(userEmail || "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function handleSend() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError("");
    const result = await submitFeedback({
      kind: "feedback",
      message,
      email
    });
    setBusy(false);
    if (result.ok) {
      setSent(true);
    } else {
      setError(result.error || "Couldn't send that.");
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Send Feedback"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, "Bug reports, missing features, anything that felt off \u2014 this goes straight to Robin."), sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.pitch,
      lineHeight: 1.6
    }
  }, "Thanks \u2014 that's been sent.") : /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: message,
    onChange: e => setMessage(e.target.value),
    placeholder: "What's on your mind?",
    rows: 6,
    style: {
      width: "100%",
      boxSizing: "border-box",
      fontFamily: "'Inter', sans-serif",
      fontSize: 14,
      padding: 12,
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.cream,
      resize: "vertical",
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement(TextField, {
    value: email,
    onChange: setEmail,
    placeholder: "Your email, if you'd like a reply (optional)",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "email",
    spellCheck: false
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleSend,
    disabled: !message.trim() || busy,
    style: {
      width: "100%",
      marginTop: 12
    }
  }, busy ? "Sending\u2026" : "Send"), error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginTop: 8
    }
  }, error))));
}

export function SharedLinksScreen({
  matches,
  onRevokeShareCode,
  onRevokeViewCode,
  onBack
}) {
  const [busyId, setBusyId] = useState(null); // `${matchId}:share` | `${matchId}:view`
  const [error, setError] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null); // { kind, match } | null
  const shared = matches.filter(m => m.shareCode || m.viewCode);
  function requestRevoke(kind, m) {
    if (busyId) return;
    setConfirmTarget({
      kind,
      match: m
    });
  }
  async function handleRevoke(kind, m) {
    const key = `${m.id}:${kind}`;
    setConfirmTarget(null);
    setBusyId(key);
    setError("");
    const result = await (kind === "share" ? onRevokeShareCode : onRevokeViewCode)(m.id);
    setBusyId(null);
    if (!result.ok) setError(result.error || "Couldn't revoke that \u2014 try again.");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Account"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Shared Links"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      marginBottom: 18,
      lineHeight: 1.5
    }
  }, "Scoring codes and live-follow links currently active for matches this device knows about. Revoking one takes effect immediately. A view link left unused for a long stretch (many months of nobody following it) may also expire on its own, on servers with that turned on \u2014 the match itself is never affected either way, only the link."), error && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: "1.5px solid rgba(139,30,30,0.25)",
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, error), shared.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 13.5,
      lineHeight: 1.6
    }
  }, "Nothing currently shared.", /*#__PURE__*/React.createElement("br", null), "Codes and links you generate from a match will show up here.") : shared.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14,
      color: COLORS.ink,
      marginBottom: 10
    }
  }, m.teamA, " vs ", m.teamB, m.status === "complete" && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: COLORS.inkSoft,
      fontSize: 12
    }
  }, "  \u00b7 Final")), m.shareCode && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "8px 0",
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5
    }
  }, "Scoring code"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.ink
    }
  }, m.shareCode)), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestRevoke("share", m),
    disabled: !!busyId,
    className: "cs-btn",
    style: {
      background: "none",
      border: `1.5px solid ${COLORS.ball}`,
      borderRadius: 8,
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12,
      padding: "6px 12px",
      cursor: "pointer",
      flexShrink: 0
    }
  }, busyId === `${m.id}:share` ? "Revoking\u2026" : "Revoke")), m.viewCode && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "8px 0",
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5
    }
  }, "Live-follow link"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.ink
    }
  }, m.viewCode)), /*#__PURE__*/React.createElement("button", {
    onClick: () => requestRevoke("view", m),
    disabled: !!busyId,
    className: "cs-btn",
    style: {
      background: "none",
      border: `1.5px solid ${COLORS.ball}`,
      borderRadius: 8,
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12,
      padding: "6px 12px",
      cursor: "pointer",
      flexShrink: 0
    }
  }, busyId === `${m.id}:view` ? "Revoking\u2026" : "Revoke")))), confirmTarget && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: confirmTarget.kind === "share" ? "Revoke scoring code?" : "Revoke live-follow link?",
    message: confirmTarget.kind === "share" ? `Revoke the scoring code for ${confirmTarget.match.teamA} vs ${confirmTarget.match.teamB}? Anyone using it will immediately lose access.` : `Revoke the live-follow link for ${confirmTarget.match.teamA} vs ${confirmTarget.match.teamB}? It will stop working immediately.`,
    confirmLabel: "Revoke",
    onConfirm: () => handleRevoke(confirmTarget.kind, confirmTarget.match),
    onCancel: () => setConfirmTarget(null)
  }));
}

export function BetaTestersScreen({
  onBack
}) {
  const [requests, setRequests] = useState([]);
  const [testers, setTesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null); // { id, email } | null
  async function refresh() {
    setLoading(true);
    const [reqRows, testerRows] = await Promise.all([loadBetaRequests(), loadBetaTesters()]);
    setLoading(false);
    setRequests(reqRows);
    setTesters(testerRows);
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function handleApprove(req) {
    setBusyId(req.id);
    const result = await approveBetaRequest(req.id, req.email);
    setBusyId(null);
    if (result.ok) {
      setRequests(list => list.filter(r => r.id !== req.id));
      setTesters(list => [{
        id: req.id,
        email: req.email,
        enabled: true,
        grantedAt: Date.now()
      }, ...list]);
    }
  }
  async function handleDecline(req) {
    setBusyId(req.id);
    const result = await declineBetaRequest(req.id);
    setBusyId(null);
    if (result.ok) setRequests(list => list.filter(r => r.id !== req.id));
  }
  async function handleRevokeConfirm() {
    const {
      id
    } = confirmRevoke;
    setConfirmRevoke(null);
    setBusyId(id);
    const result = await revokeBetaAccess(id);
    setBusyId(null);
    if (result.ok) setTesters(list => list.filter(t => t.id !== id));
  }
  function sectionLabel(text) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 1.2,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        marginBottom: 10
      }
    }, text);
  }
  function rowShell(key, primary, secondary, actions) {
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      style: {
        background: COLORS.surface,
        borderRadius: 12,
        padding: "10px 12px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 1px 3px rgba(42,36,32,0.06)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 13,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, primary), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11,
        color: COLORS.inkSoft
      }
    }, secondary)), actions);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 640,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Beta Testers"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 20,
      lineHeight: 1.5
    }
  }, "Requests come from the \u201cRequest beta access\u201d card on someone's own Account screen \u2014 there's no way to grant access by typing an email directly (no server-side way to look up a UID from one)."), loading ? /*#__PURE__*/React.createElement(LoadingNote, {
    size: 14
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, sectionLabel(`Pending requests (${requests.length})`), requests.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontStyle: "italic",
      marginBottom: 20
    }
  }, "Nothing pending.") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, requests.map(req => rowShell(req.id, req.email || req.id, `Requested ${new Date(req.requestedAt).toLocaleString()}`, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => handleApprove(req),
    disabled: busyId === req.id,
    className: "cs-btn",
    style: {
      padding: "6px 12px",
      borderRadius: 8,
      border: "none",
      background: COLORS.turfFixed,
      color: "#fff",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 12,
      cursor: "pointer"
    }
  }, busyId === req.id ? "\u2026" : "Approve"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => handleDecline(req),
    disabled: busyId === req.id,
    className: "cs-btn",
    style: {
      padding: "6px 12px",
      borderRadius: 8,
      border: `1px solid ${COLORS.willow}`,
      background: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Decline")))))), sectionLabel(`Current beta testers (${testers.length})`), testers.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontStyle: "italic"
    }
  }, "No one has beta access yet.") : testers.map(t => rowShell(t.id, t.email || t.id, t.grantedAt ? `Granted ${new Date(t.grantedAt).toLocaleString()}` : "Granted via Firebase Console", /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setConfirmRevoke({
      id: t.id,
      email: t.email
    }),
    disabled: busyId === t.id,
    className: "cs-btn",
    style: {
      flexShrink: 0,
      padding: "6px 12px",
      borderRadius: 8,
      border: `1px solid ${COLORS.ball}`,
      background: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer"
    }
  }, busyId === t.id ? "\u2026" : "Revoke")))), confirmRevoke && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Revoke beta access?",
    message: `Removes beta access for ${confirmRevoke.email || confirmRevoke.id}. They can request again later if needed.`,
    confirmLabel: "Revoke",
    variant: "danger",
    onConfirm: handleRevokeConfirm,
    onCancel: () => setConfirmRevoke(null)
  }));
}
