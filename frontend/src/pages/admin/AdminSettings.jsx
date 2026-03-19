import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Plus, X, Settings, Lock, Eye, EyeOff, Smartphone, Apple, Save, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSettings() {
  const { token } = useAdminAuth();
  const [bannedWords, setBannedWords] = useState({});
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('custom');
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [appStoreSettings, setAppStoreSettings] = useState({
    apple_team_id: '',
    apple_shared_secret: '',
    android_sha256_fingerprint: '',
    app_store_url: '',
    play_store_url: '',
  });
  const [savingAppStore, setSavingAppStore] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  const fetchAppStoreSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/app-store-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppStoreSettings(prev => ({ ...prev, ...res.data }));
    } catch (e) {
      // Settings may not exist yet, that's OK
    }
  }, [token]);

  const saveAppStoreSettings = async () => {
    setSavingAppStore(true);
    try {
      const payload = { ...appStoreSettings };
      // Don't send empty secret if user didn't change it
      if (!payload.apple_shared_secret) delete payload.apple_shared_secret;
      await axios.put(`${API}/admin/app-store-settings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('App store settings saved');
      fetchAppStoreSettings();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSavingAppStore(false);
    }
  };

  const fetchWords = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/banned-words`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBannedWords(res.data);
    } catch (e) {
      toast.error('Failed to load banned words');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetch2FASettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/2fa/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFactorEnabled(res.data.enabled);
    } catch (e) {
      // Setting may not exist yet
    }
  }, [token]);

  const toggle2FA = async () => {
    setToggling2FA(true);
    try {
      const res = await axios.put(`${API}/admin/2fa/settings`, { enabled: !twoFactorEnabled }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFactorEnabled(res.data.enabled);
      toast.success(res.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update 2FA setting');
    } finally {
      setToggling2FA(false);
    }
  };

  useEffect(() => { fetchWords(); fetchAppStoreSettings(); fetch2FASettings(); }, [fetchWords, fetchAppStoreSettings, fetch2FASettings]);

  const addWord = async () => {
    if (!newWord.trim()) return;
    try {
      await axios.post(`${API}/admin/banned-words`, {
        word: newWord.trim(),
        category: newCategory,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Added "${newWord.trim()}"`);
      setNewWord('');
      fetchWords();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add word');
    }
  };

  const removeWord = async (word) => {
    try {
      await axios.delete(`${API}/admin/banned-words/${encodeURIComponent(word)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Removed "${word}"`);
      fetchWords();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove word (may be a built-in word)');
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one number');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one special character');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await axios.post(`${API}/admin/change-password`, { new_password: newPassword }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const categoryColors = {
    sexual: 'border-pink-500/30 text-pink-400',
    drugs: 'border-green-500/30 text-green-400',
    alcohol: 'border-amber-500/30 text-amber-400',
    violence: 'border-red-500/30 text-red-400',
    fraud: 'border-orange-500/30 text-orange-400',
    profanity: 'border-purple-500/30 text-purple-400',
    custom: 'border-blue-500/30 text-blue-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Content Settings</h1>
        <p className="text-gray-400 mt-1">Manage banned words and content filtering rules</p>
      </div>

      {/* Email 2FA */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          When enabled, admin logins will require a verification code sent to the admin's email address.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={toggle2FA}
            disabled={toggling2FA}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${twoFactorEnabled ? 'bg-emerald-600' : 'bg-gray-600'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              Email verification is {twoFactorEnabled ? <span className="text-emerald-400 font-medium">enabled</span> : <span className="text-gray-500">disabled</span>}
            </span>
          </div>
        </div>
      </div>

      {/* App Store Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">App Store Settings</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Configure platform-specific settings for iOS and Android app store submissions.
        </p>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Apple Team ID</label>
            <Input
              placeholder="e.g., A1B2C3D4E5"
              value={appStoreSettings.apple_team_id}
              onChange={(e) => setAppStoreSettings(s => ({ ...s, apple_team_id: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Found in Apple Developer Portal → Membership → Team ID</p>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Apple Shared Secret (IAP)</label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                placeholder="Enter shared secret from App Store Connect"
                value={appStoreSettings.apple_shared_secret}
                onChange={(e) => setAppStoreSettings(s => ({ ...s, apple_shared_secret: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">App Store Connect → App → App Information → Shared Secret</p>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Android SHA-256 Fingerprint</label>
            <Input
              placeholder="e.g., AB:CD:EF:12:34:..."
              value={appStoreSettings.android_sha256_fingerprint}
              onChange={(e) => setAppStoreSettings(s => ({ ...s, android_sha256_fingerprint: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">From your Android signing keystore. Used for App Links verification.</p>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">App Store URL</label>
            <Input
              placeholder="https://apps.apple.com/app/hireabble/id..."
              value={appStoreSettings.app_store_url}
              onChange={(e) => setAppStoreSettings(s => ({ ...s, app_store_url: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Play Store URL</label>
            <Input
              placeholder="https://play.google.com/store/apps/details?id=com.hireabble.app"
              value={appStoreSettings.play_store_url}
              onChange={(e) => setAppStoreSettings(s => ({ ...s, play_store_url: e.target.value }))}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <Button
            onClick={saveAppStoreSettings}
            disabled={savingAppStore}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1" />
            {savingAppStore ? 'Saving...' : 'Save App Store Settings'}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold text-white">Change Admin Password</h2>
        </div>
        <div className="space-y-3 max-w-md">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && changePassword()}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          />
          <Button
            onClick={changePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {changingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </div>

      {/* Add new word */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Add Banned Word</h2>
        <div className="flex gap-3">
          <Input
            placeholder="Enter word or phrase..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWord()}
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm"
          >
            <option value="custom">Custom</option>
            <option value="sexual">Sexual</option>
            <option value="drugs">Drugs</option>
            <option value="alcohol">Alcohol</option>
            <option value="violence">Violence</option>
            <option value="fraud">Fraud</option>
            <option value="profanity">Profanity</option>
          </select>
          <Button onClick={addWord} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Banned words by category */}
      <div className="space-y-6">
        {Object.entries(bannedWords).map(([category, words]) => (
          <div key={category} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white capitalize">{category}</h3>
              <Badge variant="outline" className="border-gray-600 text-gray-400">
                {words.length} words
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {words.map((word) => (
                <Badge
                  key={word}
                  variant="outline"
                  className={`${categoryColors[category] || categoryColors.custom} cursor-default group`}
                >
                  {word}
                  {category === 'custom' && (
                    <button
                      onClick={() => removeWord(word)}
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
