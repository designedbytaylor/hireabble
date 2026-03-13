import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Navigation2, Loader2, X } from 'lucide-react';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Location autocomplete input using OpenStreetMap Nominatim.
 * Ensures users select a real, standardized location (e.g., "San Francisco, CA, USA").
 *
 * Props:
 *  - value: current location string
 *  - onChange: (locationString) => void
 *  - placeholder: input placeholder
 *  - className: extra classes for the wrapper
 *  - allowRemote: show "Remote" option (default false)
 *  - testId: data-testid for the input
 */
export default function LocationInput({ value, onChange, placeholder, className = '', allowRemote = false, testId }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${NOMINATIM_URL}/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&dedupe=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      // Format results into "City, State, Country" style strings
      const formatted = data
        .filter(r => r.address)
        .map(r => {
          const a = r.address;
          const city = a.city || a.town || a.village || a.municipality || a.county || '';
          const state = a.state || a.region || '';
          const country = a.country || '';
          // Build display string
          const parts = [city, state, country].filter(Boolean);
          return {
            display: parts.join(', '),
            raw: r.display_name,
            lat: r.lat,
            lon: r.lon,
          };
        })
        .filter(r => r.display.length > 0)
        // Dedupe by display string
        .filter((r, i, arr) => arr.findIndex(x => x.display === r.display) === i);
      setSuggestions(formatted);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    // Clear selected value when typing (force re-selection)
    onChange('');
    // Debounce API calls
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 300);
  };

  const handleSelect = (location) => {
    setQuery(location.display);
    onChange(location.display);
    setOpen(false);
    setSuggestions([]);
  };

  const handleSelectRemote = () => {
    setQuery('Remote');
    onChange('Remote');
    setOpen(false);
    setSuggestions([]);
  };

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `${NOMINATIM_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.address) {
        const a = data.address;
        const city = a.city || a.town || a.village || a.municipality || '';
        const state = a.state || '';
        const country = a.country || '';
        const display = [city, state, country].filter(Boolean).join(', ');
        setQuery(display);
        onChange(display);
      }
    } catch {
      // Silently fail — user denied or timeout
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (suggestions.length > 0 || query.length >= 2) setOpen(true); }}
          placeholder={placeholder || 'Start typing a city...'}
          className="w-full h-11 pl-9 pr-16 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          data-testid={testId}
          autoComplete="off"
          aria-label="Location"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button type="button" onClick={handleClear} className="p-1 rounded-md hover:bg-accent transition-colors" aria-label="Clear location">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={detectingLocation}
            className="p-1 rounded-md hover:bg-primary/10 transition-colors"
            title="Use my current location"
            aria-label="Detect my location"
          >
            {detectingLocation ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <Navigation2 className="w-4 h-4 text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {open && (query.length >= 2 || allowRemote) && (
        <div className="absolute z-50 w-full mt-1 rounded-xl bg-card border border-border shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </div>
          )}
          {allowRemote && (
            <button
              type="button"
              onClick={handleSelectRemote}
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 border-b border-border"
            >
              <span className="text-primary font-medium">Remote / No fixed location</span>
            </button>
          )}
          {!loading && suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span>{s.display}</span>
            </button>
          ))}
          {!loading && suggestions.length === 0 && query.length >= 2 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No locations found. Try a different search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
