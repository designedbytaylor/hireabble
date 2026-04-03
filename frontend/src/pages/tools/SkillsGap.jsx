import { useState } from 'react';
import { GitCompare, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';
import { ROLES_TO_SKILLS, ROLE_NAMES } from '../../data/skillsData';

export default function SkillsGap() {
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [result, setResult] = useState(null);

  const analyze = (e) => {
    e.preventDefault();
    const current = ROLES_TO_SKILLS[currentRole];
    const target = ROLES_TO_SKILLS[targetRole];
    if (!current || !target) return;

    const currentSkills = new Set([...current.required, ...current.nice]);
    const targetRequired = target.required;
    const targetNice = target.nice;
    const allTarget = [...targetRequired, ...targetNice];

    const have = allTarget.filter(s => currentSkills.has(s));
    const needRequired = targetRequired.filter(s => !currentSkills.has(s));
    const needNice = targetNice.filter(s => !currentSkills.has(s));

    const matchPct = Math.round((have.length / allTarget.length) * 100);

    setResult({ have, needRequired, needNice, matchPct, total: allTarget.length });
  };

  const selectClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  // SVG circle progress
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = result ? circumference - (result.matchPct / 100) * circumference : circumference;
  const progressColor = result ? (result.matchPct >= 70 ? '#22c55e' : result.matchPct >= 40 ? '#eab308' : '#ef4444') : '#00BFA6';

  return (
    <ToolLayout title="Skills Gap Analyzer" description="Discover which skills you need to develop to reach your target role.">
      <form onSubmit={analyze} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your Current Role</label>
            <select className={selectClass} value={currentRole} onChange={e => setCurrentRole(e.target.value)} required>
              <option value="">Select role...</option>
              {ROLE_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your Target Role</label>
            <select className={selectClass} value={targetRole} onChange={e => setTargetRole(e.target.value)} required>
              <option value="">Select role...</option>
              {ROLE_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <Button type="submit" className="w-full">
          <GitCompare className="w-4 h-4 mr-2" /> Analyze Gap
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          {/* Match percentage */}
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
            <svg width="150" height="150" className="transform -rotate-90">
              <circle cx="75" cy="75" r={radius} fill="none" stroke="hsl(215, 25%, 15%)" strokeWidth="10" />
              <circle cx="75" cy="75" r={radius} fill="none" stroke={progressColor} strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div className="absolute mt-12 text-center">
              <p className="text-3xl font-bold font-['Outfit']" style={{ color: progressColor }}>{result.matchPct}%</p>
              <p className="text-xs text-muted-foreground">skill match</p>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              You have {result.have.length} of {result.total} skills needed for {targetRole}
            </p>
          </div>

          {/* Skills you have */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" /> Skills You Have ({result.have.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.have.map((s, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-sm border border-green-500/20">{s}</span>
              ))}
              {result.have.length === 0 && <p className="text-sm text-muted-foreground">No overlapping skills found.</p>}
            </div>
          </div>

          {/* Skills to develop */}
          {result.needRequired.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-400" /> Required Skills to Develop ({result.needRequired.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.needRequired.map((s, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-sm border border-orange-500/20">{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.needNice.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold font-['Outfit'] mb-3">Nice-to-Have Skills ({result.needNice.length})</h3>
              <div className="flex flex-wrap gap-2">
                {result.needNice.map((s, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-2">Next Steps</h3>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
              {result.needRequired.length > 0 && <li>Focus on required skills first: <strong className="text-foreground">{result.needRequired.slice(0, 3).join(', ')}</strong></li>}
              <li>Look for online courses on platforms like Coursera, Udemy, or LinkedIn Learning</li>
              <li>Seek mentorship from someone already in the {targetRole} role</li>
              <li>Work on side projects or volunteer to gain hands-on experience</li>
            </ul>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
