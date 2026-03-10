import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Palette, Check, Monitor } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminThemes() {
  const { token } = useAdminAuth();
  const { updateTheme } = useTheme();
  const [themes, setThemes] = useState({});
  const [activeTheme, setActiveTheme] = useState('default');
  const [previewTheme, setPreviewTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/themes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setThemes(res.data.themes);
      setActiveTheme(res.data.active);
    } catch {
      toast.error('Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchThemes(); }, [fetchThemes]);

  const activateTheme = async (themeId) => {
    setSaving(true);
    try {
      await axios.post(`${API}/admin/themes`, { theme: themeId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveTheme(themeId);
      updateTheme(themeId);
      setPreviewTheme(null);
      toast.success(`Theme switched to "${themes[themeId]?.name}"`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to set theme');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = (themeId) => {
    setPreviewTheme(themeId);
    // Live-preview in the document so admin can see the effect immediately
    document.documentElement.setAttribute('data-theme', themeId);
  };

  const cancelPreview = () => {
    setPreviewTheme(null);
    // Revert to actual active theme
    document.documentElement.setAttribute('data-theme', activeTheme);
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
        <h1 className="text-2xl font-bold text-white">Themes</h1>
        <p className="text-gray-400 mt-1">
          Choose how Hireabble looks for all users. Preview themes before activating.
        </p>
      </div>

      {/* Preview banner */}
      {previewTheme && previewTheme !== activeTheme && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <Monitor className="w-4 h-4" />
            Previewing "{themes[previewTheme]?.name}" — changes are not saved yet
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancelPreview}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              Cancel
            </Button>
            <Button size="sm" onClick={() => activateTheme(previewTheme)} disabled={saving}
              className="bg-amber-500 text-black hover:bg-amber-600">
              {saving ? 'Saving...' : 'Activate'}
            </Button>
          </div>
        </div>
      )}

      {/* Theme cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(themes).map(([id, theme]) => {
          const isActive = activeTheme === id;
          const isPreviewing = previewTheme === id;
          const colors = theme.preview;

          return (
            <div
              key={id}
              className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
                isActive
                  ? 'border-green-500/50 ring-1 ring-green-500/20'
                  : isPreviewing
                    ? 'border-amber-500/50 ring-1 ring-amber-500/20'
                    : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              {/* Color preview strip */}
              <div className="p-5">
                {/* Mini app mockup */}
                <div
                  className="rounded-xl overflow-hidden border border-white/5 mb-4"
                  style={{ background: colors.background }}
                >
                  {/* Nav bar mockup */}
                  <div className="px-4 py-3 flex items-center justify-between border-b"
                    style={{ borderColor: colors.accent }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: colors.primary }}>
                        <span className="text-[10px] font-bold" style={{ color: colors.text }}>H</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: colors.text }}>hireabble</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: colors.primary }} />
                      <div className="w-2 h-2 rounded-full" style={{ background: colors.secondary }} />
                    </div>
                  </div>

                  {/* Content mockup */}
                  <div className="p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg" style={{ background: colors.accent }} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 rounded-full w-3/4" style={{ background: colors.accent }} />
                        <div className="h-2 rounded-full w-1/2" style={{ background: colors.accent, opacity: 0.6 }} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-7 rounded-full px-3 flex items-center"
                        style={{ background: colors.primary }}>
                        <span className="text-[9px] font-medium" style={{ color: colors.text }}>Apply</span>
                      </div>
                      <div className="h-7 rounded-full px-3 flex items-center"
                        style={{ background: colors.accent, border: `1px solid ${colors.secondary}40` }}>
                        <span className="text-[9px] font-medium" style={{ color: colors.secondary }}>Skip</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom nav mockup */}
                  <div className="px-4 py-2.5 flex justify-around border-t"
                    style={{ borderColor: colors.accent }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="w-4 h-4 rounded"
                        style={{
                          background: i === 0 ? colors.primary : colors.accent,
                          opacity: i === 0 ? 1 : 0.5,
                        }} />
                    ))}
                  </div>
                </div>

                {/* Color swatches */}
                <div className="flex gap-2 mb-4">
                  {Object.entries(colors).filter(([k]) => k !== 'text').map(([key, color]) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <div
                        className="w-8 h-8 rounded-lg border border-white/10"
                        style={{ background: color }}
                        title={key}
                      />
                      <span className="text-[9px] text-gray-500 capitalize">{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info & actions */}
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-white">{theme.name}</h3>
                  {isActive && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-4">{theme.description}</p>

                <div className="flex gap-2">
                  {!isActive && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(id)}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <Monitor className="w-4 h-4 mr-1" /> Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => activateTheme(id)}
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Palette className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Activate'}
                      </Button>
                    </>
                  )}
                  {isActive && (
                    <span className="text-sm text-green-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Currently active for all users
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
