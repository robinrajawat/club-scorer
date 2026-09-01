import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { ChevronRight, Table2 } from "./icons.js";
import { RoleBadge } from "./scoringUiAtoms.js";
import { MatchInfoFold } from "./matchDisplayAtoms.js";
import { OversStrip } from "./scoreboardAtoms.js";
import { RunRateChart, RunsPerOverChart } from "./matchInsightCards.js";
import { ExportPdfButton } from "./exportButtons.js";
import { oversLabel, crr } from "../core/scoringEngine.js";
import { chasingInfo, matchResultText, tossText, umpiresText, nonStandardRulesText } from "../core/shareAndFormat.js";
import { captainFor, keeperFor, numbersFor } from "../core/appLogic.js";

// Full ball-by-ball scorecard, built from smaller, already-extracted pieces: InningScorecard (one
// innings' batting/bowling tables), MatchStatsPanel (tabs between innings plus the two charts and
// the overs strip), and ScorecardOverlay (the full-screen sheet that wraps MatchStatsPanel with a
// header/export/close bar). Also PrintReport/TournamentPrintReport, the "print-only" CSS-class
// summary sheets that only render into the browser's print output (see the app's print stylesheet)
// -- PrintReport reuses InningScorecard, which is why these live in the same file. Covered by
// tests/unit/components/scorecard.test.js.

