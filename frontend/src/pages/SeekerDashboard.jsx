import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Star, Briefcase, MapPin, DollarSign, Building2, Clock, ChevronDown, Filter, SlidersHorizontal, Zap, CheckCircle, Globe, Wifi, Navigation2, Info, Calendar } from 'lucide-react';
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
import UpgradeModal from '../components/UpgradeModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── Persistent swipe storage (survives page reloads) ─────────────────────
// Tinder-style: all swipe state lives in localStorage so a page refresh never
// loses data.  The API is the source of truth; localStorage is the fast cache.

const STORAGE_KEYS = {
  SWIPED_IDS: 'hireabble_swiped_ids',
  STATS: 'hireabble_swipe_stats',
  SWIPE_QUEUE: 'hireabble_swipe_queue',   // failed swipes waiting to retry
  SUPER_LIKES: 'hireabble_superlikes_remaining',
};

function loadSwipedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SWIPED_IDS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSwipedIds(ids) {
  try { localStorage.setItem(STORAGE_KEYS.SWIPED_IDS, JSON.stringify([...ids])); } catch { /* quota */ }
}

function loadCachedStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCachedStats(stats) {
  try { localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats)); } catch { /* quota */ }
}

function loadSwipeQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SWIPE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSwipeQueue(queue) {
  try { localStorage.setItem(STORAGE_KEYS.SWIPE_QUEUE, JSON.stringify(queue)); } catch { /* quota */ }
}

function loadCachedSuperLikes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPER_LIKES);
    return raw != null ? parseInt(raw, 10) : 0;
  } catch { return 0; }
}

function saveCachedSuperLikes(n) {
  try { localStorage.setItem(STORAGE_KEYS.SUPER_LIKES, String(n)); } catch { /* quota */ }
}

// Module-level: persists across component mounts so in-flight swipes
// from a previous navigation are not lost when the component remounts.
let globalPendingSwipes = [];

