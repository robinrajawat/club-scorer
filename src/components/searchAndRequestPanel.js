import React, { useState } from "react";
import { COLORS } from "./theme.js";
import { TextField, Btn } from "./formUiAtoms.js";

// A generic "search a public directory, then request/link to one result" panel, reused for
// finding a club to affiliate a federation with, a club to transfer a player to, and similar
// directory-search flows. All Firestore access (`onSearch`/`onRequest`) is passed in as props, not
// a bare global, so this needs no stubbing at all to test. Covered by
// tests/unit/components/searchAndRequestPanel.test.js.

export function SearchAndRequestPanel({
  placeholder,
  onSearch,
  idKey,
  alreadyLinkedIds = [],
  alreadyLinkedLabel = "Sent",
  linkedLabelById = {},
  actionLabel,
  onRequest,
  emptyHint,
  avatarKey, // optional: field holding a photo URL, rendered as a small round avatar if truthy
  secondaryKey = "ownerName", // optional: field shown as the secondary line under the name
  secondaryPrefix = "Owner: " // optional: text before that field's value
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [requestedIds, setRequestedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  async function runSearch() {
    setLoading(true);
    setError("");
    const list = await onSearch(term);
    setLoading(false);
    setResults(list);
  }
  async function submit(item) {
    const id = item[idKey];
    if (busyId) return;
    setBusyId(id);
    setError("");
    const result = await onRequest(item);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error || "Couldn't send that request.");
      return;
    }
    setRequestedIds(ids => [...ids, id]);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: term,
    onChange: setTerm,
    placeholder: placeholder,
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: runSearch,
    disabled: loading,
    style: {
      flexShrink: 0,
      padding: "0 16px",
      minHeight: 44
    }
  }, loading ? "\u2026" : "Search")), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: COLORS.ball,
      fontSize: 11.5,
      fontFamily: "'Inter'",
      marginBottom: 8
    }
  }, error), results && results.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: COLORS.inkSoft,
      fontFamily: "'Inter'",
      fontStyle: "italic",
      marginBottom: 8
    }
  }, emptyHint || "No matches \u2014 it may not be public, or the name doesn't match."), results && results.length > 0 && results.map(item => {
    const id = item[idKey];
    const already = alreadyLinkedIds.includes(id) || requestedIds.includes(id);
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        borderBottom: `1px dashed ${COLORS.willow}`
      }
    }, avatarKey && item[avatarKey] ? /*#__PURE__*/React.createElement("img", {
      src: item[avatarKey],
      alt: "",
      style: {
        width: 32,
        height: 32,
        borderRadius: "50%",
        flexShrink: 0
      }
    }) : null, /*#__PURE__*/React.createElement("div", {
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
    }, item.name), item[secondaryKey] && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Inter'",
        fontSize: 11,
        color: COLORS.inkSoft
      }
    }, secondaryPrefix, item[secondaryKey])), /*#__PURE__*/React.createElement(Btn, {
      onClick: () => submit(item),
      disabled: already || busyId === id,
      style: {
        flexShrink: 0,
        padding: "0 12px",
        minHeight: 36,
        fontSize: 12
      }
    }, already ? linkedLabelById[id] || alreadyLinkedLabel : busyId === id ? "\u2026" : actionLabel));
  }));
}
