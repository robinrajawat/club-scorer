import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "./theme.js";
import { ChevronLeft, ChevronRight, Users, GoogleGLogo, InboxIcon } from "./icons.js";
import { Field } from "./screenAtoms.js";
import { TextField, Btn, ConfirmModal } from "./formUiAtoms.js";
import { PLAYER_ROLES, PLAYER_HANDS } from "./playerModals.js";

// The signed-in-or-not account/settings screen: profile display name, own public player-profile
// summary if one exists, sign-in methods (link a password to a Google account or vice versa) and
// sign out, admin tools (Feedback Inbox/Beta Testers counts), beta-tester tools (request beta
// access, or generate/wipe dummy sandbox data once granted), export/import a JSON backup, and
// account deletion -- or, signed out, the sign-in form (Google or email, with sign-up/reset).
// Every one of these is a bare-global Firebase Auth/Firestore wrapper, not extracted yet:
// submitBetaRequest, loadFeedback, loadBetaRequests (an admin-only mount effect),
// linkPasswordCredential, linkGoogleCredential, signUpEmail, signInEmail, sendPasswordReset --
// same bare-global pattern WelcomeScreen/AuthActionScreen already established for these Auth
// wrappers. `Modal` (bare global) backs the delete-account dialog directly; everything else
// destructive goes through the already-imported `ConfirmModal`. Covered by
// tests/unit/components/accountScreen.test.js.

