import { useState, useEffect, useCallback } from 'react';
import { BadgeCheck, Check, X, ChevronLeft, ChevronRight, MapPin, Briefcase, GraduationCap, Building2, Clock, Mail, Calendar, Star, Shield, ShieldOff, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getPhotoUrl, handleImgError } from '../../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminVerification() {
  const { token } = useAdminAuth();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // User detail modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/verification-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: statusFilter, page, limit: 20 },
      });
      setRequests(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, page]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (requestId, action, reason = '') => {
    setActionLoading(requestId);
    try {
      await axios.put(`${API}/admin/verification-requests/${requestId}`, { action, reason }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(action === 'approve' ? 'User verified!' : 'Request rejected');
      setRejectingId(null);
      setRejectReason('');
      fetchRequests();
      // Refresh the user detail if modal is open
      if (selectedUser?.req?.id === requestId) {
        setSelectedUser(null);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const openUserDetail = async (req) => {
    setUserLoading(true);
    setSelectedUser({ req, user: null });
    setRevokeConfirm(false);
    setRevokeReason('');
    try {
      const res = await axios.get(`${API}/admin/users/${req.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedUser({ req, user: res.data });
    } catch {
      toast.error('Failed to load user details');
      setSelectedUser(null);
    } finally {
      setUserLoading(false);
    }
  };

  const handleRevoke = async (userId) => {
    setRevokeLoading(true);
    try {
      await axios.put(`${API}/admin/users/${userId}/revoke-verification`, { reason: revokeReason }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Verification removed');
      setSelectedUser(null);
      setRevokeConfirm(false);
      setRevokeReason('');
      fetchRequests();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to revoke verification');
    } finally {
      setRevokeLoading(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm text-white break-words">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BadgeCheck className="w-6 h-6 text-blue-400" /> Verification Requests
          </h1>
          <p className="text-gray-400 text-sm mt-1">{total} {statusFilter} request{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['pending', 'approved', 'rejected', 'revoked'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                statusFilter === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BadgeCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No {statusFilter} verification requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:bg-gray-800/80 transition-colors"
              onClick={() => openUserDetail(req)}
            >
              <div className="flex items-center gap-4">
                <img
                  src={getPhotoUrl(req.user_photo, req.user_name || req.user_id)}
                  alt={req.user_name}
                  className="w-12 h-12 rounded-xl object-cover border border-gray-600"
                  onError={handleImgError(req.user_name || 'user')}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{req.user_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                      req.user_role === 'recruiter' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {req.user_role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{req.user_email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requested {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {statusFilter === 'pending' && (
                    <>
                      {rejectingId === req.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="w-48 h-9 bg-gray-900 border-gray-600 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionLoading === req.id}
                            onClick={() => handleAction(req.id, 'reject', rejectReason)}
                          >
                            Reject
                          </Button>
                          <button onClick={() => setRejectingId(null)} className="text-gray-400 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={actionLoading === req.id}
                            onClick={() => handleAction(req.id, 'approve')}
                          >
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            disabled={actionLoading === req.id}
                            onClick={() => setRejectingId(req.id)}
                          >
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  {statusFilter === 'approved' && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                      approved
                    </span>
                  )}
                  {statusFilter === 'rejected' && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                      rejected
                    </span>
                  )}
                  {statusFilter === 'revoked' && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                      revoked
                    </span>
                  )}
                </div>

                <ExternalLink className="w-4 h-4 text-gray-500 shrink-0" />
              </div>
              {req.reason && (
                <p className="text-xs text-gray-500 mt-2 ml-16">Reason: {req.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-gray-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-gray-300" />
          </button>
          <span className="text-sm text-gray-400">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="p-2 rounded-lg bg-gray-800 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {userLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : selectedUser.user ? (
              <div>
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-800">
                  <div className="flex items-start gap-4">
                    <img
                      src={getPhotoUrl(selectedUser.user.photo_url, selectedUser.user.name || selectedUser.user.id)}
                      alt={selectedUser.user.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-700"
                      onError={handleImgError(selectedUser.user.name || 'user')}
                    />
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-white">{selectedUser.user.name}</h2>
                        {selectedUser.user.verified && (
                          <BadgeCheck className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                          selectedUser.user.role === 'recruiter' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {selectedUser.user.role}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          selectedUser.req.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          selectedUser.req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          selectedUser.req.status === 'revoked' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {selectedUser.req.status === 'pending' ? 'Pending Review' :
                           selectedUser.req.status === 'approved' ? 'Verified' :
                           selectedUser.req.status === 'revoked' ? 'Revoked' :
                           'Rejected'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-6 pt-4 space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact & Basic Info</h3>
                  <InfoRow icon={Mail} label="Email" value={selectedUser.user.email} />
                  <InfoRow icon={MapPin} label="Location" value={selectedUser.user.location} />
                  <InfoRow icon={Briefcase} label="Title" value={selectedUser.user.title} />
                  {selectedUser.user.role === 'recruiter' && (
                    <InfoRow icon={Building2} label="Company" value={selectedUser.user.company} />
                  )}
                  {selectedUser.user.role === 'seeker' && (
                    <>
                      <InfoRow icon={Building2} label="Current Employer" value={selectedUser.user.current_employer} />
                      <InfoRow icon={GraduationCap} label="Education" value={
                        [selectedUser.user.degree, selectedUser.user.school].filter(Boolean).join(' — ') || null
                      } />
                      <InfoRow icon={Star} label="Experience" value={
                        selectedUser.user.experience_years != null ? `${selectedUser.user.experience_years} years` : null
                      } />
                    </>
                  )}
                  <InfoRow icon={Calendar} label="Joined" value={
                    selectedUser.user.created_at ? new Date(selectedUser.user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null
                  } />

                  {/* Bio */}
                  {selectedUser.user.bio && (
                    <div className="pt-3 mt-2 border-t border-gray-800">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bio</h3>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedUser.user.bio}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {selectedUser.user.skills?.length > 0 && (
                    <div className="pt-3 mt-2 border-t border-gray-800">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedUser.user.skills.map((skill, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  {selectedUser.user.stats && (
                    <div className="pt-3 mt-2 border-t border-gray-800">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Activity Stats</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedUser.user.role === 'seeker' ? (
                          <>
                            <StatBox label="Applications" value={selectedUser.user.stats.applications} />
                            <StatBox label="Matches" value={selectedUser.user.stats.matches} />
                          </>
                        ) : (
                          <>
                            <StatBox label="Jobs Posted" value={selectedUser.user.stats.jobs_posted} />
                            <StatBox label="Matches" value={selectedUser.user.stats.matches} />
                          </>
                        )}
                        {selectedUser.user.stats.reports_against > 0 && (
                          <StatBox label="Reports Against" value={selectedUser.user.stats.reports_against} warn />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Verification Request Info */}
                  <div className="pt-3 mt-2 border-t border-gray-800">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verification Request</h3>
                    <InfoRow icon={Clock} label="Requested" value={
                      new Date(selectedUser.req.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    } />
                    {selectedUser.req.reviewed_by && (
                      <InfoRow icon={Shield} label="Reviewed by" value={selectedUser.req.reviewed_by} />
                    )}
                    {selectedUser.req.reason && (
                      <InfoRow icon={X} label="Reason" value={selectedUser.req.reason} />
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-6 pt-2 border-t border-gray-800">
                  {selectedUser.req.status === 'pending' && (
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        disabled={actionLoading === selectedUser.req.id}
                        onClick={() => handleAction(selectedUser.req.id, 'approve')}
                      >
                        <Check className="w-4 h-4 mr-2" /> Approve Verification
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        disabled={actionLoading === selectedUser.req.id}
                        onClick={() => setRejectingId(selectedUser.req.id)}
                      >
                        <X className="w-4 h-4 mr-2" /> Reject
                      </Button>
                    </div>
                  )}

                  {/* Reject reason input (inline in modal) */}
                  {rejectingId === selectedUser.req.id && selectedUser.req.status === 'pending' && (
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Rejection reason (optional)"
                        className="flex-1 h-10 bg-gray-800 border-gray-600"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading === selectedUser.req.id}
                        onClick={() => handleAction(selectedUser.req.id, 'reject', rejectReason)}
                      >
                        Confirm
                      </Button>
                      <button onClick={() => setRejectingId(null)} className="text-gray-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Revoke button for approved users */}
                  {(selectedUser.req.status === 'approved' || selectedUser.user.verified) && (
                    <>
                      {!revokeConfirm ? (
                        <Button
                          variant="outline"
                          className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          onClick={() => setRevokeConfirm(true)}
                        >
                          <ShieldOff className="w-4 h-4 mr-2" /> Remove Verification
                        </Button>
                      ) : (
                        <div className="space-y-3 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
                          <p className="text-sm text-orange-300">Are you sure you want to remove verification from this user?</p>
                          <Input
                            value={revokeReason}
                            onChange={e => setRevokeReason(e.target.value)}
                            placeholder="Reason for removing verification (optional)"
                            className="h-10 bg-gray-800 border-gray-600"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              className="flex-1"
                              disabled={revokeLoading}
                              onClick={() => handleRevoke(selectedUser.user.id)}
                            >
                              {revokeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldOff className="w-4 h-4 mr-2" />}
                              Confirm Revoke
                            </Button>
                            <Button
                              variant="outline"
                              className="border-gray-600"
                              onClick={() => { setRevokeConfirm(false); setRevokeReason(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, warn = false }) {
  return (
    <div className={`p-3 rounded-xl ${warn ? 'bg-red-500/10 border border-red-500/20' : 'bg-gray-800/50 border border-gray-700/50'}`}>
      <p className={`text-xl font-bold ${warn ? 'text-red-400' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
