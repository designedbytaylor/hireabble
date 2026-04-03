import { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const TEMPLATES = [
  ({ role, industry, s1, s2, years }) => `${role} | Helping ${industry} companies grow | ${years}+ years of experience`,
  ({ role, industry, s1, s2, years }) => `${s1} & ${s2} | ${role} with ${years}+ years in ${industry}`,
  ({ role, industry, s1, s2 }) => `${role} | ${s1} | ${s2} | Open to opportunities`,
  ({ role, industry, s1 }) => `Passionate ${role} | ${industry} | ${s1}`,
  ({ role, industry, s1, years }) => `${years}+ years as ${role} | ${s1} specialist | ${industry}`,
  ({ role, s1, s2 }) => `${role} helping teams succeed through ${s1} and ${s2}`,
  ({ role, industry, s1, s2 }) => `${industry} ${role} | ${s1} | ${s2} | Let's connect`,
  ({ role, industry, s1, years }) => `From ${s1} to results | ${role} in ${industry} | ${years}+ yrs exp`,
];

export default function LinkedInHeadline() {
  const [inputs, setInputs] = useState({ role: '', industry: '', strengths: '', yearsExp: '' });
  const [headlines, setHeadlines] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const generate = (e) => {
    e.preventDefault();
    const parts = inputs.strengths.split(',').map(s => s.trim()).filter(Boolean);
    const vars = {
      role: inputs.role || 'Professional',
      industry: inputs.industry || 'Business',
      s1: parts[0] || 'Leadership',
      s2: parts[1] || 'Strategy',
      years: inputs.yearsExp || '5',
    };
    setHeadlines(TEMPLATES.map(fn => fn(vars)));
    setCopiedIdx(null);
  };

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <ToolLayout title="LinkedIn Headline Generator" description="Generate compelling LinkedIn headlines that make your profile stand out to recruiters.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your Role</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. Software Developer" value={inputs.role} onChange={e => set('role', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Industry</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. Technology" value={inputs.industry} onChange={e => set('industry', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Key Strengths (comma-separated)</label>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. Leadership, Problem Solving" value={inputs.strengths} onChange={e => set('strengths', e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Years of Experience</label>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" type="number" min="0" placeholder="e.g. 5" value={inputs.yearsExp} onChange={e => set('yearsExp', e.target.value)} />
        </div>
        <Button type="submit" className="w-full">
          <RefreshCw className="w-4 h-4 mr-2" /> Generate Headlines
        </Button>
      </form>

      {headlines.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3">
          {headlines.map((h, i) => (
            <div key={i} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <p className="text-sm flex-1">{h}</p>
              <button onClick={() => copy(h, i)} className="shrink-0 p-2 rounded-lg hover:bg-primary/10 transition-colors" title="Copy">
                {copiedIdx === i ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </ToolLayout>
  );
}
