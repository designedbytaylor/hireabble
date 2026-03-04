import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';

export default function MatchModal({ match, onClose }) {
  if (!match) return null;

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

        {/* Confetti particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="confetti-piece rounded-sm"
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: -20,
                rotate: 0,
                opacity: 1
              }}
              animate={{ 
                y: window.innerHeight + 20,
                rotate: Math.random() * 720,
                opacity: 0
              }}
              transition={{ 
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut'
              }}
              style={{
                backgroundColor: ['#6366f1', '#d946ef', '#10b981', '#f43f5e', '#fbbf24'][Math.floor(Math.random() * 5)],
                width: 8 + Math.random() * 8,
                height: 8 + Math.random() * 8,
              }}
            />
          ))}
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

          {/* Heart Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6"
          >
            <Heart className="w-10 h-10 text-white fill-white" />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold font-['Outfit'] mb-2 gradient-text"
          >
            It's a Match!
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground mb-6"
          >
            You and {match.company || match.seeker_name} have liked each other
          </motion.p>

          {/* Match Details */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="p-4 rounded-2xl bg-background border border-border mb-6"
          >
            <div className="font-medium">{match.job_title}</div>
            <div className="text-sm text-muted-foreground">{match.company}</div>
          </motion.div>

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
              Keep Swiping
            </Button>
            <Button
              className="flex-1 rounded-full bg-gradient-to-r from-primary to-secondary"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
