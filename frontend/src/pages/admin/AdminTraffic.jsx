import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Eye, Users, Activity, RefreshCw, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-red-400" />
        </div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value?.toLocaleString?.() ?? value ?? 0}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminTraffic() {
  const { token } = useAdminAuth();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/analytics/traffic`, {
        params: { days },
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      console.error('Failed to load traffic', e);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const timeseries = (data?.timeseries || []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  const topPages = data?.top_pages || [];
  const topReferrers = data?.top_referrers || [];
  const devices = data?.devices || [];
  const totalDevice = devices.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-red-400" />
            Web Traffic
          </h1>
          <p className="text-gray-400 text-sm mt-1">First-party page-view analytics. Admin paths are excluded.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
            {[1, 7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  days === d ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {d === 1 ? '24h' : `${d}d`}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Eye} label="Page Views" value={summary.total_views} />
        <StatCard icon={Users} label="Unique Visitors" value={summary.unique_visitors} />
        <StatCard icon={Activity} label="Sessions" value={summary.unique_sessions} />
        <StatCard
          icon={Users}
          label="Authenticated"
          value={summary.authenticated}
          sub={`${summary.anonymous || 0} anonymous`}
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Traffic over time</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12 }} />
              <Line type="monotone" dataKey="views" stroke="#ef4444" strokeWidth={2} dot={false} name="Views" />
              <Line type="monotone" dataKey="visitors" stroke="#6366f1" strokeWidth={2} dot={false} name="Visitors" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4">Top pages</h2>
          <div className="space-y-2">
            {topPages.length === 0 && <p className="text-gray-500 text-sm">No data</p>}
            {topPages.map(p => (
              <div key={p.path} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <span className="text-gray-300 truncate flex-1 mr-3">{p.path}</span>
                <span className="text-white font-medium tabular-nums">{p.views}</span>
                <span className="text-gray-500 text-xs ml-3 tabular-nums w-16 text-right">{p.unique} uniq</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4">Top referrers</h2>
          <div className="space-y-2">
            {topReferrers.length === 0 && <p className="text-gray-500 text-sm">No data</p>}
            {topReferrers.map(r => (
              <div key={r.source} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <span className="text-gray-300 truncate flex-1 mr-3">{r.source}</span>
                <span className="text-white font-medium tabular-nums">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Devices</h2>
        <div className="space-y-3">
          {devices.length === 0 && <p className="text-gray-500 text-sm">No data</p>}
          {devices.map(d => {
            const pct = Math.round((d.count / totalDevice) * 100);
            return (
              <div key={d.device}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300 capitalize">{d.device}</span>
                  <span className="text-gray-400">{d.count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
