import { useState, useEffect } from 'react';
import { BarChart3, Play, FileText, Loader2 } from 'lucide-react';
import useBlogApi from './blog/useBlogApi';
import BlogDashboard from './blog/BlogDashboard';
import BlogGenerate from './blog/BlogGenerate';
import BlogPosts from './blog/BlogPosts';
import BlogPostEditor from './blog/BlogPostEditor';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'generate', label: 'Generate', icon: Play },
  { key: 'posts', label: 'Posts', icon: FileText },
];

export default function AdminBlog() {
  const [tab, setTab] = useState('dashboard');
  const api = useBlogApi();

  const { fetchStats, fetchJobs, fetchPosts, startPolling, jobsPage } = api;

  // Fetch data when tab changes
  useEffect(() => {
    if (tab === 'dashboard') {
      fetchStats();
      fetchJobs();
    } else if (tab === 'posts') {
      fetchPosts();
    }
  }, [tab, fetchStats, fetchJobs, fetchPosts, jobsPage]);

  // Polling for running jobs on dashboard tab
  useEffect(() => {
    if (tab !== 'dashboard') return;
    return startPolling();
  }, [tab, startPolling]);

  const handleGenerate = async (params) => {
    const success = await api.handleGenerate(params);
    if (success) setTab('dashboard');
    return success;
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Blog / SEO Manager</h1>
            <p className="text-gray-500 text-sm mt-1">Generate and manage SEO blog posts with AI</p>
          </div>
          {api.stats.running_jobs > 0 && (
            <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/30 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-indigo-300">{api.stats.running_jobs} job{api.stats.running_jobs !== 1 ? 's' : ''} running</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'dashboard' && (
          <BlogDashboard
            stats={api.stats}
            jobs={api.jobs}
            cancelJob={api.cancelJob}
            pauseJob={api.pauseJob}
            undoJob={api.undoJob}
            jobsPage={api.jobsPage}
            jobsTotalPages={api.jobsTotalPages}
            setJobsPage={api.setJobsPage}
          />
        )}
        {tab === 'generate' && (
          <BlogGenerate onGenerate={handleGenerate} generating={api.generating} />
        )}
        {tab === 'posts' && (
          <BlogPosts
            posts={api.posts}
            totalPosts={api.totalPosts}
            currentPage={api.currentPage}
            totalPages={api.totalPages}
            loading={api.loading}
            searchQuery={api.searchQuery}
            statusFilter={api.statusFilter}
            typeFilter={api.typeFilter}
            setCurrentPage={api.setCurrentPage}
            setSearchQuery={api.setSearchQuery}
            setStatusFilter={api.setStatusFilter}
            setTypeFilter={api.setTypeFilter}
            onEdit={api.openEditor}
            onPublish={api.publishPost}
            onDelete={api.deletePost}
            onBulkPublish={api.bulkPublish}
            onBulkDelete={api.bulkDelete}
          />
        )}
      </div>

      {/* Editor Modal */}
      <BlogPostEditor
        post={api.editingPost}
        onChange={api.setEditingPost}
        onSave={api.savePost}
        onClose={() => api.setEditingPost(null)}
      />
    </div>
  );
}
