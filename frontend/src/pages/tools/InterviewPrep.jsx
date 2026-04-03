import { useState, useCallback } from 'react';
import { MessageSquare, RefreshCw, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';
import { CATEGORIES, QUESTIONS } from '../../data/interviewQuestions';

function shuffleAndPick(arr, count = 10) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const LS_KEY = 'hireabble-interview-progress';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

function saveProgress(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export default function InterviewPrep() {
  const [category, setCategory] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [practiced, setPracticed] = useState(new Set());

  const startCategory = useCallback((cat) => {
    setCategory(cat);
    setQuestions(shuffleAndPick(QUESTIONS[cat] || [], 10));
    setExpanded(new Set());
    setPracticed(new Set());
  }, []);

  const toggleQuestion = (idx) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
    // Mark as practiced on first expand
    setPracticed(prev => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      // Save to localStorage
      const progress = loadProgress();
      if (!progress[category]) progress[category] = { total: 0, lastDate: '' };
      progress[category].total += 1;
      progress[category].lastDate = new Date().toISOString().split('T')[0];
      saveProgress(progress);
      return next;
    });
  };

  const newSet = () => {
    setQuestions(shuffleAndPick(QUESTIONS[category] || [], 10));
    setExpanded(new Set());
    setPracticed(new Set());
  };

  const progress = loadProgress();
  const practicedCount = practiced.size;

  // Category selection
  if (!category) {
    return (
      <ToolLayout title="Interview Practice" description="Practice with common interview questions by job category. Track your progress over time.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map(cat => {
            const prog = progress[cat.value];
            return (
              <button key={cat.value} onClick={() => startCategory(cat.value)}
                className="glass-card rounded-2xl p-5 text-left hover:border-primary/30 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold font-['Outfit'] group-hover:text-primary transition-colors">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{QUESTIONS[cat.value]?.length || 0} questions</p>
                  </div>
                  {prog && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{prog.total} practiced</span>}
                </div>
              </button>
            );
          })}
        </div>
      </ToolLayout>
    );
  }

  const catLabel = CATEGORIES.find(c => c.value === category)?.label || category;

  return (
    <ToolLayout title={`Interview Practice — ${catLabel}`} description={`Practice ${catLabel.toLowerCase()} interview questions with STAR method tips.`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCategory(null)}>All Categories</Button>
          <span className="text-sm text-muted-foreground">{practicedCount}/10 practiced</span>
        </div>
        <Button variant="outline" size="sm" onClick={newSet}>
          <RefreshCw className="w-3 h-3 mr-1" /> New Set
        </Button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-border/50 rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(practicedCount / 10) * 100}%` }} />
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => {
          const isExpanded = expanded.has(i);
          const isPracticed = practiced.has(i);
          return (
            <div key={i} className={`glass-card rounded-xl overflow-hidden transition-colors ${isPracticed ? 'border-primary/20' : ''}`}>
              <button onClick={() => toggleQuestion(i)} className="w-full text-left p-4 flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground mt-0.5 shrink-0 w-6">
                  {isPracticed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : `${i + 1}.`}
                </span>
                <span className="flex-1 text-sm font-medium">{q.q}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 ml-9">
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                    <p className="text-xs font-medium text-primary mb-1">Tips (STAR Method)</p>
                    <p className="text-sm text-muted-foreground">{q.tips}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {practicedCount === 10 && (
        <div className="mt-6 glass-card rounded-2xl p-6 text-center">
          <MessageSquare className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold font-['Outfit'] text-lg">Great job!</h3>
          <p className="text-sm text-muted-foreground mt-1">You practiced all 10 questions. Try a new set or switch categories to keep improving.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" size="sm" onClick={newSet}>New Set</Button>
            <Button variant="outline" size="sm" onClick={() => setCategory(null)}>Change Category</Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
