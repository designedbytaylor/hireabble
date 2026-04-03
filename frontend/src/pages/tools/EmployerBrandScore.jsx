import { useState } from 'react';
import { Award, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const CATEGORIES = [
  {
    name: 'Online Presence',
    questions: [
      'Do you have a dedicated careers page on your website?',
      'Is your company active on social media with employer branding content?',
      'Do you have a Glassdoor or Indeed employer profile?',
      'Do you feature employee testimonials or stories publicly?',
    ],
  },
  {
    name: 'Candidate Experience',
    questions: [
      'Do you respond to all applicants within 48 hours?',
      'Do candidates receive feedback after interviews?',
      'Is your application process under 5 minutes?',
      'Do you send personalized (not generic) communications?',
    ],
  },
  {
    name: 'Culture & Values',
    questions: [
      'Do you have active DEI (Diversity, Equity, Inclusion) initiatives?',
      'Do you have documented company values visible to candidates?',
      'Do you regularly host team events or culture activities?',
      'Do employees have a voice in company decisions?',
    ],
  },
  {
    name: 'Benefits & Growth',
    questions: [
      'Do you offer competitive compensation benchmarked to market?',
      'Do employees have a professional development or learning budget?',
      'Do you offer flexible or remote work options?',
    ],
  },
];

const ALL_QUESTIONS = CATEGORIES.flatMap((cat, ci) =>
  cat.questions.map((q, qi) => ({ q, category: cat.name, key: `${ci}-${qi}` }))
);

const TIPS = {
  'Online Presence': 'Build a careers page showcasing your culture, team photos, and open roles. Claim your Glassdoor profile and encourage reviews.',
  'Candidate Experience': 'Set up automated acknowledgment emails. Use a structured interview process and always close the loop with candidates.',
  'Culture & Values': 'Document and publish your values. Create employee resource groups and share culture stories on social media.',
  'Benefits & Growth': 'Benchmark salaries annually using market data. Offer at least $500-1000/year in learning stipends. Consider flexible work policies.',
};

export default function EmployerBrandScore() {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const toggle = (key) => setAnswers(p => ({ ...p, [key]: !p[key] }));

  const totalScore = Math.round((Object.values(answers).filter(Boolean).length / ALL_QUESTIONS.length) * 100);

  const categoryScores = CATEGORIES.map(cat => {
    const qs = ALL_QUESTIONS.filter(q => q.category === cat.name);
    const yes = qs.filter(q => answers[q.key]).length;
    return { name: cat.name, score: Math.round((yes / qs.length) * 100), total: qs.length, yes };
  });

  const scoreColor = totalScore >= 71 ? 'text-green-400' : totalScore >= 41 ? 'text-yellow-400' : 'text-red-400';
  const scoreLabel = totalScore >= 71 ? 'Strong' : totalScore >= 41 ? 'Needs Work' : 'Weak';

  return (
    <ToolLayout title="Employer Brand Scorecard" description="Assess your employer brand with a quick 15-question audit and get actionable improvement tips.">
      <div className="glass-card rounded-2xl p-6">
        {CATEGORIES.map((cat, ci) => (
          <div key={ci} className={ci > 0 ? 'mt-6 pt-6 border-t border-border/50' : ''}>
            <h3 className="font-semibold font-['Outfit'] mb-3">{cat.name}</h3>
            <div className="space-y-2">
              {cat.questions.map((q, qi) => {
                const key = `${ci}-${qi}`;
                const isYes = !!answers[key];
                return (
                  <button key={key} onClick={() => toggle(key)} className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${isYes ? 'border-primary/30 bg-primary/5' : 'border-border/50 hover:border-border'}`}>
                    {isYes ? <CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> : <XCircle className="w-5 h-5 text-muted-foreground/40 shrink-0" />}
                    <span className="text-sm">{q}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <Button onClick={() => setSubmitted(true)} className="w-full mt-6">
          <Award className="w-4 h-4 mr-2" /> Get My Score
        </Button>
      </div>

      {submitted && (
        <div className="mt-6 glass-card rounded-2xl p-6">
          <div className="text-center mb-6">
            <p className={`text-6xl font-bold font-['Outfit'] ${scoreColor}`}>{totalScore}</p>
            <p className="text-muted-foreground mt-1">out of 100 — <span className={scoreColor}>{scoreLabel}</span></p>
          </div>

          <div className="space-y-4">
            {categoryScores.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-muted-foreground">{cat.yes}/{cat.total}</span>
                </div>
                <div className="w-full h-2 bg-border/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${cat.score}%` }} />
                </div>
                {cat.score < 75 && (
                  <p className="text-xs text-muted-foreground mt-1">{TIPS[cat.name]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
