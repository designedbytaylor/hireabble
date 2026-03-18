import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TEAL = "#00BFA6";
const CARD_BG = "#111520";
const BORDER = "#1E2535";
const TEXT_DIM = "#5A6380";
const TEXT_MID = "#8B92B0";
const TEXT_BRIGHT = "#E2E6F3";

const TABS = ["Overview", "CRM", "Checklist", "Emails", "Notes"];

const STATUS_OPTIONS = [
  { value: "not_contacted", label: "Not Contacted", color: "#5A6380" },
  { value: "contacted_1", label: "Email 1 Sent", color: "#60A5FA" },
  { value: "contacted_2", label: "Email 2 Sent", color: "#A78BFA" },
  { value: "contacted_3", label: "Email 3 Sent", color: "#F97316" },
  { value: "replied", label: "Replied", color: "#FBBF24" },
  { value: "call_booked", label: "Call Booked", color: "#00BFA6" },
  { value: "onboarded", label: "Onboarded ✓", color: "#22C55E" },
  { value: "not_interested", label: "Not Interested", color: "#EF4444" },
];

const INDUSTRY_OPTIONS = ["Tech","Retail","Healthcare","Construction","Finance","Hospitality","Education","Logistics","Marketing","Legal","Real Estate","Other"];

const CONTACT_GROUPS = [
  { value: "employers", label: "Employers", color: TEAL, icon: "🏢" },
  { value: "outreach", label: "Outreach", color: "#FF6B6B", icon: "🎓" },
];

const INITIAL_CHECKLIST = {
  "Phase 1 — Employer Outreach": [
    { id:"p1_1", text:"Set up SPF, DKIM, DMARC records on hireabble.ca (GoDaddy DNS)", done:false },
    { id:"p1_2", text:"Connect taylor@hireabble.ca to Instantly.ai", done:false },
    { id:"p1_3", text:"Start domain warm-up in Instantly — 3 weeks minimum", done:false },
    { id:"p1_4", text:"Build list of 100 Edmonton employers actively hiring (use Indeed as signal)", done:false },
    { id:"p1_5", text:"Find HR/hiring manager contacts via LinkedIn or Apollo.io free tier", done:false },
    { id:"p1_6", text:"Draft personalized first lines for each prospect using AI", done:false },
    { id:"p1_7", text:"Send Email 1 (Hook) to first batch — 40–50/day max", done:false },
    { id:"p1_8", text:"Send Email 2 (Value) on Day 4 to initial batch", done:false },
    { id:"p1_9", text:"Send Email 3 (Close) on Day 8 to initial batch", done:false },
    { id:"p1_10", text:"Create 'Founding Employer' one-pager / simple agreement", done:false },
    { id:"p1_11", text:"Onboard first 10 employers — get real job postings live", done:false },
    { id:"p1_12", text:"Reach 30 active employer postings before opening to job seekers", done:false },
    { id:"p1_13", text:"Follow up with onboarded employers monthly", done:false },
  ],
  "Phase 2 — Job Seeker Acquisition": [
    { id:"p2_1", text:"Email MacEwan Career Services — request newsletter feature", done:false },
    { id:"p2_2", text:"Email U of A Career Centre", done:false },
    { id:"p2_3", text:"Email NAIT Student Services", done:false },
    { id:"p2_4", text:"Email NorQuest Student Services", done:false },
    { id:"p2_5", text:"Design flyer with QR code and launch hook headline", done:false },
    { id:"p2_6", text:"Print 200–300 flyers at Staples (~$50–100)", done:false },
    { id:"p2_7", text:"Post flyers at MacEwan (SUB, hallways, career services board)", done:false },
    { id:"p2_8", text:"Post flyers at U of A SUB and campus coffee shops", done:false },
    { id:"p2_9", text:"Post flyers at NAIT common areas", done:false },
    { id:"p2_10", text:"Post flyers at Edmonton public libraries", done:false },
    { id:"p2_11", text:"Create @hireabble TikTok/Instagram account", done:false },
    { id:"p2_12", text:"Film first demo video — swipe mechanic hook in first 2 seconds", done:false },
    { id:"p2_13", text:"Post 3 videos/week for 8 weeks", done:false },
    { id:"p2_14", text:"Post in r/Edmonton — founder story angle (not an ad)", done:false },
    { id:"p2_15", text:"Join Tech Edmonton and Startup Edmonton Slack communities", done:false },
    { id:"p2_16", text:"Create hireabble.com/edmonton waitlist landing page", done:false },
  ],
  "Phase 3 — Growth & Retention": [
    { id:"p3_1", text:"Set up Clay.com free account for lead enrichment", done:false },
    { id:"p3_2", text:"Set up Instantly.ai sequences for scaled outreach", done:false },
    { id:"p3_3", text:"Design in-app referral mechanic for job seekers", done:false },
    { id:"p3_4", text:"Design employer referral incentive (extend free Enterprise)", done:false },
    { id:"p3_5", text:"Pitch to Edmonton Journal tech/business reporter", done:false },
    { id:"p3_6", text:"Pitch to CBC Edmonton", done:false },
    { id:"p3_7", text:"Apply for Startup Edmonton program", done:false },
    { id:"p3_8", text:"Submit to EEDC startup spotlight", done:false },
    { id:"p3_9", text:"Launch on Product Hunt (after 100+ active users)", done:false },
    { id:"p3_10", text:"90-day review: hit 50 employers, 500 seekers, 100 matches?", done:false },
    { id:"p3_11", text:"Assess Calgary / Vancouver expansion readiness", done:false },
  ],
};

const EMAIL_TEMPLATES = [
  { id:"emp_1", tag:"Employer", label:"Email 1 — The Hook", subject:"Quick question about your [Role] posting", body:"Hi [First Name],\n\nI noticed [Company] is hiring for [Role] — exactly the kind of position that job seekers on our platform are actively looking for.\n\nI built Hireabble, a swipe-based job matching app launching in Edmonton. Job seekers swipe through roles, employers review matched candidates — it's fast, visual, and cuts out the resume black hole.\n\nWould you be open to a 10-minute call this week to see if it's a fit?\n\nBest,\nTaylor\nFounder, Hireabble\ntaylor@hireabble.com" },
  { id:"emp_2", tag:"Employer", label:"Email 2 — The Value", subject:"Hireabble — founding Edmonton employer offer", body:"Hi [First Name],\n\nFollowing up on my last note. I wanted to share the offer we're extending to our first cohort of Edmonton employers:\n\n1 year of Hireabble Enterprise free — unlimited postings, candidate analytics, and a Founding Partner badge on your profile.\n\nWe're limiting this to 50 Edmonton employers. No obligation, no credit card.\n\nHappy to walk you through it in 10 minutes if you're curious.\n\nBest,\nTaylor\ntaylor@hireabble.com" },
  { id:"emp_3", tag:"Employer", label:"Email 3 — The Close", subject:"Last note — Hireabble", body:"Hi [First Name],\n\nLast email, I promise.\n\nIf the timing isn't right for Hireabble, no worries at all — I'd love to revisit when you're next hiring.\n\nIf you are open to it, I'd just need 10 minutes and a reply to this email.\n\nEither way, best of luck with the [Role] search.\n\nTaylor\nFounder, Hireabble\ntaylor@hireabble.com" },
  { id:"school_1", tag:"University", label:"Career Services Outreach", subject:"Local Edmonton app for your students — partnership opportunity", body:"Hi [Career Services Team / Name],\n\nMy name is Taylor — I'm a former [MacEwan/NAIT/U of A] student and I recently launched Hireabble, a swipe-based job matching app designed for the Edmonton market.\n\nThe app is built specifically for the kind of entry-level and part-time roles your students are looking for. Job seekers build a quick profile, swipe through matched Edmonton employers, and get discovered without submitting a traditional resume.\n\nI'd love to explore whether Hireabble could be featured in your student newsletter, career portal, or resources page. I'm also happy to do a short live demo for your team.\n\nWould you be open to a brief call or email exchange?\n\nThanks so much,\nTaylor\nFounder, Hireabble\ntaylor@hireabble.com" },
  { id:"media_1", tag:"Media", label:"Local Press Pitch", subject:"Edmonton founder builds 'Tinder for jobs' — launching this month", body:"Hi [Reporter Name],\n\nI'm a former MacEwan student who spent the last year building Hireabble — a swipe-based job matching app launching in Edmonton.\n\nThe short version: job seekers swipe on roles, employers swipe on candidates. First mover in the Edmonton market. Free for employers in the founding cohort.\n\nI thought it might be an interesting angle for your tech/business coverage — local founder, local focus, and a concept most people immediately understand.\n\nHappy to do a demo, share early traction numbers, or jump on a call.\n\nBest,\nTaylor\ntaylor@hireabble.com" },
  { id:"reddit_1", tag:"Community", label:"r/Edmonton Post", subject:"I built a job matching app for Edmonton — here's what I learned", body:"Hey r/Edmonton,\n\nI spent the last year building Hireabble — basically Tinder for jobs, built specifically for the Edmonton market.\n\nJob seekers build a short profile and swipe through matched local roles. Employers review candidates who swiped right. No cover letters, no resume black holes.\n\nA few things I learned:\n- Edmonton has an active hiring market not well-served by big national job boards\n- Most job seekers under 30 hate applying through Indeed\n- Employers waste huge time sifting unqualified applicants\n\nWe're in early stages and I'd love feedback. What's broken about your current job search or hiring experience?\n\nApp is free. Employers launching now get 1 year Enterprise free.\n\nAMA.\n\nTaylor" },
];

