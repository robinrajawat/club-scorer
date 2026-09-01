import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, Plus, Globe, Users, Check } from "./icons.js";
import { Field } from "./screenAtoms.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";
import { LoadingNote } from "./illustrations.js";
import { PLAYER_ROLES, EditPlayerModal } from "./playerModals.js";
import { uid } from "../core/statsAndFixtures.js";
import { normalizeEmail, TEAM_COLOR_PRESETS } from "../core/miscHelpers.js";

// Create/edit a team's roster: name, jersey color, add/remove/reorder players (typed, borrowed
// from another club's public directory, or copied from this club's own player pool), captain/
// keeper toggles, and per-player publish/unpublish to the shared player directory. Every write
// that reaches Firestore (onPublishPlayer/onUnpublishPlayer/onUpdatePlayerInfo/
// onLoadPublicPlayers/onAddPoolPlayers/onSave) is a prop -- the one exception is
// checkDeletedBorrowedPlayers, called from a mount-time useEffect to flag a borrowed roster row
// whose source player doc has since been deleted outright; it's a bare global (reads `db`
// directly, not extracted) same as every other not-yet-extracted Firestore helper in this suite.
// `Modal` (bare global) backs the borrow-a-player and add-from-pool dialogs.
// Covered by tests/unit/components/teamEditScreen.test.js.

