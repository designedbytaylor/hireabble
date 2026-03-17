import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DollarSign, Save, RotateCcw, Crown, Zap, Star } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollars(str) {
  const val = parseFloat(str.replace(/[^0-9.]/g, ''));
  return isNaN(val) ? null : Math.round(val * 100);
}

export default function AdminPricing() {
  const { token } = useAdminAuth();
  const [tiers, setTiers] = useState({});
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState({ tiers: {}, products: {} });

  const fetchPricing = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/pricing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTiers(res.data.tiers);
      setProducts(res.data.products);
      setEdits({ tiers: {}, products: {} });
    } catch (e) {
      toast.error('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  const setTierPrice = (tierId, duration, value) => {
    setEdits(prev => ({
      ...prev,
      tiers: {
        ...prev.tiers,
        [tierId]: {
          ...prev.tiers[tierId],
          prices: {
            ...(prev.tiers[tierId]?.prices || {}),
            [duration]: value,
          },
        },
      },
    }));
  };

  const setProductPrice = (productId, value) => {
    setEdits(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [productId]: { price: value },
      },
    }));
  };

  const getTierPrice = (tierId, duration) => {
    const edited = edits.tiers[tierId]?.prices?.[duration];
    if (edited !== undefined) return edited;
    return tiers[tierId]?.prices[duration];
  };

  const getProductPrice = (productId) => {
    const edited = edits.products[productId]?.price;
    if (edited !== undefined) return edited;
    return products[productId]?.price;
  };

  const hasEdits = Object.keys(edits.tiers).length > 0 || Object.keys(edits.products).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert edits to proper format (cents as integers)
      const payload = { tiers: {}, products: {} };

      for (const [tierId, tierEdit] of Object.entries(edits.tiers)) {
        if (tierEdit.prices) {
          payload.tiers[tierId] = { prices: {} };
          for (const [dur, val] of Object.entries(tierEdit.prices)) {
            if (typeof val === 'number') {
              payload.tiers[tierId].prices[dur] = val;
            }
          }
        }
      }

      for (const [prodId, prodEdit] of Object.entries(edits.products)) {
        if (typeof prodEdit.price === 'number') {
          payload.products[prodId] = { price: prodEdit.price };
        }
      }

      await axios.put(`${API}/admin/pricing`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Pricing updated');
      fetchPricing();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all prices to defaults? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/admin/pricing/reset`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Pricing reset to defaults');
      fetchPricing();
    } catch (e) {
      toast.error('Failed to reset pricing');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const seekerTiers = Object.entries(tiers).filter(([, t]) => t.role === 'seeker');
  const recruiterTiers = Object.entries(tiers).filter(([, t]) => t.role === 'recruiter');
  const seekerProducts = Object.entries(products).filter(([k]) => k.startsWith('seeker_'));
  const recruiterProducts = Object.entries(products).filter(([k]) => !k.startsWith('seeker_'));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pricing Management</h1>
          <p className="text-gray-400 mt-1">Adjust subscription and add-on prices. Changes apply immediately.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasEdits}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Subscription Tiers */}
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-400" />
        Seeker Subscriptions
      </h2>
      <div className="grid gap-4 mb-8">
        {seekerTiers.map(([tierId, tier]) => (
          <TierPriceCard
            key={tierId}
            tierId={tierId}
            tier={tier}
            getTierPrice={getTierPrice}
            setTierPrice={setTierPrice}
          />
        ))}
      </div>

      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Zap className="w-5 h-5 text-blue-400" />
        Recruiter Subscriptions
      </h2>
      <div className="grid gap-4 mb-8">
        {recruiterTiers.map(([tierId, tier]) => (
          <TierPriceCard
            key={tierId}
            tierId={tierId}
            tier={tier}
            getTierPrice={getTierPrice}
            setTierPrice={setTierPrice}
          />
        ))}
      </div>

      {/* Consumable Products */}
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <Star className="w-5 h-5 text-cyan-400" />
        Seeker Add-ons
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {seekerProducts.map(([prodId, prod]) => (
          <ProductPriceCard
            key={prodId}
            productId={prodId}
            product={prod}
            getProductPrice={getProductPrice}
            setProductPrice={setProductPrice}
          />
        ))}
      </div>

      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-purple-400" />
        Recruiter Add-ons
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {recruiterProducts.map(([prodId, prod]) => (
          <ProductPriceCard
            key={prodId}
            productId={prodId}
            product={prod}
            getProductPrice={getProductPrice}
            setProductPrice={setProductPrice}
          />
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-4">
        <p>Prices are in USD cents internally. Enter dollar amounts (e.g. $9.99) in the fields above.</p>
        <p className="mt-1">For iOS/Android, prices must match what you configure in App Store Connect / Google Play Console.</p>
      </div>
    </div>
  );
}

function TierPriceCard({ tierId, tier, getTierPrice, setTierPrice }) {
  const durations = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: '6month', label: '6 Months' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{tier.name}</h3>
          <p className="text-xs text-gray-500">{tierId}</p>
        </div>
        <span className="text-xs text-gray-500 px-2 py-1 rounded-lg bg-gray-800">
          Level {tier.tier_level}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {durations.map(dur => {
          const currentCents = getTierPrice(tierId, dur.id);
          const defaultCents = tier.default_prices[dur.id];
          const isOverridden = currentCents !== defaultCents;
          return (
            <div key={dur.id}>
              <label className="block text-xs text-gray-400 mb-1">{dur.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <Input
                  type="text"
                  value={(currentCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const cents = parseDollars(e.target.value);
                    if (cents !== null) setTierPrice(tierId, dur.id, cents);
                  }}
                  className={`pl-7 bg-gray-800 border-gray-700 text-white text-sm ${
                    isOverridden ? 'border-amber-500/50' : ''
                  }`}
                />
              </div>
              {isOverridden && (
                <p className="text-[10px] text-amber-400 mt-0.5">
                  Default: {formatPrice(defaultCents)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductPriceCard({ productId, product, getProductPrice, setProductPrice }) {
  const currentCents = getProductPrice(productId);
  const defaultCents = product.default_price;
  const isOverridden = currentCents !== defaultCents;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <h4 className="font-medium text-white text-sm mb-1">{product.name}</h4>
      <p className="text-[10px] text-gray-500 mb-3">{productId}</p>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Price</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <Input
            type="text"
            value={(currentCents / 100).toFixed(2)}
            onChange={(e) => {
              const cents = parseDollars(e.target.value);
              if (cents !== null) setProductPrice(productId, cents);
            }}
            className={`pl-7 bg-gray-800 border-gray-700 text-white text-sm ${
              isOverridden ? 'border-amber-500/50' : ''
            }`}
          />
        </div>
        {isOverridden && (
          <p className="text-[10px] text-amber-400 mt-0.5">
            Default: {formatPrice(defaultCents)}
          </p>
        )}
      </div>
    </div>
  );
}
