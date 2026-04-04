import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, Star, Briefcase, Copy, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const SKILL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'swift',
  'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'rails',
  'html', 'css', 'sass', 'tailwind', 'bootstrap',
  'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd',
  'git', 'github', 'gitlab', 'jira', 'confluence',
  'agile', 'scrum', 'kanban', 'lean',
  'machine learning', 'deep learning', 'ai', 'nlp', 'computer vision',
  'data analysis', 'data science', 'data engineering', 'etl', 'tableau', 'power bi',
  'project management', 'product management', 'stakeholder management',
  'communication', 'leadership', 'teamwork', 'problem solving', 'critical thinking',
  'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
  'rest', 'graphql', 'api', 'microservices', 'soa',
  'linux', 'unix', 'windows', 'macos',
  'security', 'penetration testing', 'encryption', 'oauth',
  'excel', 'powerpoint', 'word', 'google sheets',
  'salesforce', 'hubspot', 'sap', 'oracle',
  'blockchain', 'web3', 'solidity',
  'testing', 'jest', 'cypress', 'selenium', 'qa', 'automation',
  'devops', 'sre', 'monitoring', 'observability',
  'mobile', 'ios', 'android', 'react native', 'flutter',
  'webpack', 'vite', 'babel', 'npm', 'yarn',
  'php', 'laravel', 'wordpress',
  'scala', 'kotlin', 'elixir', 'haskell', 'clojure',
  'r', 'matlab', 'sas', 'spss',
  'accounting', 'finance', 'budgeting', 'forecasting',
  'marketing', 'seo', 'sem', 'content strategy', 'social media',
  'customer service', 'crm', 'support',
  'writing', 'editing', 'copywriting', 'technical writing',
  'negotiation', 'sales', 'business development',
  'recruitment', 'talent acquisition', 'hr',
  'supply chain', 'logistics', 'inventory management',
];

const RED_FLAG_PATTERNS = [
  { pattern: /fast[- ]paced/i, label: 'Fast-paced environment', note: 'May indicate high stress or poor work-life balance' },
  { pattern: /wear many hats/i, label: 'Wear many hats', note: 'Could mean understaffed or poorly defined role' },
  { pattern: /rockstar/i, label: 'Rockstar', note: 'Unrealistic expectations or toxic culture signal' },
  { pattern: /ninja/i, label: 'Ninja', note: 'Unrealistic expectations or toxic culture signal' },
  { pattern: /guru/i, label: 'Guru', note: 'Unrealistic expectations or toxic culture signal' },
  { pattern: /competitive salary(?! range| of \$| between| from)/i, label: 'Competitive salary (no range)', note: 'Salary not disclosed - may be below market' },
  { pattern: /unlimited (pto|paid time off|vacation)/i, label: 'Unlimited PTO', note: 'Often results in employees taking less time off' },
  { pattern: /like a family/i, label: 'We\'re like a family', note: 'May indicate boundary issues or guilt-based culture' },
  { pattern: /hustle/i, label: 'Hustle culture', note: 'May indicate overwork expectations' },
  { pattern: /work hard,? play hard/i, label: 'Work hard, play hard', note: 'Often means long hours with surface-level perks' },
  { pattern: /self[- ]starter/i, label: 'Self-starter', note: 'May mean little onboarding or support' },
  { pattern: /hit the ground running/i, label: 'Hit the ground running', note: 'No training or ramp-up time expected' },
  { pattern: /other duties as assigned/i, label: 'Other duties as assigned', note: 'Scope creep risk' },
];

const CULTURE_PATTERNS = [
  { pattern: /remote/i, label: 'Remote work', positive: true },
  { pattern: /hybrid/i, label: 'Hybrid work', positive: true },
  { pattern: /flexible (hours|schedule|work)/i, label: 'Flexible schedule', positive: true },
  { pattern: /divers(e|ity)/i, label: 'Diversity focus', positive: true },
  { pattern: /inclusi(ve|on)/i, label: 'Inclusion focus', positive: true },
  { pattern: /equity/i, label: 'Equity focus', positive: true },
  { pattern: /growth/i, label: 'Growth opportunities', positive: true },
  { pattern: /mentor(ship|ing)?/i, label: 'Mentorship', positive: true },
  { pattern: /professional development/i, label: 'Professional development', positive: true },
  { pattern: /learning/i, label: 'Learning culture', positive: true },
  { pattern: /work[- ]life balance/i, label: 'Work-life balance', positive: true },
  { pattern: /401k|retirement/i, label: 'Retirement benefits', positive: true },
  { pattern: /health (insurance|benefits|care)/i, label: 'Health benefits', positive: true },
  { pattern: /parental leave/i, label: 'Parental leave', positive: true },
  { pattern: /stock options|equity|rsu/i, label: 'Equity compensation', positive: true },
  { pattern: /collaborative/i, label: 'Collaborative environment', positive: true },
  { pattern: /innovation/i, label: 'Innovation-driven', positive: true },
  { pattern: /transparent/i, label: 'Transparency', positive: true },
];

