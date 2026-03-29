import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Users, Briefcase, Heart, MessageSquare, ShieldAlert, Flag,
  UserX, UserMinus, TrendingUp, MapPin, Globe,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];

function StatCard({ icon: Icon, label, value, color = 'indigo', sub }) {
  const colors = {
    indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-lg">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminOverview() {
  const { token } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const u = data?.users || {};
  const j = data?.jobs || {};
  const a = data?.activity || {};
  const m = data?.moderation || {};
  const growth = data?.growth || [];
  const topLocations = data?.top_locations || [];
  const jobTypes = data?.job_types || {};

  const pieData = [
    { name: 'Remote', value: jobTypes.remote || 0 },
    { name: 'On-site', value: jobTypes.onsite || 0 },
    { name: 'Hybrid', value: jobTypes.hybrid || 0 },
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-gray-400 mt-1">Monitor your platform in real-time</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Users" value={u.total} color="indigo" />
        <StatCard icon={Briefcase} label="Active Jobs" value={j.active} color="green" sub={`${j.total} total`} />
        <StatCard icon={Heart} label="Connections" value={a.matches} color="purple" />
        <StatCard icon={MessageSquare} label="Messages" value={a.messages} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={TrendingUp} label="Applications" value={a.applications} color="green" />
        <StatCard icon={Users} label="Seekers" value={u.seekers} color="indigo" sub={`${u.recruiters} recruiters`} />
        <StatCard icon={UserX} label="Banned Users" value={u.banned} color="red" />
        <StatCard icon={UserMinus} label="Suspended" value={u.suspended} color="amber" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Growth Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Platform Growth (14 days)</h2>
          </div>
          {growth.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#374151' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#374151' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Area type="monotone" dataKey="users" name="New Users" stroke="#6366f1" fill="url(#colorUsers)" strokeWidth={2} />
                <Area type="monotone" dataKey="applications" name="Applications" stroke="#22c55e" fill="url(#colorApps)" strokeWidth={2} />
                <Area type="monotone" dataKey="matches" name="Connections" stroke="#ec4899" fill="url(#colorMatches)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-500">No growth data yet</div>
          )}
        </div>

        {/* Job Type Distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Briefcase className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Job Type Distribution</h2>
          </div>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {pieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                    <span className="text-sm text-gray-300">{entry.name}</span>
                    <span className="text-sm font-bold text-white">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-500">No jobs yet</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Locations */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Top User Locations</h2>
          </div>
          {topLocations.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topLocations} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#374151' }} />
                <YAxis dataKey="location" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={120} axisLine={{ stroke: '#374151' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Users" radius={[0, 6, 6, 0]}>
                  {topLocations.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-500">No location data</div>
          )}
        </div>

        {/* Moderation & Reports + Platform Health */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Moderation Queue</h2>
            </div>
            <p className="text-4xl font-bold text-white">{m.pending_moderation}</p>
            <p className="text-sm text-gray-400 mt-1">items awaiting review</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Flag className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Pending Reports</h2>
            </div>
            <p className="text-4xl font-bold text-white">{m.pending_reports}</p>
            <p className="text-sm text-gray-400 mt-1">user reports to review</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Platform Health</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Match Rate</span>
                <span className="text-sm font-bold text-white">
                  {a.applications > 0 ? Math.round(a.matches / a.applications * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500"
                  style={{ width: `${a.applications > 0 ? Math.min(100, Math.round(a.matches / a.applications * 100)) : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Msgs per Match</span>
                <span className="text-sm font-bold text-white">
                  {a.matches > 0 ? Math.round(a.messages / a.matches * 10) / 10 : 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Jobs per Recruiter</span>
                <span className="text-sm font-bold text-white">
                  {u.recruiters > 0 ? Math.round(j.total / u.recruiters * 10) / 10 : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
