import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Briefcase, Star, Check, X, Clock, ArrowLeft,
  MapPin, GraduationCap, Building2, Heart, MessageSquare,
  Calendar, FileText, ChevronRight, Award, Mail, Phone,
  Eye, UserCheck, Trophy, ChevronDown
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PIPELINE_STAGES = [
  { key: 'applied', label: 'Applied', color: 'bg-blue-500/20 text-blue-500' },
  { key: 'reviewing', label: 'Reviewing', color: 'bg-yellow-500/20 text-yellow-500' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'bg-purple-500/20 text-purple-500' },
  { key: 'interviewing', label: 'Interviewing', color: 'bg-cyan-500/20 text-cyan-500' },
  { key: 'offered', label: 'Offered', color: 'bg-orange-500/20 text-orange-500' },
  { key: 'hired', label: 'Hired', color: 'bg-green-500/20 text-green-500' },
  { key: 'declined', label: 'Declined', color: 'bg-red-500/20 text-red-500' },
];

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s]));

export default function RecruiterApplications() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [resume, setResume] = useState(null);
  const [loadingResume, setLoadingResume] = useState(false);

  useEffect(() => {
    fetchApplications();
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
    // Find the match for this application to navigate to chat
    if (app.match_id) {
      navigate(`/chat/${app.match_id}`);
    } else {
      navigate('/matches');
    }
  };

  const handleScheduleInterview = (app) => {
    navigate('/interviews', { state: { seekerId: app.seeker_id, seekerName: app.seeker_name } });
  };

  const getStage = (app) => app.pipeline_stage || (app.is_matched ? 'shortlisted' : app.recruiter_action === 'reject' ? 'declined' : 'applied');

  const updateStage = async (appId, newStage, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`${API}/applications/${appId}/stage`, { stage: newStage }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, pipeline_stage: newStage } : a
      ));
      toast.success(`Stage updated to ${STAGE_MAP[newStage]?.label || newStage}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update stage');
    }
  };

  const getStageBadge = (stage) => {
    const conf = STAGE_MAP[stage] || STAGE_MAP.applied;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${conf.color}`}>
        {conf.label}
      </span>
    );
  };

  const filtered = filter === 'all'
    ? applications
    : applications.filter(app => getStage(app) === filter);

  const counts = {
    all: applications.length,
    ...Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, applications.filter(a => getStage(a) === s.key).length])),
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
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <button
          onClick={() => navigate('/recruiter/dashboard')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold font-['Outfit']">Applications</h1>
        <p className="text-muted-foreground">{applications.length} total applicants</p>
      </header>

      {/* Filter Tabs */}
      <div className="relative z-10 px-6 md:px-8 mb-6">
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
      </div>

      {/* Applications List */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-2xl mx-auto space-y-3">
          {filtered.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold font-['Outfit'] text-lg mb-2">No applications</h3>
              <p className="text-muted-foreground text-sm">
                {filter === 'all' ? 'No applications yet. Post jobs to start receiving applicants!' : `No ${filter} applications.`}
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
                    src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
                    alt={app.seeker_name}
                    className="w-14 h-14 rounded-full border-2 border-border object-cover flex-shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{app.seeker_name}</span>
                      {app.action === 'superlike' && (
                        <Star className="w-4 h-4 text-secondary fill-secondary flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-sm text-primary truncate">{app.seeker_title || 'Job Seeker'}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {app.job_title && (
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
                  src={getPhotoUrl(selectedApp.seeker_photo || selectedApp.seeker_avatar, selectedApp.seeker_id)}
                  alt={selectedApp.seeker_name}
                  className="w-16 h-16 rounded-full border-2 border-primary object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-['Outfit']">{selectedApp.seeker_name}</h2>
                    {selectedApp.action === 'superlike' && (
                      <Star className="w-4 h-4 text-secondary fill-secondary" />
                    )}
                  </div>
                  <p className="text-sm text-primary">{selectedApp.seeker_title || 'Job Seeker'}</p>
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
                <Button
                  variant="outline"
                  onClick={() => { setSelectedApp(null); handleScheduleInterview(selectedApp); }}
                  className="flex-1 h-10 rounded-xl text-sm"
                >
                  <Calendar className="w-4 h-4 mr-1.5" /> Schedule Interview
                </Button>
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
