import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Image, Video, ChevronLeft, ChevronRight, Trash2, CheckCircle, ShieldAlert,
  AlertTriangle, User, Eye, X
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminMedia() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', media_type: '', category: '' });
  const [preview, setPreview] = useState(null);
  const [removing, setRemoving] = useState(null); // media_id being removed
  const [removeReason, setRemoveReason] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (filters.status) params.append('status', filters.status);
      if (filters.media_type) params.append('media_type', filters.media_type);
      if (filters.category) params.append('category', filters.category);

      const [itemsRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/media?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/media/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setItems(itemsRes.data.items);
      setTotal(itemsRes.data.total);
      setPages(itemsRes.data.pages);
      setStats(statsRes.data);
    } catch (e) {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [token, page, filters]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRemove = async (mediaId, { silent = false } = {}) => {
    try {
      await axios.put(`${API}/admin/media/${mediaId}/remove`,
        { reason: removeReason || 'Removed by admin', silent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(silent ? 'Media removed silently' : 'Media removed and user notified');
      setRemoving(null);
      setRemoveReason('');
      fetchItems();
    } catch (e) {
      toast.error('Failed to remove media');
    }
  };

  const handleApprove = async (mediaId) => {
    try {
      await axios.put(`${API}/admin/media/${mediaId}/approve`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Media approved');
      fetchItems();
    } catch (e) {
      toast.error('Failed to approve media');
    }
  };

  const statusColor = (s) => {
    switch (s) {
      case 'flagged': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'removed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const categoryLabel = (c) => {
    switch (c) {
      case 'profile_photo': return 'Profile Photo';
      case 'video_intro': return 'Video Intro';
      case 'chat_image': return 'Chat Image';
      case 'chat_video': return 'Chat Video';
      default: return c;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getMediaSrc = (item) => {
    if (!item.url) return null;
    const url = item.url;
    // Already a full URL
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Relative path — prepend backend URL
    if (url.startsWith('/')) return `${process.env.REACT_APP_BACKEND_URL}${url}`;
    return url;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Media Management</h1>
        <p className="text-gray-400 mt-1">Browse and moderate all uploaded images and videos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total || 0, color: 'text-white' },
          { label: 'Images', value: stats.images || 0, color: 'text-blue-400' },
          { label: 'Videos', value: stats.videos || 0, color: 'text-purple-400' },
          { label: 'Flagged', value: stats.flagged || 0, color: 'text-red-400' },
          { label: 'Approved', value: stats.approved || 0, color: 'text-green-400' },
          { label: 'Removed', value: stats.removed || 0, color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {['', 'flagged', 'approved', 'removed'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setFilters(f => ({ ...f, status: s })); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                filters.status === s
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-400 hover:text-white bg-gray-800 border border-gray-700'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['', 'image', 'video'].map((t) => (
            <button
              key={t || 'all-type'}
              onClick={() => { setFilters(f => ({ ...f, media_type: t })); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize flex items-center gap-1 ${
                filters.media_type === t
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white bg-gray-800 border border-gray-700'
              }`}
            >
              {t === 'image' ? <Image className="w-3 h-3" /> : t === 'video' ? <Video className="w-3 h-3" /> : null}
              {t || 'All Types'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['', 'profile_photo', 'video_intro', 'chat_image', 'chat_video'].map((c) => (
            <button
              key={c || 'all-cat'}
              onClick={() => { setFilters(f => ({ ...f, category: c })); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filters.category === c
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white bg-gray-800 border border-gray-700'
              }`}
            >
              {c ? categoryLabel(c) : 'All Categories'}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <Image className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No media uploads found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <div key={item.id} className={`bg-gray-900 border rounded-xl overflow-hidden group relative ${
              item.status === 'flagged' ? 'border-red-500/50' : 'border-gray-800'
            }`}>
              {/* Thumbnail */}
              <div
                className="aspect-square bg-gray-800 relative cursor-pointer"
                onClick={() => setPreview(item)}
              >
                {item.media_type === 'image' ? (
                  <>
                    <img
                      src={getMediaSrc(item)}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        e.target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center text-gray-600">
                      <div className="text-center">
                        <Image className="w-8 h-8 mx-auto mb-1" />
                        <span className="text-xs">Not found</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-10 h-10 text-gray-600" />
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white" />
                </div>

                {/* Flag indicator */}
                {item.status === 'flagged' && (
                  <div className="absolute top-2 right-2">
                    <AlertTriangle className="w-5 h-5 text-red-400 drop-shadow" />
                  </div>
                )}
                {item.status === 'removed' && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-red-400 text-xs font-bold uppercase">Removed</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-[10px] ${statusColor(item.status)}`}>
                    {item.status}
                  </Badge>
                  <span className="text-[10px] text-gray-500">{categoryLabel(item.category)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <User className="w-3 h-3" />
                  <span className="truncate">{item.user_name || item.user_id}</span>
                </div>
                <div className="text-[10px] text-gray-600">
                  {formatSize(item.file_size)} · {new Date(item.created_at).toLocaleDateString()}
                </div>

                {/* Flag reasons */}
                {item.flag_reasons?.length > 0 && (
                  <div className="mt-2 text-[10px] text-red-400 space-y-0.5">
                    {item.flag_reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <ShieldAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {item.status !== 'removed' && (
                  <div className="flex gap-2 mt-2">
                    {item.status === 'flagged' && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" /> OK
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => { setRemoving(item.id); setRemoveReason(''); }}
                      className="flex-1 h-7 text-xs bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-400">Page {page} of {pages} ({total} items)</p>
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

      {/* Remove Confirmation Modal */}
      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setRemoving(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Remove Media</h3>
            <p className="text-gray-400 text-sm mb-4">
              Choose how to remove this media item.
            </p>
            <input
              type="text"
              placeholder="Reason (e.g., Inappropriate content)"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm mb-4 focus:outline-none focus:border-red-500"
            />
            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setRemoving(null)} className="flex-1 border-gray-700 text-gray-300">
                  Cancel
                </Button>
                <Button onClick={() => handleRemove(removing)} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 className="w-4 h-4 mr-1" /> Remove & Notify
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => handleRemove(removing, { silent: true })}
                className="w-full border-gray-700 text-gray-400 hover:text-white"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove Silently (no notification or strike)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white" onClick={() => setPreview(null)}>
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
            {preview.media_type === 'image' ? (
              <img
                src={getMediaSrc(preview)}
                alt={preview.filename}
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            ) : (
              <video
                src={getMediaSrc(preview)}
                controls
                className="max-w-full max-h-[80vh] rounded-xl"
              />
            )}
            <div className="mt-3 text-center">
              <p className="text-gray-300 text-sm">
                {preview.user_name} · {categoryLabel(preview.category)} · {formatSize(preview.file_size)}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Uploaded {new Date(preview.created_at).toLocaleString()}
              </p>
              {preview.flag_reasons?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 justify-center">
                  {preview.flag_reasons.map((r, i) => (
                    <Badge key={i} variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
