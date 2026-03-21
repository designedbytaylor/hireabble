import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, DollarSign, Building2, Briefcase, Clock, Heart, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl } from '../utils/helpers';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatSalary = (min, max) => {
  if (!min && !max) return null;
  const format = (n) => n >= 1000 ? `$${Math.round(n/1000)}k` : `$${n}`;
  if (min && max) return `${format(min)} - ${format(max)}`;
  if (min) return `${format(min)}+`;
  return `Up to ${format(max)}`;
};

export default function CompanyJobs() {
  useDocumentTitle('Company');
  const { recruiterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);

  const fetchCompanyJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/jobs/company/${recruiterId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompany(response.data.company);
      setJobs(response.data.jobs);
    } catch (error) {
      toast.error('Failed to load company info');
    } finally {
      setLoading(false);
    }
  }, [recruiterId, token]);

  useEffect(() => {
    fetchCompanyJobs();
  }, [fetchCompanyJobs, location.key]);

  const handleApply = async (jobId) => {
    setApplying(jobId);
    try {
      await axios.post(`${API}/swipe`, { job_id: jobId, action: 'like' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Application sent!');
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, applied: true } : j));
      // Invalidate cached dashboard stats so the "Applied" count updates
      // immediately when the user navigates back to the dashboard.
      try {
        const uid = user?.id;
        if (uid) localStorage.removeItem(`hireabble_swipe_stats_${uid}`);
      } catch { /* ignore */ }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.info('Already applied to this job');
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, applied: true } : j));
      } else {
        toast.error('Failed to apply');
      }
    } finally {
      setApplying(null);
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
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 p-6 md:p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {company && (
          <div className="flex items-center gap-4 mb-6">
            <img
              src={getPhotoUrl(company.photo_url, company.company || company.name || company.id) || company.avatar}
              alt={company.company || company.name}
              className="w-16 h-16 rounded-2xl border-2 border-border object-cover"
            />
            <div>
              <h1 className="text-2xl font-bold font-['Outfit']">{company.company || company.name}</h1>
              {company.location && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {company.location}
                </p>
              )}
            </div>
          </div>
        )}

        {company?.bio && (
          <p className="text-sm text-muted-foreground mb-4">{company.bio}</p>
        )}

        <p className="text-muted-foreground">{jobs.length} open position{jobs.length !== 1 ? 's' : ''}</p>
      </header>

      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {jobs.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold font-['Outfit'] text-lg mb-2">No open positions</h3>
              <p className="text-muted-foreground text-sm">This company doesn't have any open positions right now.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="glass-card rounded-2xl p-5 hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold font-['Outfit'] text-lg">{job.title}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> {job.company}
                    </p>
                  </div>
                  {job.match_score != null && (
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      job.match_score >= 75 ? 'bg-success/20 text-success' :
                      job.match_score >= 50 ? 'bg-primary/20 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Star className="w-3 h-3" />
                      {job.match_score}%
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {formatSalary(job.salary_min, job.salary_max) && (
                    <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatSalary(job.salary_min, job.salary_max)}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-secondary/20 text-secondary text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs capitalize">
                    {job.job_type}
                  </span>
                  {job.experience_level && (
                    <span className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs capitalize">
                      {job.experience_level}
                    </span>
                  )}
                </div>

                {job.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{job.description}</p>
                )}

                <Button
                  onClick={() => handleApply(job.id)}
                  disabled={job.applied || applying === job.id}
                  className={`w-full h-10 rounded-xl text-sm ${
                    job.applied
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-gradient-to-r from-primary to-secondary'
                  }`}
                >
                  {applying === job.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : job.applied ? (
                    <><Heart className="w-4 h-4 mr-1.5 fill-current" /> Applied</>
                  ) : (
                    <><Heart className="w-4 h-4 mr-1.5" /> Apply Now</>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}
