import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, MapPin, DollarSign, Clock,
  CheckCircle, XCircle, Star, Zap, Building2, Eye,
  BarChart3, ChevronDown, ChevronUp, Search, UserCheck,
  CalendarCheck, Award, Trophy, X
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { SkeletonPageBackground, SkeletonListItem, SkeletonFilterTabs } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { key: 'applied', label: 'Applied', icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500' },
  { key: 'reviewing', label: 'Reviewing', icon: Eye, color: 'text-yellow-500', bg: 'bg-yellow-500' },
  { key: 'shortlisted', label: 'Shortlisted', icon: UserCheck, color: 'text-purple-500', bg: 'bg-purple-500' },
  { key: 'interviewing', label: 'Interviewing', icon: CalendarCheck, color: 'text-cyan-500', bg: 'bg-cyan-500' },
  { key: 'offered', label: 'Offered', icon: Award, color: 'text-orange-500', bg: 'bg-orange-500' },
  { key: 'hired', label: 'Hired', icon: Trophy, color: 'text-green-500', bg: 'bg-green-500' },
];

const STAGE_CONFIG = {
  applied: { label: 'Applied', color: 'bg-blue-500/10 text-blue-500', icon: Briefcase },
  reviewing: { label: 'In Review', color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  shortlisted: { label: 'Shortlisted', color: 'bg-purple-500/10 text-purple-500', icon: UserCheck },
  interviewing: { label: 'Interviewing', color: 'bg-cyan-500/10 text-cyan-500', icon: CalendarCheck },
  offered: { label: 'Offered', color: 'bg-orange-500/10 text-orange-500', icon: Award },
  hired: { label: 'Hired', color: 'bg-green-500/10 text-green-500', icon: Trophy },
  declined: { label: 'Not Selected', color: 'bg-red-500/10 text-red-500', icon: XCircle },
};

function PipelineTracker({ stage }) {
  const declinedStage = stage === 'declined';
  const activeIndex = PIPELINE_STAGES.findIndex(s => s.key === stage);
  // For declined, show progress up to 'applied' minimum
  const effectiveIndex = declinedStage ? 0 : activeIndex;

  return (
    <div className="flex items-center gap-0.5 mt-3">
      {PIPELINE_STAGES.map((s, i) => {
        const isCompleted = !declinedStage && i < effectiveIndex;
        const isCurrent = !declinedStage && i === effectiveIndex;
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full transition-colors ${
              isCompleted ? `${s.bg}` :
              isCurrent ? `${s.bg}` :
              declinedStage && i === 0 ? 'bg-red-500' :
              'bg-muted'
            }`} />
            {(isCurrent || (declinedStage && i === 0)) && (
              <span className={`text-[9px] font-medium ${declinedStage ? 'text-red-500' : s.color}`}>
                {declinedStage ? 'Declined' : s.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function JobDetailSheet({ job, onClose }) {
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  const salary = (job.salary_min || job.salary_max)
    ? (job.salary_min && job.salary_max ? `${fmt(job.salary_min)} - ${fmt(job.salary_max)}` : job.salary_min ? `${fmt(job.salary_min)}+` : `Up to ${fmt(job.salary_max)}`)
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 bg-card z-10 p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold font-['Outfit']">{job.title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center overflow-hidden">
              {job.company_logo ? (
                <img src={job.company_logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold">{job.company}</p>
              {job.location && <p className="text-sm text-muted-foreground">{job.location}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {salary && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {salary}
              </span>
            )}
            {job.job_type && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground capitalize">{job.job_type}</span>
            )}
            {job.employment_type && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-secondary/10 text-secondary capitalize">{job.employment_type}</span>
            )}
            {job.experience_level && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary capitalize">{job.experience_level}</span>
            )}
          </div>

          {job.description && (
            <div>
              <h3 className="font-semibold mb-2">About this role</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {job.requirements?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Requirements</h3>
              <div className="flex flex-wrap gap-2">
                {job.requirements.map((req, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground">{req}</span>
                ))}
              </div>
            </div>
          )}

          {job.benefits?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Benefits</h3>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-500">{b}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppliedJobs() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedInsights, setExpandedInsights] = useState({}); // { appId: insightsData }
  const [loadingInsights, setLoadingInsights] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await axios.get(`${API}/applications/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(response.data);
    } catch (error) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const toggleInsights = async (appId) => {
    if (expandedInsights[appId]) {
      setExpandedInsights(prev => { const n = { ...prev }; delete n[appId]; return n; });
      return;
    }
    setLoadingInsights(prev => ({ ...prev, [appId]: true }));
    try {
      const res = await axios.get(`${API}/applications/${appId}/insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpandedInsights(prev => ({ ...prev, [appId]: res.data }));
    } catch {
      toast.error('Could not load insights');
    } finally {
      setLoadingInsights(prev => ({ ...prev, [appId]: false }));
    }
  };

  const getStage = (app) => app.pipeline_stage || (app.status === 'matched' ? 'shortlisted' : app.status === 'declined' ? 'declined' : 'applied');

  const filtered = filter === 'all'
    ? applications
    : applications.filter(a => getStage(a) === filter);

  const counts = {
    all: applications.length,
    applied: applications.filter(a => getStage(a) === 'applied').length,
    reviewing: applications.filter(a => getStage(a) === 'reviewing').length,
    shortlisted: applications.filter(a => getStage(a) === 'shortlisted').length,
    interviewing: applications.filter(a => getStage(a) === 'interviewing').length,
    offered: applications.filter(a => getStage(a) === 'offered').length,
    hired: applications.filter(a => getStage(a) === 'hired').length,
    declined: applications.filter(a => getStage(a) === 'declined').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-32 rounded" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
          </div>
          <SkeletonFilterTabs count={4} />
        </header>
        <main className="relative z-10 px-6 md:px-8 space-y-3">
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Applied Jobs</h1>
            <p className="text-muted-foreground text-sm">{applications.length} application{applications.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'applied', label: 'Applied' },
            { key: 'reviewing', label: 'In Review' },
            { key: 'shortlisted', label: 'Shortlisted' },
            { key: 'interviewing', label: 'Interviewing' },
            { key: 'offered', label: 'Offered' },
            { key: 'hired', label: 'Hired' },
            { key: 'declined', label: 'Declined' },
          ].filter(tab => tab.key === 'all' || counts[tab.key] > 0).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'glass-card hover:bg-accent'
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-8 space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold font-['Outfit'] mb-3">
              {filter === 'all' ? 'No Applications Yet' : `No ${filter} applications`}
            </h2>
            <p className="text-muted-foreground">
              {filter === 'all'
                ? 'Start swiping right on jobs you like to apply!'
                : 'No applications with this status.'}
            </p>
          </div>
        ) : (
          filtered.map(app => {
            const stage = getStage(app);
            const stageConf = STAGE_CONFIG[stage] || STAGE_CONFIG.applied;
            const StageIcon = stageConf.icon;
            const job = app.job;

            return (
              <div
                key={app.id}
                className="glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-start gap-4">
                  {/* Company Logo */}
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {job.company_logo ? (
                      <img src={job.company_logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Building2 className="w-6 h-6 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold font-['Outfit'] truncate">{job.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 whitespace-nowrap ${stageConf.color}`}>
                        <StageIcon className="w-3 h-3" />
                        {stageConf.label}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">{job.company}</p>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                      )}
                      {job.job_type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground capitalize">
                          {job.job_type}
                        </span>
                      )}
                      {job.employment_type && job.employment_type !== 'full-time' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">
                          {job.employment_type}
                        </span>
                      )}
                      {(job.salary_min || job.salary_max) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {job.salary_min ? `$${(job.salary_min / 1000).toFixed(0)}k` : ''}
                          {job.salary_max ? `-$${(job.salary_max / 1000).toFixed(0)}k` : '+'}
                        </span>
                      )}
                    </div>

                    {/* Pipeline Progress Tracker */}
                    <PipelineTracker stage={stage} />

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {app.action === 'superlike' && <Star className="w-3 h-3 text-secondary fill-secondary" />}
                          {app.action === 'superlike' ? 'Super Liked' : 'Applied'} {new Date(app.created_at).toLocaleDateString()}
                        </span>
                        {app.read_at && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Viewed
                          </span>
                        )}
                      </div>
                      {app.status === 'matched' && (
                        <button
                          onClick={() => navigate('/matches')}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" /> View Match
                        </button>
                      )}
                    </div>

                    {/* Application Insights (Premium) */}
                    {app.has_insights && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleInsights(app.id)}
                          className="text-xs text-secondary font-medium flex items-center gap-1 hover:underline"
                        >
                          <BarChart3 className="w-3 h-3" />
                          {expandedInsights[app.id] ? 'Hide' : 'View'} Insights
                          {expandedInsights[app.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {loadingInsights[app.id] && (
                          <div className="mt-2 flex gap-2">
                            <Skeleton className="h-12 flex-1 rounded-lg" />
                            <Skeleton className="h-12 flex-1 rounded-lg" />
                            <Skeleton className="h-12 flex-1 rounded-lg" />
                          </div>
                        )}
                        {expandedInsights[app.id] && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-center">
                              <p className="text-lg font-bold text-primary">{expandedInsights[app.id].applied_rank || '—'}</p>
                              <p className="text-[10px] text-muted-foreground">Your Rank</p>
                            </div>
                            <div className="p-2 rounded-lg bg-secondary/10 text-center">
                              <p className="text-lg font-bold text-secondary">{expandedInsights[app.id].total_applicants}</p>
                              <p className="text-[10px] text-muted-foreground">Applicants</p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-500/10 text-center">
                              <p className="text-lg font-bold text-green-500">Top {expandedInsights[app.id].experience_percentile}%</p>
                              <p className="text-[10px] text-muted-foreground">Experience</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {selectedJob && (
        <JobDetailSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      <Navigation />
    </div>
  );
}