export function InningScorecard({
  inning,
  battingCaptain,
  battingKeeper,
  bowlingCaptain,
  bowlingKeeper,
  battingNumbers,
  bowlingNumbers
}) {
  const totalExtras = inning.extras.wide + inning.extras.noball + inning.extras.bye + inning.extras.legbye + (inning.extras.penalty || 0);
  const battingOrder = inning.battingOrder.length ? inning.battingOrder : Object.keys(inning.batsmen);
  const bowlingOrder = inning.bowlingOrder.length ? inning.bowlingOrder : Object.keys(inning.bowlers);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.pitch
    }
  }, inning.battingTeam), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 18,
      fontWeight: 700,
      color: COLORS.ink
    }
  }, inning.runs, "-", inning.wickets, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: COLORS.inkSoft
    }
  }, "(", oversLabel(inning.legalBalls, inning.ballsPerOver), ")"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2.2fr 1.6fr 0.5fr 0.5fr 0.5fr 0.5fr 0.6fr",
      gap: 4,
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      padding: "0 2px 6px",
      borderBottom: `1.5px solid ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("span", null, "Batsman"), /*#__PURE__*/React.createElement("span", null, "Dismissal"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "R"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "B"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "4s"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "6s"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "SR")), battingOrder.map(name => {
    const b = inning.batsmen[name];
    if (!b) return null;
    const isBatting = (name === inning.strikerName || name === inning.nonStrikerName) && !inning.complete;
    const sr = b.balls > 0 ? (b.runs / b.balls * 100).toFixed(1) : "0.0";
    return /*#__PURE__*/React.createElement("div", {
      key: name,
      style: {
        display: "grid",
        gridTemplateColumns: "2.2fr 1.6fr 0.5fr 0.5fr 0.5fr 0.5fr 0.6fr",
        gap: 4,
        fontSize: 13,
        padding: "6px 2px",
        borderBottom: `1px dashed ${COLORS.creamDark}`,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: isBatting ? 700 : 500,
        color: COLORS.ink
      }
    }, (battingNumbers && battingNumbers[name]) && /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.turf,
        fontWeight: 700
      }
    }, "#", battingNumbers[name], " "), name, isBatting ? " *" : "", /*#__PURE__*/React.createElement(RoleBadge, {
      isCaptain: name === battingCaptain,
      isKeeper: name === battingKeeper
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: COLORS.inkSoft,
        fontStyle: b.out ? "normal" : "italic"
      }
    }, b.out ? b.how : b.retiredHurt && !isBatting ? b.retiredAtCap ? `retired — ${b.retiredAtCap}` : "retired hurt" : "not out"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.ink
      }
    }, b.runs), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.inkSoft
      }
    }, b.balls), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.inkSoft
      }
    }, b.fours), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.inkSoft
      }
    }, b.sixes), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.inkSoft
      }
    }, sr));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "8px 2px",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft
    }
  }, "Extras: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, totalExtras), /*#__PURE__*/React.createElement("span", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 11.5
    }
  }, " ", "(wd ", inning.extras.wide, ", nb ", inning.extras.noball, ", b ", inning.extras.bye, ", lb ", inning.extras.legbye, (inning.extras.penalty || 0) > 0 ? `, pen ${inning.extras.penalty}` : "", ")")))), inning.fallOfWickets.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 5
    }
  }, "Fall of Wickets"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      lineHeight: 1.7
    }
  }, inning.fallOfWickets.map((fw, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, fw.wicket, "-", fw.score, " (", fw.batsman, ", ", fw.over, " ov)", i < inning.fallOfWickets.length - 1 ? "  ·  " : "")))), (inning.penalties || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 5
    }
  }, "Penalties"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      lineHeight: 1.7
    }
  }, inning.penalties.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, "+", p.runs, " at ", p.score, "-", p.wickets, " (", p.over, " ov)", i < inning.penalties.length - 1 ? "  ·  " : "")))), (inning.milestones || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 5
    }
  }, "Milestones"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      lineHeight: 1.7
    }
  }, inning.milestones.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, m.text, " (", m.score, ", ", m.over, " ov)", i < inning.milestones.length - 1 ? "  ·  " : "")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      fontFamily: "'Inter'"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2fr 0.55fr 0.5fr 0.55fr 0.55fr 0.65fr",
      gap: 4,
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      padding: "0 2px 6px",
      borderBottom: `1.5px solid ${COLORS.willow}`
    }
  }, /*#__PURE__*/React.createElement("span", null, "Bowler"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "O"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "M"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "R"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "W"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "Econ")), bowlingOrder.map(name => {
    const bw = inning.bowlers[name];
    if (!bw) return null;
    const isBowling = name === inning.bowlerName && !inning.complete;
    const econ = bw.ballsBowled > 0 ? (bw.runs / bw.ballsBowled * (inning.ballsPerOver || 6)).toFixed(2) : "0.00";
    return /*#__PURE__*/React.createElement("div", {
      key: name,
      style: {
        display: "grid",
        gridTemplateColumns: "2fr 0.55fr 0.5fr 0.55fr 0.55fr 0.65fr",
        gap: 4,
        fontSize: 13,
        padding: "6px 2px",
        borderBottom: `1px dashed ${COLORS.creamDark}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: isBowling ? 700 : 500,
        color: COLORS.ink
      }
    }, (bowlingNumbers && bowlingNumbers[name]) && /*#__PURE__*/React.createElement("span", {
      style: {
        color: COLORS.turf,
        fontWeight: 700
      }
    }, "#", bowlingNumbers[name], " "), name, isBowling ? " *" : "", /*#__PURE__*/React.createElement(RoleBadge, {
      isCaptain: name === bowlingCaptain,
      isKeeper: name === bowlingKeeper
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.ink
      }
    }, oversLabel(bw.ballsBowled, inning.ballsPerOver)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.inkSoft
      }
    }, bw.maidens || 0), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.ink
      }
    }, bw.runs), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 700,
        color: bw.wickets > 0 ? COLORS.ball : COLORS.ink
      }
    }, bw.wickets), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.inkSoft
      }
    }, econ));
  })));
}

