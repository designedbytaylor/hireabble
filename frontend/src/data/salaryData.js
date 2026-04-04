// Salary data for Canadian and US cities — 2025-2026 market rates
// Sources: Statistics Canada, BLS, Glassdoor, Levels.fyi, public salary surveys

export const CITIES = [
  // Canada
  { name: 'Toronto', country: 'Canada' },
  { name: 'Vancouver', country: 'Canada' },
  { name: 'Montreal', country: 'Canada' },
  { name: 'Calgary', country: 'Canada' },
  { name: 'Ottawa', country: 'Canada' },
  { name: 'Edmonton', country: 'Canada' },
  { name: 'Winnipeg', country: 'Canada' },
  { name: 'Quebec City', country: 'Canada' },
  { name: 'Hamilton', country: 'Canada' },
  { name: 'Kitchener', country: 'Canada' },
  { name: 'London', country: 'Canada' },
  { name: 'Halifax', country: 'Canada' },
  { name: 'Victoria', country: 'Canada' },
  { name: 'Saskatoon', country: 'Canada' },
  { name: 'Regina', country: 'Canada' },
  { name: "St. John's", country: 'Canada' },
  { name: 'Kelowna', country: 'Canada' },
  { name: 'Barrie', country: 'Canada' },
  { name: 'Windsor', country: 'Canada' },
  { name: 'Mississauga', country: 'Canada' },
  // United States (USD — labeled in UI)
  { name: 'New York', country: 'United States' },
  { name: 'San Francisco', country: 'United States' },
  { name: 'Los Angeles', country: 'United States' },
  { name: 'Chicago', country: 'United States' },
  { name: 'Seattle', country: 'United States' },
  { name: 'Austin', country: 'United States' },
  { name: 'Boston', country: 'United States' },
  { name: 'Denver', country: 'United States' },
  { name: 'Miami', country: 'United States' },
  { name: 'Dallas', country: 'United States' },
  { name: 'Atlanta', country: 'United States' },
  { name: 'Phoenix', country: 'United States' },
  { name: 'Minneapolis', country: 'United States' },
  { name: 'Portland', country: 'United States' },
  { name: 'San Diego', country: 'United States' },
  { name: 'Washington DC', country: 'United States' },
  { name: 'Philadelphia', country: 'United States' },
  { name: 'Nashville', country: 'United States' },
  { name: 'Raleigh', country: 'United States' },
  { name: 'Charlotte', country: 'United States' },
];

export const CANADIAN_CITIES = CITIES.filter(c => c.country === 'Canada').map(c => c.name);
export const US_CITIES = CITIES.filter(c => c.country === 'United States').map(c => c.name);
export const ALL_CITY_NAMES = CITIES.map(c => c.name);

// Multipliers relative to Toronto (CAD) for Canadian cities, and relative to national US avg for US cities
const CITY_MULTIPLIERS = {
  // Canada (CAD)
  'Toronto': 1.0, 'Vancouver': 1.06, 'Montreal': 0.88, 'Calgary': 0.97,
  'Ottawa': 0.96, 'Edmonton': 0.93, 'Winnipeg': 0.84, 'Quebec City': 0.82,
  'Hamilton': 0.90, 'Kitchener': 0.93, 'London': 0.85, 'Halifax': 0.87,
  'Victoria': 0.95, 'Saskatoon': 0.86, 'Regina': 0.85, "St. John's": 0.88,
  'Kelowna': 0.90, 'Barrie': 0.88, 'Windsor': 0.83, 'Mississauga': 0.98,
  // US (USD) — multipliers relative to US national average
  'New York': 1.30, 'San Francisco': 1.38, 'Los Angeles': 1.18, 'Chicago': 1.05,
  'Seattle': 1.22, 'Austin': 1.08, 'Boston': 1.20, 'Denver': 1.08,
  'Miami': 1.02, 'Dallas': 1.02, 'Atlanta': 1.0, 'Phoenix': 0.95,
  'Minneapolis': 1.05, 'Portland': 1.08, 'San Diego': 1.12, 'Washington DC': 1.22,
  'Philadelphia': 1.05, 'Nashville': 0.98, 'Raleigh': 1.02, 'Charlotte': 0.97,
};

export const ROLES = [
  'Software Developer', 'Data Analyst', 'Project Manager', 'Registered Nurse',
  'Marketing Manager', 'Accountant', 'Graphic Designer', 'Sales Representative',
  'HR Manager', 'Electrician', 'Mechanical Engineer', 'Teacher', 'Pharmacist',
  'Financial Analyst', 'UX Designer', 'DevOps Engineer', 'Business Analyst',
  'Civil Engineer', 'Dental Hygienist', 'Social Worker', 'Construction Manager',
  'Plumber', 'Welder', 'Truck Driver', 'Administrative Assistant',
  'Customer Service Rep', 'Retail Manager', 'Chef', 'Physiotherapist', 'Paramedic',
];

