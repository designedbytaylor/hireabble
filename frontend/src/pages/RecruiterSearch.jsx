import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, MapPin, Briefcase, GraduationCap, Clock,
  ChevronDown, ChevronRight, Star, MessageSquare, User, Lock, Crown,
  X, Filter, Award, BadgeCheck, Zap, Send, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import NotificationBell from '../components/NotificationBell';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import { SkeletonPageBackground, SkeletonListItem } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { CandidateDetailSheet } from '../components/CandidateDetailSheet';
import UpgradeModal from '../components/UpgradeModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SORT_OPTIONS = [
  { key: 'best_fit', label: 'Best Fit' },
  { key: 'most_recent', label: 'Most Recent' },
  { key: 'most_experience', label: 'Most Experience' },
];

export default function RecruiterSearch() {
  useDocumentTitle('Search Candidates');
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('best_fit');
  const [filters, setFilters] = useState({
    location: '',
    experience_level: '',
    skill: '',
    degree: '',
    work_preference: '',
    min_experience: '',
  });

  // View Profile state
  const [viewingCandidate, setViewingCandidate] = useState(null);

  // Invite to Apply state
  const [jobs, setJobs] = useState([]);
  const [sentInvites, setSentInvites] = useState(new Map());
  const [inviting, setInviting] = useState(new Set());
  const [jobSelectorFor, setJobSelectorFor] = useState(null); // candidate id showing job selector
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPro = user?.subscription?.status === 'active' &&
    ['recruiter_pro', 'recruiter_enterprise'].includes(user?.subscription?.tier_id);

  // Fetch recruiter's active jobs + sent invites on mount
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    // Fetch jobs
    axios.get(`${API}/jobs`, { headers, timeout: 10000 })
      .then(res => setJobs((res.data || []).filter(j => j.is_active)))
      .catch(() => {});
    // Fetch sent invites
    axios.get(`${API}/candidates/invites/sent`, { headers, timeout: 10000 })
      .then(res => {
        const map = new Map();
        (res.data || []).forEach(inv => map.set(`${inv.seeker_id}-${inv.job_id}`, inv));
        setSentInvites(map);
      })
      .catch(() => {}); // endpoint may not exist yet — graceful fallback
  }, [token]);

  const fetchCandidates = useCallback(async (filterOverride = null) => {
    try {
      setLoading(true);
      const f = filterOverride || filters;
      const params = new URLSearchParams();
      const skillSearch = searchQuery || f.skill;
      if (f.location) params.append('location', f.location);
      if (f.experience_level) params.append('experience_level', f.experience_level);
      if (skillSearch) params.append('skill', skillSearch);
      if (f.degree) params.append('degree', f.degree);
      if (f.work_preference) params.append('work_preference', f.work_preference);
      if (f.min_experience) params.append('min_experience', f.min_experience);
      params.append('limit', '50');
      const qs = params.toString();

      const res = await axios.get(`${API}/candidates${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      let results = res.data || [];

      if (sortBy === 'most_recent') {
        results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      } else if (sortBy === 'most_experience') {
        results.sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
      } else {
        // best_fit — sort by match_score descending
        results.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
      }

      setCandidates(results);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [token, filters, searchQuery, sortBy]);

  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sort candidates client-side when sortBy changes (no re-fetch needed)
  useEffect(() => {
    if (candidates.length === 0) return;
    setCandidates(prev => {
      const sorted = [...prev];
      if (sortBy === 'most_recent') {
        sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      } else if (sortBy === 'most_experience') {
        sorted.sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
      } else {
        // best_fit — sort by match_score descending
        sorted.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
      }
      return sorted;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCandidates();
  };

  const handleApplyFilters = () => {
    setShowFilters(false);
    fetchCandidates();
  };

  const handleClearFilters = () => {
    const cleared = { location: '', experience_level: '', skill: '', degree: '', work_preference: '', min_experience: '' };
    setFilters(cleared);
    setSearchQuery('');
    fetchCandidates(cleared);
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length + (searchQuery ? 1 : 0);

  // Invite to Apply handler
  const handleInvite = async (candidate, jobId) => {
    setInviting(prev => new Set([...prev, `${candidate.id}-${jobId}`]));
    try {
      await axios.post(`${API}/candidates/invite`, {
        seeker_id: candidate.id,
        job_id: jobId,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Invited ${candidate.name} to apply!`);
      setSentInvites(prev => new Map([...prev, [`${candidate.id}-${jobId}`, { status: 'pending' }]]));
      setJobSelectorFor(null);
    } catch (error) {
      const detail = error.response?.data?.detail || '';
      if (error.response?.status === 429) {
        setJobSelectorFor(null);
        toast.error('Daily invite limit reached. Upgrade for more!');
        setShowUpgradeModal(true);
      } else if (detail.toLowerCase().includes('already')) {
        toast.info('Already invited this candidate for this role');
        setSentInvites(prev => new Map([...prev, [`${candidate.id}-${jobId}`, { status: 'pending' }]]));
      } else {
        toast.error(detail || 'Failed to send invite');
      }
    } finally {
      setInviting(prev => {
        const next = new Set(prev);
        next.delete(`${candidate.id}-${jobId}`);
        return next;
      });
    }
  };

  // Check if candidate has been invited to all active jobs
  const isFullyInvited = (candidateId) => {
    if (jobs.length === 0) return false;
    return jobs.every(job => sentInvites.has(`${candidateId}-${job.id}`));
  };

  if (loading && candidates.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <Skeleton className="h-7 w-48 rounded mb-2" />
          <Skeleton className="h-4 w-32 rounded mb-6" />
          <Skeleton className="h-12 w-full rounded-xl mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </header>
        <main className="relative z-10 px-6 md:px-8 space-y-4">
          <SkeletonListItem avatarSize="w-16 h-16" avatarShape="rounded-xl" lines={3} />
          <SkeletonListItem avatarSize="w-16 h-16" avatarShape="rounded-xl" lines={3} />
          <SkeletonListItem avatarSize="w-16 h-16" avatarShape="rounded-xl" lines={3} />
          <SkeletonListItem avatarSize="w-16 h-16" avatarShape="rounded-xl" lines={3} />
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-30 p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Search Candidates</h1>
            <p className="text-sm text-muted-foreground">Find and invite talent to apply for your roles</p>
          </div>
          <NotificationBell />
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by skills, title, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-24 rounded-xl bg-card border border-border text-sm focus:border-primary/50 outline-none transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              className={`p-2 rounded-lg transition-colors relative ${
                showFilters ? 'bg-primary/20 text-primary' : 'hover:bg-accent text-muted-foreground'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Button type="submit" size="sm" className="rounded-lg bg-gradient-to-r from-primary to-secondary h-8 px-4">
              Search
            </Button>
          </div>
        </form>

        {/* Sort + Count */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
          </span>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 px-2 pr-6 rounded-lg bg-card border border-border text-xs focus:border-primary/50 outline-none appearance-none"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Filter Panel */}
      {showFilters && (
        <div className="relative z-10 px-6 md:px-8 mb-4">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">Filters</h3>
              {activeFilterCount > 0 && (
                <button onClick={handleClearFilters} className="text-xs text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>

            {/* Basic filters */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco"
                  value={filters.location}
                  onChange={(e) => setFilters(f => ({ ...f, location: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Experience Level</label>
                <select
                  value={filters.experience_level}
                  onChange={(e) => setFilters(f => ({ ...f, experience_level: e.target.value }))}
                  className="w-full h-9 px-2 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                >
                  <option value="">All Levels</option>
                  <option value="entry">Entry (0-2 yrs)</option>
                  <option value="mid">Mid (2-5 yrs)</option>
                  <option value="senior">Senior (5-10 yrs)</option>
                  <option value="lead">Lead (8+ yrs)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Skills</label>
                <input
                  type="text"
                  placeholder="e.g. React, Python, AWS"
                  value={filters.skill}
                  onChange={(e) => setFilters(f => ({ ...f, skill: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                />
              </div>
            </div>

            {/* Advanced filters (Pro+) */}
            {isPro ? (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Education</label>
                  <select
                    value={filters.degree}
                    onChange={(e) => setFilters(f => ({ ...f, degree: e.target.value }))}
                    className="w-full h-9 px-2 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                  >
                    <option value="">Any Education</option>
                    <option value="high_school">High School</option>
                    <option value="associates">Associate's</option>
                    <option value="bachelors">Bachelor's</option>
                    <option value="masters">Master's</option>
                    <option value="phd">PhD</option>
                    <option value="bootcamp">Bootcamp</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Work Preference</label>
                  <select
                    value={filters.work_preference}
                    onChange={(e) => setFilters(f => ({ ...f, work_preference: e.target.value }))}
                    className="w-full h-9 px-2 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                  >
                    <option value="">Any Preference</option>
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Minimum Years Experience</label>
                  <input
                    type="number"
                    placeholder="e.g. 3"
                    min="0"
                    value={filters.min_experience}
                    onChange={(e) => setFilters(f => ({ ...f, min_experience: e.target.value }))}
                    className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => navigate('/upgrade')}
                className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors w-full text-left"
              >
                <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">Advanced Filters</p>
                  <p className="text-[10px] text-muted-foreground">Upgrade to Pro for education, work preference & experience filters</p>
                </div>
                <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
              </button>
            )}

            <Button onClick={handleApplyFilters} className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary">
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      <main className="relative z-10 px-6 md:px-8">
        {candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                jobs={jobs}
                sentInvites={sentInvites}
                inviting={inviting}
                onInvite={handleInvite}
                onViewProfile={(c) => setViewingCandidate(c)}
                isFullyInvited={isFullyInvited(candidate.id)}
                jobSelectorOpen={jobSelectorFor === candidate.id}
                onToggleJobSelector={(id) => setJobSelectorFor(prev => prev === id ? null : id)}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold font-['Outfit'] mb-2">No Candidates Found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {activeFilterCount > 0
                ? 'Try adjusting your filters or search terms.'
                : 'Post a job to start seeing candidates that fit your roles.'}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={handleClearFilters} className="rounded-full">
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {candidates.length >= 50 && (
          <p className="text-center text-xs text-muted-foreground mt-4 pb-4">
            Showing top 50 results. Refine your search for more specific results.
          </p>
        )}
      </main>

      {/* Candidate Profile Bottom Sheet */}
      <AnimatePresence>
        {viewingCandidate && (
          <CandidateDetailSheet
            item={viewingCandidate}
            mode="discover"
            onClose={() => setViewingCandidate(null)}
          />
        )}
      </AnimatePresence>

      <Navigation />

      <UpgradeModal
        open={showUpgradeModal}
        trigger="invite_limit"
        highlightTier="recruiter_pro"
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}

function CandidateRow({ candidate, jobs, sentInvites, inviting, onInvite, onViewProfile, isFullyInvited, jobSelectorOpen, onToggleJobSelector }) {
  const fitScore = candidate.match_score || 0;
  const rowRef = useRef(null);

  // Close job selector when clicking outside
  useEffect(() => {
    if (!jobSelectorOpen) return;
    const handleClick = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        onToggleJobSelector(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [jobSelectorOpen, onToggleJobSelector]);

  return (
    <div ref={rowRef} className={`glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors ${jobSelectorOpen ? 'relative z-20' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <img
            src={getPhotoUrl(candidate.photo_url || candidate.avatar, candidate.name || candidate.id)}
            alt={candidate.name}
            className="w-16 h-16 rounded-xl object-cover border-2 border-border"
            loading="lazy"
            onError={handleImgError(candidate.name || candidate.id)}
          />
          {candidate.verified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <BadgeCheck className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold font-['Outfit'] truncate">{candidate.name}</h3>
            {candidate.is_featured && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold flex-shrink-0">
                FEATURED
              </span>
            )}
            {candidate.is_boosted && (
              <Zap className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-primary truncate">{candidate.title || 'Job Seeker'}</p>

          <div className="flex flex-wrap gap-2 mt-1.5">
            {candidate.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {candidate.location}
              </span>
            )}
            {candidate.experience_years != null && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {candidate.experience_years}+ yrs
              </span>
            )}
            {candidate.degree && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <GraduationCap className="w-3 h-3" />
                {candidate.degree}
              </span>
            )}
            {candidate.work_preference && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                <Briefcase className="w-3 h-3" />
                {candidate.work_preference}
              </span>
            )}
          </div>

          {/* Skills */}
          {candidate.skills && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(typeof candidate.skills === 'string' ? candidate.skills.split(',') : candidate.skills)
                .slice(0, 5)
                .map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-accent text-[10px] text-muted-foreground">
                    {typeof skill === 'string' ? skill.trim() : skill}
                  </span>
                ))}
              {(typeof candidate.skills === 'string' ? candidate.skills.split(',') : candidate.skills).length > 5 && (
                <span className="px-2 py-0.5 rounded-full bg-accent text-[10px] text-muted-foreground">
                  +{(typeof candidate.skills === 'string' ? candidate.skills.split(',') : candidate.skills).length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Fit Score */}
        {fitScore > 0 && (
          <div className="flex-shrink-0 text-center">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
              fitScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
              fitScore >= 60 ? 'bg-amber-500/20 text-amber-400' :
              'bg-muted text-muted-foreground'
            }`}>
              {fitScore}%
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Fit Score</span>
          </div>
        )}
      </div>

      {/* Best match job */}
      {candidate.best_match_job && (
        <div className="mt-2 px-2 py-1 rounded-lg bg-primary/5 text-xs text-muted-foreground flex items-center gap-1">
          <Briefcase className="w-3 h-3 text-primary" />
          Best fit: <span className="text-foreground font-medium">{candidate.best_match_job}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50 relative">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-lg text-xs h-9"
          onClick={() => onViewProfile(candidate)}
        >
          <User className="w-3.5 h-3.5 mr-1" />
          View Profile
        </Button>

        {/* Invite to Apply button */}
        {jobs.length === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-lg text-xs h-9 opacity-50"
            disabled
          >
            <Briefcase className="w-3.5 h-3.5 mr-1" />
            Post a Job First
          </Button>
        ) : isFullyInvited ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-lg text-xs h-9 text-emerald-400 border-emerald-500/30"
            disabled
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Invited
          </Button>
        ) : jobs.length === 1 ? (
          <Button
            size="sm"
            className="flex-1 rounded-lg text-xs h-9 bg-gradient-to-r from-primary to-secondary"
            onClick={() => onInvite(candidate, jobs[0].id)}
            disabled={inviting.has(`${candidate.id}-${jobs[0].id}`) || sentInvites.has(`${candidate.id}-${jobs[0].id}`)}
          >
            {inviting.has(`${candidate.id}-${jobs[0].id}`) ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : sentInvites.has(`${candidate.id}-${jobs[0].id}`) ? (
              <><Check className="w-3.5 h-3.5 mr-1" /> Invited</>
            ) : (
              <><Send className="w-3.5 h-3.5 mr-1" /> Invite to Apply</>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 rounded-lg text-xs h-9 bg-gradient-to-r from-primary to-secondary"
            onClick={() => onToggleJobSelector(candidate.id)}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Invite to Apply
            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${jobSelectorOpen ? 'rotate-180' : ''}`} />
          </Button>
        )}

        {/* Job Selector Dropdown */}
        {jobSelectorOpen && jobs.length > 1 && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-2 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground px-2">Select a job to invite for:</p>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {jobs.map(job => {
                const key = `${candidate.id}-${job.id}`;
                const alreadySent = sentInvites.has(key);
                const isSending = inviting.has(key);
                return (
                  <button
                    key={job.id}
                    onClick={() => !alreadySent && !isSending && onInvite(candidate, job.id)}
                    disabled={alreadySent || isSending}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                      alreadySent
                        ? 'opacity-50 cursor-default'
                        : 'hover:bg-accent cursor-pointer'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{job.title}</div>
                      <div className="text-muted-foreground truncate">{job.location}</div>
                    </div>
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    ) : alreadySent ? (
                      <span className="text-emerald-400 flex items-center gap-1 flex-shrink-0">
                        <Check className="w-3 h-3" /> Invited
                      </span>
                    ) : (
                      <span className="text-primary flex items-center gap-1 flex-shrink-0">
                        <Send className="w-3 h-3" /> Invite
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
