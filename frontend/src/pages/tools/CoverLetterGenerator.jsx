import { useState } from 'react';
import { PenLine, Copy, Check, RefreshCw, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';
import { generateCoverLetter } from '../../data/coverLetterTemplates';

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual & Friendly' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
];

export default function CoverLetterGenerator() {
  const [inputs, setInputs] = useState({ name: '', title: '', company: '', skills: '', tone: 'professional', highlights: '' });
  const [letter, setLetter] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const generate = (e) => {
    e.preventDefault();
    setLetter(generateCoverLetter(inputs));
    setCopied(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolLayout title="Cover Letter Generator" description="Generate a tailored cover letter for any job application in seconds.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your Name</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Taylor Smith" value={inputs.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tone</label>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={inputs.tone} onChange={e => set('tone', e.target.value)}>
              {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Job Title</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Software Developer" value={inputs.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Acme Corp" value={inputs.company} onChange={e => set('company', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Your Key Skills</label>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. React, project management, team leadership" value={inputs.skills} onChange={e => set('skills', e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Key Highlights / Achievements (optional)</label>
          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="e.g. Led a team of 8 to deliver a $2M project on time..." value={inputs.highlights} onChange={e => set('highlights', e.target.value)} />
        </div>
        <Button type="submit" className="w-full">
          <PenLine className="w-4 h-4 mr-2" /> Generate Cover Letter
        </Button>
      </form>

      {letter && (
        <div className="mt-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex justify-end gap-2 mb-4">
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
            <div className="printable-area whitespace-pre-wrap text-sm leading-relaxed font-['DM_Sans']">
              {letter}
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
