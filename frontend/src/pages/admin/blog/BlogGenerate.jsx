import { useState, useMemo } from 'react';
import { MapPin, Briefcase, Send, Loader2, Layers, Cpu, Building2 } from 'lucide-react';
import { CANADA_CITIES, US_CITIES, ALL_CITIES, ROLES, PAGE_TYPES, INDUSTRIES, TECHNOLOGIES } from './blogConstants';

// Which dimension type does this page type use?
function getDimType(pageType) {
  const pt = PAGE_TYPES.find(p => p.value === pageType);
  return pt?.dim || null;
}

export default function BlogGenerate({ onGenerate, generating }) {
  const [selectedPageType, setSelectedPageType] = useState('jobs_in_city');
  const [selectedCities, setSelectedCities] = useState(new Set());
  const [selectedRoles, setSelectedRoles] = useState(new Set());
  const [selectedIndustries, setSelectedIndustries] = useState(new Set());
  const [selectedTechnologies, setSelectedTechnologies] = useState(new Set());

  const dimType = useMemo(() => getDimType(selectedPageType), [selectedPageType]);
  const needsRoles = dimType !== 'technology' && dimType !== 'city_only';
  const needsIndustries = dimType === 'industry';
  const needsTechnologies = dimType === 'technology';

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

  const toggleIndustry = (ind) => {
    setSelectedIndustries(prev => {
      const next = new Set(prev);
      next.has(ind) ? next.delete(ind) : next.add(ind);
      return next;
    });
  };

  const toggleTech = (tech) => {
    setSelectedTechnologies(prev => {
      const next = new Set(prev);
      next.has(tech) ? next.delete(tech) : next.add(tech);
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

  const selectAllIndustries = () => {
    setSelectedIndustries(prev => {
      const allSelected = INDUSTRIES.every(i => prev.has(i));
      return allSelected ? new Set() : new Set(INDUSTRIES);
    });
  };

  const selectAllTech = () => {
    setSelectedTechnologies(prev => {
      const allSelected = TECHNOLOGIES.every(t => prev.has(t));
      return allSelected ? new Set() : new Set(TECHNOLOGIES);
    });
  };

  // Estimate post count
  const postCount = useMemo(() => {
    const c = selectedCities.size;
    const r = selectedRoles.size;
    if (c === 0) return 0;
    if (dimType === 'city_only') return c;
    if (dimType === 'technology') return c * selectedTechnologies.size;
    if (dimType === 'industry') return c * r * selectedIndustries.size;
    // role2 and city2 use curated pairs, so estimate
    if (dimType === 'role2') return c * 25; // ~25 curated pairs
    if (dimType === 'city2') return 28 * r; // ~28 curated city pairs
    return c * r;
  }, [selectedCities.size, selectedRoles.size, selectedIndustries.size, selectedTechnologies.size, dimType]);

  const handleSubmit = async () => {
    const extras = {};
    if (needsIndustries) extras.industries = [...selectedIndustries];
    if (needsTechnologies) extras.technologies = [...selectedTechnologies];

    const success = await onGenerate({
      pageType: selectedPageType,
      cities: [...selectedCities],
      roles: needsRoles ? [...selectedRoles] : [],
      extras,
    });
    if (success) {
      setSelectedCities(new Set());
      setSelectedRoles(new Set());
      setSelectedIndustries(new Set());
      setSelectedTechnologies(new Set());
    }
  };

  // Group page types by tier
  const tier1 = PAGE_TYPES.filter(p => p.tier === 1);
  const tier2 = PAGE_TYPES.filter(p => p.tier === 2);
  const tier3 = PAGE_TYPES.filter(p => p.tier === 3);

  return (
    <div className="space-y-6">
      {/* Page Type */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">Page Type</label>
        <select
          value={selectedPageType}
          onChange={e => setSelectedPageType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full max-w-md"
        >
          <optgroup label="Tier 1 — Standard (city × role)">
            {tier1.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </optgroup>
          <optgroup label="Tier 2 — Extended">
            {tier2.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label}{pt.dim ? ` [${pt.dim}]` : ''}</option>
            ))}
          </optgroup>
          <optgroup label="Tier 3 — Advanced">
            {tier3.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label}{pt.dim ? ` [${pt.dim}]` : ''}</option>
            ))}
          </optgroup>
        </select>
        {dimType && (
          <p className="text-xs text-gray-500 mt-2">
            {dimType === 'role2' && 'Uses curated role comparison pairs. Select cities + roles to filter.'}
            {dimType === 'industry' && 'Generates posts for each city × role × industry combination.'}
            {dimType === 'technology' && 'Generates posts for each city × technology. No roles needed.'}
            {dimType === 'city2' && 'Uses curated city comparison pairs. Select cities + roles.'}
            {dimType === 'city_only' && 'Generates one post per city. No roles needed.'}
          </p>
        )}
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

      {/* Roles — hidden for technology and city_only types */}
      {needsRoles && (
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
      )}

      {/* Industries — only for industry_guide */}
      {needsIndustries && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400" /> Industries
            </h3>
            <button onClick={selectAllIndustries} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs">
              {INDUSTRIES.every(i => selectedIndustries.has(i)) ? 'Deselect' : 'Select'} All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-x-6 gap-y-1">
            {INDUSTRIES.map(ind => (
              <label key={ind} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedIndustries.has(ind)}
                  onChange={() => toggleIndustry(ind)}
                  className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                />
                {ind}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Technologies — only for technology_stack */}
      {needsTechnologies && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gray-400" /> Technologies
            </h3>
            <button onClick={selectAllTech} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-xs">
              {TECHNOLOGIES.every(t => selectedTechnologies.has(t)) ? 'Deselect' : 'Select'} All
            </button>
          </div>
          <div className="grid grid-cols-4 gap-x-6 gap-y-1">
            {TECHNOLOGIES.map(tech => (
              <label key={tech} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedTechnologies.has(tech)}
                  onChange={() => toggleTech(tech)}
                  className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                />
                {tech}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Preview + Generate */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center justify-between">
        <div className="text-gray-400 text-sm">
          <Layers className="w-4 h-4 inline mr-1" />
          Estimated: <span className="text-white font-bold text-lg">{postCount.toLocaleString()}</span> posts
          {dimType === 'role2' && <span className="text-gray-500 ml-1">(curated pairs × {selectedCities.size} cities)</span>}
          {dimType === 'city2' && <span className="text-gray-500 ml-1">(curated city pairs × {selectedRoles.size} roles)</span>}
          {dimType === 'city_only' && <span className="text-gray-500 ml-1">({selectedCities.size} cities)</span>}
          {dimType === 'technology' && <span className="text-gray-500 ml-1">({selectedCities.size} cities × {selectedTechnologies.size} technologies)</span>}
          {dimType === 'industry' && <span className="text-gray-500 ml-1">({selectedCities.size} × {selectedRoles.size} × {selectedIndustries.size})</span>}
          {!dimType && postCount > 0 && <span className="text-gray-500 ml-1">({selectedCities.size} cities × {selectedRoles.size} roles)</span>}
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
