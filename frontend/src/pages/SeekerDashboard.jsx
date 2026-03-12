import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Star, Briefcase, MapPin, DollarSign, Building2, Clock, ChevronDown, Filter, SlidersHorizontal, Zap, CheckCircle, Globe, Wifi, Navigation2, Info, Calendar, Undo2, Eye, EyeOff, Rocket, Crown, Sparkles, Lock, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import NotificationBell from '../components/NotificationBell';
import MatchModal from '../components/MatchModal';
import { isPushSupported, getPermissionStatus, subscribeToPush } from '../utils/pushNotifications';
import { shouldPromptRating, dismissRatingPrompt, getStoreUrl } from '../utils/appRating';
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
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import UpgradeModal from '../components/UpgradeModal';
import { SkeletonPageBackground, SkeletonStatCard, SkeletonSwipeCard, SkeletonActionButtons } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── Persistent swipe storage (survives page reloads) ─────────────────────
// Tinder-style: all swipe state lives in localStorage so a page refresh never
// loses data.  The API is the source of truth; localStorage is the fast cache.

// Storage keys are scoped by user ID so impersonating different users
// doesn't bleed cached swipe data between accounts.
function storageKey(userId, suffix) {
  return userId ? `hireabble_${suffix}_${userId}` : `hireabble_${suffix}`;
}

// Resolve current user ID from cached_user in localStorage (available before React mounts)
function getCachedUserId() {
  try {
    const cached = localStorage.getItem('cached_user');
    return cached ? JSON.parse(cached).id : null;
  } catch { return null; }
}

function loadSwipedIds(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId, 'swiped_ids'));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveSwipedIds(ids, userId) {
  try { localStorage.setItem(storageKey(userId, 'swiped_ids'), JSON.stringify([...ids])); } catch { /* quota */ }
}

function loadCachedStats(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId, 'swipe_stats'));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCachedStats(stats, userId) {
  try { localStorage.setItem(storageKey(userId, 'swipe_stats'), JSON.stringify(stats)); } catch { /* quota */ }
}

// Merge server stats with cached optimistic increments.
// The cache stores the number of optimistic bumps made since the last server sync.
// When the server responds, we add any pending increments on top of the server
// baseline, then reset the pending count.  This prevents the inflated-count bug
// where MAX(server, local) would permanently latch to a stale high value.
function mergeStatsWithCache(serverStats, userId) {
  const cached = loadCachedStats(userId);
  if (!cached || !cached._pending) {
    // No pending optimistic increments — trust the server completely
    // Store server values as baseline with zero pending
    const merged = {
      applications_sent: serverStats.applications_sent || 0,
      super_likes_used: serverStats.super_likes_used || 0,
      matches: serverStats.matches || 0,
      _pending: { applications_sent: 0, super_likes_used: 0, matches: 0 },
      _serverBaseline: { ...serverStats },
    };
    saveCachedStats(merged, userId);
    return merged;
  }
  // We have pending optimistic bumps — add them to the server baseline.
  // If the server already caught up (server >= baseline + pending), reset pending.
  const pending = cached._pending;
  const baseline = cached._serverBaseline || {};
  const result = {
    applications_sent: serverStats.applications_sent || 0,
    super_likes_used: serverStats.super_likes_used || 0,
    matches: serverStats.matches || 0,
    _pending: { applications_sent: 0, super_likes_used: 0, matches: 0 },
    _serverBaseline: { ...serverStats },
  };
  // Only add pending if server hasn't caught up yet
  for (const key of ['applications_sent', 'super_likes_used', 'matches']) {
    const serverCaughtUp = (serverStats[key] || 0) >= ((baseline[key] || 0) + (pending[key] || 0));
    if (!serverCaughtUp) {
      const gap = ((baseline[key] || 0) + (pending[key] || 0)) - (serverStats[key] || 0);
      result[key] += Math.max(0, gap);
      result._pending[key] = Math.max(0, gap);
    }
  }
  return result;
}

function loadSwipeQueue(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId, 'swipe_queue'));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSwipeQueue(queue, userId) {
  try { localStorage.setItem(storageKey(userId, 'swipe_queue'), JSON.stringify(queue)); } catch { /* quota */ }
}

function loadCachedSuperLikes(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId, 'superlikes_remaining'));
    return raw != null ? parseInt(raw, 10) : 0;
  } catch { return 0; }
}

