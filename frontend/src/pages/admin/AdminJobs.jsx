import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Briefcase, Plus, X, Trash2, MapPin, Globe } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminJobs() {
  const { token } = useAdminAuth();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPostJob, setShowPostJob] = useState(false);
  const [posting, setPosting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    description: '',
    requirements: '',
    salary_min: '',
    salary_max: '',
    location: '',
    job_type: 'remote',
    experience_level: 'mid',
    location_restriction: 'any',
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      const res = await axios.get(`${API}/admin/jobs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(res.data.jobs);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (e) {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [token, page, search]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const toggleJob = async (jobId, isActive) => {
    try {
      await axios.put(`${API}/admin/jobs/${jobId}/status`, { is_active: !isActive }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Job ${!isActive ? 'activated' : 'deactivated'}`);
      fetchJobs();
    } catch (e) {
      toast.error('Failed to update job');
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await axios.delete(`${API}/admin/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Job deleted');
      fetchJobs();
    } catch (e) {
      toast.error('Failed to delete job');
    }
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.company || !formData.description || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    setPosting(true);
    try {
      const payload = {
        ...formData,
        requirements: formData.requirements.split(',').map(r => r.trim()).filter(Boolean),
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        location_restriction: formData.location_restriction || 'any',
      };

      await axios.post(`${API}/admin/jobs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Job posted successfully!');
      setShowPostJob(false);
      setFormData({
        title: '', company: '', description: '', requirements: '',
        salary_min: '', salary_max: '', location: '',
        job_type: 'remote', experience_level: 'mid', location_restriction: 'any',
      });
      fetchJobs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to post job');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Listings</h1>
          <p className="text-gray-400 mt-1">{total} total jobs</p>
        </div>
        <Button
          onClick={() => setShowPostJob(!showPostJob)}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          {showPostJob ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showPostJob ? 'Cancel' : 'Post Job'}
        </Button>
      </div>

      {/* Post Job Form */}
      {showPostJob && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Post a New Job</h2>
          <form onSubmit={handlePostJob} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Job Title *</Label>
                <Input
                  placeholder="e.g., Senior Software Engineer"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Company Name *</Label>
                <Input
                  placeholder="e.g., Acme Inc."
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Description *</Label>
              <Textarea
                placeholder="Describe the role, responsibilities..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Requirements (comma-separated)</Label>
              <Input
                placeholder="e.g., React, Node.js, 3+ years"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Min Salary ($)</Label>
                <Input
                  type="number"
                  placeholder="80000"
                  value={formData.salary_min}
                  onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Max Salary ($)</Label>
                <Input
                  type="number"
                  placeholder="150000"
                  value={formData.salary_max}
                  onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Location *</Label>
                <Input
                  placeholder="e.g., San Francisco, CA or Remote"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Job Type</Label>
                <Select value={formData.job_type} onValueChange={(v) => setFormData({ ...formData, job_type: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Experience Level</Label>
                <Select value={formData.experience_level} onValueChange={(v) => setFormData({ ...formData, experience_level: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="mid">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead / Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Applicant Location Restriction</Label>
                <Select value={formData.location_restriction} onValueChange={(v) => setFormData({ ...formData, location_restriction: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">
                      <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Any location</span>
                    </SelectItem>
                    <SelectItem value="specific">
                      <span className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Must be in job location</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {formData.location_restriction === 'specific'
                    ? 'Only applicants near this job\'s location will see it'
                    : 'Applicants from anywhere can see this job'}
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={posting}
              className="bg-red-500 hover:bg-red-600 text-white w-full"
            >
              {posting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Post Job'
              )}
            </Button>
          </form>
        </div>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Job</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Company</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Type</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Location</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Status</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Posted</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">No jobs found</td></tr>
            ) : jobs.map((j) => (
              <tr key={j.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-gray-500" />
                    <p className="text-sm font-medium text-white">{j.title}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{j.company}</td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">{j.job_type}</Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-sm text-gray-300">
                    <MapPin className="w-3 h-3 text-gray-500" />
                    {j.location}
                    {j.location_restriction === 'specific' && (
                      <Badge variant="outline" className="ml-1 text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Restricted</Badge>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      j.is_active
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }>
                      {j.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {j.is_flagged && (
                      <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">Flagged</Badge>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(j.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleJob(j.id, j.is_active)}
                      className={j.is_active ? 'text-green-400' : 'text-gray-400'}
                    >
                      {j.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteJob(j.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
    </div>
  );
}
