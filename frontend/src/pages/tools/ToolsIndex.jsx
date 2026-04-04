import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, BarChart3, PenLine, DollarSign, MessageSquare, Kanban, GitCompare,
  ClipboardList, Calculator, Mail, Award, Keyboard, Search, Clock, UserCheck,
  Wallet, HeartHandshake, ArrowRightLeft, ClipboardCheck, TrendingUp, Calendar,
  Compass, Share2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';

const SEEKER_TOOLS = [
  { path: '/tools/resume-builder', title: 'Resume Builder', description: 'Create a professional, ATS-friendly resume in minutes', icon: FileText },
  { path: '/tools/resume-score', title: 'Resume Score Checker', description: 'Upload your resume and get an instant score with tips', icon: BarChart3 },
  { path: '/tools/cover-letter-generator', title: 'Cover Letter Generator', description: 'Generate tailored cover letters for any job application', icon: PenLine },
  { path: '/tools/salary-calculator', title: 'Salary Calculator', description: 'Compare salaries across 40 Canadian and US cities', icon: DollarSign },
  { path: '/tools/interview-prep', title: 'Interview Practice', description: 'Practice common interview questions by job category', icon: MessageSquare },
  { path: '/tools/job-tracker', title: 'Job Search Tracker', description: 'Track applications with a drag-and-drop Kanban board', icon: Kanban },
  { path: '/tools/skills-gap', title: 'Skills Gap Analyzer', description: 'Discover which skills you need for your target role', icon: GitCompare },
  { path: '/tools/typing-tune-up', title: 'Typing Tune-Up', description: 'Improve your typing speed and accuracy with practice passages', icon: Keyboard },
  { path: '/tools/job-analyzer', title: 'Job Description Analyzer', description: 'Paste any job posting to find skills, red flags, and insights', icon: Search },
  { path: '/tools/career-gap-explainer', title: 'Career Gap Explainer', description: 'Craft confident explanations for employment gaps', icon: Clock },
  { path: '/tools/reference-request', title: 'Reference Request Generator', description: 'Create professional emails to request references', icon: UserCheck },
  { path: '/tools/benefits-calculator', title: 'Benefits Calculator', description: 'Calculate the true value of your total compensation package', icon: Wallet },
  { path: '/tools/after-rejection', title: 'Rejection Response Guide', description: 'Get templates and next steps after a job rejection', icon: HeartHandshake },
  { path: '/tools/job-title-translator', title: 'Job Title Translator', description: 'Find equivalent job titles across companies and countries', icon: ArrowRightLeft },
  { path: '/tools/interview-planner', title: 'Interview Prep Planner', description: 'Get a day-by-day schedule to prepare for your interview', icon: Calendar },
  { path: '/tools/work-style-quiz', title: 'Work Style Assessment', description: 'Discover your work style and ideal role types', icon: Compass },
  { path: '/tools/equity-calculator', title: 'Equity Calculator', description: 'Calculate what your stock options are worth at different valuations', icon: TrendingUp },
];

const RECRUITER_TOOLS = [
  { path: '/tools/job-description-generator', title: 'Job Description Generator', description: 'Create structured job postings in seconds', icon: ClipboardList },
  { path: '/tools/hiring-cost-calculator', title: 'Hiring Cost Calculator', description: 'Calculate your true cost-per-hire and annual budget', icon: Calculator },
  { path: '/tools/offer-letter', title: 'Offer Letter Generator', description: 'Generate professional offer letters ready to send', icon: Mail },
  { path: '/tools/employer-brand-score', title: 'Employer Brand Scorecard', description: 'Assess your employer brand with a quick audit', icon: Award },
  { path: '/tools/interview-scorecard', title: 'Interview Scorecard Generator', description: 'Create weighted scorecards for consistent candidate evaluation', icon: ClipboardCheck },
];

function ToolCard({ tool }) {
  const Icon = tool.icon;
  return (
    <Link to={tool.path} className="group">
      <div className="glass-card rounded-2xl p-6 h-full transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-semibold font-['Outfit'] mb-1">{tool.title}</h3>
        <p className="text-sm text-muted-foreground">{tool.description}</p>
      </div>
    </Link>
  );
}

