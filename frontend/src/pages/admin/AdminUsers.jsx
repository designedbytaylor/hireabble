import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Search, Ban, ShieldOff, CheckCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminUsers() {
  const { token } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);
  const [reason, setReason] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await axios.get(`${API}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const viewDetail = async (userId) => {
    try {
      const res = await axios.get(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedUser(res.data);
      setDetailOpen(true);
    } catch (e) {
      toast.error('Failed to load user details');
    }
  };

  const updateStatus = async (userId, newStatus) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/status`, {
        status: newStatus,
        reason,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`User ${newStatus}`);
      setActionDialog(null);
      setReason('');
      fetchUsers();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const statusBadge = (status) => {
    const s = status || 'active';
    const styles = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      suspended: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      banned: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return <Badge variant="outline" className={styles[s] || styles.active}>{s}</Badge>;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">{total} total users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm"
        >
          <option value="">All Roles</option>
          <option value="seeker">Seekers</option>
          <option value="recruiter">Recruiters</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">User</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Role</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Status</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Joined</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={u.photo_url || u.avatar}
                      alt=""
                      className="w-9 h-9 rounded-full bg-gray-700"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="text-gray-300 border-gray-600 capitalize">{u.role}</Badge>
                </td>
                <td className="px-6 py-4">{statusBadge(u.status)}</td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => viewDetail(u.id)} className="text-gray-400 hover:text-white">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {(u.status || 'active') === 'active' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setActionDialog({ userId: u.id, action: 'suspended', name: u.name })} className="text-amber-400 hover:text-amber-300">
                          <ShieldOff className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setActionDialog({ userId: u.id, action: 'banned', name: u.name })} className="text-red-400 hover:text-red-300">
                          <Ban className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {(u.status === 'suspended' || u.status === 'banned') && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(u.id, 'active')} className="text-green-400 hover:text-green-300">
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
            <p className="text-sm text-gray-400">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-gray-700 text-gray-300">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="border-gray-700 text-gray-300">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={selectedUser.photo_url || selectedUser.avatar} alt="" className="w-16 h-16 rounded-full bg-gray-700" />
                <div>
                  <p className="font-semibold text-lg">{selectedUser.name}</p>
                  <p className="text-gray-400">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="capitalize border-gray-600">{selectedUser.role}</Badge>
                    {statusBadge(selectedUser.status)}
                  </div>
                </div>
              </div>
              {selectedUser.bio && <p className="text-gray-300 text-sm">{selectedUser.bio}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Location:</span> <span className="text-gray-300">{selectedUser.location || '—'}</span></div>
                <div><span className="text-gray-500">Company:</span> <span className="text-gray-300">{selectedUser.company || selectedUser.current_employer || '—'}</span></div>
                <div><span className="text-gray-500">Title:</span> <span className="text-gray-300">{selectedUser.title || '—'}</span></div>
                <div><span className="text-gray-500">Experience:</span> <span className="text-gray-300">{selectedUser.experience_years ? `${selectedUser.experience_years} years` : '—'}</span></div>
              </div>
              {selectedUser.stats && (
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(selectedUser.stats).map(([k, v]) => (
                    <div key={k} className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{v}</p>
                      <p className="text-xs text-gray-500 capitalize">{k.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban/Suspend Confirmation Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setReason(''); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'banned' ? 'Ban' : 'Suspend'} {actionDialog?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              {actionDialog?.action === 'banned'
                ? 'This user will be permanently banned from the platform.'
                : 'This user will be temporarily suspended.'}
            </p>
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setReason(''); }} className="border-gray-600 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={() => updateStatus(actionDialog.userId, actionDialog.action)}
              className={actionDialog?.action === 'banned' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {actionDialog?.action === 'banned' ? 'Ban User' : 'Suspend User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
