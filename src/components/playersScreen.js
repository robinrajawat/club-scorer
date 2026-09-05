import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft } from "./icons.js";
import { TextField, ConfirmModal, PlayerAvatar } from "./formUiAtoms.js";
import { LoadingNote, EmptyStateBallIllustration } from "./illustrations.js";
import { EditPlayerModal, TransferPlayerModal, PLAYER_ROLES, PLAYER_HANDS } from "./playerModals.js";
import { isClubOwner } from "../core/miscHelpers.js";

// Public player directory: search all players any club has made public, view one's details/stats,
// and (for the home club's owner) edit details, transfer to another club, or delete. Every read/
// write is a prop (onLoadPublicPlayers, onComputeCareerStats, onDeletePlayer, onSearchPublicClubs,
// onTransferPlayer, onUpdatePlayerInfo) -- no bare globals at all. Covered by
// tests/unit/components/playersScreen.test.js.

export function PlayersScreen({
  onBack,
  initialSelected,
  onLoadPublicPlayers,
  onComputeCareerStats,
  onDeletePlayer,
  onSearchPublicClubs,
  onTransferPlayer,
  onUpdatePlayerInfo,
  currentUid,
  clubs = []
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null); // a player object, or null for the list view
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    onLoadPublicPlayers().then(list => {
      if (cancelled) return;
      setPlayers(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // Home's Players-tab search hands over the already-loaded player object it was showing, so this
  // opens straight to that detail view instead of waiting on the list fetch above (which still
  // runs in parallel, purely so "back to list" has something to show). Runs once on mount only --
  // this screen doesn't need to react to it changing later, just what it was handed on entry.
  useEffect(() => {
    if (initialSelected) openPlayer(initialSelected);
  }, []);
  const filtered = query.trim() ? players.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase())) : players;
  async function openPlayer(p) {
    setSelected(p);
    setStats(null);
    setStatsLoading(true);
    setDeleteError("");
    const s = await onComputeCareerStats(p.name, p.homeClubId);
    setStatsLoading(false);
    setStats(s);
  }
  async function handleDeletePlayer() {
    if (!selected || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    const result = await onDeletePlayer(selected.email);
    setDeleteBusy(false);
    if (!result.ok) {
      setDeleteError(result.error || "Couldn't delete this player.");
      return;
    }
    setPlayers(list => list.filter(p => p.email !== selected.email));
    setConfirmDelete(false);
    setSelected(null);
  }
  const homeClub = selected ? clubs.find(c => c.id === selected.homeClubId) : null;
  const roleLabel = v => (PLAYER_ROLES.find(r => r.value === v) || {}).label;
  const handLabel = v => (PLAYER_HANDS.find(h => h.value === v) || {}).label;
  const backBtnStyle = {
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
  };
  if (selected) {
    const info = [selected.age && `${selected.age} yrs`, roleLabel(selected.role), selected.battingHand && `${handLabel(selected.battingHand)}-hand bat`, selected.bowlingHand && (selected.role === "bowler" || selected.role === "allrounder") && `${handLabel(selected.bowlingHand)}-arm bowler`].filter(Boolean);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "20px 16px 60px",
        maxWidth: 560,
        margin: "0 auto"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setSelected(null),
      className: "cs-btn",
      style: backBtnStyle
    }, /*#__PURE__*/React.createElement(ChevronLeft, {
      size: 16
    }), " Players"), /*#__PURE__*/React.createElement("div", {
      style: {
        background: COLORS.surface,
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement(PlayerAvatar, {
      name: selected.name,
      photoURL: selected.photoURL,
      size: 48
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'DM Serif Display', serif",
        fontSize: 24,
        color: COLORS.pitch
      }
    }, selected.name)), info.length > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft
      }
    }, info.join(" \u00b7 ")) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft,
        fontStyle: "italic"
      }
    }, "No further details added yet."), homeClub && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft,
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px dashed ${COLORS.creamDark}`
      }
    }, "Home club: ", homeClub.name)), /*#__PURE__*/React.createElement("div", {
      style: {
        background: COLORS.surface,
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
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
    }, "Stats", homeClub ? ` \u2014 ${homeClub.name}'s tournaments` : ""), statsLoading ? /*#__PURE__*/React.createElement(LoadingNote, {
      label: "Loading stats\u2026"
    }) : !stats ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 13,
        color: COLORS.inkSoft,
        fontStyle: "italic"
      }
    }, "No completed matches to show stats from yet \u2014 either they haven't played in a tournament at their home club, or you don't have access to see it.") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 14
      }
    }, [["Runs", stats.runs], ["HS", stats.bestBattingLabel || "\u2014"], ["Bat Avg", stats.battingAvg === null ? "\u2014" : stats.battingAvg.toFixed(1)], ["SR", stats.strikeRate === null ? "\u2014" : stats.strikeRate.toFixed(1)], ["Wkts", stats.wickets], ["Best", stats.bestBowlingLabel || "\u2014"], ["Econ", stats.economy === null ? "\u2014" : stats.economy.toFixed(2)], ["Catches", stats.catches]].map(([label, value]) => /*#__PURE__*/React.createElement("div", {
      key: label
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 17,
        fontWeight: 700,
        color: COLORS.pitch
      }
    }, value), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 10.5,
        color: COLORS.inkSoft,
        textTransform: "uppercase",
        letterSpacing: 0.4
      }
    }, label))))), homeClub && isClubOwner(homeClub, currentUid) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        textAlign: "center"
      }
    }, deleteError && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 12,
        color: COLORS.ball,
        marginBottom: 8
      }
    }, deleteError), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setEditOpen(true),
      className: "cs-btn",
      style: {
        background: "none",
        border: "none",
        color: COLORS.pitch,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
        padding: 4,
        marginRight: 10,
        textDecoration: "underline"
      }
    }, "Edit details"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setTransferOpen(true),
      className: "cs-btn",
      style: {
        background: "none",
        border: "none",
        color: COLORS.pitch,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
        padding: 4,
        marginRight: 10,
        textDecoration: "underline"
      }
    }, "Transfer to another club"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setConfirmDelete(true),
      className: "cs-btn",
      style: {
        background: "none",
        border: "none",
        color: COLORS.ball,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
        padding: 4,
        textDecoration: "underline"
      }
    }, "Delete player")), confirmDelete && /*#__PURE__*/React.createElement(ConfirmModal, {
      title: `Delete ${selected.name}?`,
      message: `Removes ${selected.name} from the public player directory permanently \u2014 other clubs won't be able to find or borrow them again. Teams that already borrowed them keep their own local roster copy, and nothing about past match stats changes.`,
      confirmLabel: "Delete",
      busy: deleteBusy,
      onConfirm: handleDeletePlayer,
      onCancel: () => setConfirmDelete(false)
    }), editOpen && /*#__PURE__*/React.createElement(EditPlayerModal, {
      player: selected,
      onSave: info => onUpdatePlayerInfo(selected.email, info),
      onClose: updatedInfo => {
        setEditOpen(false);
        if (updatedInfo) {
          const updated = {
            ...selected,
            ...updatedInfo
          };
          setPlayers(list => list.map(p => p.email === selected.email ? updated : p));
          openPlayer(updated);
        }
      }
    }), transferOpen && /*#__PURE__*/React.createElement(TransferPlayerModal, {
      player: selected,
      onSearchClubs: onSearchPublicClubs,
      onTransfer: onTransferPlayer,
      onClose: newClub => {
        setTransferOpen(false);
        if (newClub) {
          const updated = {
            ...selected,
            homeClubId: newClub.clubId
          };
          setPlayers(list => list.map(p => p.email === selected.email ? updated : p));
          openPlayer(updated);
        }
      }
    }));
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
    style: backBtnStyle
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 16
  }), " Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 26,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Players"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      marginBottom: 16
    }
  }, "Every player a club has made public \u2014 see their info, or borrow them onto a roster from Team editing."), /*#__PURE__*/React.createElement(TextField, {
    value: query,
    onChange: setQuery,
    placeholder: "Search by name",
    style: {
      marginBottom: 14
    }
  }), loading ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading players\u2026"
  }) : filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 20px",
      borderRadius: 16,
      border: `1.5px dashed ${COLORS.willow}`,
      background: `color-mix(in srgb, ${COLORS.surface} 40%, transparent)`
    }
  }, /*#__PURE__*/React.createElement(EmptyStateBallIllustration, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginTop: 14
    }
  }, players.length === 0 ? "No public players yet." : "No players match that search.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filtered.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    type: "button",
    onClick: () => openPlayer(p),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: "none",
      background: COLORS.surface,
      cursor: "pointer",
      textAlign: "left",
      boxShadow: "0 1px 2px rgba(42,36,32,0.06)"
    }
  }, /*#__PURE__*/React.createElement(PlayerAvatar, {
    name: p.name,
    photoURL: p.photoURL,
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14,
      color: COLORS.ink
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft
    }
  }, [roleLabel(p.role), p.age && `${p.age} yrs`].filter(Boolean).join(" \u00b7 ")))))));
}
