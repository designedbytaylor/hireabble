import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, Trophy, RotateCcw,
  BadgeCheck, Loader2, ChevronRight, Lock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import SkillBadges from '../components/SkillBadges';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function useDocumentTitle(title) {
  useEffect(() => { document.title = `${title} | Hireabble`; }, [title]);
}

export default function SkillQuiz() {
  useDocumentTitle('Skill Assessments');
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { quizId } = useParams();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quiz-taking state
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (quizId && quizzes.length > 0) {
      const quiz = quizzes.find(q => q.id === quizId);
      if (quiz && quiz.status !== 'passed') {
        startQuiz(quizId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, quizzes]);

  const fetchQuizzes = async () => {
    try {
      const { data } = await axios.get(`${API}/skills/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuizzes(data.quizzes || []);
    } catch (err) {
      toast.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async (id) => {
    try {
      const { data } = await axios.get(`${API}/skills/quizzes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveQuiz(data);
      setCurrentQuestion(0);
      setAnswers(new Array(data.questions.length).fill(-1));
      setTimeLeft(data.time_limit_seconds);
      setResult(null);

      // Start timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to start quiz';
      toast.error(detail);
    }
  };

  const handleAnswer = (optionIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async (timedOut = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!activeQuiz) return;

    setSubmitting(true);
    try {
      const { data } = await axios.post(
        `${API}/skills/quizzes/${activeQuiz.id}/submit`,
        { answers },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setResult(data);
      if (data.passed) {
        fetchQuizzes(); // Refresh list
      }
      if (timedOut) {
        toast.info("Time's up! Your answers have been submitted.");
      }
    } catch (err) {
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const exitQuiz = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveQuiz(null);
    setResult(null);
    if (quizId) navigate('/skills', { replace: true });
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Quiz-taking view
  if (activeQuiz && !result) {
    const q = activeQuiz.questions[currentQuestion];
    const allAnswered = answers.every((a) => a >= 0);
    const isLast = currentQuestion === activeQuiz.questions.length - 1;

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={exitQuiz} className="p-2 rounded-xl hover:bg-accent">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-medium">{activeQuiz.skill_name}</p>
              <p className="text-xs text-muted-foreground">
                Question {currentQuestion + 1} of {activeQuiz.questions.length}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
              timeLeft <= 30 ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-accent text-foreground'
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / activeQuiz.questions.length) * 100}%` }}
            />
          </div>

          {/* Question */}
          <h2 className="text-lg font-bold font-['Outfit'] mb-6">{q.question}</h2>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {q.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                  answers[currentQuestion] === i
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="text-sm font-medium">{option}</span>
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {currentQuestion > 0 && (
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setCurrentQuestion((c) => c - 1)}
              >
                Previous
              </Button>
            )}
            {isLast ? (
              <Button
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary"
                onClick={() => handleSubmit()}
                disabled={!allAnswered || submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit
              </Button>
            ) : (
              <Button
                className="flex-1 rounded-xl"
                onClick={() => setCurrentQuestion((c) => c + 1)}
                disabled={answers[currentQuestion] < 0}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Result view
  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto p-4 pt-12 text-center">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 ${
            result.passed
              ? 'bg-emerald-500/20 border-2 border-emerald-500/40'
              : 'bg-destructive/20 border-2 border-destructive/40'
          }`}>
            {result.passed ? (
              <Trophy className="w-12 h-12 text-emerald-400" />
            ) : (
              <XCircle className="w-12 h-12 text-destructive" />
            )}
          </div>

          <h2 className="text-2xl font-bold font-['Outfit'] mb-2">
            {result.passed ? 'Skill Verified!' : 'Not Quite'}
          </h2>
          <p className="text-muted-foreground mb-6">{result.message}</p>

          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-accent/50 mb-8">
            <div className="text-center">
              <p className="text-3xl font-bold">{result.score}%</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold">{result.correct}/{result.total}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
          </div>

          {result.passed && (
            <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium">
                <BadgeCheck className="w-5 h-5" />
                {result.skill_name} badge added to your profile
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={exitQuiz}>
              Back to Quizzes
            </Button>
            {!result.passed && (
              <Button className="flex-1 rounded-xl" onClick={() => startQuiz(activeQuiz.id)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz list view
  const passedQuizzes = quizzes.filter((q) => q.status === 'passed');

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/profile')} className="p-2 rounded-xl hover:bg-accent">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-['Outfit']">Skill Assessments</h1>
            <p className="text-sm text-muted-foreground">Verify your skills with quick quizzes</p>
          </div>
        </header>

        {/* Earned Badges */}
        {passedQuizzes.length > 0 && (
          <div className="glass-card rounded-2xl p-4 mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-emerald-400" /> Your Verified Skills
            </h3>
            <SkillBadges badges={passedQuizzes.map((q) => q.skill_name)} size="md" />
          </div>
        )}

        {/* Quiz List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <button
                key={quiz.id}
                onClick={() => quiz.status !== 'passed' ? startQuiz(quiz.id) : null}
                disabled={quiz.status === 'passed'}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  quiz.status === 'passed'
                    ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80'
                    : 'border-border hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    quiz.status === 'passed' ? 'bg-emerald-500/20' : 'bg-primary/10'
                  }`}>
                    {quiz.status === 'passed' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <BadgeCheck className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{quiz.skill_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {quiz.question_count} questions · {Math.floor(quiz.time_limit_seconds / 60)} min
                      {quiz.status === 'passed' && quiz.last_score != null && ` · Scored ${quiz.last_score}%`}
                    </p>
                  </div>
                  {quiz.status === 'passed' ? (
                    <span className="text-xs text-emerald-400 font-medium">Verified</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">How it works:</strong> Pass a quiz with 80% or higher
            to earn a verified badge on your profile. Recruiters can see your badges and filter by verified skills.
            You can retry after 24 hours.
          </p>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
