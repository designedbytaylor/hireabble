import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

              {r.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => setActionDialog(r)}
                  className="bg-red-600 hover:bg-red-700 text-white ml-4"
                >
                  Take Action
                </Button>
              )}
            </div>
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
