import React, { useState, useRef } from "react";
import { COLORS } from "./theme.js";
import { User, Share, LogOut, LogIn, HelpCircle, MessageCircle, Info, Sun, Moon, Monitor } from "./icons.js";
import { ConfirmModal } from "./formUiAtoms.js";

// The account button in the app header: signed-out shows "Sign in", signed-in shows an avatar.
// Opens a popover menu (account/shared-links/sign-out, theme toggle, help/feedback/about, a
// "buy me a coffee" link). `ReactDOM.createPortal(..., document.body)` (a bare global, same as
// Modal/ShareMenu) only runs once the menu is actually open, so mounting the closed button needs
// only react-test-renderer; testing the open menu itself needs the real react-dom+jsdom rendering
// shareMenus.test.js already established (react-test-renderer can't host a portal targeting a real
// DOM node). Every write action (sign out, open account/help/feedback/about, set theme) is a prop.
// Covered by tests/unit/components/authBar.test.js.

export function AuthBar({
  user,
  profile,
  onOpenAccount,
  onOpenSharedLinks,
  onOpenHelp,
  onOpenFeedback,
  onOpenAbout,
  onSignOut,
  themePref,
  onSetTheme
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const btnRef = useRef(null);
  const label = user ? (profile && profile.displayName ? profile.displayName : user.displayName || "Account").split(" ")[0] : "Sign in";
  const email = user && (profile && profile.email || user.email);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  function toggle() {
    setOpen(o => {
      const next = !o;
      if (next && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + 8,
          right: Math.max(8, window.innerWidth - rect.right)
        });
      }
      return next;
    });
  }
  function go(action) {
    setOpen(false);
    if (action) action();
  }
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");
    // Unlike AccountScreen's own Sign Out (which checks the result and shows an error box), this
    // one used to close the confirm dialog in a `finally` regardless of outcome -- a genuine
    // sign-out failure (rare, but auth.signOut() can fail on a bad connection) meant the dialog
    // just vanished with nothing telling the person they're actually still signed in. Now only
    // closes on success; a failure keeps the dialog open with the error in place of the normal copy.
    const result = await onSignOut();
    setSigningOut(false);
    if (result && result.ok === false && result.error) {
      setSignOutError(result.error);
    } else {
      setConfirmSignOut(false);
    }
  }
  const menuItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    color: COLORS.ink,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 13,
    padding: "9px 10px",
    borderRadius: 8,
    cursor: "pointer"
  };
  const sectionLabelStyle = {
    fontFamily: "'Inter'",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.inkSoft,
    padding: "8px 10px 4px"
  };
  const dividerStyle = {
    height: 1,
    background: COLORS.cardDivider,
    margin: "4px 0"
  };
  const menu = open && pos && /*#__PURE__*/ReactDOM.createPortal(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 100
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    role: "menu",
    style: {
      position: "fixed",
      top: pos.top,
      right: pos.right,
      width: 240,
      maxHeight: "min(80vh, 560px)",
      overflowY: "auto",
      background: COLORS.surface,
      border: `1.5px solid ${COLORS.creamDark}`,
      borderRadius: 14,
      padding: 8,
      fontFamily: "'Inter'",
      boxShadow: "0 12px 32px rgba(42,36,32,0.22)",
      zIndex: 101
    }
  }, user && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "6px 10px 8px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, label), email && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, email)), user && /*#__PURE__*/React.createElement("div", {
    style: dividerStyle
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => go(onOpenAccount),
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(User, {
    size: 15,
    style: {
      color: COLORS.pitch
    }
  }), user ? "Manage account" : "Sign in"), user && onOpenSharedLinks && /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => go(onOpenSharedLinks),
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(Share, {
    size: 15,
    style: {
      color: COLORS.pitch
    }
  }), "Shared Links"), user && /*#__PURE__*/React.createElement("div", {
    style: dividerStyle
  }), user && /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => {
      setOpen(false);
      setSignOutError("");
      setConfirmSignOut(true);
    },
    style: {
      // Back to COLORS.ball, now paired with a confirm step (see confirmSignOut below) rather
      // than firing immediately -- red without confirmation just meant "the loudest-colored thing
      // in the menu, no extra friction," which was the wrong tradeoff either way. With a confirm
      // step, red is doing an actual job: making the action clearly identifiable before someone
      // commits to it, while the confirm dialog itself is what actually prevents an accidental tap.
      ...menuItemStyle,
      color: COLORS.ball
    }
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 15
  }), "Sign out"), /*#__PURE__*/React.createElement("div", {
    style: dividerStyle
  }), /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "Appearance"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "0 10px 6px"
    }
  }, [{
    value: "light",
    label: "Light",
    icon: Sun
  }, {
    value: "dark",
    label: "Dark",
    icon: Moon
  }, {
    value: "system",
    label: "System",
    icon: Monitor
  }].map(opt => /*#__PURE__*/React.createElement("button", {
    key: opt.value,
    type: "button",
    onClick: () => onSetTheme(opt.value),
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      textAlign: "center",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 11.5,
      padding: "6px 4px",
      borderRadius: 7,
      cursor: "pointer",
      border: `1.5px solid ${themePref === opt.value ? COLORS.pitch : COLORS.creamDark}`,
      background: themePref === opt.value ? COLORS.pitch : "none",
      color: themePref === opt.value ? "#fff" : COLORS.inkSoft
    }
  }, /*#__PURE__*/React.createElement(opt.icon, {
    size: 12
  }), opt.label))), /*#__PURE__*/React.createElement("div", {
    style: dividerStyle
  }), /*#__PURE__*/React.createElement("div", {
    style: sectionLabelStyle
  }, "Help"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => go(onOpenHelp),
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(HelpCircle, {
    size: 15,
    style: {
      color: COLORS.pitch
    }
  }), "Help & FAQ"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => go(onOpenFeedback),
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(MessageCircle, {
    size: 15,
    style: {
      color: COLORS.pitch
    }
  }), "Send Feedback"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => go(onOpenAbout),
    style: menuItemStyle
  }, /*#__PURE__*/React.createElement(Info, {
    size: 15,
    style: {
      color: COLORS.pitch
    }
  }), "About"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...dividerStyle,
      margin: "8px 0 10px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      lineHeight: 1.5,
      padding: "0 10px 9px"
    }
  }, "Free, no ads, no locked features. A tip is appreciated, never expected."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "menuitem",
    className: "cs-btn",
    onClick: () => go(() => window.open("https://ko-fi.com/robinrajawat", "_blank", "noopener,noreferrer")),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      width: "calc(100% - 4px)",
      margin: "0 2px",
      minHeight: 40,
      padding: "0 12px",
      borderRadius: 10,
      // Flat solid fill, not outlined and not the old gradient+glossy-shine either -- this is the
      // app's only monetization path (free, no ads, nothing locked), so staying genuinely visible
      // matters more here than it does for a purely secondary action; an outlined button undersold
      // that. But the old gradient+shine read as a dated commercial CTA sitting right under "never
      // expected," fighting its own copy. Flat gold splits the difference: still the warmest,
      // most-noticed thing in the menu, without the skeuomorphic overlay everything else on this
      // screen has deliberately moved away from. Fixed hex rather than COLORS.gold: in light mode
      // that token is a muted brownish gold that reads dark here, so this uses the same brighter
      // gold already used app-wide as the highlight stop in gold gradients (six-hit badge, captain
      // badge, etc.) instead of tying this button's brightness to the (theme-flipping) accent color.
      background: "#d4a544",
      border: "none",
      color: "#2e1c04",
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(184,137,43,0.25)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"
  })), "Buy me a coffee"))), document.body);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-block"
    }
  }, /*#__PURE__*/React.createElement("button", {
    ref: btnRef,
    type: "button",
    className: "cs-btn cs-shine",
    onClick: toggle,
    "aria-label": "Account menu",
    "aria-haspopup": "true",
    "aria-expanded": open,
    style: user ? {
      // Signed in: icon-only, matching the header's other round icon buttons (Bell) rather than
      // the pill this used to be -- the name moved to the Home screen's own greeting instead, so
      // repeating it here as label text was pure duplication. See AuthBar's own comment block
      // above for the fuller reasoning.
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      padding: 0,
      background: "none",
      border: "none",
      borderRadius: "50%",
      cursor: "pointer"
    } : {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: 7,
      background: COLORS.surface,
      border: `1.5px solid ${COLORS.creamDark}`,
      borderRadius: 20,
      padding: "7px 14px",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontSize: 12.5,
      fontWeight: 700,
      color: COLORS.ink,
      boxShadow: "0 1px 2px rgba(42,36,32,0.08)"
    }
  }, user ? user.photoURL ? /*#__PURE__*/React.createElement("img", {
    src: user.photoURL,
    alt: "",
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: COLORS.willow,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 13,
      fontWeight: 700
    }
  }, label.charAt(0).toUpperCase()) : /*#__PURE__*/React.createElement(LogIn, {
    size: 14
  }), user ? null : label)), menu, confirmSignOut && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Sign out?",
    message: signOutError || "You'll need to sign in again to sync your matches and teams. Anything saved so far stays right where it is.",
    confirmLabel: "Sign out",
    busy: signingOut,
    onConfirm: handleSignOut,
    onCancel: () => {
      setSignOutError("");
      setConfirmSignOut(false);
    }
  }));
}
