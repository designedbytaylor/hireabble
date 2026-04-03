import { Link } from 'react-router-dom';
import { FileText, BarChart3, PenLine, DollarSign, MessageSquare, Kanban, GitCompare, Linkedin, ClipboardList, Calculator, Mail, Award } from 'lucide-react';
import { Button } from '../../components/ui/button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';

const SEEKER_TOOLS = [
  { path: '/tools/resume-builder', title: 'Resume Builder', description: 'Create a professional, ATS-friendly resume in minutes', icon: FileText },
  { path: '/tools/resume-score', title: 'Resume Score Checker', description: 'Get an instant score and tips to improve your resume', icon: BarChart3 },
  { path: '/tools/cover-letter-generator', title: 'Cover Letter Generator', description: 'Generate tailored cover letters for any job application', icon: PenLine },
  { path: '/tools/salary-calculator', title: 'Salary Calculator', description: 'Compare salaries across Canadian cities and roles', icon: DollarSign },
  { path: '/tools/interview-prep', title: 'Interview Practice', description: 'Practice with common interview questions by job category', icon: MessageSquare },
  { path: '/tools/job-tracker', title: 'Job Search Tracker', description: 'Track your applications with a drag-and-drop Kanban board', icon: Kanban },
  { path: '/tools/skills-gap', title: 'Skills Gap Analyzer', description: 'Discover which skills you need for your target role', icon: GitCompare },
  { path: '/tools/linkedin-headline', title: 'LinkedIn Headline Generator', description: 'Generate compelling LinkedIn headlines that stand out', icon: Linkedin },
];

const RECRUITER_TOOLS = [
  { path: '/tools/job-description-generator', title: 'Job Description Generator', description: 'Create structured job postings in seconds', icon: ClipboardList },
  { path: '/tools/hiring-cost-calculator', title: 'Hiring Cost Calculator', description: 'Calculate your true cost-per-hire and annual budget', icon: Calculator },
  { path: '/tools/offer-letter', title: 'Offer Letter Generator', description: 'Generate professional offer letters ready to send', icon: Mail },
  { path: '/tools/employer-brand-score', title: 'Employer Brand Scorecard', description: 'Assess your employer brand with a quick audit', icon: Award },
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

export default function ToolsIndex() {
  useDocumentTitle('Free Career & Hiring Tools');
  const { user } = useAuth();

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
          <p className="text-muted-foreground">
            Everything you need to land your dream job or find the perfect candidate — completely free.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold font-['Outfit'] mb-4 text-muted-foreground uppercase tracking-wider text-sm">For Job Seekers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {SEEKER_TOOLS.map(tool => <ToolCard key={tool.path} tool={tool} />)}
        </div>

        <h2 className="text-lg font-semibold font-['Outfit'] mb-4 text-muted-foreground uppercase tracking-wider text-sm">For Recruiters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {RECRUITER_TOOLS.map(tool => <ToolCard key={tool.path} tool={tool} />)}
        </div>
      </div>
    </div>
  );
}