export default function SeekerDashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  // Initialize stats from localStorage — prevents "flash of zeros"
  const [stats, setStats] = useState(() => loadCachedStats() || { applications_sent: 0, super_likes_used: 0, matches: 0 });
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [expandedCard, setExpandedCard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [superLikesRemaining, setSuperLikesRemaining] = useState(() => loadCachedSuperLikes());
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [exitingCards, setExitingCards] = useState([]); // cards animating off-screen
  const fetchingMoreRef = useRef(false);
  // Seed from localStorage so swiped jobs stay excluded even after F5
  const swipedIdsRef = useRef(loadSwipedIds());
  const pendingSwipesRef = useRef(globalPendingSwipes); // track in-flight swipe API calls
  const tokenRef = useRef(token); // stable ref for sendBeacon / beforeunload
  tokenRef.current = token;
  const [filters, setFilters] = useState({
    job_type: '',
    experience_level: '',
    salary_min: '',
    location: '',
    remote_only: false,
    category: '',
    employment_type: ''
  });
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // ─── Retry queue: flush any swipes that failed on a previous page load ───
  const flushSwipeQueue = useCallback(async () => {
    const queue = loadSwipeQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        await axios.post(`${API}/swipe`, { job_id: item.job_id, action: item.action }, {
          headers: { Authorization: `Bearer ${tokenRef.current}` }, timeout: 10000,
        });
      } catch (err) {
        const status = err.response?.status;
        const detail = (err.response?.data?.detail || '').toLowerCase();
        // 400 "already swiped" or 404 "job not found" = discard, not retriable
        if (status === 400 && detail.includes('already swiped')) continue;
        if (status === 404) continue;
        remaining.push(item); // keep for next attempt
      }
    }
    saveSwipeQueue(remaining);
  }, []);

  // ─── Batched dashboard: single API call replaces 6+ separate requests ───
  const fetchDashboard = useCallback(async (retry = 0) => {
    // Wait for any in-flight swipes to finish so DB counts are accurate
    if (globalPendingSwipes.length > 0) {
      await Promise.allSettled(globalPendingSwipes);
      globalPendingSwipes = [];
      pendingSwipesRef.current = globalPendingSwipes;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API}/dashboard`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        timeout: 15000,
      });
      const data = response.data;

      // Merge server swiped IDs with any we already have locally (in case
      // the server write for a recent swipe hasn't propagated yet)
      if (data.swiped_job_ids) {
        const merged = new Set([...swipedIdsRef.current, ...data.swiped_job_ids]);
        swipedIdsRef.current = merged;
        saveSwipedIds(merged);
      }

      // Filter out any jobs the client already knows are swiped (handles the
      // race where localStorage has an ID the server query hasn't seen yet)
      const safeJobs = data.jobs.filter(j => !swipedIdsRef.current.has(j.id));
      setJobs(safeJobs);
      setCurrentIndex(0);

      // Stats: use server values (source of truth) and cache locally
      setStats(data.stats);
      saveCachedStats(data.stats);
      setProfileComplete(data.completeness.is_complete);
      setSuperLikesRemaining(data.superlikes.remaining);
      saveCachedSuperLikes(data.superlikes.remaining);
    } catch (error) {
      // Auto-retry once on timeout/network errors before falling back
      if (retry < 1 && (!error.response || error.code === 'ECONNABORTED')) {
        return fetchDashboard(retry + 1);
      }
      console.error('Failed to fetch dashboard:', error);
      // Fallback: try fetching stats and jobs separately so UI isn't stuck at zeros
      try {
        const opts = { headers: { Authorization: `Bearer ${tokenRef.current}` }, timeout: 10000 };
        const [jobsRes, statsRes, slRes] = await Promise.all([
          axios.get(`${API}/jobs`, opts),
          axios.get(`${API}/stats`, opts),
          axios.get(`${API}/superlikes/remaining`, opts),
        ]);
        // Exclude locally-known swiped jobs
        const safeJobs = jobsRes.data.filter(j => !swipedIdsRef.current.has(j.id));
        setJobs(safeJobs);
        setCurrentIndex(0);
        setStats(statsRes.data);
        saveCachedStats(statsRes.data);
        setSuperLikesRemaining(slRes.data.remaining);
        saveCachedSuperLikes(slRes.data.remaining);
      } catch (fallbackErr) {
        console.error('Fallback fetch also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: flush retry queue then fetch dashboard
  useEffect(() => {
    flushSwipeQueue().then(() => fetchDashboard());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket listener for async match notifications (matches are detected in background)
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
            setStats(prev => {
              const next = { ...prev, matches: prev.matches + 1 };
              saveCachedStats(next);
              return next;
            });
            setMatchData(data.match);
            setShowMatch(true);
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onerror = () => {};
    } catch { /* ignore connection errors */ }
    return () => { if (ws) ws.close(); };
  }, [token]);

  // sendBeacon fallback: if the user closes the tab, fire any queued swipes
  // via sendBeacon (reliable even during page unload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Use sendBeacon for any pending swipes in the retry queue
      const queue = loadSwipeQueue();
      if (queue.length > 0 && navigator.sendBeacon) {
        for (const item of queue) {
          try {
            const payload = JSON.stringify({ job_id: item.job_id, action: item.action });
            navigator.sendBeacon(
              `${API}/swipe/beacon?token=${encodeURIComponent(tokenRef.current)}`,
              new Blob([payload], { type: 'application/json' })
            );
          } catch { /* best effort */ }
        }
      }
      // Warn if there are still in-flight swipes
      if (pendingSwipesRef.current.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    // Count active filters
    const count = Object.entries(filters).filter(([k, v]) =>
      k === 'remote_only' ? v === true : v !== ''
    ).length;
    setActiveFiltersCount(count);
  }, [filters]);

  const fetchJobs = async (filterParams = filters, append = false) => {
    if (!append) setLoading(true);
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
      if (filterParams.category) params.append('category', filterParams.category);
      if (filterParams.employment_type) params.append('employment_type', filterParams.employment_type);
      // When appending, skip jobs we already have (backend excludes swiped, so skip loaded-but-unswiped)
      if (append) {
        const unswipedCount = jobs.length - currentIndex;
        if (unswipedCount > 0) params.append('skip', String(unswipedCount));
      }

      const url = `${API}/jobs${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (append) {
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          // Also exclude any jobs the client already swiped on
          const newJobs = response.data.filter(j => !existingIds.has(j.id) && !swipedIdsRef.current.has(j.id));
          return [...prev, ...newJobs];
        });
      } else {
        // Exclude locally-known swiped jobs (handles race with server)
        const safeJobs = response.data.filter(j => !swipedIdsRef.current.has(j.id));
        setJobs(safeJobs);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const prefetchJobs = useCallback(() => {
    if (fetchingMoreRef.current) return;
    fetchingMoreRef.current = true;
    fetchJobs(filters, true).finally(() => { fetchingMoreRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Preload images for the next few cards so swipes feel instant
  useEffect(() => {
    const upcoming = jobs.slice(currentIndex, currentIndex + 5);
    upcoming.forEach((job) => {
      if (job.background_image) {
        const img = new Image();
        img.src = job.background_image;
      }
      if (job.company_logo) {
        const img = new Image();
        img.src = job.company_logo;
      }
    });
  }, [currentIndex, jobs]);

  const handleSwipe = (action, exitDirection = { x: 0, y: 0 }, dragPos = { x: 0, y: 0 }) => {
    if (currentIndex >= jobs.length) return;

    // Check super like limit before sending - show paywall
    if (action === 'superlike' && superLikesRemaining <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    const job = jobs[currentIndex];

    // Prevent double-swiping the same job
    if (swipedIdsRef.current.has(job.id)) return;
    swipedIdsRef.current.add(job.id);
    // Persist to localStorage immediately — survives F5
    saveSwipedIds(swipedIdsRef.current);

    // Advance index IMMEDIATELY — next card is already visible in the stack
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setExpandedCard(false);

    // Add to exiting cards — start from where the user released the drag
    setExitingCards(prev => [...prev, { job, action, exitDirection, id: job.id, startX: dragPos.x, startY: dragPos.y }]);

    // Clean up exiting cards after animation completes
    setTimeout(() => {
      setExitingCards(prev => prev.filter(c => c.id !== job.id));
    }, 500);

    // Optimistically update stats immediately so UI feels instant
    if (action === 'like') {
      setStats(prev => {
        const next = { ...prev, applications_sent: prev.applications_sent + 1 };
        saveCachedStats(next);
        return next;
      });
    } else if (action === 'superlike') {
      setStats(prev => {
        const next = { ...prev, super_likes_used: prev.super_likes_used + 1 };
        saveCachedStats(next);
        return next;
      });
      setSuperLikesRemaining(prev => {
        const next = Math.max(0, prev - 1);
        saveCachedSuperLikes(next);
        return next;
      });
    }

    // Fire-and-forget API call — don't block the UI
    const sendSwipe = (retryCount = 0) => axios.post(`${API}/swipe`,
      { job_id: job.id, action },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    ).then(response => {
      if (action === 'superlike' && response.data.remaining_superlikes != null) {
        setSuperLikesRemaining(response.data.remaining_superlikes);
        saveCachedSuperLikes(response.data.remaining_superlikes);
      }
      // Swipe saved successfully — remove from retry queue if present
      const queue = loadSwipeQueue().filter(q => q.job_id !== job.id);
      saveSwipeQueue(queue);
    }).catch(error => {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || '';
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      // "Already swiped" is fine — stale-data edge case, not a user mistake
      if (status === 400 && detail.toLowerCase().includes('already swiped')) {
        return;
      }

      // "Job not found" means the job was deleted while the card was loaded
      if (status === 404 && detail.toLowerCase().includes('job not found')) {
        return;
      }

      // Retry twice on server/network errors (500, timeout, network failure)
      if (retryCount < 2 && (!status || status >= 500 || isTimeout)) {
        const delay = 1500 * Math.pow(2, retryCount); // 1.5s, 3s
        return new Promise(resolve => setTimeout(resolve, delay)).then(() => sendSwipe(retryCount + 1));
      }

      // Timeouts after retry: swipe likely saved (DB write happens early), don't alarm the user
      if (isTimeout) {
        return;
      }

      // All retries exhausted — persist to retry queue so it can be retried
      // on next page load (Tinder-style offline queue)
      if (!status || status >= 500) {
        const queue = loadSwipeQueue();
        if (!queue.some(q => q.job_id === job.id)) {
          queue.push({ job_id: job.id, action, ts: Date.now() });
          saveSwipeQueue(queue);
        }
        return; // don't revert stats — the swipe will be retried
      }

      // Revert optimistic stat update on permanent failure (4xx errors)
      if (action === 'like') {
        setStats(prev => {
          const next = { ...prev, applications_sent: Math.max(0, prev.applications_sent - 1) };
          saveCachedStats(next);
          return next;
        });
      } else if (action === 'superlike') {
        setStats(prev => {
          const next = { ...prev, super_likes_used: Math.max(0, prev.super_likes_used - 1) };
          saveCachedStats(next);
          return next;
        });
        setSuperLikesRemaining(prev => {
          const next = prev + 1;
          saveCachedSuperLikes(next);
          return next;
        });
      }

      // Also remove from swiped IDs so the job can be re-swiped
      swipedIdsRef.current.delete(job.id);
      saveSwipedIds(swipedIdsRef.current);

      const msg = detail || 'Failed to save swipe';
      toast.error(msg);
    });

    const swipePromise = sendSwipe().finally(() => {
      pendingSwipesRef.current = pendingSwipesRef.current.filter(p => p !== swipePromise);
      globalPendingSwipes = globalPendingSwipes.filter(p => p !== swipePromise);
    });
    pendingSwipesRef.current.push(swipePromise);
    globalPendingSwipes.push(swipePromise);

    // Auto-fetch more jobs when running low (5 cards buffer) - endless Tinder-style
    if (nextIndex >= jobs.length - 5) {
      prefetchJobs();
    }
  };

  const handleApplyFilters = () => {
    fetchJobs(filters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const clearedFilters = { job_type: '', experience_level: '', salary_min: '', location: '', remote_only: false, category: '', employment_type: '' };
    setFilters(clearedFilters);
    fetchJobs(clearedFilters);
    setShowFilters(false);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          if (city) {
            setFilters(prev => ({ ...prev, location: city }));
            toast.success(`Location: ${city}`);
          }
        } catch { /* ignore */ } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        toast.error('Location access denied');
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
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
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      {/* Background Effects — reduced blur for mobile perf */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none will-change-transform">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Hi, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-muted-foreground">Find your dream job</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => navigate('/interviews')}
              className="p-2 rounded-xl hover:bg-accent transition-colors"
              title="Interviews"
            >
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </button>
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
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full border-2 border-primary object-cover cursor-pointer hover:opacity-80 transition-opacity"
            />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          <button onClick={() => navigate('/applied')} className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap hover:border-primary/30 transition-colors text-left">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.applications_sent}</div>
              <div className="text-xs text-muted-foreground">Applied</div>
            </div>
          </button>
          <div className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <div className="text-xl font-bold">{stats.super_likes_used}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                Super Likes
                <span className="relative group">
                  <Info className="w-3 h-3 cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-foreground text-background text-xs w-48 text-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    Super Likes put you at the top of recruiters' queues! You get 3 free daily, or purchase more.
                  </span>
                </span>
              </div>
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
        {/* Profile Completion Prompt */}
        {!profileComplete && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Complete your profile to match with more businesses!</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add your skills, experience, and photo to get better matches.</p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/profile')}
                className="rounded-full bg-primary/90 hover:bg-primary text-xs px-3 shrink-0"
              >
                Complete
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Swipe Area */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-md mx-auto">
          {currentJob ? (
            <>
              {/* Card Stack */}
              <div className="relative aspect-[3/4] card-stack overflow-hidden" data-testid="swipe-deck">
                {/* Background cards — real job cards for instant reveal */}
                {jobs.slice(currentIndex + 1, currentIndex + 3).map((bgJob, i) => (
                  <div
                    key={bgJob.id}
                    className="absolute inset-0 rounded-3xl overflow-hidden"
                    style={{
                      transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 12}px)`,
                      zIndex: -(i + 1),
                    }}
                  >
                    <StaticJobCard job={bgJob} />
                  </div>
                ))}

                {/* Exiting cards (animating off-screen) */}
                {exitingCards.map((card) => (
                  <ExitingCard key={`exit-${card.id}`} card={card} />
                ))}

                {/* Main Swipeable Card */}
                <SwipeCard
                  key={currentJob.id}
                  job={currentJob}
                  onSwipe={handleSwipe}
                  expanded={expandedCard}
                  setExpanded={setExpandedCard}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center items-center gap-5 mt-8">
                <button
                  onClick={() => handleSwipe('pass', { x: -1500, y: 0 })}
                  className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center hover:scale-110 hover:neon-glow-red transition-all duration-300"
                  data-testid="pass-btn"
                >
                  <X className="w-7 h-7 text-destructive" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => handleSwipe('superlike', { x: 0, y: -1500 })}
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
                  onClick={() => handleSwipe('like', { x: 1500, y: 0 })}
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
                  onClick={async () => {
                    // Wait for any in-flight swipes to persist before refreshing
                    const allPending = [...new Set([...pendingSwipesRef.current, ...globalPendingSwipes])];
                    if (allPending.length > 0) {
                      await Promise.allSettled(allPending);
                      globalPendingSwipes = [];
                      pendingSwipesRef.current = [];
                    }
                    // Also flush retry queue before fetching new jobs
                    await flushSwipeQueue();
                    // DO NOT clear swipedIdsRef — swiped jobs must never reappear
                    fetchDashboard();
                  }}
                  className="rounded-full bg-gradient-to-r from-primary to-secondary"
                  data-testid="refresh-jobs-btn"
                >
                  Check for New Jobs
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Filter Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md bg-card border-border max-h-[85vh] overflow-y-auto">
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
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingLocation}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm"
              >
                {detectingLocation ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation2 className="w-3.5 h-3.5" />
                )}
                {detectingLocation ? 'Detecting...' : 'Use my current location'}
              </button>
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
              <Label>Category</Label>
              <Select
                value={filters.category || "all"}
                onValueChange={(v) => setFilters({ ...filters, category: v === "all" ? "" : v })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select
                value={filters.employment_type || "all"}
                onValueChange={(v) => setFilters({ ...filters, employment_type: v === "all" ? "" : v })}
              >
                <SelectTrigger className="h-11 rounded-xl bg-background">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
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
          onMessage={() => { setShowMatch(false); navigate('/matches'); }}
        />
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="super_likes"
        highlightTier="seeker_plus"
      />
    </div>
  );
}

const formatSalary = (min, max) => {
  if (!min && !max) return null;
  const format = (n) => n >= 1000 ? `$${Math.round(n/1000)}k` : `$${n}`;
  if (min && max) return `${format(min)} - ${format(max)}`;
  if (min) return `${format(min)}+`;
  return `Up to ${format(max)}`;
};

// Static card for the background stack — memoized to avoid re-renders on every swipe
const StaticJobCard = memo(function StaticJobCard({ job }) {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
      <div className="absolute inset-0">
        <img src={job.background_image} alt="Background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
      </div>
      {job.is_boosted && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
          <Zap className="w-3 h-3" /> Promoted
        </div>
      )}
      <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
        <div className="flex items-center gap-3 mb-4">
          <img src={job.company_logo} alt={job.company} className="w-12 h-12 rounded-xl object-cover border border-white/20" />
          <div>
            <div className="text-sm text-muted-foreground">{job.company}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(job.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold font-['Outfit'] mb-3">{job.title}</h2>
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
        </div>
      </div>
    </div>
  );
});

// Card that's been swiped — animates off-screen from where user released it
function ExitingCard({ card }) {
  const { exitDirection, action, startX = 0, startY = 0 } = card;
  const startRotate = startX !== 0 ? (startX / 200) * 25 : 0;
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
        <div className="absolute inset-0">
          <img src={card.job.background_image} alt="Background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
        </div>
        {/* Stamp overlay */}
        {action === 'like' && (
          <div className="absolute top-8 right-8 px-6 py-2 rounded-full bg-success border-2 border-success font-bold text-white transform rotate-12 z-20">APPLY</div>
        )}
        {action === 'pass' && (
          <div className="absolute top-8 left-8 px-6 py-2 rounded-full bg-destructive border-2 border-destructive font-bold text-white transform -rotate-12 z-20">PASS</div>
        )}
        {action === 'superlike' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-secondary border-2 border-secondary font-bold text-white z-20">SUPER LIKE</div>
        )}
        <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
          <h2 className="text-2xl font-bold font-['Outfit'] mb-3">{card.job.title}</h2>
        </div>
      </div>
    </motion.div>
  );
}

function SwipeCard({ job, onSwipe, expanded, setExpanded }) {
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

  // Indicator opacities
  const likeOpacity = useTransform(x, [0, 60], [0, 1]);
  const passOpacity = useTransform(x, [-60, 0], [1, 0]);
  const superlikeOpacity = useTransform(y, [-60, 0], [1, 0]);

  const handleDragEnd = (_, info) => {
    const swipeThreshold = 60;
    const velocityThreshold = 300;
    const superlikeThreshold = 80; // Higher threshold for superlike to prevent accidental triggers
    const pos = { x: x.get(), y: y.get() };

    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    // Up = superlike (only if upward movement is dominant over horizontal)
    // Right = like, Left = pass. Down is blocked entirely.
    if (
      info.offset.y < 0 &&
      absY > absX &&
      (info.offset.y < -superlikeThreshold || info.velocity.y < -velocityThreshold)
    ) {
      onSwipe('superlike', { x: 0, y: -1500 }, pos);
    } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      onSwipe('like', { x: 1500, y: 0 }, pos);
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      onSwipe('pass', { x: -1500, y: 0 }, pos);
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
      whileTap={{ cursor: 'grabbing' }}
      data-testid="job-card"
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img src={job.background_image} alt="Background" className="w-full h-full object-cover" />
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

        {/* Promoted Badge */}
        {job.is_boosted && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
            <Zap className="w-3 h-3" /> Promoted
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
          <div className="flex items-center gap-3 mb-4">
            <img src={job.company_logo} alt={job.company} className="w-12 h-12 rounded-xl object-cover border border-white/20" />
            <div>
              <div className="text-sm text-muted-foreground">{job.company}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(job.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-2xl md:text-3xl font-bold font-['Outfit']">{job.title}</h2>
            {job.match_score != null && (
              <span className={`shrink-0 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                job.match_score >= 75 ? 'bg-success/20 text-success' :
                job.match_score >= 50 ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                <Star className="w-3.5 h-3.5" />
                {job.match_score}%
              </span>
            )}
          </div>

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
