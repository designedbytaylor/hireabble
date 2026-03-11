import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, DollarSign, Briefcase, Clock, ChevronDown,
  ChevronUp, X, CheckCircle, Filter, Sparkles, Lock, Star
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatSalary(min, max) {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max)}`;
}

const JOB_TYPE_LABELS = { remote: 'Remote', onsite: 'On-site', hybrid: 'Hybrid' };
const EXP_LABELS = { entry: 'Entry Level', mid: 'Mid Level', senior: 'Senior', lead: 'Lead / Manager' };
const CATEGORY_OPTIONS = ['Technology', 'Design', 'Marketing', 'Sales', 'Finance', 'Healthcare', 'Engineering', 'Education', 'Other'];
const EMP_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship'];

export default function SearchJobs() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null);
  const [applying, setApplying] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    job_type: '',
    experience_level: '',
    salary_min: '',
    location: '',
    category: '',
    employment_type: '',
  });
  const [premiumFeatures, setPremiumFeatures] = useState({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef(null);
  const PAGE_SIZE = 20;

  // Fetch premium features on mount
  useEffect(() => {
    const fetchPremium = async () => {
      try {
        const res = await axios.get(`${API}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.premium_features) setPremiumFeatures(res.data.premium_features);
      } catch { /* ignore */ }
    };
    fetchPremium();
  }, [token]);

  const searchJobs = useCallback(async (searchQuery, filterState, pageNum, append = false) => {
    setLoading(true);
    try {
      const params = { include_swiped: true, skip: pageNum * PAGE_SIZE, limit: PAGE_SIZE };
      if (searchQuery) params.search = searchQuery;
      if (filterState.job_type) params.job_type = filterState.job_type;
      if (filterState.experience_level) params.experience_level = filterState.experience_level;
      if (filterState.salary_min) params.salary_min = parseInt(filterState.salary_min);
      if (filterState.location) params.location = filterState.location;
      if (filterState.category) params.category = filterState.category.toLowerCase();
      if (filterState.employment_type) params.employment_type = filterState.employment_type.toLowerCase().replace('-', '-');

      const res = await axios.get(`${API}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const jobs = res.data;
      setHasMore(jobs.length === PAGE_SIZE);
      if (append) {
        setResults(prev => [...prev, ...jobs]);
      } else {
        setResults(jobs);
      }
      setHasSearched(true);
    } catch {
      toast.error('Failed to search jobs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      searchJobs(query, filters, 0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, filters, searchJobs]);

  const handleApply = async (job) => {
    if (job.already_applied) return;
    setApplying(job.id);
    try {
      await axios.post(`${API}/swipe`, { job_id: job.id, action: 'like' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResults(prev => prev.map(j => j.id === job.id ? { ...j, already_applied: true } : j));
      toast.success(`Applied to ${job.title}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply');
    } finally {
      setApplying(null);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchJobs(query, filters, nextPage, true);
  };

  const clearFilters = () => {
    setFilters({ job_type: '', experience_level: '', salary_min: '', location: '', category: '', employment_type: '' });
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />

      <main className="relative z-10 max-w-lg mx-auto px-4 pt-14">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold font-['Outfit']">Search Jobs</h1>
          <p className="text-sm text-muted-foreground">Find specific opportunities by title, company, or keywords</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, company, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10 h-11 rounded-xl bg-card border-border"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-xl ${activeFilterCount > 0 ? 'border-primary text-primary' : ''}`}
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear all
            </button>
          )}
          {hasSearched && (
            <span className="text-xs text-muted-foreground ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="glass-card rounded-2xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Job Type</label>
                <Select value={filters.job_type} onValueChange={(v) => setFilters(prev => ({ ...prev, job_type: v === '__all__' ? '' : v }))}>
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All types</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Experience</label>
                <Select value={filters.experience_level} onValueChange={(v) => setFilters(prev => ({ ...prev, experience_level: v === '__all__' ? '' : v }))}>
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="All levels" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All levels</SelectItem>
                    <SelectItem value="entry">Entry Level</SelectItem>
                    <SelectItem value="mid">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead / Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
              <Input
                placeholder="e.g. San Francisco, Remote"
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                className="h-9 rounded-lg text-xs"
              />
            </div>

            {/* Premium Filters */}
            {premiumFeatures.advanced_filters ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                  <Select value={filters.category} onValueChange={(v) => setFilters(prev => ({ ...prev, category: v === '__all__' ? '' : v }))}>
                    <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All categories</SelectItem>
                      {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Employment</label>
                  <Select value={filters.employment_type} onValueChange={(v) => setFilters(prev => ({ ...prev, employment_type: v === '__all__' ? '' : v }))}>
                    <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All types</SelectItem>
                      {EMP_TYPE_OPTIONS.map(e => <SelectItem key={e} value={e.toLowerCase()}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Minimum Salary</label>
                  <Input
                    type="number"
                    placeholder="e.g. 80000"
                    value={filters.salary_min}
                    onChange={(e) => setFilters(prev => ({ ...prev, salary_min: e.target.value }))}
                    className="h-9 rounded-lg text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center gap-3">
                <Lock className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Advanced Filters</p>
                  <p className="text-[10px] text-muted-foreground">Category, employment type & salary filters</p>
                </div>
                <Button size="sm" variant="outline" className="text-[10px] h-7 rounded-lg" onClick={() => navigate('/upgrade')}>
                  <Sparkles className="w-3 h-3 mr-1" /> Upgrade
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {!hasSearched ? (
          <div className="text-center py-20">
            <Search className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Search for jobs</h3>
            <p className="text-sm text-muted-foreground">Find opportunities by title, company, or keywords</p>
          </div>
        ) : loading && results.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
            <p className="text-sm text-muted-foreground">Try different keywords or adjust your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((job) => (
              <div
                key={job.id}
                className="glass-card rounded-2xl p-4 hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    {job.company_logo ? (
                      <img src={job.company_logo} alt="" className="w-8 h-8 rounded-lg" />
                    ) : (
                      <Briefcase className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                      {job.already_applied && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium shrink-0">Applied</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{job.company}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.location && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </span>
                      )}
                      {formatSalary(job.salary_min, job.salary_max) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> {formatSalary(job.salary_min, job.salary_max)}
                        </span>
                      )}
                      {job.job_type && (
                        <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                        </span>
                      )}
                    </div>
                    {job.match_score != null && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Star className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-medium text-yellow-500">{job.match_score}% match</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {expandedJob === job.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedJob === job.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {job.experience_level && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                          {EXP_LABELS[job.experience_level] || job.experience_level}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 font-medium capitalize">
                          {job.employment_type}
                        </span>
                      )}
                      {job.category && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 font-medium capitalize">
                          {job.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line mb-3 line-clamp-6">{job.description}</p>
                    {job.requirements?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-foreground mb-1">Requirements</p>
                        <div className="flex flex-wrap gap-1.5">
                          {job.requirements.slice(0, 6).map((req, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{req}</span>
                          ))}
                          {job.requirements.length > 6 && (
                            <span className="text-[10px] text-muted-foreground">+{job.requirements.length - 6} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {job.already_applied ? (
                        <Button disabled className="flex-1 rounded-xl h-9 text-xs">
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Already Applied
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleApply(job); }}
                          disabled={applying === job.id}
                          className="flex-1 rounded-xl h-9 text-xs bg-gradient-to-r from-primary to-primary/80"
                        >
                          {applying === job.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                          ) : (
                            <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Apply Now
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loading}
                  className="rounded-xl"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  ) : null}
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
