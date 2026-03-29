import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, Star, Zap, Crown, Sparkles, Shield, Tag, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Detect if running inside native iOS Capacitor shell (StoreKit required) */
function isIOSNativeApp() {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

/** Detect if running inside native Android Capacitor shell (Google Play Billing may apply) */
function isAndroidNativeApp() {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

const DURATION_LABELS = { weekly: 'Weekly', monthly: 'Monthly', '6month': '6 Months' };

const TIER_STYLES = {
  seeker_plus: {
    gradient: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Star,
    ring: 'ring-blue-500/30',
  },
  seeker_premium: {
    gradient: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Crown,
    ring: 'ring-amber-500/30',
  },
  recruiter_pro: {
    gradient: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Zap,
    ring: 'ring-blue-500/30',
  },
  recruiter_enterprise: {
    gradient: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Crown,
    ring: 'ring-amber-500/30',
  },
};

const FREE_FEATURES = {
  seeker: ['3 Priority Applies per day', 'Smart job recommendations', 'Apply to jobs', 'Chat with connections'],
  recruiter: ['3 Candidate Invites per day', 'Post job listings', 'View basic applicant info', 'Chat with connections'],
};

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Upgrade() {
  useDocumentTitle('Upgrade');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [currentTier, setCurrentTier] = useState(null);
  const [currentDuration, setCurrentDuration] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('monthly');
  const [purchasing, setPurchasing] = useState(null);
  const [addOns, setAddOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const isSeeker = user?.role === 'seeker';
  const preselect = searchParams.get('tier');
  const isIOS = useMemo(() => isIOSNativeApp(), []);
  const isAndroid = useMemo(() => isAndroidNativeApp(), []);
  const isNativeStore = isIOS || isAndroid;

  useEffect(() => {
    fetchTiers();
    fetchAddOns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle native StoreKit responses from iOS
  useEffect(() => {
    const handleStoreKitResponse = async (e) => {
      const data = e.detail;
      if (!data) return;

      switch (data.type) {
        case 'purchaseSuccess':
        case 'restoreSuccess': {
          try {
            const res = await axios.post(
              `${API}/payments/apple/verify-receipt`,
              {
                receipt_data: data.receipt_data,
                product_id: data.product_id,
                transaction_id: data.transaction_id,
                job_id: data.job_id || null,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(res.data.message || 'Purchase successful!');
            fetchTiers(); // Refresh to show updated subscription
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to verify purchase. Please try restoring purchases.');
          }
          break;
        }
        case 'purchaseCancelled':
          break; // User cancelled, no action needed
        case 'purchasePending':
          toast('Purchase is pending approval.', { duration: 4000 });
          break;
        case 'purchaseError':
          toast.error(data.error || 'Purchase failed. Please try again.');
          break;
        case 'restoreEmpty':
          toast('No purchases to restore.', { duration: 4000 });
          break;
        default:
          break;
      }
      setPurchasing(null);
    };

    window.addEventListener('storeKitResponse', handleStoreKitResponse);
    return () => window.removeEventListener('storeKitResponse', handleStoreKitResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Handle native Google Play Billing responses from Android
  useEffect(() => {
    const handleGooglePlayResponse = async (e) => {
      const data = e.detail;
      if (!data) return;

      switch (data.type) {
        case 'purchaseSuccess':
        case 'restoreSuccess': {
          try {
            const res = await axios.post(
              `${API}/payments/google/verify-purchase`,
              {
                purchase_token: data.purchase_token,
                product_id: data.product_id,
                order_id: data.order_id || null,
                tier_id: data.tier_id || null,
                duration: data.duration || null,
                job_id: data.job_id || null,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(res.data.message || 'Purchase successful!');
            fetchTiers();
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to verify purchase. Please try restoring purchases.');
          }
          break;
        }
        case 'purchaseCancelled':
          break;
        case 'purchasePending':
          toast('Purchase is pending approval.', { duration: 4000 });
          break;
        case 'purchaseError':
          toast.error(data.error || 'Purchase failed. Please try again.');
          break;
        case 'restoreEmpty':
          toast('No purchases to restore.', { duration: 4000 });
          break;
        default:
          break;
      }
      setPurchasing(null);
    };

    window.addEventListener('googlePlayResponse', handleGooglePlayResponse);
    return () => window.removeEventListener('googlePlayResponse', handleGooglePlayResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchTiers = async () => {
    try {
      const res = await axios.get(`${API}/payments/tiers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTiers(res.data.tiers);
      setCurrentTier(res.data.current_tier);
      setCurrentDuration(res.data.current_duration);
    } catch (err) {

      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddOns = async () => {
    try {
      const res = await axios.get(`${API}/payments/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      if (isSeeker) {
        setAddOns(data.super_likes || []);
      } else {
        setAddOns([...(data.super_swipes || []), ...(data.boosts || [])]);
      }
    } catch (err) {

    }
  };

  const handleSubscribe = async (tierId) => {
    setPurchasing(tierId);
    try {
      if (isIOS && window.webkit?.messageHandlers?.storeKit) {
        // iOS installed PWA — delegate to native StoreKit handler
        const productId = `com.hireabble.${tierId}.${selectedDuration}`;
        window.webkit.messageHandlers.storeKit.postMessage({
          action: 'purchase',
          productId,
          tier_id: tierId,
          duration: selectedDuration,
        });
        // StoreKit callback will handle the rest via receipt verification
        return;
      }

      // iOS without StoreKit handler — cannot use Stripe (Apple Guideline 3.1.1)
      if (isIOS) {
        toast.error('Please download the app from the App Store to subscribe.');
        return;
      }

      if (isAndroid && window.Android?.purchase) {
        // Android installed PWA — delegate to Google Play Billing
        const productId = `com.hireabble.${tierId}.${selectedDuration}`;
        window.Android.purchase(productId, tierId, selectedDuration);
        return;
      }

      // Web — use Stripe checkout
      const res = await axios.post(
        `${API}/payments/create-checkout-session`,
        { tier_id: tierId, duration: selectedDuration },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
        return;
      }

      toast.error('Unable to start checkout. Please try again.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to subscribe');
    } finally {
      setPurchasing(null);
    }
  };

  const handleAddOnPurchase = async (addon) => {
    setPurchasing(addon.id);
    try {
      if (isIOS && window.webkit?.messageHandlers?.storeKit) {
        window.webkit.messageHandlers.storeKit.postMessage({
          action: 'purchase',
          productId: addon.apple_product_id || addon.id,
          product_id: addon.id,
        });
        return;
      }

      if (isAndroid && window.Android?.purchase) {
        window.Android.purchase(addon.google_product_id || addon.id, addon.id);
        return;
      }

      // Web — use Stripe checkout
      const body = { product_id: addon.id };
      if (addon.id.startsWith('boost_') && addon.job_id) {
        body.job_id = addon.job_id;
      }
      const res = await axios.post(
        `${API}/payments/create-checkout-session`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
        return;
      }
      toast.error('Unable to start checkout. Please try again.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to purchase');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = () => {
    if (isIOS && window.webkit?.messageHandlers?.storeKit) {
      window.webkit.messageHandlers.storeKit.postMessage({ action: 'restore' });
      toast.success('Restoring purchases...');
    } else if (isAndroid && window.Android?.restorePurchases) {
      window.Android.restorePurchases();
      toast.success('Restoring purchases...');
    } else {
      toast('Your subscription is managed through your account settings.', { duration: 4000 });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError && tiers.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-semibold mb-2">Failed to load pricing</p>
        <p className="text-muted-foreground mb-6">Please check your connection and try again.</p>
        <button
          onClick={() => { setFetchError(false); setLoading(true); fetchTiers(); fetchAddOns(); }}
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Upgrade</h1>
            <p className="text-muted-foreground text-sm">Choose the plan that's right for you</p>
          </div>
        </div>

        {/* Duration toggle */}
        <div className="flex gap-2 p-1 rounded-2xl bg-card border border-border max-w-sm mx-auto">
          {[
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: '6month', label: '6 Months' },
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDuration(d.id)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                selectedDuration === d.id
                  ? 'bg-gradient-to-r from-primary to-secondary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 px-6 max-w-lg mx-auto space-y-4">
        {/* Free tier card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border-2 p-5 transition-all ${
            !currentTier ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Shield className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">Free</h3>
              <p className="text-muted-foreground text-sm">Basic features</p>
            </div>
            {!currentTier && (
              <span className="ml-auto px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">
                Current
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {FREE_FEATURES[isSeeker ? 'seeker' : 'recruiter'].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Paid tier cards */}
        {tiers.map((tier, idx) => {
          const style = TIER_STYLES[tier.id] || TIER_STYLES.seeker_plus;
          const TierIcon = style.icon;
          const isCurrent = currentTier === tier.id && currentDuration === selectedDuration;
          const isHighlighted = preselect === tier.id || (!preselect && tier.tier_level === 2);
          const price = tier.prices[selectedDuration];
          const monthlyPrice = selectedDuration === '6month'
            ? Math.round(tier.prices['6month'] / 6)
            : selectedDuration === 'weekly'
            ? tier.prices.weekly * 4
            : tier.prices.monthly;
          const weeklyEquiv = tier.prices.weekly * 4;
          const savings = selectedDuration !== 'weekly'
            ? Math.round((1 - monthlyPrice / weeklyEquiv) * 100)
            : 0;

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx + 1) * 0.1 }}
              className={`relative rounded-3xl border-2 p-5 transition-all ${
                isCurrent
                  ? `${style.border} ${style.bg}`
                  : isHighlighted
                  ? `${style.border} ${style.bg} ring-2 ${style.ring}`
                  : 'border-border bg-card hover:border-primary/20'
              }`}
            >
              {/* Popular badge */}
              {isHighlighted && !isCurrent && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${style.gradient} text-white text-xs font-bold`}>
                  MOST POPULAR
                </div>
              )}

              {/* Tier header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
                  <TierIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-['Outfit']">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-bold ${style.text}`}>{formatPrice(price)}</span>
                    <span className="text-xs text-muted-foreground">
                      /{selectedDuration === '6month' ? '6mo' : selectedDuration === 'weekly' ? 'wk' : 'mo'}
                    </span>
                    {savings > 0 && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${style.gradient} text-white`}>
                        SAVE {savings}%
                      </span>
                    )}
                  </div>
                </div>
                {isCurrent && (
                  <span className={`ml-auto px-3 py-1 rounded-full ${style.bg} ${style.text} text-xs font-bold`}>
                    Current
                  </span>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2.5 mb-5">
                {tier.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0`}>
                      <Check className={`w-3 h-3 ${style.text}`} />
                    </div>
                    <span className="text-sm">{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div className="w-full py-3 rounded-2xl bg-muted text-muted-foreground text-center font-bold text-sm">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={purchasing === tier.id}
                  className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${style.gradient} text-white font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50`}
                >
                  {purchasing === tier.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    currentTier === tier.id ? `Switch to ${DURATION_LABELS[selectedDuration]} — ${formatPrice(price)}` : `Get ${tier.name} — ${formatPrice(price)}`
                  )}
                </button>
              )}
            </motion.div>
          );
        })}

        {/* Consumable add-ons section */}
        {addOns.length > 0 && (
          <div className="pt-4">
            <h3 className="text-lg font-bold font-['Outfit'] mb-3">Add-ons</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Need more? Purchase additional packs anytime.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {addOns.map((addon, idx) => (
                <AddOnCard
                  key={addon.id}
                  title={addon.name}
                  price={formatPrice(addon.price)}
                  icon={isSeeker ? Star : Zap}
                  color={isSeeker ? 'from-blue-500 to-cyan-400' : 'from-purple-500 to-pink-400'}
                  badge={idx === addOns.length - 1 ? 'Best Value' : idx === 1 ? 'Popular' : undefined}
                  onClick={() => handleAddOnPurchase(addon)}
                  disabled={purchasing === addon.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Restore Purchases — prominent on native platforms */}
        {isNativeStore && (
          <div className="text-center py-4">
            <button
              onClick={handleRestorePurchases}
              className="w-full max-w-xs mx-auto py-3 px-6 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary font-medium text-sm hover:bg-primary/10 transition-all"
            >
              Restore Purchases
            </button>
          </div>
        )}

        {/* Promo Code — hidden on iOS (Apple requires offers through App Store) */}
        {!isIOS && <PromoCodeSection token={token} onRedeemed={() => window.location.reload()} />}

        <div className="text-xs text-muted-foreground text-center py-4 space-y-2">
          <p>
            Payment will be charged to your {isIOS ? 'Apple ID account' : isAndroid ? 'Google Play account' : 'payment method'} at
            confirmation of purchase. Subscriptions automatically renew for the same duration and price unless auto-renew is turned off at least 24 hours before
            the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period.
          </p>
          <p>
            You can manage or cancel your subscription anytime in your{' '}
            {isIOS ? (
              <a href="https://apps.apple.com/account/subscriptions" className="text-primary underline">App Store settings</a>
            ) : isAndroid ? (
              <a href="https://play.google.com/store/account/subscriptions" className="text-primary underline">Google Play settings</a>
            ) : (
              <Link to="/profile" className="text-primary underline">account settings</Link>
            )}.
            {' '}Prices shown are in USD and may vary by region. Any unused portion of a free trial period will be forfeited when you purchase a subscription.
          </p>
          <p>
            <Link to="/terms" className="text-primary underline">Terms of Service</Link>
            {' · '}
            <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>
          </p>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function PromoCodeSection({ token, onRedeemed }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/payments/redeem-promo`, { code: code.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(res.data.message);
      onRedeemed();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid promo code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Tag className="w-3.5 h-3.5" />
        Have a promo code?
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 flex gap-2 max-w-xs mx-auto">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="flex-1 h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 outline-none"
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
          />
          <button
            onClick={handleRedeem}
            disabled={loading || !code.trim()}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Applying...' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  );
}

function AddOnCard({ title, price, icon: Icon, color, badge, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="relative p-3 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all text-center disabled:opacity-50">
      {badge && (
        <span className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r ${color} text-white whitespace-nowrap`}>
          {badge}
        </span>
      )}
      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-2`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-xs font-medium">{title}</p>
      <p className="text-sm font-bold mt-1">{price}</p>
    </button>
  );
}
