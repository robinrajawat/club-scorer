import React from "react";
import { COLORS } from "./theme.js";

// Small presentational table components: a tournament's points table (StandingsTable) and a
// generic labeled-columns record table used across the Record Book (RecordTable). Covered by
// tests/unit/components/tableAtoms.test.js using react-test-renderer.

export function StandingsTable({
  standings
}) {
  const tableTopper = standings[0] && standings[0].played > 0 ? standings[0] : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: "14px 4px",
      marginBottom: 20,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)",
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "'Inter'",
      fontSize: 12.5,
      minWidth: 420
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: COLORS.inkSoft,
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5
    }
  }, ["Team", "P", "W", "L", "T", "NR", "Pts", "NRR"].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: i === 0 ? "left" : "center",
      padding: "0 8px 8px",
      whiteSpace: "nowrap"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, standings.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.team,
    style: {
      borderTop: `1px solid ${COLORS.creamDark}`,
      background: tableTopper && r.team === tableTopper.team ? "rgba(184,137,43,0.08)" : "transparent"
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
  }, r.played === 0 ? "\u2014" : (r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(3)))))));
}

export function RecordTable({
  title,
  columns,
  rows,
  emptyText
}) {
  const headerCellStyle = {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5
  };
  const gridCols = columns.map(c => c.width || "1fr").join(" ");
  return /*#__PURE__*/React.createElement("div", {
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
  }, title), rows.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, emptyText) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: gridCols,
      gap: 4,
      padding: "0 2px 6px",
      borderBottom: `1.5px solid ${COLORS.willow}`
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      ...headerCellStyle,
      textAlign: c.align || "left"
    }
  }, c.label))), rows.map((r, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "grid",
      gridTemplateColumns: gridCols,
      gap: 4,
      padding: "7px 2px",
      borderBottom: ri < rows.length - 1 ? `1px dashed ${COLORS.creamDark}` : "none",
      fontFamily: "'Inter'"
    }
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("span", {
    key: ci,
    style: {
      fontSize: ci === 0 ? 13 : 12.5,
      fontWeight: ci === 0 ? 600 : 400,
      color: COLORS.ink,
      textAlign: columns[ci].align || "left",
      fontFamily: columns[ci].mono ? "'IBM Plex Mono', monospace" : "'Inter'",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, cell))))));
}
