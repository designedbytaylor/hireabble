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
// Pre-filled notes (rich-text HTML) for creative items and landing pages.
// All creatives are 9:16 vertical, under 15s, with overlay text mandatory (most viewers watch with sound off).

const S1_NOTES = `<div><b>Hook (0–2s):</b> tight shot — hands folding napkins / wiping tables / staring at wall clock.</div><div><b>Overlay text:</b> "POV: you've been at this restaurant 14 months and nothing's changed."</div><div><br></div><div><b>Beat 2 (2–8s):</b> cut to phone — thumb swiping through Hireabble jobs; match screen pops.</div><div><br></div><div><b>End card (8–15s):</b> "Hireabble — service jobs in Edmonton. Free. Swipe, match, start."</div><div><br></div><div><b>B-roll shot list:</b></div><ul><li>Napkin fold closeup</li><li>Wall clock shot</li><li>Phone-in-hand swiping</li><li>App match screen capture</li></ul>`;

const S2_NOTES = `<div><b>Format:</b> white background, black text, one beat per line, ~2s per line. No filming — produce in CapCut / After Effects. Cheapest creative to make.</div><div><br></div><div><b>Line 1 (0–2s):</b> "You've applied to 23 jobs on Indeed."</div><div><b>Line 2 (2–4s):</b> "You've heard back from 2."</div><div><b>Line 3 (4–6s):</b> "One was a scam."</div><div><b>Line 4 + end card (6–15s):</b> "Try Hireabble. Edmonton service industry only. You'll hear back in hours, not weeks."</div>`;

const S3_NOTES = `<div><b>Location:</b> Whyte Ave storefront OR Ice District plaza — anywhere recognizably YEG.</div><div><b>Setup:</b> vertical phone, natural light, no gimbal. Film 10 takes, post the 2 that feel most natural.</div><div><br></div><div><b>Script (full, ~12s):</b></div><div>"Hey YEG. I built this app because applying to restaurant jobs shouldn't take 40 applications. If you serve, bartend, cook, or host in Edmonton — Hireabble is free. Link in bio."</div><div><br></div><div><b>End card (12–15s):</b> "Hireabble — Edmonton only. Link in bio."</div><div><br></div><div><b>Works disproportionately well for local audiences.</b></div>`;

const S4_NOTES = `<div><b>Hook overlay (0–2s):</b> "How to leave your restaurant job without anyone finding out."</div><div><br></div><div><b>Beat 2 (2–10s):</b> show swiping privately on bus / in break room — close-to-chest phone angle, screen not visible to anyone around.</div><div><br></div><div><b>Beat 3 (10–13s):</b> match screen pops up.</div><div><br></div><div><b>End card (13–15s):</b> "Your manager won't see you on Hireabble. Edmonton only."</div><div><br></div><div><b>B-roll shot list:</b></div><ul><li>Bus window view</li><li>Break room / staff area shot</li><li>Hand hiding phone under table or in lap</li><li>Match screen capture</li></ul>`;

const S5_NOTES = `<div><b>Hook (0–3s):</b> "Edmonton servers: your friend at [insert trendy spot] is making $400/shift. You're making $180. Here's why."</div><div><br></div><div><b>Beat 2 (3–10s):</b> show the app highlighting tip-split info, neighborhoods, busier venues.</div><div><br></div><div><b>End card (10–15s):</b> "See what's hiring in YEG tonight. Hireabble."</div><div><br></div><div><b>Note:</b> only reference real Edmonton neighborhoods / venues — don't invent. The specificity is what makes this hit.</div>`;

const R1_NOTES = `<div><b>Hook (0–3s):</b> dim empty bar, 1am feel, filmed handheld on a phone.</div><div><b>VO / overlay:</b> "If you've ever closed the bar yourself because your line cook ghosted you…"</div><div><br></div><div><b>Beat 2 (3–10s):</b> show swiping through local candidate profiles — skills tags, availability, "last active 2 hours ago".</div><div><br></div><div><b>End card (10–15s):</b> "Post a job free. Hireabble — Edmonton restaurants only."</div><div><br></div><div><b>B-roll shot list:</b></div><ul><li>Empty bar wide shot after close</li><li>Hands wiping down counter</li><li>Clock on wall showing late hour</li><li>Candidate profile screens</li></ul><div><b>Ask permission</b> before filming inside any real bar.</div>`;

