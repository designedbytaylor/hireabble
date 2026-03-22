import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, Briefcase, Star, Check, X, Clock, ArrowLeft, Rocket,
  MapPin, GraduationCap, Building2, Heart, MessageSquare,
  Calendar, FileText, ChevronRight, Award, Mail, Phone,
  Eye, UserCheck, Trophy, ChevronDown, List, LayoutGrid,
  Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl } from '../utils/helpers';
import { SkeletonPageBackground, SkeletonListItem, SkeletonFilterTabs } from '../components/skeletons';
import CandidateNotes from '../components/CandidateNotes';
import { Skeleton } from '../components/ui/skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import PipelineKanban from '../components/PipelineKanban';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { key: 'applied', label: 'Applied', color: 'bg-blue-500/20 text-blue-500' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'bg-purple-500/20 text-purple-500' },
  { key: 'interviewing', label: 'Interview', color: 'bg-cyan-500/20 text-cyan-500' },
  { key: 'hired', label: 'Hired', color: 'bg-emerald-500/20 text-emerald-500' },
  { key: 'declined', label: 'Rejected', color: 'bg-red-500/20 text-red-500' },
];

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s]));

export default function RecruiterApplications() {
  useDocumentTitle('Pipeline');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialStage = searchParams.get('stage');
  const initialView = searchParams.get('view');
  const [filter, setFilter] = useState(
    initialStage && ['applied', 'shortlisted', 'interviewing', 'hired', 'declined'].includes(initialStage)
      ? initialStage : 'all'
  );
  const [viewMode, setViewMode] = useState(initialView === 'kanban' ? 'kanban' : 'list');
  const [selectedApp, setSelectedApp] = useState(null);
  const [resume, setResume] = useState(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('all');

  useEffect(() => {
    fetchApplications();
    axios.get(`${API}/interviews`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setInterviews(res.data))
      .catch(() => {});
    // Fetch recruiter jobs for job filter
    axios.get(`${API}/jobs/recruiter`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setJobs(res.data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await axios.get(`${API}/applications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInterviewForCandidate = (app) => {
    if (!app || !interviews.length) return null;
    return interviews.find(i =>
      i.seeker_id === app.seeker_id &&
      (i.status === 'pending' || i.status === 'accepted' || i.status === 'rescheduled')
    ) || null;
  };

  const handleOpenApplicant = async (app) => {
    setSelectedApp(app);
    setResume(null);
    setLoadingResume(true);
    try {
      const response = await axios.get(`${API}/applicant/${app.seeker_id}/resume`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResume(response.data);
    } catch (error) {
      console.error('Failed to fetch resume:', error);
    } finally {
      setLoadingResume(false);
    }
  };

  const handleMessage = (app) => {
    if (app.match_id) {
      navigate(`/chat/${app.match_id}`);
    } else {
      navigate('/messages');
    }
  };

  const handleScheduleInterview = (app) => {
    const params = app.match_id ? `?match=${app.match_id}` : `?seeker=${app.seeker_id}`;
    navigate(`/interviews${params}`);
  };

  const getStage = (app) => {
    const LEGACY = { reviewing: 'applied', offered: 'shortlisted' };
    const raw = app.pipeline_stage || (app.is_matched ? 'shortlisted' : app.recruiter_action === 'reject' ? 'declined' : 'applied');
    return LEGACY[raw] || raw;
  };

  const updateStage = async (appId, newStage, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`${API}/applications/${appId}/stage`, { stage: newStage }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, pipeline_stage: newStage } : a
      ));
      toast.success(`Moved to ${STAGE_MAP[newStage]?.label || newStage}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update stage');
    }
  };

  // Filter by job first, then by stage
  const jobFiltered = selectedJobId === 'all'
    ? applications
    : applications.filter(app => app.job_id === selectedJobId);

  const showJobTitle = selectedJobId === 'all';

  const filtered = filter === 'all'
    ? jobFiltered
    : jobFiltered.filter(app => getStage(app) === filter);

  const counts = {
    all: jobFiltered.length,
    ...Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, jobFiltered.filter(a => getStage(a) === s.key).length])),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <Skeleton className="h-4 w-32 rounded mb-4" />
          <Skeleton className="h-7 w-36 rounded mb-2" />
          <Skeleton className="h-4 w-28 rounded" />
        </header>
        <div className="relative z-10 px-6 md:px-8 mb-6">
          <SkeletonFilterTabs count={5} />
        </div>
        <main className="relative z-10 px-6 md:px-8">
          <div className="max-w-2xl mx-auto space-y-3">
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-full" lines={3} badge />
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-full" lines={3} badge />
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-full" lines={3} badge />
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-full" lines={3} badge />
          </div>
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
        <button
          onClick={() => navigate('/recruiter')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Pipeline</h1>
            <p className="text-muted-foreground">{jobFiltered.length} total candidates</p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>
        </div>
      </header>

      {/* Job Filter + Stage Tabs */}
      <div className="relative z-10 px-6 md:px-8 mb-6 space-y-3">
        {/* Job Filter */}
        {jobs.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedJobId('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedJobId === 'all'
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                All Jobs
              </button>
              {jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    selectedJobId === job.id
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {job.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stage Filter Tabs - only for list view */}
        {viewMode === 'list' && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: 'All' },
              ...PIPELINE_STAGES.map(s => ({ key: s.key, label: s.label })),
            ].filter(tab => tab.key === 'all' || counts[tab.key] > 0).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filter === key
                    ? 'bg-gradient-to-r from-primary to-secondary text-white'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
        /* LIST VIEW */
        <main className="relative z-10 px-6 md:px-8">
          <div className="max-w-2xl mx-auto space-y-3">
            {filtered.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold font-['Outfit'] text-lg mb-2">No candidates</h3>
                <p className="text-muted-foreground text-sm">
                  {filter === 'all' ? 'No applications yet. Post jobs to start receiving applicants!' : `No ${STAGE_MAP[filter]?.label || filter} candidates.`}
                </p>
              </div>
            ) : (
              filtered.map((app) => {
                return (
                  <button
                    key={app.id}
                    onClick={() => handleOpenApplicant(app)}
                    className="w-full glass-card rounded-2xl p-4 flex items-center gap-4 hover:border-primary/20 transition-colors cursor-pointer text-left"
                  >
                    {/* Avatar */}
                    <img
                      src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
                      alt={app.seeker_name}
                      className="w-14 h-14 rounded-full border-2 border-border object-cover flex-shrink-0"
                      loading="lazy"
                      decoding="async"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{app.seeker_name}</span>
                        {app.action === 'superlike' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold flex-shrink-0">
                            Priority
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-primary truncate">{app.seeker_title || 'Candidate'}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {showJobTitle && app.job_title && (
                          <span className="flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3" /> {app.job_title}
                          </span>
                        )}
                        {app.seeker_location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {app.seeker_location}
                          </span>
                        )}
                        {app.seeker_experience && (
                          <span>{app.seeker_experience}+ yrs</span>
                        )}
                      </div>
                    </div>

                    {/* Stage Badge + Selector + Arrow */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <select
                          value={getStage(app)}
                          onChange={(e) => updateStage(app.id, e.target.value, e)}
                          className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-medium cursor-pointer border-0 outline-none ${STAGE_MAP[getStage(app)]?.color || 'bg-blue-500/20 text-blue-500'}`}
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </main>
      ) : (
        /* KANBAN VIEW */
        <PipelineKanban
          applications={jobFiltered}
          getStage={getStage}
          updateStage={updateStage}
          onViewProfile={handleOpenApplicant}
          onMessage={handleMessage}
          showJobTitle={showJobTitle}
        />
      )}

      {/* Applicant Detail Modal */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => { if (!open) setSelectedApp(null); }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Outfit'] sr-only">Applicant Details</DialogTitle>
              </DialogHeader>

              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={getPhotoUrl(selectedApp.seeker_photo || selectedApp.seeker_avatar, selectedApp.seeker_name || selectedApp.seeker_id)}
                  alt={selectedApp.seeker_name}
                  className="w-16 h-16 rounded-full border-2 border-primary object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-['Outfit']">{selectedApp.seeker_name}</h2>
                    {selectedApp.action === 'superlike' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold">
                        Priority
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-primary">{selectedApp.seeker_title || 'Candidate'}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {selectedApp.seeker_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {selectedApp.seeker_location}
                      </span>
                    )}
                    {selectedApp.seeker_experience && (
                      <span>{selectedApp.seeker_experience}+ yrs experience</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Applied to */}
              {selectedApp.job_title && (
                <div className="p-3 rounded-xl bg-accent/50 mb-4">
                  <p className="text-xs text-muted-foreground">Applied to</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" /> {selectedApp.job_title}
                  </p>
                </div>
              )}

              {/* Interview Status */}
              {(() => {
                const interview = getInterviewForCandidate(selectedApp);
                if (interview?.status === 'accepted' && interview.selected_time) {
                  const dt = new Date(interview.selected_time.start);
                  return (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4">
                      <div className="flex items-center gap-2 text-purple-400 font-medium text-sm mb-1">
                        <Calendar className="w-4 h-4" />
                        Interview Scheduled
                      </div>
                      <p className="text-sm text-foreground">
                        {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{interview.interview_type?.replace('_', ' ') || 'Video'} call</p>
                      <button
                        onClick={() => { setSelectedApp(null); navigate('/interviews'); }}
                        className="mt-1 text-xs text-purple-400 hover:underline"
                      >
                        Reschedule
                      </button>
                    </div>
                  );
                } else if (interview?.status === 'pending' || interview?.status === 'rescheduled') {
                  return (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                      <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-1">
                        <Clock className="w-4 h-4" />
                        Interview Pending
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Waiting for {selectedApp.seeker_name} to confirm the interview time.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2 mb-5">
                {selectedApp.is_matched && (
                  <Button
                    onClick={() => { setSelectedApp(null); handleMessage(selectedApp); }}
                    className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-secondary text-sm"
                  >
                    <MessageSquare className="w-4 h-4 mr-1.5" /> Message
                  </Button>
                )}
                {!getInterviewForCandidate(selectedApp) && (
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedApp(null); handleScheduleInterview(selectedApp); }}
                    className="flex-1 h-10 rounded-xl text-sm"
                  >
                    <Calendar className="w-4 h-4 mr-1.5" /> Schedule Interview
                  </Button>
                )}
              </div>

              {/* Stage selector in modal */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground">Stage:</span>
                <select
                  value={getStage(selectedApp)}
                  onChange={(e) => {
                    updateStage(selectedApp.id, e.target.value);
                    setSelectedApp(prev => prev ? { ...prev, pipeline_stage: e.target.value } : null);
                  }}
                  className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-medium cursor-pointer border-0 outline-none ${STAGE_MAP[getStage(selectedApp)]?.color || 'bg-blue-500/20 text-blue-500'}`}
                >
                  {PIPELINE_STAGES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Candidate Notes */}
              <CandidateNotes seekerId={selectedApp.seeker_id} token={token} />

              {/* Resume Content */}
              {loadingResume ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : resume ? (
                <div className="space-y-4">
                  {/* Bio */}
                  {resume.bio && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">About</h4>
                      <p className="text-sm">{resume.bio}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {resume.skills?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {resume.skills.map((skill, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work History */}
                  {resume.work_history?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        <Building2 className="w-3.5 h-3.5 inline mr-1" /> Work Experience
                      </h4>
                      <div className="space-y-3">
                        {resume.work_history.map((job, i) => (
                          <div key={i} className="p-3 rounded-xl bg-background/50 border border-border">
                            <p className="font-medium text-sm">{job.position}</p>
                            <p className="text-xs text-primary">{job.company}</p>
                            {(job.start_date || job.end_date) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {job.start_date} {job.start_date && '–'} {job.end_date || 'Present'}
                              </p>
                            )}
                            {job.description && (
                              <p className="text-xs text-muted-foreground mt-1">{job.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {resume.education?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        <GraduationCap className="w-3.5 h-3.5 inline mr-1" /> Education
                      </h4>
                      <div className="space-y-2">
                        {resume.education.map((edu, i) => (
                          <div key={i} className="p-3 rounded-xl bg-background/50 border border-border">
                            <p className="font-medium text-sm">{edu.school}</p>
                            {edu.degree && <p className="text-xs text-primary">{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p>}
                            {edu.year && <p className="text-xs text-muted-foreground">{edu.year}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {resume.certifications?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        <Award className="w-3.5 h-3.5 inline mr-1" /> Certifications
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {resume.certifications.map((cert, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-xs">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact / References */}
                  {resume.references_available && (
                    <div className="p-3 rounded-xl bg-accent/50">
                      <p className="text-xs text-muted-foreground">
                        {resume.references_approved ? 'References available' : 'References available upon request'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Resume details not available</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Navigation />
    </div>
  );
}
