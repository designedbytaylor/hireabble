import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Briefcase, Users, Star, Heart, X, Check, Rocket, MessageCircle,
  MapPin, DollarSign, Building2, ChevronRight, Clock,
  Edit, GraduationCap, Trash2, BarChart3, Calendar, Globe,
  FileText, Send, Info, Copy, Upload, Sparkles, Wand2, Image as ImageIcon, Printer, Zap,
  Pause, Play
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import NotificationBell from '../components/NotificationBell';
import LocationInput from '../components/LocationInput';
import { getPhotoUrl } from '../utils/helpers';
import { UpgradePrompt, PremiumBlur } from '../components/UpgradeModal';
import { SkeletonPageBackground, SkeletonStatCard, SkeletonListItem, SkeletonApplicantCard } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import LocationAutocomplete from '../components/LocationAutocomplete';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterDashboard() {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState({ active_jobs: 0, total_applications: 0, super_likes: 0, matches: 0 });
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  // Tracks which app IDs the free-tier recruiter can see (persisted across navigation)
  const unlockedAppIds = useRef(() => {
    try {
      const stored = sessionStorage.getItem('unlockedAppIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  // Lazily initialize the ref (useState-style initializer isn't supported by useRef)
  if (typeof unlockedAppIds.current === 'function') {
    unlockedAppIds.current = unlockedAppIds.current();
  }
  const [loading, setLoading] = useState(true);
  const [showNewJob, setShowNewJob] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobApplications, setJobApplications] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [requestingRefs, setRequestingRefs] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // job ID to delete
  const [confirmPause, setConfirmPause] = useState(null); // job to pause/activate
  const [showPriorityApplies, setShowPriorityApplies] = useState(false);
  const [showAllApplicants, setShowAllApplicants] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [posterJob, setPosterJob] = useState(null);
  const [posterOptions, setPosterOptions] = useState({ salary: true, location: true, jobType: true, experienceLevel: true });

  useEffect(() => {
    const isPaymentReturn = searchParams.get('payment') === 'success' && searchParams.get('session_id');
    if (!isPaymentReturn) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verify Stripe payment on return from checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (searchParams.get('payment') === 'success' && sessionId && token) {
      window.history.replaceState({}, '', window.location.pathname);
      const verifyPayment = async (retries = 3) => {
        try {
          const res = await axios.get(`${API}/payments/verify-session/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data.status === 'paid') {
            toast.success('Payment successful! Your subscription is now active.');
            await refreshUser();
            fetchData();
          } else if (retries > 0) {
            setTimeout(() => verifyPayment(retries - 1), 2000);
          }
        } catch {
          if (retries > 0) {
            setTimeout(() => verifyPayment(retries - 1), 2000);
          } else {
            toast.success('Payment received! Your subscription will activate shortly.');
            await refreshUser();
            fetchData();
          }
        }
      };
      verifyPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      // Single batched call replaces 4 separate API requests
      const response = await axios.get(`${API}/recruiter/dashboard-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setStats(data.stats);
      setJobs(data.jobs);
      setApplications(data.applications);
      // Only snapshot unlocked IDs if we don't already have a persisted set
      if (unlockedAppIds.current.size === 0) {
        const pending = (data.applications || []).filter(a => !a.recruiter_action);
        const ids = pending.slice(0, 3).map(a => a.id);
        unlockedAppIds.current = new Set(ids);
        try { sessionStorage.setItem('unlockedAppIds', JSON.stringify(ids)); } catch {}
      }
      setSubscription(data.subscription);
      // Fetch interviews in parallel (non-blocking)
      axios.get(`${API}/interviews`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setInterviews(res.data))
        .catch(() => {});
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewApplications = async (job) => {
    setSelectedJob(job);
    try {
      const response = await axios.get(`${API}/applications?job_id=${job.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobApplications(response.data);
    } catch (error) {
      toast.error('Failed to fetch applications');
    }
  };

  const handleRespondToApplication = async (applicationId, action) => {
    const optimisticUpdate = { recruiter_action: action === 'accept' ? 'accept' : 'reject', pipeline_stage: action === 'accept' ? 'shortlisted' : 'declined' };
    // Optimistic UI: update state immediately so the card moves/disappears instantly
    setApplications(prev => prev.map(a =>
      a.id === applicationId ? { ...a, ...optimisticUpdate } : a
    ));
    // Also update jobApplications so the job detail modal reflects changes instantly
    setJobApplications(prev => prev.map(a =>
      a.id === applicationId ? { ...a, ...optimisticUpdate } : a
    ));
    setStats(prev => ({
      ...prev,
      pending_applications: Math.max(0, (prev.pending_applications || 0) - 1),
      pipeline_counts: {
        ...prev.pipeline_counts,
        applied: Math.max(0, (prev.pipeline_counts?.applied || 0) - 1),
        shortlisted: action === 'accept' ? (prev.pipeline_counts?.shortlisted || 0) + 1 : (prev.pipeline_counts?.shortlisted || 0),
      },
    }));

    if (action === 'accept') {
      toast.success("Candidate shortlisted!");
    } else {
      toast.info('Candidate archived');
    }

    // Fire API call in background — revert on failure
    try {
      await axios.post(`${API}/applications/respond`,
        { application_id: applicationId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // No fetchData() here — optimistic state is already correct.
      // Calling fetchData() would overwrite in-flight optimistic updates
      // when multiple actions are taken quickly.
    } catch (error) {
      toast.error('Failed to respond — reverting');
      // Revert optimistic update
      setApplications(prev => prev.map(a =>
        a.id === applicationId ? { ...a, recruiter_action: null, pipeline_stage: 'applied' } : a
      ));
      setJobApplications(prev => prev.map(a =>
        a.id === applicationId ? { ...a, recruiter_action: null, pipeline_stage: 'applied' } : a
      ));
      setStats(prev => ({
        ...prev,
        matches: action === 'accept' ? Math.max(0, (prev.matches || 0) - 1) : prev.matches,
        pending_applications: (prev.pending_applications || 0) + 1,
      }));
    }
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
  };

  const handleDeleteJob = async (jobId) => {
    try {
      await axios.delete(`${API}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Immediately remove from UI
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setApplications(prev => prev.filter(a => a.job_id !== jobId));
      setStats(prev => ({ ...prev, active_jobs: Math.max(0, prev.active_jobs - 1) }));
      toast.success('Job deleted');
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  const handleDuplicateJob = async (jobId) => {
    try {
      const res = await axios.post(`${API}/jobs/${jobId}/duplicate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Add the duplicated job to the list immediately
      if (res.data) {
        setJobs(prev => [res.data, ...prev]);
      } else {
        fetchData();
      }
      toast.success('Job duplicated as inactive draft. Activate it when ready to publish.');
    } catch {
      toast.error('Failed to duplicate job');
    }
  };

  const handleToggleJobStatus = async (job) => {
    const newActive = !job.is_active;
    try {
      await axios.put(`${API}/jobs/${job.id}/status`, { is_active: newActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_active: newActive } : j));
      setStats(prev => ({
        ...prev,
        active_jobs: newActive ? prev.active_jobs + 1 : Math.max(0, prev.active_jobs - 1)
      }));
      toast.success(newActive ? 'Job activated! Candidates can now see it.' : 'Job paused. It won\'t appear in search.');
    } catch {
      toast.error('Failed to update job status');
    }
    setConfirmPause(null);
  };

  const [generatingPoster, setGeneratingPoster] = useState(null);
  const [boostingJob, setBoostingJob] = useState(null);

  const handleFreeBoost = async (jobId) => {
    setBoostingJob(jobId);
    try {
      const res = await axios.post(`${API}/payments/boosts/free`,
        { job_id: jobId, product_id: 'boost_1day' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to boost');
    } finally {
      setBoostingJob(null);
    }
  };

  // Find the most relevant interview for a candidate
  const getInterviewForCandidate = (app) => {
    if (!app || !interviews.length) return null;
    return interviews.find(i =>
      i.seeker_id === app.seeker_id &&
      (i.status === 'pending' || i.status === 'accepted' || i.status === 'rescheduled')
    ) || null;
  };

  const handleGeneratePoster = async (jobId, options = {}) => {
    setGeneratingPoster(jobId);
    setPosterJob(null);
    try {
      const params = new URLSearchParams();
      if (options.salary === false) params.append('show_salary', 'false');
      if (options.location === false) params.append('show_location', 'false');
      if (options.jobType === false) params.append('show_job_type', 'false');
      if (options.experienceLevel === false) params.append('show_experience', 'false');
      const qs = params.toString();
      const response = await axios.get(`${API}/jobs/${jobId}/poster${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      // Try opening in new window (works on desktop); fall back to download if popup blocked (mobile)
      const newWindow = window.open(url, '_blank');
      if (!newWindow || newWindow.closed) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Hiring_Poster.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error('Failed to generate poster');
    } finally {
      setGeneratingPoster(null);
    }
  };

  const handleViewResume = async (seekerId) => {
    setLoadingResume(true);
    try {
      const response = await axios.get(`${API}/applicant/${seekerId}/resume/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      let message = 'Failed to load resume';
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          message = json.detail || message;
        } catch {}
      } else if (error.response?.data?.detail) {
        message = error.response.data.detail;
      }
      toast.error(message);
    } finally {
      setLoadingResume(false);
    }
  };

  const handleRequestReferences = async (seekerId) => {
    setRequestingRefs(true);
    try {
      await axios.post(`${API}/references/request/${seekerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Reference request sent! The candidate will be notified.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to request references');
    } finally {
      setRequestingRefs(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <Skeleton className="h-7 w-36 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
            <Skeleton className="w-24 h-10 rounded-full" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SkeletonStatCard variant="bento" />
            <SkeletonStatCard variant="bento" />
            <SkeletonStatCard variant="bento" />
            <SkeletonStatCard variant="bento" />
          </div>
        </header>
        <main className="relative z-10 px-6 md:px-8">
          <section className="mb-8">
            <Skeleton className="h-6 w-40 rounded mb-4" />
            <div className="flex gap-4 overflow-x-auto pb-4">
              <SkeletonApplicantCard />
              <SkeletonApplicantCard />
              <SkeletonApplicantCard />
              <SkeletonApplicantCard />
            </div>
          </section>
          <section>
            <Skeleton className="h-6 w-28 rounded mb-4" />
            <div className="space-y-4">
              <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={2} />
              <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={2} />
              <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={2} />
            </div>
          </section>
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/logo-white.svg" alt="Hireabble" className="w-9 h-9" />
            <div>
              <h1 className="text-2xl font-bold font-['Outfit']">Recruiter Hub</h1>
              <p className="text-muted-foreground">{user?.company || 'Your Company'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => navigate('/interviews')}
              className="p-2.5 rounded-xl hover:bg-accent transition-colors"
              title="Interviews"
            >
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/recruiter/analytics')}
              className="p-2.5 rounded-xl hover:bg-accent transition-colors"
              title="Analytics"
            >
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </button>
            <img
              src={getPhotoUrl(user?.photo_url, user?.name || user?.id) || user?.avatar}
              alt="Profile"
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full border-2 border-primary/50 object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'R')}`; }}
            />
          </div>
        </div>

        {/* Post Job Button - Full Width */}
        <button
          onClick={() => setShowNewJob(true)}
          data-testid="post-job-btn"
          className="w-full md:w-auto md:px-8 flex items-center justify-center gap-2 py-3 mb-6 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-medium text-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          Post a New Job
        </button>

        {/* Stats Grid - Bento Style (Clickable) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors cursor-pointer active:scale-[0.97]"
            onClick={() => {/* scroll to jobs section below */
              document.getElementById('your-jobs-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.active_jobs}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">Active Jobs <ChevronRight className="w-3 h-3" /></div>
          </div>
          <div
            className="glass-card rounded-2xl p-5 hover:border-success/30 transition-colors cursor-pointer active:scale-[0.97]"
            onClick={() => setShowAllApplicants(true)}
          >
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-success" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.pipeline_counts?.applied || 0}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">New Applicants <ChevronRight className="w-3 h-3" /></div>
          </div>
          <div
            className="glass-card rounded-2xl p-5 hover:border-secondary/30 transition-colors cursor-pointer active:scale-[0.97]"
            onClick={() => setShowPriorityApplies(true)}
          >
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-3">
              <Rocket className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.super_likes}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">Priority Applies <ChevronRight className="w-3 h-3" /></div>
          </div>
          <div
            className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors cursor-pointer active:scale-[0.97]"
            onClick={() => navigate('/recruiter/pipeline?stage=shortlisted')}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.pipeline_counts?.shortlisted || 0}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">Shortlisted <ChevronRight className="w-3 h-3" /></div>
          </div>
        </div>

        {/* Pipeline Stage Counts */}
        {stats.pipeline_counts && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {[
              { key: 'applied', label: 'Applied', icon: '🆕', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
              { key: 'shortlisted', label: 'Shortlisted', icon: '⭐', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
              { key: 'interviewing', label: 'Interview', icon: '🎯', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
              { key: 'hired', label: 'Hired', icon: '✅', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
            ].map(stage => (
              <div
                key={stage.key}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap ${stage.color}`}
              >
                <span>{stage.icon}</span>
                <span>{stage.label}</span>
                <span className="font-bold">{stats.pipeline_counts[stage.key] || 0}</span>
              </div>
            ))}
          </div>
        )}
        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          <button
            onClick={() => navigate('/recruiter/search')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
          >
            🔍 Search Candidates
          </button>
          <button
            onClick={() => navigate('/recruiter/pipeline')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-sm font-medium text-purple-400 hover:bg-purple-500/20 transition-colors whitespace-nowrap"
          >
            📋 View Pipeline
          </button>
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-sm font-medium text-secondary hover:bg-secondary/20 transition-colors whitespace-nowrap"
          >
            ➕ Post Job
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 md:px-8">
        {/* Boost Prompt - only show if not subscribed */}
        {!subscription?.subscribed && (
          <section className="mb-6">
            <UpgradePrompt
              title="Boost Your Job Listings"
              subtitle="Get 3x more visibility and reach top candidates faster"
              tierHint="recruiter_pro"
              trigger="boost"
              onSubscribed={fetchData}
            />
          </section>
        )}

        {/* Applicant Pipeline */}
        <section className="mb-8">
          {applications.length > 0 ? (
            <>
              {/* New Applied */}
              {applications.filter(a => !a.pipeline_stage || a.pipeline_stage === 'applied').length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold font-['Outfit'] mb-4 flex items-center gap-2">
                    🆕 New Applied
                    <span className="text-sm font-normal text-muted-foreground">({applications.filter(a => !a.pipeline_stage || a.pipeline_stage === 'applied').length})</span>
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {applications.filter(a => !a.pipeline_stage || a.pipeline_stage === 'applied').slice(0, 10).map((app, appIndex) => (
                      <PremiumBlur
                        key={app.id}
                        isUnlocked={subscription?.subscribed || unlockedAppIds.current.has(app.id)}
                        tierHint="recruiter_pro"
                        trigger="blurred"
                      >
                      <div
                        className="glass-card rounded-2xl p-4 min-w-[220px] flex-shrink-0 relative cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => setSelectedCandidate(app)}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                            alt={app.seeker_name}
                            className="w-14 h-14 rounded-full border-2 border-primary/50 object-cover"
                            loading="lazy"
                          />
                          {app.action === 'superlike' && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/20">
                              <Rocket className="w-3.5 h-3.5 text-secondary" />
                              <span className="text-[10px] font-bold text-secondary">Priority</span>
                            </div>
                          )}
                        </div>
                        <div className="font-medium truncate">{app.seeker_name}</div>
                        <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                        {app.seeker_experience && (
                          <div className="text-xs text-muted-foreground mt-1">{app.seeker_experience}+ years exp</div>
                        )}
                        {app.job_title && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3 flex-shrink-0" /> {app.job_title}
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'reject'); }}
                            className="flex-1 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            data-testid={`reject-${app.id}`}
                          >
                            <X className="w-4 h-4 mx-auto" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'accept'); }}
                            className="flex-1 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                            data-testid={`accept-${app.id}`}
                          >
                            <Check className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>
                      </PremiumBlur>
                    ))}
                  </div>
                </div>
              )}

              {/* Shortlisted */}
              {applications.filter(a => a.pipeline_stage === 'shortlisted').length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold font-['Outfit'] mb-4 flex items-center gap-2">
                    ⭐ Shortlisted
                    <span className="text-sm font-normal text-muted-foreground">({applications.filter(a => a.pipeline_stage === 'shortlisted').length})</span>
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {applications.filter(a => a.pipeline_stage === 'shortlisted').map((app) => (
                      <div
                        key={app.id}
                        className="glass-card rounded-2xl p-4 min-w-[220px] flex-shrink-0 relative cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => setSelectedCandidate(app)}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                            alt={app.seeker_name}
                            className="w-14 h-14 rounded-full border-2 border-amber-500/50 object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="font-medium truncate">{app.seeker_name}</div>
                        <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                        {app.seeker_experience && (
                          <div className="text-xs text-muted-foreground mt-1">{app.seeker_experience}+ years exp</div>
                        )}
                        {app.job_title && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3 flex-shrink-0" /> {app.job_title}
                          </div>
                        )}
                        {(() => {
                          const interview = getInterviewForCandidate(app);
                          if (interview?.status === 'pending' || interview?.status === 'rescheduled') {
                            return (
                              <div className="mt-3 py-2 rounded-lg text-center text-sm bg-purple-500/10 text-purple-400 flex items-center justify-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                Interview Pending
                              </div>
                            );
                          }
                          return (
                            <div className="mt-3 py-2 rounded-lg text-center text-sm bg-amber-500/10 text-amber-400">
                              Shortlisted
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interviewing */}
              {applications.filter(a => a.pipeline_stage === 'interviewing').length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold font-['Outfit'] mb-4 flex items-center gap-2">
                    🎯 Interviewing
                    <span className="text-sm font-normal text-muted-foreground">({applications.filter(a => a.pipeline_stage === 'interviewing').length})</span>
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {applications.filter(a => a.pipeline_stage === 'interviewing').map((app) => (
                      <div
                        key={app.id}
                        className="glass-card rounded-2xl p-4 min-w-[220px] flex-shrink-0 relative cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => setSelectedCandidate(app)}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                            alt={app.seeker_name}
                            className="w-14 h-14 rounded-full border-2 border-purple-500/50 object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="font-medium truncate">{app.seeker_name}</div>
                        <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                        {app.seeker_experience && (
                          <div className="text-xs text-muted-foreground mt-1">{app.seeker_experience}+ years exp</div>
                        )}
                        {app.job_title && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3 flex-shrink-0" /> {app.job_title}
                          </div>
                        )}
                        <div className="mt-3 py-2 rounded-lg text-center text-sm bg-purple-500/10 text-purple-400">
                          Interviewing
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No applications yet. Post a job to get started!</p>
            </div>
          )}
        </section>

        {/* Your Jobs */}
        <section id="your-jobs-section">
          <h2 className="text-xl font-bold font-['Outfit'] mb-4">Your Jobs</h2>
          
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={`glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors ${!job.is_active ? 'opacity-70' : ''}`}
                  data-testid={`job-item-${job.id}`}
                >
                  <div
                    className="flex items-start gap-4 cursor-pointer"
                    onClick={() => handleViewApplications(job)}
                  >
                    <img
                      src={job.company_logo}
                      alt={job.company}
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold font-['Outfit'] text-lg truncate">{job.title}</h3>
                        {!job.is_active && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold shrink-0">PAUSED</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 rounded-lg bg-accent text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-accent text-xs text-muted-foreground capitalize">
                          {job.job_type}
                        </span>
                        {job.salary_min && (
                          <span className="px-2 py-1 rounded-lg bg-primary/10 text-xs text-primary flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${Math.round(job.salary_min/1000)}k+
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditJob(job); }}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors text-xs text-muted-foreground"
                      data-testid={`edit-job-${job.id}`}
                    >
                      <Edit className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicateJob(job.id); }}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors text-xs text-muted-foreground"
                      title="Duplicate job"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPosterJob(job); setPosterOptions({ salary: true, location: true, jobType: true, experienceLevel: true }); }}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-accent transition-colors text-xs text-muted-foreground"
                      title="Generate hiring poster"
                      disabled={generatingPoster === job.id}
                    >
                      {generatingPoster === job.id ? (
                        <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Poster</span>
                    </button>
                    {subscription?.subscribed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFreeBoost(job.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-secondary/10 transition-colors text-xs text-secondary"
                        disabled={boostingJob === job.id}
                        title="Use free monthly boost"
                      >
                        {boostingJob === job.id ? (
                          <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Boost</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmPause(job); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg transition-colors text-xs ${
                        job.is_active
                          ? 'hover:bg-amber-500/10 text-amber-400'
                          : 'hover:bg-green-500/10 text-green-400'
                      }`}
                      title={job.is_active ? 'Pause job listing' : 'Activate job listing'}
                    >
                      {job.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span className="hidden sm:inline">{job.is_active ? 'Pause' : 'Activate'}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(job.id); }}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-destructive/10 transition-colors text-xs text-destructive"
                      data-testid={`delete-job-${job.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">You haven't posted any jobs yet.</p>
              <Button 
                onClick={() => setShowNewJob(true)}
                className="bg-gradient-to-r from-primary to-secondary rounded-full"
              >
                <Plus className="w-5 h-5 mr-2" />
                Post Your First Job
              </Button>
            </div>
          )}
        </section>
      </main>

      {/* New Job Dialog */}
      <JobFormDialog 
        open={showNewJob}
        onClose={() => setShowNewJob(false)}
        onSuccess={() => {
          setShowNewJob(false);
          fetchData();
        }}
        token={token}
        company={user?.company}
      />

      {/* Edit Job Dialog */}
      <JobFormDialog 
        open={!!editingJob}
        onClose={() => setEditingJob(null)}
        onSuccess={() => {
          setEditingJob(null);
          fetchData();
        }}
        token={token}
        company={user?.company}
        job={editingJob}
        isEditing
      />

      {/* Job Applications Dialog - Enhanced */}
      <JobApplicationsDialog
        selectedJob={selectedJob}
        onClose={() => setSelectedJob(null)}
        jobApplications={jobApplications}
        onViewCandidate={(app) => { setSelectedJob(null); setSelectedCandidate(app); }}
        onRespond={handleRespondToApplication}
        subscription={subscription}
        unlockedAppIds={unlockedAppIds.current}
      />

      {/* Candidate Detail Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-md bg-card border-border p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-0 flex-shrink-0">
            <DialogTitle className="font-['Outfit']">Candidate Profile</DialogTitle>
          </DialogHeader>

          {selectedCandidate && (
            <div className="overflow-y-auto flex-1 p-6 pt-4 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Photo and Basic Info */}
              <div className="flex items-center gap-4">
                <img 
                  src={getPhotoUrl(selectedCandidate.seeker_photo || selectedCandidate.seeker_avatar, selectedCandidate.seeker_name || selectedCandidate.seeker_id)}
                  alt={selectedCandidate.seeker_name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary/50"
                />
                <div>
                  <h3 className="text-xl font-bold font-['Outfit']">{selectedCandidate.seeker_name}</h3>
                  <p className="text-primary font-medium">{selectedCandidate.seeker_title || 'Job Seeker'}</p>
                  {selectedCandidate.seeker_location && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {selectedCandidate.seeker_location}
                    </p>
                  )}
                  {selectedCandidate.job_title && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Briefcase className="w-3 h-3" /> Applied for: {selectedCandidate.job_title}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                {selectedCandidate.seeker_experience && (
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <div className="text-xs text-muted-foreground">Experience</div>
                    <div className="font-medium">{selectedCandidate.seeker_experience}+ years</div>
                  </div>
                )}
                {selectedCandidate.seeker_current_employer && (
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <div className="text-xs text-muted-foreground">Current</div>
                    <div className="font-medium truncate">{selectedCandidate.seeker_current_employer}</div>
                  </div>
                )}
                {selectedCandidate.seeker_school && (
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <div className="text-xs text-muted-foreground">Education</div>
                    <div className="font-medium truncate">{selectedCandidate.seeker_school}</div>
                  </div>
                )}
                {selectedCandidate.seeker_degree && (
                  <div className="p-3 rounded-xl bg-background border border-border">
                    <div className="text-xs text-muted-foreground">Degree</div>
                    <div className="font-medium truncate capitalize">{selectedCandidate.seeker_degree.replace('_', ' ')}</div>
                  </div>
                )}
              </div>

              {/* Video Introduction */}
              {selectedCandidate.seeker_video && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/20 text-secondary text-xs font-medium">
                      Video Intro
                    </span>
                  </div>
                  <video
                    src={selectedCandidate.seeker_video.startsWith('http') 
                      ? selectedCandidate.seeker_video 
                      : `${process.env.REACT_APP_BACKEND_URL}${selectedCandidate.seeker_video}`}
                    className="w-full rounded-xl aspect-video object-contain bg-black/5"
                    controls
                    playsInline
                    data-testid="candidate-video"
                  />
                </div>
              )}

              {/* Skills */}
              {selectedCandidate.seeker_skills?.length > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Skills</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.seeker_skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume & References */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewResume(selectedCandidate.seeker_id)}
                  disabled={loadingResume}
                  className="flex-1 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                >
                  {loadingResume ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  View Full Resume
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRequestReferences(selectedCandidate.seeker_id)}
                  disabled={requestingRefs}
                  className="flex-1 rounded-xl border-secondary/30 text-secondary hover:bg-secondary/10"
                >
                  {requestingRefs ? (
                    <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Request References
                </Button>
              </div>

              {/* Action Buttons */}
              {!selectedCandidate.recruiter_action ? (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      handleRespondToApplication(selectedCandidate.id, 'reject');
                      setSelectedCandidate(null);
                    }}
                  >
                    <X className="w-5 h-5 mr-2" />
                    Pass
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-primary to-secondary"
                    onClick={() => {
                      handleRespondToApplication(selectedCandidate.id, 'accept');
                      setSelectedCandidate(null);
                    }}
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Shortlist
                  </Button>
                </div>
              ) : selectedCandidate.recruiter_action === 'accept' ? (
                <div className="space-y-3">
                  {/* Interview Status */}
                  {(() => {
                    const interview = getInterviewForCandidate(selectedCandidate);
                    if (interview?.status === 'accepted' && interview.selected_time) {
                      const dt = new Date(interview.selected_time.start);
                      return (
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <div className="flex items-center gap-2 text-purple-400 font-medium mb-1">
                            <Calendar className="w-4 h-4" />
                            Interview Scheduled
                          </div>
                          <p className="text-sm text-foreground">
                            {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 capitalize">{interview.interview_type?.replace('_', ' ') || 'Video'} call</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCandidate(null);
                              navigate('/interviews');
                            }}
                            className="mt-2 text-xs text-purple-400 hover:bg-purple-500/10 px-2 py-1 h-auto"
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            Reschedule
                          </Button>
                        </div>
                      );
                    } else if (interview?.status === 'pending' || interview?.status === 'rescheduled') {
                      return (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-center gap-2 text-amber-400 font-medium mb-1">
                            <Clock className="w-4 h-4" />
                            Interview Pending
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Waiting for {selectedCandidate.seeker_name} to confirm the interview time.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
                          <Rocket className="w-4 h-4" />
                          Candidate shortlisted
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This candidate applied and you shortlisted them. You can now message them or review their resume.
                        </p>
                      </div>
                    );
                  })()}
                  <Button
                    size="sm"
                    onClick={() => {
                      const matchId = selectedCandidate.match_id;
                      setSelectedCandidate(null);
                      navigate(matchId ? `/chat/${matchId}` : '/messages');
                    }}
                    className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary"
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" />
                    Message
                  </Button>
                  {(() => {
                    const interview = getInterviewForCandidate(selectedCandidate);
                    if (interview?.status === 'pending' || interview?.status === 'rescheduled') {
                      return (
                        <>
                          <Button
                            size="sm"
                            disabled
                            className="w-full rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 opacity-80 cursor-not-allowed"
                            variant="outline"
                          >
                            <Clock className="w-4 h-4 mr-1.5" />
                            Interview Pending
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const app = selectedCandidate;
                              setSelectedCandidate(null);
                              const params = app.match_id ? `?match=${app.match_id}` : `?seeker=${app.seeker_id}`;
                              navigate(`/interviews${params}`);
                            }}
                            className="w-full rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30"
                            variant="outline"
                          >
                            <Calendar className="w-4 h-4 mr-1.5" />
                            Request Reschedule
                          </Button>
                        </>
                      );
                    }
                    return (
                      <Button
                        size="sm"
                        onClick={() => {
                          const app = selectedCandidate;
                          setSelectedCandidate(null);
                          const params = app.match_id ? `?match=${app.match_id}` : `?seeker=${app.seeker_id}`;
                          navigate(`/interviews${params}`);
                        }}
                        className="w-full rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30"
                        variant="outline"
                      >
                        <Calendar className="w-4 h-4 mr-1.5" />
                        {interview ? 'Edit Interview' : 'Schedule Interview'}
                      </Button>
                    );
                  })()}
                  {selectedCandidate.pipeline_stage !== 'hired' && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const app = selectedCandidate;
                        try {
                          await axios.put(`${API}/applications/${app.id}/stage`,
                            { stage: 'hired' },
                            { headers: { Authorization: `Bearer ${token}` } }
                          );
                          setApplications(prev => prev.map(a =>
                            a.id === app.id ? { ...a, pipeline_stage: 'hired' } : a
                          ));
                          setStats(prev => ({
                            ...prev,
                            pipeline_counts: {
                              ...prev.pipeline_counts,
                              hired: (prev.pipeline_counts?.hired || 0) + 1,
                              ...(app.pipeline_stage === 'interviewing' ? { interviewing: Math.max(0, (prev.pipeline_counts?.interviewing || 0) - 1) } : {}),
                              ...(app.pipeline_stage === 'shortlisted' ? { shortlisted: Math.max(0, (prev.pipeline_counts?.shortlisted || 0) - 1) } : {}),
                            },
                          }));
                          setSelectedCandidate(null);
                          toast.success(`${app.seeker_name} marked as hired!`);
                        } catch {
                          toast.error('Failed to update candidate');
                        }
                      }}
                      className="w-full rounded-xl bg-success/20 border border-success/30 text-success hover:bg-success/30"
                      variant="outline"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Mark as Hired
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const app = selectedCandidate;
                      try {
                        await axios.put(`${API}/applications/${app.id}/stage`,
                          { stage: 'declined' },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        setApplications(prev => prev.map(a =>
                          a.id === app.id ? { ...a, pipeline_stage: 'declined', recruiter_action: 'reject' } : a
                        ));
                        setStats(prev => ({
                          ...prev,
                          pipeline_counts: {
                            ...prev.pipeline_counts,
                            ...(app.pipeline_stage === 'interviewing' ? { interviewing: Math.max(0, (prev.pipeline_counts?.interviewing || 0) - 1) } : {}),
                            ...(app.pipeline_stage === 'shortlisted' ? { shortlisted: Math.max(0, (prev.pipeline_counts?.shortlisted || 0) - 1) } : {}),
                            ...(app.pipeline_stage === 'hired' ? { hired: Math.max(0, (prev.pipeline_counts?.hired || 0) - 1) } : {}),
                          },
                        }));
                        setSelectedCandidate(null);
                        toast.info('Candidate declined');
                      } catch {
                        toast.error('Failed to update candidate');
                      }
                    }}
                    className="w-full rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Pass on Applicant
                  </Button>
                </div>
              ) : (
                <div className="py-3 rounded-xl text-center font-medium bg-muted text-muted-foreground">
                  You passed on this candidate
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete job posting?"
        description="This will permanently remove the job and all associated applications. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { handleDeleteJob(confirmDelete); setConfirmDelete(null); }}
      />

      <ConfirmDialog
        open={!!confirmPause}
        onOpenChange={(open) => { if (!open) setConfirmPause(null); }}
        title={confirmPause?.is_active ? 'Pause this job listing?' : 'Activate this job listing?'}
        description={
          confirmPause?.is_active
            ? 'This job will be hidden from candidates. You can reactivate it at any time.'
            : 'This job will become visible to candidates and they can apply to it.'
        }
        confirmLabel={confirmPause?.is_active ? 'Pause' : 'Activate'}
        variant={confirmPause?.is_active ? 'default' : 'default'}
        onConfirm={() => handleToggleJobStatus(confirmPause)}
      />

      {/* Poster Options Dialog */}
      <Dialog open={!!posterJob} onOpenChange={(open) => { if (!open) setPosterJob(null); }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] flex items-center gap-2">
              <Printer className="w-5 h-5" /> Customize Poster
            </DialogTitle>
          </DialogHeader>
          {posterJob && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose what to display on the hiring poster for <span className="font-medium text-foreground">{posterJob.title}</span>.</p>
              <div className="space-y-3">
                {[
                  { key: 'salary', label: 'Salary Range', desc: posterJob.salary_min ? `$${Number(posterJob.salary_min).toLocaleString()}${posterJob.salary_max ? ` – $${Number(posterJob.salary_max).toLocaleString()}` : '+'}` : 'Not set' },
                  { key: 'location', label: 'Location', desc: posterJob.location || 'Not set' },
                  { key: 'jobType', label: 'Job Type', desc: posterJob.employment_type || posterJob.job_type || 'Not set' },
                  { key: 'experienceLevel', label: 'Experience Level', desc: posterJob.experience_level || 'Not set' },
                ].map(opt => (
                  <div key={opt.key} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                    <Switch
                      checked={posterOptions[opt.key]}
                      onCheckedChange={(checked) => setPosterOptions(prev => ({ ...prev, [opt.key]: checked }))}
                    />
                  </div>
                ))}
              </div>
              <Button
                className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary"
                onClick={() => handleGeneratePoster(posterJob.id, posterOptions)}
                disabled={generatingPoster === posterJob.id}
              >
                {generatingPoster === posterJob.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                Generate Poster
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Priority Applies Dialog */}
      <Dialog open={showPriorityApplies} onOpenChange={setShowPriorityApplies}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] flex items-center gap-2">
              <Rocket className="w-5 h-5 text-secondary" /> Priority Applies
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-3">
            These candidates used a Priority Apply to stand out for your roles.
          </p>
          <div className="flex-1 overflow-y-auto space-y-2">
            {applications.filter(a => a.action === 'superlike').length === 0 ? (
              <div className="text-center py-8">
                <Rocket className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No priority applies yet.</p>
              </div>
            ) : (
              applications.filter(a => a.action === 'superlike').map(app => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => { setShowPriorityApplies(false); setSelectedCandidate(app); }}
                >
                  <img
                    src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                    alt={app.seeker_name}
                    className="w-12 h-12 rounded-full border-2 border-secondary/50 object-cover"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{app.seeker_name}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold flex-shrink-0">Priority</span>
                    </div>
                    <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                    {app.job_title && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <Briefcase className="w-3 h-3 flex-shrink-0" /> {app.job_title}
                      </div>
                    )}
                  </div>
                  {!app.recruiter_action && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'reject'); }}
                        className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'accept'); }}
                        className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {app.recruiter_action === 'accept' && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full flex-shrink-0">Shortlisted</span>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* All Applicants Dialog */}
      <Dialog open={showAllApplicants} onOpenChange={setShowAllApplicants}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] flex items-center gap-2">
              <Users className="w-5 h-5 text-success" /> New Applicants
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2">
            {applications.filter(a => !a.pipeline_stage || a.pipeline_stage === 'applied').length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No pending applicants.</p>
              </div>
            ) : (
              applications.filter(a => !a.pipeline_stage || a.pipeline_stage === 'applied').map(app => {
                const isUnlocked = subscription?.subscribed || unlockedAppIds.current.has(app.id);
                return (
                <PremiumBlur
                  key={app.id}
                  isUnlocked={isUnlocked}
                  tierHint="recruiter_pro"
                  trigger="blurred"
                >
                <div
                  className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => { if (isUnlocked) { setShowAllApplicants(false); setSelectedCandidate(app); } }}
                >
                  <img
                    src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                    alt={app.seeker_name}
                    className="w-12 h-12 rounded-full border-2 border-primary/50 object-cover"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{app.seeker_name}</span>
                      {app.action === 'superlike' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold flex-shrink-0">Priority</span>
                      )}
                    </div>
                    <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                    {app.job_title && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <Briefcase className="w-3 h-3 flex-shrink-0" /> {app.job_title}
                      </div>
                    )}
                  </div>
                  {isUnlocked && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'reject'); }}
                      className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'accept'); }}
                      className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                </div>
                </PremiumBlur>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Navigation />
    </div>
  );
}

function JobFormDialog({ open, onClose, onSuccess, token, company, job = null, isEditing = false }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const [parsingScreenshots, setParsingScreenshots] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(null); // 'generate' | 'improve' | null
  const [photoOption, setPhotoOption] = useState('none'); // 'none' | 'logo' | 'custom'
  const [customPhotoFile, setCustomPhotoFile] = useState(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [jobLocationCoords, setJobLocationCoords] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    company: company || '',
    description: '',
    requirements: '',
    salary_min: '',
    salary_max: '',
    location: user?.company_address || user?.location || '',
    job_type: 'remote',
    experience_level: 'mid',
    location_restriction: 'any',
    category: user?.company_industry || '',
    employment_type: 'full-time'
  });

  useEffect(() => {
    if (job && isEditing) {
      setFormData({
        title: job.title || '',
        company: job.company || company || '',
        description: job.description || '',
        requirements: job.requirements?.join(', ') || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        location: job.location || '',
        job_type: job.job_type || 'remote',
        experience_level: job.experience_level || 'mid',
        location_restriction: job.location_restriction || 'any',
        category: job.category || '',
        employment_type: job.employment_type || 'full-time'
      });
      // Restore photo option from existing job data
      if (job.listing_photo && job.listing_photo === user?.company_logo) {
        setPhotoOption('logo');
      } else if (job.listing_photo) {
        setPhotoOption('custom');
        setCustomPhotoPreview(job.listing_photo);
      } else {
        setPhotoOption('none');
      }
    } else if (!isEditing) {
      setFormData({
        title: '',
        company: company || '',
        description: '',
        requirements: '',
        salary_min: '',
        salary_max: '',
        location: user?.company_address || user?.location || '',
        job_type: 'remote',
        experience_level: 'mid',
        location_restriction: 'any',
        category: user?.company_industry || '',
        employment_type: 'full-time'
      });
      setScreenshots([]);
    }
  }, [job, isEditing, company, user?.company_logo, user?.company_address, user?.location, user?.company_industry]);

  const handleScreenshotSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    const total = screenshots.length + newFiles.length;
    if (total > 5) {
      toast.error('Maximum 5 files allowed');
      return;
    }
    setScreenshots(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeScreenshot = (index) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleParseScreenshots = async () => {
    if (screenshots.length === 0) return;
    setParsingScreenshots(true);
    try {
      const fd = new FormData();
      screenshots.forEach(f => fd.append('files', f));
      const res = await axios.post(`${API}/jobs/parse-screenshots`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      const parsed = res.data;
      setFormData(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        company: parsed.company || prev.company,
        description: parsed.description || prev.description,
        requirements: parsed.requirements?.join(', ') || prev.requirements,
        salary_min: parsed.salary_min?.toString() || prev.salary_min,
        salary_max: parsed.salary_max?.toString() || prev.salary_max,
        location: parsed.location || prev.location,
        job_type: parsed.job_type || prev.job_type,
        experience_level: parsed.experience_level || prev.experience_level,
        employment_type: parsed.employment_type || prev.employment_type,
        category: parsed.category || prev.category,
      }));
      toast.success('Job details extracted! Review and edit below.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to parse screenshots');
    } finally {
      setParsingScreenshots(false);
    }
  };

  const handleAiAssist = async (mode) => {
    setAiAssisting(mode);
    try {
      const res = await axios.post(`${API}/jobs/ai-assist`, {
        title: formData.title,
        company: formData.company,
        description: formData.description,
        mode,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { description, requirements } = res.data;
      setFormData(prev => ({
        ...prev,
        description: description || prev.description,
        requirements: requirements?.length ? requirements.join(', ') : prev.requirements,
      }));
      toast.success(mode === 'generate' ? 'Description generated!' : 'Description improved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI assist failed');
    } finally {
      setAiAssisting(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.company || !formData.description || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Upload custom photo first if selected
      let listingPhoto = null;
      if (photoOption === 'logo') {
        listingPhoto = 'logo';
      } else if (photoOption === 'custom' && customPhotoFile) {
        const photoFd = new FormData();
        photoFd.append('file', customPhotoFile);
        const photoRes = await axios.post(`${API}/upload/photo`, photoFd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        listingPhoto = photoRes.data.photo_url;
      } else if (photoOption === 'custom' && isEditing && job?.listing_photo) {
        // Keep existing custom photo when no new file was selected
        listingPhoto = job.listing_photo;
      }

      const payload = {
        ...formData,
        requirements: formData.requirements.split(',').map(r => r.trim()).filter(Boolean),
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        location_restriction: formData.location_restriction || 'any',
        listing_photo: listingPhoto,
        ...(jobLocationCoords ? { location_lat: jobLocationCoords.lat, location_lng: jobLocationCoords.lng } : {}),
      };

      if (isEditing && job) {
        await axios.put(`${API}/jobs/${job.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Job updated successfully!');
      } else {
        await axios.post(`${API}/jobs`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Job posted successfully!');
      }

      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-['Outfit'] text-xl">
            {isEditing ? 'Edit Job Posting' : 'Post a New Job'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Screenshot upload — create mode only */}
          {!isEditing && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Import from Screenshots or Documents
              </Label>
              <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
                {screenshots.length === 0 ? (
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Already posted your job elsewhere? Quick-upload here
                    </span>
                    <span className="text-xs text-muted-foreground">Upload screenshots, PDFs, or Word docs (up to 5)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      multiple
                      onChange={handleScreenshotSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {screenshots.map((file, i) => (
                        <div key={i} className="relative group">
                          {file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Screenshot ${i + 1}`}
                              className="w-16 h-16 object-cover rounded-lg border border-border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg border border-border flex flex-col items-center justify-center bg-muted/50 gap-1">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <span className="text-[8px] text-muted-foreground truncate max-w-[56px]">{file.name.split('.').pop()?.toUpperCase()}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeScreenshot(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {screenshots.length < 5 && (
                        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                          <Plus className="w-5 h-5 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            multiple
                            onChange={handleScreenshotSelect}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleParseScreenshots}
                      disabled={parsingScreenshots}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                    >
                      {parsingScreenshots ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Extracting job details...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Parse Screenshots
                        </div>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              {screenshots.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex-1 border-t border-border" />
                  <span>or fill out manually below</span>
                  <span className="flex-1 border-t border-border" />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Job Title *</Label>
            <Input
              placeholder="e.g., Senior Software Engineer"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-11 rounded-xl bg-background"
              data-testid="job-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input
              placeholder="e.g., Acme Inc."
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="h-11 rounded-xl bg-background"
              data-testid="job-company-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Description *</Label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAiAssist('generate')}
                  disabled={!formData.title || aiAssisting}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!formData.title ? 'Enter a job title first' : 'Generate a description with AI'}
                >
                  {aiAssisting === 'generate' ? (
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => handleAiAssist('improve')}
                  disabled={!formData.description || aiAssisting}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!formData.description ? 'Write a description first' : 'Improve description with AI'}
                >
                  {aiAssisting === 'improve' ? (
                    <div className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  Improve
                </button>
              </div>
            </div>
            <Textarea
              placeholder="Describe the role, responsibilities, and what makes it exciting..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-[180px] rounded-xl bg-background resize-y text-sm leading-relaxed"
              data-testid="job-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Requirements (one per line or comma-separated)</Label>
            <Textarea
              placeholder={"e.g.,\n8+ years of professional software engineering experience\nProficient in React, Node.js, TypeScript\nExperience with cloud platforms (AWS, GCP, or Azure)\nStrong communication and collaboration skills"}
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              className="min-h-[120px] rounded-xl bg-background resize-y text-sm leading-relaxed"
              data-testid="job-requirements-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Salary ($)</Label>
              <Input
                type="number"
                placeholder="80000"
                value={formData.salary_min}
                onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                className="h-11 rounded-xl bg-background"
                data-testid="job-salary-min-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Salary ($)</Label>
              <Input
                type="number"
                placeholder="120000"
                value={formData.salary_max}
                onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
                className="h-11 rounded-xl bg-background"
                data-testid="job-salary-max-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location *</Label>
            <LocationAutocomplete
              value={formData.location}
              onChange={(val, coords) => { setFormData(prev => ({ ...prev, location: val })); if (coords) setJobLocationCoords(coords); }}
              placeholder="e.g., San Francisco, CA or Remote"
              allowRemote
              data-testid="job-location-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select
                value={formData.job_type}
                onValueChange={(v) => setFormData({ ...formData, job_type: v })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background" data-testid="job-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Experience Level</Label>
              <Select
                value={formData.experience_level}
                onValueChange={(v) => setFormData({ ...formData, experience_level: v })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background" data-testid="job-level-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="mid">Mid Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead / Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Employment Type</Label>
            <Select
              value={formData.employment_type}
              onValueChange={(v) => setFormData({ ...formData, employment_type: v })}
            >
              <SelectTrigger className="h-11 rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Job Category</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger className="h-11 rounded-xl bg-background">
                <SelectValue placeholder="Auto-detect from job details" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-detect category from job title and description
            </p>
          </div>

          <div className="space-y-2">
            <Label>Applicant Location Requirement</Label>
            <Select
              value={formData.location_restriction}
              onValueChange={(v) => setFormData({ ...formData, location_restriction: v })}
            >
              <SelectTrigger className="h-11 rounded-xl bg-background" data-testid="job-location-restriction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">
                  <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Open to all locations</span>
                </SelectItem>
                <SelectItem value="specific">
                  <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Applicants must be in job location</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.location_restriction === 'specific'
                ? 'Only applicants near this job\'s location will see this posting'
                : 'Applicants from any location can see and apply to this job'}
            </p>
          </div>

          {/* Listing Photo */}
          <div className="space-y-3">
            <div>
              <Label>Listing Photo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                A great photo can make all the difference — listings with photos get significantly more applications. We highly recommend adding your company logo, team photo, or workspace image.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPhotoOption('none'); setCustomPhotoFile(null); setCustomPhotoPreview(null); }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  photoOption === 'none' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/20'
                }`}
              >
                None
              </button>
              {user?.company_logo && (
                <button
                  type="button"
                  onClick={() => { setPhotoOption('logo'); setCustomPhotoFile(null); setCustomPhotoPreview(null); }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    photoOption === 'logo' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/20'
                  }`}
                >
                  Company Logo
                </button>
              )}
              <button
                type="button"
                onClick={() => setPhotoOption('custom')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  photoOption === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/20'
                }`}
              >
                Custom Photo
              </button>
            </div>
            {photoOption === 'logo' && user?.company_logo && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <img src={user.company_logo} alt="Company Logo" className="w-12 h-12 rounded-lg object-cover" />
                <span className="text-sm text-muted-foreground">Your company logo will be shown on this listing</span>
              </div>
            )}
            {photoOption === 'custom' && (
              <div>
                {customPhotoPreview ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <img src={customPhotoPreview} alt="Custom" className="w-12 h-12 rounded-lg object-cover" />
                    <span className="text-sm text-muted-foreground flex-1">Custom photo selected</span>
                    <button
                      type="button"
                      onClick={() => { setCustomPhotoFile(null); setCustomPhotoPreview(null); }}
                      className="p-1 rounded-full hover:bg-accent"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload a photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = '';
                        if (file.size > 10 * 1024 * 1024) { toast.error('Image must be less than 10MB'); return; }
                        const img = new window.Image();
                        img.onload = () => {
                          URL.revokeObjectURL(img.src);
                          if (img.width < 800 || img.height < 400) {
                            toast.error('Image is too small. Please upload at least 800x400 pixels for a sharp listing photo.');
                            return;
                          }
                          setCustomPhotoFile(file);
                          setCustomPhotoPreview(URL.createObjectURL(file));
                        };
                        img.src = URL.createObjectURL(file);
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg"
            data-testid="submit-job-btn"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Post Job'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JobApplicationsDialog({ selectedJob, onClose, jobApplications, onViewCandidate, onRespond, subscription, unlockedAppIds }) {
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'superlike', 'matched', 'declined'
  const [bulkConfirm, setBulkConfirm] = useState(null); // 'accept' | 'decline' | null

  const filteredApps = jobApplications.filter(app => {
    if (filter === 'pending') return !app.recruiter_action;
    if (filter === 'superlike') return app.action === 'superlike';
    if (filter === 'matched') return app.recruiter_action === 'accept';
    if (filter === 'declined') return app.recruiter_action === 'reject';
    return true;
  });

  const pendingApps = jobApplications.filter(a => !a.recruiter_action);

  const handleBulkAccept = async () => {
    setBulkConfirm(null);
    for (const app of pendingApps) {
      await onRespond(app.id, 'accept');
    }
  };

  const handleBulkReject = async () => {
    setBulkConfirm(null);
    for (const app of pendingApps) {
      await onRespond(app.id, 'reject');
    }
  };

  const filterTabs = [
    { key: 'all', label: 'All', count: jobApplications.length },
    { key: 'pending', label: 'Pending', count: pendingApps.length },
    { key: 'superlike', label: 'Priority Applies', count: jobApplications.filter(a => a.action === 'superlike').length },
    { key: 'matched', label: 'Shortlisted', count: jobApplications.filter(a => a.recruiter_action === 'accept').length },
  ];

  return (
    <Dialog open={!!selectedJob} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">
            Applications for {selectedJob?.title}
          </DialogTitle>
        </DialogHeader>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {pendingApps.length > 1 && filter !== 'matched' && (
          <div className="flex gap-2 p-3 rounded-xl bg-background border border-border">
            <span className="text-xs text-muted-foreground flex-1 flex items-center">
              {pendingApps.length} pending applicants
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkConfirm('decline')}
              className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Decline All
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkConfirm('accept')}
              className="h-7 text-xs bg-success hover:bg-success/90 text-white"
            >
              Accept All
            </Button>
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto space-y-3">
          {filteredApps.length > 0 ? (
            filteredApps.map((app) => {
              const isLocked = !app.recruiter_action && !subscription?.subscribed && unlockedAppIds && !unlockedAppIds.has(app.id);
              return (
              <PremiumBlur
                key={app.id}
                isUnlocked={!isLocked}
                tierHint="recruiter_pro"
                trigger="blurred"
              >
              <div
                className="p-4 rounded-xl bg-background border border-border cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => onViewCandidate(app)}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                    alt={app.seeker_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{app.seeker_name}</span>
                      {app.action === 'superlike' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold flex-shrink-0">
                          <Rocket className="w-3 h-3" /> Priority
                        </span>
                      )}
                      {app.seeker_video && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[10px] font-medium flex-shrink-0">
                          VIDEO
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                    <div className="flex items-center gap-3 mt-1">
                      {app.seeker_location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {app.seeker_location}
                        </span>
                      )}
                      {app.seeker_experience && (
                        <span className="text-xs text-muted-foreground">
                          {app.seeker_experience}+ yrs
                        </span>
                      )}
                    </div>
                  </div>

                  {!app.recruiter_action ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRespond(app.id, 'reject'); }}
                        className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRespond(app.id, 'accept'); }}
                        className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs flex-shrink-0 ${
                      app.recruiter_action === 'accept'
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {app.recruiter_action === 'accept' ? 'Shortlisted' : 'Declined'}
                    </span>
                  )}
                </div>
              </div>
              </PremiumBlur>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {filter === 'all' ? 'No applications for this job yet.' : `No ${filter} applications.`}
              </p>
            </div>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={bulkConfirm === 'accept'}
        onOpenChange={(open) => { if (!open) setBulkConfirm(null); }}
        title={`Accept all ${pendingApps.length} pending applicants?`}
        description="This will shortlist all pending applicants for this job. They will be notified."
        confirmLabel="Accept All"
        variant="default"
        onConfirm={handleBulkAccept}
      />
      <ConfirmDialog
        open={bulkConfirm === 'decline'}
        onOpenChange={(open) => { if (!open) setBulkConfirm(null); }}
        title={`Decline all ${pendingApps.length} pending applicants?`}
        description="This will decline all pending applicants for this job. This action cannot be undone."
        confirmLabel="Decline All"
        variant="destructive"
        onConfirm={handleBulkReject}
      />
    </Dialog>
  );
}
