import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, Plus } from "./icons.js";
import { Btn, ConfirmModal } from "./formUiAtoms.js";
import { PlayerPicker } from "./pickerAtoms.js";
import { FixtureRow } from "./fixtureRow.js";
import { uid, suggestPlayerOfTournament, allMatchPlayers } from "../core/statsAndFixtures.js";
import { computeSeriesScore } from "../core/appLogic.js";

// A "series" (teamA vs teamB over N fixtures, e.g. a 3-match ODI series) detail screen: running
// score, each fixture (via FixtureRow), Player of the Series, and delete. Covered by
// tests/unit/components/seriesDetailScreen.test.js.
//
// `loadTournamentMatches` runs from a mount-time useEffect -- a bare-global Firestore call, not
// extracted -- stubbed the same way every other mount-effect screen's tests stub theirs.

export function SeriesDetailScreen({
  series,
  onBack,
  backLabel = "Cups",
  onStartFixtureMatch,
  onUpdateSeries,
  onOpenMatch,
  onDeleteSeries,
  canManage = true
}) {
  const [matches, setMatches] = useState(null); // null = loading
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingPOS, setEditingPOS] = useState(false);
  const [posDraft, setPosDraft] = useState("");
  const [posBusy, setPosBusy] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadTournamentMatches(series.id).then(m => {
      if (!cancelled) setMatches(m);
    });
    return () => {
      cancelled = true;
    };
  }, [series.id]);
  const score = matches ? computeSeriesScore(series, matches) : null;
  const seriesMatches = matches ? matches.filter(m => m.tournamentId === series.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
  const completedSeriesMatches = seriesMatches.filter(m => m.status === "complete");
  const suggestedPOS = suggestPlayerOfTournament(completedSeriesMatches);
  const allPOSCandidates = Array.from(new Set(completedSeriesMatches.flatMap(m => allMatchPlayers(m)))).sort();
  const finalPOS = series.playerOfSeries || suggestedPOS;
  let scoreText = "Series not yet started";
  if (score && score.played > 0) {
    if (score.winsA === score.winsB) {
      scoreText = score.played === score.total ? `Series tied ${score.winsA}\u2013${score.winsB}` : `Series level ${score.winsA}\u2013${score.winsB}`;
    } else {
      const leader = score.winsA > score.winsB ? series.teamA : series.teamB;
      const verb = score.played === score.total ? "won" : "leads";
      scoreText = `${leader} ${verb} the series ${Math.max(score.winsA, score.winsB)}\u2013${Math.min(score.winsA, score.winsB)}`;
    }
  }
  function startEditPOS() {
    if (!canManage) return;
    setPosDraft(series.playerOfSeries || suggestedPOS || "");
    setEditingPOS(true);
  }
  async function savePOS() {
    if (!canManage || !posDraft) return;
    setPosBusy(true);
    await onUpdateSeries({
      ...series,
      playerOfSeries: posDraft
    });
    setPosBusy(false);
    setEditingPOS(false);
  }
  async function resetPOSToSuggestion() {
    if (!canManage) return;
    setPosBusy(true);
    await onUpdateSeries({
      ...series,
      playerOfSeries: null
    });
    setPosBusy(false);
    setEditingPOS(false);
  }
  async function addAnotherMatch() {
    if (!canManage || addingMatch) return;
    setAddingMatch(true);
    await onUpdateSeries({
      ...series,
      fixtures: [...(series.fixtures || []), {
        id: uid(),
        teamA: series.teamA,
        teamB: series.teamB,
        date: "",
        matchId: null
      }]
    });
    setAddingMatch(false);
  }
  function handleDeleteClick() {
    if (!canManage) return;
    setConfirmDelete(true);
  }
  function confirmDeleteNow() {
    setConfirmDelete(false);
    setDeleting(true);
    onDeleteSeries(series);
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
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 3,
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " " + backLabel), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 22,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, series.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 14,
      fontWeight: 600,
      color: COLORS.ink,
      marginBottom: 16
    }
  }, scoreText), matches === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'"
    }
  }, "Loading\u2026") : /*#__PURE__*/React.createElement(React.Fragment, null, (series.fixtures || []).map(f => /*#__PURE__*/React.createElement(FixtureRow, {
    key: f.id,
    fixture: f,
    tournament: series,
    match: seriesMatches.find(m => m.id === f.matchId) || null,
    onScore: () => onStartFixtureMatch(series, f),
    onUpdateDate: date => onUpdateSeries({
      ...series,
      fixtures: series.fixtures.map(x => x.id === f.id ? {
        ...x,
        date
      } : x)
    }),
    onDelete: canManage && !f.matchId ? () => onUpdateSeries({
      ...series,
      fixtures: series.fixtures.filter(x => x.id !== f.id)
    }) : null
  })), canManage && /*#__PURE__*/React.createElement(Btn, {
    onClick: addAnotherMatch,
    disabled: addingMatch,
    style: {
      width: "100%",
      marginTop: 4,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), addingMatch ? "Adding\u2026" : "Add another match"), completedSeriesMatches.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 3px 10px rgba(42,36,32,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 8
    }
  }, "Player of the Series"), editingPOS ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PlayerPicker, {
    roster: allPOSCandidates,
    value: posDraft,
    onChange: setPosDraft
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditingPOS(false),
    style: {
      flex: 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: posBusy || !posDraft,
    onClick: savePOS,
    style: {
      flex: 1
    }
  }, "Save"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 17,
      color: COLORS.ink
    }
  }, finalPOS || "\u2014"), canManage && /*#__PURE__*/React.createElement("button", {
    onClick: startEditPOS,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, series.playerOfSeries ? "Change" : "Set manually")), series.playerOfSeries && !editingPOS && /*#__PURE__*/React.createElement("button", {
    onClick: resetPOSToSuggestion,
    disabled: posBusy,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 11,
      cursor: "pointer",
      marginTop: 4,
      textDecoration: "underline"
    }
  }, "Use suggested instead"))), canManage && /*#__PURE__*/React.createElement("button", {
    onClick: handleDeleteClick,
    disabled: deleting,
    className: "cs-btn",
    style: {
      display: "block",
      width: "100%",
      textAlign: "center",
      background: "none",
      border: "none",
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      padding: "10px 4px",
      textDecoration: "underline"
    }
  }, deleting ? "Deleting\u2026" : "Delete series"), confirmDelete && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Delete this series?",
    message: `Delete "${series.name}"? Matches already scored in it are untouched, but the series and its running score go away for good.`,
    confirmLabel: "Delete",
    onConfirm: confirmDeleteNow,
    onCancel: () => setConfirmDelete(false)
  }));
}
