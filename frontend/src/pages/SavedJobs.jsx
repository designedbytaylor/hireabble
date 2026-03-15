import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, MapPin, DollarSign, Briefcase, Trash2, Clock, X, Building2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max)}`;
}

function JobDetailSheet({ job, onClose }) {
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
            {formatSalary(job.salary_min, job.salary_max) && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {formatSalary(job.salary_min, job.salary_max)}
              </span>
            )}
            {job.job_type && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground capitalize">
                {job.job_type}
              </span>
            )}
            {job.employment_type && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-secondary/10 text-secondary capitalize">
                {job.employment_type}
              </span>
            )}
            {job.experience_level && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary capitalize">
                {job.experience_level}
              </span>
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
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground">
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.benefits?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Benefits</h3>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-500">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SavedJobs() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await axios.get(`${API}/jobs/saved/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setJobs(res.data.jobs);
      } catch {
        toast.error('Failed to load saved jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [token]);

  const handleRemove = async (jobId) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
    try {
      await axios.delete(`${API}/jobs/${jobId}/save`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      toast.error('Failed to remove');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />

      <main className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Saved Jobs</h1>
            <p className="text-sm text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? 's' : ''} saved</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No saved jobs yet</h3>
            <p className="text-sm text-muted-foreground">Tap the bookmark icon while swiping to save jobs for later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="glass-card rounded-2xl p-4 hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                    <p className="text-sm text-muted-foreground">{job.company}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                      )}
                      {formatSalary(job.salary_min, job.salary_max) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {formatSalary(job.salary_min, job.salary_max)}
                        </span>
                      )}
                      {job.job_type && (
                        <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {job.job_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(job.id); }}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedJob && (
        <JobDetailSheet job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      <Navigation />
    </div>
  );
}
