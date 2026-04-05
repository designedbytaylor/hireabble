import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function useBlogApi() {
  const { token } = useAdminAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Dashboard state
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, failed: 0, running_jobs: 0 });
  const [jobs, setJobs] = useState([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);

  // Posts state
  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Editor state
  const [editingPost, setEditingPost] = useState(null);

  // Generation state
  const [generating, setGenerating] = useState(false);

  const pollRef = useRef(null);

  // ─── FETCH FUNCTIONS ──────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/blog/stats`, { headers });
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, [headers]);

  const fetchJobs = useCallback(async (page) => {
    try {
      const p = page || jobsPage;
      const { data } = await axios.get(`${API}/admin/blog/jobs`, { headers, params: { page: p, limit: 10 } });
      setJobs(data.jobs || []);
      setJobsTotalPages(data.pages || 1);
      return data.jobs || [];
    } catch (err) {
      console.error('Failed to fetch jobs', err);
      return [];
    }
  }, [headers, jobsPage]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: 20 };
      if (searchQuery) params.q = searchQuery;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const { data } = await axios.get(`${API}/admin/blog/posts`, { headers, params });
      setPosts(data.posts || []);
      setTotalPosts(data.total || 0);
      setTotalPages(data.pages || 1);
    } catch (err) {
      toast.error('Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, [headers, currentPage, searchQuery, statusFilter, typeFilter]);

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  const handleGenerate = async ({ pageType, cities, roles, extras }) => {
    if (cities.length === 0) return;
    setGenerating(true);
    try {
      await axios.post(`${API}/admin/blog/generate`, {
        page_type: pageType,
        cities,
        roles,
        extras: extras || {},
      }, { headers });
      toast.success('Generation started successfully');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start generation');
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const cancelJob = async (jobId) => {
    try {
      await axios.post(`${API}/admin/blog/jobs/${jobId}/cancel`, {}, { headers });
      toast.success('Job cancelled');
      fetchJobs();
      fetchStats();
    } catch (err) {
      toast.error('Failed to cancel job');
    }
  };

  const pauseJob = async (jobId) => {
    try {
      const { data } = await axios.post(`${API}/admin/blog/jobs/${jobId}/pause`, {}, { headers });
      toast.success(data.status === 'paused' ? 'Job paused' : 'Job resumed');
      fetchJobs();
    } catch (err) {
      toast.error('Failed to pause/resume job');
    }
  };

  const undoJob = async (jobId) => {
    if (!window.confirm('This will delete ALL posts from this job. Are you sure?')) return;
    try {
      const res = await axios.post(`${API}/admin/blog/jobs/${jobId}/undo`, {}, { headers });
      toast.success(`Deleted ${res.data.deleted_posts} posts and removed job`);
      fetchJobs();
      fetchStats();
    } catch (err) {
      toast.error('Failed to undo job');
    }
  };

  const publishPost = async (postId) => {
    try {
      await axios.post(`${API}/admin/blog/posts/${postId}/publish`, {}, { headers });
      toast.success('Post published');
      fetchPosts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to publish post');
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/admin/blog/posts/${postId}`, { headers });
      toast.success('Post deleted');
      fetchPosts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete post');
    }
  };

  const bulkPublish = async (postIds) => {
    if (postIds.length === 0) return;
    try {
      await axios.post(`${API}/admin/blog/bulk-publish`, { post_ids: postIds }, { headers });
      toast.success(`${postIds.length} posts published`);
      fetchPosts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to bulk publish');
    }
  };

  const bulkDelete = async (postIds) => {
    if (postIds.length === 0) return;
    if (!window.confirm(`Delete ${postIds.length} posts?`)) return;
    try {
      await Promise.all(postIds.map(id =>
        axios.delete(`${API}/admin/blog/posts/${id}`, { headers })
      ));
      toast.success(`${postIds.length} posts deleted`);
      fetchPosts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete some posts');
    }
  };

  const openEditor = async (postId) => {
    try {
      const { data } = await axios.get(`${API}/admin/blog/posts/${postId}`, { headers });
      setEditingPost(data);
    } catch (err) {
      toast.error('Failed to load post');
    }
  };

  const savePost = async (publish = false) => {
    if (!editingPost) return;
    try {
      await axios.put(`${API}/admin/blog/posts/${editingPost.id}`, {
        title: editingPost.title,
        slug: editingPost.slug,
        meta_title: editingPost.meta_title,
        meta_description: editingPost.meta_description,
        content: editingPost.content,
      }, { headers });
      if (publish) {
        await axios.post(`${API}/admin/blog/posts/${editingPost.id}/publish`, {}, { headers });
      }
      toast.success(publish ? 'Post saved and published' : 'Post saved');
      setEditingPost(null);
      fetchPosts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to save post');
    }
  };

  // ─── POLLING ──────────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    const hasActive = jobs.some(j => j.status === 'running' || j.status === 'paused');
    if (!hasActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const updated = await fetchJobs();
      fetchStats();
      if (!updated.some(j => j.status === 'running' || j.status === 'paused')) {
        clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs, fetchJobs, fetchStats]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, typeFilter]);

  return {
    // Dashboard
    stats, jobs, jobsPage, jobsTotalPages, setJobsPage,
    fetchStats, fetchJobs, cancelJob, pauseJob, undoJob, startPolling,
    // Generate
    generating, handleGenerate,
    // Posts
    posts, totalPosts, currentPage, totalPages, loading,
    searchQuery, statusFilter, typeFilter,
    setCurrentPage, setSearchQuery, setStatusFilter, setTypeFilter,
    fetchPosts, publishPost, deletePost, bulkPublish, bulkDelete, openEditor,
    // Editor
    editingPost, setEditingPost, savePost,
  };
}
