import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { Trophy, Hand } from "./icons.js";
import { Btn } from "./formUiAtoms.js";
import { teamColorFor } from "../core/appLogic.js";
import { parseOverLabel } from "../core/miscHelpers.js";
import { oversLabel } from "../core/scoringEngine.js";
import { suggestPlayerOfMatch, suggestBestFielder, allMatchPlayers } from "../core/statsAndFixtures.js";

// Post-match insight cards and charts shown on a completed match's scorecard/summary: two SVG
// charts (run-rate progression, runs-per-over bars) and two "pick the award" cards
// (Player-of-the-Match, Best-Fielder), plus the "scores don't match" conflict-resolution dialog
// shown when two devices scored the same live match differently. Covered by
// tests/unit/components/matchInsightCards.test.js.
//
// PlayerOfMatchCard/BestFielderCard call `saveMatch` (a Firestore write, defined in
// docs/index.html, not extracted -- it needs the Firebase SDK global) from their pick() handler,
// same as elsewhere in this app; not stubbed at module scope since a test can choose whether to
// exercise that path.

export function RunRateChart({
  match
}) {
  const innings = match.innings;
  const hasData = innings.some(inn => inn.overs.some(o => o.length > 0));
  if (!hasData) return null;
  const seriesColors = innings.map((inn, i) => teamColorFor(match, inn.battingTeam, i === 0 ? COLORS.turf : COLORS.gold));
  const series = innings.map(inn => {
    const points = [{
      over: 0,
      runs: 0
    }];
    let cum = 0;
    inn.overs.forEach((balls, i) => {
      if (balls.length === 0 && i === inn.overs.length - 1) return; // in-progress empty over, skip
      cum += balls.reduce((s, b) => s + (b.runs || 0), 0);
      points.push({
        over: i + 1,
        runs: cum
      });
    });
    return points;
  });
  const wicketPoints = innings.map(inn => (inn.fallOfWickets || []).map(fow => ({
    over: parseOverLabel(fow.over, inn.ballsPerOver),
    runs: fow.score,
    wicket: fow.wicket,
    batsman: fow.batsman
  })));
  const maxOver = Math.max(match.oversLimit, ...series.map(s => s[s.length - 1]?.over || 0), 1);
  const maxRuns = Math.max(...series.flatMap(s => s.map(p => p.runs)), 10);
  const overStepOptions = [1, 2, 5, 10, 15, 20, 25, 50];
  const overStep = overStepOptions.find(s => match.oversLimit / s <= 5) || overStepOptions[overStepOptions.length - 1];
  const xTickVals = [];
  for (let o = 0; o <= maxOver; o += overStep) xTickVals.push(o);
  if (xTickVals[xTickVals.length - 1] !== maxOver) xTickVals.push(maxOver);
  const W = 300,
    H = 130,
    padL = 28,
    padB = 20,
    padT = 8,
    padR = 8;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const x = over => padL + over / maxOver * plotW;
  const y = runs => padT + plotH - runs / maxRuns * plotH;
  const yTicks = 4;
  const yTickVals = Array.from({
    length: yTicks + 1
  }, (_, i) => Math.round(maxRuns / yTicks * i));
  const wicketMarkerRadius = 3.4;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "Run Rate"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, innings.map((inn, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: seriesColors[i],
      display: "inline-block"
    }
  }), inn.battingTeam)), wicketPoints.some(w => w.length > 0) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 9 9"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "4.5",
    cy: "4.5",
    r: "4.5",
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "4.5",
    cy: "4.5",
    r: "3.2",
    fill: COLORS.ball,
    stroke: "#fff",
    strokeWidth: "1"
  })), "wicket"))), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      width: "100%",
      height: "auto",
      display: "block"
    }
  }, yTickVals.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: W - padR,
    y1: y(v),
    y2: y(v),
    stroke: COLORS.creamDark,
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 6,
    y: y(v) + 3,
    textAnchor: "end",
    fontSize: "8",
    fontFamily: "'IBM Plex Mono', monospace",
    fill: COLORS.inkSoft
  }, v))), xTickVals.map((o, i) => o > 0 && o < maxOver && /*#__PURE__*/React.createElement("line", {
    key: `xg${i}`,
    x1: x(o),
    x2: x(o),
    y1: padT,
    y2: H - padB,
    stroke: COLORS.creamDark,
    strokeWidth: "0.75"
  })), xTickVals.map((o, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: x(o),
    y: H - 4,
    textAnchor: o === 0 ? "start" : o === maxOver ? "end" : "middle",
    fontSize: "8",
    fontFamily: "'IBM Plex Mono', monospace",
    fill: COLORS.inkSoft
  }, o, i === xTickVals.length - 1 ? " ov" : "")), /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: W - padR,
    y1: H - padB,
    y2: H - padB,
    stroke: COLORS.willow,
    strokeWidth: "1.2"
  }), series.map((points, i) => /*#__PURE__*/React.createElement("polyline", {
    key: i,
    points: points.map(p => `${x(p.over)},${y(p.runs)}`).join(" "),
    fill: "none",
    stroke: seriesColors[i],
    strokeWidth: "2",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  })), wicketPoints.map((wks, i) => wks.map((w, wi) => /*#__PURE__*/React.createElement("g", {
    key: `${i}-${wi}`
  }, /*#__PURE__*/React.createElement("title", null, `${w.wicket}${w.batsman ? " \u2013 " + w.batsman : ""}`), /*#__PURE__*/React.createElement("line", {
    x1: x(w.over),
    x2: x(w.over),
    y1: y(w.runs) + wicketMarkerRadius + 2,
    y2: H - padB,
    stroke: COLORS.ball,
    strokeWidth: "1",
    strokeDasharray: "1.5 1.5",
    opacity: "0.35"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(w.over),
    cy: y(w.runs),
    r: wicketMarkerRadius + 1.6,
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(w.over),
    cy: y(w.runs),
    r: wicketMarkerRadius,
    fill: COLORS.ball,
    stroke: "#fff",
    strokeWidth: "1"
  })))), series.map((points, i) => {
    const last = points[points.length - 1];
    return last ? /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: x(last.over),
      cy: y(last.runs),
      r: "3",
      fill: seriesColors[i]
    }) : null;
  })));
}

