import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Btn } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";

// Read-only public view of a tournament's shared standings/fixtures snapshot, opened either via a
// "?tournament=CODE" link (see TournamentShareModal, which creates these) or by tapping a card in
// the Live tab's own tournaments feed (see openLiveTournament in cricketScorer.js) -- reachedInApp
// distinguishes the two, since "Go to Club Scorer" only makes sense for someone who landed here
// cold from an outside link and might not even have the app open anywhere else; from inside the
// app it just reads as a mistake. Covered by tests/unit/components/followTournamentScreen.test.js.
//
// Reads the snapshot directly via `db.collection("tournamentViews").doc(code).get()` from a
// mount-time useEffect -- `db` (the raw Firestore SDK instance, a bare global, not extracted) is
// stubbed on globalThis, same pattern as `auth` in authActionScreen.test.js.

export function FollowTournamentScreen({
  code,
  onExit,
  reachedInApp = false
}) {
  const exitLabel = reachedInApp ? "Back" : "Go to Club Scorer";
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | found | not-found | error
  const [error, setError] = useState("");
  useEffect(() => {
    if (!code) {
      setStatus("not-found");
      return;
    }
    db.collection("tournamentViews").doc(code).get().then(doc => {
      if (!doc.exists) {
        setStatus("not-found");
        return;
      }
      setData(doc.data());
      setStatus("found");
    }).catch(err => {
      console.error("[follow-tournament] load error \u2014 code:", err.code, "message:", err.message);
      setError(err.code === "permission-denied" ? "This link isn't available right now." : err.message || "Couldn't load this tournament.");
      setStatus("error");
    });
  }, [code]);
  const wrapStyle = {
    minHeight: "100vh",
    background: COLORS.cream,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,36,32,0.045) 28px)"
  };
  if (status === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(LoadingNote, {
      label: "Loading tournament\u2026",
      size: 32,
      style: {
        flexDirection: "column"
      }
    }));
  }
  if (status === "not-found" || status === "error") {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...wrapStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'DM Serif Display', serif",
        fontSize: 20,
        color: COLORS.pitch,
        marginBottom: 8
      }
    }, status === "not-found" ? "This link isn\u2019t valid" : "Couldn\u2019t load this tournament"), status === "error" && error && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft,
        marginBottom: 16
      }
    }, error), /*#__PURE__*/React.createElement(Btn, {
      onClick: onExit
    }, exitLabel));
  }
  const standings = [...data.standings].sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  const scheduledFixtures = (data.fixtures || []).filter(f => f.date);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...wrapStyle,
      paddingBottom: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(160deg, ${COLORS.turfFixed} 0%, ${COLORS.pitchFixed} 45%, ${COLORS.pitchDarkFixed} 100%)`,
      color: COLORS.creamFixed,
      padding: "20px 16px 26px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24
    }
  }, data.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      opacity: 0.85,
      marginTop: 2
    }
  }, data.teams.length, " teams \u00b7 as of ", new Date(data.sharedAt).toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: "0 auto",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: "14px 4px",
      marginBottom: 20,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "cs-no-scrollbar",
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "'Inter'",
      fontSize: 12.5,
      minWidth: 380
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5
    }
  }, ["Team", "P", "W", "L", "T", "NR", "Pts", "NRR"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: h === "Team" ? "left" : "center",
      padding: "0 8px 8px",
      whiteSpace: "nowrap"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, standings.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.team,
    style: {
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "8px",
      fontWeight: 700,
      color: COLORS.ink,
      whiteSpace: "nowrap"
    }
  }, r.team), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px"
    }
  }, r.played), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px"
    }
  }, r.won), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px"
    }
  }, r.lost), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px"
    }
  }, r.tied), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px"
    }
  }, r.noResult), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px",
      fontWeight: 700,
      color: COLORS.turf
    }
  }, r.points), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "8px",
      fontFamily: "'IBM Plex Mono', monospace",
      color: r.nrr >= 0 ? COLORS.turf : COLORS.ball
    }
  }, r.played === 0 ? "\u2014" : (r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(3))))))), scheduledFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, "Fixtures"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      lineHeight: 2
    }
  }, scheduledFixtures.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 12
    }
  }, new Date(`${f.date}:00`).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }), " \u2014 "), f.teamA, " vs ", f.teamB)))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onExit
  }, exitLabel))));
}
