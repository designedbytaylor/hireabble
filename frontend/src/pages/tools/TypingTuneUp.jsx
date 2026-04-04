import { useState, useRef, useEffect, useCallback } from 'react';
import { Keyboard, RotateCcw, ChevronRight, Trophy, Timer, Target, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const PASSAGES = {
  easy: [
    'The quick brown fox jumps over the lazy dog near the old oak tree in the park.',
    'I like to work with a good team and learn new things every single day at the office.',
    'Please send me the report by noon so I can review it before the meeting today.',
    'We need to find a better way to solve this problem and move forward with the plan.',
    'The new hire started on Monday and has already made a great first impression on the team.',
  ],
  medium: [
    'Dear Hiring Manager, I am writing to express my interest in the Senior Developer position at your company. My experience in full-stack development makes me a strong candidate.',
    'Following up on our conversation yesterday, I have attached the quarterly performance review along with my recommendations for the upcoming fiscal year.',
    'The project timeline has been adjusted to accommodate the new requirements from the stakeholder meeting. Please review the updated milestones and confirm your availability.',
    'I would appreciate the opportunity to discuss how my background in data analysis and strategic planning could contribute to your organization\'s continued growth.',
    'Our team successfully delivered the product launch on schedule, resulting in a 25% increase in user engagement during the first quarter of this year.',
  ],
  hard: [
    'The API endpoint at /api/v2/users/{id}/settings returns a 403 Forbidden response when the OAuth2 bearer token has expired (TTL: 3600s). Implement a refresh_token flow.',
    'SELECT u.name, COUNT(a.id) AS total_apps FROM users u LEFT JOIN applications a ON u.id = a.user_id WHERE a.status != \'rejected\' GROUP BY u.id HAVING total_apps >= 5;',
    'Refactoring the CI/CD pipeline: migrate from Jenkins (Groovy DSL) to GitHub Actions with matrix builds for Node.js v18/v20, Docker multi-stage builds, and Terraform IaC.',
    'The microservices architecture uses gRPC (Protocol Buffers v3) for inter-service communication, with Kubernetes-managed pods auto-scaling at 70% CPU utilization threshold.',
    'Bug #4821: Race condition in useEffect() cleanup when component unmounts during async setState() call. Fix: use AbortController + isMounted ref pattern with TypeScript generics.',
  ],
};

const DIFFICULTY_LABELS = {
  easy: { label: 'Easy', desc: 'Common words', color: 'text-green-500' },
  medium: { label: 'Medium', desc: 'Professional writing', color: 'text-yellow-500' },
  hard: { label: 'Hard', desc: 'Technical jargon', color: 'text-red-500' },
};

const LS_KEY = 'hireabble-typing-best';

function loadBest() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

function saveBest(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export default function TypingTuneUp() {
  const [difficulty, setDifficulty] = useState('medium');
  const [passageIndex, setPassageIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const passage = PASSAGES[difficulty][passageIndex];
  const best = loadBest();

  const resetState = useCallback(() => {
    setCurrentText('');
    setStarted(false);
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setErrors(0);
    setElapsed(0);
    setFinished(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    resetState();
  }, [difficulty, passageIndex, resetState]);

  const startTimer = useCallback(() => {
    const now = Date.now();
    setStartTime(now);
    setStarted(true);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - now);
    }, 200);
  }, []);

  const finishTest = useCallback((typed, errorCount) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalElapsed = Date.now() - startTime;
    setElapsed(finalElapsed);
    setFinished(true);

    const minutes = finalElapsed / 60000;
    const finalWpm = minutes > 0 ? Math.round((typed.length / 5) / minutes) : 0;
    const finalAccuracy = typed.length > 0 ? Math.round(((typed.length - errorCount) / typed.length) * 100) : 100;
    setWpm(finalWpm);
    setAccuracy(Math.max(0, finalAccuracy));

    // Save best
    const saved = loadBest();
    if (!saved[difficulty] || finalWpm > saved[difficulty]) {
      saved[difficulty] = finalWpm;
      saveBest(saved);
    }
  }, [startTime, difficulty]);

  const handleInput = useCallback((e) => {
    const typed = e.target.value;
    if (finished) return;

    if (!started && typed.length > 0) {
      startTimer();
    }

    setCurrentText(typed);

    // Count errors
    let errorCount = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] !== passage[i]) errorCount++;
    }
    setErrors(errorCount);

    // Live WPM
    if (startTime) {
      const mins = (Date.now() - startTime) / 60000;
      if (mins > 0) setWpm(Math.round((typed.length / 5) / mins));
      const acc = typed.length > 0 ? Math.round(((typed.length - errorCount) / typed.length) * 100) : 100;
      setAccuracy(Math.max(0, acc));
    }

    // Check completion
    if (typed.length >= passage.length) {
      finishTest(typed, errorCount);
    }
  }, [started, finished, passage, startTime, startTimer, finishTest]);

  const tryAgain = () => {
    resetState();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const nextPassage = () => {
    const nextIdx = (passageIndex + 1) % PASSAGES[difficulty].length;
    setPassageIndex(nextIdx);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <ToolLayout title="Typing Tune-Up" description="Practice your typing speed and accuracy with job-sector themed passages.">
      {/* Difficulty selector */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Difficulty Level</label>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(DIFFICULTY_LABELS).map(([key, { label, desc, color }]) => (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                difficulty === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <span className={`font-medium ${difficulty === key ? 'text-primary' : color}`}>{label}</span>
              <span className="block text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
        {best[difficulty] && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-500" /> Personal best: {best[difficulty]} WPM
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass-card rounded-xl p-3 text-center">
          <Keyboard className="w-4 h-4 mx-auto mb-1 text-primary" />
          <p className="text-xl font-bold font-['Outfit']">{wpm}</p>
          <p className="text-xs text-muted-foreground">WPM</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <Target className="w-4 h-4 mx-auto mb-1 text-primary" />
          <p className="text-xl font-bold font-['Outfit']">{accuracy}%</p>
          <p className="text-xs text-muted-foreground">Accuracy</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <Timer className="w-4 h-4 mx-auto mb-1 text-primary" />
          <p className="text-xl font-bold font-['Outfit']">{formatTime(elapsed)}</p>
          <p className="text-xs text-muted-foreground">Time</p>
        </div>
      </div>

      {/* Passage display */}
      <div
        className="glass-card rounded-2xl p-6 mb-4 cursor-text select-none"
        onClick={focusInput}
      >
        <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
          {!started && !finished && 'Start typing to begin...'}
          {started && !finished && 'Keep going!'}
          {finished && 'Finished!'}
        </p>
        <div className="font-mono text-base leading-relaxed tracking-wide">
          {passage.split('').map((char, i) => {
            let className = 'text-muted-foreground/40';
            if (i < currentText.length) {
              className = currentText[i] === char ? 'text-green-500' : 'text-red-500 bg-red-500/10';
            } else if (i === currentText.length) {
              className = 'text-foreground bg-primary/20 border-b-2 border-primary';
            }
            return (
              <span key={i} className={className}>
                {char}
              </span>
            );
          })}
        </div>
        {/* Hidden input */}
        <input
          ref={inputRef}
          type="text"
          value={currentText}
          onChange={handleInput}
          disabled={finished}
          className="opacity-0 absolute -z-10 h-0 w-0"
          autoFocus
          aria-label="Type the passage here"
        />
      </div>

      {/* Error indicator */}
      {errors > 0 && !finished && (
        <div className="flex items-center gap-1 text-sm text-red-500 mb-4">
          <AlertTriangle className="w-3 h-3" /> {errors} error{errors !== 1 ? 's' : ''}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 bg-border/50 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-150"
          style={{ width: `${Math.min(100, (currentText.length / passage.length) * 100)}%` }}
        />
      </div>

      {/* Results */}
      {finished && (
        <div className="glass-card rounded-2xl p-6 text-center mb-6">
          <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="font-semibold font-['Outfit'] text-lg mb-4">Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-2xl font-bold text-primary">{wpm}</p>
              <p className="text-xs text-muted-foreground">Words/min</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{formatTime(elapsed)}</p>
              <p className="text-xs text-muted-foreground">Time</p>
            </div>
          </div>
          {best[difficulty] && wpm >= best[difficulty] && (
            <p className="text-sm text-yellow-500 font-medium mb-4">New personal best!</p>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={tryAgain}>
              <RotateCcw className="w-3 h-3 mr-1" /> Try Again
            </Button>
            <Button variant="outline" size="sm" onClick={nextPassage}>
              Next Passage <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
