import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Star, Briefcase, MapPin, DollarSign, Building2, Clock, ChevronDown, Filter, SlidersHorizontal, Zap, CheckCircle, Globe, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import NotificationBell from '../components/NotificationBell';
import MatchModal from '../components/MatchModal';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getPhotoUrl } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SeekerDashboard() {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ applications_sent: 0, super_likes_used: 0, matches: 0 });
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [expandedCard, setExpandedCard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [superLikesRemaining, setSuperLikesRemaining] = useState(3);
  const [swipeDirection, setSwipeDirection] = useState(null); // 'left', 'right', 'up'
  const [isAnimating, setIsAnimating] = useState(false);
  const [filters, setFilters] = useState({
    job_type: '',
    experience_level: '',
    salary_min: '',
    location: '',
    remote_only: false
  });
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    fetchJobs();
    fetchStats();
    fetchProfileCompleteness();
    fetchSuperLikesRemaining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Count active filters
    const count = Object.entries(filters).filter(([k, v]) =>
      k === 'remote_only' ? v === true : v !== ''
    ).length;
    setActiveFiltersCount(count);
  }, [filters]);

  const fetchSuperLikesRemaining = async () => {
    try {
      const response = await axios.get(`${API}/superlikes/remaining`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuperLikesRemaining(response.data.remaining);
    } catch (error) {
      console.error('Failed to fetch super likes:', error);
    }
  };

  const fetchProfileCompleteness = async () => {
    try {
      const response = await axios.get(`${API}/profile/completeness`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfileComplete(response.data.is_complete);
    } catch (error) {
      console.error('Failed to fetch profile completeness:', error);
    }
  };

  const fetchJobs = async (filterParams = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterParams.remote_only) {
        params.append('job_type', 'remote');
      } else if (filterParams.job_type) {
        params.append('job_type', filterParams.job_type);
      }
      if (filterParams.experience_level) params.append('experience_level', filterParams.experience_level);
      if (filterParams.salary_min) params.append('salary_min', filterParams.salary_min);
      if (filterParams.location) params.append('location', filterParams.location);
      
      const url = `${API}/jobs${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(response.data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSwipe = async (action, fromDrag = false) => {
    if (currentIndex >= jobs.length || isAnimating) return;
    
    // Check super like limit before sending
    if (action === 'superlike' && superLikesRemaining <= 0) {
      toast.error('No Super Likes remaining today! Try again tomorrow.', { duration: 3000 });
      return;
    }
    
    const job = jobs[currentIndex];
    
    // If triggered from button, animate the card first
    if (!fromDrag) {
      setIsAnimating(true);
      if (action === 'like') setSwipeDirection('right');
      else if (action === 'pass') setSwipeDirection('left');
      else if (action === 'superlike') setSwipeDirection('up');
      
      // Wait for animation to complete before API call
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    try {
      const response = await axios.post(`${API}/swipe`, 
        { job_id: job.id, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (action === 'like') {
        toast.success('Application sent!');
      } else if (action === 'superlike') {
        const remaining = response.data.remaining_superlikes;
        setSuperLikesRemaining(remaining);
        toast.success(
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span>Super Like sent! ({remaining} remaining today)</span>
          </div>,
          { duration: 2500 }
        );
      }
      
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
      setIsAnimating(false);
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit');
      setSwipeDirection(null);
      setIsAnimating(false);
    }
  };

  const handleApplyFilters = () => {
    fetchJobs(filters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const clearedFilters = { job_type: '', experience_level: '', salary_min: '', location: '', remote_only: false };
    setFilters(clearedFilters);
    fetchJobs(clearedFilters);
    setShowFilters(false);
  };

  const currentJob = jobs[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Hi, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-muted-foreground">Find your dream job</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => setShowFilters(true)}
              className="relative p-2 rounded-xl hover:bg-accent transition-colors"
              data-testid="filter-btn"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <img 
              src={getPhotoUrl(user?.photo_url, user?.id) || user?.avatar}
              alt="Avatar"
              className="w-10 h-10 rounded-full border-2 border-primary object-cover"
            />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          <div className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.applications_sent}</div>
              <div className="text-xs text-muted-foreground">Applied</div>
            </div>
          </div>
          <div className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.super_likes_used}</div>
              <div className="text-xs text-muted-foreground">Super Likes</div>
            </div>
          </div>
          <div className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.matches}</div>
              <div className="text-xs text-muted-foreground">Matches</div>
            </div>
          </div>
          {/* Quick Apply Badge */}
          {profileComplete && (
            <div className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap border-success/30 bg-success/5">
              <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-sm font-bold text-success">Quick Apply</div>
                <div className="text-xs text-muted-foreground">Profile Ready</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Swipe Area */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-md mx-auto">
          {currentJob ? (
            <>
              {/* Card Stack */}
              <div className="relative aspect-[3/4] card-stack" data-testid="swipe-deck">
                {/* Background cards for depth effect */}
                {jobs.slice(currentIndex + 1, currentIndex + 3).map((_, i) => (
                  <div 
                    key={i}
                    className="absolute inset-0 rounded-3xl bg-card border border-border"
                    style={{
                      transform: `scale(${1 - (i + 1) * 0.05}) translateY(${(i + 1) * 15}px)`,
                      opacity: 1 - (i + 1) * 0.3,
                      zIndex: -i - 1
                    }}
                  />
                ))}

                {/* Main Swipeable Card */}
                <SwipeCard 
                  job={currentJob}
                  onSwipe={(action) => handleSwipe(action, true)}
                  expanded={expandedCard}
                  setExpanded={setExpandedCard}
                  swipeDirection={swipeDirection}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center items-center gap-5 mt-8">
                <button
                  onClick={() => handleSwipe('pass')}
                  className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center hover:scale-110 hover:neon-glow-red transition-all duration-300"
                  data-testid="pass-btn"
                >
                  <X className="w-7 h-7 text-destructive" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => handleSwipe('superlike')}
                    disabled={superLikesRemaining <= 0}
                    className={`w-20 h-20 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center transition-all duration-300 ${
                      superLikesRemaining > 0 
                        ? 'hover:scale-110 hover:neon-glow-pink' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    data-testid="superlike-btn"
                  >
                    <Star className={`w-9 h-9 ${superLikesRemaining > 0 ? 'text-secondary' : 'text-muted-foreground'}`} />
                  </button>
                  {/* Super Like Counter Badge */}
                  <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    superLikesRemaining > 0 
                      ? 'bg-secondary text-white' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {superLikesRemaining}
                  </span>
                </div>
                <button
                  onClick={() => handleSwipe('like')}
                  className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center hover:scale-110 hover:neon-glow-green transition-all duration-300"
                  data-testid="like-btn"
                >
                  <Heart className="w-7 h-7 text-success" />
                </button>
              </div>
            </>
          ) : (
            <div className="aspect-[3/4] rounded-3xl glass-card flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <Briefcase className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-3">No More Jobs</h2>
              <p className="text-muted-foreground mb-6">
                {activeFiltersCount > 0 
                  ? "No jobs match your filters. Try adjusting them."
                  : "You've seen all available jobs. Check back later!"}
              </p>
              <div className="flex gap-3">
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="outline"
                    onClick={handleClearFilters}
                    className="rounded-full"
                  >
                    Clear Filters
                  </Button>
                )}
                <Button 
                  onClick={() => {
                    setCurrentIndex(0);
                    fetchJobs();
                  }}
                  className="rounded-full bg-gradient-to-r from-primary to-secondary"
                  data-testid="refresh-jobs-btn"
                >
                  Refresh Jobs
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Filter Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Jobs
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Remote Jobs Toggle */}
            <button
              type="button"
              onClick={() => setFilters({ ...filters, remote_only: !filters.remote_only, job_type: '' })}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                filters.remote_only
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/20'
              }`}
              data-testid="filter-remote-toggle"
            >
              <Wifi className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">Remote Jobs Only</div>
                <div className="text-xs opacity-70">Show only remote positions</div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${filters.remote_only ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${filters.remote_only ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {/* Location Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <Select
                value={filters.location || "any"}
                onValueChange={(v) => setFilters({ ...filters, location: v === "any" ? "" : v })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background" data-testid="filter-location">
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">
                    <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Any Location</span>
                  </SelectItem>
                  <SelectItem value="San Francisco">San Francisco, CA</SelectItem>
                  <SelectItem value="New York">New York, NY</SelectItem>
                  <SelectItem value="Austin">Austin, TX</SelectItem>
                  <SelectItem value="Seattle">Seattle, WA</SelectItem>
                  <SelectItem value="Chicago">Chicago, IL</SelectItem>
                  <SelectItem value="Los Angeles">Los Angeles, CA</SelectItem>
                  <SelectItem value="Denver">Denver, CO</SelectItem>
                  <SelectItem value="Portland">Portland, OR</SelectItem>
                  <SelectItem value="Boston">Boston, MA</SelectItem>
                  <SelectItem value="Miami">Miami, FL</SelectItem>
                  <SelectItem value="London">London, UK</SelectItem>
                  <SelectItem value="Toronto">Toronto, Canada</SelectItem>
                  <SelectItem value="Berlin">Berlin, Germany</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Or type a custom location..."
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="h-10 rounded-xl bg-background text-sm"
                data-testid="filter-location-custom"
              />
            </div>

            {!filters.remote_only && (
              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select
                  value={filters.job_type || "all"}
                  onValueChange={(v) => setFilters({ ...filters, job_type: v === "all" ? "" : v })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background" data-testid="filter-job-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Experience Level</Label>
              <Select
                value={filters.experience_level || "all"}
                onValueChange={(v) => setFilters({ ...filters, experience_level: v === "all" ? "" : v })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background" data-testid="filter-experience">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="mid">Mid Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead / Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minimum Salary ($)</Label>
              <Input
                type="number"
                placeholder="e.g., 50000"
                value={filters.salary_min}
                onChange={(e) => setFilters({ ...filters, salary_min: e.target.value })}
                className="h-11 rounded-xl bg-background"
                data-testid="filter-salary"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1 rounded-xl"
              data-testid="clear-filters-btn"
            >
              Clear All
            </Button>
            <Button
              onClick={handleApplyFilters}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary"
              data-testid="apply-filters-btn"
            >
              Apply Filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Navigation />
      
      {showMatch && (
        <MatchModal 
          match={matchData}
          onClose={() => setShowMatch(false)}
        />
      )}
    </div>
  );
}

function SwipeCard({ job, onSwipe, expanded, setExpanded, swipeDirection }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);

  // Indicator opacities - show sooner for snappier feedback
  const likeOpacity = useTransform(x, [0, 60], [0, 1]);
  const passOpacity = useTransform(x, [-60, 0], [1, 0]);
  const superlikeOpacity = useTransform(y, [-60, 0], [1, 0]);

  // Handle button-triggered swipes
  useEffect(() => {
    if (swipeDirection) {
      const toX = swipeDirection === 'right' ? 1500 : swipeDirection === 'left' ? -1500 : 0;
      const toY = swipeDirection === 'up' ? -1500 : 0;

      const startX = x.get();
      const startY = y.get();
      const startTime = Date.now();
      const duration = 200;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        x.set(startX + (toX - startX) * easeProgress);
        y.set(startY + (toY - startY) * easeProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeDirection]);

  const handleDragEnd = (_, info) => {
    const swipeThreshold = 60;
    const velocityThreshold = 300;
    const velocity = info.velocity;

    // Lower thresholds = easier to trigger swipe, feels snappier like Tinder
    if (info.offset.y < -swipeThreshold || velocity.y < -velocityThreshold) {
      animateCardOut(0, -1500, 'superlike');
    } else if (info.offset.x > swipeThreshold || velocity.x > velocityThreshold) {
      animateCardOut(1500, 0, 'like');
    } else if (info.offset.x < -swipeThreshold || velocity.x < -velocityThreshold) {
      animateCardOut(-1500, 0, 'pass');
    } else {
      // Spring back to center smoothly
      animateSpringBack();
    }
  };

  const animateSpringBack = () => {
    const startX = x.get();
    const startY = y.get();
    const startTime = Date.now();
    const duration = 200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Elastic ease out
      const easeProgress = 1 - Math.pow(1 - progress, 4);

      x.set(startX * (1 - easeProgress));
      y.set(startY * (1 - easeProgress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const animateCardOut = (toX, toY, action) => {
    const startX = x.get();
    const startY = y.get();
    const startTime = Date.now();
    const duration = 150; // Much faster fly-out

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * progress; // ease-in for fast acceleration

      x.set(startX + (toX - startX) * easeProgress);
      y.set(startY + (toY - startY) * easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onSwipe(action);
      }
    };

    requestAnimationFrame(animate);
  };

  const formatSalary = (min, max) => {
    if (!min && !max) return null;
    const format = (n) => n >= 1000 ? `$${Math.round(n/1000)}k` : `$${n}`;
    if (min && max) return `${format(min)} - ${format(max)}`;
    if (min) return `${format(min)}+`;
    return `Up to ${format(max)}`;
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!swipeDirection}
      dragConstraints={false}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      data-testid="job-card"
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={job.background_image} 
            alt="Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
        </div>

        {/* Swipe Indicators */}
        <motion.div 
          className="absolute top-8 right-8 px-6 py-2 rounded-full bg-success border-2 border-success font-bold text-white transform rotate-12 z-20"
          style={{ opacity: likeOpacity }}
        >
          APPLY
        </motion.div>
        <motion.div 
          className="absolute top-8 left-8 px-6 py-2 rounded-full bg-destructive border-2 border-destructive font-bold text-white transform -rotate-12 z-20"
          style={{ opacity: passOpacity }}
        >
          PASS
        </motion.div>
        <motion.div 
          className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-secondary border-2 border-secondary font-bold text-white z-20"
          style={{ opacity: superlikeOpacity }}
        >
          SUPER LIKE
        </motion.div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
          {/* Company Logo & Name */}
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={job.company_logo}
              alt={job.company}
              className="w-12 h-12 rounded-xl object-cover border border-white/20"
            />
            <div>
              <div className="text-sm text-muted-foreground">{job.company}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(job.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Job Title */}
          <h2 className="text-2xl md:text-3xl font-bold font-['Outfit'] mb-3">{job.title}</h2>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {formatSalary(job.salary_min, job.salary_max) && (
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {formatSalary(job.salary_min, job.salary_max)}
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {job.location}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm capitalize">
              {job.job_type}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm capitalize">
              {job.experience_level}
            </span>
          </div>

          {/* Expandable Description */}
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Hide details' : 'Show details'}
          </button>
          
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-4">{job.description}</p>
                  {job.requirements?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {job.requirements.slice(0, 5).map((req, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-white/5 text-xs text-muted-foreground">
                          {req}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