export function MatchStatsPanel({
  match,
  tab,
  setTab,
  showOvers
}) {
  const chasing = chasingInfo(match);
  // The quick-summary card (score + target/chase context + this over) is only worth surfacing
  // for whoever's actually batting right now -- a completed earlier innings has nothing "live"
  // left to show, and the full scorecard below already covers it in more detail than a
  // ball-by-ball strip would.
  const liveInn = match.innings[match.currentInningIndex] || match.innings[match.innings.length - 1];
  const showLiveSummary = showOvers && liveInn && liveInn.battingOrder && liveInn.battingOrder.length > 0 && !liveInn.complete;
  // Folded by default on the Follow screen -- a follower's first priority is the summary card
  // above, not a full stats table. Left open by default in the scorer's own Scorecard overlay,
  // since tapping that button was already an explicit request to see it.
  const [scorecardOpen, setScorecardOpen] = useState(!showOvers);
  // Same reasoning as the scorecard fold -- charts are a deeper dive than a follower's first
  // glance needs, closed by default there and open by default in the scorer's own overlay.
  const [chartsOpen, setChartsOpen] = useState(!showOvers);
  return /*#__PURE__*/React.createElement(React.Fragment, null, match.venue && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 16px 0",
      maxWidth: 560,
      margin: "0 auto",
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft
    }
  }, "\uD83D\uDCCD ", match.venue), /*#__PURE__*/React.createElement(MatchInfoFold, {
    match: match
  }), showLiveSummary && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 16px 0",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      flexWrap: "wrap",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 15,
      fontWeight: 700,
      color: COLORS.ink
    }
  }, liveInn.battingTeam, " ", liveInn.runs, "-", liveInn.wickets, " (", oversLabel(liveInn.legalBalls, liveInn.ballsPerOver), " ov)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      color: COLORS.inkSoft
    }
  }, "CRR ", crr(liveInn.runs, liveInn.legalBalls, liveInn.ballsPerOver))), chasing && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.turf
    }
  }, /*#__PURE__*/React.createElement("span", null, "Target ", chasing.target), /*#__PURE__*/React.createElement("span", null, "Need ", Math.max(chasing.runsNeeded, 0), " off ", Math.max(chasing.ballsLeft, 0), " ball", Math.max(chasing.ballsLeft, 0) === 1 ? "" : "s"), chasing.reqRate && /*#__PURE__*/React.createElement("span", null, "RRR ", chasing.reqRate)), liveInn.strikerName && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 10,
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, [liveInn.strikerName, liveInn.nonStrikerName].filter(Boolean).map(name => {
    const b = liveInn.batsmen[name] || {
      runs: 0,
      balls: 0
    };
    const isStriker = name === liveInn.strikerName;
    return /*#__PURE__*/React.createElement("div", {
      key: name,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 0",
        fontFamily: "'Inter'"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: isStriker ? 700 : 500,
        color: isStriker ? COLORS.ink : COLORS.inkSoft
      }
    }, isStriker && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: COLORS.gold,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: isStriker ? 0 : 11
      }
    }, name)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12.5,
        fontWeight: 600,
        color: COLORS.inkSoft
      }
    }, b.runs, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        opacity: 0.6,
        fontWeight: 400
      }
    }, "(", b.balls, ")")));
  }), liveInn.strikerName && liveInn.nonStrikerName && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      textAlign: "right",
      marginTop: 2
    }
  }, "Partnership: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink,
      fontWeight: 600
    }
  }, liveInn.partnershipRuns || 0), " (", liveInn.partnershipBalls || 0, ")"), liveInn.bowlerName && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: `1px solid ${COLORS.creamDark}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: "'Inter'"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: COLORS.inkSoft,
      fontWeight: 500
    }
  }, liveInn.bowlerName), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12.5,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, liveInn.bowlers[liveInn.bowlerName] ? `${oversLabel(liveInn.bowlers[liveInn.bowlerName].ballsBowled, liveInn.ballsPerOver)}-${liveInn.bowlers[liveInn.bowlerName].runs}-${liveInn.bowlers[liveInn.bowlerName].wickets}` : "-"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 10,
      borderTop: `1px solid ${COLORS.creamDark}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      marginBottom: 8,
      textTransform: "uppercase"
    }
  }, "Overs"), /*#__PURE__*/React.createElement(OversStrip, {
    overs: liveInn.overs,
    ballsPerOver: liveInn.ballsPerOver
  })))), match.innings.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      padding: "14px 16px 0",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, match.innings.map((inn, i) => {
    const started = inn.battingOrder && inn.battingOrder.length > 0;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => started && setTab(i),
      disabled: !started,
      className: "cs-btn cs-shine",
      style: {
        flex: 1,
        padding: "9px 0",
        borderRadius: 10,
        border: "none",
        background: tab === i ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
        color: tab === i ? "#fff" : started ? COLORS.ink : COLORS.inkSoft,
        boxShadow: tab === i ? "0 3px 10px rgba(45,80,22,0.3)" : "0 1px 3px rgba(42,36,32,0.06)",
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 13,
        cursor: started ? "pointer" : "not-allowed",
        opacity: started ? 1 : 0.5
      }
    }, inn.battingTeam);
  })), showOvers ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setScorecardOpen(o => !o),
    className: "cs-btn",
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      color: COLORS.ink
    }
  }, "Scorecard", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 16,
    style: {
      transform: scorecardOpen ? "rotate(90deg)" : "none",
      transition: "transform 0.15s ease"
    }
  })), scorecardOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 16px 16px"
    }
  }, /*#__PURE__*/React.createElement(InningScorecard, {
    inning: match.innings[tab],
    battingCaptain: captainFor(match, match.innings[tab].battingTeam),
    battingKeeper: keeperFor(match, match.innings[tab].battingTeam),
    bowlingCaptain: captainFor(match, match.innings[tab].bowlingTeam),
    bowlingKeeper: keeperFor(match, match.innings[tab].bowlingTeam),
    battingNumbers: numbersFor(match, match.innings[tab].battingTeam),
    bowlingNumbers: numbersFor(match, match.innings[tab].bowlingTeam)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setChartsOpen(o => !o),
    className: "cs-btn",
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      color: COLORS.ink
    }
  }, "Charts", /*#__PURE__*/React.createElement(ChevronRight, {
    size: 16,
    style: {
      transform: chartsOpen ? "rotate(90deg)" : "none",
      transition: "transform 0.15s ease"
    }
  }))), chartsOpen && /*#__PURE__*/React.createElement(RunRateChart, {
    match: match
  }), chartsOpen && /*#__PURE__*/React.createElement(RunsPerOverChart, {
    match: match
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement(InningScorecard, {
    inning: match.innings[tab],
    battingCaptain: captainFor(match, match.innings[tab].battingTeam),
    battingKeeper: keeperFor(match, match.innings[tab].battingTeam),
    bowlingCaptain: captainFor(match, match.innings[tab].bowlingTeam),
    bowlingKeeper: keeperFor(match, match.innings[tab].bowlingTeam),
    battingNumbers: numbersFor(match, match.innings[tab].battingTeam),
    bowlingNumbers: numbersFor(match, match.innings[tab].bowlingTeam)
  })), /*#__PURE__*/React.createElement(RunRateChart, {
    match: match
  }), /*#__PURE__*/React.createElement(RunsPerOverChart, {
    match: match
  })));
}

