import { useState, useEffect } from 'react';
import { X, Check, Star, Zap, Crown, Sparkles, Lock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tier color schemes (Tinder-inspired)
const TIER_COLORS = {
  seeker_plus: {
    gradient: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Star,
    badge: 'Plus',
  },
  seeker_premium: {
    gradient: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Crown,
    badge: 'Premium',
  },
  recruiter_pro: {
    gradient: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Zap,
    badge: 'Pro',
  },
  recruiter_enterprise: {
    gradient: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Crown,
    badge: 'Enterprise',
  },
};

const DURATION_LABELS = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  '6month': '6 Months',
};

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getMonthlyPrice(price, duration) {
  if (duration === 'weekly') return price * 4;
  if (duration === 'monthly') return price;
  if (duration === '6month') return Math.round(price / 6);
  return price;
}

function getSavingsPercent(tier, duration) {
  if (duration === 'weekly' || !tier?.prices) return 0;
  const weeklyMonthly = tier.prices.weekly * 4;
  const actual = duration === 'monthly' ? tier.prices.monthly : Math.round(tier.prices['6month'] / 6);
  return Math.round((1 - actual / weeklyMonthly) * 100);
}

export default function UpgradeModal({ open, onClose, onSubscribed, trigger, highlightTier }) {
  const { token, user } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [currentTier, setCurrentTier] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTiers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchTiers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/payments/tiers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTiers(res.data.tiers);
      setCurrentTier(res.data.current_tier);
      // Pre-select the highlighted tier or the first one
      if (highlightTier) {
        setSelectedTier(highlightTier);
      } else if (res.data.tiers.length > 0) {
        setSelectedTier(res.data.tiers[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch tiers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedTier || !selectedDuration) return;
    setPurchasing(true);
    try {
      await axios.post(
        `${API}/payments/subscribe`,
        { tier_id: selectedTier, duration: selectedDuration },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Subscription activated! Welcome to premium.');
      onClose?.();
      // Refresh user data to reflect new subscription
      if (onSubscribed) {
        onSubscribed();
      } else {
        // Fallback: re-fetch user data via auth endpoint
        try {
          const meRes = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          localStorage.setItem('cached_user', JSON.stringify(meRes.data));
          window.location.reload();
        } catch {
          window.location.reload();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to subscribe');
    } finally {
      setPurchasing(false);
    }
  };

  if (!open) return null;

  const activeTier = tiers.find((t) => t.id === selectedTier);
  const colors = TIER_COLORS[selectedTier] || TIER_COLORS.seeker_plus;
  const TierIcon = colors.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-background rounded-3xl mb-20 sm:mb-0"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Hero gradient header */}
            <div className={`relative h-48 bg-gradient-to-br ${colors.gradient} overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20" />
              {/* Animated circles */}
              <div className="absolute top-8 left-8 w-32 h-32 rounded-full bg-white/10 animate-pulse" />
              <div className="absolute bottom-4 right-8 w-20 h-20 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: '500ms' }} />

              <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                  <TierIcon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold font-['Outfit']">
                  {trigger === 'super_likes' && 'Get More Super Likes'}
                  {trigger === 'super_swipes' && 'Get More Super Swipes'}
                  {trigger === 'blurred' && 'See Who Applied'}
                  {trigger === 'boost' && 'Boost Your Listings'}
                  {trigger === 'undo' && 'Undo Your Last Swipe'}
                  {!trigger && 'Upgrade Your Experience'}
                </h2>
                <p className="text-sm text-white/80 mt-1">
                  {trigger === 'super_likes' && "You've used all your free Super Likes today"}
                  {trigger === 'super_swipes' && "You've used all your free Super Swipes today"}
                  {trigger === 'blurred' && 'Unlock the full applicant list'}
                  {trigger === 'boost' && 'Get your jobs in front of more candidates'}
                  {!trigger && 'Unlock premium features'}
                </p>
              </div>
            </div>

            {/* Tier selector tabs */}
            {tiers.length > 1 && (
              <div className="flex gap-2 px-4 -mt-5 relative z-10">
                {tiers.map((tier) => {
                  const tc = TIER_COLORS[tier.id] || TIER_COLORS.seeker_plus;
                  const isSelected = selectedTier === tier.id;
                  const isCurrent = currentTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`flex-1 py-3 px-4 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? `${tc.border} ${tc.bg} shadow-lg`
                          : 'border-border bg-card hover:border-primary/20'
                      }`}
                    >
                      <p className={`font-bold text-sm font-['Outfit'] ${isSelected ? tc.text : 'text-foreground'}`}>
                        {tier.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isCurrent ? 'Current' : `From ${formatPrice(Math.round(tier.prices['6month'] / 6))}/mo`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Features list */}
            {activeTier && (
              <div className="px-4 pt-5 pb-3">
                <div className="space-y-3">
                  {activeTier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Check className={`w-3 h-3 ${colors.text}`} />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duration selector */}
            {activeTier && (
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-2">
                  {['weekly', 'monthly', '6month'].map((dur) => {
                    const price = activeTier.prices[dur];
                    const savings = getSavingsPercent(activeTier, dur);
                    const isSelected = selectedDuration === dur;
                    return (
                      <button
                        key={dur}
                        onClick={() => setSelectedDuration(dur)}
                        className={`relative py-3 px-2 rounded-2xl border-2 transition-all text-center ${
                          isSelected
                            ? `${colors.border} ${colors.bg}`
                            : 'border-border bg-card hover:border-primary/20'
                        }`}
                      >
                        {savings > 0 && (
                          <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${colors.gradient} text-white`}>
                            SAVE {savings}%
                          </span>
                        )}
                        {dur === '6month' && (
                          <span className={`absolute -top-2.5 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${colors.gradient} text-white`}>
                            BEST
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">{DURATION_LABELS[dur]}</p>
                        <p className={`font-bold text-base ${isSelected ? colors.text : ''}`}>
                          {formatPrice(price)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {dur === '6month' ? `${formatPrice(Math.round(price / 6))}/mo` : dur === 'weekly' ? '/week' : '/month'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA Button */}
            <div className="px-4 pb-6 pt-2">
              {currentTier === selectedTier ? (
                <div className="w-full py-4 rounded-2xl bg-muted text-muted-foreground text-center font-bold text-sm">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className={`w-full py-4 rounded-2xl bg-gradient-to-r ${colors.gradient} text-white font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50`}
                >
                  {purchasing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <>Continue — {activeTier && formatPrice(activeTier.prices[selectedDuration])}</>
                  )}
                </button>
              )}
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Cancel anytime. {selectedDuration === '6month' ? 'Billed as one payment.' : 'Renews automatically.'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Small inline upgrade prompt (for embedding in other pages)
export function UpgradePrompt({ title, subtitle, tierHint, trigger, className = '' }) {
  const [showModal, setShowModal] = useState(false);

  const colors = TIER_COLORS[tierHint] || TIER_COLORS.seeker_plus;
  const TierIcon = colors.icon;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`w-full p-4 rounded-2xl border-2 ${colors.border} ${colors.bg} transition-all hover:scale-[1.01] active:scale-[0.99] text-left ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0`}>
            <TierIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm font-['Outfit']">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <ChevronRight className={`w-5 h-5 ${colors.text} flex-shrink-0`} />
        </div>
      </button>

      <UpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        trigger={trigger}
        highlightTier={tierHint}
      />
    </>
  );
}

// Blurred overlay for premium content
export function PremiumBlur({ children, isUnlocked, tierHint, trigger = 'blurred' }) {
  const [showModal, setShowModal] = useState(false);

  if (isUnlocked) return children;

  return (
    <>
      <div className="relative">
        <div className="blur-md pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl">
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
          >
            <Lock className="w-4 h-4" />
            Upgrade to See
          </button>
        </div>
      </div>

      <UpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        trigger={trigger}
        highlightTier={tierHint}
      />
    </>
  );
}
