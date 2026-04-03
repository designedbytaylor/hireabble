import { useState } from 'react';
import { FileText, Plus, Trash2, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const EMPTY_EXP = { company: '', title: '', startDate: '', endDate: '', current: false, bullets: [''] };
const EMPTY_EDU = { school: '', degree: '', year: '' };

export default function ResumeBuilder() {
  const [tab, setTab] = useState('contact');
  const [contact, setContact] = useState({ name: '', email: '', phone: '', linkedin: '', location: '' });
  const [summary, setSummary] = useState('');
  const [experience, setExperience] = useState([{ ...EMPTY_EXP }]);
  const [education, setEducation] = useState([{ ...EMPTY_EDU }]);
  const [skills, setSkills] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const TABS = [
    { id: 'contact', label: 'Contact' },
    { id: 'summary', label: 'Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
  ];

  const updateExp = (i, field, val) => {
    const copy = [...experience];
    copy[i] = { ...copy[i], [field]: val };
    setExperience(copy);
  };

  const updateBullet = (expIdx, bulletIdx, val) => {
    const copy = [...experience];
    copy[expIdx].bullets[bulletIdx] = val;
    setExperience(copy);
  };

  const addBullet = (expIdx) => {
    const copy = [...experience];
    copy[expIdx].bullets.push('');
    setExperience(copy);
  };

  const removeBullet = (expIdx, bulletIdx) => {
    const copy = [...experience];
    copy[expIdx].bullets = copy[expIdx].bullets.filter((_, i) => i !== bulletIdx);
    setExperience(copy);
  };

  const updateEdu = (i, field, val) => {
    const copy = [...education];
    copy[i] = { ...copy[i], [field]: val };
    setEducation(copy);
  };

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const skillsList = skills.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <ToolLayout title="Resume Builder" description="Build a professional, ATS-friendly resume in minutes — no signup required.">
      <div className="flex gap-2 mb-4 overflow-x-auto no-print">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-background border border-border hover:bg-accent'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Form sections */}
      <div className="glass-card rounded-2xl p-6 space-y-4 no-print">
        {tab === 'contact' && (
          <>
            <h3 className="font-semibold font-['Outfit']">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Full Name</label><input className={inputClass} placeholder="Taylor Smith" value={contact.name} onChange={e => setContact(p => ({ ...p, name: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input className={inputClass} type="email" placeholder="taylor@email.com" value={contact.email} onChange={e => setContact(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input className={inputClass} placeholder="(780) 555-0123" value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="block text-sm font-medium mb-1">LinkedIn URL</label><input className={inputClass} placeholder="linkedin.com/in/taylorsmith" value={contact.linkedin} onChange={e => setContact(p => ({ ...p, linkedin: e.target.value }))} /></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium mb-1">Location</label><input className={inputClass} placeholder="Edmonton, AB" value={contact.location} onChange={e => setContact(p => ({ ...p, location: e.target.value }))} /></div>
            </div>
          </>
        )}

        {tab === 'summary' && (
          <>
            <h3 className="font-semibold font-['Outfit']">Professional Summary</h3>
            <textarea className={`${inputClass} min-h-[120px]`} placeholder="A brief 2-3 sentence summary of your professional background and career goals..." value={summary} onChange={e => setSummary(e.target.value)} />
          </>
        )}

        {tab === 'experience' && (
          <>
            <h3 className="font-semibold font-['Outfit']">Work Experience</h3>
            {experience.map((exp, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Position {i + 1}</span>
                  {experience.length > 1 && <button onClick={() => setExperience(experience.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Company</label><input className={inputClass} placeholder="Acme Corp" value={exp.company} onChange={e => updateExp(i, 'company', e.target.value)} /></div>
                  <div><label className="block text-xs mb-1">Job Title</label><input className={inputClass} placeholder="Software Developer" value={exp.title} onChange={e => updateExp(i, 'title', e.target.value)} /></div>
                  <div><label className="block text-xs mb-1">Start Date</label><input className={inputClass} placeholder="Jan 2023" value={exp.startDate} onChange={e => updateExp(i, 'startDate', e.target.value)} /></div>
                  <div><label className="block text-xs mb-1">End Date</label><input className={inputClass} placeholder="Present" value={exp.current ? 'Present' : exp.endDate} onChange={e => updateExp(i, 'endDate', e.target.value)} disabled={exp.current} />
                    <label className="flex items-center gap-1 mt-1 text-xs"><input type="checkbox" checked={exp.current} onChange={e => updateExp(i, 'current', e.target.checked)} /> Current position</label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1">Key Achievements</label>
                  {exp.bullets.map((b, bi) => (
                    <div key={bi} className="flex gap-2 mb-1">
                      <input className={`${inputClass} flex-1`} placeholder="e.g. Increased sales by 25% through..." value={b} onChange={e => updateBullet(i, bi, e.target.value)} />
                      {exp.bullets.length > 1 && <button onClick={() => removeBullet(i, bi)} className="text-red-400"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  ))}
                  <button onClick={() => addBullet(i)} className="text-xs text-primary hover:underline mt-1">+ Add bullet point</button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setExperience([...experience, { ...EMPTY_EXP }])}>
              <Plus className="w-3 h-3 mr-1" /> Add Experience
            </Button>
          </>
        )}

        {tab === 'education' && (
          <>
            <h3 className="font-semibold font-['Outfit']">Education</h3>
            {education.map((edu, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Education {i + 1}</span>
                  {education.length > 1 && <button onClick={() => setEducation(education.filter((_, j) => j !== i))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="block text-xs mb-1">School</label><input className={inputClass} placeholder="University of Alberta" value={edu.school} onChange={e => updateEdu(i, 'school', e.target.value)} /></div>
                  <div><label className="block text-xs mb-1">Degree / Program</label><input className={inputClass} placeholder="B.Sc. Computer Science" value={edu.degree} onChange={e => updateEdu(i, 'degree', e.target.value)} /></div>
                  <div><label className="block text-xs mb-1">Year</label><input className={inputClass} placeholder="2023" value={edu.year} onChange={e => updateEdu(i, 'year', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setEducation([...education, { ...EMPTY_EDU }])}>
              <Plus className="w-3 h-3 mr-1" /> Add Education
            </Button>
          </>
        )}

        {tab === 'skills' && (
          <>
            <h3 className="font-semibold font-['Outfit']">Skills</h3>
            <textarea className={`${inputClass} min-h-[100px]`} placeholder="Separate skills with commas: JavaScript, React, Project Management, Communication..." value={skills} onChange={e => setSkills(e.target.value)} />
            {skillsList.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {skillsList.map((s, i) => <span key={i} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">{s}</span>)}
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 pt-2">
          {tab !== 'contact' && <Button variant="outline" onClick={() => setTab(TABS[TABS.findIndex(t => t.id === tab) - 1].id)}>Back</Button>}
          {tab !== 'skills' ? (
            <Button onClick={() => setTab(TABS[TABS.findIndex(t => t.id === tab) + 1].id)} className="flex-1">Next</Button>
          ) : (
            <Button onClick={() => setShowPreview(true)} className="flex-1"><FileText className="w-4 h-4 mr-2" /> Preview Resume</Button>
          )}
        </div>
      </div>

      {/* Live Preview */}
      {showPreview && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3 no-print">
            <h3 className="font-semibold font-['Outfit']">Resume Preview</h3>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-3 h-3 mr-1" /> Print / Save as PDF
            </Button>
          </div>
          <div className="bg-white text-black rounded-xl p-8 printable-area" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {/* Header */}
            <div className="text-center border-b border-gray-300 pb-4 mb-4">
              <h1 className="text-2xl font-bold">{contact.name || 'Your Name'}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {[contact.location, contact.email, contact.phone, contact.linkedin].filter(Boolean).join(' | ')}
              </p>
            </div>

            {/* Summary */}
            {summary && (
              <div className="mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-1 mb-2">Professional Summary</h2>
                <p className="text-sm">{summary}</p>
              </div>
            )}

            {/* Experience */}
            {experience.some(e => e.company || e.title) && (
              <div className="mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-1 mb-2">Experience</h2>
                {experience.filter(e => e.company || e.title).map((exp, i) => (
                  <div key={i} className={i > 0 ? 'mt-3' : ''}>
                    <div className="flex justify-between">
                      <div><span className="font-semibold text-sm">{exp.title}</span>{exp.company && <span className="text-sm"> at {exp.company}</span>}</div>
                      <span className="text-xs text-gray-500">{exp.startDate}{(exp.startDate && (exp.endDate || exp.current)) && ' - '}{exp.current ? 'Present' : exp.endDate}</span>
                    </div>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-0.5">
                      {exp.bullets.filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Education */}
            {education.some(e => e.school || e.degree) && (
              <div className="mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-1 mb-2">Education</h2>
                {education.filter(e => e.school || e.degree).map((edu, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <div><span className="font-semibold">{edu.degree}</span>{edu.school && <span> — {edu.school}</span>}</div>
                    <span className="text-xs text-gray-500">{edu.year}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {skillsList.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider border-b border-gray-200 pb-1 mb-2">Skills</h2>
                <p className="text-sm">{skillsList.join(' • ')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
