import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  X, Heart, Star, MapPin, Briefcase, GraduationCap, Clock,
  ChevronDown, BarChart3, Users, FileText, Building2, SlidersHorizontal,
  Search, Sparkles, Zap, MessageSquare, Plus
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

export default function RecruiterSwipe() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
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
  const swipedIdsRef = useRef(new Set());
  const readReceiptsSent = useRef(new Set());

  useEffect(() => {
    fetchData();
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

  const fetchCandidates = async (retry = 0) => {
    try {
      const opts = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };
      const [candidatesRes, swipesRes] = await Promise.all([
        axios.get(`${API}/candidates`, opts),
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
        if (action === 'accept' || res.data?.is_matched) {
          toast.success("Matched! You can now message this candidate.", { duration: 2000 });
        }
      }).catch(() => {});
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

  const items = mode === 'applicants' ? applications : candidates;
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
        <main className="relative z-10 flex-1 flex flex-col px-3 pb-20 min-h-0">
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
        <main className="relative z-10 flex-1 flex flex-col px-3 pb-20 min-h-0">
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
            <img src="/logo.png" alt="Hireabble" className="w-8 h-8 rounded-lg" />
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
      </header>

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
                >
                  <X className="w-7 h-7 text-destructive" />
                </button>

                {mode === 'discover' && (
                  <button
                    onClick={() => {
                      if (superSwipesRemaining && superSwipesRemaining.remaining <= 0) {
                        setShowUpgradeModal(true);
                        return;
                      }
                      handleSwipe('superlike', { x: 0, y: -1500 });
                    }}
                    className="w-14 h-14 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center hover:scale-110 transition-all duration-300 relative"
                    data-testid="superswipe-btn"
                  >
                    <Star className="w-6 h-6 text-secondary fill-secondary" />
                    {superSwipesRemaining && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary text-[10px] font-bold flex items-center justify-center text-white">
                        {superSwipesRemaining.remaining}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => handleSwipe('accept', { x: 1500, y: 0 })}
                  className="w-20 h-20 rounded-full bg-success/10 border border-success/30 flex items-center justify-center hover:scale-110 hover:neon-glow-green transition-all duration-300"
                  data-testid="accept-btn"
                >
                  <Heart className="w-9 h-9 text-success" />
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
    </div>
  );
}

// Tinder-style bottom sheet for candidate/applicant details
function CandidateDetailSheet({ item, mode, onClose }) {
  const sheetY = useMotionValue(0);
  const sheetOpacity = useTransform(sheetY, [0, 300], [1, 0]);

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
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) {
            onClose();
          }
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-6 pb-8" style={{ maxHeight: 'calc(85vh - 24px)' }}>
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

          {/* Super Like Note */}
          {item.superlike_note && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/20">
              <p className="text-xs text-secondary flex items-center gap-1 mb-0.5 font-medium">
                <MessageSquare className="w-3 h-3" /> Note from applicant
              </p>
              <p className="text-sm text-foreground/90 italic">"{item.superlike_note}"</p>
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
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border bg-card">
        {/* Photo Header */}
        <div className="absolute inset-0">
          <div className="h-[65%] relative overflow-hidden">
            <img
              src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
              alt={app.seeker_name}
              className="w-full h-full object-cover object-top"
              onError={handleImgError(app.seeker_name || app.seeker_id)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </div>
          <div className="absolute inset-0 top-[60%] bg-card" />
        </div>

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

        {/* Content */}
        <div className={`absolute inset-0 top-[55%] flex flex-col p-6 z-10 overflow-hidden`}>
          <h2 className="text-2xl font-bold font-['Outfit']">{app.seeker_name}</h2>
          <p className="text-primary text-sm mt-1">{app.seeker_title || 'Job Seeker'}</p>
          <p className="text-muted-foreground text-xs mt-1">Applied for: {app.job_title}</p>

          {app.superlike_note && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/20">
              <p className="text-xs text-secondary flex items-center gap-1 mb-0.5 font-medium">
                <MessageSquare className="w-3 h-3" /> Note from applicant
              </p>
              <p className="text-sm text-foreground/90 italic">"{app.superlike_note}"</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {app.seeker_experience && (
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {app.seeker_experience}+ yrs
              </span>
            )}
            {app.seeker_location && (
              <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {app.seeker_location}
              </span>
            )}
            {app.seeker_school && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {app.seeker_school}
              </span>
            )}
          </div>

          {app.seeker_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {app.seeker_skills.slice(0, 6).map((skill, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-white/5 border border-border text-xs">
                  {skill}
                </span>
              ))}
              {app.seeker_skills.length > 6 && (
                <span className="px-2 py-1 rounded-lg bg-white/5 text-xs text-muted-foreground">
                  +{app.seeker_skills.length - 6} more
                </span>
              )}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            <ChevronDown className="w-4 h-4" />
            Show details
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
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border bg-card">
        {/* Photo Header */}
        <div className="absolute inset-0">
          <div className="h-[65%] relative overflow-hidden">
            <img
              src={getPhotoUrl(candidate.photo_url || candidate.avatar, candidate.id)}
              alt={candidate.name}
              className="w-full h-full object-cover object-top"
              onError={handleImgError(candidate.id)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </div>
          <div className="absolute inset-0 top-[60%] bg-card" />
        </div>

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
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-card/90 backdrop-blur-sm border border-border text-xs font-bold flex items-center gap-1 shadow-lg">
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

        {/* Content */}
        <div className={`absolute inset-0 top-[55%] flex flex-col p-6 z-10 overflow-hidden`}>
          <h2 className="text-2xl font-bold font-['Outfit']">{candidate.name}</h2>
          <p className="text-primary text-sm mt-1">{candidate.title || 'Job Seeker'}</p>
          {candidate.best_match_job && (
            <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-secondary" />
              Best fit: {candidate.best_match_job}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {candidate.experience_years && (
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {candidate.experience_years}+ yrs
              </span>
            )}
            {candidate.location && (
              <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {candidate.location}
              </span>
            )}
            {candidate.school && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {candidate.school}
              </span>
            )}
          </div>

          {candidate.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {candidate.skills.slice(0, 6).map((skill, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-white/5 border border-border text-xs">
                  {skill}
                </span>
              ))}
              {candidate.skills.length > 6 && (
                <span className="px-2 py-1 rounded-lg bg-white/5 text-xs text-muted-foreground">
                  +{candidate.skills.length - 6} more
                </span>
              )}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            <ChevronDown className="w-4 h-4" />
            Show details
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
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border bg-card">
        <div className="absolute inset-0">
          <div className="h-[65%] relative overflow-hidden">
            <img src={photoUrl} alt={name} className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </div>
          <div className="absolute inset-0 top-[60%] bg-card" />
        </div>
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
        <div className="absolute inset-0 top-[55%] flex flex-col p-6 z-10">
          <h2 className="text-2xl font-bold font-['Outfit']">{name}</h2>
          <p className="text-primary text-sm mt-1">{title}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Static background cards — show real content so next card is instantly visible
function StaticApplicantCard({ app }) {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border bg-card">
      <div className="absolute inset-0">
        <div className="h-[65%] relative overflow-hidden">
          <img
            src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
            alt={app.seeker_name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>
        <div className="absolute inset-0 top-[60%] bg-card" />
      </div>
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
      <div className="absolute inset-0 top-[55%] flex flex-col p-6 z-10">
        <h2 className="text-2xl font-bold font-['Outfit']">{app.seeker_name}</h2>
        <p className="text-primary text-sm mt-1">{app.seeker_title || 'Job Seeker'}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {app.seeker_experience && (
            <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {app.seeker_experience}+ yrs
            </span>
          )}
          {app.seeker_location && (
            <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
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
    <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border bg-card">
      <div className="absolute inset-0">
        <div className="h-[65%] relative overflow-hidden">
          <img
            src={getPhotoUrl(candidate.photo_url || candidate.avatar, candidate.id)}
            alt={candidate.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>
        <div className="absolute inset-0 top-[60%] bg-card" />
      </div>
      <div className="absolute inset-0 top-[55%] flex flex-col p-6 z-10">
        <h2 className="text-2xl font-bold font-['Outfit']">{candidate.name}</h2>
        <p className="text-primary text-sm mt-1">{candidate.title || 'Job Seeker'}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {candidate.experience_years && (
            <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {candidate.experience_years}+ yrs
            </span>
          )}
          {candidate.location && (
            <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {candidate.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