export function RunsPerOverChart({
  match
}) {
  const innings = match.innings;
  const hasData = innings.some(inn => inn.overs.some(o => o.length > 0));
  if (!hasData) return null;
  const seriesColors = innings.map((inn, i) => teamColorFor(match, inn.battingTeam, i === 0 ? COLORS.turf : COLORS.gold));
  const perOver = innings.map(inn => {
    const arr = [];
    inn.overs.forEach((balls, i) => {
      if (balls.length === 0 && i === inn.overs.length - 1) return; // in-progress empty trailing over
      arr[i] = balls.reduce((s, b) => s + (b.runs || 0), 0);
    });
    return arr;
  });
  const wicketsByOver = innings.map(inn => {
    const m = {};
    (inn.fallOfWickets || []).forEach(fow => {
      const overNum = Math.max(1, Math.ceil(parseOverLabel(fow.over, inn.ballsPerOver)));
      m[overNum] = (m[overNum] || 0) + 1;
    });
    return m;
  });
  // The most expensive over per innings gets a highlighted bar — ties all highlight.
  const maxByInnings = perOver.map(arr => Math.max(...arr.filter(v => v != null), -1));
  const bowledOvers = Math.max(...perOver.map(arr => arr.length), 0);
  const totalOvers = Math.max(match.oversLimit, bowledOvers, 1);
  const maxOverRuns = Math.max(...perOver.flatMap(arr => arr.filter(v => v != null)), 6);
  // Fixed unit column width in the SVG's own coordinate system, but the SVG itself is rendered at
  // width="100%" (see below) instead of a fixed pixel width — the browser scales the whole
  // viewBox to fit the card, so every over's column stays exactly the same width as every other
  // one AND the full set always fits the screen without needing to scroll to see the later overs.
  const colW = 24,
    barW = 9,
    barGap = 2,
    padL = 6,
    padR = 6,
    padT = 22,
    padB = 20,
    plotH = 70;
  const H = padT + plotH + padB;
  const W = padL + totalOvers * colW + padR;
  const baseY = padT + plotH;
  const barH = runs => runs == null ? 0 : Math.max(2, runs / maxOverRuns * plotH);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 10,
      flexWrap: "wrap",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase"
    }
  }, "Runs Per Over"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap"
    }
  }, innings.map((inn, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: seriesColors[i],
      display: "inline-block"
    }
  }), inn.battingTeam)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: COLORS.ball,
      display: "inline-block"
    }
  }), "Most expensive"))), totalOvers > 14 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      marginBottom: 6
    }
  }, "\u2192 scroll for more overs"), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      WebkitOverflowScrolling: "touch"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: W - padR,
    y1: baseY,
    y2: baseY,
    stroke: COLORS.willow,
    strokeWidth: "1.2"
  }), Array.from({
    length: totalOvers
  }, (_, col) => {
    const overNum = col + 1;
    const colX = padL + col * colW;
    const cx = colX + colW / 2;
    const slots = innings.length > 1 ? [cx - barGap / 2 - barW, cx + barGap / 2] : [cx - barW / 2];
    return /*#__PURE__*/React.createElement("g", {
      key: col
    }, /*#__PURE__*/React.createElement("title", null, `Over ${overNum}: ` + innings.map((inn, i) => perOver[i][col] != null ? `${inn.battingTeam} ${perOver[i][col]}${wicketsByOver[i][overNum] ? " (" + wicketsByOver[i][overNum] + "w)" : ""}` : null).filter(Boolean).join(", ")), innings.map((inn, i) => {
      const runs = perOver[i][col];
      if (runs == null) return null;
      const h = barH(runs);
      const bx = slots[i];
      const wk = wicketsByOver[i][overNum] || 0;
      const isMostExpensive = runs === maxByInnings[i] && runs > 0;
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("rect", {
        x: bx,
        y: baseY - h,
        width: barW,
        height: h,
        rx: 1.5,
        fill: isMostExpensive ? COLORS.ball : seriesColors[i]
      }), /*#__PURE__*/React.createElement("text", {
        x: bx + barW / 2,
        y: baseY - h - 3,
        textAnchor: "middle",
        fontSize: "7",
        fontWeight: isMostExpensive ? 700 : 500,
        fontFamily: "'IBM Plex Mono', monospace",
        fill: isMostExpensive ? COLORS.ball : COLORS.inkSoft
      }, runs), Array.from({
        length: Math.min(wk, 3)
      }, (_, k) => /*#__PURE__*/React.createElement("circle", {
        key: k,
        cx: bx + barW / 2,
        cy: baseY - h - 13 - k * 5,
        r: "2",
        fill: COLORS.ball,
        stroke: "#fff",
        strokeWidth: "0.75"
      })));
    }), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: baseY + 12,
      textAnchor: "middle",
      fontSize: "7.5",
      fontFamily: "'IBM Plex Mono', monospace",
      fill: COLORS.inkSoft
    }, overNum));
  }))));
}

