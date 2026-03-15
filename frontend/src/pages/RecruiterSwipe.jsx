import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  X, Heart, Star, MapPin, Briefcase, GraduationCap, Clock,
  ChevronDown, BarChart3, Users, FileText, Building2, SlidersHorizontal,
  Search, Sparkles, Zap, MessageSquare, Plus, Lock, Crown, Filter, Video
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import NotificationBell from '../components/NotificationBell';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import UpgradeModal from '../components/UpgradeModal';
import MatchModal from '../components/MatchModal';
import { SkeletonPageBackground, SkeletonStatCard, SkeletonSwipeCard, SkeletonActionButtons } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Preload upcoming card images for instant display
function useImagePreloader(items, currentIndex, mode) {
  const preloadedRef = useRef(new Set());
  useEffect(() => {
    const upcoming = items.slice(currentIndex, currentIndex + 5);
    for (const item of upcoming) {
      const url = mode === 'applicants'
        ? getPhotoUrl(item.seeker_photo || item.seeker_avatar, item.seeker_name || item.seeker_id)
        : getPhotoUrl(item.photo_url || item.avatar, item.id);
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }, [items, currentIndex, mode]);
}

export default function RecruiterSwipe() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('applicants'); // 'applicants' or 'discover'
  const [applications, setApplications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active_jobs: 0, total_applications: 0, super_likes: 0, matches: 0 });
  const [expandedCard, setExpandedCard] = useState(false);
  const [exitingCards, setExitingCards] = useState([]);
  const [superSwipesRemaining, setSuperSwipesRemaining] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [showDiscoverFilters, setShowDiscoverFilters] = useState(false);
  const [discoverFilters, setDiscoverFilters] = useState({
    location: '', experience_level: '', skill: '',
    degree: '', work_preference: '', min_experience: '',
  });
  const [showPreMatchMsg, setShowPreMatchMsg] = useState(false);
  const [preMatchMsgText, setPreMatchMsgText] = useState('');
  const [sendingPreMatch, setSendingPreMatch] = useState(false);
  const isEnterprise = user?.subscription?.status === 'active' && user?.subscription?.tier_id === 'recruiter_enterprise';
  const swipedIdsRef = useRef(new Set());
  const readReceiptsSent = useRef(new Set());

  // Preload images for upcoming cards
  const items = mode === 'applicants' ? applications : candidates;
  useImagePreloader(items, currentIndex, mode);

  useEffect(() => {
    const isPaymentReturn = searchParams.get('payment') === 'success' && searchParams.get('session_id');
    if (!isPaymentReturn) fetchData(); // skip on Stripe return — payment verify handles it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verify Stripe payment on return from checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (searchParams.get('payment') === 'success' && sessionId && token) {
      window.history.replaceState({}, '', window.location.pathname);
      const verifyPayment = async (retries = 3) => {
        try {
          const res = await axios.get(`${API}/payments/verify-session/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data.status === 'paid') {
            toast.success('Payment successful! Your subscription is now active.');
            await refreshUser();
            fetchData(); // Re-fetch page data with updated subscription
          } else if (retries > 0) {
            setTimeout(() => verifyPayment(retries - 1), 2000);
          }
        } catch {
          if (retries > 0) {
            setTimeout(() => verifyPayment(retries - 1), 2000);
          } else {
            toast.success('Payment received! Your subscription will activate shortly.');
            await refreshUser();
            fetchData();
          }
        }
      };
      verifyPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire read receipt when recruiter views an application card
  useEffect(() => {
    if (mode !== 'applicants' || !applications.length || currentIndex >= applications.length) return;
    const app = applications[currentIndex];
    if (!app?.id || readReceiptsSent.current.has(app.id)) return;
    readReceiptsSent.current.add(app.id);
    axios.post(`${API}/applications/${app.id}/read`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {}); // fire-and-forget
  }, [currentIndex, mode, applications, token]);

  // WebSocket listener for async match notifications
  useEffect(() => {
    if (!token) return;
    const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
    if (!WS_URL) return;
    let ws;
    try {
      ws = new WebSocket(`${WS_URL}/ws/${token}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_match' && data.match) {
            setMatchData({
              seeker_name: data.match.seeker_name,
              job_title: data.match.job_title,
              company: data.match.company || user?.company,
            });
            setShowMatch(true);
            setStats(prev => ({ ...prev, matches: (prev.matches || 0) + 1 }));
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onerror = () => {};
    } catch { /* ignore connection errors */ }
    return () => { if (ws) ws.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (mode === 'discover' && candidates.length === 0) {
      fetchCandidates();
    }
    setCurrentIndex(0);
    setExpandedCard(false);
    swipedIdsRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fetchData = async (retry = 0) => {
    try {
      const opts = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };
      const [appsRes, statsRes] = await Promise.all([
        axios.get(`${API}/applications`, opts),
        axios.get(`${API}/stats/recruiter`, opts)
      ]);
      const pending = appsRes.data.filter(a => !a.recruiter_action);
      setApplications(pending);
      setStats(statsRes.data);
      swipedIdsRef.current.clear();
    } catch (error) {
      if (retry < 1 && (!error.response || error.code === 'ECONNABORTED')) {
        return fetchData(retry + 1);
      }
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (retry = 0, filterParams = null) => {
    try {
      const opts = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };
      const f = filterParams || discoverFilters;
      const params = new URLSearchParams();
      if (f.location) params.append('location', f.location);
      if (f.experience_level) params.append('experience_level', f.experience_level);
      if (f.skill) params.append('skill', f.skill);
      if (f.degree) params.append('degree', f.degree);
      if (f.work_preference) params.append('work_preference', f.work_preference);
      if (f.min_experience) params.append('min_experience', f.min_experience);
      const qs = params.toString();
      const [candidatesRes, swipesRes] = await Promise.all([
        axios.get(`${API}/candidates${qs ? `?${qs}` : ''}`, opts),
        axios.get(`${API}/candidates/superswipes/remaining`, opts),
      ]);
      setCandidates(candidatesRes.data);
      setSuperSwipesRemaining(swipesRes.data);
      swipedIdsRef.current.clear();
    } catch (error) {
      if (retry < 1 && (!error.response || error.code === 'ECONNABORTED')) {
        return fetchCandidates(retry + 1);
      }
      console.error('Failed to fetch candidates:', error);
    }
  };

  const handleSwipe = (action, exitDirection = { x: 0, y: 0 }, dragPos = { x: 0, y: 0 }) => {
    const items = mode === 'applicants' ? applications : candidates;
    if (currentIndex >= items.length) return;

    const item = items[currentIndex];

    // Prevent double-swiping
    if (swipedIdsRef.current.has(item.id)) return;
    swipedIdsRef.current.add(item.id);

    // Advance index IMMEDIATELY — next card is already visible in the stack
    setCurrentIndex(prev => prev + 1);
    setExpandedCard(false);

    // Add exiting card — start from where the user released the drag
    const exitDir = exitDirection.x || exitDirection.y
      ? exitDirection
      : action === 'reject' ? { x: -1500, y: 0 } : { x: 1500, y: 0 };
    setExitingCards(prev => [...prev, { item, action, exitDirection: exitDir, id: item.id, mode, startX: dragPos.x, startY: dragPos.y }]);
    setTimeout(() => {
      setExitingCards(prev => prev.filter(c => c.id !== item.id));
    }, 500);

    // Fire-and-forget API call — don't block the UI
    if (mode === 'applicants') {
      axios.post(`${API}/applications/respond`,
        { application_id: item.id, action },
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(res => {
        if (action === 'accept' || action === 'superlike' || res.data?.is_matched) {
          toast.success("Matched! You can now message this candidate.", { duration: 2000 });
        }
        if (action === 'superlike') {
          setSuperSwipesRemaining(prev => prev ? { ...prev, remaining: prev.remaining - 1 } : prev);
        }
      }).catch(error => {
        const detail = error.response?.data?.detail || '';
        if (detail.includes('Super Swipes remaining')) {
          setShowUpgradeModal(true);
        }
        if (error.response?.status === 400) {
          toast.error(detail || 'Failed to respond');
        }
      });
    } else {
      const swipeAction = action === 'accept' ? 'like' : action === 'superlike' ? 'superlike' : 'pass';
      axios.post(`${API}/candidates/swipe`,
        { seeker_id: item.id, action: swipeAction, job_id: item.best_match_job_id },
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(() => {
        // Match detection is async — delivered via WebSocket new_match event
        if (swipeAction === 'superlike') {
          setSuperSwipesRemaining(prev => prev ? { ...prev, remaining: prev.remaining - 1 } : prev);
        }
      }).catch(error => {
        const detail = error.response?.data?.detail || '';
        if (detail.includes('Super Swipes remaining')) {
          setShowUpgradeModal(true);
        }
        if (error.response?.status === 400) {
          toast.error(detail || 'Failed to respond');
        }
      });
    }
  };

  const currentItem = items[currentIndex];

  if (loading) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <SkeletonPageBackground />
        <header className="relative z-20 px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </header>
        <main className="relative z-10 flex-1 flex flex-col px-3 pb-28 min-h-0">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
            <Skeleton className="h-10 rounded-xl w-full mb-2" />
            <SkeletonSwipeCard />
            <SkeletonActionButtons />
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  // Gate: recruiter must have at least one active job to swipe
  if (stats.active_jobs === 0) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        </div>
        <main className="relative z-10 flex-1 flex flex-col px-3 pb-28 min-h-0">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
            <div className="flex-1 rounded-3xl glass-card flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <Briefcase className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-3">Post Your First Job</h2>
              <p className="text-muted-foreground mb-6">
                You need at least one active job posting before you can review applicants or discover candidates.
              </p>
              <Button
                onClick={() => navigate('/recruiter/dashboard')}
                className="rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 px-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post a Job
              </Button>
            </div>
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Slim Header */}
      <header className="relative z-20 px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <img src="/logo-white.png" alt="Hireabble" className="w-8 h-8" />
            <h1 className="text-lg font-bold font-['Outfit']">hireabble</h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => navigate('/recruiter/dashboard')}
              className="p-2 rounded-xl hover:bg-accent transition-colors"
              title="Dashboard"
            >
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </button>
            <img
              src={getPhotoUrl(user?.photo_url, user?.id) || user?.avatar}
              alt="Avatar"
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full border-2 border-primary object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onError={handleImgError(user?.id)}
            />
          </div>
        </div>

        {/* Mode Toggle - Compact */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-card border border-border">
          <button
            onClick={() => setMode('applicants')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              mode === 'applicants'
                ? 'bg-gradient-to-r from-primary to-secondary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Applicants {applications.length > 0 && `(${applications.length})`}
          </button>
          <button
            onClick={() => setMode('discover')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              mode === 'discover'
                ? 'bg-gradient-to-r from-primary to-secondary text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Discover
          </button>
        </div>

        {/* Discover Filters Toggle */}
        {mode === 'discover' && (
          <button
            onClick={() => setShowDiscoverFilters(f => !f)}
            className="flex items-center justify-center gap-1.5 mt-1.5 py-1.5 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-3 h-3" />
            Filters
            {Object.values(discoverFilters).some(v => v) && (
              <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                {Object.values(discoverFilters).filter(v => v).length}
              </span>
            )}
          </button>
        )}
      </header>

      {/* Discover Filter Panel */}
      <AnimatePresence>
        {showDiscoverFilters && mode === 'discover' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 px-3 overflow-hidden"
          >
            <div className="max-w-md mx-auto glass-card rounded-2xl p-3 mb-2 space-y-2">
              {/* Basic filters (free) */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Location"
                  value={discoverFilters.location}
                  onChange={(e) => setDiscoverFilters(f => ({ ...f, location: e.target.value }))}
                  className="h-9 px-3 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                />
                <select
                  value={discoverFilters.experience_level}
                  onChange={(e) => setDiscoverFilters(f => ({ ...f, experience_level: e.target.value }))}
                  className="h-9 px-2 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                >
                  <option value="">Experience Level</option>
                  <option value="entry">Entry (0-2 yrs)</option>
                  <option value="mid">Mid (2-5 yrs)</option>
                  <option value="senior">Senior (5-10 yrs)</option>
                  <option value="lead">Lead (8+ yrs)</option>
                </select>
                <input
                  type="text"
                  placeholder="Skill (e.g. React)"
                  value={discoverFilters.skill}
                  onChange={(e) => setDiscoverFilters(f => ({ ...f, skill: e.target.value }))}
                  className="col-span-2 h-9 px-3 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                />
              </div>

              {/* Advanced filters (Pro+) */}
              {user?.subscription?.status === 'active' && ['recruiter_pro', 'recruiter_enterprise'].includes(user?.subscription?.tier_id) ? (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                  <select
                    value={discoverFilters.degree}
                    onChange={(e) => setDiscoverFilters(f => ({ ...f, degree: e.target.value }))}
                    className="h-9 px-2 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                  >
                    <option value="">Education</option>
                    <option value="high_school">High School</option>
                    <option value="associates">Associate's</option>
                    <option value="bachelors">Bachelor's</option>
                    <option value="masters">Master's</option>
                    <option value="phd">PhD</option>
                    <option value="bootcamp">Bootcamp</option>
                  </select>
                  <select
                    value={discoverFilters.work_preference}
                    onChange={(e) => setDiscoverFilters(f => ({ ...f, work_preference: e.target.value }))}
                    className="h-9 px-2 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                  >
                    <option value="">Work Preference</option>
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Min. years exp"
                    value={discoverFilters.min_experience}
                    onChange={(e) => setDiscoverFilters(f => ({ ...f, min_experience: e.target.value }))}
                    className="col-span-2 h-9 px-3 rounded-xl bg-background border border-border text-xs focus:border-primary/50 outline-none"
                  />
                </div>
              ) : (
                <button
                  onClick={() => navigate('/upgrade')}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors w-full text-left"
                >
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Advanced Filters</p>
                    <p className="text-[10px] text-muted-foreground">Upgrade to Pro for education, work preference & experience filters</p>
                  </div>
                  <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDiscoverFilters({ location: '', experience_level: '', skill: '', degree: '', work_preference: '', min_experience: '' });
                    setCurrentIndex(0);
                    fetchCandidates(0, { location: '', experience_level: '', skill: '', degree: '', work_preference: '', min_experience: '' });
                  }}
                  className="flex-1 h-8 rounded-xl bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    fetchCandidates(0, discoverFilters);
                    setShowDiscoverFilters(false);
                  }}
                  className="flex-1 h-8 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-medium hover:opacity-90"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Swipe Area */}
      <main className="relative z-10 flex-1 flex flex-col px-3 pb-20 min-h-0">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
          {currentItem ? (
            <>
              {/* Card Stack */}
              <div className="relative flex-1 card-stack min-h-0" data-testid="applicant-deck">
                {/* Background cards — real content for instant reveal */}
                {items.slice(currentIndex + 1, currentIndex + 3).map((bgItem, i) => (
                  <div
                    key={bgItem.id || i}
                    className="absolute inset-0 rounded-3xl overflow-hidden"
                    style={{
                      transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 12}px)`,
                      zIndex: -(i + 1)
                    }}
                  >
                    {mode === 'applicants' ? (
                      <StaticApplicantCard app={bgItem} />
                    ) : (
                      <StaticCandidateCard candidate={bgItem} />
                    )}
                  </div>
                ))}

                {/* Exiting cards (animating off-screen) */}
                {exitingCards.map((card) => (
                  <ExitingRecruiterCard key={`exit-${card.id}`} card={card} />
                ))}

                {/* Main Swipeable Card */}
                {mode === 'applicants' ? (
                  <ApplicantCard
                    key={currentItem.id}
                    app={currentItem}
                    onSwipe={handleSwipe}
                    expanded={expandedCard}
                    setExpanded={setExpandedCard}
                  />
                ) : (
                  <CandidateCard
                    key={currentItem.id}
                    candidate={currentItem}
                    onSwipe={handleSwipe}
                    expanded={expandedCard}
                    setExpanded={setExpandedCard}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center items-center gap-5 py-3 shrink-0">
                <button
                  onClick={() => handleSwipe('reject', { x: -1500, y: 0 })}
                  className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center hover:scale-110 hover:neon-glow-red transition-all duration-300"
                  data-testid="reject-btn"
                  aria-label="Pass on this candidate"
                >
                  <X className="w-7 h-7 text-destructive" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => {
                      if (superSwipesRemaining && superSwipesRemaining.remaining <= 0) {
                        setShowUpgradeModal(true);
                        return;
                      }
                      handleSwipe('superlike', { x: 0, y: -1500 });
                    }}
                    className="w-14 h-14 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center hover:scale-110 transition-all duration-300"
                    data-testid="superswipe-btn"
                    aria-label="Super like this candidate"
                  >
                    <Star className="w-6 h-6 text-secondary fill-secondary" />
                  </button>
                  {superSwipesRemaining && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-secondary text-xs font-bold flex items-center justify-center text-white">
                      {superSwipesRemaining.remaining}
                    </span>
                  )}
                </div>

                {mode === 'discover' && isEnterprise && (
                  <button
                    onClick={() => setShowPreMatchMsg(true)}
                    className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center hover:scale-110 transition-all duration-300"
                    aria-label="Message candidate"
                    title="Message before matching"
                  >
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </button>
                )}

                <button
                  onClick={() => handleSwipe('accept', { x: 1500, y: 0 })}
                  className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center hover:scale-110 hover:neon-glow-green transition-all duration-300"
                  data-testid="accept-btn"
                  aria-label="Like this candidate"
                >
                  <Heart className="w-7 h-7 text-success" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 rounded-3xl glass-card flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                {mode === 'applicants' ? (
                  <Users className="w-10 h-10 text-primary" />
                ) : (
                  <Search className="w-10 h-10 text-primary" />
                )}
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-3">
                {mode === 'applicants' ? 'All Caught Up!' : 'No More Candidates'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {mode === 'applicants'
                  ? "You've reviewed all current applicants. Try discovering new candidates!"
                  : "You've seen all available candidates. Check back later for new talent!"}
              </p>
              <div className="flex gap-3">
                {mode === 'applicants' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/recruiter/dashboard')}
                      className="rounded-full"
                    >
                      Dashboard
                    </Button>
                    <Button
                      onClick={() => setMode('discover')}
                      className="rounded-full bg-gradient-to-r from-primary to-secondary"
                    >
                      <Search className="w-4 h-4 mr-1" /> Discover
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setMode('applicants')}
                      className="rounded-full"
                    >
                      View Applicants
                    </Button>
                    <Button
                      onClick={() => { setCurrentIndex(0); fetchCandidates(); }}
                      className="rounded-full bg-gradient-to-r from-primary to-secondary"
                    >
                      Refresh
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Candidate/Applicant Detail Bottom Sheet */}
      <AnimatePresence>
        {expandedCard && currentItem && (
          <CandidateDetailSheet
            item={currentItem}
            mode={mode}
            onClose={() => setExpandedCard(false)}
          />
        )}
      </AnimatePresence>

      <Navigation />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="super_swipes"
        highlightTier="recruiter_pro"
      />

      {showMatch && (
        <MatchModal
          match={matchData}
          onClose={() => setShowMatch(false)}
          onMessage={() => { setShowMatch(false); navigate('/matches'); }}
        />
      )}

      {/* Pre-Match Message Modal (Enterprise) */}
      <AnimatePresence>
        {showPreMatchMsg && currentItem && mode === 'discover' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPreMatchMsg(false)} />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-md bg-card rounded-2xl p-5 mb-20 sm:mb-0"
            >
              <button onClick={() => setShowPreMatchMsg(false)} className="absolute top-3 right-3 p-2 rounded-full hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold font-['Outfit'] mb-1">Message {currentItem.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">Send a message before matching (Enterprise perk)</p>
              <textarea
                value={preMatchMsgText}
                onChange={(e) => setPreMatchMsgText(e.target.value.slice(0, 500))}
                placeholder="Introduce yourself or describe the opportunity..."
                className="w-full h-24 px-3 py-2 rounded-xl bg-background border border-border text-sm resize-none focus:border-primary/50 outline-none"
              />
              <p className="text-[10px] text-muted-foreground text-right mb-3">{preMatchMsgText.length}/500</p>
              <button
                onClick={async () => {
                  if (!preMatchMsgText.trim()) return;
                  setSendingPreMatch(true);
                  try {
                    await axios.post(`${API}/messages/pre-match`, {
                      seeker_id: currentItem.id,
                      content: preMatchMsgText.trim(),
                      job_id: currentItem.best_match_job_id,
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success('Message sent!');
                    setPreMatchMsgText('');
                    setShowPreMatchMsg(false);
                  } catch (err) {
                    toast.error(err.response?.data?.detail || 'Failed to send');
                  } finally {
                    setSendingPreMatch(false);
                  }
                }}
                disabled={sendingPreMatch || !preMatchMsgText.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm disabled:opacity-50"
              >
                {sendingPreMatch ? 'Sending...' : 'Send Message'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tinder-style bottom sheet for candidate/applicant details
function CandidateDetailSheet({ item, mode, onClose }) {
  const sheetY = useMotionValue(0);
  const sheetOpacity = useTransform(sheetY, [0, 300], [1, 0]);
  const scrollRef = useRef(null);
  const [canDragDown, setCanDragDown] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      setCanDragDown(scrollRef.current.scrollTop <= 0);
    }
  };

  // Normalize fields between applicant mode and candidate mode
  const name = mode === 'applicants' ? item.seeker_name : item.name;
  const title = mode === 'applicants' ? (item.seeker_title || 'Job Seeker') : (item.title || 'Job Seeker');
  const photo = mode === 'applicants'
    ? getPhotoUrl(item.seeker_photo || item.seeker_avatar, name || item.seeker_id)
    : getPhotoUrl(item.photo_url || item.avatar, name || item.id);
  const bio = mode === 'applicants' ? item.seeker_bio : item.bio;
  const skills = mode === 'applicants' ? item.seeker_skills : item.skills;
  const experience = mode === 'applicants' ? item.seeker_experience : item.experience;
  const location = mode === 'applicants' ? item.seeker_location : item.location;
  const school = mode === 'applicants' ? item.seeker_school : item.school;
  const employer = mode === 'applicants' ? item.seeker_current_employer : item.current_employer;
  const degree = mode === 'applicants' ? null : item.degree;
  const matchScore = item.match_score;
  const previousEmployers = mode === 'applicants' ? null : item.previous_employers;
  const certifications = mode === 'applicants' ? null : item.certifications;
  const workPreference = mode === 'applicants' ? null : item.work_preference;
  const desiredSalary = mode === 'applicants' ? null : item.desired_salary;
  const videoUrl = mode === 'applicants' ? item.seeker_video : item.video_url;

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
        style={{ y: sheetY, opacity: sheetOpacity, maxHeight: '85vh' }}
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
        <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto px-6 pb-8" style={{ maxHeight: 'calc(85vh - 28px)' }}>
          {/* Photo + Name Header */}
          <div className="flex items-center gap-4 mb-4">
            <img
              src={photo}
              alt={name}
              className="w-16 h-16 rounded-xl object-cover border-2 border-primary/30"
              onError={handleImgError(name || 'default')}
            />
            <div className="flex-1">
              <h2 className="text-xl font-bold font-['Outfit']">{name}</h2>
              <p className="text-primary text-sm">{title}</p>
              {mode === 'applicants' && item.job_title && (
                <p className="text-muted-foreground text-xs mt-0.5">Applied for: {item.job_title}</p>
              )}
            </div>
            {matchScore != null && (
              <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                matchScore >= 75 ? 'bg-success/20 text-success' :
                matchScore >= 50 ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                {matchScore}%
              </span>
            )}
          </div>

          {/* Also Applied To */}
          {mode === 'applicants' && item.other_applications?.length > 0 && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary flex items-center gap-1 font-medium">
                <Briefcase className="w-3 h-3" /> Also applied to your other {item.other_applications.length === 1 ? 'job' : 'jobs'}:
              </p>
              {item.other_applications.map((a, i) => (
                <p key={i} className="text-sm text-foreground/80 ml-4 mt-0.5">{a.job_title}</p>
              ))}
            </div>
          )}

          {/* Super Like Note */}
          {item.superlike_note && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/20">
              <p className="text-xs text-secondary flex items-center gap-1 mb-0.5 font-medium">
                <MessageSquare className="w-3 h-3" /> Note from applicant
              </p>
              <p className="text-sm text-foreground/90 italic">"{item.superlike_note}"</p>
            </div>
          )}

          {/* Other Applications */}
          {item.other_applications?.length > 0 && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary flex items-center gap-1 mb-1 font-medium">
                <Briefcase className="w-3 h-3" /> Also applied to your other {item.other_applications.length === 1 ? 'job' : 'jobs'}
              </p>
              {item.other_applications.map((oa, i) => (
                <p key={i} className="text-sm text-foreground/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                  {oa.job_title}
                  {oa.action === 'superlike' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">Super Like</span>
                  )}
                </p>
              ))}
            </div>
          )}

          {/* Info Tags */}
          <div className="flex flex-wrap gap-2 mb-5">
            {experience && (
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {experience}+ yrs
              </span>
            )}
            {location && (
              <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {location}
              </span>
            )}
            {school && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {school}
              </span>
            )}
            {employer && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {employer}
              </span>
            )}
            {degree && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm capitalize flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {degree}
              </span>
            )}
          </div>

          {/* Bio */}
          {bio && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{bio}</p>
            </div>
          )}

          {/* Video Introduction */}
          {videoUrl && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground flex items-center gap-1.5">
                <Video className="w-4 h-4 text-primary" /> Video Introduction
              </h3>
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl border border-border"
                style={{ maxHeight: '240px' }}
              />
            </div>
          )}

          {/* Skills */}
          {skills?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Work Preference & Desired Salary (discover mode) */}
          {(workPreference || desiredSalary) && (
            <div className="flex flex-wrap gap-2 mb-5">
              {workPreference && (
                <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm capitalize">
                  Prefers {workPreference}
                </span>
              )}
              {desiredSalary && (
                <span className="px-3 py-1.5 rounded-full bg-success/10 text-success text-sm">
                  Desired: ${Number(desiredSalary).toLocaleString()}/yr
                </span>
              )}
            </div>
          )}

          {/* Previous Employers */}
          {previousEmployers && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Previous Experience</h3>
              <p className="text-sm text-muted-foreground">{previousEmployers}</p>
            </div>
          )}

          {/* Certifications */}
          {certifications && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Certifications</h3>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(certifications) ? certifications : certifications.split(',').map(c => c.trim()).filter(Boolean)).map((cert, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Applied date */}
          {mode === 'applicants' && item.created_at && (
            <div className="text-xs text-muted-foreground">
              Applied {new Date(item.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ApplicantCard({ app, onSwipe, expanded, setExpanded }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);

  // Block downward drag — clamp y to never go positive
  useEffect(() => {
    const unsubscribe = y.on('change', (latest) => {
      if (latest > 0) y.set(0);
    });
    return unsubscribe;
  }, [y]);

  const acceptOpacity = useTransform(x, [0, 60], [0, 1]);
  const rejectOpacity = useTransform(x, [-60, 0], [1, 0]);
  const superlikeOpacity = useTransform(y, [-60, 0], [1, 0]);

  const handleDragEnd = (_, info) => {
    const threshold = 60;
    const velThreshold = 300;
    const superlikeThreshold = 80;

    const pos = { x: x.get(), y: y.get() };
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    // Up = superlike (only if upward movement dominates horizontal)
    if (
      info.offset.y < 0 &&
      absY > absX &&
      (info.offset.y < -superlikeThreshold || info.velocity.y < -velThreshold)
    ) {
      onSwipe('superlike', { x: 0, y: -1500 }, pos);
    } else if (info.offset.x > threshold || info.velocity.x > velThreshold) {
      onSwipe('accept', { x: 1500, y: 0 }, pos);
    } else if (info.offset.x < -threshold || info.velocity.x < -velThreshold) {
      onSwipe('reject', { x: -1500, y: 0 }, pos);
    } else {
      // Spring back
      const startX = x.get();
      const startY = y.get();
      const startTime = Date.now();
      const duration = 200;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        x.set(startX * (1 - ease));
        y.set(startY * (1 - ease));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing z-[5]"
      style={{ x, y, rotate, touchAction: 'none' }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      data-testid="applicant-card"
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
        {/* Full-bleed Photo */}
        <img
          src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
          alt={app.seeker_name}
          className="absolute inset-0 w-full h-full object-cover object-top"
          onError={handleImgError(app.seeker_name || app.seeker_id)}
        />
        {/* Bottom gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 via-[45%] to-transparent" />

        {/* Swipe Indicators */}
        <motion.div
          className="absolute top-8 right-8 px-6 py-2 rounded-full bg-success border-2 border-success font-bold text-white transform rotate-12 z-20"
          style={{ opacity: acceptOpacity }}
        >
          MATCH
        </motion.div>
        <motion.div
          className="absolute top-8 left-8 px-6 py-2 rounded-full bg-destructive border-2 border-destructive font-bold text-white transform -rotate-12 z-20"
          style={{ opacity: rejectOpacity }}
        >
          PASS
        </motion.div>
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-secondary border-2 border-secondary font-bold text-white z-20"
          style={{ opacity: superlikeOpacity }}
        >
          SUPER LIKE
        </motion.div>

        {/* Super Like Badge */}
        {app.action === 'superlike' && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-secondary to-pink-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
            <Star className="w-3 h-3 fill-white" /> Super Like
          </div>
        )}
        {/* Priority Badge for upgraded seekers */}
        {app.is_premium_seeker && app.action !== 'superlike' && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
            <Zap className="w-3 h-3 fill-white" /> Priority
          </div>
        )}

        {/* Content - overlaid on photo */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col px-5 pb-4 pt-8 z-10">
          <h2 className="text-xl font-bold font-['Outfit'] leading-tight text-white drop-shadow-lg">{app.seeker_name}</h2>
          <p className="text-primary text-sm mt-0.5 drop-shadow">{app.seeker_title || 'Job Seeker'}</p>
          <p className="text-white/70 text-xs mt-0.5 drop-shadow">Applied for: {app.job_title}</p>

          {app.superlike_note && (
            <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
              <p className="text-xs text-secondary flex items-center gap-1 font-medium">
                <MessageSquare className="w-3 h-3" /> "{app.superlike_note}"
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {app.seeker_experience && (
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {app.seeker_experience}+ yrs
              </span>
            )}
            {app.seeker_location && (
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {app.seeker_location}
              </span>
            )}
            {app.seeker_school && (
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                {app.seeker_school}
              </span>
            )}
          </div>

          {app.seeker_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {app.seeker_skills.slice(0, 4).map((skill, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-sm text-white/90 text-[11px]">
                  {skill}
                </span>
              ))}
              {app.seeker_skills.length > 4 && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-white/60">
                  +{app.seeker_skills.length - 4}
                </span>
              )}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-white hover:text-white/80 transition-colors mt-3 w-full py-2 rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/20 shrink-0"
            aria-label="Show full profile details"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            View full profile
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CandidateCard({ candidate, onSwipe, expanded, setExpanded }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);

  // Block downward drag — clamp y to never go positive
  useEffect(() => {
    const unsubscribe = y.on('change', (latest) => {
      if (latest > 0) y.set(0);
    });
    return unsubscribe;
  }, [y]);

  const acceptOpacity = useTransform(x, [0, 60], [0, 1]);
  const rejectOpacity = useTransform(x, [-60, 0], [1, 0]);
  const superlikeOpacity = useTransform(y, [-60, 0], [1, 0]);

  const handleDragEnd = (_, info) => {
    const threshold = 60;
    const velThreshold = 300;
    const superlikeThreshold = 80;

    const pos = { x: x.get(), y: y.get() };
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    // Up = superlike (only if upward movement dominates horizontal)
    if (
      info.offset.y < 0 &&
      absY > absX &&
      (info.offset.y < -superlikeThreshold || info.velocity.y < -velThreshold)
    ) {
      onSwipe('superlike', { x: 0, y: -1500 }, pos);
    } else if (info.offset.x > threshold || info.velocity.x > velThreshold) {
      onSwipe('accept', { x: 1500, y: 0 }, pos);
    } else if (info.offset.x < -threshold || info.velocity.x < -velThreshold) {
      onSwipe('reject', { x: -1500, y: 0 }, pos);
    } else {
      // Spring back
      const startX = x.get();
      const startY = y.get();
      const startTime = Date.now();
      const duration = 200;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        x.set(startX * (1 - ease));
        y.set(startY * (1 - ease));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  };

  const matchScore = candidate.match_score || 0;
  const scoreColor = matchScore >= 70 ? 'text-success' : matchScore >= 40 ? 'text-amber-400' : 'text-muted-foreground';

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing z-[5]"
      style={{ x, y, rotate, touchAction: 'none' }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      data-testid="candidate-card"
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
        {/* Full-bleed Photo */}
        <img
          src={getPhotoUrl(candidate.photo_url || candidate.avatar, candidate.id)}
          alt={candidate.name}
          className="absolute inset-0 w-full h-full object-cover object-top"
          onError={handleImgError(candidate.id)}
        />
        {/* Bottom gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 via-[45%] to-transparent" />

        {/* Swipe Indicators */}
        <motion.div
          className="absolute top-8 right-8 px-6 py-2 rounded-full bg-success border-2 border-success font-bold text-white transform rotate-12 z-20"
          style={{ opacity: acceptOpacity }}
        >
          INTERESTED
        </motion.div>
        <motion.div
          className="absolute top-8 left-8 px-6 py-2 rounded-full bg-destructive border-2 border-destructive font-bold text-white transform -rotate-12 z-20"
          style={{ opacity: rejectOpacity }}
        >
          PASS
        </motion.div>
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-secondary border-2 border-secondary font-bold text-white z-20"
          style={{ opacity: superlikeOpacity }}
        >
          SUPER LIKE
        </motion.div>

        {/* Match Score Badge */}
        {candidate.best_match_job && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-xs font-bold flex items-center gap-1 shadow-lg text-white">
            <Sparkles className={`w-3 h-3 ${scoreColor}`} />
            <span className={scoreColor}>{matchScore}%</span> match
          </div>
        )}
        {/* Featured Badge for Premium seekers */}
        {candidate.is_featured && (
          <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
            <Star className="w-3 h-3 fill-white" /> Featured
          </div>
        )}

        {/* Content - overlaid on photo */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col px-5 pb-4 pt-8 z-10">
          <h2 className="text-xl font-bold font-['Outfit'] leading-tight text-white drop-shadow-lg">{candidate.name}</h2>
          <p className="text-primary text-sm mt-0.5 drop-shadow">{candidate.title || 'Job Seeker'}</p>
          {candidate.best_match_job && (
            <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1 drop-shadow">
              <Zap className="w-3 h-3 text-secondary" />
              Best fit: {candidate.best_match_job}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {candidate.experience_years && (
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {candidate.experience_years}+ yrs
              </span>
            )}
            {candidate.location && (
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {candidate.location}
              </span>
            )}
            {candidate.school && (
              <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                {candidate.school}
              </span>
            )}
          </div>

          {candidate.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {candidate.skills.slice(0, 4).map((skill, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-sm text-white/90 text-[11px]">
                  {skill}
                </span>
              ))}
              {candidate.skills.length > 4 && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-white/60">
                  +{candidate.skills.length - 4}
                </span>
              )}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-white hover:text-white/80 transition-colors mt-3 w-full py-2 rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/20 shrink-0"
            aria-label="Show full profile details"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            View full profile
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Card that's been swiped — animates off-screen then disappears
function ExitingRecruiterCard({ card }) {
  const { exitDirection, action, item, mode: cardMode, startX = 0, startY = 0 } = card;
  const startRotate = startX !== 0 ? (startX / 200) * 25 : 0;
  const photoUrl = cardMode === 'applicants'
    ? getPhotoUrl(item.seeker_photo || item.seeker_avatar, item.seeker_id)
    : getPhotoUrl(item.photo_url || item.avatar, item.id);
  const name = cardMode === 'applicants' ? item.seeker_name : item.name;
  const title = cardMode === 'applicants' ? (item.seeker_title || 'Job Seeker') : (item.title || 'Job Seeker');

  return (
    <motion.div
      className="absolute inset-0 z-10 pointer-events-none"
      initial={{ x: startX, y: startY, rotate: startRotate }}
      animate={{
        x: exitDirection.x,
        y: exitDirection.y,
        rotate: exitDirection.x > 0 ? 20 : exitDirection.x < 0 ? -20 : 0,
      }}
      transition={{ duration: 0.25, ease: 'easeIn' }}
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
        <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 via-[45%] to-transparent" />
        {/* Stamp overlay */}
        {action === 'accept' && (
          <div className="absolute top-8 right-8 px-6 py-2 rounded-full bg-success border-2 border-success font-bold text-white transform rotate-12 z-20">MATCH</div>
        )}
        {action === 'reject' && (
          <div className="absolute top-8 left-8 px-6 py-2 rounded-full bg-destructive border-2 border-destructive font-bold text-white transform -rotate-12 z-20">PASS</div>
        )}
        {action === 'superlike' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-secondary border-2 border-secondary font-bold text-white z-20">SUPER SWIPE</div>
        )}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-8 z-10">
          <h2 className="text-2xl font-bold font-['Outfit'] text-white drop-shadow-lg">{name}</h2>
          <p className="text-primary text-sm mt-1 drop-shadow">{title}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Static background cards — show real content so next card is instantly visible
function StaticApplicantCard({ app }) {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
      <img
        src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
        alt={app.seeker_name}
        className="absolute inset-0 w-full h-full object-cover object-top"
        onError={handleImgError(app.seeker_name || app.seeker_id)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 via-[45%] to-transparent" />
      {app.action === 'superlike' && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-secondary to-pink-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
          <Star className="w-3 h-3 fill-white" /> Super Like
        </div>
      )}
      {app.is_premium_seeker && app.action !== 'superlike' && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
          <Zap className="w-3 h-3 fill-white" /> Priority
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-8 z-10">
        <h2 className="text-2xl font-bold font-['Outfit'] text-white drop-shadow-lg">{app.seeker_name}</h2>
        <p className="text-primary text-sm mt-1 drop-shadow">{app.seeker_title || 'Job Seeker'}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {app.seeker_experience && (
            <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {app.seeker_experience}+ yrs
            </span>
          )}
          {app.seeker_location && (
            <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {app.seeker_location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StaticCandidateCard({ candidate }) {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
      <img
        src={getPhotoUrl(candidate.photo_url || candidate.avatar, candidate.id)}
        alt={candidate.name}
        className="absolute inset-0 w-full h-full object-cover object-top"
        onError={handleImgError(candidate.name || candidate.id)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 via-[45%] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-8 z-10">
        <h2 className="text-2xl font-bold font-['Outfit'] text-white drop-shadow-lg">{candidate.name}</h2>
        <p className="text-primary text-sm mt-1 drop-shadow">{candidate.title || 'Job Seeker'}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {candidate.experience_years && (
            <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {candidate.experience_years}+ yrs
            </span>
          )}
          {candidate.location && (
            <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {candidate.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
