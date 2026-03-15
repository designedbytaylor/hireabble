import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Flag, ChevronLeft, ChevronRight, MessageSquare, Eye, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function ConversationViewer({ context, reportedMessageId }) {
  if (context.error) {
    return <p className="text-gray-500 text-sm italic">{context.error}</p>;
  }

  if (context.reported_type === 'message' && context.conversation) {
    return (
      <div className="mt-4 bg-gray-950 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Conversation Context</span>
          {context.sender && context.receiver && (
            <span className="text-xs text-gray-500 ml-2">
              {context.sender.name} &harr; {context.receiver.name}
            </span>
          )}
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {context.conversation.map((msg, i) => {
            const isReported = msg.id === reportedMessageId;
            return (
              <div
                key={msg.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isReported
                    ? 'bg-red-500/20 border border-red-500/40 ring-1 ring-red-500/30'
                    : 'bg-gray-800/50 border border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium text-xs ${isReported ? 'text-red-400' : 'text-gray-400'}`}>
                    {msg.sender_name || msg.sender_id}
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                  {isReported && (
                    <Badge className="bg-red-500/30 text-red-300 border-red-500/40 text-[10px] px-1.5 py-0">
                      REPORTED
                    </Badge>
                  )}
                </div>
                <p className={`${isReported ? 'text-white' : 'text-gray-300'}`}>
                  {msg.content}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (context.reported_type === 'user' && context.reported_user) {
    const u = context.reported_user;
    return (
      <div className="mt-4 bg-gray-950 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Reported User</span>
        </div>
        <div className="flex items-center gap-3">
          {u.photo_url && (
            <img src={u.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          )}
          <div>
            <p className="text-white font-medium">{u.name}</p>
            {u.title && <p className="text-gray-400 text-sm">{u.title}</p>}
            {u.email && <p className="text-gray-500 text-xs">{u.email}</p>}
          </div>
          <div className="ml-auto flex gap-2">
            {u.status && u.status !== 'active' && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 capitalize">{u.status}</Badge>
            )}
            {u.strikes > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{u.strikes} strike{u.strikes !== 1 ? 's' : ''}</Badge>
            )}
          </div>
        </div>
        {u.bio && <p className="text-gray-400 text-sm mt-3">{u.bio}</p>}
      </div>
    );
  }

  if (context.reported_type === 'job' && context.reported_job) {
    const j = context.reported_job;
    return (
      <div className="mt-4 bg-gray-950 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Reported Job</span>
        </div>
        <p className="text-white font-medium">{j.title}</p>
        {j.company && <p className="text-gray-400 text-sm">{j.company}</p>}
        {j.description && <p className="text-gray-500 text-sm mt-2 line-clamp-4">{j.description}</p>}
        {!j.is_active && (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 mt-2">Inactive</Badge>
        )}
      </div>
    );
  }

  return <p className="text-gray-500 text-sm italic mt-2">No additional context available.</p>;
}

export default function AdminReports() {
  const { token } = useAdminAuth();
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);
  const [contextData, setContextData] = useState({});
  const [loadingContext, setLoadingContext] = useState({});

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('reported_type', typeFilter);
      const res = await axios.get(`${API}/admin/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(res.data.reports);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (e) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, typeFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const fetchContext = async (reportId) => {
    if (contextData[reportId]) {
      setExpandedReport(expandedReport === reportId ? null : reportId);
      return;
    }
    setLoadingContext(prev => ({ ...prev, [reportId]: true }));
    try {
      const res = await axios.get(`${API}/admin/reports/${reportId}/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContextData(prev => ({ ...prev, [reportId]: res.data }));
      setExpandedReport(reportId);
    } catch (e) {
      toast.error('Failed to load context');
    } finally {
      setLoadingContext(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const handleResolve = async (reportId, action) => {
    try {
      await axios.put(`${API}/admin/reports/${reportId}`, { action }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Report resolved: ${action}`);
      setActionDialog(null);
      fetchReports();
    } catch (e) {
      toast.error('Failed to resolve report');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Reports</h1>
        <p className="text-gray-400 mt-1">{total} reports</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {['pending', 'resolved'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                statusFilter === s
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-400 hover:text-white bg-gray-800 border border-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="user">User</option>
          <option value="job">Job</option>
          <option value="message">Message</option>
        </select>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
            <Flag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No reports found</p>
          </div>
        ) : reports.map((r) => (
          <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">
                    {r.reported_type}
                  </Badge>
                  <Badge variant="outline" className={
                    r.status === 'pending'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                  }>
                    {r.status}
                  </Badge>
                  {r.resolution && (
                    <Badge variant="outline" className="border-gray-600 text-gray-300 capitalize">
                      {r.resolution}
                    </Badge>
                  )}
                </div>

                <p className="text-white font-medium mb-1">{r.reason}</p>
                {r.details && <p className="text-gray-400 text-sm mb-3">{r.details}</p>}

                <div className="flex gap-6 text-sm text-gray-500">
                  <span>Reported by: <span className="text-gray-300">{r.reporter_name}</span></span>
                  <span>ID: <span className="text-gray-300 font-mono">{r.reported_id}</span></span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchContext(r.id)}
                  disabled={loadingContext[r.id]}
                  className="border-gray-700 text-gray-300 hover:text-white"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {loadingContext[r.id] ? 'Loading...' : expandedReport === r.id ? 'Hide' : 'View'}
                </Button>
                {r.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => setActionDialog(r)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Take Action
                  </Button>
                )}
              </div>
            </div>

            {expandedReport === r.id && contextData[r.id] && (
              <ConversationViewer context={contextData[r.id]} reportedMessageId={r.reported_id} />
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
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

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Take Action on Report</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm mb-4">
            Report: <span className="text-white">{actionDialog?.reason}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => handleResolve(actionDialog.id, 'dismiss')} className="border-gray-600 text-gray-300 hover:bg-gray-800">
              Dismiss
            </Button>
            <Button onClick={() => handleResolve(actionDialog.id, 'warn')} className="bg-amber-600 hover:bg-amber-700">
              Warn User
            </Button>
            <Button onClick={() => handleResolve(actionDialog.id, 'suspend')} className="bg-orange-600 hover:bg-orange-700">
              Suspend User
            </Button>
            <Button onClick={() => handleResolve(actionDialog.id, 'ban')} className="bg-red-600 hover:bg-red-700">
              Ban User
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionDialog(null)} className="text-gray-400">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