export function SyncConflictModal({
  local,
  remote,
  onKeepMine,
  onUseTheirs
}) {
  const localInn = local.innings[local.currentInningIndex];
  const remoteInn = remote.innings[Math.min(remote.currentInningIndex, remote.innings.length - 1)];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(20,16,12,0.55)",
      zIndex: 80,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      animation: "cs-scrim 0.2s ease"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.cream,
      borderRadius: 18,
      padding: 22,
      maxWidth: 360,
      width: "100%",
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.ink,
      marginBottom: 6
    }
  }, "Scores don\u2019t match"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, "Another device saved a ball for this match that this one hasn\u2019t seen. Pick which version to keep going with \u2014 the other will be overwritten."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: COLORS.surface,
      borderRadius: 12,
      padding: "10px 12px",
      boxShadow: "0 1px 3px rgba(42,36,32,0.08)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "This device"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      fontSize: 16,
      color: COLORS.ink
    }
  }, localInn.runs, "-", localInn.wickets, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      color: COLORS.inkSoft
    }
  }, "(", oversLabel(localInn.legalBalls, localInn.ballsPerOver), ")"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: COLORS.surface,
      borderRadius: 12,
      padding: "10px 12px",
      boxShadow: "0 1px 3px rgba(42,36,32,0.08)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: COLORS.inkSoft,
      marginBottom: 4
    }
  }, "Other device"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      fontSize: 16,
      color: COLORS.ink
    }
  }, remoteInn.runs, "-", remoteInn.wickets, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      color: COLORS.inkSoft
    }
  }, "(", oversLabel(remoteInn.legalBalls, remoteInn.ballsPerOver), ")")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: onKeepMine,
    style: {
      width: "100%"
    }
  }, "Keep this device\u2019s version"), /*#__PURE__*/React.createElement(Btn, {
    onClick: onUseTheirs,
    style: {
      width: "100%"
    }
  }, "Use the other device\u2019s version"))));
}