export function AccountScreen({
  user,
  profile,
  myPlayer,
  isAdmin,
  onOpenFeedbackInbox,
  onOpenBetaTesters,
  onOpenClub,
  isBetaTester = false,
  onGenerateDummyData,
  onWipeDummyData,
  clubs = [],
  federationsById = {},
  onSignIn,
  onSignOut,
  onSaveProfile,
  onExportData,
  onImportData,
  onDeleteAccount,
  onBack,
  redirectError,
  linkStatus,
  onClearLinkStatus
}) {
  const [nameDraft, setNameDraft] = useState(profile && profile.displayName || user && user.displayName || "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState(null);
  const [dummyBusy, setDummyBusy] = useState(false);
  const [dummyStatus, setDummyStatus] = useState("");
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [betaRequestBusy, setBetaRequestBusy] = useState(false);
  const [betaRequestSent, setBetaRequestSent] = useState(false);
  const [betaRequestError, setBetaRequestError] = useState("");
  async function handleRequestBeta() {
    if (betaRequestBusy) return;
    setBetaRequestBusy(true);
    setBetaRequestError("");
    const result = await submitBetaRequest();
    setBetaRequestBusy(false);
    if (result.ok) setBetaRequestSent(true);
    else setBetaRequestError(result.error);
  }
  // Pending counts for the Admin card's two rows -- null until loaded (renders no badge rather
  // than a misleading "0" while the fetch is still in flight). Every doc actually IN
  // /betaRequests is by definition still pending (approveBetaRequest/declineBetaRequest both
  // delete the doc as part of resolving it), so betaRequests.length needs no extra filtering the
  // way feedback's open count does. Only fetched for an admin -- these two extra reads have no
  // reason to happen for anyone who'll never see this card at all.
  const [adminFeedbackOpenCount, setAdminFeedbackOpenCount] = useState(null);
  const [adminBetaPendingCount, setAdminBetaPendingCount] = useState(null);
  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;
    Promise.all([loadFeedback(), loadBetaRequests()]).then(([feedbackItems, betaRequests]) => {
      if (cancelled) return;
      setAdminFeedbackOpenCount(feedbackItems.filter(it => (it.status || "open") === "open").length);
      setAdminBetaPendingCount(betaRequests.length);
    });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);
  const importFileRef = useRef(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [emailMode, setEmailMode] = useState(null); // null | 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  // Sign-in methods (link a password to a Google account, or Google to a password account) — see
  // linkPasswordCredential/linkGoogleCredential. Separate busy/error state from the sign-in form
  // above since both can be visible on this screen at once (signed in, but only one method linked).
  const [linkPassword, setLinkPassword] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");
  const currentName = profile && profile.displayName || user && user.displayName || "";
  const dirty = nameDraft.trim() !== currentName.trim();
  const displayedError = actionError || redirectError;
  const providerIds = user ? (user.providerData || []).map(p => p.providerId) : [];
  const hasPassword = providerIds.includes("password");
  const hasGoogle = providerIds.includes("google.com");
  // Deleting the account can never reassign ownership — a club or federation this account is the
  // SOLE owner of (no co-owners) becomes permanently stuck: nobody can ever manage, rename,
  // invite into, or (for federations, which can never be deleted at all) get rid of it again.
  // Surfaced before deletion so the person can invite a co-owner first if they want a way out.
  const soleOwnerClubs = user ? clubs.filter(c => c.ownerUid === user.uid && (c.coOwnerUids || []).length === 0) : [];
  const soleOwnerFederations = user ? Object.values(federationsById).filter(f => f.createdBy === user.uid && (f.coOwnerUids || []).length === 0) : [];
  // A player's homeClubId doesn't imply club MEMBERSHIP -- it's set by whichever club first added
  // them to a team roster (see publishPlayer), entirely independent of the club invite/membership
  // flow, so it's a normal, common case for someone to have a home club they were never actually
  // invited into. `clubs` here is already scoped to clubs this account is a MEMBER of (see
  // loadClubs), so finding a match here specifically means "you can navigate there" — the app has
  // no way to view a club's internals without being a member, so a "jump to" link only makes sense
  // when this resolves to something, not just whenever a home club name happens to be known.
  const myPlayerHomeClub = myPlayer ? clubs.find(c => c.id === myPlayer.homeClubId) : null;
  async function handleSignIn() {
    setBusy(true);
    setActionError("");
    const result = await onSignIn();
    setBusy(false);
    if (result && result.ok === false && result.error) setActionError(result.error);
    if (result && result.needsLink) {
      setEmail(result.linkEmail);
      openEmailMode("signin");
    }
  }
  async function handleSignOut() {
    setBusy(true);
    setActionError("");
    const result = await onSignOut();
    setBusy(false);
    if (result && result.ok === false && result.error) {
      setActionError(result.error);
    } else {
      // Unlike signing out from Home's account menu (which just re-renders Home in signed-out
      // mode -- nothing to escape to, since Home already works fine without an account), staying
      // put here leaves someone looking at a now-mostly-empty settings page with a sign-in prompt
      // instead of landing back where they'd actually expect after ending a session.
      onBack();
    }
  }
  async function handleLinkPassword() {
    if (linkBusy || !linkPassword) return;
    setLinkBusy(true);
    setLinkError("");
    const result = await linkPasswordCredential(linkPassword);
    setLinkBusy(false);
    if (!result.ok) {
      setLinkError(result.error);
      return;
    }
    setLinkPassword("");
    setLinkSuccess("Password added \u2014 you can now sign in with either Google or your email and this password.");
  }
  async function handleLinkGoogle() {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkError("");
    const result = await linkGoogleCredential();
    setLinkBusy(false);
    if (!result.ok) {
      setLinkError(result.error);
      return;
    }
    setLinkSuccess("Google linked \u2014 you can now sign in with either your password or Google.");
  }
  function openEmailMode(mode) {
    setEmailMode(mode);
    setEmailError("");
    setResetSent(false);
  }
  async function handleEmailSubmit() {
    if (emailBusy) return;
    if (!email.trim() || !email.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (emailMode !== "reset" && !password) {
      setEmailError("Enter a password.");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    const result = emailMode === "signup" ? await signUpEmail(email, password) : emailMode === "reset" ? await sendPasswordReset(email) : await signInEmail(email, password);
    setEmailBusy(false);
    if (!result.ok) {
      setEmailError(result.error);
      return;
    }
    if (emailMode === "reset") setResetSent(true);
  }
  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await onExportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `club-scorer-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("export failed", e);
      setActionError("Couldn't export your data \u2014 try again in a moment.");
    }
    setExporting(false);
  }
  // File picking is two steps: pick+parse first (handleImportFile), then a confirmation step
  // (handleConfirmImport) before anything is actually written — importing overwrites whatever
  // profile/teams/matches already exist at those ids in the destination account, so it deserves
  // the same "are you sure" treatment as deleting the account, not a silent one-tap action.
  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow picking the same file again after a cancel
    if (!file) return;
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setPendingImportData(data);
        setShowImportConfirm(true);
      } catch (err) {
        setImportResult({
          ok: false,
          error: "That file isn't valid JSON \u2014 make sure it's an export from Club Scorer."
        });
      }
    };
    reader.onerror = () => setImportResult({
      ok: false,
      error: "Couldn't read that file."
    });
    reader.readAsText(file);
  }
  async function handleConfirmImport() {
    if (importing || !pendingImportData) return;
    setImporting(true);
    setShowImportConfirm(false);
    const result = await onImportData(pendingImportData);
    setPendingImportData(null);
    setImportResult(result);
    setImporting(false);
  }
  async function handleDeleteAccount() {
    if (deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteAccount();
      // onDeleteAccount signs the account out and returns to Home on success — nothing more to do
      // here, this component will unmount.
    } catch (e) {
      console.error("account deletion failed", e);
      setDeleteError(e.message || "Couldn't delete your account \u2014 try again, or contact support if this keeps happening.");
      setDeleting(false);
    }
  }
  async function handleSaveName() {
    setBusy(true);
    await onSaveProfile({
      displayName: nameDraft.trim()
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  async function handleGenerateDummy() {
    setDummyBusy(true);
    setDummyStatus("");
    const result = await onGenerateDummyData();
    setDummyBusy(false);
    if (result && result.ok) {
      const warning = result.partialWipeFailures ? ` (${result.partialWipeFailures} club${result.partialWipeFailures === 1 ? "" : "s"} from a previous run couldn't be cleared \u2014 try Wipe again.)` : "";
      setDummyStatus(`Dummy data generated \u2014 ${result.clubIds.length} boards, each with a senior XI and a "B" side, affiliated with ICC.${warning}`);
    } else {
      setDummyStatus((result && result.error) || "Couldn't generate dummy data.");
    }
  }
  async function handleWipeDummy() {
    setShowWipeConfirm(false);
    setDummyBusy(true);
    setDummyStatus("");
    const result = await onWipeDummyData();
    setDummyBusy(false);
    setDummyStatus(result && !result.ok ? `Removed what it could, but ${result.failedCount} club${result.failedCount === 1 ? "" : "s"} wouldn't delete \u2014 try again.` : "Dummy data removed.");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 16px 40px",
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
      marginBottom: user ? 16 : 4
    }
  }, "Account"), !user && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      marginBottom: 20
    }
  }, "Sign in to sync your matches and teams across devices."), displayedError && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: `1.5px solid rgba(139,30,30,0.25)`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, displayedError), linkStatus && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(184,137,43,0.12)",
      border: `1.5px solid ${COLORS.gold}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.pitch,
      lineHeight: 1.5,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10
    }
  }, linkStatus, /*#__PURE__*/React.createElement("button", {
    onClick: onClearLinkStatus,
    "aria-label": "Dismiss",
    style: {
      background: "none",
      border: "none",
      color: COLORS.pitch,
      cursor: "pointer",
      padding: 0,
      lineHeight: 1,
      fontSize: 16,
      flexShrink: 0
    }
  }, "\u00d7")), user ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
      marginBottom: 18
    }
  }, user.photoURL ? /*#__PURE__*/React.createElement("img", {
    src: user.photoURL,
    alt: "",
    style: {
      width: 52,
      height: 52,
      borderRadius: "50%"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: "50%",
      background: COLORS.willow,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 20,
      fontWeight: 700,
      flexShrink: 0
    }
  }, (currentName || "?").charAt(0).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 16,
      color: COLORS.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, currentName || "Signed in", isBetaTester && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 10.5,
      fontWeight: 700,
      color: "#fff",
      background: COLORS.willow,
      borderRadius: 8,
      padding: "2px 7px",
      marginLeft: 8,
      letterSpacing: 0.3,
      verticalAlign: "middle"
    },
    title: "You have access to beta features"
  }, "BETA")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, user.email))), /*#__PURE__*/React.createElement(Field, {
    label: "Display name"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    value: nameDraft,
    onChange: setNameDraft,
    placeholder: "Your name"
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: handleSaveName,
    disabled: !dirty || busy,
    style: {
      flexShrink: 0,
      padding: "0 16px",
      minHeight: 44
    }
  }, saved ? "Saved" : "Save")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 6
    }
  }, "Shown around the app instead of your Google name, if you'd rather use something else.")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.cardDivider,
      margin: "14px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "Your player profile"), myPlayer ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 14.5,
      color: COLORS.ink,
      marginBottom: 3
    }
  }, myPlayer.name || myPlayer.email), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, [myPlayer.age && `${myPlayer.age} yrs`, (PLAYER_ROLES.find(r => r.value === myPlayer.role) || {}).label, myPlayer.battingHand && `${(PLAYER_HANDS.find(h => h.value === myPlayer.battingHand) || {}).label}-hand bat`, myPlayer.bowlingHand && (myPlayer.role === "bowler" || myPlayer.role === "allrounder") && `${(PLAYER_HANDS.find(h => h.value === myPlayer.bowlingHand) || {}).label}-arm bowler`].filter(Boolean).join(" \u00b7 ") || "No further details added yet"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft
    }
  }, "Managed by ", myPlayerHomeClub ? myPlayerHomeClub.name : "a club", " \u2014 only they can edit your name, age, role, or batting/bowling hand here.", myPlayer.public ? " Your profile is kept public, so other clubs can borrow you into their own rosters." : " Your profile isn't public, so only they can add you to a roster."), myPlayerHomeClub && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onOpenClub(myPlayerHomeClub.id),
    className: "cs-btn",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      marginTop: 8,
      padding: 0,
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 12.5,
      color: COLORS.pitch
    }
  }, "View ", myPlayerHomeClub.name, /*#__PURE__*/React.createElement(ChevronRight, {
    size: 14
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
  }, "No club has added you as a player yet. Once a club adds you to their roster using this exact email address, your profile shows up here automatically.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
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
  }, "Sign-in methods"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      padding: "4px 10px",
      borderRadius: 12,
      background: hasGoogle ? "rgba(184,137,43,0.14)" : COLORS.creamDark,
      color: hasGoogle ? COLORS.pitch : COLORS.inkSoft
    }
  }, hasGoogle ? "\u2713 Google" : "Google not linked"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      fontWeight: 600,
      padding: "4px 10px",
      borderRadius: 12,
      background: hasPassword ? "rgba(184,137,43,0.14)" : COLORS.creamDark,
      color: hasPassword ? COLORS.pitch : COLORS.inkSoft
    }
  }, hasPassword ? "\u2713 Password" : "Password not set")), !hasPassword && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: linkPassword,
    onChange: e => setLinkPassword(e.target.value),
    placeholder: "Set a password (6+ characters)",
    autoComplete: "new-password",
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 15,
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.ink,
      width: "100%",
      boxSizing: "border-box",
      boxShadow: "inset 0 1px 2px rgba(42,36,32,0.05)",
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: handleLinkPassword,
    disabled: linkBusy || linkPassword.length < 6,
    style: {
      flexShrink: 0,
      padding: "0 14px",
      minHeight: 44
    }
  }, linkBusy ? "\u2026" : "Set")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 6
    }
  }, "Lets you sign in with ", user.email, " and a password too, in case Google sign-in isn't available.")), !hasGoogle && /*#__PURE__*/React.createElement(Btn, {
    onClick: handleLinkGoogle,
    disabled: linkBusy,
    variant: "default",
    style: {
      width: "100%",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(GoogleGLogo, {
    size: 15
  }), linkBusy ? "\u2026" : "Link Google account"), (linkError || linkSuccess) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: linkError ? COLORS.ball : COLORS.pitch,
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, linkError || linkSuccess), /*#__PURE__*/React.createElement("div", {
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
      marginBottom: 14,
      lineHeight: 1.5
    }
  }, "Your matches and teams sync to this account and follow you to any device you sign into."), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowSignOutConfirm(true),
    variant: "danger",
    style: {
      width: "100%"
    }
  }, "Sign out")), showSignOutConfirm && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Sign out?",
    message: "You'll need to sign in again to sync your matches and teams. Anything saved so far stays right where it is.",
    confirmLabel: "Sign out",
    busy: busy,
    onConfirm: () => {
      setShowSignOutConfirm(false);
      handleSignOut();
    },
    onCancel: () => setShowSignOutConfirm(false)
  }), user && !isBetaTester && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
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
  }, "Beta tools"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, betaRequestSent ? "Request sent \u2014 you'll get access once it's reviewed." : "Try new features before they're released, with a sandbox full of dummy clubs and teams to test against."), !betaRequestSent && /*#__PURE__*/React.createElement(Btn, {
    onClick: handleRequestBeta,
    disabled: betaRequestBusy,
    variant: "default",
    style: {
      width: "100%"
    }
  }, betaRequestBusy ? "\u2026" : "Request beta access"), betaRequestError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.ball,
      marginTop: 8
    }
  }, betaRequestError)), isBetaTester && /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
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
  }, "Beta tools"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.inkSoft,
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, "Fill your account with a club per country (named after its board), real international teams and players, and a shared ICC federation to try new features against."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: handleGenerateDummy,
    disabled: dummyBusy,
    variant: "default",
    style: {
      flex: 1,
      minWidth: 160
    }
  }, dummyBusy ? "\u2026" : "Generate dummy data"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowWipeConfirm(true),
    disabled: dummyBusy,
    variant: "danger",
    style: {
      flex: 1,
      minWidth: 160
    }
  }, "Wipe dummy data")), dummyStatus && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginTop: 8,
      lineHeight: 1.5
    }
  }, dummyStatus), showWipeConfirm && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Wipe dummy data?",
    message: "Removes every dummy board (club) and its teams. The shared ICC federation itself stays (reused next time) but ends up empty \u2014 you can delete it yourself from Home \u2192 Clubs if you don't want to keep it.",
    confirmLabel: "Wipe",
    variant: "danger",
    busy: dummyBusy,
    onConfirm: handleWipeDummy,
    onCancel: () => setShowWipeConfirm(false)
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      background: COLORS.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      textAlign: "center",
      boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: "50%",
      margin: "4px auto 14px",
      background: COLORS.creamDark,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Users, {
    size: 24,
    style: {
      color: COLORS.inkSoft
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13.5,
      color: COLORS.inkSoft,
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "Not signed in — matches and teams are only saved on this device."), /*#__PURE__*/React.createElement("button", {
    onClick: handleSignIn,
    disabled: busy,
    className: "cs-btn",
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 14,
      borderRadius: 10,
      minHeight: 44,
      cursor: busy ? "not-allowed" : "pointer",
      border: `1.5px solid ${COLORS.willow}`,
      background: "none",
      color: COLORS.pitch,
      opacity: busy ? 0.6 : 1,
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent"
    }
  }, /*#__PURE__*/React.createElement(GoogleGLogo, {
    size: 16
  }), busy ? "Opening Google…" : "Sign in with Google"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      color: COLORS.inkSoft,
      marginTop: 12,
      lineHeight: 1.5
    }
  }, "We only get your name, email and photo — never your password. You can revoke access anytime at myaccount.google.com/permissions."), !emailMode ? /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode("signin"),
    className: "cs-btn",
    style: {
      width: "100%",
      minHeight: 40,
      background: "none",
      border: `1.5px solid ${COLORS.willow}`,
      borderRadius: 10,
      color: COLORS.pitch,
      fontFamily: "'Inter'",
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer",
      marginTop: 10,
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent"
    }
  }, "Sign in with email instead") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, emailError && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: `1.5px solid rgba(139,30,30,0.25)`,
      borderRadius: 12,
      padding: "10px 12px",
      marginBottom: 10,
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, emailError), emailMode === "reset" && resetSent ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.turf,
      textAlign: "center",
      padding: "10px 0"
    }
  }, "Check ", email, " for a reset link.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    value: email,
    onChange: setEmail,
    placeholder: "Email",
    autoCapitalize: "none",
    autoCorrect: "off",
    autoComplete: "email",
    inputMode: "email",
    style: {
      marginBottom: 8
    }
  }), emailMode !== "reset" && /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "Password",
    autoComplete: emailMode === "signup" ? "new-password" : "current-password",
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 15,
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${COLORS.creamDark}`,
      background: COLORS.surface,
      color: COLORS.ink,
      width: "100%",
      boxSizing: "border-box",
      boxShadow: "inset 0 1px 2px rgba(42,36,32,0.05)",
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    onClick: handleEmailSubmit,
    disabled: emailBusy,
    style: {
      width: "100%",
      marginBottom: 8
    }
  }, emailBusy ? "\u2026" : emailMode === "signup" ? "Create account" : emailMode === "reset" ? "Send reset email" : "Sign in")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode(null),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.inkSoft,
      cursor: "pointer",
      padding: 4,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, "\u2190 Back"), emailMode !== "reset" ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode(emailMode === "signup" ? "signin" : "signup"),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontWeight: 600,
      cursor: "pointer",
      padding: 4,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, emailMode === "signup" ? "Sign in instead" : "Create account"), emailMode === "signin" && /*#__PURE__*/React.createElement("button", {
    onClick: () => openEmailMode("reset"),
    className: "cs-btn",
    style: {
      background: "none",
      border: "none",
      color: COLORS.turf,
      fontWeight: 600,
      cursor: "pointer",
      padding: 4,
      fontFamily: "'Inter'",
      fontSize: 12
    }
  }, "Forgot password?")) : null))), user && /*#__PURE__*/React.createElement("div", {
  style: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    boxShadow: "0 1px 3px rgba(42,36,32,0.06), 0 4px 14px rgba(42,36,32,0.05)"
  }
},
  /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.inkSoft,
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "Your data"),
  /*#__PURE__*/React.createElement(Btn, {
    onClick: handleExport,
    disabled: exporting,
    style: {
      width: "100%",
      marginBottom: 10
    }
  }, exporting ? "Preparing\u2026" : "Export my data (.json)"),
  /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      lineHeight: 1.5
    }
  }, "Your profile, teams, matches saved to this account, and the clubs you belong to \u2014 as a JSON file you can keep. Doesn\u2019t include matches only ever shared via a match code, since those aren\u2019t linked to your account."),
  /*#__PURE__*/React.createElement("input", {
    ref: importFileRef,
    type: "file",
    accept: "application/json,.json",
    style: {
      display: "none"
    },
    onChange: handleImportFile
  }),
  /*#__PURE__*/React.createElement(Btn, {
    onClick: () => importFileRef.current && importFileRef.current.click(),
    disabled: importing,
    style: {
      width: "100%",
      marginTop: 10
    }
  }, importing ? "Restoring\u2026" : "Import from backup (.json)"),
  importResult && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: importResult.ok ? COLORS.turf : COLORS.ball,
      marginTop: 8,
      lineHeight: 1.5
    }
  }, importResult.ok ? `Restored ${importResult.profileRestored ? "your profile, " : ""}${importResult.teamsCount} team${importResult.teamsCount === 1 ? "" : "s"}, and ${importResult.matchesCount} match${importResult.matchesCount === 1 ? "" : "es"}.` : importResult.error || `Restored what it could, but ${importResult.failedCount} match${importResult.failedCount === 1 ? "" : "es"} failed \u2014 try again in a moment.`),
  showImportConfirm && /*#__PURE__*/React.createElement(ConfirmModal, {
    title: "Import this backup?",
    message: "This overwrites your profile, teams, and any matches in the backup that share an id with one already in this account. It doesn\u2019t touch your clubs \u2014 those aren\u2019t part of the backup file. This can\u2019t be undone.",
    confirmLabel: "Import",
    onConfirm: handleConfirmImport,
    onCancel: () => {
      setShowImportConfirm(false);
      setPendingImportData(null);
    }
  })
), user && isAdmin && /*#__PURE__*/React.createElement("div", {
  style: {
    background: "rgba(184,137,43,0.08)",
    borderRadius: 16,
    padding: "6px 6px",
    marginTop: 14,
    border: `1.5px solid rgba(184,137,43,0.3)`
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "'Inter'",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.gold,
    textTransform: "uppercase",
    padding: "8px 10px 6px"
  }
}, "Admin"), [{
  icon: InboxIcon,
  label: "Feedback Inbox",
  onClick: onOpenFeedbackInbox,
  count: adminFeedbackOpenCount
}, {
  icon: Users,
  label: "Beta Testers",
  onClick: onOpenBetaTesters,
  count: adminBetaPendingCount
}].map((item, i, arr) => /*#__PURE__*/React.createElement(React.Fragment, {
  key: item.label
}, /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: item.onClick,
  className: "cs-btn",
  style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 10px",
    borderRadius: 10,
    border: "none",
    background: "none",
    cursor: "pointer",
    textAlign: "left"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: "rgba(184,137,43,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement(item.icon, {
  size: 15,
  style: {
    color: COLORS.gold
  }
})), /*#__PURE__*/React.createElement("span", {
  style: {
    flex: 1,
    fontFamily: "'Inter'",
    fontWeight: 600,
    fontSize: 13.5,
    color: COLORS.ink
  }
}, item.label), !!item.count && /*#__PURE__*/React.createElement("span", {
  style: {
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    background: COLORS.ballFixed,
    color: "#fff",
    fontFamily: "'Inter'",
    fontWeight: 700,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }
}, item.count), /*#__PURE__*/React.createElement(ChevronRight, {
  size: 15,
  style: {
    color: COLORS.inkSoft,
    flexShrink: 0
  }
})), i < arr.length - 1 && /*#__PURE__*/React.createElement("div", {
  style: {
    height: 1,
    background: "rgba(184,137,43,0.2)",
    margin: "0 10px"
  }
})))), user && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.05)",
      borderRadius: 16,
      padding: 18,
      marginTop: 14,
      border: `1.5px solid rgba(139,30,30,0.25)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.ball,
      textTransform: "uppercase",
      marginBottom: 10
    }
  }, "Danger zone"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12.5,
      fontWeight: 700,
      color: COLORS.ball,
      marginBottom: 6
    }
  }, "Delete account"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 11.5,
      color: COLORS.inkSoft,
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, "Permanently deletes your profile, teams, and matches saved to this account, and removes you from any clubs. This can\u2019t be undone."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDeleteConfirmText("");
      setDeleteError("");
      setShowDeleteConfirm(true);
    },
    className: "cs-btn",
    style: {
      width: "100%",
      background: "none",
      border: `1.5px solid ${COLORS.ball}`,
      borderRadius: 10,
      color: COLORS.ball,
      fontFamily: "'Inter'",
      fontWeight: 700,
      fontSize: 13,
      padding: "10px 0",
      cursor: "pointer"
    }
  }, "Delete my account")), showDeleteConfirm && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => !deleting && setShowDeleteConfirm(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'DM Serif Display', serif",
      fontSize: 20,
      color: COLORS.ball,
      marginBottom: 10
    }
  }, "Delete your account?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 13,
      color: COLORS.inkSoft,
      lineHeight: 1.6,
      marginBottom: 14
    }
  }, "This permanently deletes your profile, your teams, every match saved to this account, and removes you from your clubs. It does not delete matches you only ever shared via a match code on another device. This cannot be undone."), (soleOwnerClubs.length > 0 || soleOwnerFederations.length > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "rgba(139,30,30,0.08)",
      border: `1.5px solid rgba(139,30,30,0.25)`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 14,
      fontFamily: "'Inter'",
      fontSize: 12.5,
      color: COLORS.ball,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      marginBottom: 4
    }
  }, "You're the only owner here \u2014 deleting your account leaves ", soleOwnerClubs.length > 0 && soleOwnerFederations.length > 0 ? "these permanently stuck" : soleOwnerClubs.length > 0 ? "this club permanently stuck" : "this federation permanently stuck", ":"), soleOwnerClubs.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id
  }, "\u2022 ", c.name, " (club) \u2014 nobody will ever be able to manage or rename it, invite anyone, or remove members again. It could still be deleted outright by a co-owner, but there won't be one.")), soleOwnerFederations.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id
  }, "\u2022 ", f.name, " (federation) \u2014 nobody will ever be able to manage it, invite anyone, or remove clubs again. It could still be deleted outright by a co-owner once it's empty of affiliated clubs, but there won't be one.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, "If you'd rather avoid that, add a co-owner from Home \u2192 Clubs first \u2014 co-owners have identical rights, so any of them can take over.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      fontWeight: 600,
      color: COLORS.inkSoft,
      marginBottom: 6
    }
  }, "Type DELETE to confirm"), /*#__PURE__*/React.createElement(TextField, {
    value: deleteConfirmText,
    onChange: setDeleteConfirmText,
    placeholder: "DELETE",
    autoCapitalize: "characters",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false,
    style: {
      marginBottom: 12
    }
  }), deleteError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Inter'",
      fontSize: 12,
      color: COLORS.ball,
      marginBottom: 12,
      lineHeight: 1.5
    }
  }, deleteError), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: handleDeleteAccount,
    disabled: deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE",
    style: {
      width: "100%"
    }
  }, deleting ? "Deleting\u2026" : "Permanently delete my account")));
}
