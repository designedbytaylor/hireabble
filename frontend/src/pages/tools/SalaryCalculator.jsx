import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';
import { CITIES, ROLES, getAllLevels, getTopCities, getCurrency } from '../../data/salaryData';

const fmt = (n) => `$${(n / 1000).toFixed(0)}k`;

const canadianCities = CITIES.filter(c => c.country === 'Canada');
const usCities = CITIES.filter(c => c.country === 'United States');

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="text-primary">{`$${payload[0].value.toLocaleString()}`}</p>
    </div>
  );
};

export default function SalaryCalculator() {
  const [role, setRole] = useState('');
  const [city, setCity] = useState('');
  const [level, setLevel] = useState('mid');
  const [result, setResult] = useState(null);

  const calculate = (e) => {
    e.preventDefault();
    const levels = getAllLevels(role, city);
    const currency = getCurrency(city);
    const country = CITIES.find(c => c.name === city)?.country;
    const topCities = getTopCities(role, level, 5, country);
    setResult({ levels, topCities, role, city, level, currency, country });
  };

  const selectClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  const levelData = result ? [
    { name: 'Junior', min: result.levels.junior?.[0] || 0, max: result.levels.junior?.[1] || 0 },
    { name: 'Mid-Level', min: result.levels.mid?.[0] || 0, max: result.levels.mid?.[1] || 0 },
    { name: 'Senior', min: result.levels.senior?.[0] || 0, max: result.levels.senior?.[1] || 0 },
  ] : [];

  const cityData = result?.topCities?.map(d => ({
    name: d.city,
    salary: d.salary[1],
    min: d.salary[0],
  })) || [];

  return (
    <ToolLayout title="Salary Calculator" description="Compare salaries across 40 Canadian and US cities for 30+ roles. Updated for 2025-2026 market rates.">
      <form onSubmit={calculate} className="glass-card rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Job Title</label>
            <select className={selectClass} value={role} onChange={e => setRole(e.target.value)} required>
              <option value="">Select a role...</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <select className={selectClass} value={city} onChange={e => setCity(e.target.value)} required>
              <option value="">Select a city...</option>
              <optgroup label="Canada (CAD)">
                {canadianCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </optgroup>
              <optgroup label="United States (USD)">
                {usCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Experience Level</label>
            <select className={selectClass} value={level} onChange={e => setLevel(e.target.value)}>
              <option value="junior">Junior (0-2 years)</option>
              <option value="mid">Mid-Level (3-5 years)</option>
              <option value="senior">Senior (7+ years)</option>
            </select>
          </div>
        </div>
        <Button type="submit" className="w-full">
          <DollarSign className="w-4 h-4 mr-2" /> Calculate Salary
        </Button>
      </form>

      {result && result.levels[result.level] && (
        <div className="mt-6 space-y-6">
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-muted-foreground text-sm">{result.role} in {result.city}</p>
            <p className="text-4xl font-bold font-['Outfit'] text-primary mt-2">
              {fmt(result.levels[result.level][0])} — {fmt(result.levels[result.level][1])}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {result.level === 'junior' ? 'Junior' : result.level === 'mid' ? 'Mid-Level' : 'Senior'} range (annual, {result.currency})
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold font-['Outfit'] mb-4">Salary by Experience Level</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={levelData} barCategoryGap="25%">
                <XAxis dataKey="name" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="max" radius={[6, 6, 0, 0]}>
                  {levelData.map((_, i) => (
                    <Cell key={i} fill={i === (result.level === 'junior' ? 0 : result.level === 'mid' ? 1 : 2) ? 'hsl(173, 58%, 39%)' : 'hsl(215, 25%, 25%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {cityData.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold font-['Outfit'] mb-4">
                Top Paying {result.country === 'United States' ? 'US' : 'Canadian'} Cities for {result.role}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cityData} barCategoryGap="25%">
                  <XAxis dataKey="name" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar dataKey="salary" fill="hsl(215, 70%, 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Estimates based on 2025-2026 market data from Statistics Canada, Bureau of Labor Statistics, and public salary surveys. Actual compensation varies by company, experience, and negotiation.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
