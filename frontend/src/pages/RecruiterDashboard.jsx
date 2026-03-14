import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Briefcase, Users, Star, Heart, X, Check,
  MapPin, DollarSign, Building2, ChevronRight, Clock,
  Edit, GraduationCap, Trash2, BarChart3, Calendar, Globe,
  FileText, Send, Info, Copy, Upload, Sparkles, Wand2, Image as ImageIcon, Printer
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [stats, setStats] = useState({ active_jobs: 0, total_applications: 0, super_likes: 0, matches: 0 });
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
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

  useEffect(() => {
    fetchData();
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
      setSubscription(data.subscription);
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
    try {
      await axios.post(`${API}/applications/respond`, 
        { application_id: applicationId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (action === 'accept') {
        toast.success("It's a match! 🎉");
      } else {
        toast.info('Application declined');
      }
      
      fetchData();
      if (selectedJob) {
        handleViewApplications(selectedJob);
      }
    } catch (error) {
      toast.error('Failed to respond');
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
      await axios.post(`${API}/jobs/${jobId}/duplicate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Job duplicated');
      fetchData();
    } catch {
      toast.error('Failed to duplicate job');
    }
  };

  const [generatingPoster, setGeneratingPoster] = useState(null);

  const handleGeneratePoster = async (jobId) => {
    setGeneratingPoster(jobId);
    try {
      const response = await axios.get(`${API}/jobs/${jobId}/poster`, {
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
      toast.error(error.response?.data?.detail || 'Failed to load resume');
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
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/logo-white.png" alt="Hireabble" className="w-9 h-9" />
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
            <Button
              onClick={() => setShowNewJob(true)}
              className="bg-gradient-to-r from-primary to-secondary rounded-full sm:px-5 px-3"
              data-testid="post-job-btn"
            >
              <Plus className="w-5 h-5 sm:mr-2" />
              <span className="hidden sm:inline">Post Job</span>
            </Button>
          </div>
        </div>

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
            onClick={() => navigate('/recruiter/applications')}
          >
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-success" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.total_applications}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">Applications <ChevronRight className="w-3 h-3" /></div>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-secondary/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-3">
              <Star className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.super_likes}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              Super Likes
              <span className="relative group">
                <Info className="w-3 h-3 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-foreground text-background text-xs w-48 text-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  Super Likes put your job at the top of seekers' queues, increasing visibility and match chances!
                </span>
              </span>
            </div>
          </div>
          <div
            className="glass-card rounded-2xl p-5 hover:border-pink-500/30 transition-colors cursor-pointer active:scale-[0.97]"
            onClick={() => navigate('/matches')}
          >
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-3">
              <Heart className="w-6 h-6 text-pink-500" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.matches}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">Matches <ChevronRight className="w-3 h-3" /></div>
          </div>
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

        {/* Recent Applications */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-['Outfit']">Recent Applicants</h2>
          </div>
          
          {applications.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {applications.slice(0, 10).map((app, appIndex) => (
                <PremiumBlur
                  key={app.id}
                  isUnlocked={subscription?.subscribed || appIndex < 3}
                  tierHint="recruiter_pro"
                  trigger="blurred"
                >
                <div
                  className="glass-card rounded-2xl p-4 min-w-[220px] flex-shrink-0 relative cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedCandidate(app)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
                      alt={app.seeker_name}
                      className="w-14 h-14 rounded-full border-2 border-primary/50 object-cover"
                      loading="lazy"
                    />
                    {app.action === 'superlike' && (
                      <div className="absolute top-3 right-3">
                        <Star className="w-5 h-5 text-secondary fill-secondary" />
                      </div>
                    )}
                  </div>
                  <div className="font-medium truncate">{app.seeker_name}</div>
                  <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                  {app.seeker_experience && (
                    <div className="text-xs text-muted-foreground mt-1">{app.seeker_experience}+ years exp</div>
                  )}
                  
                  {!app.recruiter_action && (
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
                  )}
                  
                  {app.recruiter_action && (
                    <div className={`mt-3 py-2 rounded-lg text-center text-sm ${
                      app.recruiter_action === 'accept'
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {app.recruiter_action === 'accept' ? 'Matched!' : 'Declined'}
                    </div>
                  )}
                </div>
                </PremiumBlur>
              ))}
            </div>
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
                  className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors"
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
                      <h3 className="font-bold font-['Outfit'] text-lg truncate">{job.title}</h3>
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
                      onClick={(e) => { e.stopPropagation(); handleGeneratePoster(job.id); }}
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
      />

      {/* Candidate Detail Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Candidate Profile</DialogTitle>
          </DialogHeader>
          
          {selectedCandidate && (
            <div className="space-y-6">
              {/* Photo and Basic Info */}
              <div className="flex items-center gap-4">
                <img 
                  src={getPhotoUrl(selectedCandidate.seeker_photo || selectedCandidate.seeker_avatar, selectedCandidate.seeker_id)}
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
                    Match
                  </Button>
                </div>
              ) : (
                <div className={`py-3 rounded-xl text-center font-medium ${
                  selectedCandidate.recruiter_action === 'accept' 
                    ? 'bg-success/10 text-success' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {selectedCandidate.recruiter_action === 'accept' ? "You've matched with this candidate!" : 'You passed on this candidate'}
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
  const [photoOption, setPhotoOption] = useState('none'); // 'none' | 'profile' | 'custom'
  const [customPhotoFile, setCustomPhotoFile] = useState(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: company || '',
    description: '',
    requirements: '',
    salary_min: '',
    salary_max: '',
    location: '',
    job_type: 'remote',
    experience_level: 'mid',
    location_restriction: 'any',
    category: '',
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
    } else if (!isEditing) {
      setFormData({
        title: '',
        company: company || '',
        description: '',
        requirements: '',
        salary_min: '',
        salary_max: '',
        location: '',
        job_type: 'remote',
        experience_level: 'mid',
        location_restriction: 'any',
        category: '',
        employment_type: 'full-time'
      });
      setScreenshots([]);
    }
  }, [job, isEditing, company]);

  const handleScreenshotSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    const total = screenshots.length + newFiles.length;
    if (total > 5) {
      toast.error('Maximum 5 screenshots allowed');
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
      if (photoOption === 'profile') {
        listingPhoto = 'profile';
      } else if (photoOption === 'custom' && customPhotoFile) {
        const photoFd = new FormData();
        photoFd.append('file', customPhotoFile);
        const photoRes = await axios.post(`${API}/upload/photo`, photoFd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        listingPhoto = photoRes.data.photo_url;
      }

      const payload = {
        ...formData,
        requirements: formData.requirements.split(',').map(r => r.trim()).filter(Boolean),
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        location_restriction: formData.location_restriction || 'any',
        listing_photo: listingPhoto,
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
                Import from Screenshots
              </Label>
              <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
                {screenshots.length === 0 ? (
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Already posted your job elsewhere? Quick-upload here
                    </span>
                    <span className="text-xs text-muted-foreground">Upload screenshots of your listing (up to 5)</span>
                    <input
                      type="file"
                      accept="image/*"
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
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Screenshot ${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-border"
                          />
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
                            accept="image/*"
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
              onChange={(val) => setFormData({ ...formData, location: val })}
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
                A great photo can make your job stand out. Post your business logo, team or workspace.
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
              {user?.photo_url && (
                <button
                  type="button"
                  onClick={() => { setPhotoOption('profile'); setCustomPhotoFile(null); setCustomPhotoPreview(null); }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    photoOption === 'profile' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/20'
                  }`}
                >
                  Profile Photo
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
            {photoOption === 'profile' && user?.photo_url && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <img src={user.photo_url} alt="Profile" className="w-12 h-12 rounded-lg object-cover" />
                <span className="text-sm text-muted-foreground">Your profile photo will be shown on this listing</span>
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
                        if (file) {
                          setCustomPhotoFile(file);
                          setCustomPhotoPreview(URL.createObjectURL(file));
                        }
                        e.target.value = '';
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

function JobApplicationsDialog({ selectedJob, onClose, jobApplications, onViewCandidate, onRespond }) {
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
    { key: 'superlike', label: 'Super Likes', count: jobApplications.filter(a => a.action === 'superlike').length },
    { key: 'matched', label: 'Matched', count: jobApplications.filter(a => a.recruiter_action === 'accept').length },
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
            filteredApps.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-xl bg-background border border-border cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => onViewCandidate(app)}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
                    alt={app.seeker_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{app.seeker_name}</span>
                      {app.action === 'superlike' && (
                        <Star className="w-4 h-4 text-secondary fill-secondary flex-shrink-0" />
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
                      {app.recruiter_action === 'accept' ? 'Matched' : 'Declined'}
                    </span>
                  )}
                </div>
              </div>
            ))
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
        description="This will accept all pending applicants for this job. They will be notified of the match."
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
