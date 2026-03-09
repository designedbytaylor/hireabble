import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Database, Users, Trash2, Play,
  LogIn, ExternalLink, RefreshCw, CheckCircle,
  Beaker, UserCheck, Building2
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTesting() {
  const { token } = useAdminAuth();
  const [loading, setLoading] = useState({ seed: false, clear: false, impersonate: null });
  const [seedResult, setSeedResult] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = {};
      if (filter === 'seeker' || filter === 'recruiter') params.role = filter;
      if (filter === 'test') params.search = '@test.hireabble.com';
      const res = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { ...params, limit: 50 },
      });
      setUsers(res.data.users || []);
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSeed = async () => {
    setLoading(prev => ({ ...prev, seed: true }));
    try {
      const res = await axios.post(`${API}/admin/seed-test-data`, {
        seekers: 10,
        recruiters: 5,
        jobs_per_recruiter: 2,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSeedResult(res.data);
      toast.success('Test data seeded!');
      fetchUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to seed data');
    } finally {
      setLoading(prev => ({ ...prev, seed: false }));
    }
  };

  const handleClear = async () => {
    if (!window.confirm('This will delete ALL test accounts (@test.hireabble.com) and their data. Continue?')) return;
    setLoading(prev => ({ ...prev, clear: true }));
    try {
      const res = await axios.delete(`${API}/admin/clear-test-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(res.data.message);
      setSeedResult(null);
      fetchUsers();
    } catch (e) {
      toast.error('Failed to clear data');
    } finally {
      setLoading(prev => ({ ...prev, clear: false }));
    }
  };

  const handleImpersonate = async (user) => {
    setLoading(prev => ({ ...prev, impersonate: user.id }));

    // Open window immediately during user gesture (before async call)
    // Safari blocks popups/navigation that happen after async operations
    const newWindow = window.open('about:blank', '_blank');

    try {
      const res = await axios.post(`${API}/admin/impersonate/${user.id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const impersonateToken = res.data.token;
      const targetPath = user.role === 'seeker' ? '/dashboard' : '/recruiter';

      const baseUrl = window.location.origin;
      const impersonateUrl = `${baseUrl}/impersonate?token=${encodeURIComponent(impersonateToken)}&redirect=${encodeURIComponent(targetPath)}`;

      if (newWindow) {
        // Navigate the already-opened window to the impersonation URL
        newWindow.location.href = impersonateUrl;
      } else {
        // Fallback: navigate in same tab if popup was still blocked
        window.location.href = impersonateUrl;
      }

      toast.success(`Opening as ${user.name}...`);
    } catch (e) {
      // Close the blank window on error
      if (newWindow) newWindow.close();
      toast.error('Failed to impersonate user');
    } finally {
      setLoading(prev => ({ ...prev, impersonate: null }));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Beaker className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" /> Testing Tools
        </h1>
        <p className="text-gray-400 mt-1 text-sm">Seed test data, impersonate users, and test the app</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-green-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-white">Seed Test Data</h2>
              <p className="text-xs text-gray-400">10 seekers, 5 recruiters, jobs & matches</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Password: <code className="text-green-400 bg-gray-800 px-2 py-0.5 rounded">testpass123</code>
          </p>
          <Button onClick={handleSeed} disabled={loading.seed} className="w-full bg-green-600 hover:bg-green-700">
            {loading.seed ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {loading.seed ? 'Seeding...' : 'Seed Test Data'}
          </Button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-white">Clear Test Data</h2>
              <p className="text-xs text-gray-400">Remove @test.hireabble.com accounts</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Only test accounts are removed. Real data is safe.
          </p>
          <Button onClick={handleClear} disabled={loading.clear} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10">
            {loading.clear ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {loading.clear ? 'Clearing...' : 'Clear Test Data'}
          </Button>
        </div>
      </div>

      {/* Seed Result */}
      {seedResult && (
        <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-base sm:text-lg font-semibold text-white">Data Seeded</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
            {Object.entries(seedResult.summary).map(([key, value]) => (
              <div key={key} className="bg-gray-800 rounded-xl p-2 sm:p-3 text-center">
                <div className="text-lg sm:text-2xl font-bold text-white">{value}</div>
                <div className="text-[10px] sm:text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">Password: <code className="text-green-400">testpass123</code></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div>
                <div className="text-xs font-medium text-blue-400 mb-1">Seekers</div>
                <div className="space-y-0.5">
                  {seedResult.test_credentials.seeker_emails.slice(0, 3).map(email => (
                    <div key={email} className="text-[10px] sm:text-xs text-gray-400 font-mono truncate">{email}</div>
                  ))}
                  {seedResult.test_credentials.seeker_emails.length > 3 && (
                    <div className="text-[10px] text-gray-600">+{seedResult.test_credentials.seeker_emails.length - 3} more</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-purple-400 mb-1">Recruiters</div>
                <div className="space-y-0.5">
                  {seedResult.test_credentials.recruiter_emails.slice(0, 3).map(email => (
                    <div key={email} className="text-[10px] sm:text-xs text-gray-400 font-mono truncate">{email}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <LogIn className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-white">Impersonate User</h2>
              <p className="text-xs text-gray-400">Log in as any user</p>
            </div>
          </div>
          <button onClick={fetchUsers} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'seeker', label: 'Seekers' },
            { value: 'recruiter', label: 'Recruiters' },
            { value: 'test', label: 'Test Only' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.value
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                <img
                  src={u.photo_url || u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                  alt={u.name}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium text-white truncate">{u.name}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 ${
                      u.role === 'seeker' ? 'border-blue-500/30 text-blue-400' : 'border-purple-500/30 text-purple-400'
                    }`}>
                      {u.role === 'seeker' ? <><UserCheck className="w-2.5 h-2.5 mr-0.5" />S</> : <><Building2 className="w-2.5 h-2.5 mr-0.5" />R</>}
                    </Badge>
                    {u.email?.includes('@test.hireabble.com') && (
                      <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-[9px] px-1">TEST</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">{u.email}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleImpersonate(u)}
                  disabled={loading.impersonate === u.id}
                  className="bg-blue-600 hover:bg-blue-700 text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 flex-shrink-0"
                >
                  {loading.impersonate === u.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <><ExternalLink className="w-3 h-3 mr-0.5" /> Go</>
                  )}
                </Button>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No users found. Seed test data first!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
