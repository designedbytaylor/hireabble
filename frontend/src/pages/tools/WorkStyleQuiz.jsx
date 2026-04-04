import { useState, useEffect } from 'react';
import { Brain, Copy, Check, ArrowRight, ArrowLeft, RotateCcw, Lightbulb, AlertTriangle, Briefcase, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const PROFILES = {
  independent: {
    name: 'Independent Creator',
    icon: <Lightbulb className="w-8 h-8" />,
    color: '#8b5cf6',
    description: 'You thrive when given the freedom to work on your own terms. You are self-motivated, creative, and prefer deep focus over constant collaboration. You produce your best work when you can think independently and bring fully formed ideas to the table.',
    strengths: [
      'Deep focus and ability to work without supervision',
      'Creative problem-solving and original thinking',
      'Strong self-discipline and time management',
    ],
    watchOut: [
      'May resist collaborative processes that feel unnecessary',
      'Can appear disconnected from team dynamics',
    ],
    idealRoles: [
      'Software Developer',
      'Writer / Content Creator',
      'Graphic Designer',
      'Data Scientist',
      'Freelance Consultant',
    ],
    bestComplement: 'Collaborative Builder',
  },
  collaborative: {
    name: 'Collaborative Builder',
    icon: <Users className="w-8 h-8" />,
    color: '#06b6d4',
    description: 'You draw energy from working with others and believe the best results come from teamwork. You are empathetic, communicative, and excel at building consensus. You naturally create an inclusive environment where everyone feels heard.',
    strengths: [
      'Excellent team communication and empathy',
      'Natural ability to build trust and rapport',
      'Strong at facilitating group problem-solving',
    ],
    watchOut: [
      'May struggle with solo decision-making under pressure',
      'Can spend too long seeking consensus instead of acting',
    ],
    idealRoles: [
      'Product Manager',
      'HR / People Operations',
      'Customer Success Manager',
      'Scrum Master / Agile Coach',
      'UX Researcher',
    ],
    bestComplement: 'Independent Creator',
  },
  strategic: {
    name: 'Strategic Leader',
    icon: <Briefcase className="w-8 h-8" />,
    color: '#f59e0b',
    description: 'You see the big picture and are driven to turn vision into reality. You are confident, decisive, and comfortable leading others through ambiguity. You excel at setting direction, motivating teams, and driving results.',
    strengths: [
      'Visionary thinking and long-term planning',
      'Confident decision-making under pressure',
      'Ability to inspire and motivate teams',
    ],
    watchOut: [
      'May overlook details in favor of the big picture',
      'Can come across as dominating in group settings',
    ],
    idealRoles: [
      'Engineering Manager',
      'Operations Manager',
      'Management Consultant',
      'Startup Founder / CEO',
      'Sales Director',
    ],
    bestComplement: 'Analytical Problem Solver',
  },
  analytical: {
    name: 'Analytical Problem Solver',
    icon: <Brain className="w-8 h-8" />,
    color: '#22c55e',
    description: 'You approach every challenge with logic and precision. You love breaking down complex problems, finding patterns in data, and building systematic solutions. You value accuracy and make decisions based on evidence, not intuition.',
    strengths: [
      'Exceptional attention to detail and accuracy',
      'Data-driven decision-making',
      'Systematic approach to complex problems',
    ],
    watchOut: [
      'May over-analyze when speed is needed',
      'Can struggle with ambiguous or emotional situations',
    ],
    idealRoles: [
      'Data Analyst / Data Engineer',
      'Financial Analyst',
      'QA Engineer',
      'Business Analyst',
      'Solutions Architect',
    ],
    bestComplement: 'Strategic Leader',
  },
};

const QUESTIONS = [
  {
    text: 'How do you prefer to communicate at work?',
    options: [
      { label: 'Email — I like to compose my thoughts carefully', profile: 'independent' },
      { label: 'Video call — I want to see faces and read reactions', profile: 'collaborative' },
      { label: 'In-person meeting — I lead discussions best face-to-face', profile: 'strategic' },
      { label: 'Slack/chat — quick, efficient, and documented', profile: 'analytical' },
    ],
  },
  {
    text: "What's your ideal work environment?",
    options: [
      { label: 'Quiet home office with minimal distractions', profile: 'independent' },
      { label: 'Busy open office with lots of energy', profile: 'collaborative' },
      { label: 'Private office where I can think and plan', profile: 'strategic' },
      { label: 'Well-organized space with dual monitors and whiteboards', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you handle tight deadlines?',
    options: [
      { label: 'I plan ahead and work steadily to avoid last-minute stress', profile: 'analytical' },
      { label: 'I thrive under pressure — some of my best work is last-minute', profile: 'independent' },
      { label: 'I delegate tasks and coordinate the team to hit the deadline', profile: 'strategic' },
      { label: 'I rally the team and we push through together', profile: 'collaborative' },
    ],
  },
  {
    text: 'When starting a new project, what do you do first?',
    options: [
      { label: 'Brainstorm ideas on my own before sharing', profile: 'independent' },
      { label: 'Gather the team for a kickoff discussion', profile: 'collaborative' },
      { label: 'Define the vision, goals, and success metrics', profile: 'strategic' },
      { label: 'Research existing solutions and analyze the data', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you handle disagreements with a coworker?',
    options: [
      { label: 'I step back, think it through, and present my case logically', profile: 'analytical' },
      { label: 'I try to understand their perspective and find common ground', profile: 'collaborative' },
      { label: 'I make a decision and move forward — we can adjust later', profile: 'strategic' },
      { label: 'I prefer to work through it independently and avoid unnecessary conflict', profile: 'independent' },
    ],
  },
  {
    text: 'What kind of feedback do you value most?',
    options: [
      { label: 'Written feedback I can review and reflect on privately', profile: 'independent' },
      { label: 'Face-to-face conversations where we can discuss openly', profile: 'collaborative' },
      { label: 'High-level strategic feedback on impact and direction', profile: 'strategic' },
      { label: 'Specific, data-backed feedback with clear examples', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you prefer to learn new skills?',
    options: [
      { label: 'Self-study through books, courses, and experimentation', profile: 'independent' },
      { label: 'Workshops and group learning with peers', profile: 'collaborative' },
      { label: 'Mentorship from someone who has been there', profile: 'strategic' },
      { label: 'Structured courses with clear curriculum and assessments', profile: 'analytical' },
    ],
  },
  {
    text: 'What motivates you most at work?',
    options: [
      { label: 'Creative freedom and autonomy over my work', profile: 'independent' },
      { label: 'Building meaningful relationships with my team', profile: 'collaborative' },
      { label: 'Making an impact and seeing results at scale', profile: 'strategic' },
      { label: 'Solving complex problems and finding elegant solutions', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you approach a task you have never done before?',
    options: [
      { label: 'Dive in and figure it out as I go', profile: 'independent' },
      { label: 'Ask teammates who have done something similar', profile: 'collaborative' },
      { label: 'Outline a plan and identify who should own what', profile: 'strategic' },
      { label: 'Research thoroughly before taking the first step', profile: 'analytical' },
    ],
  },
  {
    text: 'What does your ideal meeting look like?',
    options: [
      { label: 'As few meetings as possible — send me an async update', profile: 'independent' },
      { label: 'Collaborative brainstorm with everyone contributing', profile: 'collaborative' },
      { label: 'Short and focused with clear decisions and next steps', profile: 'strategic' },
      { label: 'Well-prepared with an agenda, data, and documentation', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you celebrate a team success?',
    options: [
      { label: 'I feel satisfaction quietly and move on to the next challenge', profile: 'independent' },
      { label: 'Team lunch or outing — we did this together!', profile: 'collaborative' },
      { label: 'Recognize individual contributors and share the win broadly', profile: 'strategic' },
      { label: 'Review what worked well and document it for next time', profile: 'analytical' },
    ],
  },
  {
    text: 'How structured do you like your workday?',
    options: [
      { label: 'Flexible — I work in bursts of inspiration', profile: 'independent' },
      { label: 'Somewhat structured but open to spontaneous collaboration', profile: 'collaborative' },
      { label: 'I set priorities in the morning and execute all day', profile: 'strategic' },
      { label: 'Highly structured with time blocks for each task', profile: 'analytical' },
    ],
  },
  {
    text: 'When presenting an idea, what do you lead with?',
    options: [
      { label: 'A creative prototype or visual concept', profile: 'independent' },
      { label: 'How the team feels about it and their input', profile: 'collaborative' },
      { label: 'The business impact and strategic value', profile: 'strategic' },
      { label: 'Data, research, and a logical argument', profile: 'analytical' },
    ],
  },
  {
    text: 'What frustrates you most at work?',
    options: [
      { label: 'Micromanagement and lack of creative freedom', profile: 'independent' },
      { label: 'Siloed teams and poor communication', profile: 'collaborative' },
      { label: 'Lack of direction or indecisive leadership', profile: 'strategic' },
      { label: 'Decisions made on gut feeling instead of data', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you handle a project that is falling behind?',
    options: [
      { label: 'Put my head down and power through the work', profile: 'independent' },
      { label: 'Check in with the team to identify blockers together', profile: 'collaborative' },
      { label: 'Reprioritize scope and communicate the new plan to stakeholders', profile: 'strategic' },
      { label: 'Analyze what went wrong and adjust the timeline and process', profile: 'analytical' },
    ],
  },
  {
    text: "What's your approach to career growth?",
    options: [
      { label: 'Build a unique personal brand and portfolio', profile: 'independent' },
      { label: 'Grow through relationships, mentorship, and community', profile: 'collaborative' },
      { label: 'Seek leadership roles and increasing responsibility', profile: 'strategic' },
      { label: 'Develop deep expertise and become the go-to specialist', profile: 'analytical' },
    ],
  },
  {
    text: 'How do you prefer to receive recognition?',
    options: [
      { label: 'Quietly — a personal note or DM is enough', profile: 'independent' },
      { label: 'Publicly — I like team celebrations and shout-outs', profile: 'collaborative' },
      { label: 'Through promotion, expanded scope, or a new title', profile: 'strategic' },
      { label: 'Through challenging new problems to solve', profile: 'analytical' },
    ],
  },
  {
    text: 'When onboarding at a new company, you first want to understand:',
    options: [
      { label: 'The tools, systems, and how to be productive fast', profile: 'independent' },
      { label: 'The team — who does what and how they work together', profile: 'collaborative' },
      { label: 'The company strategy, goals, and where my role fits in', profile: 'strategic' },
      { label: 'The processes, documentation, and how decisions are made', profile: 'analytical' },
    ],
  },
  {
    text: 'What type of manager do you work best with?',
    options: [
      { label: 'Hands-off — trust me and give me space', profile: 'independent' },
      { label: 'Supportive and approachable — open-door policy', profile: 'collaborative' },
      { label: 'Visionary — someone who sets a clear direction', profile: 'strategic' },
      { label: 'Organized — clear expectations and regular check-ins', profile: 'analytical' },
    ],
  },
  {
    text: 'If you could pick one superpower at work, it would be:',
    options: [
      { label: 'Unlimited creative energy', profile: 'independent' },
      { label: 'The ability to instantly resolve any conflict', profile: 'collaborative' },
      { label: 'The power to execute any vision flawlessly', profile: 'strategic' },
      { label: 'Perfect memory and instant pattern recognition', profile: 'analytical' },
    ],
  },
];

const LS_KEY = 'hireabble-workstyle-result';

function loadSavedResult() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && saved.profileKey && PROFILES[saved.profileKey]) return saved;
  } catch {}
  return null;
}

function saveResult(profileKey, scores) {
  localStorage.setItem(LS_KEY, JSON.stringify({ profileKey, scores, date: new Date().toISOString() }));
}

export default function WorkStyleQuiz() {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const saved = loadSavedResult();
    if (saved) {
      setResult(saved);
      setShowSaved(true);
    }
  }, []);

  const handleAnswer = (profileKey) => {
    const newAnswers = [...answers, profileKey];
    setAnswers(newAnswers);

    if (newAnswers.length === QUESTIONS.length) {
      // Calculate scores
      const scores = { independent: 0, collaborative: 0, strategic: 0, analytical: 0 };
      newAnswers.forEach(a => { scores[a] += 1; });

      const topProfile = Object.entries(scores).reduce((best, [key, val]) =>
        val > best[1] ? [key, val] : best, ['', 0]
      );

      const res = { profileKey: topProfile[0], scores };
      setResult(res);
      saveResult(topProfile[0], scores);
      setShowSaved(false);
    } else {
      setCurrentQ(newAnswers.length);
    }
  };

  const goBack = () => {
    if (currentQ > 0) {
      const newAnswers = answers.slice(0, -1);
      setAnswers(newAnswers);
      setCurrentQ(newAnswers.length);
    }
  };

  const restart = () => {
    setCurrentQ(0);
    setAnswers([]);
    setResult(null);
    setShowSaved(false);
  };

  const copyResult = () => {
    if (!result) return;
    const profile = PROFILES[result.profileKey];
    const text = `My Work Style: ${profile.name}\n\n${profile.description}\n\nStrengths: ${profile.strengths.join(', ')}\nIdeal Roles: ${profile.idealRoles.join(', ')}\n\nTake the quiz at hireabble.com/tools/work-style-quiz`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const progress = (answers.length / QUESTIONS.length) * 100;

  // Show result
  if (result) {
    const profile = PROFILES[result.profileKey];
    const scores = result.scores;
    const maxScore = QUESTIONS.length;

    return (
      <ToolLayout title="Work Style Quiz" description="Discover your work personality and find roles that match your natural strengths.">
        {showSaved && (
          <div className="glass-card rounded-2xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">This is your saved result from a previous visit.</p>
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw className="w-4 h-4 mr-2" /> Retake Quiz
            </Button>
          </div>
        )}

        {/* Profile header */}
        <div className="glass-card rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: profile.color + '20', color: profile.color }}>
            {profile.icon}
          </div>
          <h2 className="text-2xl font-bold font-['Outfit'] mb-2" style={{ color: profile.color }}>{profile.name}</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">{profile.description}</p>
        </div>

        {/* Score breakdown */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h3 className="font-semibold font-['Outfit'] mb-4">Score Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(PROFILES).map(([key, p]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={key === result.profileKey ? 'font-medium' : 'text-muted-foreground'}>{p.name}</span>
                  <span className="text-muted-foreground">{scores[key]}/{maxScore}</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(scores[key] / maxScore) * 100}%`, backgroundColor: p.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" /> Your Strengths
          </h3>
          <ul className="space-y-2">
            {profile.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Watch out */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" /> Watch Out For
          </h3>
          <ul className="space-y-2">
            {profile.watchOut.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ideal roles */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" /> Ideal Roles for You
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.idealRoles.map((r, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: profile.color + '15', color: profile.color }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Best complement */}
        <div className="glass-card rounded-2xl p-6 mt-6">
          <h3 className="font-semibold font-['Outfit'] mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Best Team Complement
          </h3>
          <p className="text-sm text-muted-foreground">
            You work best alongside a <strong className="text-foreground">{profile.bestComplement}</strong>.
            {' '}
            {profile.bestComplement === 'Collaborative Builder' && 'They bring team cohesion and communication skills that balance your independent approach.'}
            {profile.bestComplement === 'Independent Creator' && 'They bring deep focus and creative solutions that complement your collaborative nature.'}
            {profile.bestComplement === 'Analytical Problem Solver' && 'They bring data-driven rigor that grounds your strategic vision with evidence.'}
            {profile.bestComplement === 'Strategic Leader' && 'They bring direction and decisiveness that channels your analytical insights into action.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          <Button variant="outline" onClick={copyResult}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Share Your Result'}
          </Button>
          <Button variant="outline" onClick={restart}>
            <RotateCcw className="w-4 h-4 mr-2" /> Retake Quiz
          </Button>
        </div>
      </ToolLayout>
    );
  }

  // Show quiz
  const question = QUESTIONS[currentQ];

  return (
    <ToolLayout title="Work Style Quiz" description="Discover your work personality and find roles that match your natural strengths.">
      {/* Progress bar */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Question {currentQ + 1} of {QUESTIONS.length}</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-semibold font-['Outfit'] mb-6">{question.text}</h2>
        <div className="space-y-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt.profile)}
              className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-medium group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>

        {currentQ > 0 && (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
