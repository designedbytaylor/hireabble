import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Job Listings</h1>
        <p className="text-gray-400 mt-1">{total} total jobs</p>
      </div>

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
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Status</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-4">Posted</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">No jobs found</td></tr>
            ) : jobs.map((j) => (
              <tr key={j.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-white">{j.title}</p>
                      <p className="text-xs text-gray-500">{j.location}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{j.company}</td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="capitalize border-gray-600 text-gray-300">{j.job_type}</Badge>
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
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleJob(j.id, j.is_active)}
                      className={j.is_active ? 'text-green-400' : 'text-gray-400'}
                    >
                      {j.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
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
