import { motion, AnimatePresence } from 'framer-motion';
import { X, Rocket, MessageCircle, Star } from 'lucide-react';
import { Button } from './ui/button';

export default function MatchModal({ match, onClose, onMessage, userRole = 'seeker', ranking }) {
  if (!match) return null;

  const isSeeker = userRole === 'seeker';

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
            const burst = i < 50 ? 0 : 1; // two bursts
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
            You've Been Selected!
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground mb-4"
          >
            {isSeeker
              ? 'A recruiter is interested in your profile'
              : `${match.seeker_name || 'A candidate'} is a great fit for your role`
            }
          </motion.p>

          {/* Ranking Badge (seeker only) */}
          {isSeeker && ranking?.percentile && (
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
            className="flex gap-3"
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
              {isSeeker ? 'Message Recruiter' : 'Message Candidate'}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
