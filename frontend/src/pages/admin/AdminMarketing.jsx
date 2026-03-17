import { useState, useEffect, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TEAL = "#00BFA6";
const CARD_BG = "#111520";
const BORDER = "#1E2535";
const TEXT_DIM = "#5A6380";
const TEXT_MID = "#8B92B0";
const TEXT_BRIGHT = "#E2E6F3";

const TABS = ["Overview", "Checklist", "Emails", "Notes"];

const INITIAL_CHECKLIST = {
  "Phase 1 — Employer Outreach": [
    { id: "p1_1", text: "Set up SPF, DKIM, DMARC records on hireabble.com (Vercel DNS)", done: false },
    { id: "p1_2", text: "Start domain warm-up (Mailwarm or Instantly.ai) — 2–3 weeks", done: false },
    { id: "p1_3", text: "Build list of 100 Edmonton employers actively hiring (use Indeed as signal)", done: false },
    { id: "p1_4", text: "Find HR/hiring manager contacts via LinkedIn or Apollo.io free tier", done: false },
    { id: "p1_5", text: "Draft personalized first lines for each prospect using AI", done: false },
    { id: "p1_6", text: "Send Email 1 (Hook) to first batch — 40–50/day max", done: false },
    { id: "p1_7", text: "Send Email 2 (Value) on Day 4 to initial batch", done: false },
    { id: "p1_8", text: "Send Email 3 (Close) on Day 8 to initial batch", done: false },
    { id: "p1_9", text: "Create 'Founding Employer' one-pager / simple agreement", done: false },
    { id: "p1_10", text: "Onboard first 10 employers — get real job postings live", done: false },
    { id: "p1_11", text: "Reach 30 active employer postings before opening to job seekers", done: false },
    { id: "p1_12", text: "Follow up with onboarded employers monthly", done: false },
  ],
  "Phase 2 — Job Seeker Acquisition": [
    { id: "p2_1", text: "Email MacEwan Career Services — request newsletter feature", done: false },
    { id: "p2_2", text: "Email U of A Career Centre", done: false },
    { id: "p2_3", text: "Email NAIT Student Services", done: false },
    { id: "p2_4", text: "Email NorQuest Student Services", done: false },
    { id: "p2_5", text: "Design flyer with QR code and launch hook headline", done: false },
    { id: "p2_6", text: "Print 200–300 flyers at Staples (~$50–100)", done: false },
    { id: "p2_7", text: "Post flyers at MacEwan (SUB, hallways, career services board)", done: false },
    { id: "p2_8", text: "Post flyers at U of A SUB and campus coffee shops", done: false },
    { id: "p2_9", text: "Post flyers at NAIT common areas", done: false },
    { id: "p2_10", text: "Post flyers at Edmonton public libraries", done: false },
    { id: "p2_11", text: "Create @hireabble TikTok/Instagram account", done: false },
    { id: "p2_12", text: "Film first demo video — 'swipe mechanic' hook in first 2 seconds", done: false },
    { id: "p2_13", text: "Post 3 videos/week for 8 weeks", done: false },
    { id: "p2_14", text: "Post in r/Edmonton — founder story angle (not an ad)", done: false },
    { id: "p2_15", text: "Join Tech Edmonton and Startup Edmonton Slack communities", done: false },
    { id: "p2_16", text: "Create hireabble.com/edmonton waitlist landing page", done: false },
  ],
  "Phase 3 — Growth & Retention": [
    { id: "p3_1", text: "Set up Clay.com free account for lead enrichment", done: false },
    { id: "p3_2", text: "Set up Instantly.ai or Smartlead for sequenced outreach at scale", done: false },
    { id: "p3_3", text: "Build Airtable/Notion CRM to track all employer contacts", done: false },
    { id: "p3_4", text: "Design in-app referral mechanic for job seekers", done: false },
    { id: "p3_5", text: "Design employer referral incentive (extend free Enterprise)", done: false },
    { id: "p3_6", text: "Pitch to Edmonton Journal tech/business reporter", done: false },
    { id: "p3_7", text: "Pitch to CBC Edmonton", done: false },
    { id: "p3_8", text: "Apply for Startup Edmonton program", done: false },
    { id: "p3_9", text: "Submit to EEDC (Explore Edmonton) startup spotlight", done: false },
    { id: "p3_10", text: "Launch on Product Hunt (after 100+ active users)", done: false },
    { id: "p3_11", text: "90-day review: hit 50 employers, 500 seekers, 100 matches?", done: false },
    { id: "p3_12", text: "Assess Calgary / Vancouver expansion readiness", done: false },
  ],
};

const EMAIL_TEMPLATES = [
  {
    id: "emp_1",
    tag: "Employer",
    label: "Email 1 — The Hook",
    subject: "Quick question about your [Role] posting",
    body: `Hi [First Name],

I noticed [Company] is hiring for [Role] — exactly the kind of position that job seekers on our platform are actively looking for.

I built Hireabble, a swipe-based job matching app launching in Edmonton. Job seekers swipe through roles, employers review matched candidates — it's fast, visual, and cuts out the resume black hole.

Would you be open to a 10-minute call this week to see if it's a fit?

Best,
Taylor
Founder, Hireabble
taylor@hireabble.com`,
  },
  {
    id: "emp_2",
    tag: "Employer",
    label: "Email 2 — The Value",
    subject: "Hireabble — founding Edmonton employer offer",
    body: `Hi [First Name],

Following up on my last note. I wanted to share the offer we're extending to our first cohort of Edmonton employers:

1 year of Hireabble Enterprise free — unlimited postings, candidate analytics, and a Founding Partner badge on your profile.

We're limiting this to 50 Edmonton employers. No obligation, no credit card.

Happy to walk you through it in 10 minutes if you're curious.

Best,
Taylor
taylor@hireabble.com`,
  },
  {
    id: "emp_3",
    tag: "Employer",
    label: "Email 3 — The Close",
    subject: "Last note — Hireabble",
    body: `Hi [First Name],

Last email, I promise.

If the timing isn't right for Hireabble, no worries at all — I'd love to revisit when you're next hiring.

If you are open to it, I'd just need 10 minutes and a reply to this email. Happy to set everything up on my end.

Either way, best of luck with the [Role] search.

Taylor
Founder, Hireabble
taylor@hireabble.com`,
  },
  {
    id: "school_1",
    tag: "University",
    label: "Career Services Outreach",
    subject: "Local Edmonton app for your students — partnership opportunity",
    body: `Hi [Career Services Team / Name],

My name is Taylor — I'm a former [MacEwan/NAIT/U of A] student and I recently launched Hireabble, a swipe-based job matching app designed for the Edmonton market.

The app is built specifically for the kind of entry-level and part-time roles your students are looking for. Job seekers build a quick profile, swipe through matched Edmonton employers, and get discovered without submitting a traditional resume.

I'd love to explore whether Hireabble could be featured in your student newsletter, career portal, or resources page. I'm also happy to do a short live demo for your team — the swipe mechanic tends to click immediately.

Would you be open to a brief call or email exchange?

Thanks so much,
Taylor
Founder, Hireabble
taylor@hireabble.com
hireabble.com`,
  },
  {
    id: "media_1",
    tag: "Media",
    label: "Local Press Pitch",
    subject: "Edmonton founder builds 'Tinder for jobs' — launching this month",
    body: `Hi [Reporter Name],

I'm a former MacEwan student who spent the last year building Hireabble — a swipe-based job matching app launching in Edmonton.

The short version: job seekers swipe on roles, employers swipe on candidates. First mover in the Edmonton market. Free for employers in the founding cohort.

I thought it might be an interesting angle for your tech/business coverage — local founder, local focus, and a product concept most people immediately understand.

Happy to do a demo, share early traction numbers, or jump on a call whenever works for you.

Best,
Taylor
taylor@hireabble.com
hireabble.com`,
  },
  {
    id: "reddit_1",
    tag: "Community",
    label: "r/Edmonton Post",
    subject: "I built a job matching app for Edmonton — here's what I learned",
    body: `Hey r/Edmonton,

I spent the last year building Hireabble — basically Tinder for jobs, built specifically for the Edmonton market.

Job seekers build a short profile and swipe through matched local roles. Employers review candidates who swiped right. No cover letters, no resume black holes.

A few things I learned building it:
- Edmonton has a surprisingly active hiring market that isn't well-served by the big national job boards
- Most job seekers under 30 hate applying through Indeed — the experience is broken
- Employers spend huge amounts of time sifting through unqualified applicants

We're in the early stages and I'd genuinely love feedback from Edmonton job seekers and anyone who's hired locally. What's broken about your current job search/hiring experience?

App is free to download. Employers launching now get 1 year Enterprise free.

Happy to answer any questions — AMA.

Taylor`,
  },
];

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AdminMarketing() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [emails, setEmails] = useState(EMAIL_TEMPLATES);
  const [editingEmail, setEditingEmail] = useState(null);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiTarget, setAiTarget] = useState(null);
  const [metrics, setMetrics] = useState({ employers: 0, seekers: 0, matches: 0, emailsSent: 0 });
  const [metricsEditing, setMetricsEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const notesTimer = useRef(null);

  // Load from storage
  useEffect(() => {
    const cl = loadStorage("mkdash_checklist", INITIAL_CHECKLIST);
    const em = loadStorage("mkdash_emails", EMAIL_TEMPLATES);
    const nt = loadStorage("mkdash_notes", "");
    const mt = loadStorage("mkdash_metrics", { employers: 0, seekers: 0, matches: 0, emailsSent: 0 });
    setChecklist(cl);
    setEmails(em);
    setNotes(nt);
    setMetrics(mt);
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => { if (loaded) saveStorage("mkdash_checklist", checklist); }, [checklist, loaded]);
  useEffect(() => { if (loaded) saveStorage("mkdash_emails", emails); }, [emails, loaded]);
  useEffect(() => { if (loaded) saveStorage("mkdash_metrics", metrics); }, [metrics, loaded]);

  // Notes autosave
  const handleNotesChange = (val) => {
    setNotes(val);
    setNotesSaved(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      saveStorage("mkdash_notes", val);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }, 1000);
  };

  // Checklist helpers
  const toggleItem = (group, id) => {
    setChecklist(prev => ({
      ...prev,
      [group]: prev[group].map(item => item.id === id ? { ...item, done: !item.done } : item)
    }));
  };

  const totalItems = Object.values(checklist).flat().length;
  const doneItems = Object.values(checklist).flat().filter(i => i.done).length;
  const pct = Math.round((doneItems / totalItems) * 100);

  // Email helpers
  const saveEmail = (id, subject, body) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, subject, body } : e));
    setEditingEmail(null);
  };

  // AI email generation
  const generateEmail = async (emailId, customPrompt) => {
    setAiLoading(true);
    setAiResult("");
    setAiTarget(emailId);

    const targetEmail = emails.find(e => e.id === emailId);
    const systemPrompt = `You are an expert cold email copywriter for a startup. Write concise, human, non-spammy cold emails. Always plain text, no HTML, no bullet points in the email body itself. Under 150 words unless asked otherwise. Return ONLY the email body text, no subject line, no preamble.`;
    const userMsg = customPrompt
      ? `Rewrite or improve this email based on this instruction: "${customPrompt}"\n\nCurrent email:\n${targetEmail?.body || ""}`
      : `Write a cold outreach email for Hireabble, a swipe-based job matching app launching in Edmonton, Alberta. The target is: ${targetEmail?.label}. Keep it under 120 words, plain text, warm but professional.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "Error generating email.";
      setAiResult(text);
    } catch {
      setAiResult("Error connecting to Claude API.");
    }
    setAiLoading(false);
  };

  const applyAiResult = () => {
    if (!aiTarget || !aiResult) return;
    setEmails(prev => prev.map(e => e.id === aiTarget ? { ...e, body: aiResult } : e));
    setAiResult("");
    setAiTarget(null);
    setAiPrompt("");
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ color: TEAL, fontSize: 14, letterSpacing: 2 }}>LOADING DASHBOARD…</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: TEXT_BRIGHT }}>
      {/* TAB BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT_BRIGHT, margin: 0 }}>Marketing HQ</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? `${TEAL}18` : "none",
              border: activeTab === tab ? `1px solid ${TEAL}44` : "1px solid transparent",
              borderRadius: 8, padding: "6px 16px", cursor: "pointer",
              color: activeTab === tab ? TEAL : TEXT_DIM,
              fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
              transition: "all 0.15s"
            }}>{tab}</button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
      {activeTab === "Overview" && (
        <div>
          <SectionTitle>Launch Overview</SectionTitle>
          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Employers Onboarded", key: "employers", target: 50, color: TEAL },
              { label: "Job Seekers", key: "seekers", target: 500, color: "#60A5FA" },
              { label: "Matches Made", key: "matches", target: 100, color: "#A78BFA" },
              { label: "Emails Sent", key: "emailsSent", target: 500, color: "#F97316" },
            ].map(m => (
              <div key={m.key} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 8 }}>{m.label}</div>
                {metricsEditing ? (
                  <input
                    type="number" min="0"
                    value={metrics[m.key]}
                    onChange={e => setMetrics(prev => ({ ...prev, [m.key]: Number(e.target.value) }))}
                    style={{ width: "100%", background: "#1A2035", border: `1px solid ${m.color}44`, borderRadius: 6, padding: "4px 8px", color: TEXT_BRIGHT, fontSize: 22, fontWeight: 800, boxSizing: "border-box" }}
                  />
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 800, color: m.color }}>{metrics[m.key]}</div>
                )}
                <div style={{ marginTop: 10, background: "#1A2035", borderRadius: 99, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min((metrics[m.key] / m.target) * 100, 100)}%`, background: m.color, borderRadius: 99, transition: "width 0.4s" }} />
                </div>
                <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 5 }}>Target: {m.target}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
            <Btn onClick={() => setMetricsEditing(v => !v)} secondary>{metricsEditing ? "Save Metrics" : "Update Metrics"}</Btn>
          </div>

          {/* Progress Bar */}
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Overall Checklist Progress</span>
              <span style={{ color: TEAL, fontWeight: 800, fontSize: 18 }}>{pct}%</span>
            </div>
            <div style={{ background: "#1A2035", borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${TEAL}, #60A5FA)`, borderRadius: 99, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 8 }}>{doneItems} of {totalItems} tasks complete</div>
          </Card>

          {/* Phase summaries */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {Object.entries(checklist).map(([group, items]) => {
              const done = items.filter(i => i.done).length;
              const colors = { "Phase 1 — Employer Outreach": TEAL, "Phase 2 — Job Seeker Acquisition": "#FF6B6B", "Phase 3 — Growth & Retention": "#A78BFA" };
              const c = colors[group] || TEAL;
              return (
                <Card key={group} style={{ borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: 12, color: c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{group.split("—")[0].trim()}</div>
                  <div style={{ fontSize: 13, color: TEXT_MID, marginBottom: 12 }}>{group.split("—")[1]?.trim()}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: TEXT_BRIGHT }}>{done}<span style={{ fontSize: 14, color: TEXT_DIM, fontWeight: 500 }}>/{items.length}</span></div>
                  <div style={{ fontSize: 12, color: TEXT_DIM }}>tasks complete</div>
                  <div style={{ marginTop: 10, background: "#1A2035", borderRadius: 99, height: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round((done / items.length) * 100)}%`, background: c, borderRadius: 99 }} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Strategy quick ref */}
          <SectionTitle style={{ marginTop: 32 }}>Strategy Quick Reference</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { icon: "📧", title: "Cold Email Rules (CASL)", points: ["Max 40–50 emails/day until domain warmed", "Always include opt-out line (Canadian law)", "Plain text under 100 words beats HTML", "3-email sequence over 8 days per prospect", "Personalize first line for each contact"] },
              { icon: "🎯", title: "Employer-First Strategy", points: ["Get 30–50 postings BEFORE opening to seekers", "Use Indeed as signal, find contacts on LinkedIn", "Frame offer as 'founding member', not discount", "1 year Enterprise free = high perceived value", "Signed agreement = commitment & referrals"] },
              { icon: "🎓", title: "University Outreach", points: ["MacEwan, U of A, NAIT, NorQuest", "Email Career Services directly", "Offer 15-min demo — swipe mechanic sells itself", "Request newsletter + resources page listing", "'Former student' framing, not 'alum' (no degree)"] },
              { icon: "🎬", title: "Content Strategy", points: ["Your video skills = biggest unfair advantage", "Show swipe mechanic in first 2 seconds", "3 posts/week TikTok + Reels for 8 weeks", "Personal founder account gets more reach", "Angles: demo, problem, founder story, tips"] },
            ].map(card => (
              <Card key={card.title}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{card.title}</span>
                </div>
                {card.points.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: TEAL, marginTop: 6, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: TEXT_MID, lineHeight: 1.6 }}>{p}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── CHECKLIST ────────────────────────────────────────────────── */}
      {activeTab === "Checklist" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <SectionTitle style={{ margin: 0 }}>Marketing Checklist</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: TEXT_DIM }}>{doneItems}/{totalItems} complete</span>
              <div style={{ background: "#1A2035", borderRadius: 99, height: 6, width: 120, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${TEAL}, #60A5FA)`, borderRadius: 99 }} />
              </div>
              <span style={{ color: TEAL, fontWeight: 700 }}>{pct}%</span>
            </div>
          </div>
          {Object.entries(checklist).map(([group, items]) => {
            const colors = { "Phase 1 — Employer Outreach": TEAL, "Phase 2 — Job Seeker Acquisition": "#FF6B6B", "Phase 3 — Growth & Retention": "#A78BFA" };
            const c = colors[group] || TEAL;
            const done = items.filter(i => i.done).length;
            return (
              <div key={group} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: TEXT_BRIGHT }}>{group}</span>
                  <span style={{ fontSize: 12, color: TEXT_DIM, marginLeft: 4 }}>{done}/{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(group, item.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        background: item.done ? `${c}0A` : CARD_BG,
                        border: `1px solid ${item.done ? c + "33" : BORDER}`,
                        borderRadius: 10, padding: "12px 16px", cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, border: `2px solid ${item.done ? c : "#2E3550"}`,
                        background: item.done ? c : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "all 0.15s"
                      }}>
                        {item.done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 14, color: item.done ? TEXT_DIM : TEXT_BRIGHT, textDecoration: item.done ? "line-through" : "none", lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── EMAILS ───────────────────────────────────────────────────── */}
      {activeTab === "Emails" && (
        <div>
          <SectionTitle>Email Templates & AI Composer</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
            {/* Email list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {emails.map(e => (
                <div
                  key={e.id}
                  onClick={() => { setEditingEmail(e.id === editingEmail ? null : e.id); setAiResult(""); setAiTarget(null); }}
                  style={{
                    background: editingEmail === e.id ? `${TEAL}15` : CARD_BG,
                    border: `1px solid ${editingEmail === e.id ? TEAL + "55" : BORDER}`,
                    borderRadius: 10, padding: "12px 16px", cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_BRIGHT, lineHeight: 1.4 }}>{e.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                      padding: "2px 8px", borderRadius: 99, flexShrink: 0,
                      background: e.tag === "Employer" ? `${TEAL}22` : e.tag === "University" ? "#60A5FA22" : e.tag === "Media" ? "#F9731622" : "#A78BFA22",
                      color: e.tag === "Employer" ? TEAL : e.tag === "University" ? "#60A5FA" : e.tag === "Media" ? "#F97316" : "#A78BFA",
                    }}>{e.tag}</span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.subject}</div>
                </div>
              ))}
            </div>
            {/* Email editor / viewer */}
            <div>
              {editingEmail ? (
                <EmailEditor
                  email={emails.find(e => e.id === editingEmail)}
                  onSave={saveEmail}
                  aiPrompt={aiPrompt}
                  setAiPrompt={setAiPrompt}
                  onGenerate={generateEmail}
                  aiLoading={aiLoading}
                  aiResult={aiTarget === editingEmail ? aiResult : ""}
                  onApply={applyAiResult}
                  onDiscardAi={() => { setAiResult(""); setAiTarget(null); }}
                />
              ) : (
                <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, color: TEXT_DIM }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
                  <div style={{ fontSize: 14 }}>Select a template to view, edit, or improve with AI</div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── NOTES ────────────────────────────────────────────────────── */}
      {activeTab === "Notes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <SectionTitle style={{ margin: 0 }}>Marketing Notes</SectionTitle>
            <span style={{ fontSize: 12, color: notesSaved ? TEAL : TEXT_DIM, transition: "color 0.3s" }}>
              {notesSaved ? "✓ Saved" : "Auto-saves as you type"}
            </span>
          </div>
          <Card style={{ padding: 0 }}>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder={`Use this space for anything — contacts, ideas, follow-up reminders, observations...\n\nExamples:\n• Called Sarah at Apex Recruiting — interested, follow up Friday\n• MacEwan Career Services replied — they want a demo in January\n• Video idea: 'Day in the life of a Hireabble employer'\n• Check Apollo.io for tech companies hiring in Windermere`}
              style={{
                width: "100%", minHeight: 520, background: "transparent", border: "none",
                padding: "24px", color: TEXT_BRIGHT, fontSize: 14.5, lineHeight: 1.8,
                resize: "vertical", outline: "none", fontFamily: "'DM Mono', 'Fira Code', monospace",
                boxSizing: "border-box"
              }}
            />
          </Card>
          <div style={{ marginTop: 16, fontSize: 12, color: TEXT_DIM }}>
            Notes are saved to your browser and will persist across sessions.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMAIL EDITOR COMPONENT ───────────────────────────────────────────────────
function EmailEditor({ email, onSave, aiPrompt, setAiPrompt, onGenerate, aiLoading, aiResult, onApply, onDiscardAi }) {
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSubject(email.subject);
    setBody(email.body);
    setDirty(false);
  }, [email.id, email.subject, email.body]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{email.label}</span>
          {dirty && <Btn onClick={() => { onSave(email.id, subject, body); setDirty(false); }}>Save Changes</Btn>}
        </div>
        <Label>Subject Line</Label>
        <input
          value={subject}
          onChange={e => { setSubject(e.target.value); setDirty(true); }}
          style={{ width: "100%", background: "#0D1020", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", color: TEXT_BRIGHT, fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" }}
        />
        <Label>Email Body</Label>
        <textarea
          value={body}
          onChange={e => { setBody(e.target.value); setDirty(true); }}
          rows={14}
          style={{ width: "100%", background: "#0D1020", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", color: TEXT_BRIGHT, fontSize: 13.5, lineHeight: 1.75, resize: "vertical", outline: "none", fontFamily: "'DM Mono', monospace", boxSizing: "border-box" }}
        />
        {dirty && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <Btn onClick={() => { onSave(email.id, subject, body); setDirty(false); }}>Save Changes</Btn>
          </div>
        )}
      </Card>
      {/* AI Composer */}
      <Card style={{ border: `1px solid ${TEAL}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 22, height: 22, background: `${TEAL}22`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: TEAL }}>AI Email Composer</span>
        </div>
        <Label>Instruction (optional — leave blank to regenerate from scratch)</Label>
        <input
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="e.g. 'Make it shorter and more casual' or 'Add a specific mention of tech companies in Edmonton'"
          style={{ width: "100%", background: "#0D1020", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", color: TEXT_BRIGHT, fontSize: 13.5, marginBottom: 12, boxSizing: "border-box", outline: "none" }}
        />
        <Btn onClick={() => onGenerate(email.id, aiPrompt)} disabled={aiLoading} style={{ width: "100%" }}>
          {aiLoading ? "✦ Generating…" : "✦ Generate with Claude"}
        </Btn>
        {aiResult && (
          <div style={{ marginTop: 14 }}>
            <Label>AI Draft</Label>
            <div style={{ background: "#0D1020", border: `1px solid ${TEAL}44`, borderRadius: 8, padding: "14px", fontSize: 13.5, color: TEXT_MID, lineHeight: 1.75, whiteSpace: "pre-wrap", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>
              {aiResult}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={() => { onApply(); setBody(aiResult); setDirty(true); }}>Apply to Email</Btn>
              <Btn secondary onClick={onDiscardAi}>Discard</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── SMALL HELPERS ────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: TEXT_BRIGHT, ...style }}>{children}</h2>;
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 6 }}>{children}</div>;
}

function Btn({ children, onClick, disabled, secondary, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: secondary ? "transparent" : disabled ? "#1A2035" : `linear-gradient(135deg, ${TEAL}, #0097A7)`,
        border: secondary ? `1px solid ${BORDER}` : "none",
        borderRadius: 8, padding: "9px 18px", cursor: disabled ? "not-allowed" : "pointer",
        color: secondary ? TEXT_DIM : disabled ? TEXT_DIM : "#fff",
        fontWeight: 700, fontSize: 13, transition: "all 0.15s",
        boxShadow: secondary || disabled ? "none" : `0 0 16px ${TEAL}44`,
        ...style
      }}
    >{children}</button>
  );
}
