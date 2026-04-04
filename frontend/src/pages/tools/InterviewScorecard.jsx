import { useState } from 'react';
import { ClipboardList, Plus, Trash2, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const DEFAULT_COMPETENCIES = [
  { name: 'Technical Skills', weight: 3 },
  { name: 'Communication', weight: 3 },
  { name: 'Problem Solving', weight: 3 },
  { name: 'Culture Fit', weight: 2 },
];

export default function InterviewScorecard() {
  const [inputs, setInputs] = useState({
    jobTitle: '',
    company: '',
    competencies: DEFAULT_COMPETENCIES.map(c => ({ ...c })),
    numInterviewers: 1,
  });
  const [result, setResult] = useState(null);

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const updateCompetency = (index, field, value) => {
    setInputs(p => {
      const updated = [...p.competencies];
      updated[index] = { ...updated[index], [field]: value };
      return { ...p, competencies: updated };
    });
  };

  const addCompetency = () => {
    setInputs(p => ({
      ...p,
      competencies: [...p.competencies, { name: '', weight: 3 }],
    }));
  };

  const removeCompetency = (index) => {
    setInputs(p => ({
      ...p,
      competencies: p.competencies.filter((_, i) => i !== index),
    }));
  };

  const generate = (e) => {
    e.preventDefault();
    const interviewers = Array.from({ length: Number(inputs.numInterviewers) }, (_, i) => i + 1);
    setResult({
      jobTitle: inputs.jobTitle || '[Job Title]',
      company: inputs.company || '[Company]',
      competencies: inputs.competencies.filter(c => c.name.trim()),
      interviewers,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
  };

  const handlePrint = () => window.print();

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <ToolLayout title="Interview Scorecard Generator" description="Generate structured, printable interview scorecards to evaluate candidates consistently.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Job Title</label>
            <input className={inputClass} placeholder="Software Engineer" value={inputs.jobTitle} onChange={e => set('jobTitle', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company</label>
            <input className={inputClass} placeholder="Acme Corp" value={inputs.company} onChange={e => set('company', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Competencies to Assess</label>
          <div className="space-y-2">
            {inputs.competencies.map((comp, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="Competency name"
                  value={comp.name}
                  onChange={e => updateCompetency(i, 'name', e.target.value)}
                  required
                />
                <select
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-28"
                  value={comp.weight}
                  onChange={e => updateCompetency(i, 'weight', Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map(w => (
                    <option key={w} value={w}>Weight: {w}</option>
                  ))}
                </select>
                {inputs.competencies.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCompetency(i)} className="text-red-500 hover:text-red-600 px-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCompetency} className="mt-2 gap-1">
            <Plus className="w-3 h-3" /> Add Competency
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Number of Interviewers</label>
          <select className={inputClass} value={inputs.numInterviewers} onChange={e => set('numInterviewers', e.target.value)}>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n} interviewer{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          <ClipboardList className="w-4 h-4 mr-2" /> Generate Scorecard
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="no-print flex justify-end">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
              <Printer className="w-4 h-4" /> Print Scorecard
            </Button>
          </div>

          {result.interviewers.map((num) => (
            <div key={num} className="glass-card rounded-2xl p-6 printable-area break-after-page">
              <div className="border-b border-border pb-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold font-['Outfit']">{result.company}</h2>
                    <p className="text-muted-foreground text-sm">Interview Scorecard</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.date}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="text-sm font-medium">{result.jobTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Interviewer {result.interviewers.length > 1 ? `#${num}` : ''}</p>
                    <p className="text-sm font-medium border-b border-dashed border-border pb-1">___________________________</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Candidate Name</p>
                    <p className="text-sm font-medium border-b border-dashed border-border pb-1">___________________________</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Interview</p>
                    <p className="text-sm font-medium border-b border-dashed border-border pb-1">___________________________</p>
                  </div>
                </div>
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium">Competency</th>
                    <th className="text-center py-2 font-medium w-16">Weight</th>
                    <th className="text-center py-2 font-medium w-28">Score (1-5)</th>
                    <th className="text-left py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.competencies.map((comp, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-3 font-medium">{comp.name}</td>
                      <td className="py-3 text-center text-muted-foreground">{comp.weight}</td>
                      <td className="py-3">
                        <div className="flex justify-center gap-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} className="w-6 h-6 rounded border border-border flex items-center justify-center text-xs text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="border-b border-dashed border-border/50 min-h-[24px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-muted/20 rounded-lg p-3 mb-6 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Overall Score Formula</p>
                <p>
                  Weighted Score = {result.competencies.map(c => `(${c.name} x ${c.weight})`).join(' + ')} / {result.competencies.reduce((sum, c) => sum + c.weight, 0)}
                </p>
                <p className="mt-1">
                  Maximum possible: 5.0 | Total weight: {result.competencies.reduce((sum, c) => sum + c.weight, 0)}
                </p>
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium mb-2">Additional Comments</p>
                <div className="border border-border/30 rounded-lg p-3 min-h-[80px]" />
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3">Hiring Recommendation</p>
                <div className="flex flex-wrap gap-4">
                  {['Strong Yes', 'Yes', 'Maybe', 'No', 'Strong No'].map(option => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <span className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground text-center no-print">
            Use the print button above or Ctrl+P / Cmd+P to print your scorecards. Each interviewer gets their own page.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
