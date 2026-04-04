import { useState } from 'react';
import { CalendarDays, Clock, Printer, CheckSquare, BookOpen, Target } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const ROLE_TYPES = [
  { value: 'technical', label: 'Technical' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'executive', label: 'Executive/Leadership' },
  { value: 'sales', label: 'Sales' },
  { value: 'creative', label: 'Creative' },
];

const EXPERIENCE_LEVELS = [
  { value: 'entry', label: 'Entry-level' },
  { value: 'mid', label: 'Mid-career' },
  { value: 'senior', label: 'Senior' },
];

const TASKS_BY_ROLE = {
  technical: {
    research: [
      'Research the company tech stack and architecture blog posts',
      'Read recent engineering blog posts or tech talks',
      'Look up the team structure on LinkedIn',
    ],
    core: [
      'Practice coding problems (arrays, strings, trees)',
      'Review system design fundamentals',
      'Practice explaining your past technical decisions',
      'Work through a take-home-style project',
      'Review data structures and algorithms',
      'Practice whiteboard coding without an IDE',
      'Review SQL and database design patterns',
      'Study API design best practices',
    ],
    soft: [
      'Prepare STAR stories about technical challenges',
      'Practice explaining complex concepts simply',
      'Prepare questions about the engineering culture',
    ],
    final: [
      'Review your resume and be ready to discuss every project',
      'Prepare 3-5 thoughtful questions for the interviewer',
      'Test your video/audio setup if remote',
      'Plan your outfit and route',
    ],
  },
  behavioral: {
    research: [
      'Research the company mission, values, and culture',
      'Read recent news articles and press releases',
      'Study the company Glassdoor reviews for culture insights',
    ],
    core: [
      'Write out 5 STAR stories (Situation, Task, Action, Result)',
      'Practice telling stories about leadership moments',
      'Prepare examples of handling conflict at work',
      'Practice answering "Tell me about yourself" (2 min version)',
      'Prepare stories about teamwork and collaboration',
      'Practice answering "Why this company?" authentically',
      'Prepare examples of failure and what you learned',
      'Draft answers for "Where do you see yourself in 5 years?"',
    ],
    soft: [
      'Practice active listening techniques',
      'Rehearse your body language and eye contact',
      'Prepare questions that show genuine interest',
    ],
    final: [
      'Do a mock interview with a friend',
      'Review your STAR stories one final time',
      'Prepare a "closing statement" summarizing your fit',
      'Get a good night of sleep',
    ],
  },
  executive: {
    research: [
      'Analyze the company annual report and financials',
      'Research the board of directors and C-suite',
      'Study the competitive landscape and market position',
    ],
    core: [
      'Prepare a 90-day strategic plan outline',
      'Draft your leadership philosophy statement',
      'Prepare case studies of your organizational impact',
      'Review industry trends and future predictions',
      'Prepare examples of driving organizational change',
      'Practice presenting your vision and strategy',
      'Prepare metrics and KPIs from your past roles',
      'Study the company investor presentations',
    ],
    soft: [
      'Practice executive presence and gravitas',
      'Prepare stories about building and scaling teams',
      'Draft your point of view on industry challenges',
    ],
    final: [
      'Review your strategic plan one more time',
      'Prepare insightful questions about company direction',
      'Practice your handshake and opening',
      'Review the agenda and interviewer backgrounds',
    ],
  },
  sales: {
    research: [
      'Research the company products and pricing model',
      'Study the target customer profile and ICP',
      'Look up the company sales methodology (MEDDIC, Challenger, etc.)',
    ],
    core: [
      'Prepare your sales track record with specific numbers',
      'Practice a mock discovery call or demo',
      'Prepare examples of closing difficult deals',
      'Practice handling common objections',
      'Draft your prospecting strategy for their market',
      'Prepare examples of exceeding quota',
      'Practice your elevator pitch for their product',
      'Study the competitive landscape from a sales angle',
    ],
    soft: [
      'Practice active listening and asking probing questions',
      'Prepare stories about building client relationships',
      'Practice your energy and enthusiasm level',
    ],
    final: [
      'Review your numbers and be ready to discuss them',
      'Prepare a 30-60-90 day sales plan',
      'Practice your closing technique',
      'Prepare questions about the sales team and territory',
    ],
  },
  creative: {
    research: [
      'Review the company brand guidelines and recent campaigns',
      'Study their social media presence and visual identity',
      'Research their target audience and brand voice',
    ],
    core: [
      'Update your portfolio with your best 5-8 pieces',
      'Prepare case studies showing your creative process',
      'Practice presenting your work and design decisions',
      'Prepare a mood board or concept for the company',
      'Practice critique sessions and receiving feedback',
      'Review current design and creative trends',
      'Prepare examples of working with constraints',
      'Study their competitors creative output',
    ],
    soft: [
      'Prepare stories about collaborating with non-creative teams',
      'Practice explaining your creative process to non-designers',
      'Prepare questions about the creative team workflow',
    ],
    final: [
      'Final portfolio review and presentation rehearsal',
      'Test any presentation tech or tools',
      'Prepare thoughtful questions about creative direction',
      'Review the role description one more time',
    ],
  },
};

function getDaysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function getPrepType(days) {
  if (days <= 3) return { label: 'Quick Prep', color: '#ef4444', description: 'Compressed schedule — focus on the essentials' };
  if (days <= 7) return { label: 'Standard Prep', color: '#eab308', description: 'Daily plan covering all the key areas' };
  if (days <= 14) return { label: 'Thorough Prep', color: '#22c55e', description: 'Detailed plan with time for practice and review' };
  return { label: 'Deep Prep', color: '#3b82f6', description: 'Comprehensive plan with research and multiple practice rounds' };
}

function generateSchedule(daysUntil, roleType, experienceLevel, companyName) {
  const tasks = TASKS_BY_ROLE[roleType];
  const days = Math.max(1, daysUntil);
  const schedule = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const companyLabel = companyName || 'the company';

  if (days <= 3) {
    // Quick prep
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayTasks = [];

      if (i === 0) {
        dayTasks.push({ task: `Research ${companyLabel} — mission, products, and recent news`, time: '30 min' });
        dayTasks.push({ task: tasks.core[0], time: '45 min' });
        dayTasks.push({ task: tasks.core[1], time: '30 min' });
      } else if (i === days - 1) {
        dayTasks.push(...tasks.final.slice(0, 3).map(t => ({ task: t, time: '20 min' })));
      } else {
        dayTasks.push({ task: tasks.core[2], time: '30 min' });
        dayTasks.push({ task: tasks.soft[0], time: '30 min' });
      }

      schedule.push({ date, dayNumber: i + 1, tasks: dayTasks, phase: i === days - 1 ? 'Final Review' : 'Core Prep' });
    }
  } else if (days <= 7) {
    // Standard prep
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayTasks = [];
      const phase =
        i === 0 ? 'Research' :
        i < days - 1 ? 'Core Prep' : 'Final Review';

      if (i === 0) {
        dayTasks.push({ task: `Deep research on ${companyLabel} — products, culture, and team`, time: '45 min' });
        dayTasks.push({ task: tasks.research[0], time: '30 min' });
        dayTasks.push({ task: tasks.research[1], time: '20 min' });
      } else if (i === days - 1) {
        dayTasks.push(...tasks.final.slice(0, 3).map(t => ({ task: t, time: '20 min' })));
      } else {
        const coreIdx = (i - 1) * 2;
        if (tasks.core[coreIdx]) dayTasks.push({ task: tasks.core[coreIdx], time: '45 min' });
        if (tasks.core[coreIdx + 1]) dayTasks.push({ task: tasks.core[coreIdx + 1], time: '30 min' });
        if (i % 2 === 0 && tasks.soft[Math.floor(i / 2)]) {
          dayTasks.push({ task: tasks.soft[Math.floor(i / 2)], time: '20 min' });
        }
      }

      schedule.push({ date, dayNumber: i + 1, tasks: dayTasks, phase });
    }
  } else if (days <= 14) {
    // Thorough prep
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayTasks = [];
      let phase;

      if (i < 2) {
        phase = 'Research';
        if (i === 0) {
          dayTasks.push({ task: `Research ${companyLabel} — mission, products, financials, and recent news`, time: '60 min' });
          dayTasks.push({ task: tasks.research[0], time: '30 min' });
        } else {
          dayTasks.push({ task: tasks.research[1], time: '30 min' });
          dayTasks.push({ task: tasks.research[2], time: '30 min' });
        }
      } else if (i >= days - 2) {
        phase = 'Final Review';
        const fIdx = i === days - 2 ? 0 : 2;
        dayTasks.push({ task: tasks.final[fIdx], time: '30 min' });
        if (tasks.final[fIdx + 1]) dayTasks.push({ task: tasks.final[fIdx + 1], time: '20 min' });
      } else {
        phase = 'Core Prep';
        const coreIdx = (i - 2) % tasks.core.length;
        dayTasks.push({ task: tasks.core[coreIdx], time: '45 min' });
        if (tasks.core[(coreIdx + 1) % tasks.core.length] && coreIdx + 1 < tasks.core.length) {
          dayTasks.push({ task: tasks.core[(coreIdx + 1) % tasks.core.length], time: '30 min' });
        }
        const softIdx = (i - 2) % tasks.soft.length;
        if (i % 3 === 0) {
          dayTasks.push({ task: tasks.soft[softIdx], time: '20 min' });
        }
      }

      schedule.push({ date, dayNumber: i + 1, tasks: dayTasks, phase });
    }
  } else {
    // Deep prep — show first 21 days max
    const totalDays = Math.min(days, 21);
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayTasks = [];
      let phase;

      if (i < 4) {
        phase = 'Deep Research';
        if (i === 0) {
          dayTasks.push({ task: `Comprehensive research on ${companyLabel} — history, mission, and products`, time: '60 min' });
          dayTasks.push({ task: tasks.research[0], time: '30 min' });
        } else if (i === 1) {
          dayTasks.push({ task: tasks.research[1], time: '40 min' });
          dayTasks.push({ task: tasks.research[2], time: '30 min' });
        } else if (i === 2) {
          dayTasks.push({ task: `Research the interviewers on LinkedIn and their backgrounds`, time: '40 min' });
          dayTasks.push({ task: `Study ${companyLabel} competitors and market position`, time: '30 min' });
        } else {
          dayTasks.push({ task: `Create a document summarizing your research on ${companyLabel}`, time: '45 min' });
          dayTasks.push({ task: 'Identify 5 ways you can add value to the team', time: '30 min' });
        }
      } else if (i >= totalDays - 3) {
        phase = 'Final Review';
        const fIdx = (totalDays - i - 1);
        if (fIdx === 2) {
          dayTasks.push({ task: 'Full mock interview with a friend or mentor', time: '60 min' });
          dayTasks.push({ task: tasks.final[0], time: '20 min' });
        } else if (fIdx === 1) {
          dayTasks.push({ task: tasks.final[1], time: '20 min' });
          dayTasks.push({ task: tasks.final[2], time: '20 min' });
        } else {
          dayTasks.push({ task: tasks.final[3], time: '15 min' });
          dayTasks.push({ task: 'Light review only — trust your preparation', time: '20 min' });
        }
      } else {
        phase = 'Core Prep';
        const coreIdx = (i - 4) % tasks.core.length;
        dayTasks.push({ task: tasks.core[coreIdx], time: '45 min' });
        if (coreIdx + 1 < tasks.core.length) {
          dayTasks.push({ task: tasks.core[coreIdx + 1], time: '30 min' });
        }
        const softIdx = (i - 4) % tasks.soft.length;
        if (i % 3 === 0) {
          dayTasks.push({ task: tasks.soft[softIdx], time: '20 min' });
        }
      }

      schedule.push({ date, dayNumber: i + 1, tasks: dayTasks, phase });
    }
  }

  return schedule;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

