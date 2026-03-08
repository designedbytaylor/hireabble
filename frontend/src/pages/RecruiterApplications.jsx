import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Briefcase, Star, Check, X, Clock, ArrowLeft,
  MapPin, GraduationCap, Building2, Heart
} from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterApplications() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'accepted', 'rejected', 'matched'

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

  const getStatus = (app) => {
    if (app.is_matched) return 'matched';
    if (app.recruiter_action === 'accept') return 'accepted';
    if (app.recruiter_action === 'reject') return 'rejected';
    return 'pending';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'matched':
        return <span className="px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-500 text-xs font-medium flex items-center gap-1"><Heart className="w-3 h-3" /> Matched</span>;
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full bg-success/20 text-success text-xs font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Accepted</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full bg-destructive/20 text-destructive text-xs font-medium flex items-center gap-1"><X className="w-3 h-3" /> Declined</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  const filtered = filter === 'all'
    ? applications
    : applications.filter(app => getStatus(app) === filter);

  const counts = {
    all: applications.length,
    pending: applications.filter(a => getStatus(a) === 'pending').length,
    accepted: applications.filter(a => getStatus(a) === 'accepted').length,
    rejected: applications.filter(a => getStatus(a) === 'rejected').length,
    matched: applications.filter(a => getStatus(a) === 'matched').length,
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
            { key: 'pending', label: 'Pending' },
            { key: 'accepted', label: 'Accepted' },
            { key: 'matched', label: 'Matched' },
            { key: 'rejected', label: 'Declined' },
          ].map(({ key, label }) => (
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
              const status = getStatus(app);
              return (
                <div
                  key={app.id}
                  className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:border-primary/20 transition-colors"
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

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {getStatusBadge(status)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}
