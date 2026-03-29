import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, DollarSign, Briefcase, Filter, X, ChevronDown,
  CheckCircle, Bookmark, Zap, Building2, ArrowRight, Loader2, Clock,
  Sparkles, GraduationCap, List
} from 'lucide-react';

const MapView = React.lazy(() => import('../components/MapView'));
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Sync applied job IDs to the swipe page's localStorage cache so
// jobs applied via search are filtered out of the swipe deck.
function addToSwipedIds(jobId) {
  try {
    const cached = localStorage.getItem('cached_user');
    const userId = cached ? JSON.parse(cached).id : null;
    const key = userId ? `hireabble_swiped_ids_${userId}` : 'hireabble_swiped_ids';
    const raw = localStorage.getItem(key);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(jobId)) {
      ids.push(jobId);
      localStorage.setItem(key, JSON.stringify(ids));
    }
  } catch { /* ignore */ }
}

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max)}`;
}

const WORK_TYPES = [
  { key: 'remote', label: 'Remote' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'onsite', label: 'On-site' },
];

const EXPERIENCE_LEVELS = [
  { key: 'entry', label: 'Entry Level' },
  { key: 'mid', label: 'Mid Level' },
  { key: 'senior', label: 'Senior' },
  { key: 'lead', label: 'Lead / Manager' },
];

const EMPLOYMENT_TYPES = [
  { key: 'full-time', label: 'Full-time' },
  { key: 'part-time', label: 'Part-time' },
  { key: 'contract', label: 'Contract' },
];

const SALARY_RANGES = [
  { key: '50000', label: '$50k+' },
  { key: '80000', label: '$80k+' },
  { key: '100000', label: '$100k+' },
  { key: '120000', label: '$120k+' },
  { key: '150000', label: '$150k+' },
  { key: '200000', label: '$200k+' },
];

export default function SeekerSearch() {
  useDocumentTitle('Search Jobs');
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState(''); // '', 'distance', 'newest'
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'

  const [results, setResults] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const activeFilterCount = [jobType, experienceLevel, employmentType, salaryMin, location].filter(Boolean).length;

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.append('search', keyword.trim());
      if (location.trim()) params.append('location', location.trim());
      if (jobType) params.append('job_type', jobType);
      if (experienceLevel) params.append('experience_level', experienceLevel);
      if (employmentType) params.append('employment_type', employmentType);
      if (salaryMin) params.append('salary_min', salaryMin);
      if (sortBy) params.append('sort', sortBy);
      params.append('include_swiped', 'true'); // Show all matching jobs in search
      params.append('limit', '50');

      const res = await axios.get(`${API}/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Map backend's already_applied flag to _applied for UI state
      setResults(res.data.map(j => j.already_applied ? { ...j, _applied: true } : j));
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [keyword, location, jobType, experienceLevel, employmentType, salaryMin, sortBy, token]);

  const clearFilters = () => {
    setJobType('');
    setExperienceLevel('');
    setEmploymentType('');
    setSalaryMin('');
    setLocation('');
  };

  // Re-search when sort changes (only if results already loaded)
  const sortRef = useRef(sortBy);
  useEffect(() => {
    if (sortRef.current !== sortBy && hasSearched) {
      sortRef.current = sortBy;
      handleSearch();
    }
  }, [sortBy, hasSearched, handleSearch]);

  const handleSwipeResults = () => {
    // Navigate to dashboard with search filters applied
    const params = new URLSearchParams();
    if (keyword.trim()) params.append('keyword', keyword.trim());
    if (location.trim()) params.append('location', location.trim());
    if (jobType) params.append('job_type', jobType);
    if (experienceLevel) params.append('experience_level', experienceLevel);
    if (employmentType) params.append('employment_type', employmentType);
    if (salaryMin) params.append('salary_min', salaryMin);
    navigate(`/dashboard?${params.toString()}`);
  };

  const handleApply = async (jobId) => {
    try {
      await axios.post(`${API}/swipe`, { job_id: jobId, action: 'like' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResults(prev => prev?.map(j => j.id === jobId ? { ...j, _applied: true } : j));
      addToSwipedIds(jobId);
      toast.success('Applied!');
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.toLowerCase().includes('already swiped')) {
        setResults(prev => prev?.map(j => j.id === jobId ? { ...j, _applied: true } : j));
        addToSwipedIds(jobId);
        toast.info('Already applied');
      } else {
        toast.error(detail || 'Failed to apply');
      }
    }
  };

  const handleSave = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/save`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResults(prev => prev?.map(j => j.id === jobId ? { ...j, _saved: true } : j));
      toast.success('Saved for later');
    } catch {
      toast.error('Failed to save');
    }
  };

  // Build active filter summary
  const filterSummary = [];
  if (keyword.trim()) filterSummary.push(keyword.trim());
  if (jobType) filterSummary.push(WORK_TYPES.find(w => w.key === jobType)?.label);
  if (experienceLevel) filterSummary.push(EXPERIENCE_LEVELS.find(e => e.key === experienceLevel)?.label);
  if (employmentType) filterSummary.push(EMPLOYMENT_TYPES.find(e => e.key === employmentType)?.label);
  if (salaryMin) filterSummary.push(SALARY_RANGES.find(s => s.key === salaryMin)?.label);
  if (location.trim()) filterSummary.push(location.trim());

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-['Outfit'] mb-1">Search Jobs</h1>
          <p className="text-sm text-muted-foreground">Find specific roles that match what you're looking for</p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Job title, company, or keyword..."
              className="pl-10 h-12 rounded-xl bg-card border-border"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="h-12 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}

          {/* Active filter chips */}
          {filterSummary.length > 0 && !showFilters && (
            <div className="flex gap-1.5 overflow-x-auto">
              {filterSummary.map((f, i) => (
                <span key={i} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] whitespace-nowrap">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="glass-card rounded-2xl p-4 mb-4 space-y-4">
            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, state, or remote..."
                  className="pl-9 h-10 rounded-xl bg-background border-border text-sm"
                />
              </div>
            </div>

            {/* Work Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Work Type</label>
              <div className="flex gap-2">
                {WORK_TYPES.map(wt => (
                  <button
                    key={wt.key}
                    onClick={() => setJobType(jobType === wt.key ? '' : wt.key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      jobType === wt.key
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Experience Level</label>
              <div className="flex gap-2 flex-wrap">
                {EXPERIENCE_LEVELS.map(el => (
                  <button
                    key={el.key}
                    onClick={() => setExperienceLevel(experienceLevel === el.key ? '' : el.key)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      experienceLevel === el.key
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {el.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Employment Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Employment Type</label>
              <div className="flex gap-2">
                {EMPLOYMENT_TYPES.map(et => (
                  <button
                    key={et.key}
                    onClick={() => setEmploymentType(employmentType === et.key ? '' : et.key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                      employmentType === et.key
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Salary Min */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Minimum Salary</label>
              <div className="flex gap-2 flex-wrap">
                {SALARY_RANGES.map(sr => (
                  <button
                    key={sr.key}
                    onClick={() => setSalaryMin(salaryMin === sr.key ? '' : sr.key)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      salaryMin === sr.key
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sr.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => { setShowFilters(false); handleSearch(); }}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-secondary text-sm"
            >
              <Search className="w-4 h-4 mr-1.5" /> Search with Filters
            </Button>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Searching jobs...</p>
          </div>
        ) : results === null && !hasSearched ? (
          /* Initial state — suggestions */
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Find your next role</h3>
            <p className="text-sm text-muted-foreground mb-6">Search by job title, company, skills, or location</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Software Engineer', 'Marketing', 'Remote', 'Design', 'Data Science'].map(s => (
                <button
                  key={s}
                  onClick={() => { setKeyword(s); }}
                  className="px-3 py-1.5 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : results?.length === 0 ? (
          /* No results */
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or broadening your search</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={clearFilters} className="rounded-xl text-sm">
                Clear Filters
              </Button>
              <Button onClick={() => navigate('/dashboard')} className="rounded-xl text-sm bg-gradient-to-r from-primary to-secondary">
                Browse All Jobs
              </Button>
            </div>
          </div>
        ) : results?.length > 0 ? (
          <>
            {/* Results header */}
            <div className="space-y-2 mb-3">
              {/* Row 1: Result count + Swipe Results */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSwipeResults}
                  className="rounded-xl text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1" /> Swipe Results
                </Button>
              </div>
              {/* Row 2: Sort pills + View toggles */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[
                    { key: '', label: 'Best Fit' },
                    { key: 'distance', label: 'Near Me' },
                    { key: 'newest', label: 'Newest' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => { setSortBy(s.key); }}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        sortBy === s.key
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'list'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <List className="w-3 h-3" /> List
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'map'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <MapPin className="w-3 h-3" /> Map
                  </button>
                </div>
              </div>
            </div>

            {/* Map view */}
            {viewMode === 'map' && (
              <div className="mb-4">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-[450px] rounded-2xl bg-accent/50 border border-border">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                }>
                  <MapView
                    jobs={results}
                    userLat={user?.location_lat}
                    userLng={user?.location_lng}
                    token={token}
                    onApply={(jobId) => setResults(prev => prev?.map(j => j.id === jobId ? { ...j, already_applied: true } : j))}
                    onSave={(jobId) => setResults(prev => prev?.map(j => j.id === jobId ? { ...j, _saved: true } : j))}
                  />
                </Suspense>
              </div>
            )}

            {/* Results list */}
            {viewMode === 'list' && <div className="space-y-3">
              {results.map(job => (
                <div
                  key={job.id}
                  className="glass-card rounded-2xl p-4 hover:border-primary/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {job.company_logo ? (
                        <img src={job.company_logo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.company}</p>
                      {formatSalary(job.salary_min, job.salary_max) && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                          <DollarSign className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-sm font-semibold text-green-400">
                            {formatSalary(job.salary_min, job.salary_max)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {job.location && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {job.location}
                            {job.distance_label && (
                              <span className={`ml-1 ${job.distance_label === 'Remote' ? 'text-green-400' : 'text-primary'}`}>
                                · {job.distance_label}
                              </span>
                            )}
                          </span>
                        )}
                        {job.job_type && (
                          <span className="text-xs text-muted-foreground capitalize">{job.job_type}</span>
                        )}
                        {job.employment_type && (
                          <span className="text-xs text-muted-foreground capitalize">{job.employment_type}</span>
                        )}
                      </div>
                      {job.match_score > 0 && (
                        <div className="mt-1.5">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            job.match_score >= 75 ? 'bg-green-500/10 text-green-400'
                            : job.match_score >= 50 ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                          }`}>
                            Fit Score: {job.match_score}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    {job._applied ? (
                      <span className="flex-1 flex items-center justify-center gap-1.5 text-xs text-success font-medium py-2 rounded-xl bg-success/10">
                        <CheckCircle className="w-3.5 h-3.5" /> Applied
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApply(job.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Apply
                      </button>
                    )}
                    {job._saved ? (
                      <span className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Bookmark className="w-3.5 h-3.5 fill-current" />
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSave(job.id); }}
                        className="p-2 rounded-xl border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                        title="Save for later"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>}
          </>
        ) : null}
      </main>

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <JobDetailModal
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onApply={(jobId) => { handleApply(jobId); setSelectedJob(s => s ? { ...s, _applied: true } : null); }}
            onSave={(jobId) => { handleSave(jobId); setSelectedJob(s => s ? { ...s, _saved: true } : null); }}
          />
        )}
      </AnimatePresence>

      <Navigation />
    </div>
  );
}