const SENIORITY_PATTERNS = {
  junior: [/junior/i, /entry[- ]level/i, /associate/i, /0[- ]?[12] years?/i, /graduate/i, /intern/i, /trainee/i],
  mid: [/mid[- ]?level/i, /intermediate/i, /[23][- ]?[45] years?/i, /3\+ years?/i, /4\+ years?/i],
  senior: [/senior/i, /sr\./i, /5\+ years?/i, /[56789] years?/i, /lead/i, /principal/i, /staff/i, /experienced/i],
  lead: [/lead/i, /principal/i, /staff/i, /architect/i, /director/i, /head of/i, /vp/i, /10\+ years?/i, /manager/i],
};

const EXPERIENCE_PATTERNS = [
  /(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s*(?:of\s*)?(?:experience|exp\.?)/i,
  /(\d+)\+?\s*(?:to\s*\d+\s*)?yrs?\s*(?:of\s*)?(?:experience|exp\.?)/i,
  /experience[:\s]*(\d+)\+?\s*years?/i,
  /(junior|entry[- ]level|associate|mid[- ]?level|senior|sr\.|lead|principal|staff|director|vp)/i,
];

function analyzeJobDescription(text) {
  const lowerText = text.toLowerCase();

  // Extract skills
  const foundSkills = {};
  SKILL_KEYWORDS.forEach(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      foundSkills[skill] = matches.length;
    }
  });
  const sortedSkills = Object.entries(foundSkills)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, count]) => ({ skill, count }));

  // Detect experience level
  const expMatches = [];
  EXPERIENCE_PATTERNS.forEach(pattern => {
    const match = text.match(pattern);
    if (match) expMatches.push(match[0]);
  });

  // Red flags
  const redFlags = [];
  RED_FLAG_PATTERNS.forEach(({ pattern, label, note }) => {
    if (pattern.test(text)) {
      redFlags.push({ label, note });
    }
  });

  // Culture signals
  const cultureSignals = [];
  const seenLabels = new Set();
  CULTURE_PATTERNS.forEach(({ pattern, label, positive }) => {
    if (pattern.test(text) && !seenLabels.has(label)) {
      seenLabels.add(label);
      cultureSignals.push({ label, positive });
    }
  });

  // Seniority estimate
  let seniority = 'Mid-Level';
  let seniorityScore = { junior: 0, mid: 0, senior: 0, lead: 0 };
  Object.entries(SENIORITY_PATTERNS).forEach(([level, patterns]) => {
    patterns.forEach(pattern => {
      if (pattern.test(text)) seniorityScore[level]++;
    });
  });
  const maxLevel = Object.entries(seniorityScore).reduce((a, b) => b[1] > a[1] ? b : a, ['mid', 0]);
  if (maxLevel[1] > 0) {
    seniority = { junior: 'Junior', mid: 'Mid-Level', senior: 'Senior', lead: 'Lead / Principal' }[maxLevel[0]];
  }

  return { skills: sortedSkills, experience: expMatches, redFlags, cultureSignals, seniority };
}

export default function JobAnalyzer() {
  const [jobText, setJobText] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const analyze = (e) => {
    e.preventDefault();
    if (jobText.trim().length < 20) return;
    setResult(analyzeJobDescription(jobText));
  };

  const copySkills = () => {
    if (!result) return;
    const text = result.skills.map(s => s.skill).join(', ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolLayout title="Job Description Analyzer" description="Paste a job description to uncover required skills, red flags, and culture signals.">
      <form onSubmit={analyze} className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Paste Job Description</label>
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[200px]"
            placeholder="Paste the full job description here..."
            value={jobText}
            onChange={e => setJobText(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          <Search className="w-4 h-4 mr-2" /> Analyze Job Description
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          {/* Seniority Estimate */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> Estimated Seniority Level
            </h3>
            <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm border border-primary/20">
              {result.seniority}
            </div>
            {result.experience.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Experience mentions found:</p>
                <div className="flex flex-wrap gap-2">
                  {result.experience.map((exp, i) => (
                    <span key={i} className="px-2 py-1 rounded-md bg-background border border-border text-xs">{exp}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold font-['Outfit'] flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" /> Required Skills ({result.skills.length})
              </h3>
              {result.skills.length > 0 && (
                <Button variant="outline" size="sm" onClick={copySkills}>
                  {copied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy All</>}
                </Button>
              )}
            </div>
            {result.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {result.skills.map(({ skill, count }, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20">
                    {skill}{count > 1 ? ` (${count}x)` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specific skill keywords detected. Try pasting a more detailed job description.</p>
            )}
          </div>

          {/* Red Flags */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Red Flags ({result.redFlags.length})
            </h3>
            {result.redFlags.length > 0 ? (
              <div className="space-y-2">
                {result.redFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-400">{flag.label}</p>
                      <p className="text-xs text-muted-foreground">{flag.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-400">No red flags detected. Looks promising!</p>
            )}
          </div>

          {/* Culture Signals */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" /> Culture Signals ({result.cultureSignals.length})
            </h3>
            {result.cultureSignals.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {result.cultureSignals.map((signal, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      signal.positive
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }`}
                  >
                    {signal.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specific culture signals detected in this description.</p>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
