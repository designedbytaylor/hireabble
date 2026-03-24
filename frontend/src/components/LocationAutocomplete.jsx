import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { Input } from './ui/input';
import { toast } from 'sonner';

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'e.g., San Francisco, CA',
  className = '',
  inputClassName = '',
  showDetectButton = false,
  allowRemote = false,
  'data-testid': dataTestId,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Don't search if they typed "remote"
    if (query.toLowerCase().startsWith('remote')) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&featuretype=city`
      );
      const data = await res.json();

      const formatted = data
        .filter((item) => {
          // Only show cities/towns/villages, not individual addresses
          const type = item.type;
          const cls = item.class;
          return (
            cls === 'place' ||
            cls === 'boundary' ||
            type === 'city' ||
            type === 'town' ||
            type === 'village' ||
            type === 'suburb' ||
            type === 'administrative'
          );
        })
        .map((item) => {
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || '';
          const state = addr.state || '';
          const country = addr.country || '';

          let label = city;
          if (state) label += `, ${state}`;
          if (country && country !== 'United States') label += `, ${country}`;

          return {
            label: label || item.display_name.split(',').slice(0, 2).join(',').trim(),
            fullLabel: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        })
        // Remove duplicates
        .filter((item, index, self) => self.findIndex((s) => s.label === item.label) === index);

      setSuggestions(formatted);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val, null);

    // Debounce API calls
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocations(val);
      setShowSuggestions(true);
    }, 300);
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.label, { lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          const state = data.address?.state || '';
          let locationStr = city;
          if (state) locationStr += `, ${state}`;
          if (locationStr) {
            onChange(locationStr, { lat: latitude, lng: longitude });
            toast.success(`Location detected: ${locationStr}`);
          } else {
            toast.error('Could not determine your city. Please enter manually.');
          }
        } catch {
          toast.error('Failed to detect location. Please enter manually.');
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        toast.error('Location access denied. Please enter your location manually.');
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          className={`h-11 rounded-xl bg-background ${inputClassName}`}
          data-testid={dataTestId}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showDetectButton && (
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detectingLocation}
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {detectingLocation ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Navigation className="w-3 h-3" />
          )}
          {detectingLocation ? 'Detecting...' : 'Use my current location'}
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}

      {allowRemote && value && !value.toLowerCase().includes('remote') && suggestions.length === 0 && showSuggestions && !loading && value.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No locations found. Type "Remote" for remote positions.
          </div>
        </div>
      )}
    </div>
  );
}
