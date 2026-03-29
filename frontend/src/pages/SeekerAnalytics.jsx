import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, TrendingUp, BarChart3, Zap } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function SimpleBarChart({ data, dataKey, labelKey, color = 'bg-primary' }) {
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data yet</p>;
  const max = Math.max(...data.map(d => d[dataKey]), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.slice(-14).map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={`w-full ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity min-h-[2px]`}
            style={{ height: `${(d[dataKey] / max) * 100}%` }}
            title={`${d[labelKey]}: ${d[dataKey]}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function SeekerAnalytics() {
  useDocumentTitle('Your Insights');
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API}/seeker/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="text-primary font-medium">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Your Insights</h1>
            <p className="text-xs text-muted-foreground">Analytics & trends</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <Eye className="w-5 h-5 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{data.profile_views_weekly}</p>
            <p className="text-xs text-muted-foreground">Views This Week</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{data.application_percentile}%</p>
            <p className="text-xs text-muted-foreground">App Percentile</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <BarChart3 className="w-5 h-5 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">{data.total_applications}</p>
            <p className="text-xs text-muted-foreground">Total Applied</p>
          </div>
        </div>

        {/* Profile Views Trend */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-1">Profile Views</h2>
          <p className="text-xs text-muted-foreground mb-4">Last 14 days</p>
          <SimpleBarChart data={data.profile_views_trend} dataKey="views" labelKey="date" color="bg-blue-500" />
          {data.profile_views_trend.length > 0 && (
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{data.profile_views_trend[Math.max(data.profile_views_trend.length - 14, 0)]?.date}</span>
              <span>{data.profile_views_trend[data.profile_views_trend.length - 1]?.date}</span>
            </div>
          )}
        </div>

        {/* Applications Trend */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold mb-1">Applications</h2>
          <p className="text-xs text-muted-foreground mb-4">Last 14 days</p>
          <SimpleBarChart data={data.applications_trend} dataKey="count" labelKey="date" color="bg-purple-500" />
          {data.applications_trend.length > 0 && (
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{data.applications_trend[Math.max(data.applications_trend.length - 14, 0)]?.date}</span>
              <span>{data.applications_trend[data.applications_trend.length - 1]?.date}</span>
            </div>
          )}
        </div>

        {/* Trending Skills */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="font-semibold">Skills in Demand</h2>
              <p className="text-xs text-muted-foreground">Popular skills you could add to your profile</p>
            </div>
          </div>
          {data.trending_skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">You already have the top in-demand skills!</p>
          ) : (
            <div className="space-y-3">
              {data.trending_skills.map((s, i) => {
                const maxDemand = Math.max(...data.trending_skills.map(t => t.demand), 1);
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium capitalize">{s.skill}</span>
                      <span className="text-xs text-muted-foreground">{s.demand} jobs</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${(s.demand / maxDemand) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </div>
  );
}
