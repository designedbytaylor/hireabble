import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Briefcase, Users, Star, Heart, X, Check, 
  MapPin, DollarSign, Building2, ChevronRight, Clock,
  Edit, GraduationCap, Trash2
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
import { getPhotoUrl } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterDashboard() {
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, jobsRes, appsRes] = await Promise.all([
        axios.get(`${API}/stats/recruiter`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/jobs/recruiter`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/applications`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setApplications(appsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewApplications = async (job) => {
    setSelectedJob(job);
    try {
      const response = await axios.get(`${API}/applications/job/${job.id}`, {
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
    if (!window.confirm('Are you sure you want to delete this job posting?')) return;
    
    try {
      await axios.delete(`${API}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Job deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Recruiter Hub</h1>
            <p className="text-muted-foreground">{user?.company || 'Your Company'}</p>
          </div>
          <Button 
            onClick={() => setShowNewJob(true)}
            className="bg-gradient-to-r from-primary to-secondary rounded-full px-5"
            data-testid="post-job-btn"
          >
            <Plus className="w-5 h-5 mr-2" />
            Post Job
          </Button>
        </div>

        {/* Stats Grid - Bento Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.active_jobs}</div>
            <div className="text-sm text-muted-foreground">Active Jobs</div>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-success/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-success" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.total_applications}</div>
            <div className="text-sm text-muted-foreground">Applications</div>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-secondary/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-3">
              <Star className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.super_likes}</div>
            <div className="text-sm text-muted-foreground">Super Likes</div>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-pink-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-3">
              <Heart className="w-6 h-6 text-pink-500" />
            </div>
            <div className="text-3xl font-bold font-['Outfit']">{stats.matches}</div>
            <div className="text-sm text-muted-foreground">Matches</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 md:px-8">
        {/* Recent Applications */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-['Outfit']">Recent Applicants</h2>
          </div>
          
          {applications.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {applications.slice(0, 10).map((app) => (
                <div 
                  key={app.id}
                  className="glass-card rounded-2xl p-4 min-w-[220px] flex-shrink-0 relative cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedCandidate(app)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img 
                      src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
                      alt={app.seeker_name}
                      className="w-14 h-14 rounded-full border-2 border-primary/50 object-cover"
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
        <section>
          <h2 className="text-xl font-bold font-['Outfit'] mb-4">Your Jobs</h2>
          
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div 
                  key={job.id}
                  className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors"
                  data-testid={`job-item-${job.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex items-start gap-4 flex-1 cursor-pointer"
                      onClick={() => handleViewApplications(job)}
                    >
                      <img 
                        src={job.company_logo}
                        alt={job.company}
                        className="w-14 h-14 rounded-xl object-cover"
                      />
                      <div>
                        <h3 className="font-bold font-['Outfit'] text-lg">{job.title}</h3>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditJob(job)}
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                        data-testid={`edit-job-${job.id}`}
                      >
                        <Edit className="w-5 h-5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                        data-testid={`delete-job-${job.id}`}
                      >
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </button>
                      <ChevronRight 
                        className="w-5 h-5 text-muted-foreground cursor-pointer"
                        onClick={() => handleViewApplications(job)}
                      />
                    </div>
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

      {/* Job Applications Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              Applications for {selectedJob?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            {jobApplications.length > 0 ? (
              jobApplications.map((app) => (
                <div 
                  key={app.id} 
                  className="p-4 rounded-xl bg-background border border-border cursor-pointer hover:border-primary/30"
                  onClick={() => { setSelectedJob(null); setSelectedCandidate(app); }}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
                      alt={app.seeker_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{app.seeker_name}</span>
                        {app.action === 'superlike' && (
                          <Star className="w-4 h-4 text-secondary fill-secondary" />
                        )}
                      </div>
                      <div className="text-sm text-primary">{app.seeker_title || 'Job Seeker'}</div>
                    </div>
                    
                    {!app.recruiter_action ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'reject'); }}
                          className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRespondToApplication(app.id, 'accept'); }}
                          className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-sm ${
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
                <p className="text-muted-foreground">No applications for this job yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      <Navigation />
    </div>
  );
}

function JobFormDialog({ open, onClose, onSuccess, token, company, job = null, isEditing = false }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: company || '',
    description: '',
    requirements: '',
    salary_min: '',
    salary_max: '',
    location: '',
    job_type: 'remote',
    experience_level: 'mid'
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
        experience_level: job.experience_level || 'mid'
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
        experience_level: 'mid'
      });
    }
  }, [job, isEditing, company]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.company || !formData.description || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        requirements: formData.requirements.split(',').map(r => r.trim()).filter(Boolean),
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
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
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe the role, responsibilities, and what makes it exciting..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-[100px] rounded-xl bg-background resize-none"
              data-testid="job-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Requirements (comma-separated)</Label>
            <Input
              placeholder="e.g., React, Node.js, 3+ years experience"
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              className="h-11 rounded-xl bg-background"
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
            <Input
              placeholder="e.g., San Francisco, CA or Remote"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="h-11 rounded-xl bg-background"
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