export function ScorecardOverlay({
  match,
  onClose
}) {
  const [tab, setTab] = useState(match.innings.length - 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: COLORS.cream,
      zIndex: 60,
      overflowY: "auto",
      animation: "cs-sheetIn 0.34s cubic-bezier(0.22, 1, 0.36, 1)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      background: `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchDarkFixed})`,
      color: COLORS.creamFixed,
      padding: "16px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19
    }
  }, /*#__PURE__*/React.createElement(Table2, {
    size: 18
  }), " Scorecard"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ExportPdfButton, {
    match: match
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "cs-btn",
    style: {
      background: "rgba(242,236,217,0.14)",
      border: "1px solid rgba(242,236,217,0.35)",
      borderRadius: 8,
      color: COLORS.creamFixed,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      padding: "6px 10px"
    }
  }, "Close"))), /*#__PURE__*/React.createElement(MatchStatsPanel, {
    match: match,
    tab: tab,
    setTab: setTab,
    showOvers: false
  }));
}

export function PrintReport({
  match
}) {
  if (!match) return null;
  // Was its own duplicated copy of this exact logic (matchResultText's inline predecessor) --
  // easy to end up silently out of sync with the live result screen the moment either one changes
  // and the other doesn't (e.g. a future "no result"/abandoned designation). Call the one shared
  // function everyone else already uses instead of maintaining a second copy of it here.
  const resultText = matchResultText(match);
  return /*#__PURE__*/React.createElement("div", {
    className: "print-only",
    style: {
      padding: 24,
      fontFamily: "'Inter', sans-serif",
      color: "#000",
      background: COLORS.surface
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 22,
      marginBottom: 2
    }
  }, match.teamA, " vs ", match.teamB), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 4
    }
  }, match.oversLimit, "-over match · exported ", new Date().toLocaleDateString()), match.venue && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 4
    }
  }, "\uD83D\uDCCD ", match.venue), tossText(match.toss) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 4
    }
  }, tossText(match.toss)), umpiresText(match) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 4
    }
  }, umpiresText(match)), nonStandardRulesText(match.rules) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 4,
      fontStyle: "italic"
    }
  }, "House rules: ", nonStandardRulesText(match.rules)), resultText && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      marginBottom: 14
    }
  }, resultText), match.playerOfMatch && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      marginBottom: match.bestFielder ? 4 : 14
    }
  }, "Player of the Match: ", /*#__PURE__*/React.createElement("strong", null, match.playerOfMatch)), match.bestFielder && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      marginBottom: 14
    }
  }, "Best Fielder: ", /*#__PURE__*/React.createElement("strong", null, match.bestFielder)), !resultText && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 14,
      fontStyle: "italic"
    }
  }, "Match in progress"), match.innings.map((inn, idx) => inn.battingOrder && inn.battingOrder.length > 0 ? /*#__PURE__*/React.createElement("div", {
    key: idx,
    style: {
      marginBottom: 20,
      pageBreakInside: "avoid"
    }
  }, /*#__PURE__*/React.createElement(InningScorecard, {
    inning: inn,
    battingCaptain: captainFor(match, inn.battingTeam),
    battingKeeper: keeperFor(match, inn.battingTeam),
    bowlingCaptain: captainFor(match, inn.bowlingTeam),
    bowlingKeeper: keeperFor(match, inn.bowlingTeam),
    battingNumbers: numbersFor(match, inn.battingTeam),
    bowlingNumbers: numbersFor(match, inn.bowlingTeam)
  })) : null));
}