function saveCachedSuperLikes(n, userId) {
  try { localStorage.setItem(storageKey(userId, 'superlikes_remaining'), String(n)); } catch { /* quota */ }
}

// Module-level: persists across component mounts so in-flight swipes
// from a previous navigation are not lost when the component remounts.
let globalPendingSwipes = [];

export default function SeekerDashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const uid = user?.id || getCachedUserId();
  const [jobs, setJobs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  // Initialize stats from localStorage — prevents "flash of zeros"
  const [stats, setStats] = useState(() => loadCachedStats(uid) || { applications_sent: 0, super_likes_used: 0, matches: 0, profile_views: 0 });
  const [premiumFeatures, setPremiumFeatures] = useState({});
  const [incognitoActive, setIncognitoActive] = useState(false);
  const [boostActiveUntil, setBoostActiveUntil] = useState(null);
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [expandedCard, setExpandedCard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [superLikesRemaining, setSuperLikesRemaining] = useState(() => loadCachedSuperLikes(uid));
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalTrigger, setUpgradeModalTrigger] = useState(null);
  const [exitingCards, setExitingCards] = useState([]); // cards animating off-screen
  const [canUndo, setCanUndo] = useState(false); // subscription allows undo
  const [undoing, setUndoing] = useState(false);
  const [topPicks, setTopPicks] = useState([]);
  const [superlikeNote, setSuperlikeNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [enteringCard, setEnteringCard] = useState(null); // card animating back in (undo)
  const [undoCounter, setUndoCounter] = useState(0); // forces SwipeCard remount after undo
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [upgradeTrigger, setUpgradeTrigger] = useState('super_likes'); // what triggered upgrade modal
  const lastSwipedRef = useRef(null); // track last swiped card for undo animation
  const swipeInFlightRef = useRef(false); // true while a swipe API call is pending (prevents WS race)
  const fetchingMoreRef = useRef(false);
  // Seed from localStorage so swiped jobs stay excluded even after F5
  const swipedIdsRef = useRef(loadSwipedIds(uid));
  const pendingSwipesRef = useRef(globalPendingSwipes); // track in-flight swipe API calls
  const tokenRef = useRef(token); // stable ref for sendBeacon / beforeunload
  tokenRef.current = token;
  const uidRef = useRef(uid);
  uidRef.current = uid;
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
    const queue = loadSwipeQueue(uidRef.current);
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
    saveSwipeQueue(remaining, uidRef.current);
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
        saveSwipedIds(merged, uidRef.current);
      }

      // Filter out any jobs the client already knows are swiped (handles the
      // race where localStorage has an ID the server query hasn't seen yet)
      const safeJobs = data.jobs.filter(j => !swipedIdsRef.current.has(j.id));
      setJobs(safeJobs);
      setCurrentIndex(0);

      // Stats: merge server values with cached optimistic counts so fast
      // swiping never causes counts to regress while the backend catches up
      const merged = mergeStatsWithCache(data.stats, uidRef.current);
      setStats(merged);
      saveCachedStats(merged, uidRef.current);
      setProfileComplete(data.completeness.is_complete);
      setSuperLikesRemaining(data.superlikes.remaining);
      saveCachedSuperLikes(data.superlikes.remaining, uidRef.current);
      if (data.can_undo != null) setCanUndo(data.can_undo);
      if (data.premium_features) setPremiumFeatures(data.premium_features);
      if (data.incognito_active != null) setIncognitoActive(data.incognito_active);
      if (data.boost_active_until != null) setBoostActiveUntil(data.boost_active_until);
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
        const mergedFallback = mergeStatsWithCache(statsRes.data, uidRef.current);
        setStats(mergedFallback);
        saveCachedStats(mergedFallback, uidRef.current);
        setSuperLikesRemaining(slRes.data.remaining);
        saveCachedSuperLikes(slRes.data.remaining, uidRef.current);
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

  // Check if we should prompt for app store rating (after 5 sessions + 1 match)
  useEffect(() => {
    const timer = setTimeout(() => {
      const cachedStats = loadCachedStats(uidRef.current);
      const matchCount = cachedStats?.matches || 0;
      if (shouldPromptRating(matchCount)) {
        const storeUrl = getStoreUrl();
        if (storeUrl) {
          toast('Enjoying Hireabble?', {
            description: 'A quick rating helps us reach more job seekers!',
            action: { label: 'Rate us', onClick: () => { dismissRatingPrompt(); window.open(storeUrl, '_blank'); } },
            cancel: { label: 'Not now', onClick: dismissRatingPrompt },
            duration: 10000,
          });
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch saved job IDs for bookmark state
  useEffect(() => {
    axios.get(`${API}/jobs/saved/ids`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    }).then(res => setSavedJobIds(new Set(res.data.job_ids))).catch(() => {});
  }, []);

  const toggleSaveJob = useCallback(async (jobId) => {
    const isSaved = savedJobIds.has(jobId);
    // Optimistic update
    setSavedJobIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(jobId); else next.add(jobId);
      return next;
    });
    try {
      if (isSaved) {
        await axios.delete(`${API}/jobs/${jobId}/save`, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
      } else {
        await axios.post(`${API}/jobs/${jobId}/save`, {}, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
        toast.success('Job saved!');
      }
    } catch {
      // Revert on error
      setSavedJobIds(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(jobId); else next.delete(jobId);
        return next;
      });
    }
  }, [savedJobIds]);

  // Fetch top picks for premium subscribers
  useEffect(() => {
    if (premiumFeatures.top_picks) {
      axios.get(`${API}/top-picks`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      }).then(res => setTopPicks(res.data.picks || [])).catch(() => {});
    }
  }, [premiumFeatures.top_picks]);

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
            // Skip if a swipe API call is in-flight — the API response
            // will set the correct match data (avoids stale WS data flash)
            if (swipeInFlightRef.current) return;
            // Only show modal if not already showing one
            setShowMatch(prev => {
              if (prev) return prev; // already showing a match modal
              setStats(s => {
                const next = { ...s, matches: s.matches + 1 };
                saveCachedStats(next, uidRef.current);
                return next;
              });
              setMatchData(data.match);
              return true;
            });
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onerror = () => {};
    } catch { /* ignore connection errors */ }
    return () => { if (ws) ws.close(); };
  }, [token]);

  // Refresh stats when user returns to this page (e.g. after applying from
  // a company page or switching tabs).  Only refreshes counts — doesn't
  // reload the job deck, so the swipe position is preserved.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        axios.get(`${API}/stats`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          timeout: 5000,
        }).then(res => {
          const mergedVis = mergeStatsWithCache(res.data, uidRef.current);
          setStats(mergedVis);
          saveCachedStats(mergedVis, uidRef.current);
        }).catch(() => { /* ignore - stats will catch up on next full fetch */ });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // sendBeacon fallback: if the user closes the tab, fire any queued swipes
  // via sendBeacon (reliable even during page unload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Use sendBeacon for any pending swipes in the retry queue
      const queue = loadSwipeQueue(uidRef.current);
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
      setUpgradeTrigger('super_likes');
      setShowUpgradeModal(true);
      return;
    }

    const job = jobs[currentIndex];

    // Prevent double-swiping the same job
    if (swipedIdsRef.current.has(job.id)) return;
    swipedIdsRef.current.add(job.id);
    // Persist to localStorage immediately — survives F5
    saveSwipedIds(swipedIdsRef.current, uidRef.current);

    // Advance index IMMEDIATELY — next card is already visible in the stack
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setExpandedCard(false);

    // Track last swiped card for undo animation
    lastSwipedRef.current = { job, action, exitDirection };

    // Add to exiting cards — start from where the user released the drag
    setExitingCards(prev => [...prev, { job, action, exitDirection, id: job.id, startX: dragPos.x, startY: dragPos.y }]);

    // Clean up exiting cards after animation completes
    setTimeout(() => {
      setExitingCards(prev => prev.filter(c => c.id !== job.id));
    }, 500);

    // Optimistically update stats immediately so UI feels instant
    if (action === 'like') {
      setStats(prev => {
        const pending = prev._pending || { applications_sent: 0, super_likes_used: 0, matches: 0 };
        const next = {
          ...prev,
          applications_sent: prev.applications_sent + 1,
          _pending: { ...pending, applications_sent: (pending.applications_sent || 0) + 1 },
        };
        saveCachedStats(next, uidRef.current);
        return next;
      });
    } else if (action === 'superlike') {
      setStats(prev => {
        const pending = prev._pending || { applications_sent: 0, super_likes_used: 0, matches: 0 };
        const next = {
          ...prev,
          applications_sent: prev.applications_sent + 1,
          super_likes_used: prev.super_likes_used + 1,
          _pending: {
            ...pending,
            applications_sent: (pending.applications_sent || 0) + 1,
            super_likes_used: (pending.super_likes_used || 0) + 1,
          },
        };
        saveCachedStats(next, uidRef.current);
        return next;
      });
      setSuperLikesRemaining(prev => {
        const next = Math.max(0, prev - 1);
        saveCachedSuperLikes(next, uidRef.current);
        return next;
      });
    }

    // Fire-and-forget API call — don't block the UI
    const swipePayload = { job_id: job.id, action };
    // Attach note for premium super likes
    if (action === 'superlike' && superlikeNote.trim() && premiumFeatures.superlike_notes) {
      swipePayload.note = superlikeNote.trim().slice(0, 140);
    }
    if (action === 'superlike') { setSuperlikeNote(''); setShowNoteInput(false); }

    swipeInFlightRef.current = true;
    const sendSwipe = (retryCount = 0) => axios.post(`${API}/swipe`,
      swipePayload,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    ).then(response => {
      swipeInFlightRef.current = false;
      if (action === 'superlike' && response.data.remaining_superlikes != null) {
        setSuperLikesRemaining(response.data.remaining_superlikes);
        saveCachedSuperLikes(response.data.remaining_superlikes, uidRef.current);
      }
      // Show "It's a Match!" modal if the API returned match data
      if (response.data.match) {
        setStats(prev => {
          const next = { ...prev, matches: prev.matches + 1 };
          saveCachedStats(next, uidRef.current);
          return next;
        });
        setMatchData(response.data.match);
        setShowMatch(true);
      }
      // Swipe saved successfully — remove from retry queue if present
      const queue = loadSwipeQueue(uidRef.current).filter(q => q.job_id !== job.id);
      saveSwipeQueue(queue, uidRef.current);
    }).catch(error => {
      swipeInFlightRef.current = false;
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
        const queue = loadSwipeQueue(uidRef.current);
        if (!queue.some(q => q.job_id === job.id)) {
          queue.push({ job_id: job.id, action, ts: Date.now() });
          saveSwipeQueue(queue, uidRef.current);
        }
        return; // don't revert stats — the swipe will be retried
      }

      // Revert optimistic stat update on permanent failure (4xx errors)
      if (action === 'like') {
        setStats(prev => {
          const pending = prev._pending || {};
          const next = {
            ...prev,
            applications_sent: Math.max(0, prev.applications_sent - 1),
            _pending: { ...pending, applications_sent: Math.max(0, (pending.applications_sent || 0) - 1) },
          };
          saveCachedStats(next, uidRef.current);
          return next;
        });
      } else if (action === 'superlike') {
        setStats(prev => {
          const pending = prev._pending || {};
          const next = {
            ...prev,
            applications_sent: Math.max(0, prev.applications_sent - 1),
            super_likes_used: Math.max(0, prev.super_likes_used - 1),
            _pending: {
              ...pending,
              applications_sent: Math.max(0, (pending.applications_sent || 0) - 1),
              super_likes_used: Math.max(0, (pending.super_likes_used || 0) - 1),
            },
          };
          saveCachedStats(next, uidRef.current);
          return next;
        });
        setSuperLikesRemaining(prev => {
          const next = prev + 1;
          saveCachedSuperLikes(next, uidRef.current);
          return next;
        });
      }

      // Also remove from swiped IDs so the job can be re-swiped
      swipedIdsRef.current.delete(job.id);
      saveSwipedIds(swipedIdsRef.current, uidRef.current);

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

  const handleUndo = async () => {
    if (undoing) return;
    if (!canUndo) {
      setUpgradeTrigger('undo');
      setShowUpgradeModal(true);
      return;
    }
    setUndoing(true);
    try {
      const res = await axios.post(`${API}/swipe/undo`, {}, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
      });
      const { undone_job_id, undone_action } = res.data;
      // Remove from swiped IDs so the card reappears
      swipedIdsRef.current.delete(undone_job_id);
      saveSwipedIds(swipedIdsRef.current, uidRef.current);
      // Decrement stats
      setStats(prev => {
        const next = {
          ...prev,
          applications_sent: Math.max(0, prev.applications_sent - 1),
          super_likes_used: undone_action === 'superlike' ? Math.max(0, prev.super_likes_used - 1) : prev.super_likes_used,
        };
        saveCachedStats(next, uidRef.current);
        return next;
      });
      if (undone_action === 'superlike') {
        setSuperLikesRemaining(prev => {
          const next = prev + 1;
          saveCachedSuperLikes(next, uidRef.current);
          return next;
        });
      }
      toast.success('Swipe undone!');

      // Animate the card back in with reverse swipe animation
      const lastSwiped = lastSwipedRef.current;
      if (lastSwiped && lastSwiped.job.id === undone_job_id) {
        // We have the card data — animate it sliding back in
        setEnteringCard({
          job: lastSwiped.job,
          fromDirection: lastSwiped.exitDirection, // where it flew off to
        });
        // Go back one card — the job is still in the array (we only
        // advanced the index when swiping), so just decrement.
        setCurrentIndex(prev => Math.max(0, prev - 1));
        // Bump undo counter to force a fresh SwipeCard mount with
        // clean drag state (same job ID key would reuse stale state)
        setUndoCounter(prev => prev + 1);
        // Clear the entering animation after the spring settles so
        // the real SwipeCard underneath becomes interactive
        setTimeout(() => setEnteringCard(null), 650);
        lastSwipedRef.current = null;
      } else {
        // Don't have the card data cached — refetch the deck
        fetchDashboard();
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not undo swipe';
      if (err.response?.status === 403 && detail.includes('Upgrade')) {
        setUpgradeTrigger('undo');
        setShowUpgradeModal(true);
      } else {
        toast.error(detail);
      }
    } finally {
      setUndoing(false);
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
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <SkeletonPageBackground />
        <header className="relative z-20 px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
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
            <SkeletonSwipeCard />
            <SkeletonActionButtons />
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none will-change-transform">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Slim Header */}
      <header className="relative z-20 px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo-white.png" alt="Hireabble" className="w-8 h-8" />
          <h1 className="text-lg font-bold font-['Outfit']">hireabble</h1>
        </div>
        <div className="flex items-center gap-1">
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
            className="w-8 h-8 rounded-full border-2 border-primary object-cover cursor-pointer hover:opacity-80 transition-opacity"
            onError={handleImgError(user?.id)}
          />
        </div>
      </header>

      {/* Main Content - Swipe Area */}
      <main className="relative z-10 flex-1 flex flex-col px-3 pb-28 min-h-0">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
          {currentJob ? (
            <>
              {/* Card Stack */}
              <div className="relative flex-1 card-stack overflow-hidden min-h-0" data-testid="swipe-deck">
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

                {/* Entering card (undo — animating back in) */}
                {enteringCard && (
                  <EnteringCard key={`enter-${enteringCard.job.id}`} card={enteringCard} />
                )}

                {/* Main Swipeable Card */}
                <SwipeCard
                  key={`${currentJob.id}-${undoCounter}`}
                  job={currentJob}
                  onSwipe={handleSwipe}
                  expanded={expandedCard}
                  setExpanded={setExpandedCard}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center items-center gap-4 pt-4 pb-1 shrink-0">
                <button
                  onClick={handleUndo}
                  disabled={undoing}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    canUndo
                      ? 'bg-amber-500/10 border border-amber-500/30 hover:scale-110 text-amber-500'
                      : 'bg-muted/10 border border-muted/20 text-muted-foreground opacity-50'
                  }`}
                  title={canUndo ? 'Undo last swipe' : 'Upgrade to undo'}
                  data-testid="undo-btn"
                >
                  <Undo2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSwipe('pass', { x: -1500, y: 0 })}
                  className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center hover:scale-110 hover:neon-glow-red transition-all duration-300"
                  data-testid="pass-btn"
                  aria-label="Pass on this job"
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
                    aria-label={`Super like this job (${superLikesRemaining} remaining)`}
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
                  aria-label="Like this job"
                >
                  <Heart className="w-7 h-7 text-success" />
                </button>
                <button
                  onClick={() => currentJob && toggleSaveJob(currentJob.id)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentJob && savedJobIds.has(currentJob.id)
                      ? 'bg-primary/20 border border-primary/40 text-primary'
                      : 'bg-muted/10 border border-muted/20 text-muted-foreground hover:scale-110'
                  }`}
                  title="Save for later"
                >
                  <Bookmark className={`w-5 h-5 ${currentJob && savedJobIds.has(currentJob.id) ? 'fill-current' : ''}`} />
                </button>
              </div>
              {/* Super Like Note (Premium) */}
              {premiumFeatures.superlike_notes && superLikesRemaining > 0 && (
                <div className="mt-3 flex justify-center">
                  {showNoteInput ? (
                    <div className="glass-card rounded-2xl p-3 w-full max-w-xs">
                      <input
                        type="text"
                        value={superlikeNote}
                        onChange={e => setSuperlikeNote(e.target.value.slice(0, 140))}
                        placeholder="Attach a note to your Super Like..."
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        maxLength={140}
                      />
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-muted-foreground">{superlikeNote.length}/140</span>
                        <button onClick={() => setShowNoteInput(false)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNoteInput(true)}
                      className="text-xs text-secondary hover:text-secondary/80 flex items-center gap-1 transition-colors"
                    >
                      <Star className="w-3 h-3" /> Attach a note to Super Like
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 rounded-3xl glass-card flex flex-col items-center justify-center p-8 text-center">
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

            {premiumFeatures.advanced_filters ? (
              <>
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
              </>
            ) : (
              <button
                onClick={() => navigate('/upgrade')}
                className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors w-full text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Advanced Filters</p>
                  <p className="text-xs text-muted-foreground">Upgrade to Plus+ for salary, category &amp; employment type filters</p>
                </div>
                <Crown className="w-4 h-4 text-amber-500 ml-auto flex-shrink-0" />
              </button>
            )}
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

      {/* Job Detail Bottom Sheet */}
      <AnimatePresence>
        {expandedCard && currentJob && (
          <JobDetailSheet job={currentJob} onClose={() => setExpandedCard(false)} />
        )}
      </AnimatePresence>

      <Navigation />

      {showMatch && (
        <MatchModal
          match={matchData}
          onClose={() => {
            setShowMatch(false);
            // Prompt for push notifications after first match if not yet asked
            if (isPushSupported() && getPermissionStatus() === 'default' && !localStorage.getItem('push_prompt_shown')) {
              localStorage.setItem('push_prompt_shown', '1');
              setTimeout(() => {
                toast('Get notified about new matches?', {
                  action: {
                    label: 'Enable',
                    onClick: () => subscribeToPush(token),
                  },
                  duration: 8000,
                });
              }, 1000);
            }
          }}
          onMessage={() => { setShowMatch(false); navigate(matchData?.id ? `/chat/${matchData.id}` : '/matches'); }}
        />
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSubscribed={fetchDashboard}
        trigger={upgradeTrigger}
        highlightTier="seeker_plus"
      />
    </div>
  );
}

// Tinder-style bottom sheet for job details
function JobDetailSheet({ job, onClose }) {
  const sheetY = useMotionValue(0);
  const sheetOpacity = useTransform(sheetY, [0, 300], [1, 0]);
  const scrollRef = useRef(null);
  const [canDragDown, setCanDragDown] = useState(true);

  // Allow drag-to-close only when scrolled to top
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
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {job.company_logo && (
              <img src={job.company_logo} alt={job.company} className="w-12 h-12 rounded-xl object-cover border border-border" />
            )}
            <div>
              <div className="text-sm text-muted-foreground">{job.company}</div>
              <div className="text-xs text-muted-foreground">
                Posted {new Date(job.created_at).toLocaleDateString()}
              </div>
            </div>
            {job.match_score != null && (
              <span className={`ml-auto px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                job.match_score >= 75 ? 'bg-success/20 text-success' :
                job.match_score >= 50 ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                <Star className="w-3.5 h-3.5" />
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
        </div>
      </motion.div>
    </motion.div>
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

// Card animating back in — Tinder-style fly back from where it exited
function EnteringCard({ card }) {
  const { fromDirection, job } = card;
  return (
    <motion.div
      className="absolute inset-0 z-10 pointer-events-none"
      initial={{
        x: fromDirection.x,
        y: fromDirection.y,
        rotate: fromDirection.x > 0 ? 15 : fromDirection.x < 0 ? -15 : 0,
        scale: 0.85,
      }}
      animate={{ x: 0, y: 0, rotate: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 24,
        mass: 0.8,
      }}
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border shadow-2xl">
        <div className="absolute inset-0">
          <img src={job.background_image} alt="Background" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
          <h2 className="text-2xl font-bold font-['Outfit'] mb-3">{job.title}</h2>
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
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            Show details
          </button>
        </div>
      </div>
    </motion.div>
  );
}
