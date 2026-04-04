import { useState } from 'react';
import { MapPin, Briefcase, Send, Loader2 } from 'lucide-react';
import { CANADA_CITIES, US_CITIES, ALL_CITIES, ROLES, PAGE_TYPES } from './blogConstants';

export default function BlogGenerate({ onGenerate, generating }) {
  const [selectedPageType, setSelectedPageType] = useState('jobs_in_city');
  const [selectedCities, setSelectedCities] = useState(new Set());
  const [selectedRoles, setSelectedRoles] = useState(new Set());

  const toggleCity = (city) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      next.has(city) ? next.delete(city) : next.add(city);
      return next;
    });
  };

  const toggleRole = (role) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const selectCities = (cities) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      const allSelected = cities.every(c => next.has(c));
      cities.forEach(c => allSelected ? next.delete(c) : next.add(c));
      return next;
    });
  };

  const selectAllRoles = () => {
    setSelectedRoles(prev => {
      const allSelected = ROLES.every(r => prev.has(r));
      return allSelected ? new Set() : new Set(ROLES);
    });
  };

  const handleSubmit = async () => {
    const success = await onGenerate({
      pageType: selectedPageType,
      cities: [...selectedCities],
      roles: [...selectedRoles],
    });
    if (success) {
      setSelectedCities(new Set());
      setSelectedRoles(new Set());
    }
  };

  const postCount = selectedCities.size * selectedRoles.size;

  return (
    <div className="space-y-6">
      {/* Page Type */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">Page Type</label>
        <select
          value={selectedPageType}
          onChange={e => setSelectedPageType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full max-w-xs"
        >
          {PAGE_TYPES.map(pt => (
            <option key={pt.value} value={pt.value}>{pt.label}</option>
          ))}
        </select>
      </div>

      {/* Cities */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-400" /> Cities
          </h3>
          <div className="flex gap-2">
            <button onClick={() => selectCities(CANADA_CITIES)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs">
              {CANADA_CITIES.every(c => selectedCities.has(c)) ? 'Deselect' : 'Select'} All Canada
            </button>
            <button onClick={() => selectCities(US_CITIES)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs">
              {US_CITIES.every(c => selectedCities.has(c)) ? 'Deselect' : 'Select'} All US
            </button>
            <button onClick={() => selectCities(ALL_CITIES)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs">
              {ALL_CITIES.every(c => selectedCities.has(c)) ? 'Deselect' : 'Select'} All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Canada</h4>
            <div className="space-y-1">
              {CANADA_CITIES.map(city => (
                <label key={city} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedCities.has(city)}
                    onChange={() => toggleCity(city)}
                    className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  {city}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">United States</h4>
            <div className="space-y-1">
              {US_CITIES.map(city => (
                <label key={city} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedCities.has(city)}
                    onChange={() => toggleCity(city)}
                    className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  {city}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-gray-400" /> Roles
          </h3>
          <button onClick={selectAllRoles} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs">
            {ROLES.every(r => selectedRoles.has(r)) ? 'Deselect' : 'Select'} All
          </button>
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1">
          {ROLES.map(role => (
            <label key={role} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={selectedRoles.has(role)}
                onChange={() => toggleRole(role)}
                className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      {/* Preview + Generate */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center justify-between">
        <div className="text-gray-400 text-sm">
          This will generate <span className="text-white font-bold text-lg">{postCount}</span> posts
          {postCount > 0 && (
            <span className="text-gray-500 ml-1">
              ({selectedCities.size} cities x {selectedRoles.size} roles)
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={postCount === 0 || generating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Start Generation
        </button>
      </div>
    </div>
  );
}
