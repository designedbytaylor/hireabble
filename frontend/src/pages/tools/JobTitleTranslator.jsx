import { useState, useMemo } from 'react';
import { Search, Building2, Rocket, Briefcase, Globe, ArrowRight, Compass, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';
import { TITLE_MAP, TITLE_NAMES } from '../../data/jobTitleData';

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

export default function JobTitleTranslator() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredTitles = useMemo(() => {
    if (!searchQuery.trim()) return TITLE_NAMES;
    const q = searchQuery.toLowerCase();
    return TITLE_NAMES.filter(t => t.toLowerCase().includes(q));
  }, [searchQuery]);

  const selectTitle = (title) => {
    setSelectedTitle(title);
    setSearchQuery(title);
    setShowDropdown(false);
  };

  const data = selectedTitle ? TITLE_MAP[selectedTitle] : null;

  return (
    <ToolLayout title="Job Title Translator" description="Find equivalent job titles across startups, enterprises, agencies, and international markets.">
      {/* Search input */}
      <div className="glass-card rounded-2xl p-6">
        <label className="block text-sm font-medium mb-1">Your Current Job Title</label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className={inputClass + ' pl-9'}
              placeholder="Search for a job title..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                if (!e.target.value.trim()) setSelectedTitle('');
              }}
              onFocus={() => setShowDropdown(true)}
            />
          </div>
          {showDropdown && filteredTitles.length > 0 && (
            <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
              {filteredTitles.map(title => (
                <button
                  key={title}
                  onClick={() => selectTitle(title)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${title === selectedTitle ? 'bg-primary/10 text-primary font-medium' : ''}`}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
          {showDropdown && filteredTitles.length === 0 && searchQuery.trim() && (
            <div className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-background shadow-lg p-3">
              <p className="text-sm text-muted-foreground">No matching titles found. Try a different search term.</p>
            </div>
          )}
        </div>
        {!selectedTitle && (
          <p className="text-xs text-muted-foreground mt-2">Select a title to see equivalents across {TITLE_NAMES.length} mapped roles.</p>
        )}
      </div>

      {/* Click-outside handler via overlay */}
      {showDropdown && (
        <div className="fixed inset-0 z-0" onClick={() => setShowDropdown(false)} />
      )}

      {data && (
        <div className="mt-6 space-y-6">
          {/* Startup equivalents */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold font-['Outfit']">At a Startup, you'd be called...</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.startup.map((title, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {title}
                </span>
              ))}
            </div>
          </div>

          {/* Enterprise equivalents */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold font-['Outfit']">At a Large Company, you'd be called...</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.enterprise.map((title, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {title}
                </span>
              ))}
            </div>
          </div>

          {/* Agency equivalents */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold font-['Outfit']">At an Agency, you'd be called...</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.agency.map((title, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {title}
                </span>
              ))}
            </div>
          </div>

          {/* International equivalents */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold font-['Outfit']">International Equivalents</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(data.international).map(([code, title]) => {
                const countryNames = { uk: 'United Kingdom', aus: 'Australia', de: 'Germany', fr: 'France' };
                const flags = { uk: '\uD83C\uDDEC\uD83C\uDDE7', aus: '\uD83C\uDDE6\uD83C\uDDFA', de: '\uD83C\uDDE9\uD83C\uDDEA', fr: '\uD83C\uDDEB\uD83C\uDDF7' };
                return (
                  <div key={code} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <span className="text-xl">{flags[code] || code.toUpperCase()}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">{countryNames[code] || code.toUpperCase()}</p>
                      <p className="text-sm font-medium">{title}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Career progression */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="w-5 h-5 text-primary" />
              <h3 className="font-semibold font-['Outfit']">Career Progression Path</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {data.seniorPath.map((title, i) => {
                const isCurrent = title === selectedTitle || title.toLowerCase().includes(selectedTitle.toLowerCase().split(' ')[0]);
                return (
                  <div key={i} className="flex items-center">
                    <span className={`px-3 py-1.5 rounded-lg text-sm ${isCurrent ? 'bg-primary/15 text-primary font-semibold border border-primary/30' : 'bg-muted/50 text-muted-foreground'}`}>
                      {title}
                    </span>
                    {i < data.seniorPath.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Adjacent roles */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Compass className="w-5 h-5 text-cyan-500" />
              <h3 className="font-semibold font-['Outfit']">Adjacent Roles to Explore</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.adjacent.map((role, i) => {
                const isClickable = TITLE_MAP[role];
                return (
                  <button
                    key={i}
                    onClick={() => isClickable && selectTitle(role)}
                    disabled={!isClickable}
                    className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${isClickable ? 'hover:bg-cyan-500/10 hover:border-cyan-500/30 cursor-pointer' : 'cursor-default'} border border-border/50`}
                  >
                    <Compass className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                    <span className="text-sm">{role}</span>
                    {isClickable && <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
