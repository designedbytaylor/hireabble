import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, MessageCircle, Star, User, XCircle } from 'lucide-react';
import { Button } from './ui/button';

export default function MatchModal({ match, onClose, onMessage, userRole = 'seeker', ranking, onShortlist, onReject }) {
  if (!match) return null;

  const isSeeker = userRole === 'seeker';

  // ==================== RECRUITER VIEW ====================
  if (!isSeeker) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative z-10 glass-card rounded-3xl p-6 max-w-sm w-full"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-['Outfit']">New Applicant</h2>
                <p className="text-xs text-muted-foreground">{match.seeker_name || 'A candidate'} applied to your role</p>
              </div>
            </div>

            {/* Candidate Card */}
            <div className="p-4 rounded-2xl bg-background border border-border mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold font-['Outfit'] text-base">{match.seeker_name || 'Candidate'}</div>
                  <div className="text-sm text-muted-foreground">{match.job_title}</div>
                  {match.company && <div className="text-xs text-muted-foreground">{match.company}</div>}
                </div>
              </div>

              {/* Fit Score */}
              {match.match_score != null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-bold w-fit">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  Fit Score: {match.match_score}%
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              {onShortlist && (
                <Button
                  variant="outline"
                  onClick={() => { onShortlist(); onClose(); }}
                  className="flex-1 rounded-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  size="sm"
                >
                  <Star className="w-4 h-4 mr-1.5" />
                  Shortlist
                </Button>
              )}
              {onReject && (
                <Button
                  variant="outline"
                  onClick={() => { onReject(); onClose(); }}
                  className="flex-1 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                  size="sm"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Reject
                </Button>
              )}
              <Button
                onClick={onMessage || onClose}
                className="flex-1 rounded-full bg-gradient-to-r from-primary to-secondary"
                size="sm"
              >
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Message
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ==================== SEEKER VIEW ====================
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Confetti particles — multi-burst celebration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(80)].map((_, i) => {
            const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
            const centerY = typeof window !== 'undefined' ? window.innerHeight * 0.35 : 280;
            const angle = (Math.random() * Math.PI * 2);
            const velocity = 200 + Math.random() * 600;
            const colors = ['#6366f1', '#d946ef', '#10b981', '#f43f5e', '#fbbf24', '#06b6d4', '#f97316', '#a855f7'];
            const shapes = ['rounded-sm', 'rounded-full', 'rounded-none'];
            const w = 6 + Math.random() * 10;
            const h = Math.random() > 0.5 ? w : w * (0.3 + Math.random() * 0.5);
            const burst = i < 50 ? 0 : 1;
            const burstDelay = burst * 0.3;

            return (
              <motion.div
                key={i}
                className={`${shapes[Math.floor(Math.random() * shapes.length)]}`}
                initial={{
                  x: centerX + (Math.random() - 0.5) * 40,
                  y: centerY + (Math.random() - 0.5) * 40,
                  rotate: 0,
                  scale: 0,
                  opacity: 1,
                }}
                animate={{
                  x: centerX + Math.cos(angle) * velocity,
                  y: centerY + Math.sin(angle) * velocity + 300,
                  rotate: Math.random() * 1080 - 540,
                  scale: [0, 1.2, 1, 0.8],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  duration: 1.5 + Math.random() * 1.5,
                  delay: burstDelay + Math.random() * 0.4,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                style={{
                  position: 'absolute',
                  backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                  width: w,
                  height: h,
                }}
              />
            );
          })}
        </div>

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          className="relative z-10 glass-card rounded-3xl p-8 max-w-sm w-full text-center"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Rocket Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6"
          >
            <Rocket className="w-10 h-10 text-white" />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold font-['Outfit'] mb-2 gradient-text"
          >
            Great News!
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground mb-4"
          >
            A recruiter has shortlisted your application
          </motion.p>

          {/* Ranking Badge (seeker only) */}
          {ranking?.percentile && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-bold mb-4"
            >
              <Star className="w-4 h-4 fill-amber-400" />
              You ranked in the Top {ranking.percentile}% of applicants
            </motion.div>
          )}

          {/* Match Details */}
          {match.job_title && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-2xl bg-background border border-border mb-6"
            >
              <div className="font-medium">{match.job_title}</div>
              {match.company && <div className="text-sm text-muted-foreground">{match.company}</div>}
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col-reverse sm:flex-row gap-3 w-full"
          >
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-full"
            >
              Keep Browsing
            </Button>
            <Button
              onClick={onMessage || onClose}
              className="flex-1 rounded-full bg-gradient-to-r from-primary to-secondary"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message Recruiter
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
