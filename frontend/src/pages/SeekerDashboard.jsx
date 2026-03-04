import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Star, Briefcase, MapPin, DollarSign, Building2, Clock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import MatchModal from '../components/MatchModal';

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

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats/seeker`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= jobs.length) return;
    
    const job = jobs[currentIndex];
    try {
      await axios.post(`${API}/swipe`, 
        { job_id: job.id, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (action === 'like') {
        toast.success('Application sent!');
      } else if (action === 'superlike') {
        toast.success('Super Like sent! ⭐', { duration: 2000 });
      }
      
      setCurrentIndex(prev => prev + 1);
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit');
    }
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
          <div className="flex items-center gap-2">
            <img 
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full border-2 border-primary"
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
                  onSwipe={handleSwipe}
                  expanded={expandedCard}
                  setExpanded={setExpandedCard}
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
                <button
                  onClick={() => handleSwipe('superlike')}
                  className="w-20 h-20 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center hover:scale-110 hover:neon-glow-pink transition-all duration-300"
                  data-testid="superlike-btn"
                >
                  <Star className="w-9 h-9 text-secondary" />
                </button>
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
                You've seen all available jobs. Check back later for new opportunities!
              </p>
              <button 
                onClick={() => {
                  setCurrentIndex(0);
                  fetchJobs();
                }}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-white font-medium"
                data-testid="refresh-jobs-btn"
              >
                Refresh Jobs
              </button>
            </div>
          )}
        </div>
      </main>

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

function SwipeCard({ job, onSwipe, expanded, setExpanded }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  // Indicator opacities
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);
  const superlikeOpacity = useTransform(y, [-100, 0], [1, 0]);

  const handleDragEnd = (_, info) => {
    const swipeThreshold = 100;
    
    if (info.offset.y < -swipeThreshold) {
      onSwipe('superlike');
    } else if (info.offset.x > swipeThreshold) {
      onSwipe('like');
    } else if (info.offset.x < -swipeThreshold) {
      onSwipe('pass');
    }
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
      style={{ x, y, rotate, opacity }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
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
          SUPER LIKE ⭐
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
