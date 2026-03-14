import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Users, Download, TrendingUp, MapPin, GraduationCap, Briefcase,
  DollarSign, Building2, Crown, RefreshCw, BarChart3, Mail,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e', '#64748b', '#d946ef'];

function downloadCSV(data, filename) {
  if (!data?.length) return toast.error('No data to export');
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl bg-${color}/10 flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 text-${color}`} />
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 p-4 sm:p-5 text-left hover:bg-gray-800/50 transition-colors">
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
        <h2 className="text-lg font-bold font-['Outfit'] text-white flex-1">{title}</h2>
        <span className="text-gray-500 text-sm">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5">{children}</div>}
    </div>
  );
}

function DataTable({ data, labelKey, valueKey, labelHeader = 'Item', valueHeader = 'Count' }) {
  if (!data?.length) return <p className="text-sm text-gray-500">No data</p>;
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  return (
    <div className="space-y-1.5">
      <div className="flex text-xs text-gray-500 px-2">
        <span className="flex-1">{labelHeader}</span>
        <span className="w-16 text-right">{valueHeader}</span>
        <span className="w-14 text-right">%</span>
      </div>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800/50 text-sm">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
          <span className="flex-1 text-gray-300 truncate">{d[labelKey]}</span>
          <span className="w-16 text-right text-gray-400 tabular-nums">{d[valueKey].toLocaleString()}</span>
          <span className="w-14 text-right text-gray-500 tabular-nums">{total ? Math.round(d[valueKey] / total * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminStats() {
  const { token } = useAdminAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [growthView, setGrowthView] = useState('weekly');

  const getHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/stats/comprehensive`, { headers: getHeaders() });
      setStats(res.data);
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const exportUsers = async (role, label) => {
    setExporting(role);
    try {
      const res = await axios.get(`${API}/admin/export/users?role=${role}`, { headers: getHeaders() });
      downloadCSV(res.data, `hireabble-${label}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${label} exported`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const { overview, age_distribution, top_locations, subscription_breakdown, growth, seeker_stats, recruiter_stats } = stats;
  const growthData = growthView === 'weekly' ? growth.weekly : growth.monthly;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Outfit'] text-white">Comprehensive Stats</h1>
          <p className="text-sm text-gray-400">Detailed analytics for marketing planning</p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Total Users" value={overview.total_users.toLocaleString()} />
        <StatCard icon={Users} label="Seekers" value={overview.seekers.toLocaleString()} color="blue-500" />
        <StatCard icon={Building2} label="Recruiters" value={overview.recruiters.toLocaleString()} color="purple-500" />
        <StatCard icon={TrendingUp} label="Onboarding Rate" value={`${overview.onboarding_complete_rate}%`} color="green-500" />
        <StatCard icon={Mail} label="Verified Emails" value={`${overview.email_verified_rate}%`} color="cyan-500" />
        <StatCard icon={Mail} label="Marketing Opt-ins" value={overview.marketing_opt_in_count.toLocaleString()} color="pink-500" />
      </div>

      {/* Growth */}
      <Section title="Signup Growth" icon={TrendingUp}>
        <div className="flex gap-2 mb-4">
          {['weekly', 'monthly'].map(v => (
            <button key={v} onClick={() => setGrowthView(v)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${growthView === v ? 'bg-primary text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >{v === 'weekly' ? 'Weekly' : 'Monthly'}</button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={growthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey={growthView === 'weekly' ? 'week' : 'month'} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 12, color: '#fff' }} />
            <Bar dataKey="signups" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Age Distribution" icon={Users}>
          {age_distribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={age_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="range" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 12, color: '#fff' }} />
                  <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <DataTable data={age_distribution} labelKey="range" valueKey="count" labelHeader="Age Range" />
            </>
          ) : <p className="text-sm text-gray-500">No date of birth data available</p>}
        </Section>

        <Section title="Top Locations" icon={MapPin}>
          <DataTable data={top_locations} labelKey="location" valueKey="count" labelHeader="Location" />
        </Section>
      </div>

      {/* Subscriptions */}
      <Section title="Subscription Breakdown" icon={Crown}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie data={subscription_breakdown} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={80} label={({ tier, percent }) => `${tier} ${(percent * 100).toFixed(0)}%`}>
                {subscription_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 12, color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <DataTable data={subscription_breakdown} labelKey="tier" valueKey="count" labelHeader="Tier" />
        </div>
      </Section>

      {/* Seeker Insights */}
      <Section title="Seeker Insights" icon={Briefcase}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Skills</h3>
            <DataTable data={seeker_stats.top_skills} labelKey="skill" valueKey="count" labelHeader="Skill" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Job Type Preferences</h3>
            <DataTable data={seeker_stats.job_type_preferences} labelKey="type" valueKey="count" labelHeader="Type" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Work Preferences</h3>
            <DataTable data={seeker_stats.work_preferences} labelKey="type" valueKey="count" labelHeader="Preference" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Education</h3>
            <DataTable data={seeker_stats.degree_breakdown} labelKey="degree" valueKey="count" labelHeader="Degree" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Experience Level</h3>
            <DataTable data={seeker_stats.experience_distribution} labelKey="range" valueKey="count" labelHeader="Years" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Salary Expectations</h3>
            <DataTable data={seeker_stats.salary_ranges} labelKey="range" valueKey="count" labelHeader="Range" />
          </div>
        </div>
      </Section>

      {/* Recruiter Insights */}
      <Section title="Recruiter Insights" icon={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Companies</h3>
            <DataTable data={recruiter_stats.top_companies} labelKey="company" valueKey="count" labelHeader="Company" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Overview</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                <span className="text-sm text-gray-400">Active Job Posters</span>
                <span className="text-lg font-bold text-white">{recruiter_stats.active_job_posters}</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Export */}
      <Section title="Export Data" icon={Download} defaultOpen={true}>
        <p className="text-sm text-gray-400 mb-4">Download user data as CSV spreadsheets. Marketing opt-in status is included in all exports.</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => exportUsers('seeker', 'seekers')} disabled={!!exporting} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {exporting === 'seeker' ? 'Exporting...' : 'Export Seekers'}
          </Button>
          <Button onClick={() => exportUsers('recruiter', 'recruiters')} disabled={!!exporting} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {exporting === 'recruiter' ? 'Exporting...' : 'Export Recruiters'}
          </Button>
          <Button onClick={() => exportUsers('all', 'all-users')} disabled={!!exporting} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {exporting === 'all' ? 'Exporting...' : 'Export All Users'}
          </Button>
        </div>
      </Section>
    </div>
  );
}
