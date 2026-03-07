import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Search, Ban, ShieldOff, CheckCircle, ChevronLeft, ChevronRight,
  ArrowLeft, User, MapPin, Briefcase, Calendar, Mail, AlertTriangle,
  Heart, FileText, Flag, GraduationCap, Building2, Clock,
} from 'lucide-react';
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

  // Detail view
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action dialog
  const [actionTarget, setActionTarget] = useState(null); // { userId, action, name }
  const [reason, setReason] = useState('');
  const [actioning, setActioning] = useState(false);

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
    setSelectedUserId(userId);
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserDetail(res.data);
    } catch (e) {
      toast.error('Failed to load user details');
      setSelectedUserId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateStatus = async (userId, newStatus) => {
    setActioning(true);
    try {
      await axios.put(`${API}/admin/users/${userId}/status`, {
        status: newStatus,
        reason,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`User ${newStatus}`);
      setActionTarget(null);
      setReason('');
      // Refresh detail if viewing
      if (selectedUserId === userId) viewDetail(userId);
      fetchUsers();
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setActioning(false);
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

  // ==================== USER DETAIL VIEW ====================
  if (selectedUserId) {
    return (
      <div>
        <button
          onClick={() => { setSelectedUserId(null); setUserDetail(null); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </button>

        {loadingDetail ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : userDetail ? (
          <div className="space-y-6">
            {/* User Header */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {(userDetail.photo_url || userDetail.avatar) ? (
                    <img
                      src={userDetail.photo_url || userDetail.avatar}
                      alt=""
                      className="w-16 h-16 rounded-full bg-gray-700 object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl font-bold">
                      {userDetail.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-white">{userDetail.name}</h1>
                    <p className="text-gray-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5" /> {userDetail.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">{userDetail.role}</Badge>
                      {statusBadge(userDetail.status)}
                      {(userDetail.strikes || 0) > 0 && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {userDetail.strikes}/3 strikes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(userDetail.status || 'active') === 'active' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setActionTarget({ userId: userDetail.id, action: 'suspended', name: userDetail.name })}
                        className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                      >
                        <ShieldOff className="w-4 h-4 mr-2" /> Suspend
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActionTarget({ userId: userDetail.id, action: 'banned', name: userDetail.name })}
                        className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                      >
                        <Ban className="w-4 h-4 mr-2" /> Ban
                      </Button>
                    </>
                  )}
                  {(userDetail.status === 'suspended' || userDetail.status === 'banned') && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus(userDetail.id, 'active')}
                      className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Reactivate
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            {userDetail.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: 'Applications', value: userDetail.stats.applications, icon: FileText, color: 'text-blue-400' },
                  { label: 'Matches', value: userDetail.stats.matches, icon: Heart, color: 'text-pink-400' },
                  { label: 'Jobs Posted', value: userDetail.stats.jobs_posted, icon: Briefcase, color: 'text-purple-400' },
                  { label: 'Reports Against', value: userDetail.stats.reports_against, icon: Flag, color: userDetail.stats.reports_against > 0 ? 'text-red-400' : 'text-gray-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                    <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Profile Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" /> Profile
                </h2>
                <div className="space-y-3 text-sm">
                  {userDetail.title && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-gray-300">{userDetail.title}</span>
                    </div>
                  )}
                  {(userDetail.company || userDetail.current_employer) && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-gray-300">{userDetail.company || userDetail.current_employer}</span>
                    </div>
                  )}
                  {userDetail.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-gray-300">{userDetail.location}</span>
                    </div>
                  )}
                  {userDetail.school && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-gray-300">{userDetail.school}{userDetail.degree ? ` (${userDetail.degree})` : ''}</span>
                    </div>
                  )}
                  {userDetail.experience_years && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-gray-300">{userDetail.experience_years} years experience</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-gray-300">Joined {new Date(userDetail.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {userDetail.bio && (
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">Bio</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{userDetail.bio}</p>
                  </div>
                )}
              </div>

              {/* Skills & Status Info */}
              <div className="space-y-6">
                {/* Skills */}
                {userDetail.skills?.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-white mb-3">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {userDetail.skills.map((skill, i) => (
                        <Badge key={i} variant="outline" className="border-gray-700 text-gray-300">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account Status */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-gray-500" /> Account Status
                  </h2>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      {statusBadge(userDetail.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Strikes</span>
                      <span className={`${(userDetail.strikes || 0) > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {userDetail.strikes || 0} / 3
                      </span>
                    </div>
                    {userDetail.status_reason && (
                      <div className="pt-2 border-t border-gray-800">
                        <p className="text-xs text-gray-500 mb-1">Status Reason</p>
                        <p className="text-gray-300 text-sm">{userDetail.status_reason}</p>
                      </div>
                    )}
                    {userDetail.status_updated_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Updated</span>
                        <span className="text-gray-300">{new Date(userDetail.status_updated_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preferences (if seeker) */}
                {userDetail.role === 'seeker' && userDetail.preferences && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-bold text-white">Job Preferences</h2>
                    <div className="text-sm space-y-2">
                      {userDetail.preferences.job_types?.length > 0 && (
                        <div>
                          <span className="text-gray-500">Job Types: </span>
                          <span className="text-gray-300">{userDetail.preferences.job_types.join(', ')}</span>
                        </div>
                      )}
                      {userDetail.preferences.salary_min && (
                        <div>
                          <span className="text-gray-500">Min Salary: </span>
                          <span className="text-gray-300">${userDetail.preferences.salary_min.toLocaleString()}</span>
                        </div>
                      )}
                      {userDetail.preferences.locations?.length > 0 && (
                        <div>
                          <span className="text-gray-500">Preferred Locations: </span>
                          <span className="text-gray-300">{userDetail.preferences.locations.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Action Confirmation Dialog */}
        {actionTarget && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  actionTarget.action === 'banned' ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  {actionTarget.action === 'banned'
                    ? <Ban className="w-5 h-5 text-red-400" />
                    : <ShieldOff className="w-5 h-5 text-amber-400" />
                  }
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {actionTarget.action === 'banned' ? 'Ban' : 'Suspend'} {actionTarget.name}?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {actionTarget.action === 'banned'
                      ? 'This user will be permanently banned.'
                      : 'This user will be temporarily suspended.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <Label className="text-gray-300">Reason (optional)</Label>
                <Textarea
                  placeholder="Why is this user being actioned?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[80px] resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300"
                  onClick={() => { setActionTarget(null); setReason(''); }}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 text-white ${
                    actionTarget.action === 'banned'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                  disabled={actioning}
                  onClick={() => updateStatus(actionTarget.userId, actionTarget.action)}
                >
                  {actioning ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    actionTarget.action === 'banned' ? 'Ban User' : 'Suspend User'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== USER LIST VIEW ====================
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
              <tr
                key={u.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                onClick={() => viewDetail(u.id)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {(u.photo_url || u.avatar) ? (
                      <img src={u.photo_url || u.avatar} alt="" className="w-9 h-9 rounded-full bg-gray-700 object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold">
                        {u.name?.charAt(0) || '?'}
                      </div>
                    )}
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
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {(u.status || 'active') === 'active' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setActionTarget({ userId: u.id, action: 'suspended', name: u.name })} className="text-amber-400 hover:text-amber-300">
                          <ShieldOff className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setActionTarget({ userId: u.id, action: 'banned', name: u.name })} className="text-red-400 hover:text-red-300">
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

      {/* Action Confirmation Dialog (from list view) */}
      {actionTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                actionTarget.action === 'banned' ? 'bg-red-500/20' : 'bg-amber-500/20'
              }`}>
                {actionTarget.action === 'banned'
                  ? <Ban className="w-5 h-5 text-red-400" />
                  : <ShieldOff className="w-5 h-5 text-amber-400" />
                }
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {actionTarget.action === 'banned' ? 'Ban' : 'Suspend'} {actionTarget.name}?
                </h3>
                <p className="text-gray-400 text-sm">
                  {actionTarget.action === 'banned'
                    ? 'This user will be permanently banned.'
                    : 'This user will be temporarily suspended.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <Label className="text-gray-300">Reason (optional)</Label>
              <Textarea
                placeholder="Why is this user being actioned?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[80px] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-700 text-gray-300"
                onClick={() => { setActionTarget(null); setReason(''); }}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 text-white ${
                  actionTarget.action === 'banned'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
                disabled={actioning}
                onClick={() => updateStatus(actionTarget.userId, actionTarget.action)}
              >
                {actioning ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  actionTarget.action === 'banned' ? 'Ban User' : 'Suspend User'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
