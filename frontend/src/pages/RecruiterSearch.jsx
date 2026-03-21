import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, MapPin, Briefcase, GraduationCap, Clock,
  ChevronDown, ChevronRight, Star, MessageSquare, User, Lock, Crown,
  X, Filter, Award, BadgeCheck, Zap
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
  const [shortlisting, setShortlisting] = useState(new Set());

  const isPro = user?.subscription?.status === 'active' &&
    ['recruiter_pro', 'recruiter_enterprise'].includes(user?.subscription?.tier_id);

  const fetchCandidates = useCallback(async (filterOverride = null) => {
    try {
      setLoading(true);
      const f = filterOverride || filters;
      const params = new URLSearchParams();
      // Combine search query with skill filter
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

      // Client-side sort
      if (sortBy === 'most_recent') {
        results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      } else if (sortBy === 'most_experience') {
        results.sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
      }
      // 'best_fit' is the default server sort (by match_score)

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

  const handleShortlist = async (candidate) => {
    if (!candidate.best_match_job_id) {
      toast.error('Post a job first to shortlist candidates');
      return;
    }
    setShortlisting(prev => new Set([...prev, candidate.id]));
    try {
      await axios.post(`${API}/candidates/swipe`, {
        seeker_id: candidate.id,
        action: 'like',
        job_id: candidate.best_match_job_id,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${candidate.name} shortlisted!`);
      // Remove from results
      setCandidates(prev => prev.filter(c => c.id !== candidate.id));
    } catch (error) {
      const detail = error.response?.data?.detail || '';
      if (detail.toLowerCase().includes('already')) {
        toast.info('Already reviewed this candidate');
        setCandidates(prev => prev.filter(c => c.id !== candidate.id));
      } else {
        toast.error(detail || 'Failed to shortlist');
      }
    } finally {
      setShortlisting(prev => {
        const next = new Set(prev);
        next.delete(candidate.id);
        return next;
      });
    }
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
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Search Candidates</h1>
            <p className="text-sm text-muted-foreground">Find and shortlist talent for your roles</p>
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
              onChange={(e) => { setSortBy(e.target.value); fetchCandidates(); }}
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
                onShortlist={() => handleShortlist(candidate)}
                shortlisting={shortlisting.has(candidate.id)}
                navigate={navigate}
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

        {/* Load more hint */}
        {candidates.length >= 50 && (
          <p className="text-center text-xs text-muted-foreground mt-4 pb-4">
            Showing top 50 results. Refine your search for more specific results.
          </p>
        )}
      </main>

      <Navigation />
    </div>
  );
}

function CandidateRow({ candidate, onShortlist, shortlisting, navigate }) {
  const fitScore = candidate.match_score || 0;

  return (
    <div className="glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors">
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
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-lg text-xs h-9"
          onClick={() => {/* TODO: profile view modal */}}
        >
          <User className="w-3.5 h-3.5 mr-1" />
          View Profile
        </Button>
        <Button
          size="sm"
          className="flex-1 rounded-lg text-xs h-9 bg-gradient-to-r from-primary to-secondary"
          onClick={onShortlist}
          disabled={shortlisting}
        >
          {shortlisting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Star className="w-3.5 h-3.5 mr-1" />
              Shortlist
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