// Base salaries in CAD (Toronto) for Canadian cities, USD (national avg) for US cities
// Updated for 2025-2026 market rates
const BASE_SALARIES_CAD = {
  'Software Developer':       { junior: [60000, 78000], mid: [82000, 110000], senior: [115000, 155000] },
  'Data Analyst':             { junior: [52000, 65000], mid: [68000, 90000],  senior: [95000, 125000] },
  'Project Manager':          { junior: [58000, 72000], mid: [76000, 100000], senior: [105000, 140000] },
  'Registered Nurse':         { junior: [62000, 72000], mid: [74000, 90000],  senior: [92000, 110000] },
  'Marketing Manager':        { junior: [52000, 65000], mid: [70000, 92000],  senior: [96000, 130000] },
  'Accountant':               { junior: [48000, 60000], mid: [62000, 82000],  senior: [86000, 115000] },
  'Graphic Designer':         { junior: [42000, 52000], mid: [55000, 72000],  senior: [76000, 98000] },
  'Sales Representative':     { junior: [44000, 58000], mid: [60000, 82000],  senior: [86000, 125000] },
  'HR Manager':               { junior: [54000, 66000], mid: [70000, 92000],  senior: [96000, 125000] },
  'Electrician':              { junior: [50000, 62000], mid: [65000, 82000],  senior: [85000, 105000] },
  'Mechanical Engineer':      { junior: [58000, 72000], mid: [76000, 98000],  senior: [102000, 135000] },
  'Teacher':                  { junior: [48000, 58000], mid: [62000, 78000],  senior: [82000, 100000] },
  'Pharmacist':               { junior: [80000, 95000], mid: [98000, 115000], senior: [118000, 140000] },
  'Financial Analyst':        { junior: [55000, 68000], mid: [72000, 95000],  senior: [98000, 130000] },
  'UX Designer':              { junior: [55000, 70000], mid: [74000, 98000],  senior: [102000, 135000] },
  'DevOps Engineer':          { junior: [65000, 82000], mid: [88000, 115000], senior: [120000, 160000] },
  'Business Analyst':         { junior: [54000, 66000], mid: [70000, 92000],  senior: [96000, 125000] },
  'Civil Engineer':           { junior: [56000, 68000], mid: [72000, 92000],  senior: [96000, 128000] },
  'Dental Hygienist':         { junior: [60000, 72000], mid: [74000, 90000],  senior: [92000, 108000] },
  'Social Worker':            { junior: [46000, 56000], mid: [58000, 74000],  senior: [76000, 95000] },
  'Construction Manager':     { junior: [60000, 75000], mid: [78000, 100000], senior: [105000, 140000] },
  'Plumber':                  { junior: [48000, 60000], mid: [62000, 80000],  senior: [82000, 105000] },
  'Welder':                   { junior: [44000, 56000], mid: [58000, 76000],  senior: [78000, 100000] },
  'Truck Driver':             { junior: [44000, 55000], mid: [58000, 72000],  senior: [75000, 92000] },
  'Administrative Assistant': { junior: [35000, 44000], mid: [46000, 56000],  senior: [58000, 70000] },
  'Customer Service Rep':     { junior: [33000, 42000], mid: [44000, 54000],  senior: [56000, 68000] },
  'Retail Manager':           { junior: [40000, 50000], mid: [52000, 66000],  senior: [68000, 86000] },
  'Chef':                     { junior: [36000, 46000], mid: [48000, 62000],  senior: [65000, 85000] },
  'Physiotherapist':          { junior: [60000, 72000], mid: [75000, 92000],  senior: [95000, 115000] },
  'Paramedic':                { junior: [55000, 66000], mid: [68000, 84000],  senior: [86000, 105000] },
};

