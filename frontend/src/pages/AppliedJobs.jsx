import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, MapPin, DollarSign, Clock,
  CheckCircle, XCircle, Star, Zap, Building2, Eye, Rocket, Target,
  BarChart3, ChevronDown, ChevronUp, Search, Bookmark, Trash2,
  Calendar, X
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { SkeletonPageBackground, SkeletonListItem, SkeletonFilterTabs } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import PageTransition from '../components/PageTransition';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { key: 'applied', label: 'Applied', icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500' },
  { key: 'shortlisted', label: 'Shortlisted', icon: Star, color: 'text-purple-500', bg: 'bg-purple-500' },
  { key: 'interviewing', label: 'Interview', icon: Target, color: 'text-cyan-500', bg: 'bg-cyan-500' },
  { key: 'hired', label: 'Hired', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500' },
];

const LEGACY_STAGE_MAP = { reviewing: 'applied', offered: 'shortlisted' };

const STAGE_CONFIG = {
  applied: { label: 'Applied', color: 'bg-blue-500/10 text-blue-500', icon: Briefcase },
  shortlisted: { label: 'Shortlisted', color: 'bg-purple-500/10 text-purple-500', icon: Star },
  interviewing: { label: 'Interview', color: 'bg-cyan-500/10 text-cyan-500', icon: Target },
  hired: { label: 'Hired', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle },
  declined: { label: 'Not Selected', color: 'bg-red-500/10 text-red-500', icon: XCircle },
};

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max)}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function PipelineTracker({ stage }) {
  const declinedStage = stage === 'declined';
  const activeIndex = PIPELINE_STAGES.findIndex(s => s.key === stage);
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

function JobDetailSheet({ job, onClose, actions }) {
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

          {/* Actions */}
          {actions && (
            <div className="flex gap-3 pt-3 border-t border-border">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppliedJobs() {
  useDocumentTitle('Your Jobs');
  const navigate = useNavigate();
  const { token } = useAuth();

  // Top-level tab: 'applied' or 'saved'
  const [activeTab, setActiveTab] = useState('applied');

  // Applied state
  const [applications, setApplications] = useState([]);
  const [loadingApplied, setLoadingApplied] = useState(true);
  const [appliedFilter, setAppliedFilter] = useState('all');
  const [expandedInsights, setExpandedInsights] = useState({});
  const [loadingInsights, setLoadingInsights] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobContext, setSelectedJobContext] = useState(null); // 'applied' or 'saved'

  // Saved state
  const [savedJobs, setSavedJobs] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    fetchApplications();
    fetchSavedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await axios.get(`${API}/applications/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(response.data);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoadingApplied(false);
    }
  };

  const fetchSavedJobs = async () => {
    try {
      const res = await axios.get(`${API}/jobs/saved/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedJobs(res.data.jobs);
    } catch {
      // silent — may not have saved jobs
    } finally {
      setLoadingSaved(false);
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

  const handleApplySaved = async (jobId) => {
    try {
      await axios.post(`${API}/swipe`, { job_id: jobId, action: 'like' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedJobs(prev => prev.map(j => j.id === jobId ? { ...j, already_applied: true } : j));
      toast.success('Applied!');
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.toLowerCase().includes('already swiped')) {
        setSavedJobs(prev => prev.map(j => j.id === jobId ? { ...j, already_applied: true } : j));
      } else {
        toast.error(detail || 'Failed to apply');
      }
    }
  };

  const handleRemoveSaved = async (jobId) => {
    setSavedJobs(prev => prev.filter(j => j.id !== jobId));
    try {
      await axios.delete(`${API}/jobs/${jobId}/save`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.info('Removed from saved');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const getStage = (app) => {
    const raw = app.pipeline_stage || (app.status === 'matched' ? 'shortlisted' : app.status === 'declined' ? 'declined' : 'applied');
    return LEGACY_STAGE_MAP[raw] || raw;
  };

  const filteredApps = appliedFilter === 'all'
    ? applications
    : applications.filter(a => getStage(a) === appliedFilter);

  const appliedCounts = {
    all: applications.length,
    applied: applications.filter(a => getStage(a) === 'applied').length,
    shortlisted: applications.filter(a => getStage(a) === 'shortlisted').length,
    interviewing: applications.filter(a => getStage(a) === 'interviewing').length,
    hired: applications.filter(a => getStage(a) === 'hired').length,
    declined: applications.filter(a => getStage(a) === 'declined').length,
  };

  const isLoading = activeTab === 'applied' ? loadingApplied : loadingSaved;

  if (isLoading && ((activeTab === 'applied' && loadingApplied) || (activeTab === 'saved' && loadingSaved))) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <div className="space-y-2 mb-6">
            <Skeleton className="h-7 w-32 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
          </div>
          <SkeletonFilterTabs count={2} />
        </header>
        <main className="relative z-10 px-6 md:px-8 space-y-3">
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} badge />
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold font-['Outfit']">Your Jobs</h1>
          <p className="text-muted-foreground text-sm">
            {activeTab === 'applied'
              ? `${applications.length} application${applications.length !== 1 ? 's' : ''}`
              : `${savedJobs.length} saved job${savedJobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Main Tabs: Applied / Saved */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('applied')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'applied'
                ? 'bg-gradient-to-r from-primary to-secondary text-white'
                : 'glass-card hover:bg-accent text-muted-foreground'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Applied ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'saved'
                ? 'bg-gradient-to-r from-primary to-secondary text-white'
                : 'glass-card hover:bg-accent text-muted-foreground'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Saved ({savedJobs.length})
          </button>
        </div>

        {/* Applied sub-filter tabs */}
        {activeTab === 'applied' && applications.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'applied', label: 'Applied' },
              { key: 'shortlisted', label: 'Shortlisted' },
              { key: 'interviewing', label: 'Interview' },
              { key: 'hired', label: 'Hired' },
              { key: 'declined', label: 'Declined' },
            ].filter(tab => tab.key === 'all' || appliedCounts[tab.key] > 0).map(tab => (
              <button
                key={tab.key}
                onClick={() => setAppliedFilter(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  appliedFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'glass-card hover:bg-accent'
                }`}
              >
                {tab.label} ({appliedCounts[tab.key]})
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="relative z-10 px-6 md:px-8 space-y-3">
        {/* ===== APPLIED TAB ===== */}
        {activeTab === 'applied' && (
          <>
            {filteredApps.length === 0 ? (
              <div className="glass-card rounded-3xl p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Briefcase className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold font-['Outfit'] mb-3">
                  {appliedFilter === 'all' ? "You haven't applied to any jobs yet" : `No ${appliedFilter} applications`}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {appliedFilter === 'all'
                    ? 'Start swiping to find your next role!'
                    : 'No applications with this status.'}
                </p>
                {appliedFilter === 'all' && (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium"
                  >
                    Browse Jobs
                  </button>
                )}
              </div>
            ) : (
              filteredApps.map(app => {
                const stage = getStage(app);
                const stageConf = STAGE_CONFIG[stage] || STAGE_CONFIG.applied;
                const StageIcon = stageConf.icon;
                const job = app.job;

                return (
                  <div
                    key={app.id}
                    className="glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedJob(job); setSelectedJobContext('applied'); }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {job.company_logo ? (
                          <img src={job.company_logo} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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

                        <PipelineTracker stage={stage} />

                        {app.ranking?.percentile && (
                          <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold w-fit">
                            <Star className="w-3 h-3 fill-amber-400" />
                            Top {app.ranking.percentile}% of applicants
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {app.action === 'superlike' && <Rocket className="w-3 h-3 text-secondary" />}
                              {app.action === 'superlike' ? 'Priority Applied' : 'Applied'} {new Date(app.created_at).toLocaleDateString()}
                            </span>
                            {app.read_at && (
                              <span className="text-xs text-primary flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Viewed
                              </span>
                            )}
                          </div>
                          {app.status === 'matched' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate('/matches'); }}
                              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3" /> View Opportunity
                            </button>
                          )}
                        </div>

                        {app.has_insights && (
                          <div className="mt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleInsights(app.id); }}
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
          </>
        )}

        {/* ===== SAVED TAB ===== */}
        {activeTab === 'saved' && (
          <>
            {savedJobs.length === 0 ? (
              <div className="glass-card rounded-3xl p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Bookmark className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold font-['Outfit'] mb-3">No saved jobs yet</h2>
                <p className="text-muted-foreground mb-4">
                  Save jobs to review later by tapping the bookmark icon while browsing.
                </p>
                <button
                  onClick={() => navigate('/search')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium"
                >
                  Search Jobs
                </button>
              </div>
            ) : (
              <>
                {/* Not applied saved jobs */}
                {savedJobs.filter(j => !j.already_applied).map((job) => (
                  <div
                    key={job.id}
                    className="glass-card rounded-2xl p-4 hover:border-primary/20 transition-colors cursor-pointer"
                    onClick={() => { setSelectedJob(job); setSelectedJobContext('saved'); }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                        {job.company_logo ? (
                          <img src={job.company_logo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Briefcase className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                        <p className="text-sm text-muted-foreground">{job.company}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                          {job.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.location}
                            </span>
                          )}
                          {formatSalary(job.salary_min, job.salary_max) && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" /> {formatSalary(job.salary_min, job.salary_max)}
                            </span>
                          )}
                          {job.job_type && (
                            <span className="text-xs text-muted-foreground capitalize">{job.job_type}</span>
                          )}
                          {job.employment_type && (
                            <span className="text-xs text-muted-foreground capitalize">{job.employment_type}</span>
                          )}
                        </div>
                        {job.saved_at && (
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-1">
                            <Calendar className="w-2.5 h-2.5" /> Saved {timeAgo(job.saved_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApplySaved(job.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Quick Apply
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveSaved(job.id); }}
                        className="p-2 rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Already applied saved jobs */}
                {savedJobs.filter(j => j.already_applied).length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1 mt-4">Already Applied</p>
                    {savedJobs.filter(j => j.already_applied).map((job) => (
                      <div
                        key={job.id}
                        className="glass-card rounded-2xl p-4 opacity-60 hover:opacity-80 transition-opacity cursor-pointer"
                        onClick={() => { setSelectedJob(job); setSelectedJobContext('saved'); }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-5 h-5 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">{job.company}</p>
                            <span className="text-xs text-success font-medium">Applied</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveSaved(job.id); }}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Job Detail Sheet */}
      {selectedJob && (
        <JobDetailSheet
          job={selectedJob}
          onClose={() => { setSelectedJob(null); setSelectedJobContext(null); }}
          actions={selectedJobContext === 'saved' ? (
            <>
              {selectedJob.already_applied ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-success/10 text-success text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Applied
                </div>
              ) : (
                <button
                  onClick={() => { handleApplySaved(selectedJob.id); setSelectedJob(null); setSelectedJobContext(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Quick Apply
                </button>
              )}
              <button
                onClick={() => { handleRemoveSaved(selectedJob.id); setSelectedJob(null); setSelectedJobContext(null); }}
                className="py-2.5 px-4 rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 text-sm transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            </>
          ) : null}
        />
      )}

      <Navigation />
    </PageTransition>
  );
}