const EMPTY_CONTACT = { id:"", company:"", contactName:"", title:"", email:"", phone:"", industry:"Other", source:"", status:"not_contacted", linkedIn:"", notes:"", dateAdded:"", lastContact:"", group:"employers", firstLine:"", jobDescription:"" };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AdminMarketing() {
  const { token } = useAdminAuth();
  const [activeTab, setActiveTab] = useState("Overview");
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [emails, setEmails] = useState(EMAIL_TEMPLATES);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [metrics, setMetrics] = useState({ employers:0, seekers:0, matches:0, emailsSent:0 });
  const [metricsEditing, setMetricsEditing] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiTarget, setAiTarget] = useState(null);
  const notesTimer = useRef(null);
  const saveTimer = useRef(null);

  // Save a subset of fields to the API (debounced by caller)
  const saveToApi = useCallback(async (fields) => {
    try {
      await axios.put(`${API}/admin/marketing`, fields, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Silent fail — data will be retried on next change
    }
  }, [token]);

  // Load from API
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/marketing`, { headers: { Authorization: `Bearer ${token}` } });
        const data = res.data;
        if (data.checklist) setChecklist(data.checklist);
        if (data.emails) setEmails(data.emails);
        if (data.notes !== undefined) setNotes(data.notes);
        if (data.metrics) setMetrics(data.metrics);
        if (data.contacts) setContacts(data.contacts);
      } catch {
        // First load — no data yet, use defaults
      }
      setLoaded(true);
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save
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

  // Checklist helpers
  const toggleItem = (group, id) => {
    setChecklist(prev => {
      const updated = { ...prev, [group]: prev[group].map(item => item.id === id ? { ...item, done: !item.done } : item) };
      debouncedSave({ checklist: updated });
      return updated;
    });
  };
  const totalItems = Object.values(checklist).flat().length;
  const doneItems = Object.values(checklist).flat().filter(i => i.done).length;
  const pct = Math.round((doneItems / totalItems) * 100);

  // Checklist mutators
  const addPhase = (name) => {
    if (!name.trim() || checklist[name]) return;
    setChecklist(prev => {
      const updated = { ...prev, [name]: [] };
      debouncedSave({ checklist: updated });
      return updated;
    });
  };
  const renamePhase = (oldName, newName) => {
    if (!newName.trim() || newName === oldName) return;
    setChecklist(prev => {
      const entries = Object.entries(prev);
      const idx = entries.findIndex(([k]) => k === oldName);
      if (idx === -1) return prev;
      entries[idx] = [newName, entries[idx][1]];
      const updated = Object.fromEntries(entries);
      debouncedSave({ checklist: updated });
      return updated;
    });
  };
  const deletePhase = (name) => {
    setChecklist(prev => {
      const next = { ...prev }; delete next[name];
      debouncedSave({ checklist: next });
      return next;
    });
  };
  const addItem = (group, text) => {
    if (!text.trim()) return;
    setChecklist(prev => {
      const updated = { ...prev, [group]: [...prev[group], { id: uid(), text: text.trim(), done: false }] };
      debouncedSave({ checklist: updated });
      return updated;
    });
  };
  const editItem = (group, id, text) => {
    if (!text.trim()) return;
    setChecklist(prev => {
      const updated = { ...prev, [group]: prev[group].map(item => item.id === id ? { ...item, text: text.trim() } : item) };
      debouncedSave({ checklist: updated });
      return updated;
    });
  };
  const deleteItem = (group, id) => {
    setChecklist(prev => {
      const updated = { ...prev, [group]: prev[group].filter(item => item.id !== id) };
      debouncedSave({ checklist: updated });
      return updated;
    });
  };
  const importItems = (group, texts) => {
    if (!texts.length) return;
    setChecklist(prev => {
      const newItems = texts.map(t => ({ id: uid(), text: t.trim(), done: false }));
      const updated = { ...prev, [group]: [...prev[group], ...newItems] };
      debouncedSave({ checklist: updated });
      return updated;
    });
    toast.success(`Imported ${texts.length} tasks`);
  };

  // Email helpers
  const saveEmail = (id, subject, body) => {
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, subject, body } : e);
      debouncedSave({ emails: updated });
      return updated;
    });
    toast.success("Email template saved");
  };

  const generateEmail = async (emailId, customPrompt) => {
    setAiLoading(true); setAiResult(""); setAiTarget(emailId);
    const targetEmail = emails.find(e => e.id === emailId);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:"You are an expert cold email copywriter. Write concise, human, non-spammy emails. Plain text only, under 150 words. Return ONLY the email body, no subject line, no preamble.",
          messages:[{ role:"user", content: customPrompt ? `Rewrite this email based on: "${customPrompt}"\n\nCurrent email:\n${targetEmail?.body||""}` : `Write a cold email for Hireabble (swipe-based job matching app, Edmonton launch). Target audience: ${targetEmail?.label}. Under 120 words.` }]
        })
      });
      const data = await res.json();
      setAiResult(data.content?.map(b=>b.text||"").join("") || "Error generating.");
    } catch { setAiResult("Error connecting to Claude API."); }
    setAiLoading(false);
  };

  // Contact helpers
  const addContact = (c) => {
    setContacts(prev => {
      const updated = [{ ...c, id:uid(), dateAdded:new Date().toLocaleDateString("en-CA") }, ...prev];
      debouncedSave({ contacts: updated });
      return updated;
    });
    toast.success("Contact added");
  };
  const updateContact = (id, updates) => {
    setContacts(prev => {
      const updated = prev.map(c => c.id===id ? {...c,...updates} : c);
      debouncedSave({ contacts: updated });
      return updated;
    });
  };
  const deleteContact = (id) => {
    setContacts(prev => {
      const updated = prev.filter(c => c.id!==id);
      debouncedSave({ contacts: updated });
      return updated;
    });
    toast.success("Contact deleted");
  };
  const bulkAddContacts = (newContacts) => {
    setContacts(prev => {
      const withIds = newContacts.map(c => ({ ...c, id: uid(), dateAdded: new Date().toLocaleDateString("en-CA") }));
      const updated = [...withIds, ...prev];
      debouncedSave({ contacts: updated });
      return updated;
    });
  };

  if (!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:400}}>
      <div style={{color:TEAL,fontSize:14,letterSpacing:2}}>LOADING DASHBOARD…</div>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",color:TEXT_BRIGHT}}>
      {/* TAB BAR */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <h1 style={{fontSize:22,fontWeight:800,color:TEXT_BRIGHT,margin:0}}>Marketing HQ</h1>
        <div style={{display:"flex",gap:3}}>
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{
              background:activeTab===tab?`${TEAL}18`:"none",
              border:activeTab===tab?`1px solid ${TEAL}44`:"1px solid transparent",
              borderRadius:7,padding:"5px 13px",cursor:"pointer",
              color:activeTab===tab?TEAL:TEXT_DIM,
              fontSize:13,fontWeight:activeTab===tab?700:500,transition:"all 0.15s"
            }}>{tab}</button>
          ))}
        </div>
      </div>

      {activeTab==="Overview" && <OverviewTab checklist={checklist} metrics={metrics} setMetrics={setMetrics} metricsEditing={metricsEditing} setMetricsEditing={setMetricsEditing} pct={pct} doneItems={doneItems} totalItems={totalItems} contacts={contacts} saveToApi={saveToApi}/>}
      {activeTab==="CRM" && <CRMTab contacts={contacts} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} onBulkAdd={bulkAddContacts}/>}
      {activeTab==="Checklist" && <ChecklistTab checklist={checklist} toggleItem={toggleItem} doneItems={doneItems} totalItems={totalItems} pct={pct} addPhase={addPhase} renamePhase={renamePhase} deletePhase={deletePhase} addItem={addItem} editItem={editItem} deleteItem={deleteItem} importItems={importItems}/>}
      {activeTab==="Emails" && <EmailsTab emails={emails} editingEmail={editingEmail} setEditingEmail={setEditingEmail} saveEmail={saveEmail} aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} aiLoading={aiLoading} aiResult={aiResult} aiTarget={aiTarget} onGenerate={generateEmail} onApply={()=>{setEmails(prev=>{const updated=prev.map(e=>e.id===aiTarget?{...e,body:aiResult}:e);debouncedSave({emails:updated});return updated;});setAiResult("");setAiTarget(null);setAiPrompt("");}} onDiscardAi={()=>{setAiResult("");setAiTarget(null);}}/>}
      {activeTab==="Notes" && <NotesTab notes={notes} onChange={handleNotesChange} saved={notesSaved}/>}
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function OverviewTab({checklist,metrics,setMetrics,metricsEditing,setMetricsEditing,pct,doneItems,totalItems,contacts,saveToApi}) {
  const employers = contacts.filter(c=>(c.group||"employers")==="employers");
  const outreach = contacts.filter(c=>c.group==="outreach");
  const onboarded = employers.filter(c=>c.status==="onboarded").length;
  const engaged = contacts.filter(c=>["replied","call_booked"].includes(c.status)).length;
  return (
    <div>
      <SectionTitle>Launch Overview</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[{label:"Employers Onboarded",key:"employers",target:50,color:TEAL},{label:"Job Seekers",key:"seekers",target:500,color:"#60A5FA"},{label:"Matches Made",key:"matches",target:100,color:"#A78BFA"},{label:"Emails Sent",key:"emailsSent",target:500,color:"#F97316"}].map(m=>(
          <Card key={m.key}>
            <div style={{fontSize:10,color:TEXT_DIM,textTransform:"uppercase",letterSpacing:1.3,marginBottom:7}}>{m.label}</div>
            {metricsEditing?<input type="number" min="0" value={metrics[m.key]} onChange={e=>setMetrics(p=>({...p,[m.key]:Number(e.target.value)}))} style={{width:"100%",background:"#1A2035",border:`1px solid ${m.color}44`,borderRadius:6,padding:"4px 8px",color:TEXT_BRIGHT,fontSize:22,fontWeight:800,boxSizing:"border-box"}}/>
            :<div style={{fontSize:26,fontWeight:800,color:m.color}}>{metrics[m.key]}</div>}
            <div style={{marginTop:7,background:"#1A2035",borderRadius:99,height:3}}><div style={{height:"100%",width:`${Math.min((metrics[m.key]/m.target)*100,100)}%`,background:m.color,borderRadius:99,transition:"width 0.4s"}}/></div>
            <div style={{fontSize:11,color:TEXT_DIM,marginTop:4}}>Target: {m.target}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:18}}>
        <Btn secondary onClick={()=>{
          if (metricsEditing) { saveToApi({ metrics }); toast.success("Metrics saved"); }
          setMetricsEditing(v=>!v);
        }}>{metricsEditing?"Save Metrics":"Update Metrics"}</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Overall Checklist Progress</div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:TEXT_MID}}>{doneItems}/{totalItems} tasks</span><span style={{color:TEAL,fontWeight:800}}>{pct}%</span></div>
          <div style={{background:"#1A2035",borderRadius:99,height:7}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${TEAL},#60A5FA)`,borderRadius:99,transition:"width 0.5s"}}/></div>
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>CRM Pipeline</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            {[{label:"Employers",val:employers.length,color:TEAL},{label:"Outreach",val:outreach.length,color:"#FF6B6B"},{label:"Engaged",val:engaged,color:"#FBBF24"},{label:"Onboarded",val:onboarded,color:"#22C55E"}].map(s=>(
              <div key={s.label} style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div><div style={{fontSize:11,color:TEXT_DIM}}>{s.label}</div></div>
            ))}
          </div>
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
        {Object.entries(checklist).map(([group,items])=>{
          const done=items.filter(i=>i.done).length;
          const colors={"Phase 1 — Employer Outreach":TEAL,"Phase 2 — Job Seeker Acquisition":"#FF6B6B","Phase 3 — Growth & Retention":"#A78BFA"};
          const c=colors[group]||TEAL;
          return(
            <Card key={group} style={{borderLeft:`3px solid ${c}`}}>
              <div style={{fontSize:10,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{group.split("—")[0].trim()}</div>
              <div style={{fontSize:12,color:TEXT_MID,marginBottom:8}}>{group.split("—")[1]?.trim()}</div>
              <div style={{fontSize:24,fontWeight:800}}>{done}<span style={{fontSize:12,color:TEXT_DIM,fontWeight:500}}>/{items.length}</span></div>
              <div style={{marginTop:7,background:"#1A2035",borderRadius:99,height:3}}><div style={{height:"100%",width:`${Math.round((done/items.length)*100)}%`,background:c,borderRadius:99}}/></div>
            </Card>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {icon:"📧",title:"Cold Email Rules (CASL)",points:["Max 40–50 emails/day from hireabble.ca","Always include opt-out line","Plain text under 100 words beats HTML","3-email sequence over 8 days per prospect","Personalize first line for each contact"]},
          {icon:"🎯",title:"Employer-First Strategy",points:["30–50 postings BEFORE opening to seekers","Use Indeed as signal, find contacts on LinkedIn","Frame offer as 'founding member' not discount","1 year Enterprise free = high perceived value","Signed agreement = commitment & referrals"]},
          {icon:"🎓",title:"University Outreach",points:["MacEwan, U of A, NAIT, NorQuest","Email Career Services directly","Offer 15-min demo — swipe mechanic sells itself","Request newsletter + resources page listing","'Former student' framing, not 'alum'"]},
          {icon:"🎬",title:"Content Strategy",points:["Video skills = your biggest unfair advantage","Show swipe mechanic in first 2 seconds","3x/week TikTok + Reels for 8 weeks","Personal founder account gets more reach","Angles: demo, problem, founder story, tips"]},
        ].map(card=>(
          <Card key={card.title}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:18}}>{card.icon}</span><span style={{fontWeight:700,fontSize:14}}>{card.title}</span></div>
            {card.points.map((p,i)=><div key={i} style={{display:"flex",gap:9,marginBottom:5}}><div style={{width:5,height:5,borderRadius:"50%",background:TEAL,marginTop:6,flexShrink:0}}/><span style={{fontSize:13,color:TEXT_MID,lineHeight:1.6}}>{p}</span></div>)}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── CRM ──────────────────────────────────────────────────────────────────────
function CRMTab({contacts,onAdd,onUpdate,onDelete,onBulkAdd}) {
  const [view,setView]=useState("table");
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [expandedId,setExpandedId]=useState(null);
  const [filterStatus,setFilterStatus]=useState("all");
  const [filterIndustry,setFilterIndustry]=useState("all");
  const [activeGroup,setActiveGroup]=useState("employers");
  const [search,setSearch]=useState("");
  const [form,setForm]=useState({...EMPTY_CONTACT});
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [aiFirstLines,setAiFirstLines]=useState([]); // generated options
  const [aiFirstLineLoading,setAiFirstLineLoading]=useState(false);
  const importRef = useRef(null);

  const groupContacts = contacts.filter(c => (c.group || "employers") === activeGroup);
  const filtered=groupContacts.filter(c=>{
    if(filterStatus!=="all"&&c.status!==filterStatus)return false;
    if(filterIndustry!=="all"&&c.industry!==filterIndustry)return false;
    if(search&&!`${c.company} ${c.contactName} ${c.email}`.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });
  const statusInfo=(val)=>STATUS_OPTIONS.find(s=>s.value===val)||STATUS_OPTIONS[0];
  const openAdd=()=>{setForm({...EMPTY_CONTACT,group:activeGroup});setEditingId(null);setAiFirstLines([]);setShowForm(true);};
  const openEdit=(c)=>{setForm({...c});setEditingId(c.id);setAiFirstLines([]);setShowForm(true);};
  const handleSubmit=()=>{
    if(!form.company.trim())return;
    if(editingId){onUpdate(editingId,form);}else{onAdd(form);}
    setShowForm(false);setEditingId(null);setForm({...EMPTY_CONTACT});
  };
  const kanbanGroups=STATUS_OPTIONS.map(s=>({...s,items:groupContacts.filter(c=>c.status===s.value)}));
  const activeGroupInfo = CONTACT_GROUPS.find(g=>g.value===activeGroup);

  // CSV Export for Instantly.ai
  const exportCSV = () => {
    const rows = filtered.length > 0 ? filtered : groupContacts;
    if (rows.length === 0) { toast.error("No contacts to export"); return; }
    const headers = ["email","first_name","last_name","company_name","phone","personalization","website","linkedin_url","status","industry","source","job_description","notes"];
    const csvRows = [headers.join(",")];
    rows.forEach(c => {
      const nameParts = (c.contactName || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const row = [
        c.email || "",
        firstName,
        lastName,
        c.company || "",
        c.phone || "",
        c.firstLine || "",
        "",
        c.linkedIn || "",
        statusInfo(c.status).label,
        c.industry || "",
        c.source || "",
        (c.jobDescription || "").replace(/[\n\r]+/g, " "),
        (c.notes || "").replace(/[\n\r]+/g, " "),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hireabble-${activeGroup}-contacts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} contacts`);
  };

  // CSV Import
  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV file is empty or has no data rows"); return; }
      // Parse header
      const parseCSVLine = (line) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };
      const headerRow = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ""));
      const colMap = {};
      // Map common CSV header names to our fields
      const fieldAliases = {
        email: ["email","emailaddress","email_address"],
        contactName: ["first_name","firstname","first","name","contact","contactname","contact_name","full_name","fullname"],
        lastName: ["last_name","lastname","last","surname"],
        company: ["company","company_name","companyname","organization","org"],
        phone: ["phone","phonenumber","phone_number","tel","telephone"],
        firstLine: ["personalization","firstline","first_line","personalized","icebreaker","ice_breaker","custom_line"],
        linkedIn: ["linkedin","linkedin_url","linkedinurl","linkedin_profile"],
        title: ["title","jobtitle","job_title","position","role"],
        industry: ["industry","sector","vertical"],
        source: ["source","leadsource","lead_source","origin"],
        notes: ["notes","note","comments","comment"],
        jobDescription: ["job_description","jobdescription","description","job_desc","jobdesc","posting"],
      };
      headerRow.forEach((h, idx) => {
        for (const [field, aliases] of Object.entries(fieldAliases)) {
          if (aliases.includes(h)) { colMap[field] = idx; break; }
        }
      });
      if (colMap.email === undefined && colMap.company === undefined) {
        toast.error("CSV must have at least an 'email' or 'company' column");
        return;
      }
      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        if (vals.every(v => !v.trim())) continue;
        const get = (field) => (colMap[field] !== undefined ? vals[colMap[field]] || "" : "");
        // Combine first_name + last_name if both exist
        let contactName = get("contactName");
        const lastName = get("lastName");
        if (lastName && contactName) contactName = `${contactName} ${lastName}`;
        imported.push({
          company: get("company"),
          contactName,
          email: get("email"),
          phone: get("phone"),
          firstLine: get("firstLine"),
          linkedIn: get("linkedIn"),
          title: get("title"),
          industry: get("industry") || "Other",
          source: get("source"),
          notes: get("notes"),
          jobDescription: get("jobDescription"),
          group: activeGroup,
          status: "not_contacted",
        });
      }
      if (imported.length > 0) {
        onBulkAdd(imported);
        toast.success(`Imported ${imported.length} contacts into ${activeGroupInfo.label}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // AI first line generation
  const generateFirstLines = async () => {
    if (!form.company && !form.jobDescription) { toast.error("Add a company name or job description first"); return; }
    setAiFirstLineLoading(true);
    setAiFirstLines([]);
    const context = [
      form.company && `Company: ${form.company}`,
      form.contactName && `Contact: ${form.contactName}`,
      form.title && `Their title: ${form.title}`,
      form.industry && `Industry: ${form.industry}`,
      form.jobDescription && `Job posting/description:\n${form.jobDescription}`,
    ].filter(Boolean).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: `You generate personalized cold email opening lines for Hireabble, a swipe-based job matching app launching in Edmonton. Generate exactly 4 different first lines, each a different angle. Each line should be 1-2 sentences max, warm but professional, and naturally lead into a pitch. Return ONLY a JSON array of objects with "angle" (2-3 word label) and "line" (the actual text). No markdown, no explanation.`,
          messages: [{ role: "user", content: `Generate 4 personalized cold email first lines for this prospect:\n\n${context}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) setAiFirstLines(parsed);
        else setAiFirstLines([]);
      } catch {
        setAiFirstLines([]);
        toast.error("Failed to parse AI response");
      }
    } catch {
      toast.error("Error connecting to Claude API");
    }
    setAiFirstLineLoading(false);
  };

  return(
    <div>
      {/* Hidden file input for CSV import */}
      <input ref={importRef} type="file" accept=".csv" onChange={handleImportCSV} style={{display:"none"}}/>

      {/* Header with group tabs */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <SectionTitle style={{margin:0}}>Contact CRM <span style={{fontSize:13,color:TEXT_DIM,fontWeight:500,marginLeft:6}}>{contacts.length} total</span></SectionTitle>
        <div style={{display:"flex",gap:8}}>
          <div style={{display:"flex",background:"#0A0C12",border:`1px solid ${BORDER}`,borderRadius:8,overflow:"hidden"}}>
            {["table","kanban"].map(v=><button key={v} onClick={()=>setView(v)} style={{background:view===v?`${TEAL}22`:"none",border:"none",padding:"6px 13px",cursor:"pointer",color:view===v?TEAL:TEXT_DIM,fontSize:12,fontWeight:view===v?700:500}}>
              {v==="table"?"☰ Table":"⬛ Kanban"}
            </button>)}
          </div>
          <Btn secondary onClick={()=>importRef.current?.click()}>📥 Import CSV</Btn>
          <Btn secondary onClick={exportCSV}>📤 Export CSV</Btn>
          <Btn onClick={openAdd}>+ Add Contact</Btn>
        </div>
      </div>

      {/* Group tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {CONTACT_GROUPS.map(g=>{
          const count = contacts.filter(c=>(c.group||"employers")===g.value).length;
          return(
            <button key={g.value} onClick={()=>setActiveGroup(g.value)} style={{
              background:activeGroup===g.value?`${g.color}18`:"#0A0C12",
              border:`1px solid ${activeGroup===g.value?g.color+"55":BORDER}`,
              borderRadius:9,padding:"8px 18px",cursor:"pointer",
              display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"
            }}>
              <span style={{fontSize:15}}>{g.icon}</span>
              <span style={{fontSize:13,fontWeight:activeGroup===g.value?700:500,color:activeGroup===g.value?g.color:TEXT_DIM}}>{g.label}</span>
              <span style={{fontSize:11,fontWeight:700,color:activeGroup===g.value?g.color:TEXT_DIM,background:activeGroup===g.value?`${g.color}22`:"#1A2035",borderRadius:99,padding:"1px 7px"}}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, name, email…" style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:"7px 13px",color:TEXT_BRIGHT,fontSize:13,outline:"none",flex:1,minWidth:180}}/>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:"7px 11px",color:TEXT_MID,fontSize:13,outline:"none"}}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterIndustry} onChange={e=>setFilterIndustry(e.target.value)} style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:"7px 11px",color:TEXT_MID,fontSize:13,outline:"none"}}>
          <option value="all">All Industries</option>
          {INDUSTRY_OPTIONS.map(i=><option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Status pills */}
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {STATUS_OPTIONS.map(s=>{const count=groupContacts.filter(c=>c.status===s.value).length;return count>0?(
          <div key={s.value} onClick={()=>setFilterStatus(filterStatus===s.value?"all":s.value)} style={{background:filterStatus===s.value?`${s.color}22`:CARD_BG,border:`1px solid ${filterStatus===s.value?s.color+"66":BORDER}`,borderRadius:99,padding:"3px 11px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:s.color}}/>
            <span style={{fontSize:11,color:TEXT_MID}}>{s.label}</span>
            <span style={{fontSize:11,fontWeight:700,color:s.color}}>{count}</span>
          </div>
        ):null;})}
      </div>

      {/* TABLE VIEW */}
      {view==="table"&&(
        <div>
          {filtered.length===0?(
            <Card style={{textAlign:"center",padding:"44px 24px",color:TEXT_DIM}}>
              <div style={{fontSize:32,marginBottom:10}}>{activeGroupInfo.icon}</div>
              <div style={{fontSize:14,marginBottom:6}}>No {activeGroupInfo.label.toLowerCase()} contacts yet</div>
              <div style={{fontSize:13,marginBottom:18}}>Add contacts manually or import a CSV file</div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                <Btn onClick={openAdd}>+ Add Contact</Btn>
                <Btn secondary onClick={()=>importRef.current?.click()}>📥 Import CSV</Btn>
              </div>
            </Card>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 2fr 1.1fr 1.1fr 88px",gap:10,padding:"7px 14px",fontSize:10,color:TEXT_DIM,textTransform:"uppercase",letterSpacing:1.2,fontWeight:700}}>
                <span>Company</span><span>Contact</span><span>Email</span><span>Industry</span><span>Status</span><span></span>
              </div>
              {filtered.map(c=>(
                <div key={c.id}>
                  <div onClick={()=>setExpandedId(expandedId===c.id?null:c.id)} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 2fr 1.1fr 1.1fr 88px",gap:10,padding:"11px 14px",background:expandedId===c.id?"#161B28":CARD_BG,border:`1px solid ${expandedId===c.id?TEAL+"44":BORDER}`,borderRadius:expandedId===c.id?"10px 10px 0 0":9,cursor:"pointer",alignItems:"center",transition:"all 0.15s"}}>
                    <div><div style={{fontWeight:700,fontSize:13}}>{c.company}</div>{c.source&&<div style={{fontSize:11,color:TEXT_DIM}}>via {c.source}</div>}</div>
                    <div><div style={{fontSize:13}}>{c.contactName||"—"}</div>{c.title&&<div style={{fontSize:11,color:TEXT_DIM}}>{c.title}</div>}</div>
                    <div style={{fontSize:12,color:TEXT_MID,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.email||"—"}</div>
                    <div style={{fontSize:12,color:TEXT_MID}}>{c.industry}</div>
                    <div>
                      <select value={c.status} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();onUpdate(c.id,{status:e.target.value,lastContact:new Date().toLocaleDateString("en-CA")});}} style={{background:`${statusInfo(c.status).color}18`,border:`1px solid ${statusInfo(c.status).color}55`,borderRadius:6,padding:"3px 5px",color:statusInfo(c.status).color,fontSize:10,fontWeight:700,cursor:"pointer",outline:"none",width:"100%"}}>
                        {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>openEdit(c)} style={{background:"#1A2035",border:"none",borderRadius:6,padding:"5px 9px",cursor:"pointer",color:TEXT_MID,fontSize:11}}>✏️</button>
                      <button onClick={()=>setConfirmDelete(c.id)} style={{background:"#1A2035",border:"none",borderRadius:6,padding:"5px 9px",cursor:"pointer",color:"#EF4444",fontSize:11}}>✕</button>
                    </div>
                  </div>
                  {expandedId===c.id&&(
                    <div style={{background:"#0E1320",border:`1px solid ${TEAL}33`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:"14px 18px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                      <div><Label>Phone</Label><div style={{fontSize:13,color:TEXT_MID}}>{c.phone||"—"}</div></div>
                      <div><Label>LinkedIn</Label>{c.linkedIn?<a href={c.linkedIn} target="_blank" rel="noreferrer" style={{fontSize:13,color:"#60A5FA"}}>View Profile</a>:<div style={{fontSize:13,color:TEXT_DIM}}>—</div>}</div>
                      <div><Label>Date Added</Label><div style={{fontSize:13,color:TEXT_MID}}>{c.dateAdded||"—"}</div></div>
                      <div><Label>Last Contact</Label><div style={{fontSize:13,color:TEXT_MID}}>{c.lastContact||"—"}</div></div>
                      {c.jobDescription&&<div style={{gridColumn:"1 / -1"}}>
                        <Label>Job Description</Label>
                        <div style={{fontSize:12,color:TEXT_MID,background:"#131820",border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 11px",lineHeight:1.6,maxHeight:120,overflowY:"auto",whiteSpace:"pre-wrap"}}>{c.jobDescription}</div>
                      </div>}
                      <div style={{gridColumn:"1 / -1"}}>
                        <Label>Personalized First Line</Label>
                        <textarea defaultValue={c.firstLine||""} onBlur={e=>onUpdate(c.id,{firstLine:e.target.value})} rows={2} style={{width:"100%",background:"#131820",border:`1px solid ${TEAL}33`,borderRadius:8,padding:"9px 11px",color:TEAL,fontSize:13,lineHeight:1.6,resize:"vertical",outline:"none",boxSizing:"border-box",fontStyle:c.firstLine?"normal":"italic"}} placeholder="e.g. I saw you're hiring a Senior Dev — love that your team uses React…"/>
                      </div>
                      <div style={{gridColumn:"1 / -1"}}>
                        <Label>Notes</Label>
                        <textarea defaultValue={c.notes} onBlur={e=>onUpdate(c.id,{notes:e.target.value})} rows={3} style={{width:"100%",background:"#131820",border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 11px",color:TEXT_BRIGHT,fontSize:13,lineHeight:1.6,resize:"vertical",outline:"none",boxSizing:"border-box"}} placeholder="Notes about this contact…"/>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KANBAN VIEW */}
      {view==="kanban"&&(
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:16}}>
          {kanbanGroups.filter(g=>g.items.length>0||["not_contacted","contacted_1","replied","onboarded"].includes(g.value)).map(group=>(
            <div key={group.value} style={{minWidth:210,flex:"0 0 210px"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:group.color}}/>
                <span style={{fontSize:11,fontWeight:700,color:TEXT_MID}}>{group.label}</span>
                <span style={{fontSize:11,color:TEXT_DIM,marginLeft:"auto"}}>{group.items.length}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {group.items.map(c=>(
                  <div key={c.id} style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:9,padding:"11px 13px",cursor:"pointer"}} onClick={()=>openEdit(c)}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{c.company}</div>
                    {c.contactName&&<div style={{fontSize:11,color:TEXT_DIM}}>{c.contactName}</div>}
                    {c.firstLine&&<div style={{fontSize:10,color:TEAL,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}} title={c.firstLine}>✦ {c.firstLine.slice(0,60)}{c.firstLine.length>60?"…":""}</div>}
                    {c.industry&&<div style={{fontSize:10,background:"#1A2035",borderRadius:4,padding:"2px 6px",display:"inline-block",marginTop:5,color:TEXT_DIM}}>{c.industry}</div>}
                  </div>
                ))}
                {group.items.length===0&&<div style={{border:`1px dashed ${BORDER}`,borderRadius:9,padding:"18px 13px",textAlign:"center",fontSize:12,color:TEXT_DIM}}>Empty</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:"#161B28",border:`1px solid ${BORDER}`,borderRadius:14,padding:"26px 30px",maxWidth:320,width:"90%"}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Delete contact?</div>
            <div style={{fontSize:13,color:TEXT_MID,marginBottom:20}}>This cannot be undone.</div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{onDelete(confirmDelete);setConfirmDelete(null);}} style={{background:"#EF4444"}}>Delete</Btn>
              <Btn secondary onClick={()=>setConfirmDelete(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#161B28",border:`1px solid ${BORDER}`,borderRadius:16,padding:"26px 26px 22px",width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:20}}>{editingId?"Edit Contact":"Add New Contact"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {/* Group selector */}
              <div style={{gridColumn:"1 / -1"}}>
                <Label>Contact Group</Label>
                <div style={{display:"flex",gap:8}}>
                  {CONTACT_GROUPS.map(g=>(
                    <button key={g.value} onClick={()=>setForm(p=>({...p,group:g.value}))} style={{
                      flex:1,background:(form.group||"employers")===g.value?`${g.color}18`:"#0D1020",
                      border:`1px solid ${(form.group||"employers")===g.value?g.color+"55":BORDER}`,
                      borderRadius:8,padding:"8px 12px",cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s"
                    }}>
                      <span style={{fontSize:14}}>{g.icon}</span>
                      <span style={{fontSize:13,fontWeight:(form.group||"employers")===g.value?700:500,color:(form.group||"employers")===g.value?g.color:TEXT_DIM}}>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {[
                {label:"Company / Organization *",key:"company",placeholder:"Acme Corp / MacEwan University"},
                {label:"Contact Name",key:"contactName",placeholder:"Jane Smith"},
                {label:"Job Title",key:"title",placeholder:"HR Manager / Career Advisor"},
                {label:"Email",key:"email",placeholder:"jane@acme.com"},
                {label:"Phone",key:"phone",placeholder:"780-555-0000"},
                {label:"Source",key:"source",placeholder:"Indeed, LinkedIn, Apollo, Referral…"},
              ].map(f=>(
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <input value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div style={{gridColumn:"1 / -1"}}>
                <Label>LinkedIn URL</Label>
                <input value={form.linkedIn||""} onChange={e=>setForm(p=>({...p,linkedIn:e.target.value}))} placeholder="https://linkedin.com/in/…" style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <Label>Industry</Label>
                <select value={form.industry} onChange={e=>setForm(p=>({...p,industry:e.target.value}))} style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_MID,fontSize:13,outline:"none"}}>
                  {INDUSTRY_OPTIONS.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_MID,fontSize:13,outline:"none"}}>
                  {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <Label>Job Description <span style={{color:TEXT_DIM,fontWeight:500,textTransform:"none",letterSpacing:0,fontSize:10}}>(paste from Indeed/LinkedIn — used for AI first line generation)</span></Label>
                <textarea value={form.jobDescription||""} onChange={e=>setForm(p=>({...p,jobDescription:e.target.value}))} rows={4} placeholder="Paste the job posting or description here…" style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13,lineHeight:1.6,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{gridColumn:"1 / -1",background:`${TEAL}08`,border:`1px solid ${TEAL}22`,borderRadius:10,padding:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <Label>Personalized First Line <span style={{color:TEAL,fontWeight:500,textTransform:"none",letterSpacing:0,fontSize:10}}>(exported as "personalization" for Instantly.ai)</span></Label>
                  <button onClick={generateFirstLines} disabled={aiFirstLineLoading} style={{background:`${TEAL}22`,border:`1px solid ${TEAL}44`,borderRadius:6,padding:"4px 11px",cursor:aiFirstLineLoading?"not-allowed":"pointer",color:TEAL,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:12}}>✦</span> {aiFirstLineLoading?"Generating…":"Generate with AI"}
                  </button>
                </div>
                <textarea value={form.firstLine||""} onChange={e=>setForm(p=>({...p,firstLine:e.target.value}))} rows={2} placeholder="e.g. I saw you're hiring a Senior Dev — love that your team uses React…" style={{width:"100%",background:"#0D1020",border:`1px solid ${TEAL}33`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box",marginBottom:aiFirstLines.length>0?10:0}}/>
                {aiFirstLines.length>0&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:TEXT_DIM,textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>Pick an angle:</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {aiFirstLines.map((opt,i)=>(
                        <div key={i} onClick={()=>{setForm(p=>({...p,firstLine:opt.line}));setAiFirstLines([]);}} style={{background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"9px 12px",cursor:"pointer",transition:"all 0.15s",display:"flex",gap:10,alignItems:"flex-start"}} onMouseOver={e=>{e.currentTarget.style.borderColor=TEAL+"66";e.currentTarget.style.background=`${TEAL}0A`;}} onMouseOut={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background="#0D1020";}}>
                          <span style={{fontSize:9,fontWeight:700,color:TEAL,background:`${TEAL}22`,borderRadius:4,padding:"2px 6px",flexShrink:0,marginTop:2,textTransform:"uppercase",letterSpacing:0.8}}>{opt.angle}</span>
                          <span style={{fontSize:12.5,color:TEXT_MID,lineHeight:1.5}}>{opt.line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <Label>Notes</Label>
                <textarea value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3} placeholder="Any context about this company or contact…" style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:18}}>
              <Btn onClick={handleSubmit}>{editingId?"Save Changes":"Add Contact"}</Btn>
              <Btn secondary onClick={()=>{setShowForm(false);setEditingId(null);}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CHECKLIST ────────────────────────────────────────────────────────────────
const PHASE_COLORS = ["#00BFA6","#FF6B6B","#A78BFA","#60A5FA","#FBBF24","#F97316","#22C55E","#EC4899"];
function phaseColor(group, index) {
  const fixed = {"Phase 1 — Employer Outreach":"#00BFA6","Phase 2 — Job Seeker Acquisition":"#FF6B6B","Phase 3 — Growth & Retention":"#A78BFA"};
  return fixed[group] || PHASE_COLORS[index % PHASE_COLORS.length];
}

function ChecklistTab({checklist,toggleItem,doneItems,totalItems,pct,addPhase,renamePhase,deletePhase,addItem,editItem,deleteItem,importItems}) {
  const [editMode, setEditMode] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [renamingPhase, setRenamingPhase] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDeletePhase, setConfirmDeletePhase] = useState(null);
  const [addingItemTo, setAddingItemTo] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editItemText, setEditItemText] = useState("");
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [importTarget, setImportTarget] = useState(null);
  const fileInputRef = useRef(null);

  const handleAddPhase = () => { if (!newPhaseName.trim()) return; addPhase(newPhaseName.trim()); setNewPhaseName(""); setShowAddPhase(false); };
  const handleRenamePhase = () => { if (!renameVal.trim()) return; renamePhase(renamingPhase, renameVal.trim()); setRenamingPhase(null); setRenameVal(""); };
  const handleAddItem = (group) => { addItem(group, newItemText); setNewItemText(""); setAddingItemTo(null); };
  const handleEditItem = () => { editItem(editingItem.group, editingItem.id, editItemText); setEditingItem(null); setEditItemText(""); };

  const handleImportClick = (group) => {
    setImportTarget(group);
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !importTarget) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).map(line => {
        // Strip surrounding quotes and trim
        let val = line.trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1).trim();
        }
        return val;
      }).filter(Boolean);
      if (lines.length > 0) importItems(importTarget, lines);
      setImportTarget(null);
    };
    reader.readAsText(file);
  };

  return(
    <div>
      {/* Hidden file input for CSV import */}
      <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileChange} style={{display:"none"}}/>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <SectionTitle style={{margin:0}}>Marketing Checklist</SectionTitle>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,color:TEXT_DIM}}>{doneItems}/{totalItems}</span>
          <div style={{background:"#1A2035",borderRadius:99,height:5,width:90}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${TEAL},#60A5FA)`,borderRadius:99}}/></div>
          <span style={{color:TEAL,fontWeight:700}}>{pct}%</span>
          <button onClick={()=>setEditMode(v=>!v)} style={{background:editMode?`${TEAL}22`:"#1A2035",border:`1px solid ${editMode?TEAL+"66":BORDER}`,borderRadius:7,padding:"5px 13px",cursor:"pointer",color:editMode?TEAL:TEXT_MID,fontSize:12,fontWeight:700,marginLeft:4}}>
            {editMode ? "✓ Done Editing" : "✏️ Edit"}
          </button>
        </div>
      </div>

      {/* Phases */}
      {Object.entries(checklist).map(([group,items], groupIndex)=>{
        const c = phaseColor(group, groupIndex);
        const done = items.filter(i=>i.done).length;
        const isRenamingThis = renamingPhase === group;
        return(
          <div key={group} style={{marginBottom:24}}>
            {/* Phase header */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,flexWrap:"wrap"}}>
              <div style={{width:8,height:8,borderRadius:2,background:c,flexShrink:0}}/>
              {isRenamingThis ? (
                <div style={{display:"flex",alignItems:"center",gap:7,flex:1}}>
                  <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleRenamePhase();if(e.key==="Escape"){setRenamingPhase(null);setRenameVal("");}}} style={{background:"#0D1020",border:`1px solid ${TEAL}66`,borderRadius:7,padding:"4px 10px",color:TEXT_BRIGHT,fontSize:14,fontWeight:700,outline:"none",flex:1,maxWidth:340}}/>
                  <button onClick={handleRenamePhase} style={{background:TEAL,border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700}}>Save</button>
                  <button onClick={()=>{setRenamingPhase(null);setRenameVal("");}} style={{background:"#1A2035",border:`1px solid ${BORDER}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",color:TEXT_DIM,fontSize:12}}>Cancel</button>
                </div>
              ) : (
                <>
                  <span style={{fontWeight:700,fontSize:15}}>{group}</span>
                  <span style={{fontSize:12,color:TEXT_DIM}}>{done}/{items.length}</span>
                  {editMode && (
                    <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
                      <button onClick={()=>handleImportClick(group)} title="Import CSV" style={{background:"#1A2035",border:`1px solid ${BORDER}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",color:"#60A5FA",fontSize:11}}>📥 Import CSV</button>
                      <button onClick={()=>{setRenamingPhase(group);setRenameVal(group);}} title="Rename phase" style={{background:"#1A2035",border:`1px solid ${BORDER}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",color:TEXT_MID,fontSize:11}}>✏️ Rename</button>
                      <button onClick={()=>setConfirmDeletePhase(group)} title="Delete phase" style={{background:"#1A2035",border:`1px solid ${BORDER}`,borderRadius:6,padding:"3px 9px",cursor:"pointer",color:"#EF4444",fontSize:11}}>🗑 Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Items */}
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {items.map(item=>{
                const isEditingThis = editingItem?.group===group && editingItem?.id===item.id;
                return(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,background:item.done?`${c}0A`:CARD_BG,border:`1px solid ${item.done?c+"33":BORDER}`,borderRadius:8,padding:"9px 12px",transition:"all 0.15s"}}>
                    <div onClick={()=>{ if(!isEditingThis) toggleItem(group,item.id); }} style={{width:19,height:19,borderRadius:5,border:`2px solid ${item.done?c:"#2E3550"}`,background:item.done?c:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                      {item.done&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                    </div>
                    {isEditingThis ? (
                      <input autoFocus value={editItemText} onChange={e=>setEditItemText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleEditItem();if(e.key==="Escape"){setEditingItem(null);setEditItemText("");}}} style={{flex:1,background:"#0D1020",border:`1px solid ${TEAL}66`,borderRadius:6,padding:"3px 9px",color:TEXT_BRIGHT,fontSize:13.5,outline:"none"}}/>
                    ) : (
                      <span onClick={()=>{ if(!editMode) toggleItem(group,item.id); }} style={{flex:1,fontSize:13.5,color:item.done?TEXT_DIM:TEXT_BRIGHT,textDecoration:item.done?"line-through":"none",cursor:editMode?"default":"pointer",lineHeight:1.5}}>{item.text}</span>
                    )}
                    {editMode && !isEditingThis && (
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button onClick={()=>{setEditingItem({group,id:item.id});setEditItemText(item.text);}} style={{background:"none",border:"none",cursor:"pointer",color:TEXT_DIM,fontSize:13,padding:"2px 5px"}} title="Edit">✏️</button>
                        <button onClick={()=>setConfirmDeleteItem({group,id:item.id})} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:13,padding:"2px 5px"}} title="Delete">✕</button>
                      </div>
                    )}
                    {isEditingThis && (
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button onClick={handleEditItem} style={{background:TEAL,border:"none",borderRadius:5,padding:"3px 9px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:700}}>Save</button>
                        <button onClick={()=>{setEditingItem(null);setEditItemText("");}} style={{background:"#1A2035",border:`1px solid ${BORDER}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",color:TEXT_DIM,fontSize:11}}>Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add item row */}
              {editMode && (
                addingItemTo === group ? (
                  <div style={{display:"flex",gap:8,alignItems:"center",padding:"6px 2px"}}>
                    <input autoFocus value={newItemText} onChange={e=>setNewItemText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAddItem(group);if(e.key==="Escape"){setAddingItemTo(null);setNewItemText("");}}} placeholder="New task…" style={{flex:1,background:"#0D1020",border:`1px solid ${TEAL}55`,borderRadius:7,padding:"8px 12px",color:TEXT_BRIGHT,fontSize:13,outline:"none"}}/>
                    <button onClick={()=>handleAddItem(group)} style={{background:TEAL,border:"none",borderRadius:7,padding:"8px 14px",cursor:"pointer",color:"#fff",fontSize:13,fontWeight:700}}>Add</button>
                    <button onClick={()=>{setAddingItemTo(null);setNewItemText("");}} style={{background:"#1A2035",border:`1px solid ${BORDER}`,borderRadius:7,padding:"8px 12px",cursor:"pointer",color:TEXT_DIM,fontSize:13}}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={()=>{setAddingItemTo(group);setNewItemText("");}} style={{background:"none",border:`1px dashed ${BORDER}`,borderRadius:8,padding:"8px 13px",cursor:"pointer",color:TEXT_DIM,fontSize:13,textAlign:"left",transition:"all 0.15s"}}>+ Add task</button>
                )
              )}
            </div>
          </div>
        );
      })}

      {/* Add phase section */}
      {editMode && (
        <div style={{marginTop:8}}>
          {showAddPhase ? (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input autoFocus value={newPhaseName} onChange={e=>setNewPhaseName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAddPhase();if(e.key==="Escape"){setShowAddPhase(false);setNewPhaseName("");}}} placeholder="New phase name…" style={{flex:1,background:"#0D1020",border:`1px solid ${TEAL}55`,borderRadius:8,padding:"9px 13px",color:TEXT_BRIGHT,fontSize:14,fontWeight:600,outline:"none",maxWidth:380}}/>
              <Btn onClick={handleAddPhase}>Add Phase</Btn>
              <Btn secondary onClick={()=>{setShowAddPhase(false);setNewPhaseName("");}}>Cancel</Btn>
            </div>
          ) : (
            <button onClick={()=>setShowAddPhase(true)} style={{background:`${TEAL}0D`,border:`1px dashed ${TEAL}55`,borderRadius:10,padding:"12px 20px",cursor:"pointer",color:TEAL,fontSize:13,fontWeight:700,width:"100%",textAlign:"center"}}>+ Add New Phase</button>
          )}
        </div>
      )}

      {/* Confirm delete phase modal */}
      {confirmDeletePhase && (
        <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:"#161B28",border:`1px solid ${BORDER}`,borderRadius:14,padding:"26px 30px",maxWidth:360,width:"90%"}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Delete phase?</div>
            <div style={{fontSize:13,color:TEXT_MID,marginBottom:6}}>This will permanently delete <strong style={{color:TEXT_BRIGHT}}>"{confirmDeletePhase}"</strong> and all its tasks.</div>
            <div style={{fontSize:12,color:"#EF4444",marginBottom:20}}>This cannot be undone.</div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{deletePhase(confirmDeletePhase);setConfirmDeletePhase(null);}} style={{background:"#EF4444"}}>Delete Phase</Btn>
              <Btn secondary onClick={()=>setConfirmDeletePhase(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete item modal */}
      {confirmDeleteItem && (
        <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:"#161B28",border:`1px solid ${BORDER}`,borderRadius:14,padding:"26px 30px",maxWidth:340,width:"90%"}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Delete task?</div>
            <div style={{fontSize:13,color:TEXT_MID,marginBottom:20}}>This cannot be undone.</div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{deleteItem(confirmDeleteItem.group,confirmDeleteItem.id);setConfirmDeleteItem(null);}} style={{background:"#EF4444"}}>Delete Task</Btn>
              <Btn secondary onClick={()=>setConfirmDeleteItem(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMAILS ───────────────────────────────────────────────────────────────────
function EmailsTab({emails,editingEmail,setEditingEmail,saveEmail,aiPrompt,setAiPrompt,aiLoading,aiResult,aiTarget,onGenerate,onApply,onDiscardAi}) {
  return(
    <div>
      <SectionTitle>Email Templates & AI Composer</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"270px 1fr",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {emails.map(e=>(
            <div key={e.id} onClick={()=>setEditingEmail(e.id===editingEmail?null:e.id)} style={{background:editingEmail===e.id?`${TEAL}15`:CARD_BG,border:`1px solid ${editingEmail===e.id?TEAL+"55":BORDER}`,borderRadius:9,padding:"10px 13px",cursor:"pointer",transition:"all 0.15s"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:5}}>
                <span style={{fontSize:13,fontWeight:600}}>{e.label}</span>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"2px 7px",borderRadius:99,flexShrink:0,background:e.tag==="Employer"?`${TEAL}22`:e.tag==="University"?"#60A5FA22":e.tag==="Media"?"#F9731622":"#A78BFA22",color:e.tag==="Employer"?TEAL:e.tag==="University"?"#60A5FA":e.tag==="Media"?"#F97316":"#A78BFA"}}>{e.tag}</span>
              </div>
              <div style={{fontSize:11,color:TEXT_DIM,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.subject}</div>
            </div>
          ))}
        </div>
        <div>
          {editingEmail?<EmailEditor email={emails.find(e=>e.id===editingEmail)} onSave={saveEmail} aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} onGenerate={onGenerate} aiLoading={aiLoading} aiResult={aiTarget===editingEmail?aiResult:""} onApply={onApply} onDiscardAi={onDiscardAi}/>
          :<Card style={{textAlign:"center",padding:"44px 24px",color:TEXT_DIM}}><div style={{fontSize:30,marginBottom:8}}>✉️</div><div style={{fontSize:14}}>Select a template to edit or improve with AI</div></Card>}
        </div>
      </div>
    </div>
  );
}

function EmailEditor({email,onSave,aiPrompt,setAiPrompt,onGenerate,aiLoading,aiResult,onApply,onDiscardAi}) {
  const [subject,setSubject]=useState(email.subject);
  const [body,setBody]=useState(email.body);
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{setSubject(email.subject);setBody(email.body);setDirty(false);},[email.id, email.subject, email.body]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontWeight:700,fontSize:15}}>{email.label}</span>
          {dirty&&<Btn onClick={()=>{onSave(email.id,subject,body);setDirty(false);}}>Save</Btn>}
        </div>
        <Label>Subject</Label>
        <input value={subject} onChange={e=>{setSubject(e.target.value);setDirty(true);}} style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13.5,marginBottom:11,boxSizing:"border-box",outline:"none"}}/>
        <Label>Body</Label>
        <textarea value={body} onChange={e=>{setBody(e.target.value);setDirty(true);}} rows={13} style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"10px 12px",color:TEXT_BRIGHT,fontSize:13,lineHeight:1.75,resize:"vertical",outline:"none",fontFamily:"monospace",boxSizing:"border-box"}}/>
        {dirty&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:9}}><Btn onClick={()=>{onSave(email.id,subject,body);setDirty(false);}}>Save Changes</Btn></div>}
      </Card>
      <Card style={{border:`1px solid ${TEAL}33`}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
          <span style={{fontSize:14,color:TEAL}}>✦</span><span style={{fontWeight:700,fontSize:14,color:TEAL}}>AI Composer</span>
        </div>
        <Label>Instruction (optional)</Label>
        <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="e.g. 'Make it shorter' or 'More casual tone'" style={{width:"100%",background:"#0D1020",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 11px",color:TEXT_BRIGHT,fontSize:13,marginBottom:9,boxSizing:"border-box",outline:"none"}}/>
        <Btn onClick={()=>onGenerate(email.id,aiPrompt)} disabled={aiLoading} style={{width:"100%"}}>{aiLoading?"✦ Generating…":"✦ Generate with Claude"}</Btn>
        {aiResult&&<div style={{marginTop:11}}>
          <Label>AI Draft</Label>
          <div style={{background:"#0D1020",border:`1px solid ${TEAL}44`,borderRadius:8,padding:"11px",fontSize:13,color:TEXT_MID,lineHeight:1.75,whiteSpace:"pre-wrap",fontFamily:"monospace",marginBottom:9}}>{aiResult}</div>
          <div style={{display:"flex",gap:8}}><Btn onClick={onApply}>Apply to Email</Btn><Btn secondary onClick={onDiscardAi}>Discard</Btn></div>
        </div>}
      </Card>
    </div>
  );
}

// ─── NOTES ────────────────────────────────────────────────────────────────────
function NotesTab({notes,onChange,saved}) {
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <SectionTitle style={{margin:0}}>Notes</SectionTitle>
        <span style={{fontSize:12,color:saved?TEAL:TEXT_DIM,transition:"color 0.3s"}}>{saved?"✓ Saved":"Auto-saves as you type"}</span>
      </div>
      <Card style={{padding:0}}>
        <textarea value={notes} onChange={e=>onChange(e.target.value)} placeholder={`Freeform notes — contacts, ideas, follow-ups...\n\n• Called Sarah at Apex Recruiting — follow up Friday\n• MacEwan Career Services replied — demo booked Jan 14\n• Video idea: 'Day in the life of a Hireabble employer'\n• Check Apollo.io for tech companies hiring in Windermere`} style={{width:"100%",minHeight:500,background:"transparent",border:"none",padding:"20px",color:TEXT_BRIGHT,fontSize:14,lineHeight:1.8,resize:"vertical",outline:"none",fontFamily:"monospace",boxSizing:"border-box"}}/>
      </Card>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Card({children,style}){return <div style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:11,padding:"16px",...style}}>{children}</div>;}
function SectionTitle({children,style}){return <h2 style={{margin:"0 0 16px",fontSize:17,fontWeight:800,color:TEXT_BRIGHT,...style}}>{children}</h2>;}
function Label({children}){return <div style={{fontSize:10,fontWeight:700,color:TEXT_DIM,textTransform:"uppercase",letterSpacing:1.3,marginBottom:5}}>{children}</div>;}
function Btn({children,onClick,disabled,secondary,style}){return <button onClick={onClick} disabled={disabled} style={{background:secondary?"transparent":disabled?"#1A2035":`linear-gradient(135deg,${TEAL},#0097A7)`,border:secondary?`1px solid ${BORDER}`:"none",borderRadius:7,padding:"7px 15px",cursor:disabled?"not-allowed":"pointer",color:secondary?TEXT_DIM:disabled?TEXT_DIM:"#fff",fontWeight:700,fontSize:13,transition:"all 0.15s",boxShadow:secondary||disabled?"none":`0 0 12px ${TEAL}44`,whiteSpace:"nowrap",...style}}>{children}</button>;}