// US base salaries (USD) — national average, 2025-2026
const BASE_SALARIES_USD = {
  'Software Developer':       { junior: [70000, 92000],  mid: [95000, 135000],  senior: [140000, 195000] },
  'Data Analyst':             { junior: [55000, 72000],  mid: [75000, 100000],  senior: [105000, 140000] },
  'Project Manager':          { junior: [62000, 78000],  mid: [82000, 110000],  senior: [115000, 155000] },
  'Registered Nurse':         { junior: [58000, 72000],  mid: [75000, 95000],   senior: [98000, 120000] },
  'Marketing Manager':        { junior: [55000, 72000],  mid: [75000, 105000],  senior: [110000, 150000] },
  'Accountant':               { junior: [50000, 65000],  mid: [68000, 90000],   senior: [95000, 125000] },
  'Graphic Designer':         { junior: [42000, 55000],  mid: [58000, 78000],   senior: [82000, 108000] },
  'Sales Representative':     { junior: [45000, 62000],  mid: [65000, 92000],   senior: [95000, 145000] },
  'HR Manager':               { junior: [58000, 72000],  mid: [75000, 100000],  senior: [105000, 140000] },
  'Electrician':              { junior: [42000, 55000],  mid: [58000, 78000],   senior: [80000, 105000] },
  'Mechanical Engineer':      { junior: [62000, 78000],  mid: [82000, 108000],  senior: [112000, 148000] },
  'Teacher':                  { junior: [40000, 52000],  mid: [54000, 68000],   senior: [70000, 92000] },
  'Pharmacist':               { junior: [110000, 125000],mid: [128000, 145000], senior: [148000, 170000] },
  'Financial Analyst':        { junior: [58000, 75000],  mid: [78000, 105000],  senior: [110000, 148000] },
  'UX Designer':              { junior: [62000, 80000],  mid: [85000, 115000],  senior: [118000, 158000] },
  'DevOps Engineer':          { junior: [75000, 95000],  mid: [100000, 135000], senior: [140000, 190000] },
  'Business Analyst':         { junior: [58000, 72000],  mid: [75000, 100000],  senior: [105000, 140000] },
  'Civil Engineer':           { junior: [58000, 72000],  mid: [75000, 98000],   senior: [102000, 135000] },
  'Dental Hygienist':         { junior: [62000, 75000],  mid: [78000, 92000],   senior: [95000, 112000] },
  'Social Worker':            { junior: [42000, 52000],  mid: [55000, 68000],   senior: [70000, 88000] },
  'Construction Manager':     { junior: [62000, 78000],  mid: [82000, 108000],  senior: [112000, 148000] },
  'Plumber':                  { junior: [42000, 58000],  mid: [60000, 78000],   senior: [80000, 105000] },
  'Welder':                   { junior: [38000, 50000],  mid: [52000, 68000],   senior: [70000, 92000] },
  'Truck Driver':             { junior: [45000, 58000],  mid: [60000, 78000],   senior: [80000, 100000] },
  'Administrative Assistant': { junior: [32000, 42000],  mid: [44000, 55000],   senior: [58000, 72000] },
  'Customer Service Rep':     { junior: [30000, 40000],  mid: [42000, 52000],   senior: [54000, 68000] },
  'Retail Manager':           { junior: [38000, 50000],  mid: [52000, 68000],   senior: [70000, 92000] },
  'Chef':                     { junior: [32000, 42000],  mid: [44000, 60000],   senior: [62000, 85000] },
  'Physiotherapist':          { junior: [65000, 78000],  mid: [80000, 98000],   senior: [100000, 122000] },
  'Paramedic':                { junior: [38000, 48000],  mid: [50000, 65000],   senior: [68000, 85000] },
};

export function getCityCountry(cityName) {
  const city = CITIES.find(c => c.name === cityName);
  return city?.country || 'Canada';
}

export function getCurrency(cityName) {
  return getCityCountry(cityName) === 'United States' ? 'USD' : 'CAD';
}

export function getSalary(role, city, level) {
  const country = getCityCountry(city);
  const baseSalaries = country === 'United States' ? BASE_SALARIES_USD : BASE_SALARIES_CAD;
  const base = baseSalaries[role];
  if (!base) return null;
  const mult = CITY_MULTIPLIERS[city] || 1;
  const range = base[level];
  if (!range) return null;
  return [Math.round(range[0] * mult / 1000) * 1000, Math.round(range[1] * mult / 1000) * 1000];
}

export function getAllLevels(role, city) {
  return {
    junior: getSalary(role, city, 'junior'),
    mid: getSalary(role, city, 'mid'),
    senior: getSalary(role, city, 'senior'),
  };
}

export function getTopCities(role, level, count = 5, country = null) {
  const cityList = country ? CITIES.filter(c => c.country === country).map(c => c.name) : ALL_CITY_NAMES;
  return cityList
    .map(city => ({ city, salary: getSalary(role, city, level), currency: getCurrency(city) }))
    .filter(d => d.salary)
    .sort((a, b) => b.salary[1] - a.salary[1])
    .slice(0, count);
}
