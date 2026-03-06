import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Plus, X, Settings } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminSettings() {
  const { token } = useAdminAuth();
  const [bannedWords, setBannedWords] = useState({});
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('custom');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchWords(); }, [fetchWords]);

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
