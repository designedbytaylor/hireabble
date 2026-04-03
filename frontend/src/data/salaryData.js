export const CANADIAN_CITIES = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton',
  'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener', 'London', 'Halifax',
  'Victoria', 'Saskatoon', 'Regina', "St. John's", 'Kelowna', 'Barrie',
  'Windsor', 'Mississauga'
];

const CITY_MULTIPLIERS = {
  'Toronto': 1.0, 'Vancouver': 1.05, 'Montreal': 0.88, 'Calgary': 0.97,
  'Ottawa': 0.95, 'Edmonton': 0.93, 'Winnipeg': 0.85, 'Quebec City': 0.82,
  'Hamilton': 0.90, 'Kitchener': 0.92, 'London': 0.85, 'Halifax': 0.87,
  'Victoria': 0.95, 'Saskatoon': 0.86, 'Regina': 0.85, "St. John's": 0.88,
  'Kelowna': 0.90, 'Barrie': 0.88, 'Windsor': 0.83, 'Mississauga': 0.98,
};

export const ROLES = [
  'Software Developer', 'Data Analyst', 'Project Manager', 'Registered Nurse',
  'Marketing Manager', 'Accountant', 'Graphic Designer', 'Sales Representative',
  'HR Manager', 'Electrician', 'Mechanical Engineer', 'Teacher', 'Pharmacist',
  'Financial Analyst', 'UX Designer', 'DevOps Engineer', 'Business Analyst',
  'Civil Engineer', 'Dental Hygienist', 'Social Worker', 'Construction Manager',
  'Plumber', 'Welder', 'Truck Driver', 'Administrative Assistant',
  'Customer Service Rep', 'Retail Manager', 'Chef', 'Physiotherapist', 'Paramedic'
];

const BASE_SALARIES = {
  'Software Developer':       { junior: [55000, 72000], mid: [75000, 100000], senior: [105000, 145000] },
  'Data Analyst':             { junior: [48000, 60000], mid: [62000, 82000], senior: [85000, 115000] },
  'Project Manager':          { junior: [55000, 68000], mid: [72000, 95000], senior: [100000, 135000] },
  'Registered Nurse':         { junior: [58000, 68000], mid: [70000, 85000], senior: [88000, 105000] },
  'Marketing Manager':        { junior: [48000, 60000], mid: [65000, 85000], senior: [90000, 125000] },
  'Accountant':               { junior: [45000, 56000], mid: [58000, 78000], senior: [82000, 110000] },
  'Graphic Designer':         { junior: [38000, 48000], mid: [50000, 68000], senior: [72000, 95000] },
  'Sales Representative':     { junior: [40000, 52000], mid: [55000, 75000], senior: [80000, 120000] },
  'HR Manager':               { junior: [50000, 62000], mid: [65000, 85000], senior: [90000, 120000] },
  'Electrician':              { junior: [45000, 58000], mid: [60000, 78000], senior: [80000, 100000] },
  'Mechanical Engineer':      { junior: [55000, 68000], mid: [72000, 92000], senior: [95000, 130000] },
  'Teacher':                  { junior: [45000, 55000], mid: [58000, 75000], senior: [78000, 98000] },
  'Pharmacist':               { junior: [75000, 90000], mid: [92000, 110000], senior: [112000, 135000] },
  'Financial Analyst':        { junior: [50000, 62000], mid: [65000, 88000], senior: [92000, 125000] },
  'UX Designer':              { junior: [50000, 65000], mid: [68000, 90000], senior: [95000, 130000] },
  'DevOps Engineer':          { junior: [60000, 78000], mid: [82000, 108000], senior: [112000, 150000] },
  'Business Analyst':         { junior: [50000, 62000], mid: [65000, 85000], senior: [90000, 120000] },
  'Civil Engineer':           { junior: [52000, 65000], mid: [68000, 88000], senior: [92000, 125000] },
  'Dental Hygienist':         { junior: [55000, 68000], mid: [70000, 85000], senior: [88000, 105000] },
  'Social Worker':            { junior: [42000, 52000], mid: [55000, 70000], senior: [72000, 90000] },
  'Construction Manager':     { junior: [55000, 70000], mid: [75000, 95000], senior: [100000, 135000] },
  'Plumber':                  { junior: [42000, 55000], mid: [58000, 75000], senior: [78000, 98000] },
  'Welder':                   { junior: [40000, 52000], mid: [55000, 72000], senior: [75000, 95000] },
  'Truck Driver':             { junior: [40000, 50000], mid: [52000, 68000], senior: [70000, 88000] },
  'Administrative Assistant': { junior: [32000, 40000], mid: [42000, 52000], senior: [54000, 65000] },
  'Customer Service Rep':     { junior: [30000, 38000], mid: [40000, 50000], senior: [52000, 62000] },
  'Retail Manager':           { junior: [38000, 48000], mid: [50000, 62000], senior: [65000, 82000] },
  'Chef':                     { junior: [32000, 42000], mid: [45000, 58000], senior: [60000, 80000] },
  'Physiotherapist':          { junior: [55000, 68000], mid: [70000, 88000], senior: [90000, 110000] },
  'Paramedic':                { junior: [50000, 62000], mid: [65000, 80000], senior: [82000, 100000] },
};

export function getSalary(role, city, level) {
  const base = BASE_SALARIES[role];
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

export function getTopCities(role, level, count = 5) {
  return CANADIAN_CITIES
    .map(city => ({ city, salary: getSalary(role, city, level) }))
    .filter(d => d.salary)
    .sort((a, b) => b.salary[1] - a.salary[1])
    .slice(0, count);
}
