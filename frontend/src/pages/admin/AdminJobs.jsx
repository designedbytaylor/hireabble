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
import {
  Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
  Briefcase, Plus, X, Trash2, MapPin, Globe, ArrowLeft, Eye,
  User, Calendar, DollarSign, AlertTriangle, Clock,
} from 'lucide-react';
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

  // Job detail view
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);

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

  const viewJobDetail = async (jobId) => {
    setSelectedJob(jobId);
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/admin/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobDetail(res.data);
    } catch (e) {
      toast.error('Failed to load job details');
      setSelectedJob(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const removeJob = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await axios.delete(`${API}/admin/jobs/${removeTarget}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { reason: removeReason || 'Community guideline violation' },
      });
      if (res.data.banned) {
        toast.success('Job removed. Poster has been BANNED (3 strikes).');
      } else {
        toast.success(`Job removed. Poster notified (${res.data.strikes}/3 strikes).`);
      }
      setRemoveTarget(null);
      setRemoveReason('');
      setSelectedJob(null);
      setJobDetail(null);
      fetchJobs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove job');
    } finally {
      setRemoving(false);
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

  // ==================== JOB DETAIL VIEW ====================
  if (selectedJob) {
    return (
      <div>
        <button
          onClick={() => { setSelectedJob(null); setJobDetail(null); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>

        {loadingDetail ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobDetail ? (
          <div className="space-y-6">
            {/* Job Header */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">{jobDetail.job.title}</h1>
                  <p className="text-gray-400 mt-1">{jobDetail.job.company}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">
                      {jobDetail.job.job_type}
                    </Badge>
                    <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">
                      {jobDetail.job.experience_level}
                    </Badge>
                    <Badge variant="outline" className={
                      jobDetail.job.is_active
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }>
                      {jobDetail.job.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {jobDetail.job.is_flagged && (
                      <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">Flagged</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleJob(jobDetail.job.id, jobDetail.job.is_active)}
                    className="border-gray-700 text-gray-300"
                  >
                    {jobDetail.job.is_active ? <ToggleRight className="w-4 h-4 mr-2 text-green-400" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
                    {jobDetail.job.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setRemoveTarget(jobDetail.job.id)}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remove for Violation
                  </Button>
                </div>
              </div>
            </div>

            {/* Job Details Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-gray-500" /> Job Details
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{jobDetail.job.location}</span>
                    {jobDetail.job.location_restriction === 'specific' && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Location Restricted</Badge>
                    )}
                  </div>

                  {(jobDetail.job.salary_min || jobDetail.job.salary_max) && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300">
                        {jobDetail.job.salary_min && `$${jobDetail.job.salary_min.toLocaleString()}`}
                        {jobDetail.job.salary_min && jobDetail.job.salary_max && ' - '}
                        {jobDetail.job.salary_max && `$${jobDetail.job.salary_max.toLocaleString()}`}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">Posted {new Date(jobDetail.job.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{jobDetail.application_count} application(s)</span>
                  </div>
                </div>

                {/* Requirements */}
                {jobDetail.job.requirements?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Requirements</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {jobDetail.job.requirements.map((req, i) => (
                        <Badge key={i} variant="outline" className="border-gray-700 text-gray-300 text-xs">
                          {req}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Poster Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" /> Posted By
                </h2>
                {jobDetail.poster ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
                        {jobDetail.poster.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{jobDetail.poster.name}</p>
                        <p className="text-gray-400 text-sm">{jobDetail.poster.email}</p>
                      </div>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="text-gray-400">Role: <span className="text-gray-300 capitalize">{jobDetail.poster.role}</span></p>
                      <p className="text-gray-400">Status: <span className={`capitalize ${
                        jobDetail.poster.status === 'banned' ? 'text-red-400' :
                        jobDetail.poster.status === 'suspended' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>{jobDetail.poster.status || 'active'}</span></p>
                      {jobDetail.poster.strikes > 0 && (
                        <p className="text-gray-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-yellow-500" />
                          Strikes: <span className="text-yellow-400">{jobDetail.poster.strikes}/3</span>
                        </p>
                      )}
                      {jobDetail.poster.company && (
                        <p className="text-gray-400">Company: <span className="text-gray-300">{jobDetail.poster.company}</span></p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Platform-posted job (no recruiter)</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-3">Description</h2>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {jobDetail.job.description}
              </p>
            </div>
          </div>
        ) : null}

        {/* Remove Confirmation Dialog */}
        {removeTarget && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Remove Job Post</h3>
                  <p className="text-gray-400 text-sm">This will issue a strike to the poster</p>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4">
                The poster will be notified that their job was removed for a community guideline violation.
                At 3 strikes, the user will be automatically banned.
              </p>

              <div className="space-y-2 mb-6">
                <Label className="text-gray-300">Reason (optional)</Label>
                <Textarea
                  placeholder="e.g., Misleading job description, discriminatory requirements..."
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[80px] resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300"
                  onClick={() => { setRemoveTarget(null); setRemoveReason(''); }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  disabled={removing}
                  onClick={removeJob}
                >
                  {removing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Remove & Issue Strike'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== JOBS LIST VIEW ====================
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
              <tr
                key={j.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                onClick={() => viewJobDetail(j.id)}
              >
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
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => viewJobDetail(j.id)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
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
                      onClick={() => setRemoveTarget(j.id)}
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

      {/* Remove Confirmation Dialog (from list view) */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Remove Job Post</h3>
                <p className="text-gray-400 text-sm">This will issue a strike to the poster</p>
              </div>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              The poster will be notified that their job was removed for a community guideline violation.
              At 3 strikes, the user will be automatically banned.
            </p>

            <div className="space-y-2 mb-6">
              <Label className="text-gray-300">Reason (optional)</Label>
              <Textarea
                placeholder="e.g., Misleading job description, discriminatory requirements..."
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-[80px] resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-700 text-gray-300"
                onClick={() => { setRemoveTarget(null); setRemoveReason(''); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                disabled={removing}
                onClick={removeJob}
              >
                {removing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Remove & Issue Strike'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