export function PlayerOfMatchCard({
  match,
  setMatch
}) {
  const suggested = suggestPlayerOfMatch(match);
  const players = allMatchPlayers(match);
  const [picking, setPicking] = useState(false);
  const current = match.playerOfMatch;
  function pick(name) {
    const updated = {
      ...match,
      playerOfMatch: name
    };
    setMatch(updated);
    saveMatch(updated).then(result => {
      if (result.ok && result.writeSeq != null) {
        setMatch(cur => cur ? {
          ...cur,
          writeSeq: result.writeSeq
        } : cur);
      }
    });
    setPicking(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)"
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
  }, "Player of the Match"), current ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 18,
    style: {
      color: COLORS.gold
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 15,
      color: COLORS.ink
    }
  }, current)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPicking(true),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Change")) : !picking ? /*#__PURE__*/React.createElement("div", null, suggested && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, "Suggested, by runs + wickets: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, suggested)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, suggested && /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => pick(suggested),
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Trophy, {
    size: 15
  }), " Confirm ", suggested), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setPicking(true),
    style: {
      flexShrink: 0
    }
  }, suggested ? "Pick someone else" : "Pick player of the match"))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10
    }
  }, players.map(name => /*#__PURE__*/React.createElement("button", {
    key: name,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => pick(name),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, name, name === suggested ? " ★" : ""))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPicking(false),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Cancel")));
}

export function BestFielderCard({
  match,
  setMatch
}) {
  const suggested = suggestBestFielder(match);
  const players = allMatchPlayers(match);
  const [picking, setPicking] = useState(false);
  const current = match.bestFielder;
  function pick(name) {
    const updated = {
      ...match,
      bestFielder: name
    };
    setMatch(updated);
    saveMatch(updated).then(result => {
      if (result.ok && result.writeSeq != null) {
        setMatch(cur => cur ? {
          ...cur,
          writeSeq: result.writeSeq
        } : cur);
      }
    });
    setPicking(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 6px 18px rgba(42,36,32,0.05)"
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
  }, "Best Fielder"), current ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Hand, {
    size: 18,
    style: {
      color: COLORS.pitch
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 15,
      color: COLORS.ink
    }
  }, current)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPicking(true),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Change")) : !picking ? /*#__PURE__*/React.createElement("div", null, suggested && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, "Suggested, by catches + run outs: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: COLORS.ink
    }
  }, suggested)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, suggested && /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: () => pick(suggested),
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Hand, {
    size: 15
  }), " Confirm ", suggested), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setPicking(true),
    style: {
      flexShrink: 0
    }
  }, suggested ? "Pick someone else" : "Pick best fielder"))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10
    }
  }, players.map(name => /*#__PURE__*/React.createElement("button", {
    key: name,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: () => pick(name),
    style: {
      padding: "8px 14px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      background: COLORS.surface,
      color: COLORS.ink,
      boxShadow: "0 1px 2px rgba(42,36,32,0.08)",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13
    }
  }, name, name === suggested ? " ★" : ""))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPicking(false),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "Cancel")));
}
