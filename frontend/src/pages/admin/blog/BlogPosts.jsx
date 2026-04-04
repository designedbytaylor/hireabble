import { useState } from 'react';
import {
  Search, Edit3, Globe, Trash2, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PAGE_TYPES, PAGE_TYPE_MAP } from './blogConstants';
import { StatusBadge } from './BlogDashboard';

export default function BlogPosts({
  posts, totalPosts, currentPage, totalPages, loading,
  searchQuery, statusFilter, typeFilter,
  setCurrentPage, setSearchQuery, setStatusFilter, setTypeFilter,
  onEdit, onPublish, onDelete, onBulkPublish, onBulkDelete,
}) {
  const [selectedPosts, setSelectedPosts] = useState(new Set());

  const togglePostSelection = (postId) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const toggleAllPosts = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)));
    }
  };

  const handleBulkPublish = () => {
    onBulkPublish([...selectedPosts]);
    setSelectedPosts(new Set());
  };

  const handleBulkDelete = () => {
    onBulkDelete([...selectedPosts]);
    setSelectedPosts(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">All Types</option>
          {PAGE_TYPES.map(pt => (
            <option key={pt.value} value={pt.value}>{pt.label}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selectedPosts.size > 0 && (
        <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-indigo-300">{selectedPosts.size} post{selectedPosts.size !== 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button onClick={handleBulkPublish} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
              Publish Selected
            </button>
            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">No posts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedPosts.size === posts.length && posts.length > 0}
                      onChange={toggleAllPosts}
                      className="rounded border-gray-600 bg-gray-700"
                    />
                  </th>
                  <th className="p-3">Title</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Words</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(post.id)}
                        onChange={() => togglePostSelection(post.id)}
                        className="rounded border-gray-600 bg-gray-700"
                      />
                    </td>
                    <td className="p-3 text-white font-medium max-w-[250px] truncate">{post.title}</td>
                    <td className="p-3 text-gray-400">{post.city}</td>
                    <td className="p-3 text-gray-400">{post.role}</td>
                    <td className="p-3 text-gray-400">{PAGE_TYPE_MAP[post.page_type] || post.page_type}</td>
                    <td className="p-3"><StatusBadge status={post.status} /></td>
                    <td className="p-3 text-gray-400">{post.word_count || '-'}</td>
                    <td className="p-3 text-gray-500">{post.created_at ? new Date(post.created_at).toLocaleDateString() : '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(post.id)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {post.status !== 'published' && (
                          <button
                            onClick={() => onPublish(post.id)}
                            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-green-400"
                            title="Publish"
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(post.id)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{totalPosts} total posts</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 p-2 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 p-2 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