export default function InterviewPlanner() {
  const [interviewDate, setInterviewDate] = useState('');
  const [roleType, setRoleType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [schedule, setSchedule] = useState(null);
  const [prepType, setPrepType] = useState(null);
  const [daysUntil, setDaysUntil] = useState(null);
  const [checked, setChecked] = useState(new Set());

  const generate = (e) => {
    e.preventDefault();
    const days = getDaysUntil(interviewDate);
    if (days < 1) return;
    const pt = getPrepType(days);
    const sched = generateSchedule(days, roleType, experienceLevel, companyName);
    setDaysUntil(days);
    setPrepType(pt);
    setSchedule(sched);
    setChecked(new Set());
  };

  const toggleCheck = (key) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalTasks = schedule ? schedule.reduce((sum, day) => sum + day.tasks.length, 0) : 0;
  const completedTasks = checked.size;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <ToolLayout title="Interview Planner" description="Generate a day-by-day interview preparation schedule tailored to your role and timeline.">
      <form onSubmit={generate} className="glass-card rounded-2xl p-6 space-y-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Interview Date</label>
            <input
              type="date"
              className={inputClass}
              value={interviewDate}
              onChange={e => setInterviewDate(e.target.value)}
              min={todayStr}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role Type</label>
            <select className={inputClass} value={roleType} onChange={e => setRoleType(e.target.value)} required>
              <option value="">Select role type...</option>
              {ROLE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your Experience Level</label>
            <select className={inputClass} value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} required>
              <option value="">Select level...</option>
              {EXPERIENCE_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company Name <span className="text-muted-foreground">(optional)</span></label>
            <input
              type="text"
              className={inputClass}
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Google"
            />
          </div>
        </div>
        <Button type="submit" className="w-full">
          <CalendarDays className="w-4 h-4 mr-2" /> Generate Prep Schedule
        </Button>
      </form>

      {schedule && prepType && (
        <div className="mt-6 space-y-6 printable-area">
          {/* Countdown and overview */}
          <div className="glass-card rounded-2xl p-6 text-center">
            <div className="text-5xl font-bold font-['Outfit'] mb-2" style={{ color: prepType.color }}>
              {daysUntil}
            </div>
            <p className="text-lg font-medium mb-1">days until your interview</p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: prepType.color + '20', color: prepType.color }}>
              <Target className="w-4 h-4" />
              {prepType.label}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{prepType.description}</p>
            {totalTasks > 0 && (
              <div className="mt-4">
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(completedTasks / totalTasks) * 100}%`, backgroundColor: prepType.color }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{completedTasks} of {totalTasks} tasks completed</p>
              </div>
            )}
          </div>

          {/* Print button */}
          <div className="flex justify-end no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print Schedule
            </Button>
          </div>

          {/* Schedule days */}
          {schedule.map((day, dayIdx) => (
            <div key={dayIdx} className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ backgroundColor: prepType.color + '20', color: prepType.color }}>
                    {day.dayNumber}
                  </div>
                  <div>
                    <p className="font-semibold font-['Outfit']">{formatDate(day.date)}</p>
                    <p className="text-xs text-muted-foreground">{day.phase}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {day.tasks.reduce((sum, t) => {
                    const mins = parseInt(t.time);
                    return sum + (isNaN(mins) ? 0 : mins);
                  }, 0)} min total
                </div>
              </div>
              <div className="space-y-2">
                {day.tasks.map((task, taskIdx) => {
                  const key = `${dayIdx}-${taskIdx}`;
                  const isChecked = checked.has(key);
                  return (
                    <button
                      key={taskIdx}
                      onClick={() => toggleCheck(key)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${isChecked ? 'bg-primary/5 line-through text-muted-foreground' : 'hover:bg-muted/50'}`}
                    >
                      <CheckSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{task.task}</p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {task.time}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tips */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="font-semibold font-['Outfit']">General Tips</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Arrive 10-15 minutes early (or log in 5 minutes early for virtual)</li>
              <li>Bring copies of your resume and a notebook</li>
              <li>Prepare a 2-minute "Tell me about yourself" answer</li>
              <li>Research your interviewers on LinkedIn before the interview</li>
              <li>Follow up with a thank-you email within 24 hours</li>
            </ul>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
