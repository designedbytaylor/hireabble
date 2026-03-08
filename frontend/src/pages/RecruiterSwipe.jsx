import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  X, Heart, Star, MapPin, Briefcase, GraduationCap, Clock,
  ChevronDown, BarChart3, Users, FileText, Building2, SlidersHorizontal
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import NotificationBell from '../components/NotificationBell';
import { getPhotoUrl } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterSwipe() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active_jobs: 0, total_applications: 0, super_likes: 0, matches: 0 });
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [expandedCard, setExpandedCard] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const [appsRes, statsRes] = await Promise.all([
        axios.get(`${API}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/stats/recruiter`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      // Only show pending applications (not yet acted on)
      const pending = appsRes.data.filter(a => !a.recruiter_action);
      setApplications(pending);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= applications.length || isAnimating) return;

    const app = applications[currentIndex];

    setIsAnimating(true);
    setSwipeDirection(action === 'accept' ? 'right' : 'left');

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      await axios.post(`${API}/applications/respond`,
        { application_id: app.id, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (action === 'accept') {
        toast.success("It's a match! You can now message this candidate.");
      } else {
        toast.info('Application passed');
      }

      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
      setIsAnimating(false);
      setExpandedCard(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to respond');
      setSwipeDirection(null);
      setIsAnimating(false);
    }
  };

  const currentApp = applications[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Review Applicants</h1>
            <p className="text-muted-foreground">{user?.company || 'Your Company'}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => navigate('/recruiter/dashboard')}
              className="p-2.5 rounded-xl hover:bg-accent transition-colors"
              title="Dashboard"
            >
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Stats Bar - Clickable */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          <button
            onClick={() => navigate('/recruiter')}
            className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap hover:border-primary/30 transition-colors active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <div className="text-xl font-bold">{stats.active_jobs}</div>
              <div className="text-xs text-muted-foreground">Jobs</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/recruiter')}
            className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap hover:border-success/30 transition-colors active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div className="text-left">
              <div className="text-xl font-bold">{stats.total_applications}</div>
              <div className="text-xs text-muted-foreground">Applicants</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/matches')}
            className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap hover:border-pink-500/30 transition-colors active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <div className="text-left">
              <div className="text-xl font-bold">{stats.matches}</div>
              <div className="text-xs text-muted-foreground">Matches</div>
            </div>
          </button>
        </div>
      </header>

      {/* Main Content - Swipe Area */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-md mx-auto">
          {currentApp ? (
            <>
              {/* Card Stack */}
              <div className="relative aspect-[3/4] card-stack" data-testid="applicant-deck">
                {applications.slice(currentIndex + 1, currentIndex + 3).map((_, i) => (
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

                <ApplicantCard
                  app={currentApp}
                  onSwipe={(action) => handleSwipe(action)}
                  expanded={expandedCard}
                  setExpanded={setExpandedCard}
                  swipeDirection={swipeDirection}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center items-center gap-5 mt-8">
                <button
                  onClick={() => handleSwipe('reject')}
                  className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center hover:scale-110 hover:neon-glow-red transition-all duration-300"
                  data-testid="reject-btn"
                >
                  <X className="w-7 h-7 text-destructive" />
                </button>
                <button
                  onClick={() => handleSwipe('accept')}
                  className="w-20 h-20 rounded-full bg-success/10 border border-success/30 flex items-center justify-center hover:scale-110 hover:neon-glow-green transition-all duration-300"
                  data-testid="accept-btn"
                >
                  <Heart className="w-9 h-9 text-success" />
                </button>
              </div>
            </>
          ) : (
            <div className="aspect-[3/4] rounded-3xl glass-card flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-3">All Caught Up!</h2>
              <p className="text-muted-foreground mb-6">
                You've reviewed all current applicants. Check back later or post new jobs to get more!
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/recruiter/dashboard')}
                  className="rounded-full"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => { setCurrentIndex(0); fetchData(); }}
                  className="rounded-full bg-gradient-to-r from-primary to-secondary"
                >
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function ApplicantCard({ app, onSwipe, expanded, setExpanded, swipeDirection }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);

  const acceptOpacity = useTransform(x, [0, 60], [0, 1]);
  const rejectOpacity = useTransform(x, [-60, 0], [1, 0]);

  useEffect(() => {
    if (swipeDirection) {
      const toX = swipeDirection === 'right' ? 1500 : -1500;
      const startX = x.get();
      const startTime = Date.now();
      const duration = 200;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        x.set(startX + (toX - startX) * easeProgress);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeDirection]);

  const handleDragEnd = (_, info) => {
    const threshold = 60;
    const velThreshold = 300;

    if (info.offset.x > threshold || info.velocity.x > velThreshold) {
      animateOut(1500, 'accept');
    } else if (info.offset.x < -threshold || info.velocity.x < -velThreshold) {
      animateOut(-1500, 'reject');
    } else {
      springBack();
    }
  };

  const springBack = () => {
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
  };

  const animateOut = (toX, action) => {
    const startX = x.get();
    const startTime = Date.now();
    const duration = 150;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * progress;
      x.set(startX + (toX - startX) * ease);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onSwipe(action);
      }
    };
    requestAnimationFrame(animate);
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!swipeDirection}
      dragConstraints={false}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      data-testid="applicant-card"
    >
      <div className="w-full h-full rounded-3xl overflow-hidden relative gradient-border bg-card">
        {/* Photo Header */}
        <div className="absolute inset-0">
          <div className="h-[45%] relative overflow-hidden">
            <img
              src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_id)}
              alt={app.seeker_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </div>
          <div className="absolute inset-0 top-[40%] bg-card" />
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

        {/* Super Like Badge */}
        {app.action === 'superlike' && (
          <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-gradient-to-r from-secondary to-pink-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
            <Star className="w-3 h-3 fill-white" /> Super Like
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 top-[35%] flex flex-col p-6 z-10 overflow-y-auto">
          {/* Name & Title */}
          <h2 className="text-2xl font-bold font-['Outfit']">{app.seeker_name}</h2>
          <p className="text-primary text-sm mt-1">{app.seeker_title || 'Job Seeker'}</p>
          <p className="text-muted-foreground text-xs mt-1">Applied for: {app.job_title}</p>

          {/* Tags */}
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

          {/* Skills */}
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

          {/* Expandable Details */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
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
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {app.seeker_bio && (
                    <p className="text-sm text-muted-foreground">{app.seeker_bio}</p>
                  )}
                  {app.seeker_current_employer && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Currently at {app.seeker_current_employer}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