export function TournamentPrintReport({
  tournament,
  standings
}) {
  if (!tournament) return null;
  const scheduledFixtures = (tournament.fixtures || []).filter(f => f.date);
  return /*#__PURE__*/React.createElement("div", {
    className: "print-only",
    style: {
      padding: 24,
      fontFamily: "'Inter', sans-serif",
      color: "#000",
      background: COLORS.surface
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 22,
      marginBottom: 2
    }
  }, tournament.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#555",
      marginBottom: 16
    }
  }, tournament.teams.length, " teams \u00b7 exported ", new Date().toLocaleDateString()), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      marginBottom: 6
    }
  }, "Standings"), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["Team", "P", "W", "L", "T", "NR", "Pts", "NRR"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: h === "Team" ? "left" : "center",
      borderBottom: "1.5px solid #000",
      padding: "4px 6px"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, standings.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.team
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "4px 6px",
      borderBottom: "1px solid #ccc",
      fontWeight: 700
    }
  }, r.team), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc"
    }
  }, r.played), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc"
    }
  }, r.won), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc"
    }
  }, r.lost), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc"
    }
  }, r.tied), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc"
    }
  }, r.noResult), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc",
      fontWeight: 700
    }
  }, r.points), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      padding: "4px 6px",
      borderBottom: "1px solid #ccc",
      fontFamily: "'IBM Plex Mono', monospace"
    }
  }, r.played === 0 ? "\u2014" : (r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(3)))))), scheduledFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      marginBottom: 6
    }
  }, "Fixtures"), scheduledFixtures.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      lineHeight: 1.9
    }
  }, scheduledFixtures.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id
  }, new Date(`${f.date}:00`).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }), " \u2014 ", f.teamA, " vs ", f.teamB))));
}
