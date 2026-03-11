import { useState, useEffect, useRef } from 'react';
import { StickyNote, Check, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CandidateNotes({ seekerId, token }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!seekerId) return;
    setLoaded(false);
    axios.get(`${API}/candidates/${seekerId}/note`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      setNote(res.data.note || '');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [seekerId, token]);

  const saveNote = (text) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await axios.put(`${API}/candidates/${seekerId}/note`, { note: text }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch { /* silent */ }
      finally { setSaving(false); }
    }, 600);
  };

  const handleChange = (e) => {
    const text = e.target.value.slice(0, 2000);
    setNote(text);
    saveNote(text);
  };

  if (!loaded) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase">Private Notes</span>
        {saving && <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />}
        {saved && <Check className="w-3 h-3 text-success" />}
      </div>
      <textarea
        value={note}
        onChange={handleChange}
        placeholder="Add private notes about this candidate..."
        className="w-full min-h-[60px] max-h-[120px] p-3 rounded-xl bg-accent/50 border border-border text-sm resize-none outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/50"
        maxLength={2000}
      />
    </div>
  );
}
