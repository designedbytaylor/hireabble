import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Sanitize HTML to prevent XSS in contentEditable editor
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, form').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TEAL = "#00BFA6";
const CARD_BG = "#111520";
const BORDER = "#1E2535";
const TEXT_DIM = "#5A6380";
const TEXT_MID = "#8B92B0";
const TEXT_BRIGHT = "#E2E6F3";

const CATEGORY_COLORS = ["#00BFA6","#60A5FA","#A78BFA","#F97316","#EF4444","#FBBF24","#22C55E"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── INITIAL CHECKLIST DATA ──────────────────────────────────────────────────
const INITIAL_CHECKLIST = [
  { id: uid(), category: "Developer Accounts & Credentials", text: "Sign up for Apple Developer Account ($99/year) and complete enrollment", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Enter Apple App Store Connect API keys into Codemagic", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Set up Apple Push Notification certificates (APNs) for push notifications", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Sign up for Google Play Developer Account ($25 one-time) and complete identity verification", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Create Google Play Service Account and upload JSON key to Codemagic", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Set up Firebase project for Android push notifications (FCM)", done: false },

  { id: uid(), category: "Payments & Subscriptions", text: "Upgrade Stripe from test mode to live mode — enter real bank/payout details", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Create live Stripe products and price IDs for all subscription tiers", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Update backend environment variables with live Stripe keys", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Set up Stripe webhook endpoint for production URL", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Configure Apple In-App Purchases in App Store Connect (if using IAP)", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Configure Google Play Billing (if using in-app purchases on Android)", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Test a real payment end-to-end in production", done: false },

  { id: uid(), category: "App Store Assets & Metadata", text: "Create app icon (1024x1024 PNG, no alpha/transparency for Apple)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Prepare App Store screenshots for all required device sizes (6.7\", 6.5\", 5.5\")", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Prepare Google Play Store screenshots (phone, 7\" tablet, 10\" tablet)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Write App Store description (max 4000 chars)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Write short description for Google Play (max 80 chars)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Write promotional text for App Store (max 170 chars)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Choose app category and keywords for ASO", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Create feature graphic (1024x500 for Google Play)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Prepare app preview video (optional but recommended)", done: false },

  { id: uid(), category: "Legal & Compliance", text: "Write and host Privacy Policy at a public URL", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Write and host Terms of Service at a public URL", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Add privacy policy URL to app settings and store listings", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Complete Apple's App Privacy questionnaire (data collection disclosure)", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Complete Google Play Data Safety section", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Ensure COPPA compliance if applicable", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Set up DUNS number (required for Apple organization account)", done: false },

  { id: uid(), category: "Codemagic CI/CD Setup", text: "Connect GitHub repository to Codemagic", done: false },
  { id: uid(), category: "Codemagic CI/CD Setup", text: "Configure iOS code signing (provisioning profiles, certificates) in Codemagic", done: false },
  { id: uid(), category: "Codemagic CI/CD Setup", text: "Configure Android code signing (upload keystore) in Codemagic", done: false },
  { id: uid(), category: "Codemagic CI/CD Setup", text: "Set up Codemagic workflow for iOS builds (archive + upload to App Store Connect)", done: false },
  { id: uid(), category: "Codemagic CI/CD Setup", text: "Set up Codemagic workflow for Android builds (AAB + upload to Google Play)", done: false },
  { id: uid(), category: "Codemagic CI/CD Setup", text: "Run a successful test build on both platforms", done: false },
  { id: uid(), category: "Codemagic CI/CD Setup", text: "Configure automatic version/build number incrementing", done: false },

  { id: uid(), category: "Production Readiness", text: "Set up production MongoDB instance (upgrade from free tier if needed)", done: false },
  { id: uid(), category: "Production Readiness", text: "Configure production environment variables on Railway", done: false },
  { id: uid(), category: "Production Readiness", text: "Set up Sentry error tracking for production (frontend + backend DSNs)", done: false },
  { id: uid(), category: "Production Readiness", text: "Set up external uptime monitoring (UptimeRobot/BetterUptime) on /api/health", done: false },
  { id: uid(), category: "Production Readiness", text: "Enable MongoDB automated backups (Atlas M2+ or manual mongodump cron)", done: false },
  { id: uid(), category: "Production Readiness", text: "Set up SSL certificate for custom domain (if not auto-managed)", done: false },
  { id: uid(), category: "Production Readiness", text: "Configure CDN/caching for static assets", done: false },
  { id: uid(), category: "Production Readiness", text: "Load test backend endpoints for expected traffic", done: false },

  { id: uid(), category: "Pre-Submission Final Checks", text: "Test all critical flows on a real iOS device (signup, browse, connect, chat, payment)", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Test all critical flows on a real Android device", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Test push notifications on both platforms", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Test deep links / universal links", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Verify app works offline / handles network errors gracefully", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Remove all test/debug code and console.log statements", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Ensure minimum iOS deployment target is set correctly (iOS 14+)", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Ensure minimum Android SDK version is set (API 24+)", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Run a full accessibility audit", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Submit app for Apple App Review", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Submit app to Google Play review", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Prepare v1.0 release notes", done: false },

  // ── Additional items (added for completeness) ──

  { id: uid(), category: "Developer Accounts & Credentials", text: "Set up Sign in with Apple credentials (required if you offer any social login)", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Set up Google OAuth credentials (client ID + secret) for Sign in with Google", done: false },
  { id: uid(), category: "Developer Accounts & Credentials", text: "Configure OAuth redirect URLs for all providers in production", done: false },

  { id: uid(), category: "App Store Assets & Metadata", text: "Write App Store subtitle (max 30 chars)", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Add support URL for App Store listing", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Set age rating via App Store Connect questionnaire", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Set content rating via Google Play IARC questionnaire", done: false },
  { id: uid(), category: "App Store Assets & Metadata", text: "Add copyright text (e.g., '2026 Hireabble Inc.') in App Store Connect", done: false },

  { id: uid(), category: "Legal & Compliance", text: "Implement in-app account deletion flow (required by both Apple and Google)", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Add iOS Privacy Manifest file (PrivacyInfo.xcprivacy) — required since Spring 2024", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Answer export compliance questions in App Store Connect (HTTPS = uses encryption)", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Add NSUsageDescription strings for camera, photo library, and any other permissions", done: false },
  { id: uid(), category: "Legal & Compliance", text: "Verify Sign in with Apple is offered alongside other social login options", done: false },

  { id: uid(), category: "App Review Preparation", text: "Create a demo/test account with pre-populated data for Apple reviewers", done: false },
  { id: uid(), category: "App Review Preparation", text: "Create a demo/test account for Google Play reviewers", done: false },
  { id: uid(), category: "App Review Preparation", text: "Write review notes explaining app features and any non-obvious flows", done: false },
  { id: uid(), category: "App Review Preparation", text: "Ensure no placeholder content, broken links, or lorem ipsum text anywhere", done: false },
  { id: uid(), category: "App Review Preparation", text: "Verify all screenshots accurately reflect current app UI", done: false },

  { id: uid(), category: "Deep Links & App Links", text: "Host apple-app-site-association file at /.well-known/ on hireabble.com", done: false },
  { id: uid(), category: "Deep Links & App Links", text: "Host assetlinks.json at /.well-known/ on hireabble.com for Android App Links", done: false },
  { id: uid(), category: "Deep Links & App Links", text: "Test universal links open the app correctly on iOS", done: false },
  { id: uid(), category: "Deep Links & App Links", text: "Test App Links open the app correctly on Android", done: false },

  { id: uid(), category: "Post-Launch", text: "Set up App Store Connect notifications for review status changes", done: false },
  { id: uid(), category: "Post-Launch", text: "Monitor crash reports in App Store Connect and Google Play Console", done: false },
  { id: uid(), category: "Post-Launch", text: "Set up Google Play pre-launch report (automated device testing)", done: false },
  { id: uid(), category: "Post-Launch", text: "Plan staged rollout strategy (e.g., 10% → 50% → 100% on Google Play)", done: false },
  { id: uid(), category: "Post-Launch", text: "Prepare customer support workflow for app store reviews and feedback", done: false },

  // ── Items added from code audit ──

  { id: uid(), category: "Payments & Subscriptions", text: "Set Apple IAP production environment variables (APPLE_ENVIRONMENT, APPLE_BUNDLE_ID, APPLE_SHARED_SECRET)", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Configure App Store Server Notifications URL in App Store Connect", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Test Apple IAP subscription purchase end-to-end on a real iOS device", done: false },
  { id: uid(), category: "Payments & Subscriptions", text: "Test Google Play subscription purchase end-to-end on a real Android device", done: false },

  { id: uid(), category: "Native App Configuration", text: "Set up Capacitor project with correct bundle ID (com.hireabble.app or similar)", done: false },
  { id: uid(), category: "Native App Configuration", text: "Configure iOS project in Xcode (capabilities, entitlements, launch screen)", done: false },
  { id: uid(), category: "Native App Configuration", text: "Configure Android project in Android Studio (permissions, icons, splash screen)", done: false },
  { id: uid(), category: "Native App Configuration", text: "Add push notification entitlement in Xcode project", done: false },
  { id: uid(), category: "Native App Configuration", text: "Set Capacitor app version and build number to match store submissions", done: false },
  { id: uid(), category: "Native App Configuration", text: "Configure iOS App Transport Security (ATS) settings", done: false },
  { id: uid(), category: "Native App Configuration", text: "Ensure Android target SDK is API 34+ (Google Play requirement for 2024+)", done: false },
  { id: uid(), category: "Native App Configuration", text: "Test Capacitor native bridge (camera, photo library, secure storage) on real devices", done: false },

  { id: uid(), category: "Pre-Submission Final Checks", text: "Test account deletion flow end-to-end on both platforms", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Test subscription restore purchases flow on both platforms", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Verify app binary size is under store limits (200MB iOS cellular, 150MB Android base)", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Test on multiple iOS versions (iOS 16, 17, 18) and Android versions (12, 13, 14)", done: false },
  { id: uid(), category: "Pre-Submission Final Checks", text: "Provide demo account credentials in App Store Connect and Google Play review notes", done: false },

  { id: uid(), category: "Production Readiness", text: "Verify CORS whitelist includes all production domains (hireabble.com, app subdomains)", done: false },
  { id: uid(), category: "Production Readiness", text: "Set ENVIRONMENT=production in Railway (controls security headers, CSRF, rate limiting)", done: false },

  { id: uid(), category: "Marketing & Launch", text: "Create App Store Connect app listing (name, subtitle, description, screenshots)", done: false },
  { id: uid(), category: "Marketing & Launch", text: "Create Google Play Console app listing (title, descriptions, graphics, screenshots)", done: false },
  { id: uid(), category: "Marketing & Launch", text: "Prepare launch announcement (social media, website, email)", done: false },
  { id: uid(), category: "Marketing & Launch", text: "Set up app store rating prompt (SKStoreReviewController on iOS)", done: false },
  { id: uid(), category: "Marketing & Launch", text: "Create a marketing website landing page or update hireabble.com with store badges", done: false },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

// Items verified as complete (one-time auto-check migration)
const AUTO_COMPLETE_ITEMS = new Set([
  "Write and host Privacy Policy at a public URL",
  "Write and host Terms of Service at a public URL",
  "Add privacy policy URL to app settings and store listings",
  "Implement in-app account deletion flow (required by both Apple and Google)",
  "Verify Sign in with Apple is offered alongside other social login options",
  "Set up SSL certificate for custom domain (if not auto-managed)",
  "Configure CDN/caching for static assets",
  "Configure production environment variables on Railway",
  "Set up external uptime monitoring (UptimeRobot/BetterUptime) on /api/health",
  "Load test backend endpoints for expected traffic",
  "Write App Store description (max 4000 chars)",
  "Write short description for Google Play (max 80 chars)",
  "Write promotional text for App Store (max 170 chars)",
  "Choose app category and keywords for ASO",
  "Add NSUsageDescription strings for camera, photo library, and any other permissions",
  "Add iOS Privacy Manifest file (PrivacyInfo.xcprivacy) — required since Spring 2024",
  "Remove all test/debug code and console.log statements",
  "Ensure no placeholder content, broken links, or lorem ipsum text anywhere",
  "Verify CORS whitelist includes all production domains (hireabble.com, app subdomains)",
  "Set up Stripe webhook endpoint for production URL",
  "Upgrade Stripe from test mode to live mode — enter real bank/payout details",
  "Update backend environment variables with live Stripe keys",
  "Set up production MongoDB instance (upgrade from free tier if needed)",
]);

export default function AdminLaunchChecklist() {
  const { token } = useAdminAuth();
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingToCategory, setAddingToCategory] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editItemText, setEditItemText] = useState("");
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [modalNotes, setModalNotes] = useState("");
  const [modalEditingText, setModalEditingText] = useState(false);
  const [modalTextDraft, setModalTextDraft] = useState("");
  const [modalConfirmDelete, setModalConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const saveTimer = useRef(null);
  const notesTimer = useRef(null);
  const modalNotesTimer = useRef(null);

  const saveToApi = useCallback(async (fields) => {
    try {
      await axios.put(`${API}/admin/launch-checklist`, fields, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Silent fail — will retry on next change
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/launch-checklist`, { headers: { Authorization: `Bearer ${token}` } });
        const data = res.data;
        if (data.checklist && data.checklist.length > 0) {
          // Merge any new INITIAL_CHECKLIST items that don't exist in saved data
          const savedTexts = new Set(data.checklist.map(i => i.text));
          const newItems = INITIAL_CHECKLIST.filter(i => !savedTexts.has(i.text));
          if (newItems.length > 0) {
            // Group new items by category and append them after existing items in that category, or at the end
            const merged = [...data.checklist];
            const mergedTexts = new Set(merged.map(i => i.text));
            for (const item of newItems) {
              if (mergedTexts.has(item.text)) continue; // skip duplicates
              mergedTexts.add(item.text);
              // Find last item in same category
              const lastIdx = merged.map((m, idx) => m.category === item.category ? idx : -1).filter(i => i !== -1);
              const insertAt = lastIdx.length > 0 ? lastIdx[lastIdx.length - 1] + 1 : merged.length;
              merged.splice(insertAt, 0, { ...item, id: uid() });
            }
            setChecklist(merged);
            // Save the merged list
            saveToApi({ checklist: merged });
          } else {
            setChecklist(data.checklist);
          }

          // One-time auto-check migration for verified items
          const migrationKey = "launch_checklist_autocheck_v1";
          if (!localStorage.getItem(migrationKey)) {
            const currentList = data.checklist;
            let changed = false;
            const updated = currentList.map(item => {
              if (!item.done && AUTO_COMPLETE_ITEMS.has(item.text)) {
                changed = true;
                return { ...item, done: true };
              }
              return item;
            });
            if (changed) {
              setChecklist(updated);
              saveToApi({ checklist: updated });
            }
            localStorage.setItem(migrationKey, "1");
          }
        }
        if (data.notes !== undefined) setNotes(data.notes);
      } catch {
        // First load — use defaults
      }
      setLoaded(true);
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedSave = useCallback((fields) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToApi(fields), 800);
  }, [saveToApi]);

  // Notes autosave
  const handleNotesChange = (val) => {
    setNotes(val); setNotesSaved(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      await saveToApi({ notes: val });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }, 1000);
  };

  // Toggle item done
  const toggleItem = (id) => {
    setChecklist(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, done: !item.done } : item);
      debouncedSave({ checklist: updated });
      return updated;
    });
  };

  // Add item
  const addItem = (category, text) => {
    if (!text.trim()) return;
    setChecklist(prev => {
      const lastIndex = prev.map((it, i) => it.category === category ? i : -1).filter(i => i !== -1);
      const insertAt = lastIndex.length > 0 ? lastIndex[lastIndex.length - 1] + 1 : prev.length;
      const updated = [...prev.slice(0, insertAt), { id: uid(), category, text: text.trim(), done: false }, ...prev.slice(insertAt)];
      debouncedSave({ checklist: updated });
      return updated;
    });
  };

  // Edit item text
  const editItem = (id, newText) => {
    if (!newText.trim()) return;
    setChecklist(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, text: newText.trim() } : item);
      debouncedSave({ checklist: updated });
      return updated;
    });
  };

  // Delete item
  const deleteItem = (id) => {
    setChecklist(prev => {
      const updated = prev.filter(item => item.id !== id);
      debouncedSave({ checklist: updated });
      return updated;
    });
  };

  // Update item notes
  const updateItemNotes = (id, itemNotes) => {
    setChecklist(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, notes: itemNotes } : item);
      clearTimeout(modalNotesTimer.current);
      modalNotesTimer.current = setTimeout(() => saveToApi({ checklist: updated }), 800);
      return updated;
    });
  };

  // Upload attachment
  const uploadAttachment = async (itemId, file) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("item_id", itemId);
      const res = await axios.post(`${API}/admin/launch-checklist/upload`, form, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      // Add attachment to local state
      setChecklist(prev => {
        const updated = prev.map(item => {
          if (item.id === itemId) {
            return { ...item, attachments: [...(item.attachments || []), res.data] };
          }
          return item;
        });
        return updated;
      });
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete attachment
  const deleteAttachment = async (itemId, attachmentId) => {
    try {
      await axios.delete(`${API}/admin/launch-checklist/attachment`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { item_id: itemId, attachment_id: attachmentId },
      });
      setChecklist(prev => {
        const updated = prev.map(item => {
          if (item.id === itemId) {
            return { ...item, attachments: (item.attachments || []).filter(a => a.id !== attachmentId) };
          }
          return item;
        });
        return updated;
      });
      toast.success("Attachment removed");
    } catch {
      toast.error("Failed to delete attachment");
    }
  };

  // Open item modal
  const openItemModal = (item) => {
    setModalItem(item);
    setModalNotes(item.notes || "");
    setModalEditingText(false);
    setModalTextDraft("");
    setModalConfirmDelete(false);
    // Set editor content after render
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(item.notes || "");
    }, 0);
  };

  // Close item modal
  const closeItemModal = () => {
    if (modalItem) {
      const html = editorRef.current ? editorRef.current.innerHTML : modalNotes;
      const currentItem = checklist.find(i => i.id === modalItem.id);
      if (currentItem && (currentItem.notes || "") !== html) {
        updateItemNotes(modalItem.id, html);
      }
    }
    setModalItem(null);
    setModalNotes("");
    setModalEditingText(false);
    setModalTextDraft("");
    setModalConfirmDelete(false);
  };

  // Add new category
  const addCategory = (name) => {
    if (!name.trim()) return;
    // Just add a placeholder item so the category appears
    setChecklist(prev => {
      const updated = [...prev, { id: uid(), category: name.trim(), text: "First task — click edit to customize", done: false }];
      debouncedSave({ checklist: updated });
      return updated;
    });
  };

  // Compute categories in order of first appearance
  const categories = [];
  const categorySet = new Set();
  checklist.forEach(item => {
    if (!categorySet.has(item.category)) {
      categorySet.add(item.category);
      categories.push(item.category);
    }
  });

  const totalItems = checklist.length;
  const doneItems = checklist.filter(i => i.done).length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  if (!loaded) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: TEXT_DIM, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Rich editor placeholder style */}
      <style>{`[contenteditable]:empty:before { content: attr(data-placeholder); color: ${TEXT_DIM}; pointer-events: none; }`}</style>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_BRIGHT }}>Launch Checklist</span>
          <span style={{ fontSize: 12, color: TEXT_DIM, background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 10px" }}>
            Pre-Submission To-Do
          </span>
        </div>
        <p style={{ fontSize: 13, color: TEXT_MID, margin: 0 }}>
          Everything you need to complete before submitting to the Apple App Store and Google Play via Codemagic.
        </p>
      </div>

      {/* Progress bar */}
      <Card style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: TEXT_BRIGHT }}>Overall Progress</span>
            <span style={{ color: TEAL, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
          </div>
          <div style={{ background: "#1A2035", borderRadius: 99, height: 8, width: "100%" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${TEAL},#60A5FA)`, borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEAL }}>{doneItems}</div>
            <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1 }}>Done</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_MID }}>{totalItems - doneItems}</div>
            <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1 }}>Remaining</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_BRIGHT }}>{totalItems}</div>
            <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
          </div>
        </div>
        <button onClick={() => setEditMode(v => !v)} style={{ background: editMode ? `${TEAL}22` : "#1A2035", border: `1px solid ${editMode ? TEAL + "66" : BORDER}`, borderRadius: 7, padding: "7px 16px", cursor: "pointer", color: editMode ? TEAL : TEXT_MID, fontSize: 12, fontWeight: 700 }}>
          {editMode ? "Done Editing" : "Edit"}
        </button>
      </Card>

      {/* Category sections */}
      {categories.map((category, catIndex) => {
        const items = checklist.filter(i => i.category === category);
        const catDone = items.filter(i => i.done).length;
        const catColor = CATEGORY_COLORS[catIndex % CATEGORY_COLORS.length];

        return (
          <div key={category} style={{ marginBottom: 28 }}>
            {/* Category header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: catColor, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: TEXT_BRIGHT }}>{category}</span>
              <span style={{ fontSize: 12, color: TEXT_DIM }}>{catDone}/{items.length}</span>
              {catDone === items.length && items.length > 0 && (
                <span style={{ fontSize: 11, color: "#22C55E", fontWeight: 700, background: "#22C55E15", padding: "2px 8px", borderRadius: 5 }}>Complete</span>
              )}
            </div>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map(item => {
                const isEditingThis = editingItem === item.id;
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, background: item.done ? `${catColor}0A` : CARD_BG, border: `1px solid ${item.done ? catColor + "33" : BORDER}`, borderRadius: 8, padding: "9px 12px", transition: "all 0.15s" }}>
                    <div onClick={() => { if (!isEditingThis) toggleItem(item.id); }} style={{ width: 19, height: 19, borderRadius: 5, border: `2px solid ${item.done ? catColor : "#2E3550"}`, background: item.done ? catColor : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
                      {item.done && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
                    </div>
                    {isEditingThis ? (
                      <input autoFocus value={editItemText} onChange={e => setEditItemText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { editItem(item.id, editItemText); setEditingItem(null); setEditItemText(""); } if (e.key === "Escape") { setEditingItem(null); setEditItemText(""); } }} style={{ flex: 1, background: "#0D1020", border: `1px solid ${TEAL}66`, borderRadius: 6, padding: "3px 9px", color: TEXT_BRIGHT, fontSize: 13.5, outline: "none" }} />
                    ) : (
                      <span onClick={() => { if (!editMode) openItemModal(item); }} style={{ flex: 1, fontSize: 13.5, color: item.done ? TEXT_DIM : TEXT_BRIGHT, textDecoration: item.done ? "line-through" : "none", cursor: editMode ? "default" : "pointer", lineHeight: 1.5 }}>
                        {item.text}
                        {item.notes && <span style={{ marginLeft: 8, fontSize: 11, color: TEAL, opacity: 0.7 }}>📝</span>}
                      </span>
                    )}
                    {editMode && !isEditingThis && (
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button onClick={() => { setEditingItem(item.id); setEditItemText(item.text); }} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, fontSize: 13, padding: "2px 5px" }} title="Edit">✏️</button>
                        <button onClick={() => setConfirmDeleteItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 13, padding: "2px 5px" }} title="Delete">✕</button>
                      </div>
                    )}
                    {isEditingThis && (
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button onClick={() => { editItem(item.id, editItemText); setEditingItem(null); setEditItemText(""); }} style={{ background: TEAL, border: "none", borderRadius: 5, padding: "3px 9px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700 }}>Save</button>
                        <button onClick={() => { setEditingItem(null); setEditItemText(""); }} style={{ background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", color: TEXT_DIM, fontSize: 11 }}>Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add item row */}
              {editMode && (
                addingToCategory === category ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 2px" }}>
                    <input autoFocus value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addItem(category, newItemText); setNewItemText(""); setAddingToCategory(null); } if (e.key === "Escape") { setAddingToCategory(null); setNewItemText(""); } }} placeholder="New task..." style={{ flex: 1, background: "#0D1020", border: `1px solid ${TEAL}55`, borderRadius: 7, padding: "8px 12px", color: TEXT_BRIGHT, fontSize: 13, outline: "none" }} />
                    <button onClick={() => { addItem(category, newItemText); setNewItemText(""); setAddingToCategory(null); }} style={{ background: TEAL, border: "none", borderRadius: 7, padding: "8px 14px", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 700 }}>Add</button>
                    <button onClick={() => { setAddingToCategory(null); setNewItemText(""); }} style={{ background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 12px", cursor: "pointer", color: TEXT_DIM, fontSize: 13 }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingToCategory(category); setNewItemText(""); }} style={{ background: "none", border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "8px 13px", cursor: "pointer", color: TEXT_DIM, fontSize: 13, textAlign: "left", transition: "all 0.15s" }}>+ Add task</button>
                )
              )}
            </div>
          </div>
        );
      })}

      {/* Add category section */}
      {editMode && (
        <div style={{ marginTop: 8, marginBottom: 28 }}>
          {showAddCategory ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addCategory(newCategoryName); setNewCategoryName(""); setShowAddCategory(false); } if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryName(""); } }} placeholder="New category name..." style={{ flex: 1, background: "#0D1020", border: `1px solid ${TEAL}55`, borderRadius: 8, padding: "9px 13px", color: TEXT_BRIGHT, fontSize: 14, fontWeight: 600, outline: "none", maxWidth: 380 }} />
              <Btn onClick={() => { addCategory(newCategoryName); setNewCategoryName(""); setShowAddCategory(false); }}>Add Category</Btn>
              <Btn secondary onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}>Cancel</Btn>
            </div>
          ) : (
            <button onClick={() => setShowAddCategory(true)} style={{ background: `${TEAL}0D`, border: `1px dashed ${TEAL}55`, borderRadius: 10, padding: "12px 20px", cursor: "pointer", color: TEAL, fontSize: 13, fontWeight: 700, width: "100%", textAlign: "center" }}>+ Add New Category</button>
          )}
        </div>
      )}

      {/* Notes section */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: TEXT_BRIGHT }}>Notes</h2>
          <span style={{ fontSize: 12, color: notesSaved ? TEAL : TEXT_DIM, transition: "color 0.3s" }}>{notesSaved ? "✓ Saved" : "Auto-saves as you type"}</span>
        </div>
        <Card style={{ padding: 0 }}>
          <textarea value={notes} onChange={e => handleNotesChange(e.target.value)} placeholder={"Freeform notes for launch prep...\n\n• Apple Developer enrollment submitted — waiting for approval\n• Need to finalize App Store screenshots\n• Stripe live mode keys are in 1Password vault"} style={{ width: "100%", minHeight: 260, background: "transparent", border: "none", padding: "20px", color: TEXT_BRIGHT, fontSize: 14, lineHeight: 1.8, resize: "vertical", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
        </Card>
      </div>

      {/* Confirm delete item modal */}
      {confirmDeleteItem && (
        <div style={{ position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#161B28", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "26px 30px", maxWidth: 340, width: "90%" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete task?</div>
            <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => { deleteItem(confirmDeleteItem); setConfirmDeleteItem(null); }} style={{ background: "#EF4444" }}>Delete Task</Btn>
              <Btn secondary onClick={() => setConfirmDeleteItem(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Todo item detail modal */}
      {modalItem && (() => {
        const liveItem = checklist.find(i => i.id === modalItem.id);
        if (!liveItem) return null;
        const catIndex = categories.indexOf(liveItem.category);
        const catColor = CATEGORY_COLORS[catIndex >= 0 ? catIndex % CATEGORY_COLORS.length : 0];
        return (
          <div onClick={closeItemModal} style={{ position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#161B28", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "28px 30px", maxWidth: 960, width: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              {/* Category badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: catColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: TEXT_MID, fontWeight: 600 }}>{liveItem.category}</span>
              </div>

              {/* Checkbox + task text */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
                <div onClick={() => toggleItem(liveItem.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${liveItem.done ? catColor : "#2E3550"}`, background: liveItem.done ? catColor : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", transition: "all 0.15s", marginTop: 2 }}>
                  {liveItem.done && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>✓</span>}
                </div>
                {modalEditingText ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      autoFocus
                      value={modalTextDraft}
                      onChange={e => setModalTextDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") { editItem(liveItem.id, modalTextDraft); setModalEditingText(false); }
                        if (e.key === "Escape") { setModalEditingText(false); setModalTextDraft(""); }
                      }}
                      style={{ width: "100%", background: "#0D1020", border: `1px solid ${TEAL}66`, borderRadius: 7, padding: "8px 12px", color: TEXT_BRIGHT, fontSize: 15, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn onClick={() => { editItem(liveItem.id, modalTextDraft); setModalEditingText(false); }}>Save</Btn>
                      <Btn secondary onClick={() => { setModalEditingText(false); setModalTextDraft(""); }}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: liveItem.done ? TEXT_DIM : TEXT_BRIGHT, textDecoration: liveItem.done ? "line-through" : "none", lineHeight: 1.5 }}>{liveItem.text}</span>
                    <button onClick={() => { setModalEditingText(true); setModalTextDraft(liveItem.text); }} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, fontSize: 14, padding: "2px 5px", flexShrink: 0 }} title="Edit task text">✏️</button>
                  </div>
                )}
              </div>

              {/* Notes rich editor */}
              <div style={{ marginBottom: 20, flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: TEXT_MID, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Notes</label>
                {/* Toolbar */}
                <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                  {[
                    { cmd: "bold", label: "B", style: { fontWeight: 800 }, title: "Bold" },
                    { cmd: "italic", label: "I", style: { fontStyle: "italic" }, title: "Italic" },
                    { cmd: "underline", label: "U", style: { textDecoration: "underline" }, title: "Underline" },
                  ].map(btn => (
                    <button key={btn.cmd} onMouseDown={e => { e.preventDefault(); document.execCommand(btn.cmd); }} style={{ background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer", color: TEXT_BRIGHT, fontSize: 13, minWidth: 30, ...btn.style }} title={btn.title}>{btn.label}</button>
                  ))}
                  <span style={{ width: 1, background: BORDER, margin: "0 4px" }} />
                  {[
                    { size: "3", label: "Small", fs: 11 },
                    { size: "4", label: "Normal", fs: 13 },
                    { size: "5", label: "Large", fs: 15 },
                    { size: "6", label: "XL", fs: 17 },
                  ].map(sz => (
                    <button key={sz.size} onMouseDown={e => { e.preventDefault(); document.execCommand("fontSize", false, sz.size); }} style={{ background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 8px", cursor: "pointer", color: TEXT_MID, fontSize: sz.fs, lineHeight: 1 }} title={`Font size: ${sz.label}`}>{sz.label}</button>
                  ))}
                  <span style={{ width: 1, background: BORDER, margin: "0 4px" }} />
                  <button onMouseDown={e => { e.preventDefault(); document.execCommand("insertUnorderedList"); }} style={{ background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer", color: TEXT_MID, fontSize: 13 }} title="Bullet list">• List</button>
                  <button onMouseDown={e => { e.preventDefault(); document.execCommand("removeFormat"); }} style={{ background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer", color: TEXT_DIM, fontSize: 11 }} title="Clear formatting">Clear</button>
                </div>
                {/* Editable area */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => {
                    if (!editorRef.current) return;
                    const html = editorRef.current.innerHTML;
                    clearTimeout(modalNotesTimer.current);
                    modalNotesTimer.current = setTimeout(() => {
                      updateItemNotes(liveItem.id, html);
                    }, 800);
                  }}
                  onFocus={e => e.target.style.borderColor = TEAL + "66"}
                  onBlur={e => e.target.style.borderColor = BORDER}
                  style={{ width: "100%", minHeight: 320, background: "#0D1020", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px", color: TEXT_BRIGHT, fontSize: 14, lineHeight: 1.7, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  data-placeholder="Add notes, links, or details for this task..."
                />
              </div>

              {/* Attachments */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: TEXT_MID, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Attachments</label>
                {(liveItem.attachments || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {(liveItem.attachments || []).map(att => {
                      const isImage = att.content_type?.startsWith("image/");
                      const sizeStr = att.size < 1024 ? `${att.size}B` : att.size < 1048576 ? `${(att.size/1024).toFixed(0)}KB` : `${(att.size/1048576).toFixed(1)}MB`;
                      return (
                        <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0D1020", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px" }}>
                          {isImage && (
                            <img src={`${process.env.REACT_APP_BACKEND_URL}${att.url}`} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                          )}
                          {!isImage && (
                            <div style={{ width: 40, height: 40, borderRadius: 6, background: "#1A2035", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>
                              📎
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_BRIGHT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.filename}</div>
                            <div style={{ fontSize: 11, color: TEXT_DIM }}>{sizeStr}</div>
                          </div>
                          <a href={`${process.env.REACT_APP_BACKEND_URL}${att.url}`} download={att.filename} target="_blank" rel="noopener noreferrer" style={{ background: `${TEAL}15`, border: `1px solid ${TEAL}44`, borderRadius: 6, padding: "5px 10px", color: TEAL, fontSize: 11, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
                            Download
                          </a>
                          <button onClick={() => deleteAttachment(liveItem.id, att.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 14, padding: "4px", flexShrink: 0 }} title="Remove attachment">
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadAttachment(liveItem.id, e.target.files[0]); }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ background: "#1A2035", border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "10px 16px", cursor: uploading ? "wait" : "pointer", color: TEXT_MID, fontSize: 13, fontWeight: 600, width: "100%", transition: "all 0.15s" }}>
                  {uploading ? "Uploading..." : "+ Add file (photos, screenshots, PDFs — max 10MB)"}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => { toggleItem(liveItem.id); }} style={{ background: liveItem.done ? "#1A2035" : `${TEAL}15`, border: `1px solid ${liveItem.done ? BORDER : TEAL + "44"}`, borderRadius: 7, padding: "8px 16px", cursor: "pointer", color: liveItem.done ? TEXT_MID : TEAL, fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}>
                    {liveItem.done ? "Mark Incomplete" : "Mark Complete"}
                  </button>
                  {!modalConfirmDelete ? (
                    <button onClick={() => setModalConfirmDelete(true)} style={{ background: "none", border: `1px solid #EF444444`, borderRadius: 7, padding: "8px 14px", cursor: "pointer", color: "#EF4444", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}>
                      Delete
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>Sure?</span>
                      <Btn onClick={() => { deleteItem(liveItem.id); setModalItem(null); }} style={{ background: "#EF4444", padding: "6px 12px", fontSize: 12 }}>Yes, Delete</Btn>
                      <Btn secondary onClick={() => setModalConfirmDelete(false)} style={{ padding: "6px 12px", fontSize: 12 }}>No</Btn>
                    </div>
                  )}
                </div>
                <Btn secondary onClick={closeItemModal}>Close</Btn>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Card({ children, style }) { return <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 11, padding: "16px", ...style }}>{children}</div>; }
function Btn({ children, onClick, disabled, secondary, style }) { return <button onClick={onClick} disabled={disabled} style={{ background: secondary ? "transparent" : disabled ? "#1A2035" : `linear-gradient(135deg,${TEAL},#0097A7)`, border: secondary ? `1px solid ${BORDER}` : "none", borderRadius: 7, padding: "7px 15px", cursor: disabled ? "not-allowed" : "pointer", color: secondary ? TEXT_DIM : disabled ? TEXT_DIM : "#fff", fontWeight: 700, fontSize: 13, transition: "all 0.15s", boxShadow: secondary || disabled ? "none" : `0 0 12px ${TEAL}44`, whiteSpace: "nowrap", ...style }}>{children}</button>; }
