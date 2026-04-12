import { motion } from 'framer-motion';

/**
 * Lightweight page entry animation wrapper.
 * 8px fade-up over 200ms — perceptible polish without jarring transitions.
 */
export default function PageTransition({ children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