export function TeamEditScreen({
  team,
  clubId,
  clubs = [],
  onPublishPlayer,
  onUnpublishPlayer,
  onUpdatePlayerInfo,
  onLoadPublicPlayers,
  onAddPoolPlayers,
  // Prefills a brand-new team's name/roster (only ever consulted when `team` is null) -- set
  // when this screen was opened via "Create team" from a Player Pool group in TeamsScreen,
  // instead of the usual empty new-team state. { name, players: [pool player objects] } | null.
  presetTeamSeed,
  onSave,
  onCancel
}) {
  const [name, setName] = useState(team ? team.name : presetTeamSeed ? presetTeamSeed.name : "");
  const [players, setPlayers] = useState(team ? team.players.map(p => typeof p === "string" ? {
    name: p,
    number: "",
    email: "",
    public: false,
    age: "",
    role: "",
    battingHand: "",
    bowlingHand: "",
    _key: uid()
  } : {
    name: p.name,
    number: p.number || "",
    email: p.email || "",
    public: !!p.public,
    homeClubId: p.homeClubId || null,
    // Only set when this row was already backed by a published player doc at mount -- used to
    // warn if `name` (edited via the row's own name input above) drifts from it, since
    // computePlayerCareerStats matches a player to their past scorecards by name string, not a
    // stable id. A brand-new publish (was never public before) isn't a rename, so this stays
    // null in that case and no warning is shown.
    _originalName: p.public ? p.name : null,
    // Age/role/hand live only on the shared player doc, not on the roster entry itself (avoids
    // two copies drifting apart) — so re-opening an already-published player's row starts these
    // blank rather than pre-filled; editing here always writes straight through to that doc.
    age: "",
    role: "",
    battingHand: "",
    bowlingHand: "",
    _key: uid()
  }) : (presetTeamSeed ? presetTeamSeed.players : []).map(p => ({
    name: p.name,
    number: "",
    email: "",
    public: false,
    age: "",
    role: p.role || "",
    battingHand: "",
    bowlingHand: "",
    _key: uid()
  })));
  const [newPlayer, setNewPlayer] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [captain, setCaptain] = useState(team ? team.captain || "" : "");
  const [keeper, setKeeper] = useState(team ? team.keeper || "" : "");
  const [color, setColor] = useState(team ? team.color || "" : "");
  // Player details (email + public toggle) are tucked behind a per-row expand, rather than always
  // shown, since most rec-league rosters will never touch this — one row open at a time.
  const [expandedKey, setExpandedKey] = useState(null);
  const [publishBusyKey, setPublishBusyKey] = useState(null);
  // Which row's EditPlayerModal is open, if any -- separate from expandedKey (which row's detail
  // panel is expanded) since the modal can be opened while any row is expanded.
  const [editingPlayerKey, setEditingPlayerKey] = useState(null);
  const [publishError, setPublishError] = useState("");
  // Cross-club "borrow a player" directory — only relevant for a club-owned team (clubId set);
  // loaded lazily the first time the picker opens rather than on mount, since most edits never
  // need it.
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [publicPlayers, setPublicPlayers] = useState([]);
  // Club player pool picker -- data's already on hand via the clubs prop (no async load needed,
  // unlike publicPlayers above), so this is just visibility state for the modal.
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  // Which pool players are checked in the picker, keyed by pool entry id -- lets someone tick
  // several names and add them all in one go instead of reopening the picker per player (the
  // previous behavior: tapping a row added it and closed the modal immediately). Cleared whenever
  // the picker opens/closes so a stale selection never carries into the next time it's opened.
  const [selectedPoolIds, setSelectedPoolIds] = useState(new Set());
  const [poolSearch, setPoolSearch] = useState("");
  function togglePoolSelection(id) {
    setSelectedPoolIds(cur => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  }
  function closePoolPicker() {
    setPoolPickerOpen(false);
    setSelectedPoolIds(new Set());
    setPoolSearch("");
  }
  // Removing a player is destructive to whatever local edits (number, captain/keeper role) they
  // had on this team, so it goes through the same ConfirmModal pattern as every other destructive
  // action in the app, instead of the previous single-tap X.
  const [confirmRemove, setConfirmRemove] = useState(null); // the player row object, or null
  // Checked once on mount against whatever borrowed players this roster already had (see
  // isBorrowed) — a set of emails whose player doc no longer exists at all, so the badge below
  // can flag a roster row whose source was actually deleted, not just merely unpublished.
  const [deletedBorrowedEmails, setDeletedBorrowedEmails] = useState(new Set());
  useEffect(() => {
    const borrowedEmails = players.filter(p => isBorrowed(p) && p.email).map(p => p.email);
    if (borrowedEmails.length === 0) return;
    let cancelled = false;
    checkDeletedBorrowedPlayers(borrowedEmails).then(set => {
      if (!cancelled) setDeletedBorrowedEmails(set);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  async function openBrowse() {
    setBrowseOpen(true);
    if (publicPlayers.length > 0) return;
    setBrowseLoading(true);
    setPublicPlayers(await onLoadPublicPlayers());
    setBrowseLoading(false);
  }
  function addBorrowedPlayer(p) {
    if (players.some(x => x.email && x.email === p.email)) {
      setBrowseOpen(false);
      return;
    }
    setPlayers(list => [...list, {
      name: p.name,
      number: "",
      email: p.email,
      public: true,
      // Marks this row as belonging to another club's player directory entry, not this team's
      // own roster — see isBorrowed() below, which gates name/age/role/hand editing (those stay
      // the home club's to manage) while leaving the jersey number free to differ per team.
      homeClubId: p.homeClubId || null,
      age: p.age || "",
      role: p.role || "",
      battingHand: p.battingHand || "",
      bowlingHand: p.bowlingHand || "",
      _key: uid()
    }]);
    setBrowseOpen(false);
  }
  // True when this roster row is a player published by a DIFFERENT club — their name, email, and
  // age/role/hand are that club's to manage, not this one's. Jersey number is always local to
  // this team's roster regardless (a borrowed player can easily wear a different number here than
  // they do for their own club), so it's deliberately excluded from this check.
  function isBorrowed(p) {
    return !!(p.homeClubId && clubId && p.homeClubId !== clubId);
  }
  // Resolves a borrowed player's home club id into a readable name for the badge below. Was
  // previously only ever surfaced via a `title` tooltip on the badge -- invisible on a touch
  // device, since a tooltip needs hover, which a phone doesn't have. The dedicated Players screen
  // already shows "Home club: X" as plain, always-visible text (see the homeClub lookup there);
  // this roster view had the same information available (p.homeClubId) but no way to actually
  // show it, since it never received a `clubs` list to resolve the id against at all.
  function homeClubName(p) {
    const c = clubs.find(x => x.id === p.homeClubId);
    return c ? c.name : "another club";
  }
  // This team's own club's player pool (see the Player Pool section of ClubPanel) -- already
  // present on the clubs prop, unlike publicPlayers above which needs its own async load.
  const clubPool = clubId ? ((clubs.find(c => c.id === clubId) || {}).playerPool || []).filter(p => p.status !== "inactive") : [];
  // Hoisted out of the JSX (rather than computed inline where it's used) so the render tree below
  // stays a plain ternary instead of an inline IIFE -- much easier to get right than juggling
  // extra parens deep inside a JSX expression.
  const filteredPool = poolSearch.trim() ? clubPool.filter(pp => pp.name.toLowerCase().includes(poolSearch.trim().toLowerCase())) : clubPool;
  // "Select all" acts on whatever's currently filtered, not the whole pool -- so searching first
  // then selecting-all only grabs the matches, and it toggles off if everything visible (that
  // isn't already on the roster) is already checked, rather than being a one-way action.
  // Selections outside the current filter (from a previous search term) are left untouched.
  const selectablePoolIds = filteredPool.filter(pp => !players.some(x => x.name.trim().toLowerCase() === pp.name.trim().toLowerCase())).map(pp => pp.id);
  const allFilteredSelected = selectablePoolIds.length > 0 && selectablePoolIds.every(id => selectedPoolIds.has(id));
  function toggleSelectAllFiltered() {
    setSelectedPoolIds(cur => {
      const next = new Set(cur);
      selectablePoolIds.forEach(id => allFilteredSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }
  const [addError, setAddError] = useState("");
  // Typing a brand-new name into the roster only ever added them to THIS team -- there was no way
  // to also get them into the club's reusable pool without leaving team editing entirely, adding
  // them from ClubPanel's own Player Pool section, then coming back. Defaults on for a club team
  // (opt-out, not opt-in) since the whole point of a pool is that most new names typed while
  // building a roster are genuinely new club members worth having reusable for future teams too,
  // not one-off placeholders. Irrelevant for a personal team (no clubId, no pool to add to).
  const [alsoAddToPool, setAlsoAddToPool] = useState(true);
  async function addPlayer() {
    const n = newPlayer.trim();
    if (!n) return;
    if (players.some(p => p.name.trim().toLowerCase() === n.toLowerCase())) {
      setAddError(`${n} is already on this team.`);
      return;
    }
    setAddError("");
    setPlayers(p => [...p, {
      name: n,
      number: newNumber.trim(),
      email: "",
      public: false,
      _key: uid()
    }]);
    // Skips silently (not an error) on a name already in the pool -- same "picking, not typing,
    // makes a clash almost certainly accidental" reasoning as addPoolPlayerToRoster below, and
    // this path is typing, so an exact match is more likely someone re-adding the same person to
    // a second team than a genuine same-named duplicate. onAddPoolPlayers (handleAddPoolPlayers
    // at the App level) already updates the shared clubs state on success, so clubPool picks up
    // the addition on next render with no extra plumbing needed here.
    if (clubId && alsoAddToPool && onAddPoolPlayers && !clubPool.some(p => p.name.trim().toLowerCase() === n.toLowerCase())) {
      onAddPoolPlayers(clubId, [{
        name: n
      }]);
    }
    setNewPlayer("");
    setNewNumber("");
  }
  // Copies club player-pool entries onto this team's roster -- a one-time snapshot, same
  // relationship as addBorrowedPlayer above, not a live reference back to the pool (editing or
  // removing them from the pool later doesn't touch teams that already added them). Skips
  // silently over any name clash rather than erroring, since picking from a list (as opposed
  // to typing) makes an accidental double-add the far more likely cause than a genuine intent
  // to add a same-named second player. Takes the whole selected batch at once so ticking several
  // names in the picker adds them all in a single tap instead of one modal round-trip each.
  function addPoolPlayersToRoster(entries) {
    setPlayers(p => {
      const existingLower = new Set(p.map(x => x.name.trim().toLowerCase()));
      const additions = [];
      entries.forEach(pp => {
        const lower = pp.name.trim().toLowerCase();
        if (existingLower.has(lower)) return;
        existingLower.add(lower);
        additions.push({
          name: pp.name,
          number: "",
          email: "",
          public: false,
          age: "",
          role: pp.role || "",
          battingHand: "",
          bowlingHand: "",
          _key: uid()
        });
      });
      return [...p, ...additions];
    });
    closePoolPicker();
  }
  function removePlayer(key) {
    const old = players.find(p => p._key === key);
    setPlayers(p => p.filter(x => x._key !== key));
    if (old) {
      if (captain === old.name) setCaptain("");
      if (keeper === old.name) setKeeper("");
    }
  }
  function updateNumber(key, num) {
    setPlayers(p => p.map(x => x._key === key ? {
      ...x,
      number: num
    } : x));
  }
  function updateName(key, newName) {
    const old = players.find(p => p._key === key);
    setPlayers(p => p.map(x => x._key === key ? {
      ...x,
      name: newName
    } : x));
    if (old) {
      if (captain === old.name) setCaptain(newName);
      if (keeper === old.name) setKeeper(newName);
    }
  }
  function updateEmail(key, email) {
    setPlayers(p => p.map(x => x._key === key ? {
      ...x,
      email
    } : x));
  }
  // Small pill toggle used for the "also save to club pool" checkbox below — same visual
  // language as the color swatches above, just text instead of a color fill.
  function pillBtn(active, label, onClick, key) {
    return /*#__PURE__*/React.createElement("button", {
      key,
      type: "button",
      onClick,
      "aria-pressed": active,
      style: {
        padding: "4px 10px",
        borderRadius: 12,
        border: active ? "none" : `1.5px solid ${COLORS.willow}`,
        background: active ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
        color: active ? "#fff" : COLORS.inkSoft,
        fontFamily: "'Inter'",
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer"
      }
    }, label);
  }
  // Builds the same payload the bottom Save button writes to the team's own storage. Pulled out
  // so savePlayerDetails/makePrivate below can call it too (with an override for the players
  // array, since setPlayers is async and the caller needs the just-updated array immediately,
  // not next render).
  function buildTeamPayload(playersOverride, captainOverride, keeperOverride) {
    const savedPlayers = (playersOverride || players).map(p => ({
      name: p.name.trim(),
      number: p.number,
      email: normalizeEmail(p.email),
      public: !!p.public,
      homeClubId: p.homeClubId || null
    }));
    return {
      id: team ? team.id : uid(),
      name: name.trim(),
      players: savedPlayers,
      captain: (captainOverride !== undefined ? captainOverride : captain).trim(),
      keeper: (keeperOverride !== undefined ? keeperOverride : keeper).trim(),
      color: color || null
    };
  }
  // Not-yet-public: publishes with whatever age/role/hand fields are already filled in. Already
  // public: saves any edits to those fields straight through instead (name/public/homeClubId
  // never change via this path — see updatePlayerInfo).
  // Publishing/editing/un-publishing a player writes straight to Firestore's shared /players doc
  // immediately regardless of whether this screen's own Save has been pressed -- that part was
  // always true and is correct (the shared doc has to reflect reality the moment another club
  // could see it). What used to be missing: the LOCAL roster's own copy of `public` only picked
  // up that change if the person also pressed the screen's bottom Save button afterward. Back out
  // any other way -- a nav-away, a closed tab -- and the roster would silently keep showing "Make
  // public" for a player Firestore already had as public. Calling onSave immediately here, with
  // the freshly-updated players array (not the one still in state pre-render), closes that gap:
  // this screen's own storage can now never drift from the shared doc it just wrote.
  async function savePlayerDetails(key, info) {
    const row = players.find(p => p._key === key);
    if (!row || publishBusyKey) return {
      ok: false,
      error: "Already saving \u2014 try again in a moment."
    };
    setPublishError("");
    setPublishBusyKey(key);
    const detail = {
      age: info.age,
      role: info.role,
      battingHand: info.battingHand,
      bowlingHand: info.bowlingHand
    };
    const result = row.public ? await onUpdatePlayerInfo(row.email, {
      name: info.name,
      ...detail
    }) : await onPublishPlayer(clubId, info.name, row.email, detail);
    setPublishBusyKey(null);
    if (!result.ok) {
      setPublishError(result.error);
      return result;
    }
    const updatedPlayers = players.map(x => x._key === key ? {
      ...x,
      name: info.name,
      ...detail,
      public: true
    } : x);
    setPlayers(updatedPlayers);
    // Renaming can now also happen through EditPlayerModal's Save (not just the row's own name
    // field, which already does this via updateName) -- keep captain/keeper in sync either way,
    // since both are tracked by name string rather than a stable id. Computed explicitly rather
    // than read back from state for the buildTeamPayload call below: setCaptain/setKeeper are
    // async, so the immediate persist would otherwise still see the pre-rename name.
    const newCaptain = row.name !== info.name && captain === row.name ? info.name : captain;
    const newKeeper = row.name !== info.name && keeper === row.name ? info.name : keeper;
    if (newCaptain !== captain) setCaptain(newCaptain);
    if (newKeeper !== keeper) setKeeper(newKeeper);
    onSave(buildTeamPayload(updatedPlayers, newCaptain, newKeeper));
    return result;
  }
  async function makePrivate(key) {
    const row = players.find(p => p._key === key);
    if (!row || publishBusyKey) return;
    setPublishError("");
    setPublishBusyKey(key);
    const result = await onUnpublishPlayer(row.email);
    setPublishBusyKey(null);
    if (!result.ok) {
      setPublishError(result.error);
      return;
    }
    const updatedPlayers = players.map(x => x._key === key ? {
      ...x,
      public: false
    } : x);
    setPlayers(updatedPlayers);
    onSave(buildTeamPayload(updatedPlayers));
  }
  const trimmedNames = players.map(p => p.name.trim());
  const canSave = name.trim() && players.length > 0 && trimmedNames.every(n => n) && new Set(trimmedNames.map(n => n.toLowerCase())).size === players.length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 60px",
      maxWidth: 560,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
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
  }), " Teams"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 24,
      color: COLORS.pitch,
      marginBottom: 18
    }
  }, team ? "Edit Team" : "New Team"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Team name"
  }, /*#__PURE__*/React.createElement(TextField, {
    value: name,
    onChange: setName,
    placeholder: "e.g. Willow CC"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 8
    }
  }, "Jersey color ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      color: COLORS.inkSoft
    }
  }, "(optional \u2014 used on charts and the scoreboard)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center"
    }
  }, TEAM_COLOR_PRESETS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    type: "button",
    onClick: () => setColor(color === c ? "" : c),
    "aria-label": `Jersey color ${c}`,
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: color === c ? `2.5px solid ${COLORS.ink}` : "2.5px solid transparent",
      boxShadow: "0 1px 3px rgba(42,36,32,0.25)",
      background: c,
      cursor: "pointer",
      padding: 0
    }
  })), /*#__PURE__*/React.createElement("label", {
    "aria-label": "Custom jersey color",
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: `1.5px dashed ${COLORS.willow}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      background: !color || TEAM_COLOR_PRESETS.includes(color) ? "#fff" : color,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: color && !TEAM_COLOR_PRESETS.includes(color) ? color : "#888888",
    onChange: e => setColor(e.target.value),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "pointer",
      border: "none",
      padding: 0
    }
  }), (!color || TEAM_COLOR_PRESETS.includes(color)) && /*#__PURE__*/React.createElement(Plus, {
    size: 14,
    style: {
      color: COLORS.inkSoft
    }
  })), color && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setColor(""),
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "underline",
      padding: "0 0 0 4px"
    }
  }, "Clear")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
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
      marginBottom: 4
    }
  }, "Players"), players.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 10
    }
  }, "Tap ", /*#__PURE__*/React.createElement("strong", null, "C"), " or ", /*#__PURE__*/React.createElement("strong", null, "WK"), " on a row to set captain / keeper \u2014 tap again to clear."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: addError ? 4 : 12
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: newPlayer,
    onChange: v => {
      setNewPlayer(v);
      if (addError) setAddError("");
    },
    onKeyDown: e => {
      if (e.key === "Enter") addPlayer();
    },
    placeholder: "Player name"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: newNumber,
    onChange: v => setNewNumber(v.replace(/[^0-9]/g, "").slice(0, 3)),
    onKeyDown: e => {
      if (e.key === "Enter") addPlayer();
    },
    placeholder: "#",
    style: {
      textAlign: "center"
    }
  })), /*#__PURE__*/React.createElement(Btn, {
    onClick: addPlayer,
    style: {
      flexShrink: 0,
      padding: "0 16px"
    }
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 17
  }))), clubId && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: addError ? 4 : 10
    }
  }, pillBtn(alsoAddToPool, alsoAddToPool ? "\u2713 Also save to club pool" : "Also save to club pool", () => setAlsoAddToPool(v => !v))), addError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginBottom: 12
    }
  }, addError), clubId && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: openBrowse,
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      padding: 0,
      textDecoration: "underline",
      display: "flex",
      alignItems: "center",
      gap: 4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Globe, {
    size: 13
  }), "Borrow a public player from another club"), clubId && clubPool.length > 0 && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setPoolPickerOpen(true),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      padding: 0,
      textDecoration: "underline",
      display: "flex",
      alignItems: "center",
      gap: 4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Users, {
    size: 13
  }), `Add from club pool (${clubPool.length})`), players.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic"
    }
  }, "No players added yet") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, players.map(p => /*#__PURE__*/React.createElement(React.Fragment, {
    key: p._key
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 8px 7px 6px",
      borderRadius: 12,
      background: COLORS.creamDark
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: p.number,
    onChange: e => updateNumber(p._key, e.target.value.replace(/[^0-9]/g, "").slice(0, 3)),
    placeholder: "#",
    style: {
      width: "100%",
      textAlign: "center",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.turf,
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "5px 2px"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: p.name,
    onChange: e => updateName(p._key, e.target.value),
    placeholder: "Player name",
    disabled: isBorrowed(p),
    title: isBorrowed(p) ? "Borrowed from another club \u2014 only that club can edit their name or details." : undefined,
    style: {
      flex: 1,
      minWidth: 0,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13.5,
      color: isBorrowed(p) ? COLORS.inkSoft : COLORS.ink,
      background: isBorrowed(p) ? COLORS.creamDark : COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "5px 8px"
    }
  }), isBorrowed(p) && /*#__PURE__*/React.createElement("span", {
    title: "This player belongs to another club's roster \u2014 only their home club can edit name, email, age, role, or batting/bowling hand. Jersey number is yours to set.",
    style: {
      flexShrink: 0,
      fontFamily: "'Inter'",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 0.3,
      textTransform: "uppercase",
      color: COLORS.gold,
      background: "rgba(184,137,43,0.16)",
      padding: "2px 6px",
      borderRadius: 8,
      whiteSpace: "nowrap"
    }
  }, "Borrowed \u00b7 ", homeClubName(p)), p.email && deletedBorrowedEmails.has(p.email) && /*#__PURE__*/React.createElement("span", {
    title: "The player their home club published has since been deleted \u2014 your roster still keeps its own local copy of their name/number, this is just letting you know the source is gone.",
    style: {
      flexShrink: 0,
      fontFamily: "'Inter'",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: 0.3,
      textTransform: "uppercase",
      color: COLORS.ball,
      background: "rgba(198,58,58,0.14)",
      padding: "2px 6px",
      borderRadius: 8,
      whiteSpace: "nowrap"
    }
  }, "No longer published")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setCaptain(captain === p.name ? "" : p.name),
    "aria-label": captain === p.name ? `Remove ${p.name} as captain` : `Make ${p.name} captain`,
    title: "Captain",
    style: {
      width: 26,
      height: 26,
      borderRadius: "50%",
      flexShrink: 0,
      border: captain === p.name ? "none" : `1.5px solid ${COLORS.willow}`,
      background: captain === p.name ? `linear-gradient(160deg, #d4a544, ${COLORS.gold})` : COLORS.surface,
      color: captain === p.name ? "#2e1c04" : COLORS.inkSoft,
      boxShadow: captain === p.name ? "0 1px 4px rgba(184,137,43,0.4)" : "none",
      fontFamily: "'Inter'",
      fontSize: 10,
      fontWeight: 800,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "C"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setKeeper(keeper === p.name ? "" : p.name),
    "aria-label": keeper === p.name ? `Remove ${p.name} as wicketkeeper` : `Make ${p.name} wicketkeeper`,
    title: "Wicketkeeper",
    style: {
      width: 30,
      height: 26,
      borderRadius: 13,
      flexShrink: 0,
      border: keeper === p.name ? "none" : `1.5px solid ${COLORS.willow}`,
      background: keeper === p.name ? `linear-gradient(160deg, ${COLORS.turfFixed}, ${COLORS.pitchFixed})` : COLORS.surface,
      color: keeper === p.name ? "#fff" : COLORS.inkSoft,
      boxShadow: keeper === p.name ? "0 1px 4px rgba(45,80,22,0.4)" : "none",
      fontFamily: "'Inter'",
      fontSize: 9,
      fontWeight: 800,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "WK"), clubId && !isBorrowed(p) && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setExpandedKey(k => k === p._key ? null : p._key),
    "aria-label": p.public ? `${p.name} is a public player \u2014 edit details` : `Add an email to make ${p.name} a public player`,
    title: "Player details (email, public)",
    style: {
      width: 26,
      height: 26,
      borderRadius: "50%",
      flexShrink: 0,
      border: expandedKey === p._key ? "none" : `1.5px solid ${COLORS.willow}`,
      background: expandedKey === p._key ? COLORS.pitchFixed : p.public ? "rgba(184,137,43,0.16)" : COLORS.surface,
      color: expandedKey === p._key ? "#fff" : p.public ? COLORS.gold : COLORS.inkSoft,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Globe, {
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmRemove(p),
    className: "cs-btn",
    style: {
      background: "rgba(42,36,32,0.12)",
      border: "none",
      borderRadius: "50%",
      width: 22,
      height: 22,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: COLORS.ink,
      fontSize: 12,
      lineHeight: 1,
      padding: 0,
      flexShrink: 0
    },
    "aria-label": `Remove ${p.name}`
  }, "✕")), expandedKey === p._key && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "10px 8px 14px 58px"
    }
  }, p._originalName && p.name.trim() && p.name.trim().toLowerCase() !== p._originalName.trim().toLowerCase() && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.gold
    }
  }, "Career stats are matched by name against past scorecards \u2014 renaming means stats already recorded under \"", p._originalName, "\" won't show up under this one."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 5
    }
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    value: p.email,
    onChange: e => updateEmail(p._key, e.target.value),
    placeholder: "player@example.com",
    "aria-label": "Email",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "off",
    inputMode: "email",
    style: {
      width: "100%",
      boxSizing: "border-box",
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.ink,
      background: COLORS.surface,
      border: `1px solid ${COLORS.willow}`,
      borderRadius: 8,
      padding: "7px 8px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      color: COLORS.inkSoft,
      marginTop: 4
    }
  }, "Lets other clubs find and borrow this player onto their own roster \u2014 leave blank to keep them private to this team.")), p.email.trim() && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: p.public ? "gold" : "default",
    onClick: () => setEditingPlayerKey(p._key),
    disabled: publishBusyKey === p._key,
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 34,
      fontSize: 12
    }
  }, publishBusyKey === p._key ? "\u2026" : p.public ? "Edit details" : "Make public"), p.public && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => makePrivate(p._key),
    disabled: publishBusyKey === p._key,
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer",
      textDecoration: "underline",
      padding: 0
    }
  }, "Make private")), publishError && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 11.5,
      fontFamily: "'Inter'",
      marginTop: 8
    }
  }, publishError)))))), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !canSave,
    onClick: () => onSave(buildTeamPayload()),
    style: {
      width: "100%"
    }
  }, "Save Team"), confirmRemove && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: `Remove ${confirmRemove.name}?`,
    message: isBorrowed(confirmRemove) ? `${confirmRemove.name} is borrowed from another club \u2014 this only removes them from this team's roster, nothing about their own player record.` : `Removes ${confirmRemove.name} from this team's roster. If they're captain or wicketkeeper here, that's cleared too.`,
    confirmLabel: "Remove",
    onConfirm: () => {
      removePlayer(confirmRemove._key);
      setConfirmRemove(null);
    },
    onCancel: () => setConfirmRemove(null)
  }), browseOpen && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setBrowseOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Borrow a public player"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 14
    }
  }, "Published by another club \u2014 adding one here doesn't remove them from anywhere else."), browseLoading ? /*#__PURE__*/React.createElement(LoadingNote, {
    label: "Loading public players\u2026"
  }) : publicPlayers.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      textAlign: "center",
      padding: "20px 0"
    }
  }, "No public players yet \u2014 make one of your own players public first, from their row above.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: "50vh",
      overflowY: "auto"
    }
  }, publicPlayers.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    type: "button",
    onClick: () => addBorrowedPlayer(p),
    disabled: players.some(x => x.email && x.email === p.email),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "10px 12px",
      borderRadius: 12,
      border: "none",
      background: COLORS.surface,
      cursor: "pointer",
      textAlign: "left",
      opacity: players.some(x => x.email && x.email === p.email) ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13.5,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, p.email, p.homeClubId && ` \u00b7 ${homeClubName(p)}`)), /*#__PURE__*/React.createElement(Globe, {
    size: 15,
    style: {
      color: COLORS.gold,
      flexShrink: 0
    }
  }))))), editingPlayerKey && (() => {
    const editingRow = players.find(p => p._key === editingPlayerKey);
    return editingRow && /*#__PURE__*/React.createElement(EditPlayerModal, {
      player: editingRow,
      title: editingRow.public ? "Edit player details" : "Make player public",
      onSave: info => savePlayerDetails(editingPlayerKey, info),
      onClose: () => setEditingPlayerKey(null)
    });
  })(), poolPickerOpen && /*#__PURE__*/React.createElement(Modal, {
    onClose: closePoolPicker
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 19,
      color: COLORS.pitch,
      marginBottom: 4
    }
  }, "Add from club pool"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 14
    }
  }, "Tick everyone you want, then add them all at once. Copies them onto this team's roster \u2014 editing or removing them from the pool later won't change this roster."), clubPool.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: poolSearch,
    onChange: setPoolSearch,
    placeholder: "Search the pool\u2026",
    autoCapitalize: "off",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    autoFocus: true,
    style: {
      padding: "8px 10px",
      paddingRight: poolSearch ? 30 : 10,
      fontSize: 13
    }
  }), poolSearch && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setPoolSearch(""),
    "aria-label": "Clear search",
    style: {
      position: "absolute",
      right: 4,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      fontSize: 17,
      lineHeight: 1,
      padding: "4px 6px",
      cursor: "pointer"
    }
  }, "\u00d7")), clubPool.length > 0 && filteredPool.length > 0 && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: toggleSelectAllFiltered,
    disabled: selectablePoolIds.length === 0,
    style: {
      background: "none",
      border: "none",
      color: selectablePoolIds.length === 0 ? COLORS.inkSoft : COLORS.turf,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12,
      cursor: selectablePoolIds.length === 0 ? "default" : "pointer",
      padding: 0,
      marginBottom: 10,
      textDecoration: "underline"
    }
  }, allFilteredSelected ? "Clear selection" : poolSearch.trim() ? `Select all ${selectablePoolIds.length} match${selectablePoolIds.length === 1 ? "" : "es"}` : `Select all ${selectablePoolIds.length}`), clubPool.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      textAlign: "center",
      padding: "20px 0"
    }
  }, "No players in the club pool yet \u2014 add some from the Clubs tab first.") : filteredPool.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      fontStyle: "italic",
      textAlign: "center",
      padding: "20px 0"
    }
  }, `No matches for "${poolSearch.trim()}".`) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: "50vh",
      overflowY: "auto"
    }
  }, filteredPool.map(pp => {
    const alreadyOnRoster = players.some(x => x.name.trim().toLowerCase() === pp.name.trim().toLowerCase());
    const checked = selectedPoolIds.has(pp.id);
    return /*#__PURE__*/React.createElement("button", {
      key: pp.id,
      type: "button",
      onClick: () => togglePoolSelection(pp.id),
      disabled: alreadyOnRoster,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: checked ? `1.5px solid ${COLORS.turf}` : "1.5px solid transparent",
        background: checked ? "rgba(74,124,46,0.08)" : COLORS.surface,
        cursor: alreadyOnRoster ? "default" : "pointer",
        textAlign: "left",
        opacity: alreadyOnRoster ? 0.5 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0,
        border: checked ? "none" : `1.5px solid ${COLORS.inkSoft}`,
        background: checked ? COLORS.turf : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, checked && /*#__PURE__*/React.createElement(Check, {
      size: 12,
      color: "#fff"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontWeight: 700,
        fontSize: 13.5,
        color: COLORS.ink,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, pp.name)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11.5,
        color: COLORS.inkSoft,
        flexShrink: 0
      }
    }, alreadyOnRoster ? "Already added" : (PLAYER_ROLES.find(r => r.value === pp.role) || {}).label || ""));
  })), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: selectedPoolIds.size === 0,
    onClick: () => addPoolPlayersToRoster(clubPool.filter(pp => selectedPoolIds.has(pp.id))),
    style: {
      width: "100%",
      marginTop: 14
    }
  }, selectedPoolIds.size === 0 ? "Add selected" : `Add ${selectedPoolIds.size} player${selectedPoolIds.size === 1 ? "" : "s"}`)))))
}