function JobDetailModal({ job, onClose, onApply, onSave }) {
  const scrollRef = useRef(null);
  const [canDragDown, setCanDragDown] = useState(true);
  const sheetY = useMotionValue(0);
  const sheetOpacity = useTransform(sheetY, [0, 300], [1, 0]);

  const handleScroll = () => {
    if (scrollRef.current) {
      setCanDragDown(scrollRef.current.scrollTop <= 0);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100]"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl overflow-hidden"
        style={{ y: sheetY, opacity: sheetOpacity, maxHeight: '90vh' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        drag={canDragDown ? "y" : false}
        dragConstraints={{ top: 0, bottom: 300 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) {
            onClose();
          }
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={() => setCanDragDown(true)}
        >
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>

        {/* Scrollable Content */}
        <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto px-6 pb-8" style={{ maxHeight: 'calc(90vh - 28px)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {job.company_logo ? (
                <img src={job.company_logo} alt={job.company} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{job.company}</div>
              {job.created_at && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Posted {new Date(job.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
            {job.match_score > 0 && (
              <span className={`ml-auto px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                job.match_score >= 75 ? 'bg-green-500/20 text-green-400' :
                job.match_score >= 50 ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                {job.match_score}%
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold font-['Outfit'] mb-4">{job.title}</h2>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-5">
            {formatSalary(job.salary_min, job.salary_max) && (
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {formatSalary(job.salary_min, job.salary_max)}
              </span>
            )}
            {job.location && (
              <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {job.location}
                {job.distance_label && ` · ${job.distance_label}`}
              </span>
            )}
            {job.job_type && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm capitalize">
                {job.job_type}
              </span>
            )}
            {job.experience_level && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm capitalize flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {job.experience_level}
              </span>
            )}
            {job.employment_type && job.employment_type !== 'full-time' && (
              <span className="px-3 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm capitalize">
                {job.employment_type}
              </span>
            )}
            {job.category && job.category !== 'other' && (
              <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm capitalize">
                {job.category}
              </span>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">About this role</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {/* Requirements */}
          {job.requirements?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Requirements</h3>
              <div className="flex flex-wrap gap-2">
                {job.requirements.map((req, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground">
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Benefits</h3>
              <div className="flex flex-wrap gap-2">
                {job.benefits.map((b, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border pb-4">
            {job._applied ? (
              <span className="flex-1 flex items-center justify-center gap-2 text-sm text-success font-medium py-3 rounded-xl bg-success/10">
                <CheckCircle className="w-4 h-4" /> Applied
              </span>
            ) : (
              <button
                onClick={() => onApply(job.id)}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 transition-opacity"
              >
                <CheckCircle className="w-4 h-4" /> Apply Now
              </button>
            )}
            {job._saved ? (
              <span className="p-3 rounded-xl bg-primary/10 text-primary">
                <Bookmark className="w-4 h-4 fill-current" />
              </span>
            ) : (
              <button
                onClick={() => onSave(job.id)}
                className="p-3 rounded-xl border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                title="Save for later"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
