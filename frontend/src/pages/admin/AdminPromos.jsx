import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tag, Plus, Copy, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TIER_OPTIONS = [
  { id: 'recruiter_pro', name: 'Recruiter Pro' },
  { id: 'recruiter_enterprise', name: 'Recruiter Premium' },
];

export default function AdminPromos() {
  const { token } = useAdminAuth();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: '',
    tier_id: 'recruiter_pro',
    duration_days: 90,
    max_uses: '',
    per_user_limit: 1,
    role_restriction: '',
    expires_at: '',
  });

  const getHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/promo-codes`, { headers: getHeaders() });
      setCodes(res.data);
    } catch {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Code is required');
    setCreating(true);
    try {
      await axios.post(`${API}/admin/promo-codes`, {
        code: form.code.trim(),
        tier_id: form.tier_id,
        duration_days: parseInt(form.duration_days) || 90,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        per_user_limit: parseInt(form.per_user_limit) || 1,
        role_restriction: form.role_restriction || null,
        expires_at: form.expires_at || null,
      }, { headers: getHeaders() });
      toast.success(`Promo code "${form.code.toUpperCase()}" created`);
      setForm({ code: '', tier_id: 'recruiter_pro', duration_days: 90, max_uses: '', per_user_limit: 1, role_restriction: '', expires_at: '' });
      setShowCreate(false);
      fetchCodes();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create promo code');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (codeItem) => {
    try {
      await axios.patch(`${API}/admin/promo-codes/${codeItem.id}`, { active: !codeItem.active }, { headers: getHeaders() });
      toast.success(`Code ${codeItem.active ? 'deactivated' : 'activated'}`);
      fetchCodes();
    } catch {
      toast.error('Failed to update');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Outfit'] text-white">Promo Codes</h1>
          <p className="text-sm text-gray-400">Create and manage promotional discount codes</p>
        </div>
        <Button onClick={() => setShowCreate(s => !s)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Create Code
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">New Promo Code</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Code</label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="RECRUITER2026"
                className="bg-gray-800 border-gray-700 uppercase"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tier</label>
              <select
                value={form.tier_id}
                onChange={e => setForm(f => ({ ...f, tier_id: e.target.value }))}
                className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-white"
              >
                {TIER_OPTIONS.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Duration (days)</label>
              <Input
                type="number"
                value={form.duration_days}
                onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Max Uses (blank = unlimited)</label>
              <Input
                type="number"
                value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                placeholder="Unlimited"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Per User Limit</label>
              <Input
                type="number"
                value={form.per_user_limit}
                onChange={e => setForm(f => ({ ...f, per_user_limit: e.target.value }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Role Restriction</label>
              <select
                value={form.role_restriction}
                onChange={e => setForm(f => ({ ...f, role_restriction: e.target.value }))}
                className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-white"
              >
                <option value="">Any role</option>
                <option value="seeker">Seekers only</option>
                <option value="recruiter">Recruiters only</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Expires At (optional)</label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={creating} className="bg-primary hover:bg-primary/90">
              {creating ? 'Creating...' : 'Create Promo Code'}
            </Button>
          </div>
        </form>
      )}

      {/* Codes List */}
      {codes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No promo codes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(c => (
            <div key={c.id} className={`bg-gray-900 border rounded-2xl p-4 sm:p-5 ${c.active ? 'border-gray-800' : 'border-gray-800 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-lg font-bold text-white font-mono">{c.code}</code>
                    <button onClick={() => copyCode(c.code)} className="text-gray-500 hover:text-white transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <Badge variant={c.active ? 'default' : 'secondary'} className="text-[10px]">
                      {c.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>Tier: <span className="text-gray-300">{TIER_OPTIONS.find(t => t.id === c.tier_id)?.name || c.tier_id}</span></span>
                    <span>Duration: <span className="text-gray-300">{c.duration_days} days</span></span>
                    <span>Uses: <span className="text-gray-300">{c.uses}{c.max_uses != null ? ` / ${c.max_uses}` : ' / ∞'}</span></span>
                    {c.role_restriction && (
                      <span>Role: <span className="text-gray-300">{c.role_restriction}s only</span></span>
                    )}
                    {c.expires_at && (
                      <span>Expires: <span className="text-gray-300">{new Date(c.expires_at).toLocaleDateString()}</span></span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(c)}
                  className={`p-2 rounded-lg transition-colors ${c.active ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:bg-gray-800'}`}
                  title={c.active ? 'Deactivate' : 'Activate'}
                >
                  {c.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