const R2_NOTES = `<div><b>Format:</b> text-on-screen, no filming required. Brutal and effective — lead with the number.</div><div><br></div><div><b>Beat 1 (0–3s):</b> "Indeed is charging you $400 per hire. Plus the no-shows."</div><div><br></div><div><b>Beat 2 (3–10s):</b> cut to app — candidate profiles with verified availability badges.</div><div><br></div><div><b>End card (10–15s):</b> "Hireabble. Free to post. Edmonton service industry only."</div>`;

const R3_NOTES = `<div><b>Hook (0–2s):</b> question as text on screen — "How many no-call-no-shows did you have this month?" Makes GMs count in their head.</div><div><br></div><div><b>Beat 2 (2–10s):</b> fast-cut montage of app showing "last active 2 hours ago", "replies in avg 12 min", verified profiles.</div><div><br></div><div><b>End card (10–15s):</b> "Real Edmonton candidates. Active this week. Post free."</div><div><br></div><div><b>Style:</b> upbeat, quick cuts, percussive music.</div>`;

const R4_NOTES = `<div><b>Status:</b> <b style="color:#EF4444">BLOCKED until 3+ real customers signed with permission to use their name/logo.</b></div><div><br></div><div><b>Format:</b> show logos / storefront exteriors of 3 Edmonton venues already posting on Hireabble.</div><div><br></div><div><b>Script:</b> "Sawmill, [venue 2], [venue 3] are hiring on Hireabble. Join them."</div><div><br></div><div><b>End card:</b> "Free to post. Edmonton restaurants only."</div><div><br></div><div><b>Notes:</b> pure FOMO — very effective for local GMs. Once filmed, run this at <b>2x budget</b> of other recruiter creatives.</div>`;

const R5_NOTES = `<div><b>Format:</b> founder direct-to-camera at a recognizable Edmonton location.</div><div><br></div><div><b>Script (full, ~12s):</b></div><div>"Edmonton restaurant owners — I'll personally come set up your first job posting. Message me."</div><div><br></div><div><b>End card (12–15s):</b> "DM @hireabble. First 30 owners only."</div><div><br></div><div><b>Rules:</b></div><ul><li>Post from @hireabble with DMs open</li><li>Only run for first 30–50 customers</li><li>Doesn't scale — and we shouldn't scale yet</li><li>Pause this creative once we hit 30 paying recruiters</li></ul>`;

const SEEKER_LP_NOTES = `<div><b>Path:</b> <code>/l/seeker</code> (ad-specific — NOT the homepage).</div><div><br></div><div><b>Above-fold headline:</b> "Edmonton service jobs. Without the ghost."</div><div><b>Sub:</b> "Swipe through restaurants, bars, and hotels actively hiring in YEG. Hear back in hours, not weeks."</div><div><b>Primary CTA:</b> "Start swiping — free"</div><div><br></div><div><b>Social proof strip:</b> live count of active jobs / matches this week (auto-pulled).</div><div><br></div><div><b>How it works (3 steps):</b></div><ol><li>Sign up</li><li>Swipe</li><li>Match &amp; chat</li></ol><div><b>Trust block:</b> "Edmonton only. Verified employers. Your current manager won't see you on here."</div><div><br></div><div><b>Bottom CTA:</b> same as primary.</div><div><br></div><div><b>Build notes:</b> mobile-first, single column, fast load, Meta Pixel installed, UTM-aware for attribution.</div>`;

const RECRUITER_LP_NOTES = `<div><b>Path:</b> <code>/l/recruiter</code> (ad-specific — NOT the homepage).</div><div><br></div><div><b>Above-fold headline:</b> "Hire line cooks, bartenders, and servers without Indeed charging you $400 a hire."</div><div><b>Sub:</b> "Post unlimited jobs free while we're launching in Edmonton. Candidates active this week — avg reply time 12 min."</div><div><b>Primary CTA:</b> "Post your first job — free"</div><div><br></div><div><b>Social proof:</b> "Sawmill, [venue 2], [venue 3] already hiring on Hireabble" (swap in real logos once signed).</div><div><br></div><div><b>Comparison table — Hireabble vs Indeed:</b></div><ul><li>Price: free vs $400+ per hire</li><li>No-show rate: verified availability vs unverified</li><li>Candidate pool: Edmonton service industry only vs everyone</li><li>Support: founder setup call vs none</li></ul><div><b>Founder offer banner:</b> "First 30 Edmonton restaurants get a personal onboarding call — book a time."</div><div><br></div><div><b>Build notes:</b> Calendly embed for founder call slot, Meta Pixel with RecruiterJobPosted conversion, UTM-aware.</div>`;

