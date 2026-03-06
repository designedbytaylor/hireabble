import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Users, Briefcase, Heart, MessageSquare, ShieldAlert, Flag,
  UserX, UserMinus, TrendingUp,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-gray-400 mt-1">Monitor your platform in real-time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Users" value={u.total} color="indigo" />
        <StatCard icon={Briefcase} label="Active Jobs" value={j.active} color="green" sub={`${j.total} total`} />
        <StatCard icon={Heart} label="Matches" value={a.matches} color="purple" />
        <StatCard icon={MessageSquare} label="Messages" value={a.messages} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={TrendingUp} label="Applications" value={a.applications} color="green" />
        <StatCard icon={Users} label="Seekers" value={u.seekers} color="indigo" sub={`${u.recruiters} recruiters`} />
        <StatCard icon={UserX} label="Banned Users" value={u.banned} color="red" />
        <StatCard icon={UserMinus} label="Suspended" value={u.suspended} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
