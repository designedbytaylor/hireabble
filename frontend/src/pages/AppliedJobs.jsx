import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, MapPin, DollarSign, Clock,
  CheckCircle, XCircle, Star, Zap, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  matched: { label: 'Matched', color: 'bg-green-500/10 text-green-500', icon: CheckCircle },
  declined: { label: 'Not Selected', color: 'bg-red-500/10 text-red-500', icon: XCircle },
};

export default function AppliedJobs() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, matched, declined

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

  const filtered = filter === 'all'
    ? applications
    : applications.filter(a => a.status === filter);

  const counts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    matched: applications.filter(a => a.status === 'matched').length,
    declined: applications.filter(a => a.status === 'declined').length,
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
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px]" />
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
            { key: 'pending', label: 'Pending' },
            { key: 'matched', label: 'Matched' },
            { key: 'declined', label: 'Not Selected' },
          ].map(tab => (
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
            const statusConf = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConf.icon;
            const job = app.job;

            return (
              <div
                key={app.id}
                className="glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Company Logo */}
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {job.company_logo ? (
                      <img src={job.company_logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold font-['Outfit'] truncate">{job.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 whitespace-nowrap ${statusConf.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConf.label}
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

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {app.action === 'superlike' && <Star className="w-3 h-3 text-secondary fill-secondary" />}
                        {app.action === 'superlike' ? 'Super Liked' : 'Applied'} {new Date(app.created_at).toLocaleDateString()}
                      </span>
                      {app.status === 'matched' && (
                        <button
                          onClick={() => navigate('/matches')}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" /> View Match
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      <Navigation />
    </div>
  );
}