const SEEKER_TARGETING_NOTES = `<div><b>Geo:</b> Edmonton + 25km</div><div><b>Age:</b> 18–40</div><div><b>Interests:</b> Restaurant, Bartending, Server, Food service, Culinary arts, NAIT, MacEwan</div><div><b>Placement:</b> Reels + Stories (vertical only)</div><div><b>Objective:</b> Conversions — optimize for <code>SeekerSignup</code> Pixel event</div>`;

const RECRUITER_TARGETING_NOTES = `<div><b>Geo:</b> Edmonton + 15km (tighter than seeker — owners live close to their venue)</div><div><b>Age:</b> 28–55</div><div><b>Job titles:</b> Restaurant manager, General manager, Owner, F&amp;B manager, Executive chef</div><div><b>Behaviors:</b> Small business owner, Facebook page admin</div><div><b>Interests:</b> Restaurant industry, Hospitality</div><div><b>Placement:</b> Reels + Feed (Stories less effective for this demo)</div><div><b>Objective:</b> Conversions — optimize for <code>RecruiterJobPosted</code> Pixel event</div>`;

const INITIAL_CHECKLIST = [
  { id: uid(), category: "Campaign Setup", text: "Create Meta Business Manager account and connect payment method", done: false },
  { id: uid(), category: "Campaign Setup", text: "Install Meta Pixel on hireabble.com and on both /l/seeker and /l/recruiter landing pages", done: false },
  { id: uid(), category: "Campaign Setup", text: "Create two separate campaigns in Ads Manager: 'Seeker — Edmonton' and 'Recruiter — Edmonton' — never mix audiences", done: false },
  { id: uid(), category: "Campaign Setup", text: "Set up two Pixel Conversion events: SeekerSignup (on signup complete) and RecruiterJobPosted (on first job post)", done: false },
  { id: uid(), category: "Campaign Setup", text: "Configure UTM templates: utm_source=meta&utm_campaign={seeker|recruiter}&utm_content={creative_id}", done: false },
  { id: uid(), category: "Campaign Setup", text: "Create creative naming convention and shared drive folder: S1–S5 (seeker), R1–R5 (recruiter)", done: false },

  { id: uid(), category: "Seeker Campaign — Creative Production", text: "Creative S1 — POV: You've been at this job 14 months (full script in notes)", done: false, notes: S1_NOTES },
  { id: uid(), category: "Seeker Campaign — Creative Production", text: "Creative S2 — Text-on-screen: 23 apps → 2 replies → 1 scam (full script in notes)", done: false, notes: S2_NOTES },
  { id: uid(), category: "Seeker Campaign — Creative Production", text: "Creative S3 — Founder direct-to-camera on Whyte Ave / Ice District (full script in notes)", done: false, notes: S3_NOTES },
  { id: uid(), category: "Seeker Campaign — Creative Production", text: "Creative S4 — How to quietly look for a new restaurant job (full script in notes)", done: false, notes: S4_NOTES },
  { id: uid(), category: "Seeker Campaign — Creative Production", text: "Creative S5 — Money angle: $400/shift vs $180/shift (full script in notes)", done: false, notes: S5_NOTES },

  { id: uid(), category: "Seeker Campaign — Launch & Ops", text: "Build seeker landing page at /l/seeker (full copy in notes)", done: false, notes: SEEKER_LP_NOTES },
  { id: uid(), category: "Seeker Campaign — Launch & Ops", text: "Set seeker audience in Ads Manager (geo / age / interests in notes)", done: false, notes: SEEKER_TARGETING_NOTES },
  { id: uid(), category: "Seeker Campaign — Launch & Ops", text: "Launch 3–4 seeker creatives simultaneously at $10/day each", done: false },
  { id: uid(), category: "Seeker Campaign — Launch & Ops", text: "Review CTR after $40 spent per creative — kill anything under 0.5% CTR", done: false },
  { id: uid(), category: "Seeker Campaign — Launch & Ops", text: "Target CPA $2–5 per signup; alert / pause campaign if CPA > $7 after 50 signups", done: false },

  { id: uid(), category: "Recruiter Campaign — Creative Production", text: "Creative R1 — Closed the bar yourself again? (full script in notes)", done: false, notes: R1_NOTES },
  { id: uid(), category: "Recruiter Campaign — Creative Production", text: "Creative R2 — Direct cost pain: Indeed charges $400/hire + no-shows (full script in notes)", done: false, notes: R2_NOTES },
  { id: uid(), category: "Recruiter Campaign — Creative Production", text: "Creative R3 — How many no-call-no-shows this month? (full script in notes)", done: false, notes: R3_NOTES },
  { id: uid(), category: "Recruiter Campaign — Creative Production", text: "Creative R4 — Social proof (3 Edmonton venues) — BLOCKED until 3+ customers signed (full script in notes)", done: false, notes: R4_NOTES },
  { id: uid(), category: "Recruiter Campaign — Creative Production", text: "Creative R5 — White-glove founder offer: personal setup for first 30–50 (full script in notes)", done: false, notes: R5_NOTES },

  { id: uid(), category: "Recruiter Campaign — Launch & Ops", text: "Build recruiter landing page at /l/recruiter (full copy in notes)", done: false, notes: RECRUITER_LP_NOTES },
  { id: uid(), category: "Recruiter Campaign — Launch & Ops", text: "Set recruiter audience in Ads Manager (geo / age / job titles / behaviors in notes)", done: false, notes: RECRUITER_TARGETING_NOTES },
  { id: uid(), category: "Recruiter Campaign — Launch & Ops", text: "Launch 3–4 recruiter creatives simultaneously at $15/day each (higher LTV justifies higher spend)", done: false },
  { id: uid(), category: "Recruiter Campaign — Launch & Ops", text: "Review CTR after $40 spent per creative — kill anything under 0.5% CTR", done: false },
  { id: uid(), category: "Recruiter Campaign — Launch & Ops", text: "Target CPA $40–120 per first job posted; worth it if average LTV > $200", done: false },

  { id: uid(), category: "Optimization & Iteration", text: "Refresh ALL creative every 2 weeks — Meta ad fatigue is fast", done: false },
  { id: uid(), category: "Optimization & Iteration", text: "NEVER boost posts — always run through Ads Manager (boosted posts are a tax on non-marketers)", done: false },
  { id: uid(), category: "Optimization & Iteration", text: "Weekly review: CPA, CTR, frequency — kill any creative with frequency > 3.5", done: false },
  { id: uid(), category: "Optimization & Iteration", text: "Month 1 retro: document top 2 winners per side, plan batch 2 based on winning angles", done: false },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

// Items verified as complete (one-time auto-check migration) — empty for marketing checklist
const AUTO_COMPLETE_ITEMS = new Set();

export default function AdminMarketingChecklist() {
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
      await axios.put(`${API}/admin/marketing-checklist`, fields, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Silent fail — will retry on next change
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/marketing-checklist`, { headers: { Authorization: `Bearer ${token}` } });
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
          const migrationKey = "marketing_checklist_autocheck_v1";
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
      const res = await axios.post(`${API}/admin/marketing-checklist/upload`, form, {
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
      await axios.delete(`${API}/admin/marketing-checklist/attachment`, {
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
          <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_BRIGHT }}>Marketing Checklist</span>
          <span style={{ fontSize: 12, color: TEXT_DIM, background: "#1A2035", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 10px" }}>
            Meta Ad Campaigns
          </span>
        </div>
        <p style={{ fontSize: 13, color: TEXT_MID, margin: 0 }}>
          Dual-campaign ad ops for Edmonton — seeker side vs. recruiter side. Click any creative to see its full 15-second script, B-roll shot list, and targeting notes.
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
          <textarea value={notes} onChange={e => handleNotesChange(e.target.value)} placeholder={"Freeform notes for ad ops...\n\n• Meta Business Manager connected, billing set\n• Pixel installed on /l/seeker and /l/recruiter\n• Creative batch 1 filmed Saturday — 5 of 5 edits done\n• Week 1 CPA: seeker $X, recruiter $Y"} style={{ width: "100%", minHeight: 260, background: "transparent", border: "none", padding: "20px", color: TEXT_BRIGHT, fontSize: 14, lineHeight: 1.8, resize: "vertical", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
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
