import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CheckCircle, XCircle, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminModeration() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      const res = await axios.get(`${API}/admin/moderation?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (e) {
      toast.error('Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAction = async (itemId, action) => {
    try {
      await axios.put(`${API}/admin/moderation/${itemId}`, { action }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Item ${action}d`);
      fetchItems();
    } catch (e) {
      toast.error('Action failed');
    }
  };

  const severityColor = (s) => {
    if (s === 'critical') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Moderation Queue</h1>
        <p className="text-gray-400 mt-1">{total} items</p>
      </div>

      <div className="flex gap-3 mb-6">
        {['pending', 'approved', 'rejected'].map((s) => (
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

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
            <ShieldAlert className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No items in queue</p>
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">
                    {item.content_type}
                  </Badge>
                  <Badge variant="outline" className={
                    item.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                    item.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    'bg-red-500/20 text-red-400 border-red-500/30'
                  }>
                    {item.status}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-sm text-gray-400 mb-1">
                  Content ID: <span className="text-gray-300 font-mono">{item.content_id}</span>
                </p>
                <p className="text-sm text-gray-400 mb-3">
                  User ID: <span className="text-gray-300 font-mono">{item.user_id}</span>
                </p>

                {/* Media preview for image moderation items */}
                {item.content_type === 'media' && item.metadata?.media_url && (
                  <div className="mb-3 max-w-xs">
                    <img
                      src={item.metadata.media_url.startsWith('/uploads/')
                        ? `${process.env.REACT_APP_BACKEND_URL}${item.metadata.media_url}`
                        : item.metadata.media_url}
                      alt="Flagged media"
                      className="rounded-xl border border-gray-700 max-h-48 object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <p className="text-xs text-gray-500 mt-1">{item.metadata.media_category} · {item.metadata.filename}</p>
                  </div>
                )}

                {item.violations && item.violations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-300">Violations:</p>
                    <div className="flex flex-wrap gap-2">
                      {item.violations.map((v, i) => (
                        <Badge key={i} variant="outline" className={severityColor(v.severity)}>
                          [{v.category}] {v.word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    onClick={() => handleAction(item.id, 'approve')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(item.id, 'reject')}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
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
    </div>
  );
}
