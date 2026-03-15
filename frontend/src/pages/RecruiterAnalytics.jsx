import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, TrendingUp, Users, Briefcase,
  Heart, Star, Calendar, Clock, CheckCircle, XCircle,
  Target, Zap, Crown, Lock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterAnalytics() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const sub = user?.subscription || {};
  const isSubscribed = sub.status === 'active' && ['recruiter_pro', 'recruiter_enterprise'].includes(sub.tier_id);

  useEffect(() => {
    if (isSubscribed) fetchStats();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats/recruiter`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>
        <header className="relative z-10 p-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold font-['Outfit']">Analytics</h1>
        </header>
        <main className="relative z-10 px-6 flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="glass-card rounded-3xl p-8 text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold font-['Outfit'] mb-2">Unlock Analytics</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Get detailed insights into your hiring performance with Pro or Enterprise.
              Track response rates, match rates, weekly trends, and per-job analytics.
            </p>
            <button
              onClick={() => navigate('/upgrade')}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" /> Upgrade to Pro
            </button>
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Failed to load analytics.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/recruiter')} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Analytics</h1>
            <p className="text-muted-foreground text-sm">{user?.company || 'Your Company'}</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={<Briefcase className="w-6 h-6 text-primary" />}
            value={stats.active_jobs}
            label="Active Jobs"
            sublabel={`${stats.total_jobs} total`}
            color="primary"
          />
          <MetricCard
            icon={<Users className="w-6 h-6 text-green-500" />}
            value={stats.total_applications}
            label="Applications"
            sublabel={`${stats.pending_applications} pending`}
            color="green-500"
          />
          <MetricCard
            icon={<Heart className="w-6 h-6 text-pink-500" />}
            value={stats.matches}
            label="Matches"
            sublabel={`${stats.match_rate}% rate`}
            color="pink-500"
          />
          <MetricCard
            icon={<Star className="w-6 h-6 text-secondary" />}
            value={stats.super_likes}
            label="Super Likes"
            sublabel="received"
            color="secondary"
          />
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-8 space-y-6">
        {/* Performance Overview */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-lg font-bold font-['Outfit'] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Performance
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Response Rate</span>
              </div>
              <div className="text-3xl font-bold font-['Outfit']">{stats.response_rate}%</div>
              <ProgressBar value={stats.response_rate} color="primary" />
            </div>
            <div className="p-4 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-xs text-muted-foreground">Match Rate</span>
              </div>
              <div className="text-3xl font-bold font-['Outfit']">{stats.match_rate}%</div>
              <ProgressBar value={stats.match_rate} color="pink-500" />
            </div>
            <div className="p-4 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Weekly Apps</span>
              </div>
              <div className="text-3xl font-bold font-['Outfit']">{stats.weekly_applications}</div>
              <div className="text-xs text-muted-foreground mt-1">last 7 days</div>
            </div>
            <div className="p-4 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Interviews</span>
              </div>
              <div className="text-3xl font-bold font-['Outfit']">{stats.interviews_scheduled}</div>
              <div className="text-xs text-muted-foreground mt-1">{stats.interviews_pending} pending</div>
            </div>
          </div>
        </section>

        {/* Pipeline Funnel */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="text-lg font-bold font-['Outfit'] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Hiring Funnel
          </h2>
          <FunnelChart
            stages={[
              { label: 'Applications', value: stats.total_applications, color: 'bg-blue-500' },
              { label: 'Reviewed', value: stats.total_applications - stats.pending_applications, color: 'bg-yellow-500' },
              { label: 'Matched', value: stats.matches, color: 'bg-pink-500' },
              { label: 'Interviewed', value: stats.interviews_scheduled, color: 'bg-green-500' },
            ]}
          />
        </section>

        {/* Top Jobs Performance */}
        {stats.top_jobs?.length > 0 && (
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-lg font-bold font-['Outfit'] mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> Job Performance
            </h2>
            <div className="space-y-3">
              {stats.top_jobs.map((job, i) => (
                <div key={job.job_id} className="flex items-center gap-4 p-3 rounded-xl bg-background border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{job.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {job.applications} apps</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {job.matches} matches</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {job.applications > 0 ? Math.round(job.matches / job.applications * 100) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">conv.</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Navigation />
    </div>
  );
}

function MetricCard({ icon, value, label, sublabel, color }) {
  return (
    <div className={`glass-card rounded-2xl p-5 hover:border-${color}/30 transition-colors`}>
      <div className={`w-12 h-12 rounded-xl bg-${color}/20 flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-3xl font-bold font-['Outfit']">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {sublabel && <div className="text-xs text-muted-foreground/60">{sublabel}</div>}
    </div>
  );
}

function ProgressBar({ value, color }) {
  return (
    <div className="w-full h-2 rounded-full bg-background mt-2 overflow-hidden">
      <div
        className={`h-full rounded-full bg-${color} transition-all duration-500`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function FunnelChart({ stages }) {
  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const width = Math.max(10, (stage.value / maxValue) * 100);
        return (
          <div key={i} className="flex items-center gap-4">
            <div className="w-24 text-sm text-muted-foreground text-right">{stage.label}</div>
            <div className="flex-1 relative">
              <div className="w-full h-10 rounded-lg bg-background overflow-hidden">
                <div
                  className={`h-full ${stage.color} rounded-lg flex items-center px-3 transition-all duration-700`}
                  style={{ width: `${width}%` }}
                >
                  <span className="text-white text-sm font-bold">{stage.value}</span>
                </div>
              </div>
            </div>
            {i < stages.length - 1 && stages[i].value > 0 && (
              <div className="text-xs text-muted-foreground w-12 text-right">
                {Math.round(stages[i + 1].value / stages[i].value * 100)}%
              </div>
            )}
            {(i === stages.length - 1 || stages[i].value === 0) && (
              <div className="w-12" />
            )}
          </div>
        );
      })}
    </div>
  );
}
