import { useState, useEffect, useCallback } from 'react';
import { BadgeCheck, Check, X, ChevronLeft, ChevronRight, User } from 'lucide-react';
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
    } catch (e) {
      toast.error(e.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
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
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected'].map(s => (
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
            <div key={req.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
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

                {statusFilter === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
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
                  </div>
                )}

                {statusFilter !== 'pending' && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {req.status}
                  </span>
                )}
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
    </div>
  );
}