const FAQS = [
  { q: 'Are these tools really free?', a: "Yes, completely free with no signup required. We built them because we think everyone deserves access to great career tools, not just people who can afford expensive subscriptions." },
  { q: 'Do you store my data?', a: "Nope. Everything runs in your browser. Your resume text, salary lookups, and quiz answers never leave your device. A couple tools (like the Job Tracker) save data to your browser's local storage so it persists between visits, but that's still on your machine." },
  { q: 'How accurate is the salary data?', a: "We pull from Statistics Canada, the Bureau of Labor Statistics, and aggregated public salary surveys updated for 2025-2026. It's a solid benchmark, but remember that actual offers depend on your specific experience, the company, and your negotiation skills." },
  { q: 'Can I use these on my phone?', a: "Absolutely. All tools are mobile-friendly. The Job Tracker Kanban board switches to a dropdown interface on smaller screens since drag-and-drop is tricky on touch devices." },
  { q: 'Why did you build these?', a: "We're Hireabble — a job matching platform launching in Canada. We wanted to give back to the job-seeking community with tools that are actually useful, not just lead magnets. If you like what you see, check out our main app where you can swipe through matched jobs." },
];

export default function ToolsIndex() {
  useDocumentTitle('Free Career & Hiring Tools');
  const { user } = useAuth();

  useEffect(() => {
    const id = 'tools-jsonld';
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Hireabble Free Career Tools',
      url: 'https://hireabble.com/tools',
      description: 'Free career and hiring tools for job seekers and recruiters. Resume builder, salary calculator, interview prep, and more.',
      applicationCategory: 'BusinessApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
      operatingSystem: 'Web Browser',
    });
    document.head.appendChild(script);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hireabble" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold font-['Outfit']">hireabble</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to={user.role === 'seeker' ? '/dashboard' : '/recruiter'}>
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link to="/register/seeker">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                    Sign Up Free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit'] mb-2">
            Free Career & Hiring <span className="gradient-text">Tools</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {SEEKER_TOOLS.length + RECRUITER_TOOLS.length} free tools to help you land your next job or find the perfect candidate. No signup, no cost, no catch.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="font-semibold font-['Outfit'] mb-4 text-muted-foreground uppercase tracking-wider text-sm">For Job Seekers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {SEEKER_TOOLS.map(tool => <ToolCard key={tool.path} tool={tool} />)}
        </div>

        <h2 className="font-semibold font-['Outfit'] mb-4 text-muted-foreground uppercase tracking-wider text-sm">For Recruiters & Hiring Managers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {RECRUITER_TOOLS.map(tool => <ToolCard key={tool.path} tool={tool} />)}
        </div>

        {/* SEO content section */}
        <div className="border-t border-border/50 pt-12 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold font-['Outfit'] mb-4">Why we built these tools</h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Job searching is stressful enough without having to pay $30/month for a decent resume template or $20 to check if your resume will pass an ATS. We've been there, and it's frustrating.
              </p>
              <p>
                So we built a set of tools that actually help — for free. Our <Link to="/tools/salary-calculator" className="text-primary hover:underline">Salary Calculator</Link> covers 40 cities across Canada and the US with current 2025-2026 data. The <Link to="/tools/resume-score" className="text-primary hover:underline">Resume Score Checker</Link> lets you upload a PDF or DOCX and get instant feedback. And if you're prepping for interviews, our <Link to="/tools/interview-prep" className="text-primary hover:underline">Interview Practice</Link> tool has hundreds of questions organized by industry.
              </p>
              <p>
                For recruiters, we've got tools to generate <Link to="/tools/job-description-generator" className="text-primary hover:underline">job descriptions</Link>, calculate <Link to="/tools/hiring-cost-calculator" className="text-primary hover:underline">hiring costs</Link>, and create <Link to="/tools/interview-scorecard" className="text-primary hover:underline">interview scorecards</Link> that keep your evaluation process consistent and fair.
              </p>
              <p>
                Everything runs in your browser — we don't store your data, and you don't need an account. If you want to take things further, <Link to="/register/seeker" className="text-primary hover:underline">Hireabble</Link> is a swipe-based job matching platform where you can discover and apply to roles in seconds.
              </p>
            </div>
          </div>

          {/* FAQ section */}
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold font-['Outfit'] mb-4">Frequently asked questions</h2>
            <div className="space-y-2">
              {FAQS.map((faq, i) => (
                <details key={i} className="group glass-card rounded-xl">
                  <summary className="px-4 py-3 cursor-pointer text-sm font-medium flex items-center justify-between">
                    {faq.q}
                    <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                  </summary>
                  <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
