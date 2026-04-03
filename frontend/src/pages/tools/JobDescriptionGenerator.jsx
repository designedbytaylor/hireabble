import { useState } from 'react';
import { ClipboardList, Copy, Check, RefreshCw, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';
import { generateJobDescription } from '../../data/jobDescriptionTemplates';

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Marketing', 'Education', 'Construction', 'Hospitality', 'Manufacturing', 'Other'];
const SENIORITY = [
  { value: 'junior', label: 'Junior / Entry-Level' },
  { value: 'mid', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior / Lead' },
];
const TYPES = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];
const REMOTE = [
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
];

export default function JobDescriptionGenerator() {
  const [inputs, setInputs] = useState({
    title: '', seniority: 'mid', industry: 'Technology', location: '',
    employmentType: 'full-time', companyName: '', remotePolicy: 'onsite',
  });
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));
  const selectClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  const generate = (e) => {
    e.preventDefault();
    setResult(generateJobDescription(inputs));
    setCopied(false);
  };

  const toText = () => {
    if (!result) return '';
    let t = `${result.title}\n${result.company} — ${result.location} (${result.type})\n\n`;
    t += `About\n${result.about}\n\n`;
    t += `Responsibilities\n${result.responsibilities.map(r => `• ${r}`).join('\n')}\n\n`;
    t += `Qualifications\n${result.qualifications.map(q => `• ${q}`).join('\n')}\n\n`;
    t += `Benefits\n${result.benefits.map(b => `• ${b}`).join('\n')}`;
    return t;
  };

  const copy = () => {
    navigator.clipboard.writeText(toText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolLayout title="Job Description Generator" description="Generate structured, professional job postings in seconds.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Job Title</label>
            <input className={selectClass} placeholder="Software Developer" value={inputs.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input className={selectClass} placeholder="Acme Corp" value={inputs.companyName} onChange={e => set('companyName', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Seniority</label>
            <select className={selectClass} value={inputs.seniority} onChange={e => set('seniority', e.target.value)}>
              {SENIORITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Industry</label>
            <select className={selectClass} value={inputs.industry} onChange={e => set('industry', e.target.value)}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input className={selectClass} placeholder="Edmonton, AB" value={inputs.location} onChange={e => set('location', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Employment Type</label>
            <select className={selectClass} value={inputs.employmentType} onChange={e => set('employmentType', e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Work Arrangement</label>
            <select className={selectClass} value={inputs.remotePolicy} onChange={e => set('remotePolicy', e.target.value)}>
              {REMOTE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <Button type="submit" className="w-full">
          <ClipboardList className="w-4 h-4 mr-2" /> Generate Job Description
        </Button>
      </form>

      {result && (
        <div className="mt-6">
          <div className="flex justify-end gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={generate}>
              <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
          </div>
          <div className="glass-card rounded-2xl p-6 printable-area space-y-5">
            <div>
              <h2 className="text-xl font-bold font-['Outfit']">{result.title}</h2>
              <p className="text-sm text-muted-foreground">{result.company} — {result.location} ({result.type})</p>
            </div>
            <div>
              <h3 className="font-semibold font-['Outfit'] mb-2">About the Role</h3>
              <p className="text-sm">{result.about}</p>
            </div>
            <div>
              <h3 className="font-semibold font-['Outfit'] mb-2">Responsibilities</h3>
              <ul className="text-sm space-y-1">
                {result.responsibilities.map((r, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span> {r}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold font-['Outfit'] mb-2">Qualifications</h3>
              <ul className="text-sm space-y-1">
                {result.qualifications.map((q, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span> {q}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold font-['Outfit'] mb-2">Benefits</h3>
              <ul className="text-sm space-y-1">
                {result.benefits.map((b, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span> {b}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
